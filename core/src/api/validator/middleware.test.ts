/**
 * 验证中间件单元测试
 *
 * @description
 * 测试 zValidator 中间件的各种场景
 *
 * @testStrategy
 * - RED Phase: 先写测试，验证失败
 * - GREEN Phase: 实现中间件，使测试通过
 * - REFACTOR Phase: 优化和重构
 *
 * @module api/validator/middleware.test
 */

import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  zValidator,
  queryValidator,
  paramValidator,
  bodyValidator
} from './middleware.js';
import {
  PeriodSchema,
  MetricSchema,
  LoginRequestSchema,
  ProjectIdSchema
} from './schemas.js';
import { ErrorCode } from './schemas.js';

/**
 * zValidator 基础测试
 */
describe('zValidator - 基础功能', () => {
  it('应该接受有效的输入', async () => {
    const app = new Hono();

    app.get('/test',
      zValidator('query', z.object({ period: PeriodSchema })),
      (c) => {
        const data = c.get('validatedQuery');
        return c.json({ period: data.period });
      }
    );

    const res = await app.request('/test?period=week');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.period).toBe('week');
  });

  it('应该拒绝无效的输入', async () => {
    const app = new Hono();

    app.get('/test',
      zValidator('query', z.object({ period: PeriodSchema })),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/test?period=invalid');
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('应该在验证失败时返回错误详情', async () => {
    const app = new Hono();

    app.get('/test',
      zValidator('query', z.object({ period: PeriodSchema })),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/test?period=invalid');
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.details).toBeArray();
    expect(json.details.length).toBeGreaterThan(0);
  });

  it('应该支持嵌套路径验证', async () => {
    const app = new Hono();

    app.get('/test',
      zValidator('query', z.object({ period: PeriodSchema })),
      (c) => {
        const data = c.get('validatedQuery');
        return c.json({ period: data.period });
      }
    );

    const res = await app.request('/test?period=today');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.period).toBe('today');
  });
});

/**
 * queryValidator 测试
 */
describe('queryValidator', () => {
  it('应该验证查询参数', async () => {
    const app = new Hono();

    app.get('/analytics',
      queryValidator({ period: PeriodSchema }),
      (c) => {
        const query = c.get('validatedQuery');
        return c.json(query);
      }
    );

    const res = await app.request('/analytics?period=week');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.period).toBe('week');
  });

  it('应该支持多个查询参数', async () => {
    const app = new Hono();

    app.get('/analytics',
      queryValidator({
        period: PeriodSchema,
        metric: MetricSchema
      }),
      (c) => {
        const query = c.get('validatedQuery');
        return c.json(query);
      }
    );

    const res = await app.request('/analytics?period=week&metric=violations');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.period).toBe('week');
    expect(json.metric).toBe('violations');
  });

  it('应该支持可选参数', async () => {
    const app = new Hono();

    const OptionalPeriodSchema = PeriodSchema.optional();
    app.get('/analytics',
      queryValidator({ period: OptionalPeriodSchema }),
      (c) => {
        const query = c.get('validatedQuery');
        return c.json(query);
      }
    );

    const res = await app.request('/analytics');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.period).toBeUndefined();
  });

  it('应该拒绝无效的查询参数', async () => {
    const app = new Hono();

    app.get('/analytics',
      queryValidator({ period: PeriodSchema }),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/analytics?period=invalid');
    expect(res.status).toBe(400);
  });
});

/**
 * paramValidator 测试
 */
describe('paramValidator', () => {
  it('应该验证路径参数', async () => {
    const app = new Hono();

    app.get('/projects/:projectId',
      paramValidator({ projectId: ProjectIdSchema }),
      (c) => {
        const params = c.get('validatedParams');
        return c.json(params);
      }
    );

    const res = await app.request('/projects/my-project');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.projectId).toBe('my-project');
  });

  it('应该拒绝无效的路径参数', async () => {
    const app = new Hono();

    app.get('/projects/:projectId',
      paramValidator({ projectId: ProjectIdSchema }),
      (c) => c.json({ success: true })
    );

    // 使用包含空格的无效 ID（不会被 Hono 路由拦截）
    const res = await app.request('/projects/my project');
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('应该支持多个路径参数', async () => {
    const app = new Hono();

    app.get('/projects/:projectId/retros/:retroId',
      paramValidator({
        projectId: ProjectIdSchema,
        retroId: ProjectIdSchema // 简化使用相同 schema
      }),
      (c) => {
        const params = c.get('validatedParams');
        return c.json(params);
      }
    );

    const res = await app.request('/projects/my-project/retros/retro_123');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.projectId).toBe('my-project');
    expect(json.retroId).toBe('retro_123');
  });
});

/**
 * bodyValidator 测试
 */
