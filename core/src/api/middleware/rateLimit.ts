/**
 * P0-2: 请求队列和限流中间件
 *
 * @description
 * 提供请求队列管理和限流功能，防止服务过载：
 * - 最多 N 个并发请求（默认 3）
 * - 请求超时机制（默认 5 秒）
 * - 队列限制和拒绝
 * - 返回 429 状态码
 *
 * @module api/middleware/rateLimit
 */

/**
 * 限流配置选项
 */
export interface RateLimitConfig {
  /** 最大并发请求数 */
  maxConcurrent: number;
  /** 请求超时时间（毫秒） */
  timeout: number;
  /** 队列最大长度（0 表示不排队） */
  queueLimit: number;
  /** 429 响应中的 Retry-After 值（秒） */
  retryAfter: number;
  /** 是否启用优先级队列 */
  enablePriority?: boolean;
}

/**
 * 队列统计信息
 */
export interface QueueStats {
  /** 当前正在处理的请求数 */
  processing: number;
  /** 队列中等待的请求数 */
  pending: number;
  /** 已完成的请求数 */
  completed: number;
  /** 总请求数 */
  total: number;
  /** 被拒绝的请求数 */
  rejected: number;
  /** 超时的请求数 */
  timedOut: number;
  /** 平均处理时间（毫秒） */
  avgProcessingTime: number;
  /** 成功率（0-1） */
  successRate: number;
  /** 配置值 */
  maxConcurrent: number;
  timeout: number;
  queueLimit: number;
}

/**
 * 队列中的请求
 */
interface QueuedRequestInternal<TReq, TRes> {
  /** 请求 ID */
  id: string;
  /** 原始请求 */
  request: TReq;
  /** 处理函数 */
  handler: (req: TReq) => Promise<TRes>;
  /** 优先级（数字越大优先级越高） */
  priority: number;
  /** 解析函数 */
  resolve: (value: TRes) => void;
  /** 拒绝函数 */
  reject: (reason: Error) => void;
  /** 添加时间 */
  addedAt: number;
  /** 超时定时器 */
  timeoutTimer?: NodeJS.Timeout;
}

/**
 * 限流结果
 */
export interface RateLimitResult<TRes> {
  /** HTTP 状态码 */
  status: number;
  /** 响应体 */
  body: string;
  /** 响应头 */
  headers: Record<string, string>;
  /** 实际响应（如果成功） */
  response?: TRes;
}

/**
 * 请求处理器类型
 */
export type RequestHandler<TReq, TRes> = (req: TReq) => Promise<TRes>;

/**
 * 请求队列类
 *
 * @description
 * 管理并发请求队列，支持超时、优先级和统计。
 *
 * @example
 * ```ts
 * const queue = new RequestQueue({
 *   maxConcurrent: 3,
 *   timeout: 5000,
 *   queueLimit: 10,
 *   retryAfter: 60
 * });
 *
 * const result = await queue.add(request, async (req) => {
 *   return processData(req);
 * });
 * ```
 */
export class RequestQueue<TReq = any, TRes = any> {
  private config: RateLimitConfig;
  private queue: QueuedRequestInternal<TReq, TRes>[] = [];
  private processing: Set<string> = new Set();

  // 统计信息
  private stats = {
    completed: 0,
    total: 0,
    rejected: 0,
    timedOut: 0,
    totalProcessingTime: 0
  };

  private requestCounter = 0;

  constructor(config: RateLimitConfig) {
    this.config = { ...config, enablePriority: config.enablePriority ?? false };
  }

  /**
   * 添加请求到队列
   *
   * @param request - 请求对象
   * @param handler - 处理函数
   * @param priority - 优先级（可选，数字越大优先级越高）
   * @returns 处理结果
   * @throws 如果队列已满或请求超时
   */
  async add(
    request: TReq,
    handler: RequestHandler<TReq, TRes>,
    priority: number = 0
  ): Promise<TRes> {
    this.stats.total++;

    // 检查是否可以立即处理或加入队列
    const hasFreeSlot = this.processing.size < this.config.maxConcurrent;
    const hasQueueSpace = this.config.queueLimit === 0 ||
                         this.queue.length < this.config.queueLimit;

    // 如果没有空闲槽位且没有队列空间，拒绝请求
    if (!hasFreeSlot && !hasQueueSpace) {
      this.stats.rejected++;
      throw new Error(
        `队列已满: ${this.queue.length}/${this.config.queueLimit}`
      );
    }

    // queueLimit 为 0 且没有空闲槽位时，应该立即拒绝
    // （不等待槽位释放）
    if (!hasFreeSlot && this.config.queueLimit === 0) {
      this.stats.rejected++;
      throw new Error('所有槽位都被占用，不允许等待');
    }

    const requestId = `req-${++this.requestCounter}-${Date.now()}`;

    return new Promise<TRes>((resolve, reject) => {
      const queuedRequest: QueuedRequestInternal<TReq, TRes> = {
        id: requestId,
        request,
        handler,
        priority,
        resolve,
        reject,
        addedAt: Date.now()
      };

      // 设置超时
      const timeoutTimer = setTimeout(() => {
        this.stats.timedOut++;
        this.removeFromQueue(requestId);
        this.processing.delete(requestId);
        reject(new Error(`请求超时: ${this.config.timeout}ms`));
      }, this.config.timeout);

      queuedRequest.timeoutTimer = timeoutTimer;

      // 添加到队列
      this.addToQueue(queuedRequest);

      // 尝试处理队列
      this.processQueue();
    });
  }

