/**
 * API 验证 Schema 单元测试
 *
 * @description
 * 测试所有 API 端点的 Zod Schema 验证逻辑
 *
 * @testStrategy
 * - RED Phase: 先写测试，验证失败
 * - GREEN Phase: 实现 Schema，使测试通过
 * - REFACTOR Phase: 优化和重构
 *
 * @module api/validator/schemas.test
 */

import { describe, it, expect } from 'bun:test';
import {
  // 基础 schemas
  NonEmptyStringSchema,
  PositiveIntegerSchema,
  NonNegativeIntegerSchema,
  BoundedIntegerSchema,

  // 时间 period schemas
  PeriodSchema,
  LimitSchema,
  OffsetSchema,
  MetricSchema,

  // Auth schemas
  LoginRequestSchema,
  RefreshTokenRequestSchema,

  // Analytics query schemas
  AnalyticsQuerySchema,

  // Path parameter schemas
  RetroIdSchema,
  ProjectIdSchema,

  // 导出类型
  type LoginRequest,
  type RefreshTokenRequest,
  type AnalyticsQuery,
  type RetroId,
  type ProjectId
} from './schemas.js';

/**
 * 基础 Schema 测试
 */
describe('Validator Schemas - 基础类型', () => {
  describe('NonEmptyStringSchema', () => {
    it('应该接受非空字符串', () => {
      const result = NonEmptyStringSchema.safeParse('hello');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('hello');
      }
    });

    it('应该拒绝空字符串', () => {
      const result = NonEmptyStringSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('应该拒绝只有空格的字符串', () => {
      const result = NonEmptyStringSchema.safeParse('   ');
      expect(result.success).toBe(false);
    });

    it('应该拒绝非字符串类型', () => {
      expect(NonEmptyStringSchema.safeParse(null).success).toBe(false);
      expect(NonEmptyStringSchema.safeParse(undefined).success).toBe(false);
      expect(NonEmptyStringSchema.safeParse(123).success).toBe(false);
      expect(NonEmptyStringSchema.safeParse({}).success).toBe(false);
    });

    it('应该自动 trim 字符串', () => {
      const result = NonEmptyStringSchema.safeParse('  hello  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('hello');
      }
    });

    it('应该限制最大长度', () => {
      const longString = 'a'.repeat(1001);
      const result = NonEmptyStringSchema.safeParse(longString);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1000');
      }
    });
  });

  describe('PositiveIntegerSchema', () => {
    it('应该接受正整数', () => {
      expect(PositiveIntegerSchema.safeParse(1).success).toBe(true);
      expect(PositiveIntegerSchema.safeParse(100).success).toBe(true);
    });

    it('应该拒绝零和负数', () => {
      expect(PositiveIntegerSchema.safeParse(0).success).toBe(false);
      expect(PositiveIntegerSchema.safeParse(-1).success).toBe(false);
    });

    it('应该拒绝非整数', () => {
      expect(PositiveIntegerSchema.safeParse(1.5).success).toBe(false);
      expect(PositiveIntegerSchema.safeParse('1').success).toBe(false);
    });

    it('应该拒绝非数字类型', () => {
      expect(PositiveIntegerSchema.safeParse(null).success).toBe(false);
      expect(PositiveIntegerSchema.safeParse(undefined).success).toBe(false);
      expect(PositiveIntegerSchema.safeParse('abc').success).toBe(false);
    });
  });

  describe('NonNegativeIntegerSchema', () => {
    it('应该接受零和正整数', () => {
      expect(NonNegativeIntegerSchema.safeParse(0).success).toBe(true);
      expect(NonNegativeIntegerSchema.safeParse(1).success).toBe(true);
      expect(NonNegativeIntegerSchema.safeParse(100).success).toBe(true);
    });

    it('应该拒绝负数', () => {
      expect(NonNegativeIntegerSchema.safeParse(-1).success).toBe(false);
    });
  });

  describe('BoundedIntegerSchema', () => {
    const schema = BoundedIntegerSchema(1, 100);

    it('应该接受范围内的整数', () => {
      expect(schema.safeParse(1).success).toBe(true);
      expect(schema.safeParse(50).success).toBe(true);
      expect(schema.safeParse(100).success).toBe(true);
    });

    it('应该拒绝超出范围的整数', () => {
      expect(schema.safeParse(0).success).toBe(false);
      expect(schema.safeParse(101).success).toBe(false);
    });

    it('应该拒绝非整数', () => {
      expect(schema.safeParse(1.5).success).toBe(false);
      expect(schema.safeParse('50').success).toBe(false);
    });
  });
});

