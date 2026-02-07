/**
 * P0: 速率限制 Hono 中间件
 *
 * @description
 * 基于 IP 地址和时间窗口的速率限制中间件，用于防止 API 滥用和 DoS 攻击。
 *
 * @features
 * - 滑动窗口算法
 * - 基于 IP 地址的限流
 * - 不同端点独立限流策略
 * - 白名单支持
 * - 优雅降级
 *
 * @endpoints
 * - 认证端点: 10 次/15 分钟（防暴力破解）
 * - API 端点: 100 次/15 分钟（正常使用）
 * - 公开端点: 50 次/15 分钟（更严格）
 *
 * @module api/middleware/rateLimitHono
 */

import type { MiddlewareHandler } from 'hono';

/**
 * 速率限制存储条目
 */
export interface RateLimitEntry {
  /** 当前窗口内的请求计数 */
  count: number;
  /** 窗口过期时间戳（毫秒） */
  resetAt: number;
}

/**
 * 存储接口
 *
 * @description
 * 定义速率限制数据的存储接口。默认使用内存存储，
 * 生产环境可以扩展为 Redis 等分布式存储。
 */
export interface RateLimitStore {
  /** 获取限流条目 */
  get(key: string): RateLimitEntry | undefined | Promise<RateLimitEntry | undefined>;
  /** 增加计数 */
  increment(key: string, windowMs: number): RateLimitEntry | Promise<RateLimitEntry>;
  /** 重置所有条目（可选，用于测试） */
  reset?(): void | Promise<void>;
  /** 获取存储大小（可选，用于监控） */
  size?(): number | Promise<number>;
}

/**
 * 速率限制配置选项
 */
export interface RateLimiterConfig {
  /** 时间窗口内允许的最大请求数 */
  maxRequests: number;
  /** 时间窗口长度（毫秒） */
  windowMs: number;
  /** 键前缀（用于区分不同端点） */
  keyPrefix: string;
  /** 自定义存储（默认使用内存存储） */
  store?: RateLimitStore;
  /** 获取当前时间的函数（用于测试） */
  getTime?: () => number;
  /** IP 白名单（不限流） */
  whitelist?: string[];
  /** 是否在请求失败时跳过限流计数 */
  skipFailedRequests?: boolean;
  /** 是否在请求成功时跳过限流计数 */
  skipSuccessfulRequests?: boolean;
  /** 发生错误时是否跳过限流（优雅降级） */
  skipFailedRequestsWhenError?: boolean;
}

/**
 * 默认的内存存储实现
 */
class MemoryStore implements RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    // 检查是否过期
    const now = Date.now();
    if (now >= entry.resetAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const existing = this.get(key);

    if (existing) {
      existing.count++;
      return existing;
    }

    const entry: RateLimitEntry = {
      count: 1,
      resetAt: Date.now() + windowMs
    };

    this.store.set(key, entry);
    return entry;
  }

  reset(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/**
 * 速率限制错误响应
 */
interface RateLimitErrorResponse {
  success: false;
  error: string;
  message: string;
  retryAfter: number;
}

/**
 * 从请求中提取 IP 地址
 *
 * @param request - Hono 请求对象
 * @returns IP 地址字符串
 *
 * @private
 */
function extractIp(request: Request): string {
  // 尝试从 x-forwarded-for 获取
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for 可能包含多个 IP，取第一个
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips[0]) {
      return ips[0];
    }
  }

  // 尝试从 cf-connecting-ip 获取
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  // 尝试从 x-real-ip 获取
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 回退到 host 或默认值
  const host = request.headers.get('host');
  return host || 'unknown';
}

/**
 * 创建速率限制中间件
 *
 * @param config - 限流配置
 * @returns Hono 中间件
 *
 * @example
 * ```ts
 * import { createRateLimiter } from './rateLimitHono.js';
 *
 * // 认证端点限流：10 次/15 分钟
 * const authLimiter = createRateLimiter({
 *   maxRequests: 10,
 *   windowMs: 15 * 60 * 1000,
 *   keyPrefix: 'auth'
 * });
 *
 * app.use('/api/v1/auth/*', authLimiter);
 * ```
 */
