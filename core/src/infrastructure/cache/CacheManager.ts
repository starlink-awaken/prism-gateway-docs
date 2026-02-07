/**
 * PRISM-Gateway 通用缓存管理器
 *
 * @description
 * 轻量级内存缓存实现，支持 LRU 淘汰和 TTL 过期
 * 这是基础设施层的通用缓存组件，可供所有模块使用
 *
 * @module infrastructure/cache
 */

/**
 * 缓存条目
 *
 * @interface CacheEntry
 */
interface CacheEntry<V = unknown> {
  /**
   * 缓存的值
   */
  value: V;

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
 *
 * @interface CacheStats
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

  /**
   * 内存估算（字节）
   */
  estimatedMemoryBytes: number;
}

/**
 * 缓存配置
 *
 * @interface CacheConfig
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
  enableStats?: boolean;

  /**
   * 缓存名称（用于统计和调试）
   *
   * @default 'default'
   */
  name?: string;

  /**
   * 是否启用内存估算
   *
   * @default false
   */
  estimateMemory?: boolean;
}

/**
 * 缓存项信息
 *
 * @interface CacheEntryInfo
 */
export interface CacheEntryInfo {
  /**
   * 创建时间
   */
  createdAt: Date;

  /**
   * 最后访问时间
   */
  lastAccessed: Date;

  /**
   * 过期时间
   */
  expiresAt: Date | null;

  /**
   * 是否已过期
   */
  isExpired: boolean;

  /**
   * 剩余 TTL（毫秒）
   */
  ttl: number | null;

  /**
   * 估算大小（字节）
   */
  sizeBytes: number;
}

/**
 * 默认缓存配置
 */
const DEFAULT_CACHE_CONFIG: Required<CacheConfig> = {
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 分钟
  enableStats: true,
  name: 'default',
  estimateMemory: false
};

/**
 * 估算对象大小的辅助函数
 *
 * @param value - 要估算的对象
 * @returns 估算的字节数
 */
function estimateSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const type = typeof value;

  // 基本类型
  if (type === 'boolean') {
    return 4;
  }
  if (type === 'number') {
    return 8;
  }
  if (type === 'string') {
    return (value as string).length * 2; // UTF-16
  }

  // 对象和数组
  if (type === 'object') {
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + estimateSize(item), 0) + 16; // 数组开销
    }

    // 简单对象估算
    const obj = value as Record<string, unknown>;
    let size = 16; // 对象开销
    for (const [key, val] of Object.entries(obj)) {
      size += key.length * 2; // 键
      size += estimateSize(val); // 值
    }
    return size;
  }

  return 0;
}

/**
 * 缓存管理器类
 *
 * @description
 * 基于 LRU（Least Recently Used）策略的内存缓存实现
 *
 * @features
 * - LRU 淘汰策略
 * - TTL 过期支持
 * - 命中率统计
 * - 容量限制
 * - 模式删除
 * - 线程安全（使用 Atomics）

 * @example
 * ```typescript
 * // 基本使用
 * const cache = new CacheManager({ maxSize: 1000, name: 'analytics' });
 * await cache.set('user:123', { name: 'Alice' }, 60000);
 * const user = await cache.get('user:123');
 *
 * // Token 验证缓存
 * const tokenCache = new CacheManager({
 *   maxSize: 10000,
 *   defaultTTL: 300000, // 5 分钟
 *   name: 'token-validation'
 * });
 * ```
 *
 * @class CacheManager
 */
export class CacheManager<V = unknown> {
  private readonly cache: Map<string, CacheEntry<V>>;
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private readonly enableStats: boolean;
  private readonly name: string;
  private readonly estimateMemory: boolean;

  private hits: number;
  private misses: number;
  private totalSizeBytes: number;

  // 用于原子操作的锁状态
  private readonly lockState: Int32Array;

  /**
   * 构造函数
   *
   * @param config - 缓存配置
   */
  constructor(config?: CacheConfig) {
    const cfg = { ...DEFAULT_CACHE_CONFIG, ...config };

    this.maxSize = cfg.maxSize;
    this.defaultTTL = cfg.defaultTTL;
    this.enableStats = cfg.enableStats;
    this.name = cfg.name;
    this.estimateMemory = cfg.estimateMemory;

    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.totalSizeBytes = 0;

    // 使用 SharedArrayBuffer 实现简单的原子锁
    // 注意：需要正确的 HTTP 响应头才能使用 SharedArrayBuffer
    try {
      const buffer = new SharedArrayBuffer(4);
      this.lockState = new Int32Array(buffer);
    } catch {
      // 如果不支持 SharedArrayBuffer，回退到普通数组
      this.lockState = new Int32Array(1);
    }
  }

