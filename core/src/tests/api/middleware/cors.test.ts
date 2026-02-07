/**
 * CORS 安全中间件测试
 *
 * @description
 * Task #16: CORS 配置完善
 * 测试 CORS 中间件的安全配置
 *
 * @testCoverage
 * - 白名单验证
 * - 预检缓存时间
 * - 凭证支持
 * - 开发/生产环境差异
 */

import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import {
  createCORSMiddleware,
  createDevCORSMiddleware,
  createProdCORSMiddleware,
  validateOrigin,
  type CORSConfig
} from '../../../api/middleware/cors.js';

describe('Task #16: CORS 配置完善', () => {
  describe('白名单验证', () => {
    it('应该拒绝不在白名单中的来源', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com'],
        environment: 'production'
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        headers: { Origin: 'https://evil.com' }
      });

      // 预检请求应该返回 403
      const optionsRes = await app.request('/', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      expect(optionsRes.status).toBe(403);
    });

    it('应该允许白名单中的来源', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com'],
        environment: 'production'
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        headers: { Origin: 'https://example.com' }
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('应该拒绝通配符来源', async () => {
      const isValid = validateOrigin('*');
      expect(isValid).toBe(false);
    });

    it('应该拒绝 null 来源', async () => {
      const isValid = validateOrigin('null');
      expect(isValid).toBe(false);
    });

    it('应该拒绝非 HTTP/HTTPS 协议', async () => {
      const isValid = validateOrigin('file:///etc/passwd');
      expect(isValid).toBe(false);
    });
  });

  describe('预检缓存时间', () => {
    it('应该使用 10 分钟的默认缓存时间', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com']
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      const maxAge = res.headers.get('Access-Control-Max-Age');
      expect(maxAge).toBe('600'); // 10 分钟 = 600 秒
    });

    it('应该支持自定义缓存时间', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com'],
        maxAge: 300 // 5 分钟
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      expect(res.headers.get('Access-Control-Max-Age')).toBe('300');
    });
  });

  describe('凭证支持', () => {
    it('应该默认允许凭证', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com']
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        headers: { Origin: 'https://example.com' }
      });

      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('应该支持禁用凭证', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com'],
        allowCredentials: false
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        headers: { Origin: 'https://example.com' }
      });

      expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });
  });

  describe('环境差异', () => {
    it('生产环境应该严格验证', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        environment: 'production',
        allowedOrigins: ['https://example.com']
      }));

      app.get('/', (c) => c.json({ success: true }));

      // 本地地址应该被拒绝
      const res = await app.request('/', {
        headers: { Origin: 'http://localhost:3000' }
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('开发环境应该允许 localhost', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        environment: 'development'
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        headers: { Origin: 'http://localhost:3000' }
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('开发环境应该动态添加新端口', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        environment: 'development'
      }));

      app.get('/', (c) => c.json({ success: true }));

      // 非预定义的本地端口
      const res = await app.request('/', {
        headers: { Origin: 'http://localhost:9999' }
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:9999');
    });
  });

  describe('便捷函数', () => {
    it('createDevCORSMiddleware 应该创建开发配置', async () => {
      const app = new Hono();

      app.use('*', createDevCORSMiddleware());
      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        headers: { Origin: 'http://localhost:3000' }
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('createProdCORSMiddleware 应该创建生产配置', async () => {
      const app = new Hono();

      app.use('*', createProdCORSMiddleware(['https://example.com']));
      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        headers: { Origin: 'https://example.com' }
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('createProdCORSMiddleware 应该拒绝空白名单', () => {
      expect(() => {
        createProdCORSMiddleware([]);
      }).toThrow();
    });
  });

  describe('预检请求处理', () => {
    it('应该正确处理预检请求', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com'],
        allowMethods: ['GET', 'POST', 'PUT'],
        allowHeaders: ['Content-Type', 'Authorization']
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT');
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      expect(res.headers.get('Access-Control-Max-Age')).toBe('600');
    });

    it('应该拒绝未授权的预检请求', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com']
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Vary 头', () => {
    it('应该设置 Vary: Origin 头', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com']
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/', {
        headers: { Origin: 'https://example.com' }
      });

      expect(res.headers.get('Vary')).toBe('Origin');
    });
  });

  describe('边界条件', () => {
    it('应该处理没有 Origin 头的请求', async () => {
      const app = new Hono();

      app.use('*', createCORSMiddleware({
        allowedOrigins: ['https://example.com']
      }));

      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/');

      // 没有 Origin 头的请求应该直接通过（非跨域）
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('应该处理多个来源', async () => {
      const origins = ['https://example.com', 'https://app.example.com', 'https://api.example.com'];
      const config: CORSConfig = {
        allowedOrigins: origins,
        environment: 'production'
      };

      for (const origin of origins) {
        const isValid = validateOrigin(origin, config);
        expect(isValid).toBe(true);
      }

      // 不在列表中的来源应该被拒绝
      const isValid = validateOrigin('https://evil.com', config);
      expect(isValid).toBe(false);
    });
  });
});
