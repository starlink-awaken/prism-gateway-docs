/**
 * CacheManager - LRU 缓存管理器
 *
 * @description
 * 基于内存的 LRU（Least Recently Used）缓存实现
 *
 * @remarks
 * 核心特性：
 * - LRU 淘汰策略（删除最少使用的项）
 * - TTL 过期（自动删除过期项）
 * - 命中率统计
 * - 容量限制
 *
 * @example
 * ```typescript
 * const cache = new CacheManager(1000); // 最大 1000 项
 * await cache.set('key1', { data: 'value' }, 60000); // TTL 60秒
 * const value = await cache.get('key1');
 * const stats = cache.getStats(); // { size, hits, misses, hitRate }
 * ```
 */

/**
 * 缓存条目
 */
interface CacheEntry {
  /**
   * 缓存的值
   */
  value: unknown;

  /**
   * 创建时间（毫秒时间戳）
   */
  createdAt: number;

  /**
   * 最后访问时间（毫秒时间戳）
   */
  lastAccessed: number;

  /**
   * 过期时间（毫秒时间戳，可选）
   */
  expiresAt?: number;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /**
   * 当前缓存项数量
   */
  size: number;

  /**
   * 最大缓存项数量
   */
  maxSize: number;

  /**
   * 缓存命中次数
   */
  hits: number;

  /**
   * 缓存未命中次数
   */
  misses: number;

  /**
   * 命中率（0-100）
   */
  hitRate: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /**
   * 最大缓存项数量
   *
   * @default 1000
   */
  maxSize?: number;

  /**
   * 默认 TTL（毫秒）
   *
   * @default 300000 (5分钟)
   */
  defaultTTL?: number;

  /**
   * 是否启用统计
   *
   * @default true
   */
  enableStats?: number;
}

/**
 * 默认缓存配置
 */
const defaultCacheConfig: Required<CacheConfig> = {
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 分钟
  enableStats: true
};

/**
 * CacheManager 类
 */
