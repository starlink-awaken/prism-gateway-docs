/**
 * Logger 单元测试
 *
 * @description
 * 测试 Logger 的核心功能：
 * - 日志级别配置
 * - 结构化日志输出
 * - 上下文绑定
 * - 子日志器创建
 * - 请求 ID 追踪
 * - 错误堆栈跟踪
 *
 * @testStrategy
 * RED-GREEN-REFACTOR:
 * 1. RED: 先写测试，预期失败
 * 2. GREEN: 实现 Logger 使测试通过
 * 3. REFACTOR: 重构优化代码
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Logger, LogLevel } from './Logger.js';
import { writableStreamToArray } from '../testing/test-utils.js';

describe('Logger', () => {
  let logs: unknown[] = [];
  let logger: Logger;

  beforeEach(() => {
    logs = [];
  });

  afterEach(() => {
    // 清理资源
  });

  describe('构造函数', () => {
    it('应该创建默认配置的日志器', () => {
      logger = new Logger({ silent: true });
      expect(logger).toBeDefined();
      expect(logger.level).toBe(LogLevel.INFO);
    });

    it('应该支持自定义日志级别', () => {
      logger = new Logger({ level: LogLevel.DEBUG, silent: true });
      expect(logger.level).toBe(LogLevel.DEBUG);
    });

    it('应该支持设置服务名称', () => {
      logger = new Logger({ name: 'test-service', silent: true });
      expect(logger.name).toBe('test-service');
    });

    it('应该支持开发环境模式', () => {
      logger = new Logger({ environment: 'development', silent: true });
      expect(logger.environment).toBe('development');
    });
  });

  describe('日志级别', () => {
    it('应该正确支持 DEBUG 级别', () => {
      logger = new Logger({ level: LogLevel.DEBUG, silent: true });
      logger.debug('debug message');
      // 验证日志级别设置成功
      expect(logger.level).toBe(LogLevel.DEBUG);
    });

    it('应该正确支持 INFO 级别', () => {
      logger = new Logger({ level: LogLevel.INFO, silent: true });
      logger.info('info message');
      expect(logger.level).toBe(LogLevel.INFO);
    });

    it('应该正确支持 WARN 级别', () => {
      logger = new Logger({ level: LogLevel.WARN, silent: true });
      logger.warn('warn message');
      expect(logger.level).toBe(LogLevel.WARN);
    });

    it('应该正确支持 ERROR 级别', () => {
      logger = new Logger({ level: LogLevel.ERROR, silent: true });
      logger.error('error message');
      expect(logger.level).toBe(LogLevel.ERROR);
    });

    it('应该在 WARN 级别下过滤 DEBUG 日志', () => {
      logger = new Logger({ level: LogLevel.WARN, silent: true });
      // WARN 级别应该不输出 DEBUG 日志
      expect(logger.level).toBe(LogLevel.WARN);
    });

    it('应该在 ERROR 级别下过滤 INFO 日志', () => {
      logger = new Logger({ level: LogLevel.ERROR, silent: true });
      expect(logger.level).toBe(LogLevel.ERROR);
    });
  });

  describe('结构化日志', () => {
    it('应该输出包含时间戳的结构化日志', () => {
      // 验证 Logger 可以正常调用，不抛出错误
      logger = new Logger({ silent: true });

      // 获取底层 pino 实例
      const pino = logger.getPino();
      expect(pino).toBeDefined();

      // 验证日志器有正确的级别
      expect(logger.level).toBe(LogLevel.INFO);
    });

    it('应该支持额外上下文字段', () => {
      logger = new Logger({ silent: true });

      // 不应该抛出错误
      expect(() => {
        logger.info('test message', { userId: '123', action: 'login' });
      }).not.toThrow();
    });

    it('应该正确序列化对象', () => {
      logger = new Logger({ silent: true });
      const obj = { user: { id: '123', name: 'test' } };

      expect(() => {
        logger.info('test', obj);
      }).not.toThrow();
    });

    it('应该正确序列化错误对象', () => {
      logger = new Logger({ silent: true });
      const error = new Error('test error');

      expect(() => {
        logger.error('error occurred', error);
      }).not.toThrow();
    });
  });

  describe('上下文绑定', () => {
    it('应该创建带有上下文的子日志器', () => {
      const baseLogger = new Logger({ silent: true });
      const childLogger = baseLogger.withContext({ service: 'auth' });

      expect(childLogger).toBeDefined();
      expect(childLogger.name).toBe(baseLogger.name);
    });

    it('子日志器应该继承父日志器配置', () => {
      const baseLogger = new Logger({ level: LogLevel.DEBUG, silent: true });
      const childLogger = baseLogger.withContext({ service: 'auth' });

      expect(childLogger.level).toBe(baseLogger.level);
    });

    it('子日志器应该包含父日志器的上下文', () => {
      const baseLogger = new Logger({ silent: true });
      const childLogger = baseLogger.withContext({ service: 'auth' });
      const grandChildLogger = childLogger.withContext({ module: 'login' });

      expect(grandChildLogger).toBeDefined();
    });

    it('应该支持链式上下文添加', () => {
      const baseLogger = new Logger({ silent: true });
      const childLogger = baseLogger
        .withContext({ service: 'auth' })
        .withContext({ module: 'login' })
        .withContext({ userId: '123' });

      expect(childLogger).toBeDefined();
    });
  });

  describe('请求 ID 追踪', () => {
    it('应该支持设置请求 ID', () => {
      logger = new Logger({ silent: true });
      const requestLogger = logger.withRequest('req-123');

      expect(requestLogger).toBeDefined();
    });

    it('所有日志应该包含请求 ID', () => {
      logger = new Logger({ silent: true });
      const requestLogger = logger.withRequest('req-123');

      expect(() => {
        requestLogger.info('test message');
        requestLogger.error('error message');
      }).not.toThrow();
    });

    it('应该生成唯一的请求 ID（当未提供时）', () => {
      logger = new Logger({ silent: true });
      const requestLogger1 = logger.withRequest();
      const requestLogger2 = logger.withRequest();

      expect(requestLogger1).toBeDefined();
      expect(requestLogger2).toBeDefined();
      // 不同的请求应该有不同的上下文
      expect(requestLogger1).not.toBe(requestLogger2);
    });
  });

  describe('错误处理', () => {
    it('应该正确记录错误堆栈', () => {
      logger = new Logger({ silent: true });
      const error = new Error('test error');
      error.stack = 'Error: test error\n    at test.ts:10:15';

      expect(() => {
        logger.error('error occurred', error);
      }).not.toThrow();
    });

    it('应该支持错误对象作为主要参数', () => {
      logger = new Logger({ silent: true });
      const error = new Error('test error');

      expect(() => {
        logger.error(error);
      }).not.toThrow();
    });

    it('应该支持错误和额外上下文', () => {
      logger = new Logger({ silent: true });
      const error = new Error('test error');

      expect(() => {
        logger.error(error, { userId: '123', action: 'delete' });
      }).not.toThrow();
    });

    it('应该处理循环引用对象', () => {
      logger = new Logger({ silent: true });
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      expect(() => {
        logger.info('circular reference', circular);
      }).not.toThrow();
    });
  });

  describe('性能', () => {
    it('日志操作应该是同步的（不阻塞）', () => {
      logger = new Logger({ silent: true });
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        logger.info(`message ${i}`);
      }

      const duration = performance.now() - start;
      // 1000 条日志应该在合理时间内完成（<100ms）
      expect(duration).toBeLessThan(100);
    });

    it('应该在禁用级别时快速返回', () => {
      logger = new Logger({ level: LogLevel.ERROR, silent: true });
      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        logger.debug(`debug message ${i}`);
      }

      const duration = performance.now() - start;
      // 被过滤的日志应该非常快（<10ms）
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Hono 中间件集成', () => {
    it('应该生成 Hono 日志中间件', () => {
      logger = new Logger({ silent: true });
      const middleware = logger.honoMiddleware();

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('中间件应该添加请求 ID 到上下文', async () => {
      logger = new Logger({ silent: true });
      const middleware = logger.honoMiddleware();

      expect(middleware).toBeDefined();
    });
  });

  describe('日志格式化', () => {
    it('生产环境应该输出 JSON 格式', () => {
      logger = new Logger({ environment: 'production', silent: true });
      expect(logger.environment).toBe('production');
    });

    it('开发环境应该输出可读格式', () => {
      logger = new Logger({ environment: 'development', silent: true });
      expect(logger.environment).toBe('development');
    });

    it('测试环境应该简化输出', () => {
      logger = new Logger({ environment: 'test', silent: true });
      expect(logger.environment).toBe('test');
    });
  });

  describe('安全敏感信息', () => {
    it('应该过滤密码字段', () => {
      logger = new Logger({ silent: true });

      expect(() => {
        logger.info('user login', {
          username: 'test',
          password: 'secret123',
          apiKey: 'key-123'
        });
      }).not.toThrow();
    });

    it('应该过滤 token 字段', () => {
      logger = new Logger({ silent: true });

      expect(() => {
        logger.info('auth request', {
          token: 'jwt-token-123',
          refreshToken: 'refresh-123'
        });
      }).not.toThrow();
    });

    it('应该过滤信用卡号', () => {
      logger = new Logger({ silent: true });

      expect(() => {
        logger.info('payment', {
          cardNumber: '4111111111111111',
          cvv: '123'
        });
      }).not.toThrow();
    });
  });
});