  /**
   * 添加请求到队列（考虑优先级）
   */
  private addToQueue(request: QueuedRequestInternal<TReq, TRes>): void {
    if (this.config.enablePriority) {
      // 按优先级插入（高优先级在前）
      let insertIndex = this.queue.length;
      for (let i = 0; i < this.queue.length; i++) {
        if (request.priority > this.queue[i].priority) {
          insertIndex = i;
          break;
        }
      }
      this.queue.splice(insertIndex, 0, request);
    } else {
      // FIFO
      this.queue.push(request);
    }
  }

  /**
   * 从队列中移除请求
   */
  private removeFromQueue(requestId: string): void {
    const index = this.queue.findIndex(r => r.id === requestId);
    if (index !== -1) {
      const request = this.queue[index];
      if (request.timeoutTimer) {
        clearTimeout(request.timeoutTimer);
      }
      this.queue.splice(index, 1);
    }
  }

  /**
   * 处理队列中的请求
   */
  private processQueue(): void {
    // 处理直到达到最大并发数
    while (
      this.queue.length > 0 &&
      this.processing.size < this.config.maxConcurrent
    ) {
      const queuedRequest = this.queue.shift();

      if (!queuedRequest) {
        break;
      }

      // 清除超时定时器（开始处理，超时由 handler 控制）
      if (queuedRequest.timeoutTimer) {
        clearTimeout(queuedRequest.timeoutTimer);
      }

      // 标记为处理中
      this.processing.add(queuedRequest.id);

      // 处理请求
      this.processRequest(queuedRequest);
    }
  }

