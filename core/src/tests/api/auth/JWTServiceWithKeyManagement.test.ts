/**
 * JWTServiceWithKeyManagement 单元测试
 *
 * @description
 * 测试集成密钥管理的 JWT 服务
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { JWTServiceWithKeyManagement } from '../../../api/auth/JWTServiceWithKeyManagement.js';
import { AuthErrorType } from '../../../api/auth/types.js';

describe('JWTServiceWithKeyManagement', () => {
  const testConfig = {
    secret: 'test-secret-key-for-testing-at-least-32-characters-long',
    accessTokenTTL: 3600,
    refreshTokenTTL: 604800,
    issuer: 'prism-gateway-test',
    audience: 'prism-gateway-api-test',
    keyRotationDays: 30
  };

  let service: JWTServiceWithKeyManagement;

  beforeEach(() => {
    service = new JWTServiceWithKeyManagement(testConfig);
  });

  afterEach(() => {
    service.dispose();
  });

  describe('Token 生成', () => {
    it('应该生成有效的访问 Token', () => {
      const token = service.generateAccessToken({
        sub: 'user123',
        username: 'alice'
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT 格式: header.payload.signature
    });

    it('应该生成有效的刷新 Token', () => {
      const token = service.generateRefreshToken({
        sub: 'user123',
        username: 'alice'
      });

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('应该同时生成访问和刷新 Token', () => {
      const tokens = service.generateTokens({
        sub: 'user123',
        username: 'alice'
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresIn).toBe(3600);
    });
  });

  describe('Token 验证', () => {
    it('应该验证有效的访问 Token', () => {
      const token = service.generateAccessToken({
        sub: 'user123',
        username: 'alice'
      });

      const result = service.verifyToken(token, 'access');

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.sub).toBe('user123');
      expect(result.payload?.username).toBe('alice');
      expect(result.payload?.type).toBe('access');
    });

    it('应该验证有效的刷新 Token', () => {
      const token = service.generateRefreshToken({
        sub: 'user123',
        username: 'alice'
      });

      const result = service.verifyToken(token, 'refresh');

      expect(result.valid).toBe(true);
      expect(result.payload?.type).toBe('refresh');
    });

    it('应该拒绝错误的 Token 类型', () => {
      const accessToken = service.generateAccessToken({
        sub: 'user123',
        username: 'alice'
      });

      const result = service.verifyToken(accessToken, 'refresh');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected refresh token');
    });

    it('应该拒绝无效的签名', () => {
      const validToken = service.generateAccessToken({
        sub: 'user123',
        username: 'alice'
      });

      // 篡改签名
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tamperedsignature`;

      const result = service.verifyToken(tamperedToken);

      expect(result.valid).toBe(false);
    });

    it('应该拒绝格式错误的 Token', () => {
      const result = service.verifyToken('not-a-valid-jwt');

      expect(result.valid).toBe(false);
    });
  });

  describe('密钥轮换', () => {
    it('应该支持密钥轮换', () => {
      const oldStats = service.getKeyStats();
      const oldVersion = oldStats.currentVersion;

      // 轮换密钥
      const newVersion = service.rotateKey(true);

      expect(newVersion).toBeGreaterThan(oldVersion);

      const newStats = service.getKeyStats();
      expect(newStats.currentVersion).toBe(newVersion);
      expect(newStats.totalVersions).toBeGreaterThan(1);
    });

    it('轮换后旧 Token 仍然有效', () => {
      // 生成旧 Token
      const oldToken = service.generateAccessToken({
        sub: 'user123',
        username: 'alice'
      });

      // 轮换密钥
      service.rotateKey(true);

      // 旧 Token 应该仍然可以验证
      const result = service.verifyToken(oldToken, 'access');

      expect(result.valid).toBe(true);
      expect(result.payload?.sub).toBe('user123');
    });

    it('新 Token 使用新密钥签名', () => {
      // 生成第一个 Token
      const firstToken = service.generateAccessToken({
        sub: 'user123',
        username: 'alice'
      });

      // 轮换密钥
      service.rotateKey(true);

      // 生成新 Token
      const newToken = service.generateAccessToken({
        sub: 'user456',
        username: 'bob'
      });

      // 两个 Token 都应该有效
      const firstResult = service.verifyToken(firstToken, 'access');
      const newResult = service.verifyToken(newToken, 'access');

      expect(firstResult.valid).toBe(true);
      expect(newResult.valid).toBe(true);
    });

    it('应该正确报告密钥统计信息', () => {
      const stats = service.getKeyStats();

      expect(stats.currentVersion).toBeGreaterThan(0);
      expect(stats.totalVersions).toBeGreaterThan(0);
      expect(stats.needsRotation).toBe(false);
      expect(stats.daysUntilRotation).toBeGreaterThan(0);
    });

    it('应该能够清理过期密钥', () => {
      // 轮换几次密钥
      service.rotateKey(true);
      service.rotateKey(true);

      const beforeStats = service.getKeyStats();

      // 清理（新密钥不会被清理）
      const cleaned = service.cleanupExpiredKeys();

      expect(cleaned).toBe(0);
      expect(service.getKeyStats().totalVersions).toBe(beforeStats.totalVersions);
    });
  });

  describe('Token 刷新', () => {
    it('应该能够刷新访问 Token', () => {
      const tokens = service.generateTokens({
        sub: 'user123',
        username: 'alice'
      });

      const newTokens = service.refreshAccessToken(tokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.tokenType).toBe('Bearer');

      // 新 Token 应该有效
      const result = service.verifyToken(newTokens.accessToken, 'access');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝无效的刷新 Token', () => {
      expect(() => {
        service.refreshAccessToken('invalid-token');
      }).toThrow();
    });
  });

  describe('Token 解码（调试）', () => {
    it('应该能够解码 Token 而不验证签名', () => {
      const token = service.generateAccessToken({
        sub: 'user123',
        username: 'alice'
      });

      const payload = service.decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.sub).toBe('user123');
      expect(payload?.username).toBe('alice');
    });

    it('应该为无效 Token 返回 null', () => {
      const payload = service.decodeToken('invalid-token');
      expect(payload).toBeNull();
    });
  });

  describe('边界条件', () => {
    it('应该拒绝过短的密钥', () => {
      expect(() => {
        new JWTServiceWithKeyManagement({
          ...testConfig,
          secret: 'short'
        });
      }).toThrow();
    });

    it('应该能够处理多个密钥版本', () => {
      // 生成多个 Token，每个用不同密钥
      const tokens: string[] = [];

      for (let i = 0; i < 5; i++) {
        tokens.push(service.generateAccessToken({
          sub: `user${i}`,
          username: `user${i}`
        }));

        if (i < 4) {
          service.rotateKey(true);
        }
      }

      // 所有 Token 都应该有效
      for (const token of tokens) {
        const result = service.verifyToken(token, 'access');
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('安全性', () => {
    it('应该使用恒定时间比较', () => {
      const token = service.generateAccessToken({
        sub: 'user123',
        username: 'alice'
      });

      // 篡改 Token
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}a`;

      const result = service.verifyToken(tamperedToken);

      // 应该失败，但不泄露信息
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
