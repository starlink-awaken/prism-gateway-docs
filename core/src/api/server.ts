/**
 * PRISM-Gateway REST API Server
 *
 * @description
 * 主服务器文件，使用 Hono 框架提供 REST API 接口
 *
 * @features
 * - 统一路由管理（/api/v1/*）
 * - CORS 支持
 * - 全局错误处理
 * - 请求日志
 * - 健康检查端点
 * - JWT 认证
 * - 优雅关闭
 *
 * @example
 * ```bash
 * # 启动服务器
 * bun run src/api/server.ts
 *
 * # 健康检查
 * curl http://localhost:3000/health
 *
 * # 登录获取 Token
 * curl -X POST http://localhost:3000/api/v1/auth/login \
 *   -H "Content-Type: application/json" \
 *   -d '{"username":"testuser","password":"password123"}'
 *
 * # 使用 Token 访问受保护的 API
 * curl http://localhost:3000/api/v1/analytics/usage?period=week \
 *   -H "Authorization: Bearer YOUR_TOKEN"
 * ```
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// 导入依赖注入
import { DIContainer } from './di.js';

// 导入路由
import analyticsRouter from './routes/analytics.js';

// 导入认证模块
import { JWTServiceWithKeyManagement, authRouter } from './auth/index.js';

// 导入速率限制中间件（P0 安全修复）
import {
  createAuthLimiter,
  createApiLimiter,
  createPublicLimiter
} from './middleware/rateLimitHono.js';

// 导入安全 CORS 中间件（P0 安全修复 SEC-003）
import { createCORSMiddleware } from './middleware/cors.js';

// 导入 WebSocket 服务器（Task 64: WebSocket 实时通信）
import { WebSocketServer } from './websocket/WebSocketServer.js';

// 导入路径模块
import { join } from 'path';

// 创建主应用
const app = new Hono();

// WebSocket 服务器实例
let wsServer: WebSocketServer | null = null;

/**
 * 全局中间件配置
 */

// 1. 安全 CORS 支持（P0 修复：SEC-003）
//    - 移除通配符 origin: '*'
//    - 实现来源白名单验证
//    - 减少预检缓存时间到 10 分钟
//    - 支持环境变量 CORS_ALLOWED_ORIGINS 配置
app.use('*', createCORSMiddleware());

// 2. 请求日志
app.use('*', logger());

// 3. JSON 美化输出（开发环境）
if (process.env.NODE_ENV !== 'production') {
  app.use('*', prettyJSON());
}

/**
 * 健康检查端点
 *
 * @description
 * 用于负载均衡器和服务发现的健康检查
 *
 * @returns {200} 健康状态
 *
 * @example
 * ```bash
 * curl http://localhost:3000/health
 * # {"status":"ok","timestamp":"2026-02-05T...","uptime":123}
 * ```
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * UI 静态文件服务（Task 65: Web UI 基础框架）
 *
 * @description
 * 提供 Dashboard HTML 页面
 *
 * @returns {200} HTML 页面
 *
 * @example
 * ```bash
 * curl http://localhost:3000/ui/index.html
 * ```
 */
app.get('/ui/*', async (c) => {
  const filePath = c.req.path;
  const fullPath = join(process.cwd(), 'src', 'ui', filePath.replace('/ui/', ''));

  try {
    const file = Bun.file(fullPath);
    return new Response(file);
  } catch (error) {
    return c.json({
      success: false,
      error: 'File not found'
    }, 404);
  }
});

/**
 * 根路径 - 重定向到 Dashboard
 *
 * @description
 * 访问根路径时自动跳转到 Dashboard UI
 */
app.get('/', (c) => {
  return c.redirect('/ui/index.html');
});

/**
 * API v1 路由组
 *
 * @description
 * 所有 v1 API 端点都挂载在 /api/v1 下
 *
 * @remarks
 * P0 安全修复：启用速率限制中间件
 * - 认证端点：10 次/15 分钟（防暴力破解）
 * - API 端点：100 次/15 分钟（正常使用）
 * - 公开端点：50 次/15 分钟（更严格）
 */

// 认证路由（公开）+ 速率限制
// 注意：认证路由必须在 JWT 服务初始化后注册
// 使用 JWTServiceWithKeyManagement 支持密钥轮换（Task #14: 密钥管理服务集成）
let jwtService: JWTServiceWithKeyManagement | null = null;

// 创建认证限流器（10 次/15 分钟）
const authLimiter = createAuthLimiter({
  whitelist: process.env.RATE_LIMIT_WHITELIST
    ? process.env.RATE_LIMIT_WHITELIST.split(',').map(ip => ip.trim())
    : ['127.0.0.1', '::1'] // 默认本地地址白名单
});

// 创建 API 限流器（100 次/15 分钟）
const apiLimiter = createApiLimiter({
  whitelist: process.env.RATE_LIMIT_WHITELIST
    ? process.env.RATE_LIMIT_WHITELIST.split(',').map(ip => ip.trim())
    : ['127.0.0.1', '::1']
});

// Analytics 路由（带 API 限流）
const analyticsApp = new Hono();
analyticsApp.use('*', apiLimiter);
analyticsApp.route('/', analyticsRouter);
app.route('/api/v1/analytics', analyticsApp);

/**
 * 404 处理
 *
 * @description
 * 捕获所有未匹配的路由
 */
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    message: `路径 ${c.req.path} 不存在`,
    docs: '/api/v1/docs'
  }, 404);
});

