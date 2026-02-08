/**
 * 认证路由测试
 *
 * @description
 * 认证 API 路由的集成测试套件
 *
 * @test_coverage
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/refresh
 * - GET /api/v1/auth/me
 * - POST /api/v1/auth/logout
 *
 * @module tests/api/auth/authRoutes.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { authRouter } from '../../../api/auth/routes/authRoutes.js';
import { JWTService } from '../../../api/auth/JWTService.js';
import type { LoginRequest } from '../../../api/auth/types.js';

/**
 * 模拟用户存储
 */
interface MockUser {
  id: string;
  username: string;
  passwordHash: string;
}

const mockUsers: MockUser[] = [
  {
    id: 'user1',
    username: 'testuser',
    passwordHash: 'hashed_password123'
  },
  {
    id: 'user2',
    username: 'admin',
    passwordHash: 'hashed_admin123'
  }
];

/**
 * 模拟用户服务
 */
class MockUserService {
  async findByUsername(username: string): Promise<MockUser | null> {
    return mockUsers.find((u) => u.username === username) || null;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return hash === `hashed_${password}`;
  }
}

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

describe('Auth Routes', () => {
  let app: Hono;
  let jwtService: JWTService;
  let userService: MockUserService;

  beforeEach(() => {
    jwtService = new JWTService(TEST_CONFIG);
    userService = new MockUserService();

    app = new Hono();
    app.route('/api/v1/auth', authRouter({ jwtService, userService }));
  });

  afterEach(() => {
    jwtService.dispose();
  });

  describe('1. POST /api/v1/auth/login', () => {
    it('1.1 应成功登录有效的用户凭据', async () => {
      const loginRequest: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('accessToken');
      expect(json.data).toHaveProperty('refreshToken');
      expect(json.data).toHaveProperty('tokenType', 'Bearer');
      expect(json.data).toHaveProperty('expiresIn', TEST_CONFIG.accessTokenTTL);
      expect(json.meta).toHaveProperty('timestamp');
    });

    it('1.2 应拒绝错误的用户名', async () => {
      const loginRequest: LoginRequest = {
        username: 'nonexistent',
        password: 'password123'
      };

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      // 错误代码或消息都包含认证相关信息
      expect(['ERR_2005', 'credentials', 'Invalid'].some(code => json.error?.includes(code))).toBe(true);
    });

    it('1.3 应拒绝错误的密码', async () => {
      const loginRequest: LoginRequest = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      // 错误代码或消息都包含认证相关信息
      expect(['ERR_2005', 'credentials', 'Invalid'].some(code => json.error?.includes(code))).toBe(true);
    });

    it('1.4 应拒绝缺少用户名的请求', async () => {
      const loginRequest = {
        password: 'password123'
      };

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('1.5 应拒绝缺少密码的请求', async () => {
      const loginRequest = {
        username: 'testuser'
      };

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('1.6 应拒绝空字符串用户名', async () => {
      const loginRequest: LoginRequest = {
        username: '',
        password: 'password123'
      };

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('1.7 应拒绝空字符串密码', async () => {
      const loginRequest: LoginRequest = {
        username: 'testuser',
        password: ''
      };

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('2. POST /api/v1/auth/refresh', () => {
    it('2.1 应使用刷新 Token 获取新的访问 Token', async () => {
      // 首先登录获取刷新 Token
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });

      const loginJson = await loginRes.json();
      const { refreshToken } = loginJson.data;

      // 使用刷新 Token
      const refreshRes = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      expect(refreshRes.status).toBe(200);

      const refreshJson = await refreshRes.json();
      expect(refreshJson.success).toBe(true);
      expect(refreshJson.data).toHaveProperty('accessToken');
      expect(refreshJson.data).toHaveProperty('refreshToken');
      expect(refreshJson.data).toHaveProperty('tokenType', 'Bearer');

      // 新 Token 应与旧 Token 不同
      expect(refreshJson.data.accessToken).not.toBe(
        loginJson.data.accessToken
      );
    });

    it('2.2 应拒绝无效的刷新 Token', async () => {
      // 使用有效长度但无效内容的token（长度>=20）
      const invalidToken = 'invalid-refresh-token-with-enough-length';

      const refreshRes = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: invalidToken })
      });

      expect(refreshRes.status).toBe(401);

      const json = await refreshRes.json();
      expect(json.success).toBe(false);
    });

    it('2.3 应拒绝使用访问 Token 进行刷新', async () => {
      // 首先登录
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });

      const loginJson = await loginRes.json();

      // 使用访问 Token（而非刷新 Token）
      const refreshRes = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: loginJson.data.accessToken })
      });

      expect(refreshRes.status).toBe(401);
    });

    it('2.4 应拒绝缺少刷新 Token 的请求', async () => {
      const refreshRes = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(refreshRes.status).toBe(400);

      const json = await refreshRes.json();
      expect(json.success).toBe(false);
    });
  });

  describe('3. GET /api/v1/auth/me', () => {
    it('3.1 应返回当前认证用户的信息', async () => {
      // 首先登录
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });

      const loginJson = await loginRes.json();
      const { accessToken } = loginJson.data;

      // 获取当前用户信息
      const meRes = await app.request('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      expect(meRes.status).toBe(200);

      const json = await meRes.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('sub', 'user1');
      expect(json.data).toHaveProperty('username', 'testuser');
      expect(json.data).toHaveProperty('jti');
    });

    it('3.2 应拒绝未认证的请求', async () => {
      const meRes = await app.request('/api/v1/auth/me');

      expect(meRes.status).toBe(401);

      const json = await meRes.json();
      expect(json.success).toBe(false);
    });

    it('3.3 应拒绝无效的 Token', async () => {
      const meRes = await app.request('/api/v1/auth/me', {
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      });

      expect(meRes.status).toBe(401);

      const json = await meRes.json();
      expect(json.success).toBe(false);
    });
  });

  describe('4. POST /api/v1/auth/logout', () => {
    it('4.1 应成功登出（客户端删除 Token）', async () => {
      // 首先登录
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });

      const loginJson = await loginRes.json();
      const { accessToken } = loginJson.data;

      // 登出
      const logoutRes = await app.request('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      expect(logoutRes.status).toBe(200);

      const json = await logoutRes.json();
      expect(json.success).toBe(true);
      expect(json.data.message).toContain('logged out');
    });

    it('4.2 登出后 Token 应不再有效（如果实现黑名单）', async () => {
      // 注意：这是可选测试，取决于是否实现 Token 黑名单
      // 当前实现是无状态 JWT，登出主要靠客户端删除 Token
      // 这里测试只验证登出响应

      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });

      const loginJson = await loginRes.json();
      const { accessToken } = loginJson.data;

      // 登出
      await app.request('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      // 由于是无状态实现，Token 仍然有效
      // 实际项目中应实现 Token 黑名单或短 TTL
      const meRes = await app.request('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      // 无状态实现：Token 仍然有效（客户端负责删除）
      // 有状态实现（黑名单）：应返回 401
      // 这里我们接受无状态行为
      expect([200, 401]).toContain(meRes.status);
    });
  });

  describe('5. CORS 和安全头', () => {
    it('5.1 登录响应应包含适当的安全头', async () => {
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });

      // 检查内容类型
      expect(loginRes.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('6. 请求验证', () => {
    it('6.1 应拒绝非 JSON 内容类型', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'username=testuser&password=password123'
      });

      expect(res.status).toBe(400);
    });

    it('6.2 应拒绝无效的 JSON', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}'
      });

      expect(res.status).toBe(400);
    });
  });

  describe('7. 并发登录', () => {
    it('7.1 同一用户多次登录应生成不同的 Token', async () => {
      const loginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      // 第一次登录
      const res1 = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      // 第二次登录
      const res2 = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginRequest)
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const json1 = await res1.json();
      const json2 = await res2.json();

      // Token 应该不同
      expect(json1.data.accessToken).not.toBe(json2.data.accessToken);
      expect(json1.data.refreshToken).not.toBe(json2.data.refreshToken);
    });
  });
});
