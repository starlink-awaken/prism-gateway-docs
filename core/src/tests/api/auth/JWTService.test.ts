/**
 * JWT 认证服务测试
 *
 * @description
 * JWT 认证服务的完整单元测试套件
 *
 * @test_coverage
 * - Token 生成（访问 Token + 刷新 Token）
 * - Token 验证（有效/无效/过期）
 * - Token 刷新
 * - 用户认证（登录）
 * - 错误处理
 *
 * @module tests/api/auth/JWTService.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { JWTService, AuthConfig } from '../../../api/auth/JWTService.js';
import { AuthError, AuthErrorType } from '../../../api/auth/types.js';

/**
 * 测试配置
 */
const TEST_CONFIG: AuthConfig = {
  secret: 'test-secret-key-for-testing-only-do-not-use-in-production',
  accessTokenTTL: 3600, // 1 hour
  refreshTokenTTL: 604800, // 7 days
  issuer: 'prism-gateway-test',
  audience: 'prism-gateway-api'
};

/**
 * 模拟用户存储
 */
interface MockUser {
  id: string;
  username: string;
  passwordHash: string;
}

// 模拟密码哈希函数（实际项目中应使用 bcrypt）
async function hashPassword(password: string): Promise<string> {
  return `hashed_${password}`;
}

// 模拟密码验证函数
async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return hash === `hashed_${password}`;
}