/**
 * 全局错误处理
 *
 * @description
 * 捕获所有未处理的错误
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  return c.json({
    success: false,
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') || 'unknown'
    }
  }, 500);
});

/**
 * 启动服务器
 *
 * @description
 * 启动 HTTP 服务器监听请求
 *
 * @param port - 监听端口（默认 3000）
 * @param hostname - 监听地址（默认 0.0.0.0）
 */
export async function startServer(
  port: number = 3000,
  hostname: string = '0.0.0.0'
): Promise<void> {
  // 初始化依赖注入容器
  DIContainer.initialize();

  // 初始化 JWT 服务（使用支持密钥管理的版本）
  jwtService = new JWTServiceWithKeyManagement({
    secret: process.env.JWT_SECRET || 'dev-secret-key-at-least-32-characters-long-for-testing',
    accessTokenTTL: parseInt(process.env.JWT_ACCESS_TTL || '3600'),
    refreshTokenTTL: parseInt(process.env.JWT_REFRESH_TTL || '604800'),
    issuer: process.env.JWT_ISSUER || 'prism-gateway',
    audience: process.env.JWT_AUDIENCE || 'prism-gateway-api',
    keyRotationDays: parseInt(process.env.JWT_KEY_ROTATION_DAYS || '30') // 密钥轮换周期（天）
  });

  // 注册认证路由（使用模拟用户服务 + 认证限流）
  // 生产环境应使用真实的用户服务
  const mockUserService = {
    async findByUsername(username: string) {
      // 开发环境的模拟用户
      if (username === 'testuser') {
        return {
          id: 'user1',
          passwordHash: 'hashed_password123'
        };
      }
      return null;
    },
    async verifyPassword(password: string, hash: string) {
      // 开发环境：简单验证（生产环境使用 bcrypt）
      return hash === `hashed_${password}`;
    }
  };

  // 创建认证路由子应用，应用限流中间件
  const authApp = new Hono();
  authApp.use('*', authLimiter);
  authApp.route('/', authRouter({
    jwtService,
    userService: mockUserService
  }));

  app.route('/api/v1/auth', authApp);

  // 初始化 WebSocket 服务器（Task 64: WebSocket 实时通信）
  // 注意：必须在Analytics之前初始化，以便Analytics可以使用wsServer推送事件
  wsServer = new WebSocketServer({
    port: 3001, // WebSocket 使用独立端口
    heartbeatInterval: 30000, // 30秒心跳
    timeout: 60000, // 60秒超时
    maxConnections: 100
  });

  await wsServer.start();

  // 监听 WebSocket 事件，与 Analytics 集成
  wsServer.on('connection', (conn) => {
    console.log(`[WebSocket] 新连接: ${conn.id}`);
  });

  wsServer.on('disconnect', (conn) => {
    console.log(`[WebSocket] 连接断开: ${conn.id}`);
  });

  // 初始化 Analytics 路由（Task 74: 传递wsServer用于事件推送）
  const analyticsService = DIContainer.getAnalyticsService();
  const { initAnalytics } = await import('./routes/analytics.js');
  initAnalytics(analyticsService, wsServer);

  // 导出wsServer实例供其他模块使用（Task 74: 实时事件推送）
  // 注意：这里不能使用 export，因为是在函数内部
  // 请通过 WebSocketServer 类直接获取实例

  const server = serve({
    fetch: app.fetch,
    port,
    hostname
  });

  console.log(`
╔════════════════════════════════════════════════════════════╗
║          PRISM-Gateway REST API Server                   ║
╠════════════════════════════════════════════════════════════╣
║  Version:     2.3.0                                       ║
║  Environment: ${process.env.NODE_ENV || 'development'.padEnd(20)}║
╠════════════════════════════════════════════════════════════╣
║  HTTP Server:                                             ║
║  URL:         http://${hostname}:${port}                   ║
║  Health:      http://${hostname}:${port}/health            ║
║  API:         http://${hostname}:${port}/api/v1            ║
║  Dashboard:   http://${hostname}:${port}/ui/index.html     ║
╠════════════════════════════════════════════════════════════╣
║  WebSocket Server:                                        ║
║  URL:         ws://${hostname}:3001/ws                     ║
║  Status:      ✅ Running                                   ║
╠════════════════════════════════════════════════════════════╣
║  Authentication Endpoints:                               ║
║  POST   /api/v1/auth/login     - User login               ║
║  POST   /api/v1/auth/refresh   - Refresh access token     ║
║  GET    /api/v1/auth/me        - Get current user         ║
║  POST   /api/v1/auth/logout    - User logout              ║
╠════════════════════════════════════════════════════════════╣
║  Analytics Endpoints:                                   ║
║  GET    /api/v1/analytics/usage      - Usage metrics       ║
║  GET    /api/v1/analytics/quality    - Quality metrics     ║
║  GET    /api/v1/analytics/dashboard  - Dashboard data      ║
║  POST   /api/v1/analytics/records    - Create record       ║
║  GET    /api/v1/analytics/records    - List records        ║
╚════════════════════════════════════════════════════════════╝
  `);

  // 优雅关闭
  const shutdown = async () => {
    console.log('\n🛑 正在关闭服务器...');

    // 关闭 WebSocket 服务器
    if (wsServer) {
      console.log('  关闭 WebSocket 服务器...');
      await wsServer.stop();
    }

    DIContainer.dispose();
    server.close();
    console.log('✅ 服务器已关闭');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * 直接运行此文件时启动服务器
 */
if (import.meta.main) {
  const port = parseInt(process.env.PORT || '3000', 10);
  const hostname = process.env.HOSTNAME || '0.0.0.0';

  startServer(port, hostname).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

/**
 * 导出应用实例（用于测试）
 */
export default app;
