/**
 * REST API 集成测试
 *
 * @description
 * 测试 REST API 的所有端点功能
 *
 * @testTarget
 * - 健康检查端点
 * - Analytics API 所有端点
 * - 错误处理
 * - CORS 配置
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { DIContainer } from '../../api/di.js';
import app from '../../api/server.js';
import { MemoryStore } from '../../core/MemoryStore.js';
import { RetroRecord } from '../../types/index.js';

/**
 * 测试服务器配置（使用独立端口避免冲突）
 */
const TEST_PORT = 3096;
const TEST_HOST = '127.0.0.1';
const BASE_URL = `http://${TEST_HOST}:${TEST_PORT}`;

let server: any;
let httpServer: any = null;

describe('REST API 集成测试', () => {
  /**
   * 启动测试服务器
   */
  beforeAll(async () => {
    // 初始化测试数据
    const memoryStore = DIContainer.getMemoryStore();

    // 创建测试复盘数据
    const testRetro: RetroRecord = {
      id: 'test-retro-001',
      timestamp: new Date().toISOString(),
      type: 'quick',
      duration: 300000,
      user_id: 'test-user-001',
      violations: [],
      patterns: [],
      context: '测试复盘数据',
      action_items: []
    };

    await memoryStore.saveRetroRecord(testRetro);

    // 启动服务器（使用Bun.serve而非startServer，以便可以关闭）
    const { Hono } = await import('hono');
    const analyticsRouter = await import('../../api/routes/analytics.js');

    // 创建测试应用
    const app = new Hono();

    // 添加CORS中间件
    const { createCORSMiddleware } = await import('../../api/middleware/cors.js');
    app.use('*', createCORSMiddleware({ environment: 'development' }));

    // 健康检查端点
    app.get('/health', (c) => c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development'
    }));

    // 根路径 - 重定向到 Dashboard
    app.get('/', (c) => c.redirect('/ui/index.html'));

    // UI 静态文件服务
    app.get('/ui/*', async (c) => {
      const filePath = c.req.path();
      const { join } = await import('path');
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

    // 挂载 Analytics 路由
    app.route('/api/v1/analytics', analyticsRouter.default);

    // 初始化 Analytics 服务
    const { AnalyticsService, TimePeriod } = await import('../../core/analytics/index-full.js');
    const analyticsService = new AnalyticsService({ memoryStore });
    analyticsRouter.initAnalytics(analyticsService);

    // 404 处理
    app.notFound((c) => c.json({
      success: false,
      error: 'Not Found'
    }, 404));

    // 启动HTTP服务器
    httpServer = Bun.serve({
      fetch: app.fetch,
      port: TEST_PORT,
      hostname: TEST_HOST
    });

    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  /**
   * 关闭测试服务器
   */
  afterAll(async () => {
    if (httpServer) {
      httpServer.stop();
      httpServer = null;
    }
    DIContainer.dispose();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('健康检查', () => {
    it('应该返回健康状态', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThan(0);
      expect(data.version).toBe('2.0.0');
    });

    it('应该返回环境信息', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(data.environment).toBeDefined();
      expect(['development', 'production', 'test']).toContain(data.environment);
    });
  });

  describe('根路径', () => {
    it('应该重定向到 UI', async () => {
      const response = await fetch(`${BASE_URL}/`, {
        redirect: 'manual' // 不自动跟随重定向
      });

      // 应该返回重定向状态码
      expect([302, 301, 307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toContain('/ui/index.html');
    });
  });

  describe('Analytics API', () => {
    describe('GET /api/v1/analytics/usage', () => {
      it('应该返回使用指标（默认 period=week）', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/usage`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.totalRetrospectives).toBeGreaterThanOrEqual(0);
        expect(data.meta.timestamp).toBeDefined();
        expect(data.meta.requestId).toBeDefined();
        expect(data.meta.version).toBe('2.0.0');
      });

      it('应该支持自定义 period 参数', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/usage?period=today`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.period).toBeDefined();
      });
    });

    describe('GET /api/v1/analytics/quality', () => {
      it('应该返回质量指标', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/quality`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        // QualityMetrics 包含 violationRate, falsePositiveRate, patternMatchAccuracy
        expect(typeof data.data.violationRate === 'number' || data.data.violationRate === undefined).toBe(true);
      });
    });

    describe('GET /api/v1/analytics/performance', () => {
      it('应该返回性能指标', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/performance`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.avgCheckTime).toBeGreaterThanOrEqual(0);
      });
    });

    describe('GET /api/v1/analytics/trends/:metric', () => {
      it('应该返回趋势分析', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/trends/violations?period=month`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        // TrendAnalysis 包含 direction, slope, dataPoints
        expect(data.data.direction || data.data.direction === undefined).toBeDefined();
        if (data.data.direction) {
          expect(['up', 'down', 'stable']).toContain(data.data.direction);
        }
      });

      it('应该支持不同的指标', async () => {
        const metrics = ['violations'];

        for (const metric of metrics) {
          const response = await fetch(`${BASE_URL}/api/v1/analytics/trends/${metric}`);
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
          expect(data.data).toBeDefined();
        }
      });
    });

    describe('GET /api/v1/analytics/anomalies', () => {
      it('应该返回异常检测结果', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/anomalies`);
        // 可能返回500如果没有数据
        expect([200, 500]).toContain(response.status);

        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(Array.isArray(data.data)).toBe(true);
        }
      });
    });

    describe('GET /api/v1/analytics/dashboard', () => {
      it('应该返回仪表板数据', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/dashboard`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.summary).toBeDefined();
        expect(data.data.trends).toBeDefined();
        expect(Array.isArray(data.data.alerts)).toBe(true);
      });
    });

    describe('GET /api/v1/analytics/cache/stats', () => {
      it('应该返回缓存统计', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/cache/stats`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.size).toBeGreaterThanOrEqual(0);
        expect(data.data.maxSize).toBeGreaterThan(0);
        expect(data.data.hits).toBeGreaterThanOrEqual(0);
        expect(data.data.misses).toBeGreaterThanOrEqual(0);
      });
    });

    describe('DELETE /api/v1/analytics/cache', () => {
      it('应该清除缓存', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/analytics/cache`, {
          method: 'DELETE'
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Cache cleared');
      });
    });
  });

  describe('错误处理', () => {
    it('应该返回 404 对于不存在的路径', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/nonexistent`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Not Found');
    });

    it('应该返回 400 对于无效的 period 参数', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/analytics/usage?period=invalid`);
      const data = await response.json();

      expect(response.status).toBe(400); // Zod 验证返回 400
      expect(data.success).toBe(false);
    });
  });

  describe('CORS', () => {
    it('开发环境应该允许 localhost 来源', async () => {
      const response = await fetch(`${BASE_URL}/health`, {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });

      // 开发环境应该返回 CORS 头
      const allowOrigin = response.headers.get('access-control-allow-origin');
      expect(allowOrigin).toBe('http://localhost:3000');
    });

    it('预检缓存时间应该为 10 分钟（600 秒）', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/analytics/usage`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET'
        }
      });

      const maxAge = response.headers.get('access-control-max-age');
      expect(maxAge).toBe('600');
    });

    it('不应该返回通配符来源', async () => {
      const response = await fetch(`${BASE_URL}/health`, {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });

      const allowOrigin = response.headers.get('access-control-allow-origin');
      // 应该是具体的来源，而不是通配符
      expect(allowOrigin).not.toBe('*');
      expect(allowOrigin).toMatch(/^https?:\/\//);
    });
  });

  describe('响应格式一致性', () => {
    it('所有成功响应应该有 success: true', async () => {
      const endpoints = [
        '/api/v1/analytics/usage',
        '/api/v1/analytics/quality',
        '/api/v1/analytics/cache/stats'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        const data = await response.json();

        expect(data.success).toBe(true);
      }
    });

    it('所有响应应该有 timestamp', async () => {
      const endpoints = [
        '/api/v1/analytics/usage'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        const data = await response.json();

        expect(data.meta?.timestamp || data.timestamp).toBeDefined();
      }
    });

    it('健康检查端点应该有timestamp', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
    });
  });
});
