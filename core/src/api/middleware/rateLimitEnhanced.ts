/**
 * 增强型速率限制中间件（Task #13: 速率限制优化）
 *
 * @description
 * 基于原有 rateLimitHono 增强，支持：
 * - 分层限流（IP、用户、端点）
 * - 速率限制事件日志
 * - 更细粒度的控制
 *
 * @features
 * - IP 级别限流：100 req/15min
 * - 用户级别限流：200 req/15min
 * - 端点级别限流：认证端点 10 req/15min
 * - 事件日志记录
 *
 * @module api/middleware/rateLimitEnhanced
 */

import type { MiddlewareHandler } from 'hono';
import type { Context, Env } from 'hono';

/**
 * 速率限制事件
 */
export interface RateLimitEvent {
  /** 事件时间戳 */
  timestamp: number;
  /** 客户端 IP */
  ip: string;
  /** 用户 ID（如果已认证） */
  userId?: string;
  /** 端点路径 */
  path: string;
  /** HTTP 方法 */
  method: string;
  /** 是否被限流 */
  blocked: boolean;
  /** 当前计数 */
  count: number;
  /** 限制数量 */
  limit: number;
  /** 键前缀 */
  keyPrefix: string;
}

/**
 * 速率限制事件日志监听器
 */
export type RateLimitEventLogListener = (event: RateLimitEvent) => void;

/**
 * 增强型速率限制配置
 */
export interface EnhancedRateLimiterConfig {
  /** 时间窗口内允许的最大请求数 */
  maxRequests: number;
  /** 时间窗口长度（毫秒） */
  windowMs: number;
  /** 键前缀（用于区分不同端点） */
  keyPrefix: string;
  /** 是否启用用户级别限流 */
  enableUserRateLimit?: boolean;
  /** 用户级别最大请求数（默认为 maxRequests 的 2 倍） */
  maxUserRequests?: number;
  /** 事件日志监听器 */
  onRateLimit?: RateLimitEventLogListener;
  /** IP 白名单 */
  whitelist?: string[];
}

/**
 * 内存存储（带事件支持）
 */
class EnhancedMemoryStore {
  private store = new Map<string, { count: number; resetAt: number }>();
  private userStore = new Map<string, { count: number; resetAt: number }>();

  get(key: string): { count: number; resetAt: number } | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    const now = Date.now();
    if (now >= entry.resetAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  getUser(key: string): { count: number; resetAt: number } | undefined {
    const entry = this.userStore.get(key);
    if (!entry) {
      return undefined;
    }
    const now = Date.now();
    if (now >= entry.resetAt) {
      this.userStore.delete(key);
      return undefined;
    }
    return entry;
  }

  increment(key: string, windowMs: number): { count: number; resetAt: number } {
    const existing = this.get(key);
    if (existing) {
      existing.count++;
      return existing;
    }
    const entry = {
      count: 1,
      resetAt: Date.now() + windowMs
    };
    this.store.set(key, entry);
    return entry;
  }

  incrementUser(key: string, windowMs: number): { count: number; resetAt: number } {
    const existing = this.getUser(key);
    if (existing) {
      existing.count++;
      return existing;
    }
    const entry = {
      count: 1,
      resetAt: Date.now() + windowMs
    };
    this.userStore.set(key, entry);
    return entry;
  }

  reset(): void {
    this.store.clear();
    this.userStore.clear();
  }

  size(): number {
    return this.store.size + this.userStore.size;
  }
}

/**
 * 从请求中提取 IP 地址
 */
function extractIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips[0]) {
      return ips[0];
    }
  }

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * 从上下文中提取用户 ID
 */
function extractUserId(c: Context): string | undefined {
  // 尝试从认证上下文获取
  const authUser = c.get('user');
  if (authUser?.sub) {
    return authUser.sub;
  }

  // 尝试从 Authorization 头获取（简化版）
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // 实际应该验证 Token 并提取 user_id
    // 这里简化处理
    return `token:${authHeader.slice(7, 20)}`;
  }

  return undefined;
}

/**
 * 创建增强型速率限制中间件
 *
 * @param config - 配置选项
 * @returns Hono 中间件
 */