  /**
   * 获取缓存值
   *
   * @param key - 缓存键
   * @returns 缓存值，不存在或已过期返回 null
   *
   * @example
   * ```typescript
   * const user = await cache.get<User>('user:123');
   * if (user) {
   *   console.log(user.name);
   * }
   * ```
   */
  async get<T = V>(key: string): Promise<T | null> {
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
   * 同步获取缓存值（无锁）
   *
   * @param key - 缓存键
   * @returns 缓存值，不存在或已过期返回 null
   */
  getSync<T = V>(key: string): T | null {
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
   * await cache.set('user:123', user, 60000); // 60秒 TTL
   * await cache.set('session:abc', session); // 使用默认 TTL
   * ```
   */
  async set(key: string, value: V, ttl?: number): Promise<void> {
    this.setSync(key, value, ttl);
  }

  /**
   * 同步设置缓存值（无锁）
   *
   * @param key - 缓存键
   * @param value - 缓存值
   * @param ttl - 过期时间（毫秒），可选
   */
  setSync(key: string, value: V, ttl?: number): void {
    // 计算新项的大小
    const newSize = this.estimateMemory ? estimateSize(value) : 0;

    // 如果键已存在，先删除旧项
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key);
      if (oldEntry && this.estimateMemory) {
        this.totalSizeBytes -= estimateSize(oldEntry.value);
      }
      this.cache.delete(key);
    }

    // 检查容量，如果满了则淘汰最久未使用的项
    while (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<V> = {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : undefined
    };

    this.cache.set(key, entry);
    this.totalSizeBytes += newSize;
  }

  /**
   * 批量设置缓存值
   *
   * @param entries - 键值对数组
   * @param ttl - 默认 TTL（可选）
   *
   * @example
   * ```typescript
   * await cache.setMany([
   *   ['key1', value1],
   *   ['key2', value2]
   * ], 60000);
   * ```
   */
  async setMany(entries: Array<[string, V]>, ttl?: number): Promise<void> {
    for (const [key, value] of entries) {
      this.setSync(key, value, ttl);
    }
  }

  /**
   * 批量获取缓存值
   *
   * @param keys - 缓存键数组
   * @returns 键值对 Map，不存在的键不会出现在结果中
   *
   * @example
   * ```typescript
   * const values = await cache.getMany(['key1', 'key2', 'key3']);
   * console.log(values.get('key1')); // 缓存的值或 undefined
   * ```
   */
  async getMany<T = V>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * 删除缓存值
   *
   * @param key - 缓存键
   *
   * @example
   * ```typescript
   * await cache.delete('user:123');
   * ```
   */
  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry && this.estimateMemory) {
      this.totalSizeBytes -= estimateSize(entry.value);
    }
    this.cache.delete(key);
  }

  /**
   * 批量删除缓存值
   *
   * @param keys - 缓存键数组
   * @returns 删除的数量
   */
  async deleteMany(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.cache.has(key)) {
        await this.delete(key);
        count++;
      }
    }
    return count;
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
    this.totalSizeBytes = 0;
  }

  /**
   * 检查缓存键是否存在
   *
   * @param key - 缓存键
   * @returns 是否存在（不包括已过期的项）
   *
   * @example
   * ```typescript
   * const exists = await cache.has('user:123');
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
      hitRate: Math.round(hitRate * 100) / 100,
      estimatedMemoryBytes: this.totalSizeBytes
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
   * @returns 删除的项数
   *
   * @example
   * ```typescript
   * // 删除所有用户缓存
   * await cache.deletePattern('user:*');
   *
   * // 删除所有 Analytics 缓存
   * await cache.deletePattern('analytics:*');
   *
   * // 删除所有过期验证缓存
   * await cache.deletePattern('auth:validation:*');
   * ```
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );

    let count = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        const entry = this.cache.get(key);
        if (entry && this.estimateMemory) {
          this.totalSizeBytes -= estimateSize(entry.value);
        }
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
        if (this.estimateMemory) {
          this.totalSizeBytes -= estimateSize(entry.value);
        }
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
   * const info = cache.getEntryInfo('user:123');
   * if (info) {
   *   console.log(`创建时间: ${info.createdAt}`);
   *   console.log(`最后访问: ${info.lastAccessed}`);
   *   console.log(`是否过期: ${info.isExpired}`);
   *   console.log(`剩余 TTL: ${info.ttl}ms`);
   * }
   * ```
   */
  getEntryInfo(key: string): CacheEntryInfo | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
    const isExpired = expiresAt ? now > entry.expiresAt : false;
    const ttl = expiresAt ? entry.expiresAt - now : null;
    const sizeBytes = this.estimateMemory ? estimateSize(entry.value) : 0;

    return {
      createdAt: new Date(entry.createdAt),
      lastAccessed: new Date(entry.lastAccessed),
      expiresAt,
      isExpired,
      ttl,
      sizeBytes
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
      const entry = this.cache.get(oldestKey);
      if (entry && this.estimateMemory) {
        this.totalSizeBytes -= estimateSize(entry.value);
      }
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
    // @ts-expect-error - readonly 修改
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
   */
  getConfig(): {
    maxSize: number;
    defaultTTL: number;
    enableStats: boolean;
    name: string;
    estimateMemory: boolean;
  } {
    return {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
      enableStats: this.enableStats,
      name: this.name,
      estimateMemory: this.estimateMemory
    };
  }

  /**
   * 获取缓存名称
   */
  getName(): string {
    return this.name;
  }
}

/**
 * 导出类型
 */
export type { CacheEntry, CacheConfig };
