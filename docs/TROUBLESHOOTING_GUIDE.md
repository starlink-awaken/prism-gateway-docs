# ReflectGuard 故障排查指南

> 系统问题的快速诊断和解决方案

**最后更新：** 2026-02-06
**版本：** 2.2.0
**目标读者：** 运维工程师、开发者

---

## 目录

- [快速诊断流程](#快速诊断流程)
- [常见问题分类](#常见问题分类)
- [故障排查树](#故障排查树)
- [特定错误码](#特定错误码)
- [性能问题诊断](#性能问题诊断)
- [数据问题诊断](#数据问题诊断)
- [获取帮助](#获取帮助)

---

## 快速诊断流程

### 第一步：确定问题类型

```bash
# 1. 检查服务状态
curl -s http://localhost:3000/health | jq '.'
pm2 status

# 2. 查看错误日志
tail -n 50 logs/prism-gateway.log | grep "ERROR"

# 3. 检查系统资源
free -h
df -h ~/.prism-gateway
```

### 第二步：使用决策树

```
问题类型？
├── 服务无法启动 → [安装和启动问题](#安装和启动问题)
├── API 请求失败 → [API 问题](#api-问题)
├── 性能缓慢 → [性能问题](#性能问题诊断)
├── 数据异常 → [数据问题](#数据问题诊断)
└── 其他问题 → [获取帮助](#获取帮助)
```

### 第三步：查看具体章节

根据确定的问题类型，跳转到对应的故障排查章节。

---

## 常见问题分类

### 安装和启动问题

#### 问题 1.1：Bun 未安装或版本过低

**症状：**
```bash
bun: command not found
# 或
bun --version
# 输出版本 < 1.0.0
```

**诊断：**
```bash
# 检查 Bun 是否存在
which bun

# 检查版本
bun --version
```

**解决方案：**

**macOS/Linux：**
```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 重启终端
source ~/.bashrc  # 或 ~/.zshrc

# 验证安装
bun --version
```

**Windows：**
```powershell
# 使用 PowerShell 安装
powershell -c "irm bun.sh/install.ps1|iex"

# 验证安装
bun --version
```

**替代方案（使用 npm）：**
```bash
# 如果 Bun 无法安装，使用 npm
npm install
npm run dev
```

---

#### 问题 1.2：依赖安装失败

**症状：**
```bash
bun install
# 报错：网络错误、权限错误、版本冲突
```

**诊断：**
```bash
# 检查网络连接
ping registry.npmjs.org

# 检查文件权限
ls -la ~/.prism-gateway
```

**解决方案：**

**方案 1：使用镜像**
```bash
# 使用国内镜像
bun install --registry https://registry.npmmirror.com
```

**方案 2：清理缓存**
```bash
# 清理 Bun 缓存
rm -rf ~/.bun/install/cache
bun install
```

**方案 3：修复权限**
```bash
# 修改目录所有者
sudo chown -R $USER:$USER ~/.prism-gateway
chmod -R 755 ~/.prism-gateway
```

**方案 4：使用锁文件**
```bash
# 使用 lock 文件强制安装
bun install --frozen-lockfile
```

---

#### 问题 1.3：端口被占用

**症状：**
```bash
bun run api
# 错误：Error: listen EADDRINUSE: address already in use :::3000
```

**诊断：**
```bash
# 查找占用端口的进程
lsof -i :3000
# 或
netstat -tuln | grep 3000
```

**解决方案：**

**方案 1：停止占用进程**
```bash
# 查找进程
lsof -i :3000

# 停止进程（将 PID 替换为实际值）
kill -9 <PID>
```

**方案 2：更改端口**
```bash
# 编辑 .env 文件
nano .env

# 修改 PORT 配置
PORT=3001

# 重启服务
bun run api
```

**方案 3：使用 PM2 自动处理**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'prism-gateway-api',
    script: 'src/api/server.ts',
    env: {
      PORT: 3001
    }
  }]
};
```

---

#### 问题 1.4：环境变量配置错误

**症状：**
```bash
bun run api
# 错误：JWT_SECRET is required
```

**诊断：**
```bash
# 检查 .env 文件是否存在
ls -la .env

# 检查环境变量是否加载
cat .env | grep JWT_SECRET
```

**解决方案：**

**方案 1：创建 .env 文件**
```bash
# 复制示例配置
cp .env.example .env

# 编辑配置
nano .env
```

**方案 2：生成 JWT 密钥**
```bash
# 生成强随机密钥
openssl rand -base64 32

# 将输出复制到 .env 文件的 JWT_SECRET
```

**方案 3：设置环境变量（临时）**
```bash
# 直接在命令行设置
export JWT_SECRET="your-secret-key-here"
bun run api
```

---

### API 问题

#### 问题 2.1：API 服务无响应

**症状：**
```bash
curl http://localhost:3000/health
# 超时或无响应
```

**诊断：**
```bash
# 1. 检查服务是否运行
pm2 status
ps aux | grep prism-gateway

# 2. 检查端口监听
netstat -tuln | grep 3000

# 3. 查看错误日志
tail -n 100 logs/prism-gateway.log
```

**解决方案：**

**方案 1：重启服务**
```bash
# PM2 管理
pm2 restart prism-gateway-api

# 或手动重启
pm2 stop prism-gateway-api
pm2 start prism-gateway-api
```

**方案 2：检查防火墙**
```bash
# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Linux
sudo ufw status
sudo iptables -L
```

**方案 3：检查系统资源**
```bash
# 检查内存
free -h

# 检查磁盘
df -h

# 如果资源不足，清理缓存或重启系统
```

---

#### 问题 2.2：CORS 错误

**症状：**
```javascript
// 浏览器控制台错误
Access to fetch at 'http://localhost:3000/api/gateway/check'
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**诊断：**
```bash
# 检查 CORS 配置
cat .env | grep CORS_ALLOWED_ORIGINS
```

**解决方案：**

**方案 1：配置 CORS（开发环境）**
```bash
# 编辑 .env 文件
nano .env

# 添加前端地址
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

**方案 2：配置 CORS（生产环境）**
```bash
# 使用完整域名
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://app.your-domain.com
```

**方案 3：临时允许所有来源（不推荐生产环境）**
```typescript
// src/api/middleware/cors.ts
// 仅用于紧急调试，生产环境禁止使用
app.use(cors({ origin: '*' }));
```

---

#### 问题 2.3：JWT 认证失败

**症状：**
```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

**诊断：**
```bash
# 1. 检查 JWT_SECRET 是否一致
cat .env | grep JWT_SECRET

# 2. 检查 token 是否过期
# 使用 jwt.io 解码 token 查看 exp 时间戳
```

**解决方案：**

**方案 1：重新登录获取新 token**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

**方案 2：检查 JWT 配置**
```bash
# 确认 JWT_SECRET 长度 >= 32 字符
# 确认 JWT_ACCESS_TTL 和 JWT_REFRESH_TTL 配置合理
```

**方案 3：同步服务器时间（如果 token 刚生成就过期）**
```bash
# macOS
sudo sntp -sS time.apple.com

# Linux
sudo ntpdate pool.ntp.org
```

---

#### 问题 2.4：请求速率限制

**症状：**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

**诊断：**
```bash
# 查看速率限制配置
cat .env | grep RATE_LIMIT
```

**解决方案：**

**方案 1：等待限流窗口结束**
```bash
# 默认超时时间：5000ms
# 等待几秒后重试
```

**方案 2：调整速率限制配置**
```bash
# 编辑 .env 文件
nano .env

# 增加并发数
RATE_LIMIT_MAX_CONCURRENT=20

# 增加队列长度
RATE_LIMIT_QUEUE_LIMIT=50
```

**方案 3：实现请求退避**
```javascript
// 客户端实现指数退避
async function fetchWithBackoff(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
}
```

---

### 性能问题诊断

#### 问题 3.1：Gateway 检查缓慢

**症状：**
```bash
# Gateway 检查耗时 > 1 秒
bun run src/cli/index.ts check "测试任务"
# 耗时：2500ms
```

**诊断：**
```bash
# 1. 查看性能指标
bun run src/cli/index.ts stats --metrics performance

# 2. 检查缓存命中率
bun run src/cli/index.ts stats --metrics cache

# 3. 查看 Analytics 日志
cat logs/prism-gateway.log | jq 'select(.msg == "Gateway 检查完成") | .duration'
```

**解决方案：**

**方案 1：预热缓存**
```bash
# 执行常用查询预热缓存
bun run scripts/warmup-cache.ts
```

**方案 2：调整缓存配置**
```bash
# .env 文件
ANALYTICS_CACHE_MAX_SIZE=500
ANALYTICS_CACHE_DEFAULT_TTL=600
```

**方案 3：清理旧数据**
```bash
# 归档旧复盘记录
find level-2-warm/retros -type f -mtime +90 -exec mv {} level-3-cold/archive/ \;

# 清理日志
find logs -name "*.log" -mtime +30 -delete
```

**方案 4：检查磁盘 IO**
```bash
# macOS
diskutil info /

# Linux
iostat -x 1 5

# 如果磁盘 IO 过高，考虑升级 SSD 或优化数据存储
```

---

#### 问题 3.2：内存使用过高

**症状：**
```bash
# 内存使用 > 90%
pm2 monit

# 或
ps aux | grep prism-gateway
# RSS 列显示内存占用过高
```

**诊断：**
```bash
# 1. 查看内存详情
free -h

# 2. 检查内存泄漏
# 使用 Node.js 内存分析工具
```

**解决方案：**

**方案 1：重启服务**
```bash
pm2 restart prism-gateway-api
```

**方案 2：调整内存限制**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'prism-gateway-api',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

**方案 3：优化缓存**
```bash
# 减少缓存大小
ANALYTICS_CACHE_MAX_SIZE=50
```

**方案 4：分析内存泄漏**
```javascript
// 添加内存分析
import v8 from 'v8';

setInterval(() => {
  const heapStatistics = v8.getHeapStatistics();
  console.log('Heap used:', heapStatistics.used_heap_size);
}, 60000);
```

---

### 数据问题诊断

#### 问题 4.1：原则文件损坏

**症状：**
```bash
cat level-1-hot/principles.json | jq '.principles | length'
# 错误：parse error: Invalid literal
```

**诊断：**
```bash
# 验证 JSON 格式
cat level-1-hot/principles.json | jq '.'

# 查看文件编码
file level-1-hot/principles.json
```

**解决方案：**

**方案 1：从备份恢复**
```bash
# 查找备份
ls -la /backup/prism-gateway/

# 恢复文件
cp /backup/prism-gateway/full/YYYY-MM-DD/level-1-hot/principles.json \
   ~/.prism-gateway/level-1-hot/
```

**方案 2：从模板重建**
```bash
# 使用示例模板重建
cp examples/principles.example.json level-1-hot/principles.json

# 验证格式
cat level-1-hot/principles.json | jq '.'
```

**方案 3：手动修复 JSON**
```bash
# 使用 jq 格式化并显示错误
cat level-1-hot/principles.json | jq '.' 2>&1

# 根据错误信息手动修复
nano level-1-hot/principles.json
```

---

#### 问题 4.2：违规记录丢失

**症状：**
```bash
cat level-2-warm/violations.jsonl | wc -l
# 数量明显少于预期
```

**诊断：**
```bash
# 1. 检查文件是否存在
ls -la level-2-warm/violations.jsonl

# 2. 检查备份
ls -la /backup/prism-gateway/

# 3. 查看日志中的删除记录
cat logs/prism-gateway.log | grep "删除违规"
```

**解决方案：**

**方案 1：从备份恢复**
```bash
# 停止服务
pm2 stop prism-gateway-api

# 恢复备份
cp /backup/prism-gateway/incremental/YYYY-MM-DD/level-2-warm/violations.jsonl \
   ~/.prism-gateway/level-2-warm/

# 重启服务
pm2 start prism-gateway-api
```

**方案 2：从日志重建**
```bash
# 如果日志中有违规记录，可以提取重建
cat logs/prism-gateway.log | \
  jq 'select(.msg == "Gateway 检查完成" and .status == "BLOCKED")' > \
  level-2-warm/violations.jsonl
```

---

#### 问题 4.3：数据迁移失败

**症状：**
```bash
bun run src/cli/migrate.ts
# 错误：Migration failed
```

**诊断：**
```bash
# 1. 检查迁移状态
bun run src/cli/migrate.ts --status

# 2. 查看迁移日志
cat .migration/migration.log

# 3. 验证 Phase 1 数据
cat level-1-hot/principles.json | jq '.principles | length'
```

**解决方案：**

**方案 1：执行回滚**
```bash
bun run src/cli/migrate.ts --rollback

# 验证回滚
bun run src/cli/migrate.ts --status
```

**方案 2：重新执行迁移**
```bash
# 1. 备份当前数据
./backup-full.sh

# 2. 清理迁移状态
rm -rf .migration/

# 3. 重新执行迁移
bun run src/cli/migrate.ts

# 4. 验证迁移
bun run src/cli/migrate.ts --status
```

**方案 3：手动迁移**
```bash
# 参考 MIGRATION_GUIDE.md 手动执行迁移步骤
```

---

## 故障排查树

### 完整决策树

```
用户报告问题
    │
    ├─ 问题类型？
    │   ├─ 服务无法启动
    │   │   ├─ Bun 未安装？
    │   │   │   └─ [问题 1.1](#问题-11bun-未安装或版本过低)
    │   │   ├─ 依赖安装失败？
    │   │   │   └─ [问题 1.2](#问题-12依赖安装失败)
    │   │   ├─ 端口被占用？
    │   │   │   └─ [问题 1.3](#问题-13端口被占用)
    │   │   └─ 环境变量错误？
    │   │       └─ [问题 1.4](#问题-14环境变量配置错误)
    │   │
    │   ├─ API 请求失败
    │   │   ├─ 服务无响应？
    │   │   │   └─ [问题 2.1](#问题-21api-服务无响应)
    │   │   ├─ CORS 错误？
    │   │   │   └─ [问题 2.2](#问题-22cors-错误)
    │   │   ├─ JWT 认证失败？
    │   │   │   └─ [问题 2.3](#问题-23jwt-认证失败)
    │   │   └─ 速率限制？
    │   │       └─ [问题 2.4](#问题-24请求速率限制)
    │   │
    │   ├─ 性能缓慢
    │   │   ├─ Gateway 检查慢？
    │   │   │   └─ [问题 3.1](#问题-31gateway-检查缓慢)
    │   │   └─ 内存使用高？
    │   │       └─ [问题 3.2](#问题-32内存使用过高)
    │   │
    │   └─ 数据异常
    │       ├─ 文件损坏？
    │       │   └─ [问题 4.1](#问题-41原则文件损坏)
    │       ├─ 记录丢失？
    │       │   └─ [问题 4.2](#问题-42违规记录丢失)
    │       └─ 迁移失败？
    │           └─ [问题 4.3](#问题-43数据迁移失败)
    │
    └─ 无法解决？
        └─ [获取帮助](#获取帮助)
```

---

## 特定错误码

### HTTP 错误码

| 错误码 | 名称 | 含义 | 解决方案 |
|--------|------|------|---------|
| **400** | Bad Request | 请求参数错误 | 检查请求体格式 |
| **401** | Unauthorized | 未授权 | 重新登录获取 token |
| **403** | Forbidden | 禁止访问 | 检查权限配置 |
| **404** | Not Found | 资源不存在 | 检查 API 路径 |
| **429** | Too Many Requests | 速率限制 | 等待或调整限流配置 |
| **500** | Internal Server Error | 服务器内部错误 | 查看服务器日志 |
| **502** | Bad Gateway | 网关错误 | 检查反向代理配置 |
| **503** | Service Unavailable | 服务不可用 | 检查服务状态 |

### 应用错误码

| 错误码 | 名称 | 含义 | 解决方案 |
|--------|------|------|---------|
| `PRISM_001` | INVALID_INTENT | 任务意图无效 | 提供有效的意图描述 |
| `PRISM_002` | PRINCIPLE_CHECK_FAILED | 原则检查失败 | 查看具体违规项 |
| `PRISM_003` | PATTERN_MATCH_FAILED | 模式匹配失败 | 检查模式库完整性 |
| `PRISM_004` | DATA_EXTRACTION_FAILED | 数据提取失败 | 检查数据源格式 |
| `PRISM_005` | RETRO_TRIGGER_FAILED | 复盘触发失败 | 验证复盘参数 |

---

## 获取帮助

### 日志收集

在请求帮助前，请收集以下信息：

```bash
#!/bin/bash
# collect-info.sh

INFO_FILE="prism-debug-info-$(date +%s).txt"

echo "=== ReflectGuard 调试信息 ===" > $INFO_FILE
echo "" >> $INFO_FILE

echo "1. 系统信息" >> $INFO_FILE
echo "操作系统: $(uname -a)" >> $INFO_FILE
echo "Bun 版本: $(bun --version)" >> $INFO_FILE
echo "" >> $INFO_FILE

echo "2. 服务状态" >> $INFO_FILE
pm2 status >> $INFO_FILE 2>&1
echo "" >> $INFO_FILE

echo "3. 最近错误日志（最后 50 行）" >> $INFO_FILE
tail -n 50 logs/prism-gateway.log >> $INFO_FILE
echo "" >> $INFO_FILE

echo "4. 环境变量（脱敏）" >> $INFO_FILE
cat .env | sed 's/=.*/=***REMOVED***' >> $INFO_FILE
echo "" >> $INFO_FILE

echo "5. 数据完整性" >> $INFO_FILE
echo "原则数量: $(cat level-1-hot/principles.json | jq '.principles | length')" >> $INFO_FILE
echo "成功模式: $(cat level-1-hot/patterns/success_patterns.json | jq '.total_patterns')" >> $INFO_FILE
echo "失败模式: $(cat level-1-hot/patterns/failure_patterns.json | jq '.total_patterns')" >> $INFO_FILE
echo "" >> $INFO_FILE

echo "信息已保存到: $INFO_FILE"
```

**运行收集脚本：**
```bash
chmod +x collect-info.sh
./collect-info.sh
```

### 社区支持

- **GitHub Issues：** https://github.com/your-org/prism-gateway/issues
- **Discord 社区：** https://discord.gg/prism-gateway
- **邮件支持：** support@prism-gateway.io

### 提交 Issue 模板

```markdown
## 问题描述
简要描述遇到的问题

## 复现步骤
1. 执行命令 `...`
2. 点击按钮 `...`
3. 看到错误 `...`

## 期望行为
描述期望的正确行为

## 实际行为
描述实际发生的行为

## 环境信息
- 操作系统：[macOS 14 / Ubuntu 22.04 / Windows 11]
- Bun 版本：[1.0.0]
- ReflectGuard 版本：[2.2.0]

## 错误日志
\`\`\`
[粘贴错误日志]
\`\`\`

## 调试信息
[运行 collect-info.sh 生成的文件内容]
```

---

## 预防性维护

### 定期检查脚本

```bash
#!/bin/bash
# health-check-weekly.sh

echo "=== ReflectGuard 每周健康检查 ==="

# 1. 服务状态
echo "1. 服务状态..."
curl -s http://localhost:3000/health | jq '.'

# 2. 磁盘空间
echo "2. 磁盘空间..."
df -h ~/.prism-gateway

# 3. 依赖更新
echo "3. 检查过时的包..."
bun outdated

# 4. 安全审计
echo "4. 安全审计..."
bun audit

# 5. 数据完整性
echo "5. 数据完整性..."
cat level-1-hot/principles.json | jq '.principles | length'
cat level-1-hot/patterns/success_patterns.json | jq '.total_patterns'

echo "=== 检查完成 ==="
```

**添加到 crontab：**
```bash
# 每周日上午 9 点执行
0 9 * * 0 /path/to/health-check-weekly.sh
```

---

## 相关文档

- [部署指南](./DEPLOYMENT_GUIDE.md)
- [运维手册](./OPERATIONS_MANUAL.md)
- [数据迁移指南](./MIGRATION_GUIDE.md)
- [API 文档](../api/README.md)

---

**文档维护者：** ReflectGuard Team
**许可证：** MIT License
**PAI 版本：** 2.5
