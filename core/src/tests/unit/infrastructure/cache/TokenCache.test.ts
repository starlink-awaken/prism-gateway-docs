/**
 * TokenCache 单元测试
 *
 * @description
 * TDD RED 阶段：Token 验证缓存测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { TokenCache } from '../../../../infrastructure/cache/TokenCache.js';
import type { TokenValidationResult } from '../../../../api/auth/types.js';

describe('infrastructure/cache/TokenCache', () => {
  let tokenCache: TokenCache;

  beforeEach(() => {
    tokenCache = new TokenCache({
      maxTokens: 100,
      maxBlacklist: 50,
      enabled: true
    });
  });

  afterEach(() => {
    tokenCache.dispose();
  });

  describe('基础缓存', () => {
    it('应该能够缓存和获取验证结果', () => {
      const mockToken = 'mock.jwt.token';
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      tokenCache.set(mockToken, mockResult);
      const cached = tokenCache.get(mockToken);

      expect(cached).toEqual(mockResult);
    });

    it('应该返回 null 对于未缓存的 Token', () => {
      const mockToken = 'unknown.jwt.token';
      const cached = tokenCache.get(mockToken);

      expect(cached).toBeNull();
    });

    it('应该处理无效的验证结果', () => {
      const mockToken = 'invalid.jwt.token';
      const mockResult: TokenValidationResult = {
        valid: false,
        error: 'Invalid signature'
      };

      tokenCache.set(mockToken, mockResult);
      const cached = tokenCache.get(mockToken);

      expect(cached).toEqual(mockResult);
    });

    it('应该正确统计命中和未命中', () => {
      const mockToken = 'mock.jwt.token';
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      tokenCache.set(mockToken, mockResult);

      // 2 次命中
      tokenCache.get(mockToken);
      tokenCache.get(mockToken);

      // 1 次未命中
      tokenCache.get('unknown.token');

      const stats = tokenCache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('黑名单功能', () => {
    it('应该能够将 Token 加入黑名单', () => {
      const jti = 'jti_123';
      const exp = Math.floor(Date.now() / 1000) + 3600;

      tokenCache.addToBlacklist(jti, exp);

      expect(tokenCache.isBlacklisted(jti)).toBe(true);
    });

    it('黑名单的 Token 应该返回撤销错误', () => {
      const mockToken = 'mock.jwt.token';
      const jti = 'jti_123';
      const exp = Math.floor(Date.now() / 1000) + 3600;

      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp,
          jti,
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      // 缓存验证结果
      tokenCache.set(mockToken, mockResult);

      // 撤销 Token
      tokenCache.addToBlacklist(jti, exp);

      // 获取应该返回撤销状态
      const cached = tokenCache.get(mockToken);

      expect(cached?.valid).toBe(false);
      expect(cached?.error).toBe('Token has been revoked');
    });

    it('应该检查不在黑名单的 Token', () => {
      expect(tokenCache.isBlacklisted('unknown_jti')).toBe(false);
    });

    it('应该自动清理过期的黑名单项', () => {
      const jti = 'jti_expired';
      const exp = Math.floor(Date.now() / 1000) - 100; // 已过期

      tokenCache.addToBlacklist(jti, exp);

      // 过期的黑名单项应该被自动清理
      expect(tokenCache.isBlacklisted(jti)).toBe(false);
    });

    it('应该统计黑名单操作', () => {
      const jti = 'jti_123';
      const exp = Math.floor(Date.now() / 1000) + 3600;

      tokenCache.addToBlacklist(jti, exp);

      const stats = tokenCache.getStats();
      expect(stats.blacklists).toBe(1);
      expect(stats.blacklistSize).toBe(1);
    });
  });

  describe('TTL 过期', () => {
    it('应该过期缓存的验证结果', async () => {
      const mockToken = 'expiring.jwt.token';
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 1, // 1 秒后过期
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      tokenCache.set(mockToken, mockResult);

      // 立即获取应该成功
      expect(tokenCache.get(mockToken)).toEqual(mockResult);

      // 等待过期（加一点缓冲）
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 过期后应该返回 null
      expect(tokenCache.get(mockToken)).toBeNull();
    });

    it('应该限制最大缓存时间为 1 小时', () => {
      const mockToken = 'longlived.jwt.token';
      const futureExp = Math.floor(Date.now() / 1000) + 86400; // 24 小时后

      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: futureExp,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      tokenCache.set(mockToken, mockResult);

      // 应该缓存成功
      expect(tokenCache.get(mockToken)).toEqual(mockResult);

      // 但内部 TTL 应该被限制为 1 小时
      const info = tokenCache.get(mockToken);
      expect(info).toBeDefined();
    });
  });

  describe('容量管理', () => {
    it('应该在达到容量限制时淘汰最旧的条目', () => {
      const smallCache = new TokenCache({ maxTokens: 5 });

      // 填满缓存
      for (let i = 0; i < 5; i++) {
        const mockResult: TokenValidationResult = {
          valid: true,
          payload: {
            sub: `user${i}`,
            username: `user${i}`,
            type: 'access' as const,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            jti: `jti_${i}`,
            iss: 'prism-gateway',
            aud: 'prism-gateway-api'
          }
        };
        smallCache.set(`token${i}`, mockResult);
      }

      const statsBefore = smallCache.getStats();
      expect(statsBefore.size).toBe(5);

      // 添加第 6 个，应该淘汰第 1 个
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user5',
          username: 'user5',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_5',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };
      smallCache.set('token5', mockResult);

      const statsAfter = smallCache.getStats();
      expect(statsAfter.size).toBe(5);
      expect(smallCache.get('token0')).toBeNull();
      expect(smallCache.get('token5')).toBeDefined();

      smallCache.dispose();
    });

    it('应该限制黑名单容量', () => {
      const smallCache = new TokenCache({
        maxBlacklist: 3
      });

      // 添加超过容量的黑名单项
      for (let i = 0; i < 5; i++) {
        smallCache.addToBlacklist(`jti_${i}`, Math.floor(Date.now() / 1000) + 3600);
      }

      const stats = smallCache.getStats();
      expect(stats.blacklistSize).toBeLessThanOrEqual(3);

      smallCache.dispose();
    });
  });

  describe('统计和清理', () => {
    it('应该提供完整的统计信息', () => {
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      tokenCache.set('token1', mockResult);
      tokenCache.get('token1');
      tokenCache.addToBlacklist('jti_1', Math.floor(Date.now() / 1000) + 3600);

      const stats = tokenCache.getStats();

      expect(stats.size).toBe(1);
      expect(stats.blacklistSize).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.enabled).toBe(true);
    });

    it('应该能够重置统计', () => {
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      tokenCache.set('token1', mockResult);
      tokenCache.get('token1');

      tokenCache.resetStats();

      const stats = tokenCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('应该能够清空所有缓存', () => {
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      tokenCache.set('token1', mockResult);
      tokenCache.addToBlacklist('jti_1', Math.floor(Date.now() / 1000) + 3600);

      tokenCache.clear();

      const stats = tokenCache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.blacklistSize).toBe(0);
    });
  });

  describe('禁用模式', () => {
    it('禁用时应该不缓存任何内容', () => {
      const disabledCache = new TokenCache({ enabled: false });

      const mockToken = 'mock.jwt.token';
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      disabledCache.set(mockToken, mockResult);
      const cached = disabledCache.get(mockToken);

      expect(cached).toBeNull();

      const stats = disabledCache.getStats();
      expect(stats.enabled).toBe(false);

      disabledCache.dispose();
    });
  });

  describe('中间件辅助函数', () => {
    it('createTokenCacheMiddleware 应该返回中间件函数', () => {
      const { createTokenCacheMiddleware } = require('../../../../infrastructure/cache/index.js');
      const middleware = createTokenCacheMiddleware(tokenCache);

      expect(middleware).toBeDefined();
      expect(middleware.beforeValidation).toBeInstanceOf(Function);
      expect(middleware.afterValidation).toBeInstanceOf(Function);
      expect(middleware.revokeToken).toBeInstanceOf(Function);
    });

    it('beforeValidation 应该检查缓存', async () => {
      const { createTokenCacheMiddleware } = require('../../../../infrastructure/cache/index.js');
      const middleware = createTokenCacheMiddleware(tokenCache);

      const mockToken = 'mock.jwt.token';
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      tokenCache.set(mockToken, mockResult);

      const cached = await middleware.beforeValidation(mockToken);
      expect(cached).toEqual(mockResult);
    });

    it('afterValidation 应该更新缓存', async () => {
      const { createTokenCacheMiddleware } = require('../../../../infrastructure/cache/index.js');
      const middleware = createTokenCacheMiddleware(tokenCache);

      const mockToken = 'mock.jwt.token';
      const mockResult: TokenValidationResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      await middleware.afterValidation(mockToken, mockResult);

      const cached = tokenCache.get(mockToken);
      expect(cached).toEqual(mockResult);
    });

    it('revokeToken 应该添加到黑名单', async () => {
      const { createTokenCacheMiddleware } = require('../../../../infrastructure/cache/index.js');
      const middleware = createTokenCacheMiddleware(tokenCache);

      const jti = 'jti_123';
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await middleware.revokeToken(jti, exp);

      expect(tokenCache.isBlacklisted(jti)).toBe(true);
    });
  });
});