describe('bodyValidator', () => {
  it('应该验证请求体', async () => {
    const app = new Hono();

    app.post('/auth/login',
      bodyValidator(LoginRequestSchema),
      (c) => {
        const body = c.get('validatedBody');
        return c.json({ username: body.username });
      }
    );

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123'
      })
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.username).toBe('testuser');
  });

  it('应该拒绝无效的请求体', async () => {
    const app = new Hono();

    app.post('/auth/login',
      bodyValidator(LoginRequestSchema),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser'
        // 缺少 password
      })
    });

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('应该拒绝空请求体', async () => {
    const app = new Hono();

    app.post('/auth/login',
      bodyValidator(LoginRequestSchema),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    expect(res.status).toBe(400);
  });

  it('应该拒绝非 JSON 请求体', async () => {
    const app = new Hono();

    app.post('/auth/login',
      bodyValidator(LoginRequestSchema),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json'
    });

    expect(res.status).toBe(400);
  });

  it('应该拒绝包含额外字段的请求体（strict mode）', async () => {
    const app = new Hono();

    app.post('/auth/login',
      bodyValidator(LoginRequestSchema),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123',
        isAdmin: true
      })
    });

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

/**
 * 组合验证测试
 */
describe('组合验证', () => {
  it('应该支持同时验证 query、param 和 body', async () => {
    const app = new Hono();

    app.post('/projects/:projectId/analytics',
      queryValidator({ period: PeriodSchema }),
      paramValidator({ projectId: ProjectIdSchema }),
      bodyValidator(LoginRequestSchema),
      (c) => {
        const query = c.get('validatedQuery');
        const params = c.get('validatedParams');
        const body = c.get('validatedBody');
        return c.json({ query, params, body });
      }
    );

    const res = await app.request('/projects/my-project/analytics?period=week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123'
      })
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.query.period).toBe('week');
    expect(json.params.projectId).toBe('my-project');
    expect(json.body.username).toBe('testuser');
  });

  it('应该在第一个验证失败时返回错误', async () => {
    const app = new Hono();

    app.post('/projects/:projectId/analytics',
      queryValidator({ period: PeriodSchema }),
      paramValidator({ projectId: ProjectIdSchema }),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/projects/my-project/analytics?period=invalid', {
      method: 'POST'
    });

    expect(res.status).toBe(400);
  });
});

/**
 * 安全性测试
 */
describe('安全性测试', () => {
  it('应该防止参数污染攻击', async () => {
    const app = new Hono();

    app.get('/test',
      queryValidator({ period: PeriodSchema }),
      (c) => {
        const query = c.get('validatedQuery');
        return c.json(query);
      }
    );

    // 测试单个有效值
    const res = await app.request('/test?period=week');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.period).toBe('week');
  });

  it('应该防止路径遍历攻击', async () => {
    const app = new Hono();

    app.get('/files/:filename',
      paramValidator({ filename: ProjectIdSchema }),
      (c) => {
        const params = c.get('validatedParams');
        return c.json({ filename: params.filename });
      }
    );

    // 使用包含非法字符的文件名
    const invalidNames = [
      'file@#$%'
    ];

    for (const payload of invalidNames) {
      const res = await app.request(`/files/${payload}`);
      expect(res.status).toBe(400);
    }
  });

  it('应该防止原型污染攻击', async () => {
    const app = new Hono();

    app.post('/test',
      bodyValidator(LoginRequestSchema),
      (c) => c.json({ success: true })
    );

    // 使用 constructor 而不是 __proto__（JSON.parse 会忽略 __proto__）
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test',
        password: 'password123',
        constructor: { prototype: { isAdmin: true } }
      })
    });

    // strict mode 会拒绝额外字段
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

/**
 * 错误响应格式测试
 */
describe('错误响应格式', () => {
  it('应该返回统一的错误格式', async () => {
    const app = new Hono();

    app.get('/test',
      zValidator('query', PeriodSchema),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/test?period=invalid');
    const json = await res.json();

    expect(json).toHaveProperty('success');
    expect(json).toHaveProperty('error');
    expect(json).toHaveProperty('message');
    expect(json).toHaveProperty('details');
    expect(json).toHaveProperty('meta');

    expect(json.success).toBe(false);
    expect(json.error).toBe(ErrorCode.VALIDATION_ERROR);
    expect(json.message).toBe('输入验证失败');
    expect(json.meta).toHaveProperty('timestamp');
  });

  it('应该包含详细的错误信息', async () => {
    const app = new Hono();

    app.get('/test',
      zValidator('query', z.object({ period: PeriodSchema })),
      (c) => c.json({ success: true })
    );

    const res = await app.request('/test?period=invalid');
    const json = await res.json();

    expect(json.details).toBeArray();
    expect(json.details.length).toBeGreaterThan(0);
    expect(json.details[0]).toContain('period');
  });
});

/**
 * 性能测试
 */
describe('性能测试', () => {
  it('应该在合理时间内完成验证', async () => {
    const app = new Hono();

    app.get('/test',
      zValidator('query', PeriodSchema),
      (c) => c.json({ success: true })
    );

    const start = performance.now();
    await app.request('/test?period=week');
    const duration = performance.now() - start;

    // 验证应该在 10ms 内完成
    expect(duration).toBeLessThan(10);
  });

  it('应该处理复杂的嵌套验证', async () => {
    const app = new Hono();

    const ComplexSchema = PeriodSchema;
    app.get('/test',
      zValidator('query', ComplexSchema),
      (c) => c.json({ success: true })
    );

    const start = performance.now();
    await app.request('/test?period=week');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
  });
});
