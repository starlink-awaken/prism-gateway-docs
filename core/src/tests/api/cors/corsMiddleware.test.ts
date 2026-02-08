/**
 * CORS 安全中间件测试
 *
 * @description
 * 测试 CORS 中间件的安全功能，确保：
 * - 只允许配置的来源访问
 * - 开发环境支持 localhost
 * - 生产环境严格验证来源
 * - 预检请求正确处理
 *
 * @testTarget
 * - 来源验证
 * - 环境变量配置
 * - 预检请求
 * - 安全降级
 *
 * @security
 * P0: 修复 SEC-003 CORS 配置漏洞
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { createCORSMiddleware } from '../../../api/middleware/cors.js';

/**
 * 测试辅助函数：创建测试应用
 */
function createTestApp(config?: { allowedOrigins?: string; environment?: string }) {
  const app = new Hono();

  // 设置环境变量
  if (config?.allowedOrigins) {
    process.env.CORS_ALLOWED_ORIGINS = config.allowedOrigins;
  } else {
    delete process.env.CORS_ALLOWED_ORIGINS;
  }

  if (config?.environment) {
    process.env.NODE_ENV = config.environment;
  } else {
    delete process.env.NODE_ENV;
  }

  // 应用 CORS 中间件
  app.use('*', createCORSMiddleware());

  // 添加测试端点
  app.get('/test', (c) => c.json({ message: 'ok' }));
  app.post('/test', (c) => c.json({ message: 'created' }));

  return app;
}

/**
 * 清理环境变量
 */
function cleanupEnv() {
  delete process.env.CORS_ALLOWED_ORIGINS;
  delete process.env.NODE_ENV;
}

