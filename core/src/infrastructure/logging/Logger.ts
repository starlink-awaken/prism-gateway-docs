/**
 * Logger - 结构化日志模块
 *
 * @description
 * 基于 Pino 的轻量级结构化日志系统，提供：
 * - 多级别日志（DEBUG/INFO/WARN/ERROR）
 * - 请求 ID 追踪
 * - 上下文绑定
 * - 安全敏感信息过滤
 * - Hono 中间件集成
 *
 * @features
 * - 结构化 JSON 输出（生产环境）
 * - 可读格式输出（开发环境）
 * - 子日志器上下文继承
 * - 高性能（零拷贝序列化）
 *
 * @example
 * ```ts
 * import { Logger } from './Logger.js';
 *
 * const logger = new Logger({ name: 'auth-service' });
 * logger.info('User logged in', { userId: '123' });
 *
 * const requestLogger = logger.withRequest('req-abc-123');
 * requestLogger.warn('Invalid token provided');
 *
 * const childLogger = logger.withContext({ module: 'login' });
 * childLogger.error('Authentication failed', error);
 * ```
 *
 * @module infrastructure/logging
 */

import pino from 'pino';
import { Context } from 'hono';

/**
 * 日志级别枚举
 *
 * @description
 * 按严重程度排序的日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SILENT = 'silent'
}

/**
 * 敏感字段名称列表（用于过滤）
 *
 * @description
 * 这些字段的值在日志中会被自动脱敏
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn'
];

/**
 * 日志配置选项
 */
export interface LoggerOptions {
  /** 日志器名称（服务/模块名称） */
  name?: string;
  /** 日志级别 */
  level?: LogLevel;
  /** 运行环境 */
  environment?: 'development' | 'production' | 'test';
  /** 是否静默（不输出） */
  silent?: boolean;
  /** 自定义输出流 */
  stream?: pino.StreamEntry;
}

/**
 * 日志上下文
 */
export interface LogContext {
  /** 服务名称 */
  service?: string;
  /** 模块名称 */
  module?: string;
  /** 请求 ID */
  requestId?: string;
  /** 用户 ID */
  userId?: string;
  /** 其他上下文 */
  [key: string]: unknown;
}

/**
 * 日志元数据
 */
export interface LogMetadata extends Record<string, unknown> {
  /** 时间戳 */
  timestamp?: string;
  /** 日志级别 */
  level?: string;
  /** 错误对象 */
  err?: Error;
  /** 请求 ID */
  requestId?: string;
}

/**
 * 脱敏值
 *
 * @param value - 原始值
 * @param fieldName - 字段名称
 * @returns 脱敏后的值
 */
function redactValue(value: unknown, fieldName: string): unknown {
  // 检查是否是敏感字段
  const isSensitive = SENSITIVE_FIELDS.some(
    sensitive => fieldName.toLowerCase().includes(sensitive.toLowerCase())
  );

  if (isSensitive) {
    if (typeof value === 'string' && value.length > 0) {
      // 显示前 2 个字符和后 2 个字符
      if (value.length <= 4) {
        return '***';
      }
      return `${value.slice(0, 2)}***${value.slice(-2)}`;
    }
    return '***';
  }

  // 递归处理对象
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        redactValue(item, String(index))
      );
    }
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = redactValue(val, key);
    }
    return result;
  }

  return value;
}

/**
 * Logger 类
 *
 * @description
 * 主要的日志器类，提供结构化日志功能
 */
export class Logger {
  /** Pino 日志器实例 */
  private readonly pino: pino.Logger;
  /** 日志器名称 */
  readonly name: string;
  /** 当前日志级别 */
  readonly level: LogLevel;
  /** 运行环境 */
  readonly environment: string;
  /** 基础上下文 */
  private readonly baseContext: LogContext;

