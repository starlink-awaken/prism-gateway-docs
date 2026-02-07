/**
 * Token 验证缓存
 *
 * @description
 * 专门用于 JWT Token 验证的缓存层
 * 减少 Token 验证的开销，提升 API 响应速度
 *
 * @module infrastructure/cache
 */

import type { CacheManager } from './CacheManager.js';
import type { JWTPayload, TokenValidationResult } from '../../api/auth/types.js';

/**
 * Token 缓存条目
 *
 * @interface TokenCacheEntry
 */
interface TokenCacheEntry {
  /**
   * 验证结果
   */
  result: TokenValidationResult;

  /**
   * Token 哈希（用于快速查找）
   */
  tokenHash: string;

  /**
   * 过期时间（与 Token 一致）
   */
  expiresAt: number;
}

/**
 * Token 黑名单条目
 *
 * @interface TokenBlacklistEntry
 */
interface TokenBlacklistEntry {
  /**
   * JWT ID
   */
  jti: string;

  /**
   * 添加到黑名单的时间
   */
  addedAt: number;

  /**
   * Token 原本的过期时间
   */
  expiresAt: number;
}

/**
 * Token 缓存配置
 *
 * @interface TokenCacheConfig
 */
export interface TokenCacheConfig {
  /**
   * 最大缓存 Token 数量
   *
   * @default 10000
   */
  maxTokens?: number;

  /**
   * 黑名单最大容量
   *
   * @default 5000
   */
  maxBlacklist?: number;

  /**
   * 缓存清理间隔（毫秒）
   *
   * @default 60000 (1分钟)
   */
  cleanupInterval?: number;

  /**
   * 是否启用缓存
   *
   * @default true
   */
  enabled?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<TokenCacheConfig> = {
  maxTokens: 10000,
  maxBlacklist: 5000,
  cleanupInterval: 60 * 1000, // 1 分钟
  enabled: true
};

/**
 * 生成字符串哈希
 *
 * @param str - 输入字符串
 * @returns 哈希值
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32 位整数
  }
  return Math.abs(hash).toString(36);
}

/**
 * Token 缓存类
 *
 * @description
 * 提供 Token 验证结果的缓存功能，包括：
 * - 验证结果缓存（避免重复解析和验证）
 * - 黑名单管理（Token 撤销）
 * - 自动清理过期条目
 *
 * @example
 * ```typescript
 * const tokenCache = new TokenCache();
 *
 * // 缓存验证结果
 * tokenCache.set(token, validationResult);
 *
 * // 获取缓存的验证结果
 * const cached = tokenCache.get(token);
 * if (cached) {
 *   // 使用缓存结果
 * }
 *
 * // 添加到黑名单
 * tokenCache.addToBlacklist(jti, exp);
 *
 * // 检查是否在黑名单
 * const isBlacklisted = tokenCache.isBlacklisted(jti);
 * ```
 *
 * @class TokenCache
 */
export class TokenCache {
  private readonly config: Required<TokenCacheConfig>;

  // Token 验证缓存: tokenHash -> TokenCacheEntry
  private readonly validationCache: Map<string, TokenCacheEntry>;

  // 黑名单: jti -> TokenBlacklistEntry
  private readonly blacklist: Map<string, TokenBlacklistEntry>;

  // 清理定时器
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // 统计信息
  private stats = {
    hits: 0,
    misses: 0,
    blacklists: 0,
    evictions: 0
  };

  /**
   * 构造函数
   *
   * @param config - 缓存配置
   */
  constructor(config?: TokenCacheConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validationCache = new Map();
    this.blacklist = new Map();

    // 启动清理定时器
    if (this.config.enabled) {
      this.startCleanupTimer();
    }
  }

  /**
   * 获取缓存的 Token 验证结果
   *
   * @param token - JWT Token
   * @returns 验证结果，如果不在缓存中返回 null
   *
   * @example
   * ```typescript
   * const cached = tokenCache.get(token);
   * if (cached) {
   *   // 检查是否在黑名单
   *   if (cached.blacklisted) {
   *     return { valid: false, error: 'Token revoked' };
   *   }
   *   // 使用缓存的验证结果
   *   return cached.result;
   * }
   * ```
   */
  get(token: string): TokenValidationResult | null {
    if (!this.config.enabled) {
      return null;
    }

    const tokenHash = hashString(token);
    const entry = this.validationCache.get(tokenHash);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.validationCache.delete(tokenHash);
      this.stats.misses++;
      return null;
    }

    // 检查是否在黑名单
    if (entry.result.payload && entry.result.payload.jti) {
      const blacklisted = this.blacklist.has(entry.result.payload.jti);
      if (blacklisted) {
        this.stats.hits++;
        return {
          valid: false,
          error: 'Token has been revoked',
          payload: entry.result.payload
        };
      }
    }

    this.stats.hits++;
    return entry.result;
  }

  /**
   * 缓存 Token 验证结果
   *
   * @param token - JWT Token
   * @param result - 验证结果
   *
   * @example
   * ```typescript
   * const result = jwtService.verifyToken(token);
   * tokenCache.set(token, result);
   * ```
   */
  set(token: string, result: TokenValidationResult): void {
    if (!this.config.enabled) {
      return;
    }

    const tokenHash = hashString(token);
    const now = Date.now();

    // 计算 TTL（使用 Token 的过期时间，最多缓存 1 小时）
    let ttl = 60 * 60 * 1000; // 默认 1 小时
    if (result.valid && result.payload && result.payload.exp) {
      const expMs = result.payload.exp * 1000;
      ttl = Math.max(0, expMs - now);
      // 限制最大缓存时间为 1 小时
      ttl = Math.min(ttl, 60 * 60 * 1000);
    }

    const entry: TokenCacheEntry = {
      result,
      tokenHash,
      expiresAt: now + ttl
    };

    // 检查容量，如果满了则淘汰
    while (this.validationCache.size >= this.config.maxTokens) {
      this.evictOldest();
    }

    this.validationCache.set(tokenHash, entry);
  }

