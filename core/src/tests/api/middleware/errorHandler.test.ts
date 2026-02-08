/**
 * 统一错误处理中间件测试
 *
 * @description
 * ErrorHandler 中间件的完整单元测试套件
 *
 * @test_coverage
 * - 错误分类和格式化
 * - 开发/生产环境错误信息
 * - 错误日志记录
 * - HTTP 状态码映射
 * - 敏感信息过滤
 *
 * @module tests/api/middleware/errorHandler.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  ErrorHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError
} from '../../../api/middleware/errorHandler.js';

/**
 * 模拟 Hono Context
 */
interface MockContext {
  req: { method: string; url: string };
  status: number;
  body: any;
  json: (data: any) => void;
  set: (key: string, value: string) => void;
}

function createMockContext(): MockContext {
  const ctx: MockContext = {
    req: { method: 'GET', url: '/api/test' },
    status: 200 as any,
    body: null,
    json: function(data: any) { this.body = data; },
    set: function(key: string, value: string) {}
  };
  // 添加status方法
  (ctx as any).status = function(code: number) { this.status = code; };
  return ctx;
}

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  describe('错误分类', () => {
    beforeEach(() => {
      errorHandler = new ErrorHandler({ environment: 'production' });
    });

    it('应该正确分类 ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.type).toBe('ValidationError');
      expect(formatted.status).toBe(400);
    });

    it('应该正确分类 AuthenticationError', () => {
      const error = new Error('Authentication failed');
      error.name = 'AuthenticationError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.type).toBe('AuthenticationError');
      expect(formatted.status).toBe(401);
    });

    it('应该正确分类 AuthorizationError', () => {
      const error = new Error('Access denied');
      error.name = 'AuthorizationError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.type).toBe('AuthorizationError');
      expect(formatted.status).toBe(403);
    });

    it('应该正确分类 NotFoundError', () => {
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.type).toBe('NotFoundError');
      expect(formatted.status).toBe(404);
    });

    it('应该正确分类 ConflictError', () => {
      const error = new Error('Resource conflict');
      error.name = 'ConflictError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.type).toBe('ConflictError');
      expect(formatted.status).toBe(409);
    });

    it('应该正确分类 RateLimitError', () => {
      const error = new Error('Rate limit exceeded');
      error.name = 'RateLimitError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.type).toBe('RateLimitError');
      expect(formatted.status).toBe(429);
    });

    it('应该正确分类 InternalError', () => {
      const error = new Error('Internal server error');
      error.name = 'InternalError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.type).toBe('InternalError');
      expect(formatted.status).toBe(500);
    });

    it('应该将未知错误分类为 InternalError', () => {
      const error = new Error('Unknown error');

      const formatted = errorHandler.formatError(error);

      expect(formatted.type).toBe('InternalError');
      expect(formatted.status).toBe(500);
    });
  });

  describe('开发环境错误信息', () => {
    beforeEach(() => {
      errorHandler = new ErrorHandler({ environment: 'development' });
    });

    it('应该在开发环境显示完整错误堆栈', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:10:15';

      const formatted = errorHandler.formatError(error);

      expect(formatted.stack).toBeDefined();
      expect(formatted.stack).toContain('Error: Test error');
    });

    it('应该在开发环境显示详细错误消息', () => {
      const error = new Error('Detailed error message');

      const formatted = errorHandler.formatError(error);

      expect(formatted.message).toBe('Detailed error message');
    });
  });

  describe('生产环境错误信息', () => {
    beforeEach(() => {
      errorHandler = new ErrorHandler({ environment: 'production' });
    });

    it('应该在生产环境隐藏错误堆栈', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:10:15';

      const formatted = errorHandler.formatError(error);

      expect(formatted.stack).toBeUndefined();
    });

    it('应该在生产环境使用通用错误消息', () => {
      const error = new Error('Sensitive internal error');

      const formatted = errorHandler.formatError(error);

      expect(formatted.message).toBe('An internal error occurred');
    });

    it('应该在生产环境保留客户端错误消息', () => {
      const error = new Error('Invalid input');
      error.name = 'ValidationError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.message).toBe('Invalid input');
    });
  });

  describe('敏感信息过滤', () => {
    it('应该在开发环境过滤错误堆栈中的文件路径', () => {
      errorHandler = new ErrorHandler({ environment: 'development' });
      const error = new Error('Test');
      error.stack = 'Error: Test\n    at /Users/user/project/src/index.ts:10:15';

      const formatted = errorHandler.formatError(error);

      expect(formatted.stack).not.toContain('/Users/user/');
      expect(formatted.stack).toContain('[user]');
    });

    it('应该在开发环境过滤错误消息中的密码', () => {
      errorHandler = new ErrorHandler({ environment: 'development' });
      const error = new ValidationError('Password "secret123" is invalid');

      const formatted = errorHandler.formatError(error);

      expect(formatted.message).not.toContain('secret123');
      expect(formatted.message).toContain('***');
    });

    it('应该在开发环境过滤错误消息中的 Token', () => {
      errorHandler = new ErrorHandler({ environment: 'development' });
      const error = new ValidationError('Token "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" is invalid');

      const formatted = errorHandler.formatError(error);

      expect(formatted.message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(formatted.message).toContain('***');
    });

    it('应该在生产环境为 InternalError 返回通用消息', () => {
      errorHandler = new ErrorHandler({ environment: 'production' });
      const error = new Error('Password "secret123" is invalid'); // 普通Error被归类为InternalError

      const formatted = errorHandler.formatError(error);

      // 生产环境InternalError返回通用消息
      expect(formatted.message).toBe('An internal error occurred');
      // 不包含原始敏感信息
      expect(formatted.message).not.toContain('secret123');
    });

    it('应该在生产环境为客户端错误保留过滤后的消息', () => {
      errorHandler = new ErrorHandler({ environment: 'production' });
      const error = new ValidationError('Password "secret123" is invalid');

      const formatted = errorHandler.formatError(error);

      // 客户端错误保留过滤后的消息
      expect(formatted.message).not.toContain('secret123');
      expect(formatted.message).toContain('***');
    });
  });

  describe('错误日志记录', () => {
    it('应该记录错误详情', () => {
      errorHandler = new ErrorHandler({ environment: 'production' });
      const error = new Error('Test error');

      // 捕获console.error输出
      const originalError = console.error;
      let logged = false;
      console.error = (...args: any[]) => {
        logged = true;
        originalError(...args);
      };

      errorHandler.handleError(error, createMockContext());

      console.error = originalError;

      expect(logged).toBe(true);
    });

    it('应该记录请求上下文', () => {
      errorHandler = new ErrorHandler({ environment: 'production' });
      const error = new Error('Test error');
      const ctx = createMockContext();

      // 捕获console.error输出
      const originalError = console.error;
      let loggedData: string = '';
      console.error = (...args: any[]) => {
        loggedData = JSON.stringify(args);
        originalError(...args);
      };

      errorHandler.handleError(error, ctx);

      console.error = originalError;

      expect(loggedData).toContain('/api/test');
      expect(loggedData).toContain('GET');
    });
  });

  describe('HTTP 状态码映射', () => {
    beforeEach(() => {
      errorHandler = new ErrorHandler({ environment: 'production' });
    });

    it('ValidationError 映射到 400', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.status).toBe(400);
    });

    it('AuthenticationError 映射到 401', () => {
      const error = new Error('Authentication failed');
      error.name = 'AuthenticationError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.status).toBe(401);
    });

    it('AuthorizationError 映射到 403', () => {
      const error = new Error('Access denied');
      error.name = 'AuthorizationError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.status).toBe(403);
    });

    it('NotFoundError 映射到 404', () => {
      const error = new Error('Not found');
      error.name = 'NotFoundError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.status).toBe(404);
    });

    it('ConflictError 映射到 409', () => {
      const error = new Error('Conflict');
      error.name = 'ConflictError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.status).toBe(409);
    });

    it('RateLimitError 映射到 429', () => {
      const error = new Error('Rate limited');
      error.name = 'RateLimitError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.status).toBe(429);
    });

    it('InternalError 映射到 500', () => {
      const error = new Error('Internal error');
      error.name = 'InternalError';

      const formatted = errorHandler.formatError(error);

      expect(formatted.status).toBe(500);
    });
  });

  describe('中间件集成', () => {
    beforeEach(() => {
      errorHandler = new ErrorHandler({ environment: 'production' });
    });

    it('应该设置正确的 HTTP 状态码', () => {
      const error = new Error('Not found');
      error.name = 'NotFoundError';
      const ctx = createMockContext();

      errorHandler.handleError(error, ctx);

      expect(ctx.status).toBe(404);
    });

    it('应该返回 JSON 错误响应', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      const ctx = createMockContext();

      errorHandler.handleError(error, ctx);

      expect(ctx.body).toBeDefined();
      expect(ctx.body.type).toBe('ValidationError');
      expect(ctx.body.status).toBe(400);
    });

    it('应该设置正确的 Content-Type', () => {
      const error = new Error('Test error');
      const ctx = createMockContext();
      let contentTypeValue = '';

      ctx.set = (key: string, value: string) => {
        if (key === 'Content-Type') {
          contentTypeValue = value;
        }
      };

      errorHandler.handleError(error, ctx);

      expect(contentTypeValue).toBe('application/json');
    });
  });

  describe('错误 ID 生成', () => {
    it('应该为每个错误生成唯一 ID', () => {
      errorHandler = new ErrorHandler({ environment: 'production' });
      const error = new Error('Test error');

      const formatted1 = errorHandler.formatError(error);
      const formatted2 = errorHandler.formatError(error);

      expect(formatted1.id).toBeDefined();
      expect(formatted2.id).toBeDefined();
      expect(formatted1.id).not.toBe(formatted2.id);
    });

    it('错误 ID 应该是 UUID 格式', () => {
      errorHandler = new ErrorHandler({ environment: 'production' });
      const error = new Error('Test error');

      const formatted = errorHandler.formatError(error);

      expect(formatted.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('时间戳', () => {
    it('应该包含错误发生时间戳', () => {
      errorHandler = new ErrorHandler({ environment: 'production' });
      const error = new Error('Test error');

      const formatted = errorHandler.formatError(error);

      expect(formatted.timestamp).toBeDefined();
      expect(new Date(formatted.timestamp)).toBeInstanceOf(Date);
    });
  });
});

/**
 * 自定义 Matcher：spyOn
 */
function spyOn(obj: any, method: string) {
  const original = obj[method];
  const calls: any[][] = [];

  obj[method] = (...args: any[]) => {
    calls.push(args);
    return original.apply(obj, args);
  };

  return {
    calls,
    restore: () => {
      obj[method] = original;
    }
  };
}
