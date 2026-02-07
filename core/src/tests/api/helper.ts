/**
 * 测试辅助工具
 *
 * @description
 * 提供测试所需的工具函数
 *
 * @module tests/api/helper
 */

import { Hono } from 'hono';
import { JWTService } from '../../api/auth/JWTService.js';
import { jwtMiddleware } from '../../api/auth/middleware/jwtMiddleware.js';
import { AnalyticsRecordsStore } from '../../api/stores/AnalyticsRecordsStore.js';

// 测试用的记录存储实例
let testRecordsStore: AnalyticsRecordsStore | null = null;

/**
 * 测试用JWT配置
 */
const TEST_JWT_CONFIG = {
  secret: 'test-secret-key-for-testing-minimum-32-chars',
  accessTokenTTL: 3600,
  refreshTokenTTL: 86400,
  issuer: 'prism-gateway-test',
  audience: 'prism-gateway-api-test'
} as const;

/**
 * 单例JWT服务实例
 */
let jwtServiceInstance: JWTService | null = null;

/**
 * 获取或创建JWT服务实例
 *
 * @returns JWTService实例
 */
function getJWTService(): JWTService {
  if (!jwtServiceInstance) {
    jwtServiceInstance = new JWTService(TEST_JWT_CONFIG);
  }
  return jwtServiceInstance;
}

/**
 * 生成测试用的JWT token
 *
 * @param user - 用户信息
 * @returns JWT token
 */
export function generateTestToken(user: { sub: string; username: string }): string {
  const jwtService = getJWTService();
  return jwtService.generateAccessToken(user);
}

/**
 * 构建测试应用
 *
 * @description
 * 创建Hono应用实例用于测试，包含认证中间件
 *
 * @returns Hono应用实例
 */
export async function buildApp() {
  // 创建最小化的Hono应用用于测试
  const app = new Hono();

  // 添加基础中间件
  app.use('*', async (c, next) => {
    c.set('requestId', `test_${Date.now()}`);
    await next();
  });

  // 创建JWT服务
  const jwtService = getJWTService();

  // 使用真实的JWT认证中间件
  const authMiddleware = jwtMiddleware({ jwtService });

  // 认证端点 - 生成真实的JWT token
  app.post('/api/v1/auth/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const username = body.username || 'testuser';

    // 生成真实的JWT token
    const tokens = jwtService.generateTokens({
      sub: `user_${username}_${Date.now()}`,
      username
    });

    return c.json({
      success: true,
      data: tokens
    });
  });

  // 刷新token端点
  app.post('/api/v1/auth/refresh', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const refreshToken = body.refreshToken;

    if (!refreshToken) {
      return c.json({
        success: false,
        error: 'Refresh token is required'
      }, 401);
    }

    try {
      const tokens = jwtService.refreshAccessToken(refreshToken);
      return c.json({
        success: true,
        data: tokens
      });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid refresh token'
      }, 401);
    }
  });

  // 导入Analytics路由和服务
  const analyticsRouter = await import('../../api/routes/analytics.js');
  const { AnalyticsService } = await import('../../core/analytics/index-full.js');
  const { MemoryStore } = await import('../../core/MemoryStore.js');
  const { AnalyticsRecordsStore } = await import('../../api/stores/AnalyticsRecordsStore.js');

  // 创建或重置记录存储
  if (!testRecordsStore) {
    testRecordsStore = new AnalyticsRecordsStore();
  } else {
    (testRecordsStore as any).records?.clear();
  }

  // 初始化Analytics服务
  const memoryStore = new MemoryStore();
  const analyticsService = new AnalyticsService({ memoryStore });
  analyticsRouter.initAnalytics(analyticsService);

  // 创建带认证的Analytics子应用
  const analyticsApp = new Hono();
  analyticsApp.use('*', authMiddleware); // 添加JWT认证中间件
  analyticsApp.route('/', analyticsRouter.default);

  // 挂载Analytics路由
  app.route('/api/v1/analytics', analyticsApp);

  return app;
}

/**
 * 导出JWT配置供测试使用
 */
export { TEST_JWT_CONFIG };

/**
 * 导出获取JWT服务的函数
 */
export { getJWTService };

/**
 * 重置测试记录存储
 * 使用路由模块导出的resetRecordsStore函数
 */
export async function resetTestRecordsStore(): Promise<void> {
  try {
    const analyticsModule = await import('../../api/routes/analytics.js');
    if ('resetRecordsStore' in analyticsModule) {
      (analyticsModule as any).resetRecordsStore();
    }
  } catch {
    // 模块可能还未加载，忽略
  }
}

/**
 * 获取测试记录存储
 */
export function getTestRecordsStore(): AnalyticsRecordsStore | null {
  return testRecordsStore;
}
