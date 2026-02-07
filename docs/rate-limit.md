# 速率限制中间件使用指南

> **P0 安全修复** | 状态: ✅ 已完成 | 版本: 2.0.0

---

## 概述

速率限制中间件是 ReflectGuard API 的核心安全组件，用于防止 API 滥用、暴力破解攻击和 DoS 攻击。

### 核心特性

- **滑动窗口算法** - 更平滑的限流体验
- **基于 IP 限流** - 自动从请求头提取客户端 IP
- **分层限流策略** - 不同端点使用不同限制
- **白名单支持** - 可配置不受限流的 IP
- **优雅降级** - 存储故障时自动降级

---

## 限流策略

### 预定义策略

| 策略名称 | 请求限制 | 时间窗口 | 使用场景 |
|---------|---------|---------|---------|
| **auth** | 10 次 | 15 分钟 | 认证端点（防暴力破解） |
| **api** | 100 次 | 15 分钟 | 普通 API 端点 |
| **public** | 50 次 | 15 分钟 | 公开访问端点 |
| **strict** | 5 次 | 1 分钟 | 高价值操作 |

### 响应状态码

| 状态码 | 含义 | 响应头 |
|-------|------|--------|
| 200 | 请求正常 | `X-RateLimit-*` 头 |
| 429 | 超过限制 | `Retry-After` 头 |

---

## 快速开始

### 1. 基础使用

```typescript
import { createAuthLimiter, createApiLimiter } from './middleware/rateLimitHono.js';
import { Hono } from 'hono';

const app = new Hono();

// 认证端点限流
const authLimiter = createAuthLimiter();
app.use('/api/v1/auth/*', authLimiter);

// API 端点限流
const apiLimiter = createApiLimiter();
app.use('/api/v1/analytics/*', apiLimiter);
```

### 2. 自定义配置

```typescript
import { createRateLimiter } from './middleware/rateLimitHono.js';

const customLimiter = createRateLimiter({
  maxRequests: 50,        // 最大请求数
  windowMs: 60000,        // 1 分钟窗口
  keyPrefix: 'custom',    // 键前缀
  whitelist: ['127.0.0.1', '::1'],  // 白名单 IP
  skipFailedRequestsWhenError: true  // 错误时优雅降级
});

app.use('/api/v1/custom/*', customLimiter);
```

---

## 响应头说明

### 成功响应头

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200000
```

| 头名称 | 说明 |
|-------|------|
| `X-RateLimit-Limit` | 时间窗口内的最大请求数 |
| `X-RateLimit-Remaining` | 剩余可用请求数 |
| `X-RateLimit-Reset` | 窗口重置时间戳（毫秒） |

### 限流响应头

```
HTTP/1.1 429 Too Many Requests
Retry-After: 900
Content-Type: application/json

{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900
}
```

| 头名称 | 说明 |
|-------|------|
| `Retry-After` | 建议重试等待时间（秒） |

---

## 环境变量配置

### 白名单配置

```bash
# .env
RATE_LIMIT_WHITELIST=127.0.0.1,::1,10.0.0.0/8
```

### 服务器配置示例

```typescript
// server.ts 中已自动应用
const authLimiter = createAuthLimiter({
  whitelist: process.env.RATE_LIMIT_WHITELIST
    ? process.env.RATE_LIMIT_WHITELIST.split(',').map(ip => ip.trim())
    : ['127.0.0.1', '::1']  // 默认本地地址白名单
});
```

---

## IP 地址识别

中间件按以下顺序提取客户端 IP：

1. `X-Forwarded-For` - 取第一个 IP
2. `CF-Connecting-IP` - Cloudflare
3. `X-Real-IP` - Nginx
4. `Host` - 回退选项

### 代理配置示例

**Nginx 配置：**
```nginx
location /api/ {
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://backend;
}
```

---

## 监控与调试

### 获取限流统计

```typescript
// 获取内存存储大小
const store = new MemoryStore();
console.log(`Active rate limit entries: ${store.size()}`);
```

### 日志示例

```
[Rate Limit] IP 10.20.30.40 exceeded limit (10/10) for auth
[Rate Limit] Retry-After: 899 seconds
```

---

## 安全建议

1. **生产环境配置**
   - 使用 Redis 作为存储后端（分布式环境）
   - 合理设置白名单（信任的代理、内网 IP）
   - 监控限流触发频率

2. **DDoS 防护**
   - 在反向代理层（Nginx/Cloudflare）配置基础防护
   - 应用层限流作为第二道防线
   - 考虑使用 IP 黑名单

3. **调试时**
   - 本地开发使用白名单避免限流
   - 检查响应头了解当前限流状态

---

## 测试

### 运行测试

```bash
# 单元测试
bun test src/tests/api/middleware/rateLimitHono.test.ts

# 集成测试
bun test src/tests/api/rateLimitIntegration.test.ts
```

### 测试覆盖率

- 单元测试: 21 个测试，100% 通过
- 集成测试: 6 个测试，100% 通过

---

## API 参考

### `createRateLimiter(config)`

创建自定义速率限制器。

**参数：**
- `config.maxRequests` (number) - 最大请求数
- `config.windowMs` (number) - 时间窗口（毫秒）
- `config.keyPrefix` (string) - 存储键前缀
- `config.store` (RateLimitStore) - 自定义存储
- `config.getTime` (() => number) - 获取当前时间
- `config.whitelist` (string[]) - IP 白名单
- `config.skipFailedRequestsWhenError` (boolean) - 错误时降级

**返回：** Hono 中间件

### `createAuthLimiter(config?)`

创建认证端点限流器（10 次/15 分钟）。

### `createApiLimiter(config?)`

创建 API 端点限流器（100 次/15 分钟）。

### `createPublicLimiter(config?)`

创建公开端点限流器（50 次/15 分钟）。

---

## 故障排查

### 问题：所有请求被限流

**检查：**
1. IP 白名单是否正确配置
2. 代理是否正确传递 `X-Forwarded-For` 头
3. 窗口时间是否设置过短

### 问题：限流不生效

**检查：**
1. 中间件是否正确注册
2. 路由顺序是否正确
3. 是否被白名单豁免

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 2.0.0 | 2026-02-06 | P0 实现：启用速率限制中间件 |