  /**
   * 将 Token 添加到黑名单
   *
   * @param jti - JWT ID
   * @param exp - Token 过期时间（Unix 时间戳）
   *
   * @example
   * ```typescript
   * // 用户登出时，将 Token 加入黑名单
   * tokenCache.addToBlacklist(payload.jti, payload.exp);
   * ```
   */
  addToBlacklist(jti: string, exp: number): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    const entry: TokenBlacklistEntry = {
      jti,
      addedAt: now,
      expiresAt: exp * 1000
    };

    // 检查容量
    while (this.blacklist.size >= this.config.maxBlacklist) {
      this.evictOldestBlacklist();
    }

    this.blacklist.set(jti, entry);
    this.stats.blacklists++;

    // 更新验证缓存为撤销状态
    this.updateCacheAsRevoked(jti);
  }

  /**
   * 检查 Token 是否在黑名单中
   *
   * @param jti - JWT ID
   * @returns 是否在黑名单
   *
   * @example
   * ```typescript
   * if (tokenCache.isBlacklisted(payload.jti)) {
   *   return { valid: false, error: 'Token revoked' };
   * }
   * ```
   */
  isBlacklisted(jti: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const entry = this.blacklist.get(jti);
    if (!entry) {
      return false;
    }

    // 检查是否已过期（自然过期）
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.blacklist.delete(jti);
      return false;
    }

    return true;
  }

  /**
   * 更新指定 JTI 的缓存为撤销状态
   *
   * @param jti - JWT ID
   */
  private updateCacheAsRevoked(jti: string): void {
    for (const [tokenHash, entry] of this.validationCache.entries()) {
      if (entry.result.payload?.jti === jti) {
        // 更新缓存为撤销状态，而不是删除
        entry.result = {
          valid: false,
          error: 'Token has been revoked',
          payload: entry.result.payload
        };
      }
    }
  }

  /**
   * 淘汰最旧的验证缓存
   */
  private evictOldest(): void {
    let oldestHash: string | null = null;
    let oldestTime = Infinity;

    for (const [hash, entry] of this.validationCache.entries()) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt;
        oldestHash = hash;
      }
    }

    if (oldestHash) {
      this.validationCache.delete(oldestHash);
      this.stats.evictions++;
    }
  }

  /**
   * 淘汰最旧的黑名单条目
   */
  private evictOldestBlacklist(): void {
    let oldestJti: string | null = null;
    let oldestTime = Infinity;

    for (const [jti, entry] of this.blacklist.entries()) {
      if (entry.addedAt < oldestTime) {
        oldestTime = entry.addedAt;
        oldestJti = jti;
      }
    }

    if (oldestJti) {
      this.blacklist.delete(oldestJti);
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();

    // 清理过期的验证缓存
    for (const [hash, entry] of this.validationCache.entries()) {
      if (now > entry.expiresAt) {
        this.validationCache.delete(hash);
      }
    }

    // 清理过期的黑名单条目
    for (const [jti, entry] of this.blacklist.entries()) {
      if (now > entry.expiresAt) {
        this.blacklist.delete(jti);
      }
    }
  }

  /**
   * 获取缓存统计信息
   *
   * @returns 统计信息
   *
   * @example
   * ```typescript
   * const stats = tokenCache.getStats();
   * console.log(`命中率: ${stats.hitRate}%`);
   * console.log(`缓存数量: ${stats.size}`);
   * console.log(`黑名单数量: ${stats.blacklistSize}`);
   * ```
   */
  getStats(): {
    size: number;
    maxSize: number;
    blacklistSize: number;
    maxBlacklist: number;
    hits: number;
    misses: number;
    hitRate: number;
    blacklists: number;
    evictions: number;
    enabled: boolean;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      size: this.validationCache.size,
      maxSize: this.config.maxTokens,
      blacklistSize: this.blacklist.size,
      maxBlacklist: this.config.maxBlacklist,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      blacklists: this.stats.blacklists,
      evictions: this.stats.evictions,
      enabled: this.config.enabled
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      blacklists: 0,
      evictions: 0
    };
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.validationCache.clear();
    this.blacklist.clear();
    this.resetStats();
  }

  /**
   * 销毁缓存（停止定时器）
   *
   * @example
   * ```typescript
   * // 在应用关闭时调用
   * tokenCache.dispose();
   * ```
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

/**
 * 创建 Token 缓存中间件辅助函数
 *
 * @param tokenCache - Token 缓存实例
 * @returns 中间件函数
 *
 * @example
 * ```typescript
 * const tokenCache = new TokenCache();
 * const middleware = createTokenCacheMiddleware(tokenCache);
 *
 * // 在 Express 中使用
 * app.use('/api', middleware);
 * ```
 */
export function createTokenCacheMiddleware(tokenCache: TokenCache) {
  return {
    /**
     * 在验证前检查缓存
     */
    async beforeValidation(token: string): Promise<TokenValidationResult | null> {
      return tokenCache.get(token);
    },

    /**
     * 验证后更新缓存
     */
    async afterValidation(
      token: string,
      result: TokenValidationResult
    ): Promise<void> {
      tokenCache.set(token, result);
    },

    /**
     * 撤销 Token
     */
    async revokeToken(jti: string, exp: number): Promise<void> {
      tokenCache.addToBlacklist(jti, exp);
    }
  };
}

/**
 * 导出类型
 */
export type { TokenCacheEntry, TokenBlacklistEntry, TokenCacheConfig };
