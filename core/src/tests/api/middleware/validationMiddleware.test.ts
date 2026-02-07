/**
 * 验证中间件测试
 *
 * @description
 * 测试 API 验证中间件的功能
 *
 * @test_coverage
 * - validateBody 中间件
 * - 无效输入返回 400 错误
 * - 有效输入通过验证
 * - 统一错误格式 (ERR_1001)
 *
 * @module tests/api/middleware/validationMiddleware.test
 */

import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { z } from 'zod';
import { bodyValidator, queryValidator, paramValidator } from '../../../api/validator/index.js';
import { ErrorCode } from '../../../api/validator/schemas.js';

describe('验证中间件', () => {
  describe('bodyValidator', () => {
    it('应该接受有效的请求体', async () => {
      const app = new Hono();

      const TestSchema = z.object({
        name: z.string().min(1),
        age: z.number().min(0)
      });

      app.post('/test',
        bodyValidator(TestSchema),
        (c) => {
          const body = c.get('validatedBody');
          return c.json({ success: true, data: body });
        }
      );

      const response = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', age: 30 })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Alice');
      expect(data.data.age).toBe(30);
    });

    it('应该拒绝无效的请求体并返回400', async () => {
      const app = new Hono();

      const TestSchema = z.object({
        name: z.string().min(1),
        age: z.number().min(0)
      });

      app.post('/test',
        bodyValidator(TestSchema),
        (c) => c.json({ success: true })
      );

      // 缺少必填字段
      const response = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }) // 缺少 age
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe(ErrorCode.VALIDATION_ERROR);
      expect(data.details).toBeArray();
      expect(data.details.length).toBeGreaterThan(0);
    });

    it('应该拒绝无效的数据类型', async () => {
      const app = new Hono();

      const TestSchema = z.object({
        name: z.string(),
        count: z.number()
      });

      app.post('/test',
        bodyValidator(TestSchema),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', count: 'not-a-number' })
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('应该拒绝空字符串', async () => {
      const app = new Hono();

      const TestSchema = z.object({
        name: z.string().min(1)
      });

      app.post('/test',
        bodyValidator(TestSchema),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' })
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝无效的JSON格式', async () => {
      const app = new Hono();

      const TestSchema = z.object({
        name: z.string()
      });

      app.post('/test',
        bodyValidator(TestSchema),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}'
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝额外的字段（strict模式）', async () => {
      const app = new Hono();

      const TestSchema = z.object({
        name: z.string()
      }).strict();

      app.post('/test',
        bodyValidator(TestSchema),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', extra: 'field' })
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('queryValidator', () => {
    it('应该接受有效的查询参数', async () => {
      const app = new Hono();

      app.get('/test',
        queryValidator({
          period: z.enum(['today', 'week', 'month']),
          limit: z.coerce.number().min(1).max(100)
        }),
        (c) => {
          const query = c.get('validatedQuery');
          return c.json({ success: true, data: query });
        }
      );

      const response = await app.request('/test?period=week&limit=10');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.period).toBe('week');
      expect(data.data.limit).toBe(10);
    });

    it('应该拒绝无效的查询参数', async () => {
      const app = new Hono();

      app.get('/test',
        queryValidator({
          period: z.enum(['today', 'week', 'month'])
        }),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test?period=invalid');

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('应该处理可选参数', async () => {
      const app = new Hono();

      app.get('/test',
        queryValidator({
          required: z.string(),
          optional: z.string().optional()
        }),
        (c) => {
          const query = c.get('validatedQuery');
          return c.json({ success: true, data: query });
        }
      );

      const response = await app.request('/test?required=value');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.required).toBe('value');
      expect(data.data.optional).toBeUndefined();
    });

    it('应该拒绝超出范围的数字', async () => {
      const app = new Hono();

      app.get('/test',
        queryValidator({
          limit: z.coerce.number().min(1).max(100)
        }),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test?limit=999');

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('paramValidator', () => {
    it('应该接受有效的路径参数', async () => {
      const app = new Hono();

      app.get('/test/:id',
        paramValidator({
          id: z.string().uuid()
        }),
        (c) => {
          const params = c.get('validatedParams');
          return c.json({ success: true, data: params });
        }
      );

      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await app.request(`/test/${uuid}`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(uuid);
    });

    it('应该拒绝无效的路径参数', async () => {
      const app = new Hono();

      app.get('/test/:id',
        paramValidator({
          id: z.string().uuid()
        }),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test/not-a-uuid');

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('应该防止路径遍历攻击', async () => {
      const app = new Hono();

      const SafeIdSchema = z.string().refine(
        (val) => !val.includes('..') && !val.includes('/') && !val.includes('\\'),
        { message: 'ID包含非法字符' }
      );

      app.get('/test/:id',
        paramValidator({ id: SafeIdSchema }),
        (c) => c.json({ success: true })
      );

      // Hono 会自动处理包含 .. 的路径参数，返回 404
      // 这是一种安全行为，可以防止路径遍历
      const response = await app.request('/test/../../../etc/passwd');

      // Hono 在路由匹配阶段就拒绝了这种路径
      expect(response.status).toBe(404);

      // 测试包含斜杠的路径（编码后的）
      const response2 = await app.request('/test/test%2Fpath');
      expect(response2.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('错误格式', () => {
    it('应该返回统一的错误格式', async () => {
      const app = new Hono();

      const TestSchema = z.object({
        name: z.string().min(3),
        email: z.string().email()
      });

      app.post('/test',
        bodyValidator(TestSchema),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'ab', email: 'invalid' })
      });

      const data = await response.json();

      // 验证错误响应结构
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error', ErrorCode.VALIDATION_ERROR);
      expect(data).toHaveProperty('details');
      expect(data).toHaveProperty('meta');
      expect(data.meta).toHaveProperty('timestamp');

      // 验证详情是数组
      expect(Array.isArray(data.details)).toBe(true);
      expect(data.details.length).toBeGreaterThan(0);
    });

    it('应该包含字段路径在错误详情中', async () => {
      const app = new Hono();

      const TestSchema = z.object({
        user: z.object({
          name: z.string().min(3),
          email: z.string().email()
        })
      });

      app.post('/test',
        bodyValidator(TestSchema),
        (c) => c.json({ success: true })
      );

      const response = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { name: 'ab', email: 'bad' } })
      });

      const data = await response.json();

      // 验证错误包含字段路径
      expect(data.details.some((d: string) => d.includes('user'))).toBe(true);
    });
  });

  describe('组合验证', () => {
    it('应该支持多个验证中间件串联', async () => {
      const app = new Hono();

      app.get('/test/:id',
        paramValidator({ id: z.string().uuid() }),
        queryValidator({ format: z.enum(['json', 'xml']) }),
        (c) => {
          const params = c.get('validatedParams');
          const query = c.get('validatedQuery');
          return c.json({ success: true, params, query });
        }
      );

      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await app.request(`/test/${uuid}?format=json`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.params.id).toBe(uuid);
      expect(data.query.format).toBe('json');
    });
  });
});