export function createEnhancedRateLimiter<E extends Env = any>(
  config: EnhancedRateLimiterConfig
): MiddlewareHandler<E> {
  const {
    maxRequests,
    windowMs,
    keyPrefix,
    enableUserRateLimit = false,
    maxUserRequests = maxRequests * 2,
    onRateLimit,
    whitelist = []
  } = config;

  const store = new EnhancedMemoryStore();

  return async (c, next) => {
    const ip = extractIp(c.req.raw);
    const userId = enableUserRateLimit ? extractUserId(c) : undefined;
    const path = c.req.path;
    const method = c.req.method;

    // 检查白名单
    if (whitelist.includes(ip)) {
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(maxRequests));
      c.header('X-RateLimit-Reset', String(Date.now() + windowMs));
      c.header('X-RateLimit-Whitelisted', 'true');
      return next();
    }

    // IP 级别限流
    const ipKey = `${keyPrefix}:ip:${ip}`;
    let ipEntry = store.increment(ipKey, windowMs);
    let ipRemaining = Math.max(0, maxRequests - ipEntry.count);

    // 用户级别限流（如果启用且有用户 ID）
    let userRemaining = Infinity;
    let userEntry: { count: number; resetAt: number } | undefined;
    if (userId && enableUserRateLimit) {
      const userKey = `${keyPrefix}:user:${userId}`;
      userEntry = store.incrementUser(userKey, windowMs);
      userRemaining = Math.max(0, maxUserRequests - userEntry.count);
    }

    // 检查是否超过任一限制
    const ipBlocked = ipEntry.count > maxRequests;
    const userBlocked = userEntry ? userEntry.count > maxUserRequests : false;
    const blocked = ipBlocked || userBlocked;

    // 计算显示的剩余值（取较小值）
    const displayRemaining = Math.min(ipRemaining, userRemaining);

    // 记录事件
    const event: RateLimitEvent = {
      timestamp: Date.now(),
      ip,
      userId,
      path,
      method,
      blocked,
      count: ipEntry.count,
      limit: maxRequests,
      keyPrefix
    };

    if (onRateLimit) {
      onRateLimit(event);
    }

    // 设置响应头
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(ipRemaining));
    c.header('X-RateLimit-Reset', String(ipEntry.resetAt));

    if (enableUserRateLimit && userId) {
      c.header('X-RateLimit-Limit-User', String(maxUserRequests));
      c.header('X-RateLimit-Remaining-User', String(userRemaining));
    }

    // 检查是否超过限制
    if (blocked) {
      const retryAfter = Math.max(1, Math.ceil((ipEntry.resetAt - Date.now()) / 1000));

      c.header('Retry-After', String(retryAfter));

      return c.json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter
      }, 429);
    }

    await next();
  };
}

/**
 * 事件日志收集器
 *
 * @description
 * 收集速率限制事件，用于分析和监控
 */
export class RateLimitEventCollector {
  private events: RateLimitEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
  }

  /**
   * 创建事件监听器
   */
  createListener(): RateLimitEventLogListener {
    return (event) => {
      this.events.push(event);
      if (this.events.length > this.maxEvents) {
        this.events.shift();
      }
    };
  }

  /**
   * 获取所有事件
   */
  getEvents(): RateLimitEvent[] {
    return [...this.events];
  }

  /**
   * 获取被阻止的事件
   */
  getBlockedEvents(): RateLimitEvent[] {
    return this.events.filter(e => e.blocked);
  }

  /**
   * 按 IP 分组统计
   */
  getStatsByIp(): Map<string, { total: number; blocked: number }> {
    const stats = new Map<string, { total: number; blocked: number }>();

    for (const event of this.events) {
      const existing = stats.get(event.ip) || { total: 0, blocked: 0 };
      existing.total++;
      if (event.blocked) {
        existing.blocked++;
      }
      stats.set(event.ip, existing);
    }

    return stats;
  }

  /**
   * 清空事件
   */
  clear(): void {
    this.events = [];
  }
}

/**
 * 预定义的增强型限流配置
 */
export const EnhancedRateLimitPresets = {
  /**
   * 认证端点限流：10 次/15 分钟
   */
  auth: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'auth'
  } as const,

  /**
   * API 端点限流：100 次/15 分钟（带用户限流）
   */
  api: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'api',
    enableUserRateLimit: true,
    maxUserRequests: 200
  } as const,

  /**
   * 公开端点限流：50 次/15 分钟
   */
  public: {
    maxRequests: 50,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'public'
  } as const,

  /**
   * 严格限流：5 次/分钟
   */
  strict: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    keyPrefix: 'strict'
  } as const
};

/**
 * 创建认证端点限流器
 */
export function createEnhancedAuthLimiter(
  config?: Partial<EnhancedRateLimiterConfig>
): MiddlewareHandler {
  return createEnhancedRateLimiter({
    ...EnhancedRateLimitPresets.auth,
    ...config
  });
}

/**
 * 创建 API 端点限流器
 */
export function createEnhancedApiLimiter(
  config?: Partial<EnhancedRateLimiterConfig>
): MiddlewareHandler {
  return createEnhancedRateLimiter({
    ...EnhancedRateLimitPresets.api,
    ...config
  });
}

/**
 * 导出类型
 */
export type { EnhancedRateLimiterConfig, RateLimitEvent };
