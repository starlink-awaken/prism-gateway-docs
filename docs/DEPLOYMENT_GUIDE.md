# ReflectGuard 部署指南

> 完整的系统安装、配置和验证文档

**最后更新：** 2026-02-06
**版本：** 2.2.0
**目标读者：** 运维工程师、系统管理员

---

## 目录

- [系统要求](#系统要求)
- [快速部署](#快速部署)
- [详细安装步骤](#详细安装步骤)
- [配置说明](#配置说明)
- [验证部署](#验证部署)
- [生产环境优化](#生产环境优化)
- [部署清单](#部署清单)

---

## 系统要求

### 最低配置

| 资源 | 最低要求 | 推荐配置 | 说明 |
|------|---------|---------|------|
| **操作系统** | macOS 12+<br>Ubuntu 20.04+<br>Windows 10+ | macOS 14+<br>Ubuntu 22.04+<br>Windows 11+ | 需支持 Node.js/Bun |
| **CPU** | 2 核 | 4 核+ | 多核可提升并发性能 |
| **内存** | 2GB | 4GB+ | Analytics 模块需要更多内存 |
| **磁盘** | 500MB 可用空间 | 1GB+ | 包含日志和数据文件 |
| **网络** | 本地部署无需网络 | - | MCP Server 使用 stdio 通信 |

### 软件依赖

| 软件 | 版本要求 | 安装命令 | 验证命令 |
|------|---------|---------|---------|
| **Bun** | >= 1.0.0 | `curl -fsSL https://bun.sh/install \| bash` | `bun --version` |
| **Node.js** | >= 18.0.0 (可选) | `nvm install 18` | `node --version` |
| **Git** | >= 2.0.0 | `brew install git` | `git --version` |
| **jq** (可选) | >= 1.5 | `brew install jq` | `jq --version` |

### 权限要求

- **文件读写权限：** `~/.prism-gateway/` 目录完全访问权限
- **网络权限：** 如需使用 REST API，需绑定 0.0.0.0
- **进程权限：** 无需 root 权限（推荐使用普通用户）

---

## 快速部署

### 5 分钟快速启动（适用于开发/测试环境）

```bash
# 1. 安装 Bun（如果未安装）
curl -fsSL https://bun.sh/install | bash

# 2. 克隆或进入项目目录
cd ~/.prism-gateway

# 3. 安装依赖
bun install

# 4. 复制环境变量配置
cp .env.example .env

# 5. 验证安装
bun test

# 6. 启动 API 服务（可选）
bun run api

# 7. 在另一个终端测试 API
curl http://localhost:3000/health
```

**预期输出：**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-06T10:00:00.000Z",
  "uptime": 1.234
}
```

---

## 详细安装步骤

### 步骤 1：环境准备

#### 1.1 检查系统兼容性

```bash
# 检查操作系统
uname -a

# 检查可用磁盘空间
df -h ~

# 检查内存
free -h  # Linux
vm_stat  # macOS
```

#### 1.2 安装 Bun

**macOS/Linux：**
```bash
curl -fsSL https://bun.sh/install | bash
# 重启终端或运行：
source ~/.bashrc  # 或 ~/.zshrc
```

**Windows：**
```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

**验证安装：**
```bash
bun --version
# 输出版本 >= 1.0.0
```

#### 1.3 安装可选工具

```bash
# jq：用于 JSON 格式化输出（推荐）
brew install jq  # macOS
sudo apt-get install jq  # Ubuntu

# tree：用于查看目录结构
brew install tree  # macOS
sudo apt-get install tree  # Ubuntu
```

### 步骤 2：项目部署

#### 2.1 获取项目代码

**方式 1：从 GitHub 克隆**
```bash
git clone https://github.com/your-org/prism-gateway.git ~/.prism-gateway
cd ~/.prism-gateway
```

**方式 2：从压缩包解压**
```bash
tar -xzf prism-gateway-v2.2.0.tar.gz -C ~/
cd ~/.prism-gateway
```

#### 2.2 安装项目依赖

```bash
# 使用 Bun 安装依赖（推荐）
bun install

# 如果 Bun 不可用，回退到 npm
npm install

# 验证依赖安装
ls node_modules | head -20
```

**预期输出：**
```
@hono/node-server
@modelcontextprotocol/sdk
commander
hono
pino
typescript
...
```

#### 2.3 创建必要目录

```bash
# 创建三层 MEMORY 结构
mkdir -p level-1-hot/patterns
mkdir -p level-1-hot/traps
mkdir -p level-2-warm/retros
mkdir -p level-3-cold/sops
mkdir -p level-3-cold/checklists
mkdir -p level-3-cold/templates

# 创建 Phase 2 新目录
mkdir -p analytics
mkdir -p cache
mkdir -p config
mkdir -p logs
mkdir -p .migration

# 验证目录结构
tree -L 2
```

### 步骤 3：配置环境

#### 3.1 创建环境变量文件

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置文件
nano .env  # 或使用 vim、code 等
```

#### 3.2 最小化配置（开发环境）

```bash
# .env 文件内容
NODE_ENV=development
PORT=3000
HOSTNAME=0.0.0.0
JWT_SECRET=dev-secret-key-change-in-production-32chars
LOG_LEVEL=debug
PRISM_DATA_ROOT=~/.prism-gateway
```

#### 3.3 生产环境配置

```bash
# .env 文件内容
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# CORS 安全配置（重要！）
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://app.your-domain.com

# JWT 认证（使用强随机密钥）
JWT_SECRET=<使用 openssl rand -base64 32 生成>
JWT_ACCESS_TTL=3600
JWT_REFRESH_TTL=604800

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json

# 数据存储
PRISM_DATA_ROOT=/var/lib/prism-gateway

# 速率限制
RATE_LIMIT_MAX_CONCURRENT=10
RATE_LIMIT_TIMEOUT=5000
RATE_LIMIT_QUEUE_LIMIT=20
```

**生成 JWT 密钥：**
```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 步骤 4：数据初始化

#### 4.1 初始化 Hot 数据

```bash
# 验证原则文件
cat level-1-hot/principles.json | jq '.principles | length'
# 输出应为 5

# 验证模式文件
cat level-1-hot/patterns/success_patterns.json | jq '.total_patterns'
# 输出应为 23

cat level-1-hot/patterns/failure_patterns.json | jq '.total_patterns'
# 输出应为 9
```

#### 4.2 运行数据迁移（如果从 Phase 1 升级）

```bash
# 预检查迁移
bun run src/cli/migrate.ts --dry-run

# 执行迁移
bun run src/cli/migrate.ts

# 验证迁移状态
bun run src/cli/migrate.ts --status
```

**详细迁移指南：** [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

### 步骤 5：启动服务

#### 5.1 启动 CLI 服务

```bash
# 运行 Gateway 检查
bun run src/cli/index.ts check "实现用户登录功能"

# 查看系统状态
bun run src/cli/index.ts status

# 查看统计信息
bun run src/cli/index.ts stats
```

#### 5.2 启动 API 服务

**开发模式：**
```bash
bun run api:dev
# 或
NODE_ENV=development bun run src/api/server.ts
```

**生产模式：**
```bash
NODE_ENV=production bun run src/api/server.ts
```

#### 5.3 启动 MCP Server（可选）

MCP Server 通过 stdio 通信，由客户端直接调用：

```bash
# 在 Claude Desktop 配置文件中添加：
# ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "prism-gateway": {
      "command": "bun",
      "args": ["/path/to/prism-gateway/src/integration/mcp/index.ts"]
    }
  }
}
```

---

## 配置说明

### 环境变量完整列表

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `NODE_ENV` | string | `development` | 运行环境：development/production/test |
| `PORT` | number | `3000` | API 服务端口 |
| `HOSTNAME` | string | `0.0.0.0` | API 服务绑定地址 |
| `CORS_ALLOWED_ORIGINS` | string | - | 允许的跨域来源（逗号分隔） |
| `JWT_SECRET` | string | - | JWT 签名密钥（至少 32 字符） |
| `JWT_ACCESS_TTL` | number | `3600` | 访问令牌有效期（秒） |
| `JWT_REFRESH_TTL` | number | `604800` | 刷新令牌有效期（秒） |
| `JWT_ISSUER` | string | `prism-gateway` | JWT 签发者 |
| `JWT_AUDIENCE` | string | `prism-gateway-api` | JWT 目标受众 |
| `PRISM_DATA_ROOT` | string | `~/.prism-gateway` | 数据根目录 |
| `LOG_LEVEL` | string | `info` | 日志级别：debug/info/warn/error |
| `LOG_FORMAT` | string | `json` | 日志格式：json/text |
| `RATE_LIMIT_MAX_CONCURRENT` | number | `10` | 最大并发请求数 |
| `RATE_LIMIT_TIMEOUT` | number | `5000` | 请求超时时间（毫秒） |
| `RATE_LIMIT_QUEUE_LIMIT` | number | `20` | 队列最大长度 |
| `ANALYTICS_CACHE_MAX_SIZE` | number | `100` | 缓存最大条目数 |
| `ANALYTICS_CACHE_DEFAULT_TTL` | number | `300` | 缓存默认 TTL（秒） |
| `MCP_SERVER_NAME` | string | `prism-gateway` | MCP 服务名称 |
| `MCP_SERVER_VERSION` | string | `2.0.0` | MCP 服务版本 |

### 配置文件结构

```
~/.prism-gateway/
├── .env                          # 环境变量（不提交到版本控制）
├── .env.example                  # 环境变量示例
├── hooks.config.json             # Git Hooks 配置
├── tsconfig.json                 # TypeScript 配置
├── package.json                  # 项目依赖
└── level-1-hot/                  # 热数据目录
    ├── principles.json           # 5 条行为准则
    ├── patterns/                 # 成功/失败模式
    └── traps/                    # 常见陷阱
```

### 安全配置建议

#### 1. CORS 配置（重要）

**开发环境：**
```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**生产环境：**
```bash
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://app.your-domain.com
```

**注意事项：**
- 不要使用通配符 `*`（除非有特殊需求）
- 必须包含完整 URL（协议 + 域名 + 端口）
- 不要有多余空格
- 生产环境必须明确配置

#### 2. JWT 密钥管理

**生成强密钥：**
```bash
# 方法 1：使用 OpenSSL
openssl rand -base64 32

# 方法 2：使用 Bun
bun -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**存储建议：**
- 使用环境变量存储（不写入 .env 文件）
- 使用密钥管理服务（如 AWS Secrets Manager）
- 定期轮换密钥（建议每 90 天）
- 不要在代码中硬编码

#### 3. 数据目录权限

```bash
# 设置适当的文件权限
chmod 700 ~/.prism-gateway
chmod 600 ~/.prism-gateway/.env

# 确保日志目录可写
chmod 755 ~/.prism-gateway/logs
```

---

## 验证部署

### 自动化验证脚本

```bash
#!/bin/bash
# verify-deployment.sh

echo "=== ReflectGuard 部署验证 ==="
echo ""

# 1. 检查 Bun 版本
echo "1. 检查 Bun 版本..."
bun_version=$(bun --version)
if [ $? -eq 0 ]; then
  echo "   ✅ Bun 版本: $bun_version"
else
  echo "   ❌ Bun 未安装或版本不符合要求"
  exit 1
fi

# 2. 检查目录结构
echo "2. 检查目录结构..."
required_dirs=(
  "level-1-hot"
  "level-2-warm"
  "level-3-cold"
  "src"
  "analytics"
  "cache"
  "logs"
)
for dir in "${required_dirs[@]}"; do
  if [ -d "$dir" ]; then
    echo "   ✅ $dir/"
  else
    echo "   ❌ $dir/ 不存在"
  fi
done

# 3. 检查数据文件
echo "3. 检查数据文件..."
if [ -f "level-1-hot/principles.json" ]; then
  count=$(cat level-1-hot/principles.json | jq '.principles | length')
  echo "   ✅ principles.json ($count 条原则)"
else
  echo "   ❌ principles.json 不存在"
fi

# 4. 运行测试
echo "4. 运行测试套件..."
bun test > /tmp/prism-test.log 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ 所有测试通过"
else
  echo "   ❌ 测试失败，查看日志: /tmp/prism-test.log"
fi

# 5. 检查 API 服务
echo "5. 检查 API 服务..."
curl -s http://localhost:3000/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ API 服务运行正常"
else
  echo "   ⚠️  API 服务未启动或端口被占用"
fi

echo ""
echo "=== 验证完成 ==="
```

**运行验证：**
```bash
chmod +x verify-deployment.sh
./verify-deployment.sh
```

### 功能验证检查清单

#### 基础功能

- [ ] **CLI 命令可用**
  ```bash
  bun run src/cli/index.ts --help
  ```

- [ ] **Gateway 检查功能**
  ```bash
  bun run src/cli/index.ts check "测试任务"
  ```

- [ ] **数据读取功能**
  ```bash
  bun run src/cli/index.ts principles
  ```

- [ ] **统计功能**
  ```bash
  bun run src/cli/index.ts stats
  ```

#### API 功能

- [ ] **健康检查**
  ```bash
  curl http://localhost:3000/health
  ```

- [ ] **Gateway 检查 API**
  ```bash
  curl -X POST http://localhost:3000/api/gateway/check \
    -H "Content-Type: application/json" \
    -d '{"intent":"测试任务"}'
  ```

- [ ] **认证功能**
  ```bash
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"password"}'
  ```

#### MCP 功能

- [ ] **MCP Server 启动**
  ```bash
  bun run src/integration/mcp/index.ts
  ```

- [ ] **工具调用**
  ```json
  // 通过 Claude Desktop 调用 gateway_check 工具
  ```

#### 性能验证

- [ ] **Gateway 检查响应时间 < 1000ms**
- [ ] **内存使用 < 500MB（空闲状态）**
- [ ] **日志输出正常**

---

## 生产环境优化

### 系统级优化

#### 1. 进程管理（PM2）

**安装 PM2：**
```bash
bun global add pm2
```

**创建 ecosystem.config.js：**
```javascript
module.exports = {
  apps: [
    {
      name: 'prism-gateway-api',
      script: 'src/api/server.ts',
      interpreter: 'bun',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
```

**启动服务：**
```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs prism-gateway-api

# 设置开机自启
pm2 startup
pm2 save
```

#### 2. 反向代理（Nginx）

**Nginx 配置示例：**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;

    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/prism-gateway-access.log;
    error_log /var/log/nginx/prism-gateway-error.log;

    # 反向代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件（如果需要）
    location /static/ {
        alias /var/www/prism-gateway/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**重启 Nginx：**
```bash
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
```

#### 3. 日志轮转（logrotate）

**创建 logrotate 配置：**
```bash
sudo nano /etc/logrotate.d/prism-gateway
```

**配置内容：**
```
/var/log/prism-gateway/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 prism-gateway adm
    sharedscripts
    postrotate
        pm2 reload prism-gateway-api
    endscript
}
```

**测试配置：**
```bash
sudo logrotate -d /etc/logrotate.d/prism-gateway
```

### 应用级优化

#### 1. 缓存配置

**Analytics 缓存：**
```bash
# .env 配置
ANALYTICS_CACHE_MAX_SIZE=1000
ANALYTICS_CACHE_DEFAULT_TTL=3600
```

**文件系统缓存：**
```bash
# 使用 tmpfs 挂载缓存目录（Linux）
sudo mount -t tmpfs -o size=100M tmpfs /var/lib/prism-gateway/cache
```

#### 2. 速率限制调整

**高并发场景：**
```bash
RATE_LIMIT_MAX_CONCURRENT=50
RATE_LIMIT_TIMEOUT=3000
RATE_LIMIT_QUEUE_LIMIT=100
```

**低并发场景：**
```bash
RATE_LIMIT_MAX_CONCURRENT=5
RATE_LIMIT_TIMEOUT=10000
RATE_LIMIT_QUEUE_LIMIT=10
```

#### 3. 日志级别调整

**生产环境：**
```bash
LOG_LEVEL=warn  # 减少 debug 日志
LOG_FORMAT=json  # 结构化日志
```

### 监控和告警

#### 1. 健康检查

**创建健康检查脚本：**
```bash
#!/bin/bash
# health-check.sh

response=$(curl -s http://localhost:3000/health)
status=$(echo $response | jq -r '.status')

if [ "$status" != "healthy" ]; then
  echo "健康检查失败: $response"
  # 发送告警
  exit 1
fi

echo "健康检查通过"
exit 0
```

**添加到 crontab：**
```bash
# 每 5 分钟检查一次
*/5 * * * * /path/to/health-check.sh
```

#### 2. 性能监控

**使用 Analytics Service：**
```bash
# 查看今日统计
bun run src/cli/index.ts stats --period today

# 查看性能指标
bun run src/cli/index.ts stats --period today --metrics performance
```

---

## 部署清单

### 部署前检查

- [ ] 系统要求满足（操作系统、CPU、内存、磁盘）
- [ ] Bun 已安装（版本 >= 1.0.0）
- [ ] 可选工具已安装（jq、tree）
- [ ] 网络端口可用（3000）
- [ ] 文件权限正确

### 部署步骤检查

- [ ] 项目代码已部署
- [ ] 依赖已安装（`bun install`）
- [ ] 目录结构已创建
- [ ] 环境变量已配置（`.env` 文件）
- [ ] JWT 密钥已生成（生产环境）
- [ ] CORS 已配置（生产环境）
- [ ] 数据已初始化
- [ ] 数据迁移已完成（如果从 Phase 1 升级）

### 验证检查

- [ ] 所有测试通过（`bun test`）
- [ ] CLI 功能正常（`check`、`stats`、`principles`）
- [ ] API 服务启动正常（`/health` 返回 200）
- [ ] Gateway 检查功能正常（响应时间 < 1000ms）
- [ ] 认证功能正常（如果启用）
- [ ] MCP Server 可用（如果需要）
- [ ] 日志输出正常

### 生产环境额外检查

- [ ] PM2 进程管理已配置
- [ ] Nginx 反向代理已配置
- [ ] SSL 证书已安装
- [ ] 日志轮转已配置
- [ ] 健康检查已配置
- [ ] 监控告警已配置
- [ ] 备份策略已制定
- [ ] 回滚方案已准备

### 安全检查

- [ ] `.env` 文件未提交到版本控制
- [ ] JWT 密钥强度足够（至少 32 字符）
- [ ] CORS 配置正确（不使用通配符）
- [ ] 日志不包含敏感信息
- [ ] 文件权限正确（`.env` 600，数据目录 700）
- [ ] 依赖包无已知漏洞（`bun audit`）

---

## 常见问题

### Q1: Bun 安装失败怎么办？

**A:** 尝试以下方法：

1. 检查网络连接
2. 使用代理：`curl -x http://proxy:port -fsSL https://bun.sh/install | bash`
3. 手动下载二进制文件
4. 使用 npm 作为回退方案

### Q2: 端口 3000 被占用怎么办？

**A:** 修改 `.env` 文件中的 `PORT` 配置：

```bash
PORT=3001  # 或其他可用端口
```

### Q3: 如何在不使用 Bun 的情况下部署？

**A:** 使用 npm 作为回退方案：

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 启动服务
node src/api/server.ts
```

### Q4: 数据迁移失败怎么办？

**A:** 参考详细故障排查指南：[TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

---

## 相关文档

- [运维手册](./OPERATIONS_MANUAL.md)
- [故障排查指南](./TROUBLESHOOTING_GUIDE.md)
- [数据迁移指南](./MIGRATION_GUIDE.md)
- [MCP Server 使用文档](./mcp-server.md)
- [API 文档](../api/README.md)

---

**文档维护者：** ReflectGuard Team
**许可证：** MIT License
**PAI 版本：** 2.5