/**
 * Period Schema 测试
 */
describe('Validator Schemas - Period', () => {
  const validPeriods = ['today', 'week', 'month', 'year', 'all'];

  describe('PeriodSchema', () => {
    it('应该接受所有有效的时间范围值', () => {
      for (const period of validPeriods) {
        const result = PeriodSchema.safeParse(period);
        expect(result.success).toBe(true);
      }
    });

    it('应该拒绝无效的时间范围值', () => {
      const invalidPeriods = ['invalid', 'daily', 'hourly', '', 'day'];

      for (const period of invalidPeriods) {
        const result = PeriodSchema.safeParse(period);
        expect(result.success).toBe(false);
      }
    });

    it('应该拒绝非字符串类型', () => {
      expect(PeriodSchema.safeParse(123).success).toBe(false);
      expect(PeriodSchema.safeParse(null).success).toBe(false);
      expect(PeriodSchema.safeParse(undefined).success).toBe(false);
    });

    it('应该小写化输入', () => {
      const result = PeriodSchema.safeParse('TODAY');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('today');
      }
    });
  });
});

/**
 * 分页参数 Schema 测试
 */
describe('Validator Schemas - 分页参数', () => {
  describe('LimitSchema', () => {
    it('应该接受默认范围内的 limit', () => {
      expect(LimitSchema.safeParse(10).success).toBe(true);
      expect(LimitSchema.safeParse(50).success).toBe(true);
      expect(LimitSchema.safeParse(100).success).toBe(true);
    });

    it('应该拒绝超出范围的 limit', () => {
      expect(LimitSchema.safeParse(0).success).toBe(false);
      expect(LimitSchema.safeParse(101).success).toBe(false);
      expect(LimitSchema.safeParse(-1).success).toBe(false);
    });

    it('应该有默认值', () => {
      const schema = LimitSchema.withDefault();
      const result = schema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(20);
      }
    });
  });

  describe('OffsetSchema', () => {
    it('应该接受有效的 offset', () => {
      expect(OffsetSchema.safeParse(0).success).toBe(true);
      expect(OffsetSchema.safeParse(10).success).toBe(true);
      expect(OffsetSchema.safeParse(1000).success).toBe(true);
    });

    it('应该拒绝负数 offset', () => {
      expect(OffsetSchema.safeParse(-1).success).toBe(false);
    });
  });
});

/**
 * Metric Schema 测试
 */
describe('Validator Schemas - Metric', () => {
  const validMetrics = [
    'violations',
    'checks',
    'retros',
    'patterns',
    'traps',
    'quality',
    'usage',
    'performance'
  ];

  describe('MetricSchema', () => {
    it('应该接受所有有效的指标名称', () => {
      for (const metric of validMetrics) {
        const result = MetricSchema.safeParse(metric);
        expect(result.success).toBe(true);
      }
    });

    it('应该拒绝无效的指标名称', () => {
      const invalidMetrics = [
        'invalid',
        'Violation',
        'VIOLATIONS',
        '',
        'data',
        '__proto__',
        'constructor'
      ];

      for (const metric of invalidMetrics) {
        const result = MetricSchema.safeParse(metric);
        expect(result.success).toBe(false);
      }
    });

    it('应该防止路径遍历攻击', () => {
      const pathTraversal = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '....//....//etc/passwd',
        'violations/../../etc'
      ];

      for (const payload of pathTraversal) {
        const result = MetricSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });
  });
});

/**
 * Auth Schema 测试
 */
