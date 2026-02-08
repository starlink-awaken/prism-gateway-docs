/**
 * PRISM-Gateway 缓存模块
 *
 * @description
 * 轻量级缓存基础设施，提供：
 * - 通用 LRU 缓存管理器
 * - Token 验证缓存
 * - 性能基准测试工具
 *
 * @module infrastructure/cache
 */

export { CacheManager } from './CacheManager.js';
export type {
  CacheStats,
  CacheConfig,
  CacheEntryInfo
} from './CacheManager.js';

export { TokenCache, createTokenCacheMiddleware } from './TokenCache.js';
export type {
  TokenCacheConfig
} from './TokenCache.js';

export { PerformanceBenchmark } from './Benchmark.js';
export type {
  BenchmarkConfig,
  BenchmarkOperation,
  BenchmarkResult,
  BenchmarkReport
} from './Benchmark.js';