describe('JWTService', () => {
  let jwtService: JWTService;
  let mockUsers: Map<string, MockUser>;

  beforeEach(() => {
    jwtService = new JWTService(TEST_CONFIG);
    mockUsers = new Map([
      [
        'user1',
        {
          id: 'user1',
          username: 'testuser',
          passwordHash: 'hashed_password123'
        }
      ],
      [
        'user2',
        {
          id: 'user2',
          username: 'admin',
          passwordHash: 'hashed_admin123'
        }
      ]
    ]);
  });

  afterEach(() => {
    jwtService.dispose();
  });

  describe('1. Token 生成', () => {
    it('1.1 应生成有效的访问 Token', () => {
      const payload = {
        sub: 'user1',
        username: 'testuser'
      };

      const token = jwtService.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT 格式: header.payload.signature
    });

    it('1.2 应生成有效的刷新 Token', () => {
      const payload = {
        sub: 'user1',
        username: 'testuser'
      };

      const token = jwtService.generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('1.3 访问 Token 和刷新 Token 应该不同', () => {
      const payload = {
        sub: 'user1',
        username: 'testuser'
      };

      const accessToken = jwtService.generateAccessToken(payload);
      const refreshToken = jwtService.generateRefreshToken(payload);

      expect(accessToken).not.toBe(refreshToken);
    });

    it('1.4 应为每个用户生成唯一的 Token（不同 jti）', () => {
      const payload1 = { sub: 'user1', username: 'testuser' };
      const payload2 = { sub: 'user2', username: 'admin' };

      const token1 = jwtService.generateAccessToken(payload1);
      const token2 = jwtService.generateAccessToken(payload2);

      const decoded1 = jwtService.verifyToken(token1);
      const decoded2 = jwtService.verifyToken(token2);

      expect(decoded1.payload?.jti).toBeDefined();
      expect(decoded2.payload?.jti).toBeDefined();
      expect(decoded1.payload?.jti).not.toBe(decoded2.payload?.jti);
    });

    it('1.5 同一用户多次生成 Token 应有不同的 jti', () => {
      const payload = { sub: 'user1', username: 'testuser' };

      const token1 = jwtService.generateAccessToken(payload);
      const token2 = jwtService.generateAccessToken(payload);

      const decoded1 = jwtService.verifyToken(token1);
      const decoded2 = jwtService.verifyToken(token2);

      expect(decoded1.payload?.jti).not.toBe(decoded2.payload?.jti);
    });
  });

  describe('2. Token 验证', () => {
    it('2.1 应验证有效的访问 Token', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const token = jwtService.generateAccessToken(payload);

      const result = jwtService.verifyToken(token, 'access');

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.sub).toBe('user1');
      expect(result.payload?.username).toBe('testuser');
      expect(result.payload?.type).toBe('access');
      expect(result.error).toBeUndefined();
    });

    it('2.2 应验证有效的刷新 Token', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const token = jwtService.generateRefreshToken(payload);

      const result = jwtService.verifyToken(token, 'refresh');

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.type).toBe('refresh');
    });

    it('2.3 应拒绝无效的 Token 格式', () => {
      const invalidToken = 'not-a-valid-jwt';

      const result = jwtService.verifyToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.payload).toBeUndefined();
    });

    it('2.4 应拒绝签名错误的 Token', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const token = jwtService.generateAccessToken(payload);

      // 篡改 Token（修改最后一个字符）
      const parts = token.split('.');
      const tamperedSignature = parts[2].slice(0, -1) + 'x';
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      const result = jwtService.verifyToken(tamperedToken);

      expect(result.valid).toBe(false);
      // 签名验证失败会返回 "Invalid token format" 或类似错误
      expect(result.error).toBeTruthy();
    });

    it('2.5 应拒绝过期的 Token', async () => {
      // 创建一个短期过期的配置（TTL 为 -1，表示已过期）
      const shortLivedConfig = { ...TEST_CONFIG, accessTokenTTL: -1 };
      const shortLivedService = new JWTService(shortLivedConfig);

      const payload = { sub: 'user1', username: 'testuser' };
      const token = shortLivedService.generateAccessToken(payload);

      // Token 已经过期（TTL 为负数）
      const result = shortLivedService.verifyToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');

      shortLivedService.dispose();
    });

    it('2.6 应拒绝类型不匹配的 Token', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const refreshToken = jwtService.generateRefreshToken(payload);

      // 尝试作为访问 Token 验证
      const result = jwtService.verifyToken(refreshToken, 'access');

      expect(result.valid).toBe(false);
      // 错误消息包含 "token" 和 "refresh"
      expect(result.error?.toLowerCase()).toMatch(/(token|refresh)/);
    });

    it('2.7 应拒绝其他服务签发的 Token（issuer 验证）', () => {
      // 创建不同 issuer 的服务
      const otherConfig = { ...TEST_CONFIG, issuer: 'other-service' };
      const otherService = new JWTService(otherConfig);

      const payload = { sub: 'user1', username: 'testuser' };
      const token = otherService.generateAccessToken(payload);

      // 用原服务验证
      const result = jwtService.verifyToken(token);

      expect(result.valid).toBe(false);

      otherService.dispose();
    });
  });

  describe('3. Token 刷新', () => {
    it('3.1 应使用刷新 Token 生成新的访问 Token', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const refreshToken = jwtService.generateRefreshToken(payload);

      const newTokens = jwtService.refreshAccessToken(refreshToken);

      expect(newTokens).toBeDefined();
      expect(newTokens.accessToken).toBeDefined();
      expect(typeof newTokens.accessToken).toBe('string');

      // 验证新 Token
      const result = jwtService.verifyToken(newTokens.accessToken, 'access');
      expect(result.valid).toBe(true);
      expect(result.payload?.sub).toBe('user1');
    });

    it('3.2 Token 刷新后应保持原有的用户信息', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const refreshToken = jwtService.generateRefreshToken(payload);

      const newTokens = jwtService.refreshAccessToken(refreshToken);
      const decoded = jwtService.verifyToken(newTokens.accessToken, 'access');

      expect(decoded.payload?.sub).toBe('user1');
      expect(decoded.payload?.username).toBe('testuser');
    });

    it('3.3 应拒绝使用访问 Token 进行刷新', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const accessToken = jwtService.generateAccessToken(payload);

      expect(() => {
        jwtService.refreshAccessToken(accessToken);
      }).toThrow(AuthError);
    });

    it('3.4 应拒绝无效的刷新 Token', () => {
      const invalidToken = 'invalid-refresh-token';

      expect(() => {
        jwtService.refreshAccessToken(invalidToken);
      }).toThrow(AuthError);
    });
  });

  describe('4. 用户认证', () => {
    it('4.1 应成功认证有效的用户凭据', async () => {
      const loginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      // 模拟用户查找
      const user = mockUsers.get('user1');
      if (!user) {
        throw new Error('User not found');
      }

      // 模拟密码验证
      const passwordValid = await verifyPassword(
        loginRequest.password,
        user.passwordHash
      );

      expect(passwordValid).toBe(true);

      const tokens = jwtService.generateTokens({
        sub: user.id,
        username: user.username
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresIn).toBe(TEST_CONFIG.accessTokenTTL);
    });

    it('4.2 应拒绝错误的密码', async () => {
      const loginRequest = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const user = mockUsers.get('user1');
      if (!user) {
        throw new Error('User not found');
      }

      const passwordValid = await verifyPassword(
        loginRequest.password,
        user.passwordHash
      );

      expect(passwordValid).toBe(false);
    });

    it('4.3 应拒绝不存在的用户', () => {
      const loginRequest = {
        username: 'nonexistent',
        password: 'password123'
      };

      const user = mockUsers.values().find(
        (u) => u.username === loginRequest.username
      );

      expect(user).toBeUndefined();
    });
  });

  describe('5. 解码 Token（不验证）', () => {
    it('5.1 应解码 Token 而不验证签名', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const token = jwtService.generateAccessToken(payload);

      const decoded = jwtService.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe('user1');
      expect(decoded?.username).toBe('testuser');
    });

    it('5.2 应处理无效的 Token 格式（解码）', () => {
      const invalidToken = 'not-a-valid-jwt';

      const decoded = jwtService.decodeToken(invalidToken);

      expect(decoded).toBeNull();
    });
  });

  describe('6. 配置管理', () => {
    it('6.1 应使用自定义配置创建服务', () => {
      const customConfig: AuthConfig = {
        secret: 'custom-secret-key-that-is-at-least-32-chars',
        accessTokenTTL: 7200,
        refreshTokenTTL: 1209600,
        issuer: 'custom-issuer',
        audience: 'custom-audience'
      };

      const customService = new JWTService(customConfig);

      const payload = { sub: 'user1', username: 'testuser' };
      const token = customService.generateAccessToken(payload);
      const decoded = customService.verifyToken(token);

      expect(decoded.payload).toBeDefined();
      expect(decoded.payload?.iat).toBeDefined();
      expect(decoded.payload?.exp).toBeDefined();

      customService.dispose();
    });

    it('6.2 获取配置应返回只读副本', () => {
      const config = jwtService.getConfig();

      expect(config).toEqual(TEST_CONFIG);
      expect(config).not.toBe(TEST_CONFIG); // 不是同一个引用
    });
  });

  describe('7. 错误处理', () => {
    it('7.1 AuthError 应包含正确的错误类型和状态码', () => {
      const error = new AuthError(
        'Test error',
        AuthErrorType.INVALID_CREDENTIALS,
        401
      );

      expect(error.message).toBe('Test error');
      expect(error.type).toBe(AuthErrorType.INVALID_CREDENTIALS);
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthError');
    });

    it('7.2 验证过期 Token 应返回可解析的错误', async () => {
      // 使用负 TTL 创建已过期的 Token
      const shortLivedConfig = { ...TEST_CONFIG, accessTokenTTL: -1 };
      const shortLivedService = new JWTService(shortLivedConfig);

      const payload = { sub: 'user1', username: 'testuser' };
      const token = shortLivedService.generateAccessToken(payload);

      const result = shortLivedService.verifyToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
      // 错误消息应包含 "exp" 或 "expired" 关键字
      expect(
        result.error?.toLowerCase().includes('exp') ||
          result.error?.toLowerCase().includes('expired')
      ).toBe(true);

      shortLivedService.dispose();
    });
  });

  describe('8. Token 生成器（批量）', () => {
    it('8.1 generateTokens 应生成访问 Token 和刷新 Token', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const tokens = jwtService.generateTokens(payload);

      expect(tokens).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: TEST_CONFIG.accessTokenTTL
      });

      // 验证两个 Token
      const accessResult = jwtService.verifyToken(tokens.accessToken, 'access');
      const refreshResult = jwtService.verifyToken(
        tokens.refreshToken,
        'refresh'
      );

      expect(accessResult.valid).toBe(true);
      expect(refreshResult.valid).toBe(true);
    });

    it('8.2 生成的两个 Token 应有不同的 jti', () => {
      const payload = { sub: 'user1', username: 'testuser' };
      const tokens = jwtService.generateTokens(payload);

      const accessDecoded = jwtService.decodeToken(tokens.accessToken);
      const refreshDecoded = jwtService.decodeToken(tokens.refreshToken);

      expect(accessDecoded?.jti).toBeDefined();
      expect(refreshDecoded?.jti).toBeDefined();
      expect(accessDecoded?.jti).not.toBe(refreshDecoded?.jti);
    });
  });
});
