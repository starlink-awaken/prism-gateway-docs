# CORS 安全配置指南

> **P0 安全修复：SEC-003**
>
> 修复不安全的 CORS 配置，防止跨站请求伪造和数据窃取攻击

---

## 概述

### 安全问题

**原配置（不安全）：**
```typescript
app.use('*', cors({
  origin: '*', // 🔴 严重安全漏洞
  maxAge: 86400, // 24 小时，过长
}));
```

**风险：**
- 任何网站可向 API 发起请求
- 容易受到 CSRF 攻击
- 用户数据可能被窃取
- 预检缓存过长增加攻击窗口

### 修复方案

**新配置（安全）：**
```typescript
import { createCORSMiddleware } from './middleware/cors.js';

app.use('*', createCORSMiddleware());
```

**安全特性：**
- 来源白名单验证
- 环境变量配置
- 预检缓存降至 10 分钟
- 支持凭证传递
- 防止来源混淆攻击

---

## 快速开始

### 1. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# 开发环境（可以留空，自动允许 localhost）
NODE_ENV=development
CORS_ALLOWED_ORIGINS=

# 生产环境（必须明确配置）
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://example.com,https://app.example.com
```

### 2. 启动服务

```bash
# 开发环境
bun run src/api/server.ts

# 生产环境
NODE_ENV=production bun run src/api/server.ts
```

### 3. 验证配置

```bash
# 检查 CORS 响应头
curl -I http://localhost:3000/health \
  -H "Origin: http://localhost:3000"

# 应该看到：
# access-control-allow-origin: http://localhost:3000
# access-control-allow-credentials: true
```

---

## 配置说明

### 环境变量

| 变量 | 说明 | 开发环境默认 | 生产环境默认 |
|------|------|-------------|-------------|
| `NODE_ENV` | 运行环境 | `development` | `production` |
| `CORS_ALLOWED_ORIGINS` | 允许的来源（逗号分隔） | 自动 localhost | 无（必须配置） |

### 允许的来源格式

```
CORS_ALLOWED_ORIGINS=协议://域名:端口,协议://域名:端口
```

**正确示例：**
```
CORS_ALLOWED_ORIGINS=https://example.com,https://app.example.com:8080
```

**错误示例：**
```
# ❌ 缺少协议
CORS_ALLOWED_ORIGINS=example.com,app.example.com

# ❌ 使用通配符
CORS_ALLOWED_ORIGINS=*

# ❌ 多余空格
CORS_ALLOWED_ORIGINS= https://example.com , https://app.example.com
```

### 开发环境默认来源

开发环境自动允许以下来源（无需配置）：

```
http://localhost:3000
http://localhost:3001
http://localhost:5173    # Vite
http://localhost:5174
http://localhost:8080
http://127.0.0.1:3000
http://127.0.0.1:5173
http://127.0.0.1:8080
```

---

## 部署指南

### 开发环境

1. **配置 `.env`：**
   ```bash
   NODE_ENV=development
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

2. **启动服务：**
   ```bash
   bun run src/api/server.ts
   ```

3. **验证：**
   ```bash
   curl http://localhost:3000/health \
     -H "Origin: http://localhost:3000" -v
   ```

### 生产环境

1. **配置环境变量：**
   ```bash
   # 必须配置允许的来源
   export NODE_ENV=production
   export CORS_ALLOWED_ORIGINS=https://your-frontend.com,https://app.your-frontend.com
   ```

2. **或在 `.env` 文件中：**
   ```bash
   NODE_ENV=production
   CORS_ALLOWED_ORIGINS=https://your-frontend.com,https://app.your-frontend.com
   ```

3. **启动服务：**
   ```bash
   bun run src/api/server.ts
   ```

4. **验证安全配置：**
   ```bash
   # 测试允许的来源
   curl -I https://api.example.com/health \
     -H "Origin: https://your-frontend.com"

   # 测试拒绝的来源（不应该返回 CORS 头）
   curl -I https://api.example.com/health \
     -H "Origin: https://evil.com"
   ```

### Docker 部署

```dockerfile
# Dockerfile
FROM oven/bun:1

# 设置环境变量
ENV NODE_ENV=production
ENV CORS_ALLOWED_ORIGINS=https://your-frontend.com

# 复制应用
COPY . /app
WORKDIR /app

# 安装依赖
RUN bun install

# 启动服务
CMD ["bun", "run", "src/api/server.ts"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CORS_ALLOWED_ORIGINS=https://your-frontend.com,https://app.your-frontend.com
```

---

## 验证方法

### 1. 检查响应头

```bash
# 完整响应头检查
curl -v http://localhost:3000/health \
  -H "Origin: http://localhost:3000" 2>&1 | grep -i "access-control"

# 预期输出：
# < access-control-allow-origin: http://localhost:3000
# < access-control-allow-credentials: true
# < access-control-expose-headers: X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining
```

### 2. 浏览器控制台

```javascript
// 在浏览器控制台执行
fetch('http://localhost:3000/health', {
  headers: { 'Origin': 'http://localhost:3000' },
  credentials: 'include'
}).then(r => {
  console.log('CORS Origin:', r.headers.get('access-control-allow-origin'));
  console.log('CORS Credentials:', r.headers.get('access-control-allow-credentials'));
});
```

