/**
 * 增强型速率限制中间件测试
 *
 * @description
 * Task #13: 速率限制优化
 * 测试分层限流（IP、用户、端点）和事件日志
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import {
  createEnhancedRateLimiter,
  createEnhancedAuthLimiter,
  createEnhancedApiLimiter,
  EnhancedRateLimitPresets,
  RateLimitEventCollector
} from '../../../api/middleware/rateLimitEnhanced.js';

describe('Task #13: 速率限制优化', () => {
  describe('增强型速率限制中间件', () => {
    it('应该限制 IP 级别的请求', async () => {
      const app = new Hono();
      const collector = new RateLimitEventCollector();

      app.use('*', createEnhancedRateLimiter({
        maxRequests: 5,
        windowMs: 1000,
        keyPrefix: 'test',
        onRateLimit: collector.createListener()
      }));

      app.get('/', (c) => c.json({ success: true }));

      // 前 5 个请求应该成功
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/');
        expect(res.status).toBe(200);
      }

      // 第 6 个请求应该被限流
      const res = await app.request('/');
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Too Many Requests');
    });

    it('应该记录速率限制事件', async () => {
      const app = new Hono();
      const collector = new RateLimitEventCollector();

      app.use('*', createEnhancedRateLimiter({
        maxRequests: 2,
        windowMs: 1000,
        keyPrefix: 'test',
        onRateLimit: collector.createListener()
      }));

      app.get('/', (c) => c.json({ success: true }));

      // 发送请求
      await app.request('/');
      await app.request('/');
      await app.request('/');

      const events = collector.getEvents();
      expect(events.length).toBe(3);
      expect(events[2].blocked).toBe(true);
    });

    it('应该支持 IP 白名单', async () => {
      const app = new Hono();
      const collector = new RateLimitEventCollector();

      app.use('*', createEnhancedRateLimiter({
        maxRequests: 2,
        windowMs: 1000,
        keyPrefix: 'test',
        whitelist: ['127.0.0.1'],
        onRateLimit: collector.createListener()
      }));

      app.get('/', (c) => c.json({ success: true }));

      // 本地请求应该不受限
      for (let i = 0; i < 10; i++) {
        const res = await app.request('/', {
          headers: { 'X-Forwarded-For': '127.0.0.1' }
        });
        expect(res.status).toBe(200);
      }

      // 检查白名单标记
      const res = await app.request('/', {
        headers: { 'X-Forwarded-For': '127.0.0.1' }
      });
      expect(res.headers.get('X-RateLimit-Whitelisted')).toBe('true');
    });

    it('应该正确设置响应头', async () => {
      const app = new Hono();

      app.use('*', createEnhancedRateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'test'
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/');

      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
      expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull();
    });
  });

  describe('用户级别限流', () => {
    it('应该支持用户级别限流', async () => {
      const app = new Hono();

      // 模拟认证中间件 - 必须在限流中间件之前
      app.use('*', async (c, next) => {
        c.set('user', { sub: 'user123', username: 'test' });
        await next();
      });

      // 设置更高的 IP 限制，确保用户限制先触发
      app.use('*', createEnhancedRateLimiter({
        maxRequests: 100,  // IP 限制很高
        windowMs: 1000,
        keyPrefix: 'test',
        enableUserRateLimit: true,
        maxUserRequests: 3  // 用户限制较低
      }));

      app.get('/', (c) => c.json({ success: true }));

      // 用户限制是 3
      // 前 3 个请求应该成功
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/');
        expect(res.status).toBe(200);
      }

      // 第 4 个请求应该被用户限流阻止
      const res = await app.request('/');
      expect(res.status).toBe(429);
    });

    it('应该显示用户级别限流信息', async () => {
      const app = new Hono();

      // 认证中间件必须在限流中间件之前
      app.use('*', async (c, next) => {
        c.set('user', { sub: 'user123' });
        await next();
      });

      app.use('*', createEnhancedRateLimiter({
        maxRequests: 10,
        windowMs: 1000,
        keyPrefix: 'test',
        enableUserRateLimit: true,
        maxUserRequests: 20
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/');

      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(res.headers.get('X-RateLimit-Limit-User')).toBe('20');
      expect(res.headers.get('X-RateLimit-Remaining-User')).not.toBeNull();
    });
  });

  describe('预定义配置', () => {
    it('应该提供认证端点限流配置', () => {
      expect(EnhancedRateLimitPresets.auth.maxRequests).toBe(10);
      expect(EnhancedRateLimitPresets.auth.keyPrefix).toBe('auth');
    });

    it('应该提供 API 端点限流配置', () => {
      expect(EnhancedRateLimitPresets.api.maxRequests).toBe(100);
      expect(EnhancedRateLimitPresets.api.enableUserRateLimit).toBe(true);
      expect(EnhancedRateLimitPresets.api.maxUserRequests).toBe(200);
    });

    it('应该提供公开端点限流配置', () => {
      expect(EnhancedRateLimitPresets.public.maxRequests).toBe(50);
    });

    it('应该提供严格限流配置', () => {
      expect(EnhancedRateLimitPresets.strict.maxRequests).toBe(5);
      expect(EnhancedRateLimitPresets.strict.windowMs).toBe(60000);
    });
  });

  describe('便捷工厂函数', () => {
    it('应该创建认证端点限流器', async () => {
      const app = new Hono();

      app.use('*', createEnhancedAuthLimiter());
      app.get('/', (c) => c.json({ success: true }));

      // 前 10 个请求应该成功
      for (let i = 0; i < 10; i++) {
        const res = await app.request('/');
        expect(res.status).toBe(200);
      }

      // 第 11 个应该被限流
      const res = await app.request('/');
      expect(res.status).toBe(429);
    });

    it('应该创建 API 端点限流器', async () => {
      const app = new Hono();

      app.use('*', createEnhancedApiLimiter());
      app.get('/', (c) => c.json({ success: true }));

      // 应该支持用户限流
      expect(() => {
        createEnhancedApiLimiter();
      }).not.toThrow();
    });
  });

  describe('事件收集器', () => {
    let collector: RateLimitEventCollector;

    beforeEach(() => {
      collector = new RateLimitEventCollector();
    });

    it('应该收集事件', () => {
      const listener = collector.createListener();

      listener({
        timestamp: Date.now(),
        ip: '127.0.0.1',
        path: '/test',
        method: 'GET',
        blocked: false,
        count: 1,
        limit: 10,
        keyPrefix: 'test'
      });

      expect(collector.getEvents().length).toBe(1);
    });

    it('应该只收集被阻止的事件', () => {
      const listener = collector.createListener();

      listener({
        timestamp: Date.now(),
        ip: '127.0.0.1',
        path: '/test',
        method: 'GET',
        blocked: false,
        count: 1,
        limit: 10,
        keyPrefix: 'test'
      });

      listener({
        timestamp: Date.now(),
        ip: '127.0.0.2',
        path: '/test',
        method: 'GET',
        blocked: true,
        count: 11,
        limit: 10,
        keyPrefix: 'test'
      });

      const blockedEvents = collector.getBlockedEvents();
      expect(blockedEvents.length).toBe(1);
      expect(blockedEvents[0].blocked).toBe(true);
    });

    it('应该按 IP 统计', () => {
      const listener = collector.createListener();

      listener({
        timestamp: Date.now(),
        ip: '127.0.0.1',
        path: '/test',
        method: 'GET',
        blocked: false,
        count: 1,
        limit: 10,
        keyPrefix: 'test'
      });

      listener({
        timestamp: Date.now(),
        ip: '127.0.0.1',
        path: '/test',
        method: 'GET',
        blocked: true,
        count: 11,
        limit: 10,
        keyPrefix: 'test'
      });

      listener({
        timestamp: Date.now(),
        ip: '127.0.0.2',
        path: '/test',
        method: 'GET',
        blocked: false,
        count: 1,
        limit: 10,
        keyPrefix: 'test'
      });

      const stats = collector.getStatsByIp();
      expect(stats.get('127.0.0.1')?.total).toBe(2);
      expect(stats.get('127.0.0.1')?.blocked).toBe(1);
      expect(stats.get('127.0.0.2')?.total).toBe(1);
    });

    it('应该限制最大事件数量', () => {
      collector = new RateLimitEventCollector(5);
      const listener = collector.createListener();

      for (let i = 0; i < 10; i++) {
        listener({
          timestamp: Date.now(),
          ip: `127.0.0.${i}`,
          path: '/test',
          method: 'GET',
          blocked: false,
          count: 1,
          limit: 10,
          keyPrefix: 'test'
        });
      }

      // 应该只保留最近的 5 个事件
      expect(collector.getEvents().length).toBe(5);
    });

    it('应该能够清空事件', () => {
      const listener = collector.createListener();

      listener({
        timestamp: Date.now(),
        ip: '127.0.0.1',
        path: '/test',
        method: 'GET',
        blocked: true,
        count: 11,
        limit: 10,
        keyPrefix: 'test'
      });

      expect(collector.getEvents().length).toBe(1);

      collector.clear();
      expect(collector.getEvents().length).toBe(0);
    });
  });

  describe('边界条件', () => {
    it('应该处理窗口过期', async () => {
      const app = new Hono();

      app.use('*', createEnhancedRateLimiter({
        maxRequests: 2,
        windowMs: 100,
        keyPrefix: 'test'
      }));

      app.get('/', (c) => c.json({ success: true }));

      // 用完限额
      await app.request('/');
      await app.request('/');

      let res = await app.request('/');
      expect(res.status).toBe(429);

      // 等待窗口过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 新的请求应该成功
      res = await app.request('/');
      expect(res.status).toBe(200);
    });
  });
});
