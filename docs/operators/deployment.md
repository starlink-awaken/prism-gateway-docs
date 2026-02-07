# 部署指南

ReflectGuard 的生产环境部署指南。

## 系统要求

### 硬件要求

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 1 核 | 2+ 核 |
| 内存 | 512MB | 1GB+ |
| 磁盘 | 100MB | 1GB+ |

### 软件要求

| 软件 | 版本 |
|------|------|
| Bun | >= 1.0.0 |
| Node.js | >= 20.0.0 |
| Git | >= 2.0 |

## 部署方式

### 方式 1: 直接部署

```bash
# 1. 克隆项目
git clone https://github.com/your-org/prism-gateway.git /opt/prism-gateway
cd /opt/prism-gateway

# 2. 安装依赖
bun install

# 3. 构建
bun run build

# 4. 创建用户
useradd -r -s /bin/false prism-gateway

# 5. 设置权限
chown -R prism-gateway:prism-gateway /opt/prism-gateway

# 6. 测试
sudo -u prism-gateway bun test
```

### 方式 2: Docker 部署

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
```

```bash
# 构建镜像
docker build -t prism-gateway:latest .

# 运行容器
docker run -d \
  --name prism-gateway \
  -p 3000:3000 \
  -v prism-data:/app/data \
  --restart unless-stopped \
  prism-gateway:latest
```

### 方式 3: Systemd 服务

创建 `/etc/systemd/system/prism-gateway.service`:

```ini
[Unit]
Description=ReflectGuard Service
After=network.target

[Service]
Type=simple
User=prism-gateway
WorkingDirectory=/opt/prism-gateway
Environment="NODE_ENV=production"
Environment="PRISM_GATEWAY_PATH=/var/lib/prism-gateway"
ExecStart=/usr/bin/bun run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 启用服务
systemctl enable prism-gateway
systemctl start prism-gateway

# 查看状态
systemctl status prism-gateway
```

## 环境配置

### 生产环境变量

```bash
# /etc/prism-gateway/.env
PRISM_GATEWAY_PATH=/var/lib/prism-gateway
PRISM_GATEWAY_PORT=3000
PRISM_GATEWAY_HOST=0.0.0.0

# 日志
PRISM_LOG_LEVEL=info
PRISM_LOG_FORMAT=json
PRISM_LOG_PATH=/var/log/prism-gateway

# 缓存
PRISM_CACHE_ENABLED=true
PRISM_CACHE_TTL=3600

# 分析
PRISM_ANALYTICS_ENABLED=true
PRISM_ANALYTICS_RETENTION_DAYS=90

# 安全
PRISM_API_KEY=your-production-api-key
PRISM_RATE_LIMIT_ENABLED=true
PRISM_RATE_LIMIT_MAX=100
```

## 健康检查

```bash
# HTTP 健康检查
curl http://localhost:3000/health

# 输出: {"status":"healthy","uptime":12345}
```

## 日志管理

### Logrotate 配置

创建 `/etc/logrotate.d/prism-gateway`:

```
/var/log/prism-gateway/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 prism-gateway prism-gateway
    sharedscripts
    postrotate
        systemctl reload prism-gateway > /dev/null 2>&1 || true
    endscript
}
```

## 监控配置

### Prometheus 指标

ReflectGuard 暴露以下指标：

```
# HELP prism_checks_total Total number of checks
# TYPE prism_checks_total counter
prism_checks_total{status="passed"} 1234
prism_checks_total{status="blocked"} 12
prism_checks_total{status="warning"} 45

# HELP prism_check_duration_seconds Check duration
# TYPE prism_check_duration_seconds histogram
prism_check_duration_seconds_bucket{le="0.01"} 100
prism_check_duration_seconds_bucket{le="0.05"} 500
prism_check_duration_seconds_bucket{le="+Inf"} 1000
```

### 告警规则

```yaml
groups:
  - name: prism-gateway
    rules:
      - alert: HighErrorRate
        expr: rate(prism_checks_total{status="blocked"}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(prism_check_duration_seconds_bucket[5m])) > 1
        for: 5m
        annotations:
          summary: "Response time too high"
```

## 安全加固

### 文件权限

```bash
# 设置适当的权限
chmod 750 /opt/prism-gateway
chmod 640 /etc/prism-gateway/.env
chmod 750 /var/lib/prism-gateway
chmod 750 /var/log/prism-gateway
```

### 防火墙

```bash
# 只允许本地访问
ufw allow from 127.0.0.1 to any port 3000

# 或允许特定 IP
ufw allow from 10.0.0.0/8 to any port 3000
```

## 升级流程

```bash
# 1. 备份数据
prism backup create

# 2. 停止服务
systemctl stop prism-gateway

# 3. 更新代码
cd /opt/prism-gateway
git pull origin main

# 4. 安装依赖
bun install

# 5. 运行迁移
prism migrate

# 6. 启动服务
systemctl start prism-gateway

# 7. 验证
prism health
```

---

**相关文档：**
- [监控指南](monitoring.md)
- [备份恢复](backup-recovery.md)
- [故障排查](troubleshooting.md)

---

**最后更新:** 2026-02-07