### 3. OPTIONS 预检请求

```bash
curl -X OPTIONS http://localhost:3000/api/v1/analytics/usage \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v

# 预期输出：
# < access-control-allow-methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
# < access-control-max-age: 600
```

### 4. 安全测试

```bash
# 测试未授权来源被拒绝
curl -I http://localhost:3000/health \
  -H "Origin: https://evil.com" 2>&1 | grep "access-control-allow-origin"

# 预期：不应该有 access-control-allow-origin 头（或为空）
```

---

## 常见问题

### Q1: 为什么我的前端请求被拒绝？

**原因：** 生产环境未配置允许的来源

**解决：**
```bash
# 检查环境变量
echo $CORS_ALLOWED_ORIGINS

# 如果为空，添加你的前端域名
export CORS_ALLOWED_ORIGINS=https://your-frontend.com
```

### Q2: 如何允许多个域名？

**解决：** 用逗号分隔（无空格）
```bash
export CORS_ALLOWED_ORIGINS=https://site1.com,https://site2.com,https://site3.com
```

### Q3: 子域名需要单独配置吗？

**回答：** 是的，不支持通配符

```bash
# ❌ 不支持
CORS_ALLOWED_ORIGINS=https://*.example.com

# ✅ 需要分别配置
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com,https://api.example.com
```

### Q4: 本地开发不同端口怎么办？

**回答：** 开发环境自动允许任意端口的 localhost

```javascript
// 这些都会被允许
http://localhost:3000
http://localhost:4200
http://127.0.0.1:8080
```

### Q5: 如何确认配置生效？

**解决：** 查看启动日志

```
[CORS] 配置: {
  environment: "production",
  allowedOrigins: 2,
  maxAge: 600,
  allowCredentials: true,
}
```

### Q6: Cookies 无法传递？

**回答：** 确保以下配置：

1. **服务端：** `access-control-allow-credentials: true`（已默认）
2. **客户端：** `fetch` 时设置 `credentials: 'include'`

```javascript
fetch('https://api.example.com/data', {
  credentials: 'include'  // 重要
});
```

---

## 安全最佳实践

### 1. 生产环境必须明确配置

```bash
# ✅ 正确：明确配置
CORS_ALLOWED_ORIGINS=https://your-frontend.com

# ❌ 错误：留空
CORS_ALLOWED_ORIGINS=
```

### 2. 使用 HTTPS

```bash
# ✅ 正确：生产环境使用 HTTPS
CORS_ALLOWED_ORIGINS=https://your-frontend.com

# ❌ 错误：生产环境使用 HTTP
CORS_ALLOWED_ORIGINS=http://your-frontend.com
```

### 3. 定期审查配置

```bash
# 定期检查允许的来源列表
echo $CORS_ALLOWED_ORIGINS | tr ',' '\n'
```

### 4. 监控 CORS 请求

考虑添加日志记录被拒绝的 CORS 请求：

```typescript
if (!isAllowed) {
  console.warn('[CORS] 拒绝请求:', {
    origin,
    path: c.req.path,
    timestamp: new Date().toISOString()
  });
}
```

### 5. 使用 CSP 头

配合 Content-Security-Policy 进一步保护：

```typescript
c.header('Content-Security-Policy', "default-src 'self'");
```

---

## 故障排查

### 症状：浏览器显示 CORS 错误

```
Access to fetch at 'https://api.example.com' from origin 'https://site.com'
has been blocked by CORS policy
```

**排查步骤：**

1. **检查环境变量：**
   ```bash
   # 确认来源已配置
   echo $CORS_ALLOWED_ORIGINS | grep -o 'https://site.com'
   ```

2. **检查 URL 格式：**
   ```bash
   # 必须包含协议
   https://site.com  ✅
   site.com          ❌
   ```

3. **检查环境模式：**
   ```bash
   # 确认环境
   echo $NODE_ENV
   ```

4. **查看服务日志：**
   ```bash
   # 查找 CORS 配置日志
   grep "CORS" logs/app.log
   ```

### 症状：预检请求失败

**排查：**

```bash
# 手动测试预检请求
curl -X OPTIONS https://api.example.com/api/v1/data \
  -H "Origin: https://your-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**预期返回：** 204 状态码 + CORS 头

---

## 附录：安全修复对比

### 修复前

```typescript
// 🔴 不安全配置
app.use('*', cors({
  origin: '*',              // 允许任何来源
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,            // 24 小时缓存
}));
```

**风险评估：**
- [ ] 来源验证：无
- [ ] 凭证保护：不完整
- [ ] 缓存时间：过长
- [ ] 子域名保护：无

### 修复后

```typescript
// ✅ 安全配置
app.use('*', createCORSMiddleware());

// 环境变量配置
CORS_ALLOWED_ORIGINS=https://example.com,https://app.example.com
```

**安全特性：**
- [x] 来源白名单验证
- [x] 环境变量配置
- [x] 预检缓存 10 分钟
- [x] 支持凭证传递
- [x] 防止来源混淆
- [x] 精确域名匹配

---

**维护者：** PRISM-Gateway Team
**文档版本：** 1.0.0
**最后更新：** 2026-02-06
**状态：** ✅ P0 安全修复完成
