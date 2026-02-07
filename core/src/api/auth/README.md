# JWT 认证模块使用文档

> **状态：** ✅ 完成 | **测试：** 58/58 通过 | **覆盖率：** >90%

**版本：** 1.0.0
**更新日期：** 2026-02-06

---

## 目录

- [概述](#概述)
- [快速开始](#快速开始)
- [环境变量配置](#环境变量配置)
- [API 端点](#api-端点)
- [中间件使用](#中间件使用)
- [错误处理](#错误处理)
- [安全最佳实践](#安全最佳实践)

---

## 概述

JWT 认证模块提供完整的基于 Token 的认证解决方案，包括：

- **HS256 签名算法** - 使用 HMAC-SHA256 进行 Token 签名
- **访问 Token + 刷新 Token** - 短期访问 Token 和长期刷新 Token
- **类型安全** - 完整的 TypeScript 类型定义
- **轻量级** - 无外部 JWT 库依赖，使用 Node.js crypto 模块

### Token 类型

| 类型 | 有效期 | 用途 |
|------|--------|------|
| **访问 Token** | 1 小时（可配置） | 访问受保护的 API 资源 |
| **刷新 Token** | 7 天（可配置） | 获取新的访问 Token |

---

## 快速开始

### 1. 环境变量配置

创建 `.env` 文件或设置环境变量：

```bash
# JWT 密钥（必须 32 字符以上，生产环境使用强随机字符串）
JWT_SECRET=your-super-secret-key-at-least-32-chars-long

# Token 有效期（可选，单位：秒）
JWT_ACCESS_TTL=3600        # 1 小时
JWT_REFRESH_TTL=604800     # 7 天

# Token 签发者和受众（可选）
JWT_ISSUER=prism-gateway
JWT_AUDIENCE=prism-gateway-api
```

### 2. 初始化服务

```typescript
import { JWTService } from './api/auth/index.js';

const jwtService = new JWTService({
  secret: process.env.JWT_SECRET!,
  accessTokenTTL: parseInt(process.env.JWT_ACCESS_TTL || '3600'),
  refreshTokenTTL: parseInt(process.env.JWT_REFRESH_TTL || '604800'),
  issuer: process.env.JWT_ISSUER || 'prism-gateway',
  audience: process.env.JWT_AUDIENCE || 'prism-gateway-api'
});
```

### 3. 注册路由

```typescript
import { Hono } from 'hono';
import { authRouter } from './api/auth/routes/authRoutes.js';

const app = new Hono();

// 实现用户服务
class MyUserService implements IUserService {
  async findByUsername(username: string) {
    // 从数据库查找用户
    return { id: 'user1', passwordHash: 'hashed_password' };
  }

  async verifyPassword(password: string, hash: string) {
    // 使用 bcrypt 等验证密码
    return bcrypt.compare(password, hash);
  }
}

// 注册认证路由
app.route('/api/v1/auth', authRouter({
  jwtService,
  userService: new MyUserService()
}));
```

### 4. 保护路由

```typescript
import { jwtMiddleware } from './api/auth/middleware/jwtMiddleware.js';

// 保护所有路由
app.use('/api/v1/protected/*', jwtMiddleware({ jwtService }));

// 或使用可选认证（无 Token 时也放行）
app.use('/api/v1/optional/*', jwtMiddleware({ jwtService, optional: true }));
```

---

## 环境变量配置

### 必需变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `JWT_SECRET` | JWT 签名密钥（至少 32 字符） | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |

### 可选变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `JWT_ACCESS_TTL` | `3600` | 访问 Token 有效期（秒） |
| `JWT_REFRESH_TTL` | `604800` | 刷新 Token 有效期（秒） |
| `JWT_ISSUER` | `prism-gateway` | Token 签发者标识 |
| `JWT_AUDIENCE` | `prism-gateway-api` | Token 受众 |

### 安全注意事项

⚠️ **重要：**

- `JWT_SECRET` 必须保密，不要提交到版本控制
- 生产环境使用至少 256 位（32 字符）的随机密钥
- 定期轮换密钥（需要实现密钥版本控制）
- 使用 `.env` 文件或密钥管理服务存储

---

## API 端点

### POST /api/v1/auth/login

用户登录，获取访问 Token 和刷新 Token。

**请求体：**

```json
{
  "username": "alice",
  "password": "password123"
}
```

**成功响应 (200)：**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600
  },
  "meta": {
    "timestamp": "2026-02-06T10:30:00.000Z",
    "version": "2.0.0"
  }
}
```

**错误响应 (401)：**

```json
{
  "success": false,
  "error": "Invalid credentials",
  "meta": {
    "timestamp": "2026-02-06T10:30:00.000Z"
  }
}
```

### POST /api/v1/auth/refresh

使用刷新 Token 获取新的访问 Token。

**请求体：**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**成功响应 (200)：**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600
  },
  "meta": {
    "timestamp": "2026-02-06T10:30:00.000Z",
    "version": "2.0.0"
  }
}
```

### GET /api/v1/auth/me

获取当前认证用户的信息。

**请求头：**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**成功响应 (200)：**

```json
{
  "success": true,
  "data": {
    "sub": "user1",
    "username": "alice",
    "jti": "jti_1234567890_1_abc123"
  },
  "meta": {
    "timestamp": "2026-02-06T10:30:00.000Z",
    "version": "2.0.0"
  }
}
```

### POST /api/v1/auth/logout

用户登出（客户端删除 Token）。

**请求头：**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**成功响应 (200)：**

```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out",
    "instruction": "Please discard your tokens"
  },
  "meta": {
    "timestamp": "2026-02-06T10:30:00.000Z",
    "version": "2.0.0"
  }
}
```

---

## 中间件使用

### 基本用法

```typescript
import { jwtMiddleware } from './api/auth/middleware/jwtMiddleware.js';
import { Hono } from 'hono';

const app = new Hono();

// 保护路由
app.use('/api/protected/*', jwtMiddleware({ jwtService }));

// 在路由处理器中获取用户信息
app.get('/api/protected/profile', (c) => {
  const user = c.get('user');
  return c.json({ userId: user.sub, username: user.username });
});
```

### 可选认证

允许未认证用户访问，但有 Token 时会验证：

```typescript
app.use('/api/optional/*', jwtMiddleware({
  jwtService,
  optional: true  // 无 Token 时也放行
}));

app.get('/api/optional/content', (c) => {
  const user = c.get('user');
  if (user) {
    return c.json({ message: 'Hello ' + user.username });
  }
  return c.json({ message: 'Hello guest' });
});
```

### 多个 JWT 实例

不同路由使用不同的 JWT 配置：

```typescript
const jwtService1 = new JWTService({ ...config1 });
const jwtService2 = new JWTService({ ...config2 });

app.use('/api/v1/*', jwtMiddleware({ jwtService: jwtService1 }));
app.use('/api/v2/*', jwtMiddleware({ jwtService: jwtService2 }));
```

### 辅助函数

```typescript
import {
  getAuthUser,
  requireAuthUser
} from './api/auth/middleware/jwtMiddleware.js';

// 获取用户（可能为 null）
app.get('/api/profile', (c) => {
  const user = getAuthUser(c);
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  return c.json({ username: user.username });
});

// 要求认证（否则抛出异常）
app.get('/api/protected', (c) => {
  const user = requireAuthUser(c);
  return c.json({ data: 'protected', user: user.username });
});
```

---

## 错误处理

### 统一错误格式

所有错误响应遵循统一格式：

```json
{
  "success": false,
  "error": "Error message",
  "meta": {
    "timestamp": "2026-02-06T10:30:00.000Z"
  }
}
```

### HTTP 状态码

| 状态码 | 场景 |
|--------|------|
| `200` | 成功 |
| `400` | 请求参数无效 |
| `401` | 未认证或 Token 无效 |
| `500` | 服务器内部错误 |

### 客户端处理示例

```typescript
async function fetchProtectedData() {
  const response = await fetch('/api/protected/data', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    // Token 过期，尝试刷新
    const newTokens = await refreshTokens();
    // 重试请求
    return fetchProtectedData();
  }

  return response.json();
}
```

---

## 安全最佳实践

### 1. 密钥管理

```bash
# 使用 openssl 生成强密钥
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Token 存储

**推荐：** 使用 `localStorage` 或 `sessionStorage`

```javascript
// 存储 Token
localStorage.setItem('access_token', accessToken);
localStorage.setItem('refresh_token', refreshToken);

// 读取 Token
const token = localStorage.getItem('access_token');

// 删除 Token（登出）
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
```

**不推荐：** 不使用 Cookie（容易受 CSRF 攻击）

### 3. HTTPS 传输

生产环境必须使用 HTTPS，防止 Token 被截获。

### 4. Token 刷新策略

```typescript
// 客户端自动刷新 Token
async function fetchWithRefresh(url: string, options: RequestInit) {
  let token = localStorage.getItem('access_token');

  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });

  // Token 过期，自动刷新
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token');
    const newTokens = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).then(r => r.json());

    // 存储新 Token
    localStorage.setItem('access_token', newTokens.data.accessToken);
    localStorage.setItem('refresh_token', newTokens.data.refreshToken);

    // 重试请求
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${newTokens.data.accessToken}`
      }
    });
  }

  return response;
}
```

### 5. 错误消息不泄露信息

认证失败返回通用错误消息：

```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

不要返回：

- 用户是否存在
- 密码哪部分错误
- 内部错误详情

### 6. Token 有效期设置

| 环境 | 访问 Token TTL | 刷新 Token TTL |
|------|----------------|----------------|
| 开发 | 1 小时 | 7 天 |
| 生产 | 15 分钟 | 7 天 |

较短的访问 Token TTL 可以降低 Token 泄露的风险。

---

## 测试

运行测试：

```bash
# 运行所有认证测试
bun test src/tests/api/auth/

# 运行特定测试
bun test src/tests/api/auth/JWTService.test.ts
bun test src/tests/api/auth/JWTMiddleware.test.ts
bun test src/tests/api/auth/authRoutes.test.ts
```

测试覆盖：

- **58 个测试用例**
- **100% 通过率**
- **>90% 代码覆盖率**

---

## 常见问题

### Q: 如何实现 Token 黑名单（立即登出）？

A: 当前实现是无状态 JWT，登出主要靠客户端删除 Token。如需实现 Token 黑名单：

1. 使用 Redis 存储已吊销的 JTI
2. 在中间件中检查 JTI 是否在黑名单
3. 登出时将 Token 的 JTI 加入黑名单

### Q: 如何实现多设备登录管理？

A: 为每个设备生成唯一的 JTI，在用户表中存储设备列表：

```typescript
// 登录时记录设备
const deviceId = crypto.randomUUID();
const jti = `jti_${Date.now()}_${deviceId}`;

// 登出特定设备时吊销该设备的 JTI
```

### Q: 如何实现权限控制？

A: 在 JWT Payload 中添加角色声明：

```typescript
interface JWTPayload {
  // ... 现有字段
  roles: string[];
  permissions: string[];
}

// 在中间件中检查权限
function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user.permissions.includes(permission)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
  };
}
```

---

## 文件结构

```
src/api/auth/
├── index.ts              # 模块导出
├── types.ts              # 类型定义
├── JWTService.ts         # JWT 核心服务
├── middleware/
│   └── jwtMiddleware.ts  # 认证中间件
└── routes/
    └── authRoutes.ts     # 认证路由
```

---

## 相关资源

- [RFC 7519 - JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [RFC 7523 - JWT Bearer Token](https://tools.ietf.org/html/rfc7523)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**维护者：** PRISM-Gateway Team
**许可证：** MIT License