describe('CORS 安全中间件 - RED 阶段测试', () => {
  beforeEach(() => {
    cleanupEnv();
  });

  afterEach(() => {
    cleanupEnv();
  });

  describe('1. 允许的来源验证', () => {
    it('应该允许来自配置域名的请求', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com,https://app.example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        headers: {
          'Origin': 'https://example.com'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    });

    it('应该允许多个配置域名中的任何一个', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com,https://app.example.com,https://admin.example.com',
        environment: 'production'
      });

      const origins = [
        'https://example.com',
        'https://app.example.com',
        'https://admin.example.com'
      ];

      for (const origin of origins) {
        const response = await app.request('/test', {
          headers: { 'Origin': origin }
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      }
    });
  });

  describe('2. 开发环境 localhost 支持', () => {
    it('开发环境应该允许 localhost:3000', async () => {
      const app = createTestApp({
        environment: 'development'
      });

      const response = await app.request('/test', {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    });

    it('开发环境应该允许 localhost:5173 (Vite 默认端口)', async () => {
      const app = createTestApp({
        environment: 'development'
      });

      const response = await app.request('/test', {
        headers: {
          'Origin': 'http://localhost:5173'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    });

    it('开发环境应该允许 127.0.0.1', async () => {
      const app = createTestApp({
        environment: 'development'
      });

      const response = await app.request('/test', {
        headers: {
          'Origin': 'http://127.0.0.1:3000'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:3000');
    });
  });

  describe('3. 拒绝未授权来源', () => {
    it('生产环境应该拒绝未配置的域名', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        headers: {
          'Origin': 'https://evil.com'
        }
      });

      expect(response.status).toBe(200); // 请求仍然成功，但没有 CORS 头
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('生产环境应该拒绝子域名（除非明确配置）', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        headers: {
          'Origin': 'https://sub.example.com'
        }
      });

      expect(response.headers.get('access-control-allow-origin')).not.toBe('https://sub.example.com');
    });

    it('生产环境应该拒绝不带协议的来源', async () => {
      const app = createTestApp({
        allowedOrigins: 'example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        headers: {
          'Origin': 'https://example.com'
        }
      });

      // 应该不匹配，因为配置中缺少协议
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('4. 预检请求（OPTIONS）', () => {
    it('应该正确处理预检请求', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization'
        }
      });

      expect(response.status).toBe(204); // No content 是预检请求的标准响应
      expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
      expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    });

    it('预检请求缓存时间应该为 10 分钟（600 秒）', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      expect(response.headers.get('access-control-max-age')).toBe('600');
    });

    it('应该拒绝未授权来源的预检请求', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil.com',
          'Access-Control-Request-Method': 'POST'
        }
      });

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('5. 环境变量配置', () => {
    it('应该从环境变量读取允许的来源', async () => {
      // 先设置环境变量
      process.env.CORS_ALLOWED_ORIGINS = 'https://app1.com,https://app2.com';
      process.env.NODE_ENV = 'production';

      // 直接使用中间件（不通过 createTestApp，避免环境变量被重置）
      const app = new Hono();
      const { createCORSMiddleware } = await import('../../../api/middleware/cors.js');
      app.use('*', createCORSMiddleware());
      app.get('/test', (c) => c.json({ message: 'ok' }));

      const response = await app.request('/test', {
        headers: { 'Origin': 'https://app1.com' }
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('https://app1.com');

      // 清理
      delete process.env.CORS_ALLOWED_ORIGINS;
      delete process.env.NODE_ENV;
    });

    it('应该处理环境变量中的空格', async () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app1.com, https://app2.com , https://app3.com';
      process.env.NODE_ENV = 'production';

      const app = new Hono();
      const { createCORSMiddleware } = await import('../../../api/middleware/cors.js');
      app.use('*', createCORSMiddleware());
      app.get('/test', (c) => c.json({ message: 'ok' }));

      const response = await app.request('/test', {
        headers: { 'Origin': 'https://app2.com' }
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('https://app2.com');

      // 清理
      delete process.env.CORS_ALLOWED_ORIGINS;
      delete process.env.NODE_ENV;
    });

    it('空环境变量应该使用安全默认值', async () => {
      process.env.CORS_ALLOWED_ORIGINS = '';
      process.env.NODE_ENV = 'production';

      const app = new Hono();
      const { createCORSMiddleware } = await import('../../../api/middleware/cors.js');
      app.use('*', createCORSMiddleware());
      app.get('/test', (c) => c.json({ message: 'ok' }));

      // 生产环境空配置应该拒绝所有请求
      const response = await app.request('/test', {
        headers: { 'Origin': 'https://example.com' }
      });

      expect(response.headers.get('access-control-allow-origin')).toBeNull();

      // 清理
      delete process.env.CORS_ALLOWED_ORIGINS;
      delete process.env.NODE_ENV;
    });
  });

  describe('6. 安全降级和默认配置', () => {
    it('生产环境无配置应该拒绝所有跨域请求', async () => {
      // 不设置任何环境变量
      const app = createTestApp({ environment: 'production' });

      const response = await app.request('/test', {
        headers: { 'Origin': 'https://example.com' }
      });

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('应该支持凭证传递（Allow-Credentials）', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        headers: {
          'Origin': 'https://example.com',
          'Cookie': 'session=abc123'
        }
      });

      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    });

    it('应该暴露自定义响应头（如果配置）', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'X-Custom-Header'
        }
      });

      const exposedHeaders = response.headers.get('access-control-expose-headers');
      expect(exposedHeaders).toBeDefined();
    });
  });

  describe('7. 边界情况', () => {
    it('没有 Origin 头的请求应该正常处理', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test');

      expect(response.status).toBe(200);
    });

    it('应该拒绝来自 null 的来源（如 file:// 协议）', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      const response = await app.request('/test', {
        headers: { 'Origin': 'null' }
      });

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('应该正确处理端口变化（开发环境动态添加）', async () => {
      // 开发环境会动态添加本地来源
      const app = createTestApp({
        environment: 'development'
      });

      // 任意端口的 localhost 都应该被允许（开发环境）
      const response = await app.request('/test', {
        headers: { 'Origin': 'http://localhost:9999' }
      });

      // 开发环境应该允许任意端口的 localhost
      const allowedOrigin = response.headers.get('access-control-allow-origin');
      expect(allowedOrigin).toBe('http://localhost:9999');
    });

    it('生产环境不同端口不应该匹配', async () => {
      // 生产环境需要精确匹配
      const app = new Hono();
      const { createCORSMiddleware } = await import('../../../api/middleware/cors.js');

      // 设置生产环境
      process.env.NODE_ENV = 'production';

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['http://localhost:3000']
      }));
      app.get('/test', (c) => c.json({ message: 'ok' }));

      // 不同端口不应该匹配
      const response = await app.request('/test', {
        headers: { 'Origin': 'http://localhost:3001' }
      });

      const allowedOrigin = response.headers.get('access-control-allow-origin');
      expect(allowedOrigin).toBeNull();

      // 清理
      delete process.env.NODE_ENV;
    });
  });

  describe('8. 安全验证', () => {
    it('不应该允许通配符来源（*）', async () => {
      const app = createTestApp({
        allowedOrigins: '*',
        environment: 'production'
      });

      const response = await app.request('/test', {
        headers: { 'Origin': 'https://evil.com' }
      });

      // 即使配置为 *，也应该验证具体来源
      // 不应该返回 * 作为 allow-origin
      const allowOrigin = response.headers.get('access-control-allow-origin');
      expect(allowOrigin).not.toBe('*');
    });

    it('应该防止来源混淆攻击', async () => {
      const app = createTestApp({
        allowedOrigins: 'https://example.com',
        environment: 'production'
      });

      // 尝试使用类似的域名
      const similarOrigins = [
        'https://example.com.evil.com',
        'https://evilexample.com',
        'https://example-com.evil.com'
      ];

      for (const origin of similarOrigins) {
        const response = await app.request('/test', {
          headers: { 'Origin': origin }
        });

        const allowOrigin = response.headers.get('access-control-allow-origin');
        expect(allowOrigin).not.toBe(origin);
        expect(allowOrigin).not.toBe('*');
      }
    });
  });
});
