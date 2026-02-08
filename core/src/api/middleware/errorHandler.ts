/**
 * 统一错误处理中间件
 *
 * @description
 * 提供标准化的错误处理和响应格式，解决 SEC-006 错误信息泄露威胁
 *
 * @features
 * - 错误分类和 HTTP 状态码映射
 * - 开发/生产环境错误信息区分
 * - 敏感信息过滤
 * - 结构化错误日志
 * - 唯一错误 ID 生成
 *
 * @module api/middleware/errorHandler
 */

import * as crypto from 'node:crypto';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  VALIDATION = 'ValidationError',
  AUTHENTICATION = 'AuthenticationError',
  AUTHORIZATION = 'AuthorizationError',
  NOT_FOUND = 'NotFoundError',
  CONFLICT = 'ConflictError',
  RATE_LIMIT = 'RateLimitError',
  INTERNAL = 'InternalError'
}

/**
 * HTTP 状态码映射
 */
const ERROR_STATUS_MAP: Record<ErrorType, number> = {
  [ErrorType.VALIDATION]: 400,
  [ErrorType.AUTHENTICATION]: 401,
  [ErrorType.AUTHORIZATION]: 403,
  [ErrorType.NOT_FOUND]: 404,
  [ErrorType.CONFLICT]: 409,
  [ErrorType.RATE_LIMIT]: 429,
  [ErrorType.INTERNAL]: 500
};

/**
 * 敏感信息正则表达式
 */
const SENSITIVE_PATTERNS = [
  { pattern: /password["\s:=]+["']?([^"'\s]+)/gi, replacement: 'password="***"' },
  { pattern: /token["\s:=]+["']?([^"'\s]+)/gi, replacement: 'token="***"' },
  { pattern: /api[_-]?key["\s:=]+["']?([^"'\s]+)/gi, replacement: 'api_key="***"' },
  { pattern: /secret["\s:=]+["']?([^"'\s]+)/gi, replacement: 'secret="***"' },
  { pattern: /authorization["\s:=]+["']?([^"'\s]+)/gi, replacement: 'authorization="***"' },
  { pattern: /(postgresql|mysql|mongodb):\/\/[^@\s]+@/gi, replacement: '$1://***@' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-***' },
  { pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, replacement: 'Bearer ***' }
];

/**
 * 错误响应接口
 */
export interface ErrorResponse {
  id: string;                // 唯一错误 ID
  type: ErrorType;           // 错误类型
  message: string;           // 错误消息
  status: number;            // HTTP 状态码
  timestamp: string;         // 时间戳
  stack?: string;            // 堆栈信息（仅开发环境）
  path?: string;             // 请求路径
  method?: string;           // 请求方法
}

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  /**
   * 运行环境
   * @default 'production'
   */
  environment?: 'development' | 'production';

  /**
   * 是否启用详细日志
   * @default true
   */
  enableLogging?: boolean;

  /**
   * 是否显示错误 ID
   * @default true
   */
  showErrorId?: boolean;
}

/**
 * Hono Context 接口（简化）
 */
interface HonoContext {
  req: {
    method: string;
    url: string;
  };
  status(code: number): void;
  json(data: any): void;
  set(key: string, value: string): void;
}

/**
 * 统一错误处理中间件类
 */
export class ErrorHandler {
  private config: Required<ErrorHandlerConfig>;