describe('Validator Schemas - Auth', () => {
  describe('LoginRequestSchema', () => {
    const validLogin: LoginRequest = {
      username: 'testuser',
      password: 'password123'
    };

    it('应该接受有效的登录请求', () => {
      const result = LoginRequestSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('应该拒绝缺少字段的请求', () => {
      expect(LoginRequestSchema.safeParse({}).success).toBe(false);
      expect(LoginRequestSchema.safeParse({ username: 'test' }).success).toBe(false);
      expect(LoginRequestSchema.safeParse({ password: 'pass' }).success).toBe(false);
    });

    it('应该拒绝空的用户名或密码', () => {
      expect(LoginRequestSchema.safeParse({ username: '', password: 'pass' }).success).toBe(false);
      expect(LoginRequestSchema.safeParse({ username: 'test', password: '' }).success).toBe(false);
      expect(LoginRequestSchema.safeParse({ username: '   ', password: 'pass' }).success).toBe(false);
    });

    it('应该限制用户名长度', () => {
      const longUsername = 'a'.repeat(51);
      expect(LoginRequestSchema.safeParse({
        username: longUsername,
        password: 'password123'
      }).success).toBe(false);
    });

    it('应该限制密码长度', () => {
      const shortPassword = 'abc';
      const longPassword = 'a'.repeat(101);

      expect(LoginRequestSchema.safeParse({
        username: 'test',
        password: shortPassword
      }).success).toBe(false);

      expect(LoginRequestSchema.safeParse({
        username: 'test',
        password: longPassword
      }).success).toBe(false);
    });

    it('应该拒绝额外字段', () => {
      const result = LoginRequestSchema.safeParse({
        username: 'test',
        password: 'password123',
        isAdmin: true,
        __proto__: 'pollution'
      } as any);

      // strict mode 拒绝额外字段
      expect(result.success).toBe(false);
    });

    it('应该验证用户名格式（只允许字母数字和特定符号）', () => {
      const invalidUsernames = [
        'user@name',
        'user#name',
        'user name',
        'user$name',
        '../../etc/passwd'
      ];

      for (const username of invalidUsernames) {
        expect(LoginRequestSchema.safeParse({
          username,
          password: 'password123'
        }).success).toBe(false);
      }
    });
  });

  describe('RefreshTokenRequestSchema', () => {
    const validRefresh: RefreshTokenRequest = {
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    };

    it('应该接受有效的刷新 Token 请求', () => {
      const result = RefreshTokenRequestSchema.safeParse(validRefresh);
      expect(result.success).toBe(true);
    });

    it('应该拒绝缺少 refreshToken 字段', () => {
      expect(RefreshTokenRequestSchema.safeParse({}).success).toBe(false);
    });

    it('应该拒绝空的 refreshToken', () => {
      expect(RefreshTokenRequestSchema.safeParse({ refreshToken: '' }).success).toBe(false);
      expect(RefreshTokenRequestSchema.safeParse({ refreshToken: '   ' }).success).toBe(false);
    });

    it('应该限制 refreshToken 最小长度', () => {
      const shortToken = 'abc';
      expect(RefreshTokenRequestSchema.safeParse({ refreshToken: shortToken }).success).toBe(false);
    });
  });
});

/**
 * Analytics Query Schema 测试
 */
describe('Validator Schemas - Analytics Query', () => {
  describe('AnalyticsQuerySchema', () => {
    it('应该接受有效的查询参数', () => {
      const validQueries: AnalyticsQuery[] = [
        { period: 'today' },
        { period: 'week', limit: 10 },
        { period: 'month', limit: 50, offset: 100 },
        { limit: 20 },
        { offset: 0 }
      ];

      for (const query of validQueries) {
        const result = AnalyticsQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
      }
    });

    it('应该应用默认值', () => {
      const result = AnalyticsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe('week');
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('应该拒绝无效的 period', () => {
      const result = AnalyticsQuerySchema.safeParse({ period: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效的 limit', () => {
      expect(AnalyticsQuerySchema.safeParse({ limit: -1 }).success).toBe(false);
      expect(AnalyticsQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(AnalyticsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    });

    it('应该拒绝无效的 offset', () => {
      expect(AnalyticsQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
    });
  });
});

/**
 * 路径参数 Schema 测试
 */
describe('Validator Schemas - 路径参数', () => {
  describe('RetroIdSchema', () => {
    const validRetroIds = [
      'retro_20260205_123456_abc123def456',
      'retro_20240101_000000_xxxxxxxxxxxx',
      'retro_20251231_235959_123456789012'
    ];

    it('应该接受有效的 Retro ID', () => {
      for (const id of validRetroIds) {
        const result = RetroIdSchema.safeParse(id);
        expect(result.success).toBe(true);
      }
    });

    it('应该拒绝无效的 Retro ID', () => {
      const invalidIds = [
        '',
        'invalid',
        'retro_20260205_123456', // 缺少后缀
        'retro_20261301_123456_abc', // 无效月份
        'retro_20260230_123456_abc', // 无效日期
        'retro_20260205_240000_abc', // 无效小时
        'retro_20260205_126000_abc', // 无效分钟
        'retro_20260205_123460_abc', // 无效秒
        'RETRO_20260205_123456_abc', // 大写
        '20260205_123456_abc', // 缺少前缀
      ];

      for (const id of invalidIds) {
        const result = RetroIdSchema.safeParse(id);
        expect(result.success).toBe(false);
      }
    });

    it('应该小写化 ID', () => {
      const result = RetroIdSchema.safeParse('RETRO_20260205_123456_ABCDEF');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('retro_20260205_123456_abcdef');
      }
    });

    it('应该防止路径遍历攻击', () => {
      const pathTraversal = [
        '../retro_20260205_123456_abc',
        'retro_20260205_123456_../../../etc',
        'retro_20260205_123456_..%2f..%2f..%2fetc'
      ];

      for (const payload of pathTraversal) {
        const result = RetroIdSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('ProjectIdSchema', () => {
    const validProjectIds = [
      'my-project',
      'my_project',
      'my.project',
      'myproject',
      'MyProject',
      'project-123',
      'prism-gateway'
    ];

    it('应该接受有效的项目 ID', () => {
      for (const id of validProjectIds) {
        const result = ProjectIdSchema.safeParse(id);
        expect(result.success).toBe(true);
      }
    });

    it('应该拒绝无效的项目 ID', () => {
      const invalidIds = [
        '',
        '   ',
        'my project', // 包含空格
        'my@project', // 包含特殊字符
        'my#project',
        '../../etc/passwd',
        'a'.repeat(101), // 太长
        'my/project',
        'my\\project'
      ];

      for (const id of invalidIds) {
        const result = ProjectIdSchema.safeParse(id);
        expect(result.success).toBe(false);
      }
    });

    it('应该防止 NoSQL 注入', () => {
      const nosqlPayloads = [
        '{"$ne": null}',
        '{"$regex": ".*"}',
        "';return db.users.find();'",
        '1;return db.users.drop();'
      ];

      for (const payload of nosqlPayloads) {
        const result = ProjectIdSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });
  });
});

/**
 * 安全性测试
 */
describe('Validator Schemas - 安全性', () => {
  describe('原型污染防护', () => {
    it('应该拒绝包含 __proto__ 的对象', () => {
      const maliciousPayload = {
        username: 'test',
        password: 'pass',
        __proto__: { isAdmin: true }
      };

      const result = LoginRequestSchema.safeParse(maliciousPayload);
      // strict mode 会拒绝额外字段
      expect(result.success).toBe(false);
    });

    it('应该拒绝包含 constructor 的对象', () => {
      const maliciousPayload = {
        username: 'test',
        password: 'pass',
        constructor: { prototype: { isAdmin: true } }
      };

      const result = LoginRequestSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
    });

    it('应该拒绝包含 prototype 的对象', () => {
      const maliciousPayload = {
        username: 'test',
        password: 'pass',
        prototype: { polluted: true }
      };

      const result = LoginRequestSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('注入攻击防护', () => {
    it('应该防止 SQL 注入', () => {
      const sqlInjection = [
        "admin' OR '1'='1",
        "'; DROP TABLE users; --",
        "1' UNION SELECT * FROM users--",
        "admin'; INSERT INTO users VALUES ('hacker', 'pass'); --"
      ];

      for (const payload of sqlInjection) {
        // 用户名格式验证应该拒绝这些
        const result = LoginRequestSchema.safeParse({
          username: payload,
          password: 'password123'
        });
        expect(result.success).toBe(false);
      }
    });

    it('应该防止 XSS 攻击', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>'
      ];

      for (const payload of xssPayloads) {
        const result = LoginRequestSchema.safeParse({
          username: payload,
          password: 'password123'
        });
        // 格式验证应该拒绝包含特殊字符的用户名
        expect(result.success).toBe(false);
      }
    });
  });

  describe('参数污染防护', () => {
    it('应该处理重复参数（取最后一个）', () => {
      // 这个测试主要是为了文档化行为
      // 实际处理在中间件层面
      const schema = PeriodSchema;
      expect(schema.safeParse('today').success).toBe(true);
    });
  });
});

/**
 * 类型推断测试
 */
describe('Validator Schemas - 类型推断', () => {
  it('应该正确推断 LoginRequest 类型', () => {
    const login: LoginRequest = {
      username: 'testuser',
      password: 'password123'
    };

    const result = LoginRequestSchema.safeParse(login);
    expect(result.success).toBe(true);
  });

  it('应该正确推断 AnalyticsQuery 类型', () => {
    const query: AnalyticsQuery = {
      period: 'week',
      limit: 10,
      offset: 0
    };

    const result = AnalyticsQuerySchema.safeParse(query);
    expect(result.success).toBe(true);
  });
});
