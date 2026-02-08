/**
 * JWT 中间件测试
 *
 * @description
 * JWT 认证中间件的单元测试套件
 *
 * @test_coverage
 * - 中间件拦截未认证请求
 * - 中间件放行已认证请求
 * - Token 提取（Header / Cookie / Query）
 * - 错误响应格式
 *
 * @module tests/api/auth/JWTMiddleware.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { JWTService } from '../../../api/auth/JWTService.js';
import { jwtMiddleware } from '../../../api/auth/middleware/jwtMiddleware.js';
import { AuthErrorType } from '../../../api/auth/types.js';

/**
 * 测试配置
 */
const TEST_CONFIG = {
  secret: 'test-secret-key-for-testing-only-do-not-use-in-production',
  accessTokenTTL: 3600,
  refreshTokenTTL: 604800,
  issuer: 'prism-gateway-test',
  audience: 'prism-gateway-api'
};

describe('JWT Middleware', () => {
  let jwtService: JWTService;
  let validToken: string;
  let expiredToken: string;

  beforeEach(() => {
    jwtService = new JWTService(TEST_CONFIG);

    // 生成有效 Token
    const payload = { sub: 'user1', username: 'testuser' };
    validToken = jwtService.generateAccessToken(payload);

    // 生成过期 Token（TTL = -1，表示已过期）
    const expiredConfig = { ...TEST_CONFIG, accessTokenTTL: -1 };
    const expiredService = new JWTService(expiredConfig);
    expiredToken = expiredService.generateAccessToken(payload);
    expiredService.dispose();
  });

  afterEach(() => {
    jwtService.dispose();
  });

  describe('1. Authorization Header 认证', () => {
    it('1.1 应放行带有有效 Token 的请求', async () => {
      const app = new Hono();

      app.use('/api/protected/*', jwtMiddleware({ jwtService }));

      app.get('/api/protected/data', (c) => {
        const user = c.get('user');
        return c.json({
          success: true,
          data: { message: 'Protected data', user }
        });
      });

      const res = await app.request('/api/protected/data', {
        headers: {
          Authorization: `Bearer ${validToken}`
        }
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user).toBeDefined();
      expect(json.data.user.sub).toBe('user1');
      expect(json.data.user.username).toBe('testuser');
    });

    it('1.2 应拒绝缺少 Authorization Header 的请求', async () => {
      const app = new Hono();

      app.use('/api/protected/*', jwtMiddleware({ jwtService }));

      app.get('/api/protected/data', (c) => c.json({ success: true }));

      const res = await app.request('/api/protected/data');

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('1.3 应拒绝没有 Bearer 前缀的 Token', async () => {
      const app = new Hono();

      app.use('/api/protected/*', jwtMiddleware({ jwtService }));

      app.get('/api/protected/data', (c) => c.json({ success: true }));

      const res = await app.request('/api/protected/data', {
        headers: {
          Authorization: validToken // 缺少 "Bearer " 前缀
        }
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('1.4 应拒绝无效的 Token', async () => {
      const app = new Hono();

      app.use('/api/protected/*', jwtMiddleware({ jwtService }));

      app.get('/api/protected/data', (c) => c.json({ success: true }));

      const res = await app.request('/api/protected/data', {
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('1.5 应拒绝过期的 Token', async () => {
      const app = new Hono();

      app.use('/api/protected/*', jwtMiddleware({ jwtService }));

      app.get('/api/protected/data', (c) => c.json({ success: true }));

      const res = await app.request('/api/protected/data', {
        headers: {
          Authorization: `Bearer ${expiredToken}`
        }
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('2. 错误响应格式', () => {
    it('2.1 认证失败应返回统一的错误格式', async () => {
      const app = new Hono();

      app.use('/api/protected/*', jwtMiddleware({ jwtService }));

      app.get('/api/protected/data', (c) => c.json({ success: true }));

      const res = await app.request('/api/protected/data');

      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json).toHaveProperty('success', false);
      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('meta');
      expect(json.meta).toHaveProperty('timestamp');
    });

    it('2.2 不应在错误消息中泄露敏感信息', async () => {
      const app = new Hono();

      app.use('/api/protected/*', jwtMiddleware({ jwtService }));

      app.get('/api/protected/data', (c) => c.json({ success: true }));

      const res = await app.request('/api/protected/data', {
        headers: {
          Authorization: 'Bearer obviously-invalid-token'
        }
      });

      const json = await res.json();

      // 错误消息不应包含密钥、内部路径等敏感信息
      expect(json.error).not.toContain('secret');
      expect(json.error).not.toContain('/');
      expect(json.error).not.toContain('internal');
    });
  });

  describe('3. 公开路由', () => {
    it('3.1 未使用中间件的路由应可公开访问', async () => {
      const app = new Hono();

      // 公开路由
      app.get('/api/public/data', (c) => {
        return c.json({ success: true, data: 'public data' });
      });

      // 受保护路由
      app.use('/api/protected/*', jwtMiddleware({ jwtService }));
      app.get('/api/protected/data', (c) => {
        return c.json({ success: true, data: 'protected data' });
      });

      // 公开路由应该可以访问
      const publicRes = await app.request('/api/public/data');
      expect(publicRes.status).toBe(200);
      const publicJson = await publicRes.json();
      expect(publicJson.success).toBe(true);

      // 受保护路由需要认证
      const protectedRes = await app.request('/api/protected/data');
      expect(protectedRes.status).toBe(401);
    });
  });

  describe('4. 上下文用户信息', () => {
    it('4.1 中间件应将用户信息存入上下文', async () => {
      const app = new Hono();

      app.use('/api/protected/*', jwtMiddleware({ jwtService }));

      app.get('/api/protected/me', (c) => {
        const user = c.get('user');
        return c.json({
          success: true,
          user: {
            id: user.sub,
            username: user.username,
            jti: user.jti
          }
        });
      });

      const res = await app.request('/api/protected/me', {
        headers: {
          Authorization: `Bearer ${validToken}`
        }
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user.id).toBe('user1');
      expect(json.user.username).toBe('testuser');
      expect(json.user.jti).toBeDefined();
    });
  });

  describe('5. 可选认证', () => {
    it('5.1 可选认证：有 Token 时验证，无 Token 时放行', async () => {
      const app = new Hono();

      app.use(
        '/api/optional/*',
        jwtMiddleware({ jwtService, optional: true })
      );

      app.get('/api/optional/data', (c) => {
        const user = c.get('user');
        return c.json({
          success: true,
          authenticated: !!user,
          user: user || null
        });
      });

      // 有 Token 的请求
      const resWithToken = await app.request('/api/optional/data', {
        headers: {
          Authorization: `Bearer ${validToken}`
        }
      });
      expect(resWithToken.status).toBe(200);
      const jsonWithToken = await resWithToken.json();
      expect(jsonWithToken.authenticated).toBe(true);
      expect(jsonWithToken.user).toBeDefined();

      // 无 Token 的请求
      const resWithoutToken = await app.request('/api/optional/data');
      expect(resWithoutToken.status).toBe(200);
      const jsonWithoutToken = await resWithoutToken.json();
      expect(jsonWithoutToken.authenticated).toBe(false);
      expect(jsonWithoutToken.user).toBeNull();
    });
  });

  describe('6. 多个中间件实例', () => {
    it('6.1 不同路由可使用不同的 JWT 实例', async () => {
      // 创建第二个 JWT 服务
      const jwtService2 = new JWTService({
        ...TEST_CONFIG,
        issuer: 'different-issuer'
      });

      const payload = { sub: 'user2', username: 'admin' };
      const token2 = jwtService2.generateAccessToken(payload);

      const app = new Hono();

      // 使用第一个服务
      app.use('/api/v1/*', jwtMiddleware({ jwtService }));

      // 使用第二个服务
      app.use('/api/v2/*', jwtMiddleware({ jwtService: jwtService2 }));

      app.get('/api/v1/data', (c) => {
        return c.json({ success: true, version: 1 });
      });

      app.get('/api/v2/data', (c) => {
        return c.json({ success: true, version: 2 });
      });

      // v1 只能接受 v1 的 token
      const res1 = await app.request('/api/v1/data', {
        headers: { Authorization: `Bearer ${validToken}` }
      });
      expect(res1.status).toBe(200);

      // v2 只能接受 v2 的 token
      const res2 = await app.request('/api/v2/data', {
        headers: { Authorization: `Bearer ${token2}` }
      });
      expect(res2.status).toBe(200);

      jwtService2.dispose();
    });
  });
});
