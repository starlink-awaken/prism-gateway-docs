/**
 * P0: 速率限制 Hono 中间件测试
 *
 * 测试目标:
 * 1. 基于时间窗口的速率限制
 * 2. 不同端点使用不同限制策略
 * 3. 返回 429 状态码和 Retry-After 头
 * 4. 使用 IP 地址作为限流键
 *
 * @remarks
 * 这是 RED 阶段：测试先行，确保测试失败后再实现功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { RateLimiterConfig, createRateLimiter } from '../../../api/middleware/rateLimitHono.js';

// 模拟时间工具
let mockTime = Date.now();

function advanceTime(ms: number): void {
  mockTime += ms;
}

// 测试用的存储后端
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class TestStore {
  private store: Map<string, RateLimitEntry> = new Map();

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    // 检查是否过期
    if (mockTime >= entry.resetAt) {
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
      resetAt: mockTime + windowMs
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

describe('P0: 速率限制 Hono 中间件', () => {
  let testStore: TestStore;
  let mockTimeImpl: () => number;

  beforeEach(() => {
    mockTime = Date.now();
    testStore = new TestStore();
    mockTimeImpl = () => mockTime;
  });

  afterEach(() => {
    testStore.reset();
  });

  describe('配置验证', () => {
    it('应该拒绝负数的请求限制', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: -1,
          windowMs: 60000
        });
      }).toThrow('maxRequests must be positive');
    });

    it('应该拒绝零窗口时间', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 10,
          windowMs: 0
        });
      }).toThrow('windowMs must be positive');
    });

    it('应该接受有效配置', () => {
      expect(() => {
        createRateLimiter({
          maxRequests: 10,
          windowMs: 60000
        });
      }).not.toThrow();
    });
  });

  describe('认证端点限流 (10次/15分钟)', () => {
    it('应该允许在前 10 次请求内通过', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 10,
        windowMs: 15 * 60 * 1000, // 15 分钟
        keyPrefix: 'auth',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/auth/*', limiter);
      app.get('/api/v1/auth/test', (c) => c.json({ success: true }));

      // 模拟同一 IP 的 10 次请求
      for (let i = 0; i < 10; i++) {
        const response = await app.request('/api/v1/auth/test', {
          headers: {
            'x-forwarded-for': '192.168.1.100'
          }
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });
      }
    });

    it('应该在超过 10 次请求后返回 429', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 10,
        windowMs: 15 * 60 * 1000,
        keyPrefix: 'auth',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/auth/*', limiter);
      app.get('/api/v1/auth/test', (c) => c.json({ success: true }));

      // 发送 11 次请求
      const responses: Array<number> = [];
      for (let i = 0; i < 11; i++) {
        const response = await app.request('/api/v1/auth/test', {
          headers: {
            'x-forwarded-for': '192.168.1.100'
          }
        });
        responses.push(response.status);
      }

      // 前 10 次应该成功
      for (let i = 0; i < 10; i++) {
        expect(responses[i]).toBe(200);
      }

      // 第 11 次应该被限流
      expect(responses[10]).toBe(429);
    });

    it('应该包含 Retry-After 响应头', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000,
        keyPrefix: 'auth',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/auth/*', limiter);
      app.get('/api/v1/auth/test', (c) => c.json({ success: true }));

      // 发送 6 次请求（超过限制）
      for (let i = 0; i < 6; i++) {
        await app.request('/api/v1/auth/test', {
          headers: { 'x-forwarded-for': '192.168.1.100' }
        });
      }

      const response = await app.request('/api/v1/auth/test', {
        headers: { 'x-forwarded-for': '192.168.1.100' }
      });

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeDefined();
      expect(response.headers.get('Retry-After')).toMatch(/^\d+$/);

      const retryAfter = parseInt(response.headers.get('Retry-After')!);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(900); // 15 分钟 = 900 秒
    });

    it('应该返回统一的错误响应格式', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 3,
        windowMs: 60000,
        keyPrefix: 'auth',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/auth/*', limiter);
      app.post('/api/v1/auth/login', (c) => c.json({ success: true, token: 'test' }));

      // 发送 4 次请求（超过限制）
      for (let i = 0; i < 4; i++) {
        await app.request('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': '10.0.0.1' }
        });
      }

      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.1' }
      });

      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body).toEqual({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: expect.any(Number)
      });
    });
  });

  describe('API 端点限流 (100次/15分钟)', () => {
    it('应该允许 100 次 API 请求', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 100,
        windowMs: 15 * 60 * 1000,
        keyPrefix: 'api',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/analytics/*', limiter);
      app.get('/api/v1/analytics/usage', (c) => c.json({ data: 'metrics' }));

      // 发送 100 次请求
      for (let i = 0; i < 100; i++) {
        const response = await app.request('/api/v1/analytics/usage', {
          headers: { 'x-forwarded-for': '10.1.1.50' }
        });
        expect(response.status).toBe(200);
      }
    });

    it('应该在第 101 次请求时限流', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 100,
        windowMs: 15 * 60 * 1000,
        keyPrefix: 'api',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/analytics/*', limiter);
      app.get('/api/v1/analytics/dashboard', (c) => c.json({ dashboard: 'data' }));

      // 发送 101 次请求
      let lastStatus = 200;
      for (let i = 0; i < 101; i++) {
        const response = await app.request('/api/v1/analytics/dashboard', {
          headers: { 'x-forwarded-for': '10.1.1.51' }
        });
        lastStatus = response.status;
      }

      expect(lastStatus).toBe(429);
    });
  });

  describe('公开端点限流 (50次/15分钟)', () => {
    it('应该对公开端点应用更严格的限制', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 50,
        windowMs: 15 * 60 * 1000,
        keyPrefix: 'public',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/public/*', limiter);
      app.get('/api/v1/public/info', (c) => c.json({ info: 'public' }));

      // 发送 51 次请求
      let lastStatus = 200;
      for (let i = 0; i < 51; i++) {
        const response = await app.request('/api/v1/public/info', {
          headers: { 'x-forwarded-for': '10.2.2.100' }
        });
        lastStatus = response.status;
      }

      expect(lastStatus).toBe(429);
    });
  });

  describe('时间窗口重置', () => {
    it('应该在时间窗口过期后重置计数', async () => {
      const app = new Hono();
      const windowMs = 60000; // 1 分钟（为了测试方便）
      const config: RateLimiterConfig = {
        maxRequests: 5,
        windowMs,
        keyPrefix: 'window-test',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/test/*', limiter);
      app.get('/api/v1/test/data', (c) => c.json({ data: 'test' }));

      // 使用全部配额
      for (let i = 0; i < 5; i++) {
        const response = await app.request('/api/v1/test/data', {
          headers: { 'x-forwarded-for': '10.3.3.1' }
        });
        expect(response.status).toBe(200);
      }

      // 应该被限流
      let response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '10.3.3.1' }
      });
      expect(response.status).toBe(429);

      // 时间窗口过期后
      advanceTime(windowMs + 1000);

      // 应该再次允许请求
      response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '10.3.3.1' }
      });
      expect(response.status).toBe(200);
    });
  });

  describe('IP 地址识别', () => {
    it('应该使用 x-forwarded-for 头中的 IP', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 2,
        windowMs: 60000,
        keyPrefix: 'ip-test',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/test/*', limiter);
      app.get('/api/v1/test/data', (c) => c.json({ ok: true }));

      // IP A 发送 2 次请求
      await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '1.2.3.4' }
      });
      await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '1.2.3.4' }
      });

      // IP A 应该被限流
      let response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '1.2.3.4' }
      });
      expect(response.status).toBe(429);

      // IP B 应该仍然允许
      response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '5.6.7.8' }
      });
      expect(response.status).toBe(200);
    });

    it('应该处理 x-forwarded-for 中的多个 IP（取第一个）', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 2,
        windowMs: 60000,
        keyPrefix: 'multi-ip-test',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/test/*', limiter);
      app.get('/api/v1/test/data', (c) => c.json({ ok: true }));

      // 使用 x-forwarded-for 中的第一个 IP
      const proxyChain = '1.2.3.4, 10.0.0.1, 10.0.0.2';

      await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': proxyChain }
      });
      await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': proxyChain }
      });

      // 应该被限流（基于第一个 IP）
      const response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': proxyChain }
      });
      expect(response.status).toBe(429);
    });

    it('应该在没有 x-forwarded-for 时使用远程地址', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 2,
        windowMs: 60000,
        keyPrefix: 'fallback-ip-test',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/test/*', limiter);
      app.get('/api/v1/test/data', (c) => c.json({ ok: true }));

      // 在测试环境中，Hono 使用模拟的请求
      // 我们需要确保即使没有 x-forwarded-for 也能工作
      // 使用 Host 头作为回退
      await app.request('/api/v1/test/data', {
        headers: { 'host': 'localhost' }
      });
      await app.request('/api/v1/test/data', {
        headers: { 'host': 'localhost' }
      });

      const response = await app.request('/api/v1/test/data', {
        headers: { 'host': 'localhost' }
      });

      // 基于回退键限流
      expect(response.status).toBe(429);
    });
  });

  describe('不同端点独立限流', () => {
    it('应该对不同路径使用独立的限流计数器', async () => {
      const app = new Hono();

      // 认证端点限流
      const authLimiter = createRateLimiter({
        maxRequests: 5,
        windowMs: 60000,
        keyPrefix: 'auth',
        store: testStore,
        getTime: mockTimeImpl
      });
      app.use('/api/v1/auth/*', authLimiter);
      app.post('/api/v1/auth/login', (c) => c.json({ token: 'xxx' }));

      // API 端点限流
      const apiLimiter = createRateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'api',
        store: testStore,
        getTime: mockTimeImpl
      });
      app.use('/api/v1/analytics/*', apiLimiter);
      app.get('/api/v1/analytics/data', (c) => c.json({ metrics: [] }));

      // 使用认证端点直到限流
      for (let i = 0; i < 6; i++) {
        const response = await app.request('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': '10.10.10.10' }
        });
        if (i < 5) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
        }
      }

      // API 端点应该仍然可用（独立计数）
      const apiResponse = await app.request('/api/v1/analytics/data', {
        headers: { 'x-forwarded-for': '10.10.10.10' }
      });
      expect(apiResponse.status).toBe(200);
    });
  });

  describe('响应头信息', () => {
    it('应该包含速率限制信息头', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'headers-test',
        store: testStore,
        getTime: mockTimeImpl,
        skipSuccessfulRequests: false
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/data/*', limiter);
      app.get('/api/v1/data/info', (c) => c.json({ info: 'data' }));

      const response = await app.request('/api/v1/data/info', {
        headers: { 'x-forwarded-for': '1.1.1.1' }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('9');
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('应该在成功请求后更新剩余计数', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'remaining-test',
        store: testStore,
        getTime: mockTimeImpl,
        skipSuccessfulRequests: false
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/data/*', limiter);
      app.get('/api/v1/data/info', (c) => c.json({ info: 'data' }));

      // 第一次请求
      let response = await app.request('/api/v1/data/info', {
        headers: { 'x-forwarded-for': '2.2.2.2' }
      });
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('9');

      // 第二次请求
      response = await app.request('/api/v1/data/info', {
        headers: { 'x-forwarded-for': '2.2.2.2' }
      });
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('8');
    });
  });

  describe('错误处理', () => {
    it('应该处理存储故障（优雅降级）', async () => {
      const app = new Hono();

      class FaultyStore {
        private shouldFail = false;

        setShouldFail(fail: boolean): void {
          this.shouldFail = fail;
        }

        get(): RateLimitEntry | undefined {
          if (this.shouldFail) {
            throw new Error('Store connection failed');
          }
          return undefined;
        }

        increment(): RateLimitEntry {
          if (this.shouldFail) {
            throw new Error('Store connection failed');
          }
          return { count: 1, resetAt: mockTime + 60000 };
        }

        reset(): void {}
        size(): number { return 0; }
      }

      const faultyStore = new FaultyStore() as any;

      const config: RateLimiterConfig = {
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'faulty',
        store: faultyStore,
        getTime: mockTimeImpl,
        skipFailedRequestsWhenError: true // 发生错误时跳过限流（优雅降级）
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/test/*', limiter);
      app.get('/api/v1/test/data', (c) => c.json({ data: 'test' }));

      // 正常工作
      let response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '3.3.3.3' }
      });
      expect(response.status).toBe(200);

      // 触发故障
      (faultyStore as any).setShouldFail(true);

      // 应该优雅降级（允许请求通过）
      response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '3.3.3.3' }
      });
      expect(response.status).toBe(200);
    });
  });

  describe('滑动窗口算法', () => {
    it('应该使用滑动窗口而非固定窗口', async () => {
      const app = new Hono();

      // 使用更小的窗口和限制来测试滑动窗口
      const config: RateLimiterConfig = {
        maxRequests: 5,
        windowMs: 5000, // 5 秒窗口
        keyPrefix: 'sliding',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/test/*', limiter);
      app.get('/api/v1/test/data', (c) => c.json({ ok: true }));

      // 在 t=0 时发送 5 次请求
      for (let i = 0; i < 5; i++) {
        const response = await app.request('/api/v1/test/data', {
          headers: { 'x-forwarded-for': '4.4.4.4' }
        });
        expect(response.status).toBe(200);
      }

      // 应该被限流
      let response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '4.4.4.4' }
      });
      expect(response.status).toBe(429);

      // 前进 2.5 秒（窗口的一半）
      advanceTime(2500);

      // 仍然应该被限流（窗口未过期）
      response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '4.4.4.4' }
      });
      expect(response.status).toBe(429);

      // 前进到窗口过期
      advanceTime(3000);

      // 现在应该允许新请求
      response = await app.request('/api/v1/test/data', {
        headers: { 'x-forwarded-for': '4.4.4.4' }
      });
      expect(response.status).toBe(200);
    });
  });

  describe('性能优化', () => {
    it('应该高效处理大量请求', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 1000,
        windowMs: 60000,
        keyPrefix: 'perf',
        store: testStore,
        getTime: mockTimeImpl
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/test/*', limiter);
      app.get('/api/v1/test/data', (c) => c.json({ ok: true }));

      const startTime = Date.now();

      // 发送 500 次请求
      const promises = [];
      for (let i = 0; i < 500; i++) {
        // 使用不同 IP 来避免限流
        const ip = `10.${Math.floor(i / 256)}.${i % 256}.1`;
        promises.push(
          app.request('/api/v1/test/data', {
            headers: { 'x-forwarded-for': ip }
          })
        );
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // 所有请求应该成功
      expect(results.every(r => r.status === 200)).toBe(true);

      // 性能检查：500 个独立 IP 的请求应该很快
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('特殊 IP 豁免', () => {
    it('应该支持白名单 IP（不受限流限制）', async () => {
      const app = new Hono();
      const config: RateLimiterConfig = {
        maxRequests: 3,
        windowMs: 60000,
        keyPrefix: 'whitelist',
        store: testStore,
        getTime: mockTimeImpl,
        whitelist: ['127.0.0.1', '::1'] // 本地地址豁免
      };

      const limiter = createRateLimiter(config);
      app.use('/api/v1/test/*', limiter);
      app.get('/api/v1/test/data', (c) => c.json({ ok: true }));

      // 白名单 IP 应该不受限制
      for (let i = 0; i < 10; i++) {
        const response = await app.request('/api/v1/test/data', {
          headers: { 'x-forwarded-for': '127.0.0.1' }
        });
        expect(response.status).toBe(200);
      }

      // 非白名单 IP 应该受限制
      for (let i = 0; i < 4; i++) {
        const response = await app.request('/api/v1/test/data', {
          headers: { 'x-forwarded-for': '8.8.8.8' }
        });
        if (i < 3) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
        }
      }
    });
  });
});

/**
 * 导出类型供其他测试使用
 */
export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export { TestStore };