  /**
   * 构造函数
   *
   * @param config - 错误处理器配置
   */
  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      environment: config.environment || 'production',
      enableLogging: config.enableLogging !== false,
      showErrorId: config.showErrorId !== false
    };
  }

  /**
   * 格式化错误为标准响应
   *
   * @param error - 原始错误对象
   * @returns 格式化的错误响应
   */
  formatError(error: Error): ErrorResponse {
    const errorType = this.classifyError(error);
    const status = ERROR_STATUS_MAP[errorType];
    const message = this.formatMessage(error, errorType);
    const id = this.generateErrorId();

    const response: ErrorResponse = {
      id,
      type: errorType,
      message,
      status,
      timestamp: new Date().toISOString()
    };

    // 开发环境包含堆栈信息
    if (this.config.environment === 'development' && error.stack) {
      response.stack = this.sanitizeStack(error.stack);
    }

    return response;
  }

  /**
   * 处理错误并发送响应
   *
   * @param error - 错误对象
   * @param ctx - Hono 上下文
   */
  handleError(error: Error, ctx: HonoContext): void {
    const response = this.formatError(error);

    // 设置 HTTP 状态码
    ctx.status(response.status);

    // 设置 Content-Type
    ctx.set('Content-Type', 'application/json');

    // 添加请求上下文
    response.path = ctx.req.url;
    response.method = ctx.req.method;

    // 发送 JSON 响应
    ctx.json(response);

    // 记录错误日志
    if (this.config.enableLogging) {
      this.logError(error, response);
    }
  }

  /**
   * 分类错误类型
   *
   * @param error - 错误对象
   * @returns 错误类型
   */
  private classifyError(error: Error): ErrorType {
    const errorName = error.name;

    switch (errorName) {
      case 'ValidationError':
        return ErrorType.VALIDATION;
      case 'AuthenticationError':
        return ErrorType.AUTHENTICATION;
      case 'AuthorizationError':
        return ErrorType.AUTHORIZATION;
      case 'NotFoundError':
        return ErrorType.NOT_FOUND;
      case 'ConflictError':
        return ErrorType.CONFLICT;
      case 'RateLimitError':
        return ErrorType.RATE_LIMIT;
      case 'InternalError':
      default:
        return ErrorType.INTERNAL;
    }
  }

  /**
   * 格式化错误消息
   *
   * @param error - 原始错误
   * @param errorType - 错误类型
   * @returns 格式化后的消息
   */
  private formatMessage(error: Error, errorType: ErrorType): string {
    let message = error.message;

    // 先过滤敏感信息（无论什么环境）
    message = this.sanitizeMessage(message);

    // 生产环境内部错误使用通用消息
    if (this.config.environment === 'production' && errorType === ErrorType.INTERNAL) {
      return 'An internal error occurred';
    }

    return message;
  }

  /**
   * 过滤敏感信息
   *
   * @param message - 原始消息
   * @returns 过滤后的消息
   */
  private sanitizeMessage(message: string): string {
    let sanitized = message;

    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  /**
   * 过滤堆栈信息中的文件路径
   *
   * @param stack - 原始堆栈
   * @returns 过滤后的堆栈
   */
  private sanitizeStack(stack: string): string {
    // 移除用户目录路径
    return stack.replace(/\/Users\/[^\/]+/g, '[user]');
  }

  /**
   * 生成唯一错误 ID
   *
   * @returns UUID v4
   */
  private generateErrorId(): string {
    return crypto.randomUUID();
  }

  /**
   * 记录错误日志
   *
   * @param error - 原始错误
   * @param response - 格式化的响应
   */
  private logError(error: Error, response: ErrorResponse): void {
    const logEntry = {
      id: response.id,
      type: response.type,
      message: error.message,
      stack: error.stack,
      status: response.status,
      path: response.path,
      method: response.method,
      timestamp: response.timestamp,
      environment: this.config.environment
    };

    // 使用 console.error 记录（生产环境应使用结构化日志服务）
    console.error('[ErrorHandler]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * 创建 Hono 中间件函数
   *
   * @returns Hono 中间件
   */
  middleware() {
    return async (ctx: HonoContext, next: () => Promise<void>) => {
      try {
        await next();
      } catch (error) {
        this.handleError(error as Error, ctx);
      }
    };
  }
}

/**
 * 预定义错误类
 */
export class ValidationError extends Error {
  name = 'ValidationError';
  constructor(message: string) { super(message); }
}

export class AuthenticationError extends Error {
  name = 'AuthenticationError';
  constructor(message: string) { super(message); }
}

export class AuthorizationError extends Error {
  name = 'AuthorizationError';
  constructor(message: string) { super(message); }
}

export class NotFoundError extends Error {
  name = 'NotFoundError';
  constructor(message: string) { super(message); }
}

export class ConflictError extends Error {
  name = 'ConflictError';
  constructor(message: string) { super(message); }
}

export class RateLimitError extends Error {
  name = 'RateLimitError';
  constructor(message: string) { super(message); }
}

export class InternalError extends Error {
  name = 'InternalError';
  constructor(message: string) { super(message); }
}

/**
 * 默认导出
 */
export default ErrorHandler;
