# API 输入验证层使用文档

> **版本**: 1.0.0
> **状态**: ✅ 完成（83 个测试通过）
> **错误代码**: ERR_1001

---

## 概述

PRISM-Gateway API 输入验证层是基于 [Zod](https://zod.dev/) 的类型安全验证系统，为所有 API 端点提供统一的输入验证。

### 核心特性

- **类型安全**: 使用 Zod Schema 提供编译时和运行时类型验证
- **安全性优先**: 防止注入攻击、路径遍历、参数污染、原型污染
- **统一错误格式**: 所有验证错误返回 ERR_1001 错误代码
- **Hono 集成**: 原生支持 Hono 框架中间件

---

## 快速开始

### 安装依赖

```bash
# Zod 已包含在项目中
bun install
```

### 基础使用

```typescript
import { Hono } from 'hono';
import { queryValidator, bodyValidator, paramValidator } from './validator/index.js';
import { PeriodSchema, LoginRequestSchema } from './validator/schemas.js';

const app = new Hono();

// 验证查询参数
app.get('/analytics',
  queryValidator({ period: PeriodSchema }),
  (c) => {
    const query = c.get('validatedQuery');
    return c.json({ period: query.period });
  }
);

// 验证请求体
app.post('/auth/login',
  bodyValidator(LoginRequestSchema),
  (c) => {
    const body = c.get('validatedBody');
    return c.json({ username: body.username });
  }
);

// 验证路径参数
app.get('/projects/:projectId',
  paramValidator({ projectId: ProjectIdSchema }),
  (c) => {
    const params = c.get('validatedParams');
    return c.json({ projectId: params.projectId });
  }
);
```

---

## Schema 定义

### 基础 Schemas

```typescript
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
  NonNegativeIntegerSchema,
  BoundedIntegerSchema,
  SafeStringSchema
} from './validator/schemas.js';

// 非空字符串（自动 trim）
NonEmptyStringSchema.parse('hello'); // OK
NonEmptyStringSchema.parse(''); // Error: 不能为空

// 正整数
PositiveIntegerSchema.parse(10); // OK
PositiveIntegerSchema.parse(0); // Error: 必须是正数

// 非负整数
NonNegativeIntegerSchema.parse(0); // OK
NonNegativeIntegerSchema.parse(-1); // Error: 不能为负数

// 有界整数
const AgeSchema = BoundedIntegerSchema(0, 150);
AgeSchema.parse(25); // OK
AgeSchema.parse(200); // Error: 最大值为 150

// 安全字符串（防止注入）
SafeStringSchema.parse('user-123'); // OK
SafeStringSchema.parse('../../../etc'); // Error: 包含非法字符
```

### 查询参数 Schemas

```typescript
import {
  PeriodSchema,
  LimitSchema,
  OffsetSchema,
  MetricSchema
} from './validator/schemas.js';

// 时间范围
PeriodSchema.parse('week'); // OK
PeriodSchema.parse('invalid'); // Error: period 必须是有效值

// 分页限制
LimitSchema.parse(20); // OK (1-100)
LimitSchema.parse(101); // Error: 最大值为 100

// 分页偏移
OffsetSchema.parse(0); // OK
OffsetSchema.parse(-1); // Error: 不能为负数

// 指标名称
MetricSchema.parse('violations'); // OK
MetricSchema.parse('../../../etc'); // Error: 包含非法字符
```

### 路径参数 Schemas

```typescript
import {
  RetroIdSchema,
  ProjectIdSchema
} from './validator/schemas.js';

// Retro ID
RetroIdSchema.parse('retro_20260205_123456_abc123'); // OK
RetroIdSchema.parse('invalid'); // Error: 格式无效

// Project ID
ProjectIdSchema.parse('my-project'); // OK
ProjectIdSchema.parse('my project'); // Error: 包含非法字符
```

### 请求体 Schemas

```typescript
import {
  LoginRequestSchema,
  RefreshTokenRequestSchema
} from './validator/schemas.js';

// 登录请求
LoginRequestSchema.parse({
  username: 'testuser',
  password: 'password123'
}); // OK

// 刷新 Token 请求
RefreshTokenRequestSchema.parse({
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}); // OK
```

---

## 中间件使用

### zValidator

通用验证中间件，支持 query、param、body、header、cookie。

```typescript
import { z } from 'zod';
import { zValidator } from './validator/index.js';

const schema = z.object({
  period: z.enum(['today', 'week', 'month']),
  limit: z.number().min(1).max(100)
});

app.get('/analytics',
  zValidator('query', schema),
  (c) => {
    const query = c.get('validatedQuery');
    return c.json(query);
  }
);
```

### queryValidator

专门用于验证 URL 查询参数。

```typescript
import { queryValidator } from './validator/index.js';
import { PeriodSchema, LimitSchema } from './validator/schemas.js';

app.get('/analytics',
  queryValidator({
    period: PeriodSchema,
    limit: LimitSchema.withDefault() // 使用默认值 20
  }),
  (c) => {
    const query = c.get('validatedQuery');
    // query.period: string
    // query.limit: number (默认 20)
    return c.json(query);
  }
);
```

### paramValidator

专门用于验证 URL 路径参数。

```typescript
import { paramValidator } from './validator/index.js';
import { ProjectIdSchema } from './validator/schemas.js';

app.get('/projects/:projectId',
  paramValidator({ projectId: ProjectIdSchema }),
  (c) => {
    const params = c.get('validatedParams');
    return c.json({ projectId: params.projectId });
  }
);
```

### bodyValidator

专门用于验证 JSON 请求体。

```typescript
import { bodyValidator } from './validator/index.js';
import { LoginRequestSchema } from './validator/schemas.js';

app.post('/auth/login',
  bodyValidator(LoginRequestSchema),
  (c) => {
    const body = c.get('validatedBody');
    return c.json({ username: body.username });
  }
);
```

---

## 错误处理

### 错误响应格式

所有验证错误返回统一的错误格式：

```json
{
  "success": false,
  "error": "ERR_1001",
  "message": "输入验证失败",
  "details": [
    "period: period 必须是 today、week、month、year 或 all 之一",
    "limit: 最大值为 100"
  ],
  "meta": {
    "timestamp": "2026-02-06T12:00:00.000Z"
  }
}
```

### 错误代码

| 代码 | 说明 | HTTP 状态码 |
|------|------|------------|
| ERR_1001 | 输入验证失败 | 400 |
| ERR_2001 | 认证失败 | 401 |
| ERR_2002 | 授权失败 | 403 |
| ERR_3001 | 资源未找到 | 404 |
| ERR_5000 | 服务器错误 | 500 |

### 处理验证错误

```typescript
app.use('*', async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error.code === 'ERR_1001') {
      // 处理验证错误
      return c.json(error, 400);
    }
    // 处理其他错误
  }
});
```

---

## 安全特性

### 注入攻击防护

```typescript
// SQL 注入防护
LoginRequestSchema.parse({
  username: "admin' OR '1'='1", // 拒绝：包含非法字符
  password: 'password123'
});

// XSS 防护
LoginRequestSchema.parse({
  username: '<script>alert("XSS")</script>', // 拒绝：包含非法字符
  password: 'password123'
});
```

### 路径遍历防护

```typescript
// 防止路径遍历
ProjectIdSchema.parse('../../../etc/passwd'); // 拒绝：包含非法字符
ProjectIdSchema.parse('..\\..\\windows\\system32'); // 拒绝：包含非法字符
```

### 原型污染防护

```typescript
// Strict mode 拒绝额外字段
LoginRequestSchema.parse({
  username: 'testuser',
  password: 'password123',
  __proto__: { isAdmin: true } // 拒绝：额外字段
});
```

### 参数污染防护

```typescript
// 重复参数只保留最后一个
// ?period=invalid&period=week => period = 'week'
queryValidator({ period: PeriodSchema })
```

---

## 自定义 Schema

### 创建自定义 Schema

```typescript
import { z } from 'zod';

// 自定义用户名 Schema
export const CustomUsernameSchema = z.string()
  .trim()
  .min(3, '用户名至少 3 字符')
  .max(50, '用户名最多 50 字符')
  .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、连字符和下划线');

// 自定义枚举 Schema
export const StatusSchema = z.enum(['pending', 'active', 'completed'], {
  errorMap: () => ({ message: 'status 必须是 pending、active 或 completed' })
});

// 组合 Schema
export const CreateUserSchema = z.object({
  username: CustomUsernameSchema,
  email: z.string().email('邮箱格式无效'),
  status: StatusSchema.default('pending')
}).strict();
```

### 使用自定义 Schema

```typescript
app.post('/users',
  bodyValidator(CreateUserSchema),
  (c) => {
    const body = c.get('validatedBody');
    return c.json(body);
  }
);
```

---

## 测试

### 运行测试

```bash
# 运行所有验证器测试
bun test src/api/validator/

# 运行 Schema 测试
bun test src/api/validator/schemas.test.ts

# 运行中间件测试
bun test src/api/validator/middleware.test.ts
```

### 测试覆盖率

- **Schema 测试**: 58 个测试
- **中间件测试**: 25 个测试
- **总计**: 83 个测试，100% 通过

---

## 最佳实践

### 1. 始终使用 Schema 定义输入

```typescript
// 好的做法
const schema = z.object({ name: z.string() });
app.post('/api', bodyValidator(schema), handler);

// 不好的做法
app.post('/api', async (c) => {
  const body = await c.req.json();
  if (typeof body.name !== 'string') { /* ... */ }
});
```

### 2. 使用 strict mode 拒绝额外字段

```typescript
// 好的做法
const schema = z.object({
  name: z.string()
}).strict(); // 拒绝额外字段

// 不好的做法
const schema = z.object({
  name: z.string()
}); // 允许额外字段
```

### 3. 提供清晰的错误消息

```typescript
// 好的做法
const schema = z.string().min(8, '密码至少 8 字符');

// 不好的做法
const schema = z.string().min(8);
```

### 4. 使用默认值减少必需参数

```typescript
// 好的做法
const schema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().nonnegative().default(0)
});

// 不好的做法
const schema = z.object({
  limit: z.number().min(1).max(100), // 必需
  offset: z.number().nonnegative()  // 必需
});
```

---

## 参考资料

- [Zod 官方文档](https://zod.dev/)
- [Hono 官方文档](https://hono.dev/)
- [项目 CLAUDE.md](../CLAUDE.md)
- [API 模块文档](../../api/CLAUDE.md)

---

**维护者**: PRISM-Gateway Team
**最后更新**: 2026-02-06