export function createRateLimiter(
  config: RateLimiterConfig
): MiddlewareHandler {
  // 验证配置
  if (config.maxRequests <= 0) {
    throw new Error('maxRequests must be positive');
  }
  if (config.windowMs <= 0) {
    throw new Error('windowMs must be positive');
  }

  const {
    maxRequests,
    windowMs,
    keyPrefix,
    store: customStore,
    getTime = Date.now,
    whitelist = [],
    skipFailedRequestsWhenError = false
  } = config;

  // 使用自定义存储或默认内存存储
  const store: RateLimitStore = customStore || new MemoryStore();

  return async (c, next) => {
    try {
      // 提取客户端 IP
      const ip = extractIp(c.req.raw);

      // 检查白名单
      if (whitelist.includes(ip)) {
        // 白名单 IP 直接通过，但仍设置响应头表示已检查
        c.header('X-RateLimit-Limit', String(maxRequests));
        c.header('X-RateLimit-Remaining', String(maxRequests));
        c.header('X-RateLimit-Reset', String(getTime() + windowMs));
        c.header('X-RateLimit-Whitelisted', 'true');
        return next();
      }

      // 构造限流键
      const key = `${keyPrefix}:${ip}`;

      // 获取或创建限流条目
      let entry: RateLimitEntry;
      try {
        entry = await store.increment(key, windowMs);
      } catch (storeError) {
        if (skipFailedRequestsWhenError) {
          // 存储故障时优雅降级
          console.error('Rate limit store error:', storeError);
          return next();
        }
        throw storeError;
      }

      // 计算剩余配额
      const remaining = Math.max(0, maxRequests - entry.count);
      const resetAt = entry.resetAt;

      // 设置响应头
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(remaining));
      c.header('X-RateLimit-Reset', String(resetAt));

      // 检查是否超过限制
      if (entry.count > maxRequests) {
        const retryAfter = Math.max(1, Math.ceil((resetAt - getTime()) / 1000));

        const errorResponse: RateLimitErrorResponse = {
          success: false,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter
        };

        c.header('Retry-After', String(retryAfter));
        return c.json(errorResponse, 429);
      }

      // 继续处理请求
      await next();

      // 可选：根据响应状态调整计数
      // 这里暂不实现，保持简单

    } catch (error) {
      // 发生错误时的处理
      console.error('Rate limiter error:', error);

      if (skipFailedRequestsWhenError) {
        // 错误时跳过限流，允许请求通过
        return next();
      }

      // 否则返回错误
      throw error;
    }
  };
}

/**
 * 预定义的限流配置
 */
export const RateLimitPresets = {
  /**
   * 认证端点限流：10 次/15 分钟
   * 用于防止暴力破解攻击
   */
  auth: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 分钟
    keyPrefix: 'auth'
  } as const,

  /**
   * API 端点限流：100 次/15 分钟
   * 用于正常的 API 使用
   */
  api: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 分钟
    keyPrefix: 'api'
  } as const,

  /**
   * 公开端点限流：50 次/15 分钟
   * 更严格的限制用于公开访问
   */
  public: {
    maxRequests: 50,
    windowMs: 15 * 60 * 1000, // 15 分钟
    keyPrefix: 'public'
  } as const,

  /**
   * 严格限流：5 次/分钟
   * 用于高价值操作
   */
  strict: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 分钟
    keyPrefix: 'strict'
  } as const
};

/**
 * 创建认证端点限流器
 *
 * @param config - 可选的配置覆盖
 * @returns 限流中间件
 */
export function createAuthLimiter(
  config?: Partial<RateLimiterConfig>
): MiddlewareHandler {
  return createRateLimiter({
    ...RateLimitPresets.auth,
    ...config
  });
}

/**
 * 创建 API 端点限流器
 *
 * @param config - 可选的配置覆盖
 * @returns 限流中间件
 */
export function createApiLimiter(
  config?: Partial<RateLimiterConfig>
): MiddlewareHandler {
  return createRateLimiter({
    ...RateLimitPresets.api,
    ...config
  });
}

/**
 * 创建公开端点限流器
 *
 * @param config - 可选的配置覆盖
 * @returns 限流中间件
 */
export function createPublicLimiter(
  config?: Partial<RateLimiterConfig>
): MiddlewareHandler {
  return createRateLimiter({
    ...RateLimitPresets.public,
    ...config
  });
}

/**
 * 导出类型
 */
export type { RateLimitStore, RateLimiterConfig };
