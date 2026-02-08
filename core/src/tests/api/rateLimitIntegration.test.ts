/**
 * P0: 速率限制 API 集成测试
 *
 * @description
 * 验证速率限制中间件在真实 API 端点上的工作情况
 *
 * @module tests/api/rateLimitIntegration
 */

import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { createAuthLimiter, createApiLimiter } from '../../api/middleware/rateLimitHono.js';
import { authRouter, IUserService } from '../../api/auth/routes/authRoutes.js';
import { JWTService } from '../../api/auth/JWTService.js';

// 模拟用户服务
const mockUserService: IUserService = {
  async findByUsername(username: string) {
    if (username === 'testuser') {
      return {
        id: 'user1',
        passwordHash: 'hashed_password123'
      };
    }
    return null;
  },
  async verifyPassword(password: string, hash: string) {
    return hash === `hashed_${password}`;
  }
};

describe('P0: 速率限制 API 集成测试', () => {
  describe('认证端点限流集成', () => {
    it('应该在 API 服务器中对认证端点应用限流', async () => {
      const app = new Hono();

      // 初始化 JWT 服务
      const jwtService = new JWTService({
        secret: 'test-secret-key-for-testing-only-at-least-32-chars',
        accessTokenTTL: 3600,
        refreshTokenTTL: 604800,
        issuer: 'test',
        audience: 'test-api'
      });

      // 创建认证限流器（小限制用于测试）
      const authLimiter = createAuthLimiter({
        maxRequests: 3, // 只允许 3 次请求
        windowMs: 60000,
        keyPrefix: 'test-auth',
        whitelist: [] // 无白名单，严格限流
      });

      // 创建认证子应用，应用限流
      const authApp = new Hono();
      authApp.use('*', authLimiter);
      authApp.route('/', authRouter({
        jwtService,
        userService: mockUserService
      }));

      // 注册到主应用
      app.route('/api/v1/auth', authApp);

      // 使用相同的 IP 发送多次登录请求
      const results: Array<{ status: number; hasRetryAfter?: boolean }> = [];

      for (let i = 0; i < 5; i++) {
        const response = await app.request('/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': '10.20.30.40'
          },
          body: JSON.stringify({
            username: 'testuser',
            password: 'password123'
          })
        });

        results.push({
          status: response.status,
          hasRetryAfter: response.headers.has('Retry-After')
        });
      }

      // 验证限流行为
      // 前 3 次请求应该到达认证逻辑（返回 200 表示成功处理，虽然登录失败）
      // 注意：这里的 200 是因为登录请求成功处理了，密码错误返回 401
      // 但在我们的模拟服务中，密码验证简单返回 true/false
      expect(results[0].status).toBe(200); // 首次请求成功
      expect(results[1].status).toBe(200);
      expect(results[2].status).toBe(200);

      // 第 4 次和第 5 次请求应该被限流
      expect(results[3].status).toBe(429);
      expect(results[3].hasRetryAfter).toBe(true);
      expect(results[4].status).toBe(429);
      expect(results[4].hasRetryAfter).toBe(true);

      // 验证 429 响应体
      const rateLimitedResponse = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.20.30.40'
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });

      const body = await rateLimitedResponse.json();
      expect(body).toEqual({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: expect.any(Number)
      });
    });

    it('应该对不同 IP 应用独立的限流', async () => {
      const app = new Hono();

      const jwtService = new JWTService({
        secret: 'test-secret-key-for-testing-only-at-least-32-chars',
        accessTokenTTL: 3600,
        refreshTokenTTL: 604800,
        issuer: 'test',
        audience: 'test-api'
      });

      const authLimiter = createAuthLimiter({
        maxRequests: 2,
        windowMs: 60000,
        keyPrefix: 'test-auth-multi-ip',
        whitelist: []
      });

      const authApp = new Hono();
      authApp.use('*', authLimiter);
      authApp.route('/', authRouter({
        jwtService,
        userService: mockUserService
      }));

      app.route('/api/v1/auth', authApp);

      // IP A 发送 2 次请求
      const responseA1 = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.1.1.1'
        },
        body: JSON.stringify({ username: 'testuser', password: 'wrongpass' })
      });

      const responseA2 = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.1.1.1'
        },
        body: JSON.stringify({ username: 'testuser', password: 'wrongpass' })
      });

      const responseA3 = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.1.1.1'
        },
        body: JSON.stringify({ username: 'testuser', password: 'wrongpass' })
      });

      // IP A 第 3 次请求应该被限流
      expect(responseA1.status).toBe(401);
      expect(responseA2.status).toBe(401);
      expect(responseA3.status).toBe(429);

      // IP B 应该有自己的配额
      const responseB1 = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.2.2.2'
        },
        body: JSON.stringify({ username: 'testuser', password: 'wrongpass' })
      });

      const responseB2 = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.2.2.2'
        },
        body: JSON.stringify({ username: 'testuser', password: 'wrongpass' })
      });

      const responseB3 = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.2.2.2'
        },
        body: JSON.stringify({ username: 'testuser', password: 'wrongpass' })
      });

      // IP B 第 3 次请求也应该被限流
      expect(responseB1.status).toBe(401);
      expect(responseB2.status).toBe(401);
      expect(responseB3.status).toBe(429);
    });

    it('应该为白名单 IP 跳过限流', async () => {
      const app = new Hono();

      const jwtService = new JWTService({
        secret: 'test-secret-key-for-testing-only-at-least-32-chars',
        accessTokenTTL: 3600,
        refreshTokenTTL: 604800,
        issuer: 'test',
        audience: 'test-api'
      });

      const authLimiter = createAuthLimiter({
        maxRequests: 2,
        windowMs: 60000,
        keyPrefix: 'test-auth-whitelist',
        whitelist: ['192.168.1.100', '::1']
      });

      const authApp = new Hono();
      authApp.use('*', authLimiter);
      authApp.route('/', authRouter({
        jwtService,
        userService: mockUserService
      }));

      app.route('/api/v1/auth', authApp);

      // 白名单 IP 发送超过限制的请求
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await app.request('/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': '192.168.1.100'
          },
          body: JSON.stringify({ username: 'testuser', password: 'wrongpass' })
        });
        responses.push(response.status);
      }

      // 所有请求都应该通过（返回 401 是因为密码错误，不是限流）
      expect(responses.every(s => s === 401)).toBe(true);

      // 验证响应头标记为白名单
      const testResponse = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '192.168.1.100'
        },
        body: JSON.stringify({ username: 'testuser', password: 'wrongpass' })
      });

      expect(testResponse.headers.get('X-RateLimit-Whitelisted')).toBe('true');
    });
  });

  describe('API 端点限流集成', () => {
    it('应该对 Analytics API 应用不同的限流策略', async () => {
      const app = new Hono();

      // 创建 API 限流器
      const apiLimiter = createApiLimiter({
        maxRequests: 5, // API 允许更多请求
        windowMs: 60000,
        keyPrefix: 'test-api',
        whitelist: []
      });

      // 创建模拟 Analytics 路由
      const analyticsRouter = new Hono();
      analyticsRouter.get('/usage', (c) => c.json({ success: true, data: {} }));

      // 应用限流
      const analyticsApp = new Hono();
      analyticsApp.use('*', apiLimiter);
      analyticsApp.route('/', analyticsRouter);

      app.route('/api/v1/analytics', analyticsApp);

      // 发送请求
      const results = [];
      for (let i = 0; i < 7; i++) {
        const response = await app.request('/api/v1/analytics/usage', {
          headers: { 'X-Forwarded-For': '10.30.30.30' }
        });
        results.push(response.status);
      }

      // 前 5 次应该成功
      expect(results.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);

      // 第 6、7 次应该被限流
      expect(results[5]).toBe(429);
      expect(results[6]).toBe(429);
    });
  });

  describe('响应头验证', () => {
    it('应该返回正确的速率限制响应头', async () => {
      const app = new Hono();

      const jwtService = new JWTService({
        secret: 'test-secret-key-for-testing-only-at-least-32-chars',
        accessTokenTTL: 3600,
        refreshTokenTTL: 604800,
        issuer: 'test',
        audience: 'test-api'
      });

      const authLimiter = createAuthLimiter({
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'test-headers',
        whitelist: []
      });

      const authApp = new Hono();
      authApp.use('*', authLimiter);
      authApp.route('/', authRouter({
        jwtService,
        userService: mockUserService
      }));

      app.route('/api/v1/auth', authApp);

      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.40.40.40'
        },
        body: JSON.stringify({ username: 'testuser', password: 'wrong' })
      });

      // 验证速率限制响应头
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('9');
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('应该在限流时包含 Retry-After 头', async () => {
      const app = new Hono();

      const apiLimiter = createApiLimiter({
        maxRequests: 2,
        windowMs: 60000,
        keyPrefix: 'test-retry-after',
        whitelist: []
      });

      const testRouter = new Hono();
      testRouter.get('/test', (c) => c.json({ success: true }));

      const testApp = new Hono();
      testApp.use('*', apiLimiter);
      testApp.route('/', testRouter);

      app.route('/api/v1/test', testApp);

      // 消耗配额
      await app.request('/api/v1/test/test', {
        headers: { 'X-Forwarded-For': '10.50.50.50' }
      });
      await app.request('/api/v1/test/test', {
        headers: { 'X-Forwarded-For': '10.50.50.50' }
      });

      // 第 3 次请求被限流
      const response = await app.request('/api/v1/test/test', {
        headers: { 'X-Forwarded-For': '10.50.50.50' }
      });

      expect(response.status).toBe(429);
      const retryAfter = response.headers.get('Retry-After');
      expect(retryAfter).toBeDefined();
      expect(retryAfter).toMatch(/^\d+$/);

      // Retry-After 应该是正整数
      const retryAfterNum = parseInt(retryAfter!);
      expect(retryAfterNum).toBeGreaterThan(0);
      expect(retryAfterNum).toBeLessThanOrEqual(60); // 应该在 60 秒内
    });
  });
});