  /**
   * 创建日志器实例
   *
   * @param options - 配置选项
   */
  constructor(options: LoggerOptions = {}) {
    this.name = options.name ?? 'prism-gateway';
    this.level = options.level ?? LogLevel.INFO;
    this.environment = options.environment ?? process.env.NODE_ENV ?? 'development';
    this.baseContext = {};

    // Pino 配置
    const pinoOptions: pino.LoggerOptions = {
      name: this.name,
      level: options.silent ? LogLevel.SILENT : this.level,
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => {
          // 脱敏处理
          return redactValue(object, '');
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // 生产环境使用 JSON，开发环境使用可读格式
      ...(this.environment === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname'
              }
            }
          }
        : {})
    };

    // 自定义输出流
    if (options.stream) {
      pinoOptions.stream = options.stream;
    }

    this.pino = pino(pinoOptions);
  }

  /**
   * 记录 DEBUG 级别日志
   *
   * @param message - 日志消息
   * @param context - 上下文数据
   */
  debug(message: string, context?: LogContext): void {
    this.pino.debug(context ?? {}, message);
  }

  /**
   * 记录 INFO 级别日志
   *
   * @param message - 日志消息
   * @param context - 上下文数据
   */
  info(message: string, context?: LogContext): void {
    this.pino.info(context ?? {}, message);
  }

  /**
   * 记录 WARN 级别日志
   *
   * @param message - 日志消息
   * @param context - 上下文数据
   */
  warn(message: string, context?: LogContext): void {
    this.pino.warn(context ?? {}, message);
  }

  /**
   * 记录 ERROR 级别日志
   *
   * @param message - 日志消息或错误对象
   * @param errorOrContext - 错误对象或上下文数据
   * @param context - 额外的上下文数据（当第一个参数是错误对象时）
   */
  error(
    message: string | Error,
    errorOrContext?: Error | LogContext,
    context?: LogContext
  ): void {
    if (message instanceof Error) {
      // 第一个参数是错误对象
      const err = message;
      const ctx = (errorOrContext as LogContext) ?? {};
      this.pino.error({ err, ...ctx }, err.message);
    } else if (errorOrContext instanceof Error) {
      // 第二个参数是错误对象
      const err = errorOrContext;
      this.pino.error({ err, ...(context ?? {}) }, message);
    } else {
      // 普通错误消息
      this.pino.error(errorOrContext ?? {}, message);
    }
  }

  /**
   * 创建带有上下文的子日志器
   *
   * @param context - 要添加的上下文
   * @returns 新的 Logger 实例，继承当前配置和上下文
   *
   * @example
   * ```ts
   * const authLogger = logger.withContext({ service: 'auth' });
   * const loginLogger = authLogger.withContext({ module: 'login' });
   * // loginLogger 包含 { service: 'auth', module: 'login' }
   * ```
   */
  withContext(context: LogContext): Logger {
    const child = new Logger({
      name: this.name,
      level: this.level,
      environment: this.environment as any
    });

    // 合并基础上下文
    Object.assign(child.baseContext, this.baseContext, context);

    // 绑定 Pino 子日志器
    child.pino = this.pino.child(context);

    return child;
  }

  /**
   * 创建带有请求 ID 的日志器
   *
   * @param requestId - 请求 ID（可选，未提供时自动生成）
   * @returns 新的 Logger 实例，带有请求 ID 上下文
   *
   * @example
   * ```ts
   * const requestLogger = logger.withRequest('req-abc-123');
   * requestLogger.info('Processing request');
   * // 输出包含 requestId: 'req-abc-123'
   * ```
   */
  withRequest(requestId?: string): Logger {
    const id = requestId ?? this.generateRequestId();
    return this.withContext({ requestId: id });
  }

  /**
   * 生成唯一的请求 ID
   *
   * @returns 请求 ID（格式：timestamp-random）
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 创建 Hono 中间件
   *
   * @returns Hono 中间件函数
   *
   * @description
   * 中间件功能：
   * - 为每个请求生成唯一的 requestId
   * - 记录请求开始
   * - 记录请求完成（包括状态码和耗时）
   * - 将 requestId 添加到上下文
   *
   * @example
   * ```ts
   * app.use('*', logger.honoMiddleware());
   * ```
   */
  honoMiddleware(): (c: Context, next: () => Promise<void>) => Promise<void> {
    return async (c: Context, next: () => Promise<void>) => {
      const requestId = c.req.header('x-request-id') ?? this.generateRequestId();
      const startTime = Date.now();

      // 将 requestId 添加到 Hono 上下文
      c.set('requestId', requestId);

      // 创建请求专用日志器
      const requestLogger = this.withRequest(requestId);

      // 记录请求开始
      requestLogger.debug('Incoming request', {
        method: c.req.method,
        path: c.req.path,
        query: c.req.query(),
        userAgent: c.req.header('user-agent')
      });

      // 将日志器添加到上下文，供后续使用
      c.set('logger', requestLogger);

      try {
        await next();

        // 记录请求完成
        const duration = Date.now() - startTime;
        const status = c.res.status;

        const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

        requestLogger[logLevel]('Request completed', {
          method: c.req.method,
          path: c.req.path,
          status,
          duration
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        requestLogger.error('Request failed', error as Error, {
          method: c.req.method,
          path: c.req.path,
          duration
        });

        throw error;
      }
    };
  }

  /**
   * 创建带用户上下文的日志器
   *
   * @param userId - 用户 ID
   * @returns 新的 Logger 实例，带有用户 ID 上下文
   */
  withUser(userId: string): Logger {
    return this.withContext({ userId });
  }

  /**
   * 批量记录多条日志
   *
   * @param entries - 日志条目数组
   *
   * @example
   * ```ts
   * logger.batch([
   *   { level: 'info', message: 'Started', context: { step: 1 } },
   *   { level: 'info', message: 'Processing', context: { step: 2 } },
   *   { level: 'info', message: 'Completed', context: { step: 3 } }
   * ]);
   * ```
   */
  batch(entries: Array<{ level: LogLevel; message: string; context?: LogContext }>): void {
    for (const entry of entries) {
      switch (entry.level) {
        case LogLevel.DEBUG:
          this.debug(entry.message, entry.context);
          break;
        case LogLevel.INFO:
          this.info(entry.message, entry.context);
          break;
        case LogLevel.WARN:
          this.warn(entry.message, entry.context);
          break;
        case LogLevel.ERROR:
          this.error(entry.message, entry.context);
          break;
      }
    }
  }

  /**
   * 刷新日志缓冲区
   *
   * @description
   * 确保所有日志都已写入输出流
   */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.pino.flush(() => resolve());
    });
  }

  /**
   * 获取底层 Pino 日志器
   *
   * @returns Pino Logger 实例
   *
   * @description
   * 用于需要直接访问 Pino 功能的高级场景
   */
  getPino(): pino.Logger {
    return this.pino;
  }
}

/**
 * 默认日志器实例
 *
 * @description
 * 全局共享的日志器实例，使用默认配置
 */
export const defaultLogger = new Logger();

/**
 * 创建日志器工厂函数
 *
 * @param options - 配置选项
 * @returns 新的 Logger 实例
 *
 * @description
 * 便捷函数，用于快速创建配置好的日志器
 *
 * @example
 * ```ts
 * import { createLogger } from './Logger.js';
 *
 * const authLogger = createLogger({ name: 'auth-service' });
 * const apiLogger = createLogger({ name: 'api', level: LogLevel.DEBUG });
 * ```
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