export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private defaultTTL: number;
  private hits: number;
  private misses: number;
  private enableStats: boolean;

  /**
   * 构造函数
   *
   * @param configOrMaxSize - 缓存配置或最大容量
   *
   * @example
   * ```typescript
   * const cache1 = new CacheManager(500); // 最大 500 项
   * const cache2 = new CacheManager({ maxSize: 1000, defaultTTL: 60000 });
   * ```
   */
  constructor(configOrMaxSize?: number | CacheConfig) {
    if (typeof configOrMaxSize === 'number') {
      // 兼容旧接口：直接传入 maxSize
      this.maxSize = configOrMaxSize;
      this.defaultTTL = defaultCacheConfig.defaultTTL;
      this.enableStats = defaultCacheConfig.enableStats;
    } else {
      // 新接口：传入配置对象
      const config = { ...defaultCacheConfig, ...configOrMaxSize };
      this.maxSize = config.maxSize;
      this.defaultTTL = config.defaultTTL;
      this.enableStats = config.enableStats;
    }

    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取缓存值
   *
   * @param key - 缓存键
   * @returns 缓存值，不存在或已过期返回 null
   *
   * @example
   * ```typescript
   * const value = await cache.get<UsageMetrics>('analytics:usage:week');
   * if (value) {
   *   console.log(value.totalRetrospectives);
   * }
   * ```
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // 检查是否过期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // LRU: 更新最后访问时间
    entry.lastAccessed = Date.now();
    this.hits++;

    return entry.value as T;
  }

  /**
   * 设置缓存值
   *
   * @param key - 缓存键
   * @param value - 缓存值
   * @param ttl - 过期时间（毫秒），可选，默认使用 defaultTTL
   *
   * @example
   * ```typescript
   * await cache.set('analytics:usage:week', metrics, 60000); // 60秒 TTL
   * await cache.set('analytics:quality:today', quality); // 使用默认 TTL
   * ```
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // 检查容量，如果满了则淘汰最久未使用的项
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : undefined
    });
  }

  /**
   * 删除缓存值
   *
   * @param key - 缓存键
   *
   * @example
   * ```typescript
   * await cache.delete('analytics:usage:week');
   * ```
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   *
   * @example
   * ```typescript
   * await cache.clear();
   * ```
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 检查缓存键是否存在
   *
   * @param key - 缓存键
   * @returns 是否存在（包括已过期的项）
   *
   * @example
   * ```typescript
   * const exists = await cache.has('analytics:usage:week');
   * ```
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // 检查是否过期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存大小
   *
   * @returns 当前缓存项数量
   *
   * @example
   * ```typescript
   * const size = cache.size();
   * ```
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   *
   * @returns 缓存统计信息
   *
   * @example
   * ```typescript
   * const stats = cache.getStats();
   * console.log(`命中率: ${stats.hitRate}%`);
   * console.log(`命中次数: ${stats.hits}`);
   * console.log(`未命中次数: ${stats.misses}`);
   * ```
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * 重置统计信息
   *
   * @example
   * ```typescript
   * cache.resetStats();
   * ```
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 批量删除缓存（支持通配符）
   *
   * @param pattern - 缓存键模式（支持 * 通配符）
   *
   * @example
   * ```typescript
   * // 删除所有使用指标缓存
   * await cache.deletePattern('analytics:usage:*');
   *
   * // 删除所有 Analytics 缓存
   * await cache.deletePattern('analytics:*');
   * ```
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );

    let count = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * 清理过期的缓存项
   *
   * @returns 清理的项数
   *
   * @example
   * ```typescript
   * const cleaned = cache.cleanupExpired();
   * console.log(`清理了 ${cleaned} 个过期项`);
   * ```
   */
  cleanupExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * 获取所有缓存键
   *
   * @returns 缓存键数组
   *
   * @example
   * ```typescript
   * const keys = cache.keys();
   * console.log(`缓存键数量: ${keys.length}`);
   * ```
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存项的详细信息
   *
   * @param key - 缓存键
   * @returns 缓存项信息，不存在返回 null
   *
   * @example
   * ```typescript
   * const info = cache.getEntryInfo('analytics:usage:week');
   * if (info) {
   *   console.log(`创建时间: ${new Date(info.createdAt)}`);
   *   console.log(`最后访问: ${new Date(info.lastAccessed)}`);
   *   console.log(`是否过期: ${info.isExpired}`);
   * }
   * ```
   */
  getEntryInfo(key: string): {
    createdAt: Date;
    lastAccessed: Date;
    expiresAt: Date | null;
    isExpired: boolean;
    ttl: number | null;
  } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
    const isExpired = expiresAt ? now > entry.expiresAt : false;
    const ttl = expiresAt ? entry.expiresAt - now : null;

    return {
      createdAt: new Date(entry.createdAt),
      lastAccessed: new Date(entry.lastAccessed),
      expiresAt,
      isExpired,
      ttl
    };
  }

  /**
   * 淘汰最久未使用的缓存项（LRU）
   *
   * @private
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 调整缓存容量
   *
   * @param newMaxSize - 新的最大容量
   * @param shrink - 如果为 true，当新容量小于当前大小时会淘汰项
   *
   * @example
   * ```typescript
   * cache.resize(2000, true); // 扩展到 2000
   * cache.resize(500, true); // 缩小到 500，会淘汰最久未使用的项
   * ```
   */
  resize(newMaxSize: number, shrink = true): void {
    const oldMaxSize = this.maxSize;
    this.maxSize = newMaxSize;

    // 如果缩小容量，淘汰多余的项
    if (shrink && newMaxSize < oldMaxSize) {
      while (this.cache.size > this.maxSize) {
        this.evictLRU();
      }
    }
  }

  /**
   * 获取缓存配置
   *
   * @returns 当前缓存配置
   *
   * @example
   * ```typescript
   * const config = cache.getConfig();
   * console.log(`最大容量: ${config.maxSize}`);
   * console.log(`默认TTL: ${config.defaultTTL}ms`);
   * ```
   */
  getConfig(): {
    maxSize: number;
    defaultTTL: number;
    enableStats: boolean;
  } {
    return {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
      enableStats: this.enableStats
    };
  }
}