  /**
   * 处理单个请求
   */
  private async processRequest(
    queuedRequest: QueuedRequestInternal<TReq, TRes>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await queuedRequest.handler(queuedRequest.request);
      const processingTime = Date.now() - startTime;

      this.stats.completed++;
      this.stats.totalProcessingTime += processingTime;

      queuedRequest.resolve(result);
    } catch (error) {
      queuedRequest.reject(error as Error);
    } finally {
      // 从处理集合中移除
      this.processing.delete(queuedRequest.id);

      // 继续处理队列
      this.processQueue();
    }
  }

  /**
   * 获取队列统计信息
   */
  getStats(): QueueStats {
    const successRate =
      this.stats.total > 0
        ? this.stats.completed / this.stats.total
        : 1;

    return {
      processing: this.processing.size,
      pending: this.queue.length,
      completed: this.stats.completed,
      total: this.stats.total,
      rejected: this.stats.rejected,
      timedOut: this.stats.timedOut,
      avgProcessingTime:
        this.stats.completed > 0
          ? this.stats.totalProcessingTime / this.stats.completed
          : 0,
      successRate,
      maxConcurrent: this.config.maxConcurrent,
      timeout: this.config.timeout,
      queueLimit: this.config.queueLimit
    };
  }

  /**
   * 重置统计信息
   */
  reset(): void {
    this.stats = {
      completed: 0,
      total: 0,
      rejected: 0,
      timedOut: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * 清空队列（拒绝所有等待中的请求）
   */
  clear(): void {
    for (const request of this.queue) {
      if (request.timeoutTimer) {
        clearTimeout(request.timeoutTimer);
      }
      request.reject(new Error('队列已清空'));
    }
    this.queue = [];
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<RateLimitConfig> {
    return { ...this.config };
  }
}

/**
 * 限流中间件类
 *
 * @description
 * 提供 HTTP 风格的限流中间件功能。
 *
 * @example
 * ```ts
 * const middleware = new RateLimitMiddleware({
 *   maxConcurrent: 3,
 *   timeout: 5000,
 *   queueLimit: 10,
 *   retryAfter: 60
 * });
 *
 * const result = await middleware.process(request, handler);
 * if (result.status === 429) {
 *   // 处理限流
 * }
 * ```
 */
export class RateLimitMiddleware<TReq = any, TRes = any> {
  private queue: RequestQueue<TReq, TRes>;

  constructor(config: RateLimitConfig) {
    this.queue = new RequestQueue<TReq, TRes>(config);
  }

  /**
   * 处理请求
   *
   * @param request - 请求对象
   * @param handler - 处理函数
   * @param priority - 优先级（可选）
   * @returns 处理结果
   */
  async process(
    request: TReq,
    handler: RequestHandler<TReq, TRes>,
    priority: number = 0
  ): Promise<RateLimitResult<TRes>> {
    try {
      const response = await this.queue.add(request, handler, priority);

      return {
        status: 200,
        body: 'OK',
        headers: {
          'x-rate-limit-remaining': String(
            Math.max(
              0,
              this.queue.getStats().maxConcurrent -
                this.queue.getStats().processing
            )
          )
        },
        response
      };
    } catch (error) {
      const err = error as Error;

      // 检查是否是队列已满或槽位被占用错误
      if (
        err.message.includes('队列已满') ||
        err.message.includes('所有槽位都被占用') ||
        err.message.includes('不允许等待')
      ) {
        const config = this.queue.getConfig();
        return {
          status: 429,
          body: 'Too Many Requests',
          headers: {
            'retry-after': String(config.retryAfter),
            'x-rate-limit-limit': String(config.maxConcurrent),
            'x-rate-limit-remaining': '0'
          }
        };
      }

      // 检查是否是超时错误
      if (err.message.includes('超时')) {
        return {
          status: 504,
          body: 'Gateway Timeout',
          headers: {}
        };
      }

      // 其他错误
      return {
        status: 500,
        body: err.message,
        headers: {}
      };
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): QueueStats {
    return this.queue.getStats();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.queue.updateConfig(config);
  }

  /**
   * 重置统计信息
   */
  reset(): void {
    this.queue.reset();
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue.clear();
  }

  /**
   * 获取底层队列实例（用于高级操作）
   */
  getQueue(): RequestQueue<TReq, TRes> {
    return this.queue;
  }
}

/**
 * 创建聚合查询限流中间件
 *
 * @description
 * 创建专门用于聚合查询的限流中间件，默认配置为 3 并发、5 秒超时。
 *
 * @param config - 可选的配置覆盖
 * @returns 配置好的限流中间件
 *
 * @example
 * ```ts
 * const middleware = createAggregateLimiter({
 *   maxConcurrent: 5 // 覆盖默认值
 * });
 * ```
 */
export function createAggregateLimiter<TReq = any, TRes = any>(
  config?: Partial<RateLimitConfig>
): RateLimitMiddleware<TReq, TRes> {
  const defaultConfig: RateLimitConfig = {
    maxConcurrent: 3,
    timeout: 5000,
    queueLimit: 10,
    retryAfter: 60,
    enablePriority: false
  };

  return new RateLimitMiddleware<TReq, TRes>({
    ...defaultConfig,
    ...config
  });
}

/**
 * 创建 Express/Node.js 风格的中间件函数
 *
 * @description
 * 返回一个可以与 Express 等 HTTP 框架一起使用的中间件函数。
 *
 * @param config - 限流配置
 * @returns 中间件函数
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { rateLimitMiddleware } from './rateLimit.js';
 *
 * const app = express();
 * app.use(rateLimitMiddleware({ maxConcurrent: 10 }));
 * ```
 */
export function rateLimitMiddleware(
  config: RateLimitConfig
): (
  req: any,
  res: any,
  next: (err?: any) => void
) => void {
  const limiter = new RateLimitMiddleware(config);

  return (req: any, res: any, next: (err?: any) => void) => {
    // 包装原始的 res.end 以捕获响应
    const originalEnd = res.end;
    res.end = function(this: any, ...args: any[]) {
      originalEnd.apply(this, args);
      next();
    };

    // 这里只是示例，实际使用需要根据框架调整
    next();
  };
}

/**
 * 导出类型
 */
export type { RateLimitConfig, QueueStats, RequestHandler };

/**
 * 导出旧类型别名（向后兼容）
 */
export type QueuedRequest<TReq = any, TRes = any> = {
  id: string;
  request: TReq;
  handler: RequestHandler<TReq, TRes>;
  priority: number;
  addedAt: number;
};
