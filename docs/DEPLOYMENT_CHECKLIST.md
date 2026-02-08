# ReflectGuard 部署快速清单

> 部署、验证和运维的快速检查清单

**最后更新：** 2026-02-06
**版本：** 2.2.0

---

## 📋 快速部署检查清单

### 部署前准备

#### 系统要求检查
- [ ] 操作系统：macOS 12+ / Ubuntu 20.04+ / Windows 10+
- [ ] CPU：>= 2 核
- [ ] 内存：>= 2GB
- [ ] 磁盘：>= 500MB 可用空间
- [ ] Bun：>= 1.0.0 已安装

#### 网络和权限检查
- [ ] 端口 3000 可用
- [ ] 文件读写权限：`~/.prism-gateway/` 可访问
- [ ] 网络连接：可访问 npm registry

---

## 🚀 5 分钟快速部署

```bash
# 1. 安装 Bun（如果未安装）
curl -fsSL https://bun.sh/install | bash

# 2. 进入项目目录
cd ~/.prism-gateway

# 3. 安装依赖
bun install

# 4. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 5. 验证安装
bun test

# 6. 启动服务
bun run api
```

---

## ✅ 部署验证清单

### 基础功能验证
- [ ] **CLI 可用**
  ```bash
  bun run src/cli/index.ts --help
  ```

- [ ] **Gateway 检查**
  ```bash
  bun run src/cli/index.ts check "测试任务"
  # 预期：返回 PASS/WARNING/BLOCKED
  ```

- [ ] **数据读取**
  ```bash
  bun run src/cli/index.ts principles
  # 预期：显示 5 条原则
  ```

- [ ] **统计功能**
  ```bash
  bun run src/cli/index.ts stats
  # 预期：显示统计数据
  ```

### API 功能验证
- [ ] **健康检查**
  ```bash
  curl http://localhost:3000/health
  # 预期：{"status":"healthy",...}
  ```

- [ ] **Gateway 检查 API**
  ```bash
  curl -X POST http://localhost:3000/api/gateway/check \
    -H "Content-Type: application/json" \
    -d '{"intent":"测试任务"}'
  # 预期：返回检查结果
  ```

### 性能验证
- [ ] **响应时间**：Gateway 检查 < 1000ms
- [ ] **内存使用**：空闲状态 < 500MB
- [ ] **日志输出**：正常且无大量 ERROR

---

## 🔧 生产环境部署清单

### 安全配置
- [ ] **JWT 密钥**：使用强随机密钥（>= 32 字符）
  ```bash
  openssl rand -base64 32
  ```

- [ ] **CORS 配置**：明确配置允许的域名
  ```bash
  CORS_ALLOWED_ORIGINS=https://your-domain.com
  ```

- [ ] **文件权限**
  ```bash
  chmod 600 ~/.prism-gateway/.env
  chmod 700 ~/.prism-gateway
  ```

- [ ] **依赖审计**
  ```bash
  bun audit
  ```

### 进程管理（PM2）
- [ ] **安装 PM2**
  ```bash
  bun global add pm2
  ```

- [ ] **创建配置文件** `ecosystem.config.js`
  ```javascript
  module.exports = {
    apps: [{
      name: 'prism-gateway-api',
      script: 'src/api/server.ts',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }]
  };
  ```

- [ ] **启动服务**
  ```bash
  pm2 start ecosystem.config.js
  pm2 save
  pm2 startup
  ```

### 反向代理（Nginx）
- [ ] **配置 SSL 证书**
- [ ] **配置反向代理**
- [ ] **启用 gzip 压缩**
- [ ] **配置日志轮转**

### 备份配置
- [ ] **配置自动备份**（每日）
- [ ] **测试恢复流程**
- [ ] **配置远程备份**（可选）

---

## 📊 每日运维检查清单

### 服务健康
- [ ] API 服务状态：`curl http://localhost:3000/health`
- [ ] PM2 进程状态：`pm2 status`
- [ ] 系统资源：CPU < 80%, 内存 < 80%, 磁盘 > 20%

### 日志检查
- [ ] 查看错误日志：`grep "ERROR" logs/prism-gateway.log`
- [ ] 今日违规数量：`cat level-2-warm/violations.jsonl | grep "$(date +%Y-%m-%d)" | wc -l`

### 数据完整性
- [ ] 原则文件：`cat level-1-hot/principles.json | jq '.principles | length'` → 5
- [ ] 成功模式：`cat level-1-hot/patterns/success_patterns.json | jq '.total_patterns'` → 23
- [ ] 失败模式：`cat level-1-hot/patterns/failure_patterns.json | jq '.total_patterns'` → 9

---

## 🚨 应急响应清单

### P0 故障（服务完全不可用）
**响应时间：< 15 分钟**

1. **立即通知**团队
2. **停止服务**：`pm2 stop prism-gateway-api`
3. **评估影响**：检查数据完整性
4. **快速修复**或**回滚**
   ```bash
   ./rollback.sh v2.1.0
   ```
5. **验证恢复**：`./verify-deployment.sh`
6. **通知用户**

### P1 故障（严重功能异常）
**响应时间：< 1 小时**

1. **诊断问题**：查看日志
2. **执行修复**：参考故障排查指南
3. **验证修复**：测试功能
4. **更新文档**：记录问题和解决方案

### P2 故障（性能下降）
**响应时间：< 4 小时**

1. **性能分析**：查看性能指标
2. **优化配置**：调整缓存、速率限制
3. **监控改进**：添加告警规则

---

## 📚 常用命令速查

### 服务管理
```bash
# 启动服务
pm2 start prism-gateway-api

# 停止服务
pm2 stop prism-gateway-api

# 重启服务
pm2 restart prism-gateway-api

# 查看状态
pm2 status

# 查看日志
pm2 logs prism-gateway-api
```

### 日志查询
```bash
# 查看实时日志
tail -f logs/prism-gateway.log

# 查看错误日志
grep "ERROR" logs/prism-gateway.log

# 统计错误数量
cat logs/prism-gateway.log | jq -r '.level' | sort | uniq -c

# 查询特定时间
grep "2026-02-06" logs/prism-gateway.log
```

### 数据管理
```bash
# 备份数据
./backup-full.sh

# 恢复数据
./restore.sh /backup/prism-gateway/full/YYYY-MM-DD.tar.gz

# 验证备份
./verify-backup.sh /backup/prism-gateway/full/YYYY-MM-DD.tar.gz

# 清理旧日志
find logs/ -name "*.log" -mtime +30 -delete
```

### 性能监控
```bash
# 查看性能指标
bun run src/cli/index.ts stats --metrics performance

# 查看缓存统计
bun run src/cli/index.ts stats --metrics cache

# 清除缓存
bun run src/cli/index.ts cache-clear
```

---

## 🔗 相关文档链接

- **完整部署指南**：[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **运维手册**：[OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md)
- **故障排查指南**：[TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
- **数据迁移指南**：[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- **MCP Server 文档**：[mcp-server.md](./mcp-server.md)
- **API 文档**：[../api/README.md](../api/README.md)

---

## 📞 获取帮助

### 收集诊断信息
```bash
# 运行诊断脚本
chmod +x collect-info.sh
./collect-info.sh
```

### 提交 Issue
1. 收集日志和诊断信息
2. 复现问题
3. 提交到：https://github.com/your-org/prism-gateway/issues

### 社区支持
- **GitHub Issues**：https://github.com/your-org/prism-gateway/issues
- **Discord 社区**：https://discord.gg/prism-gateway
- **邮件支持**：support@prism-gateway.io

---

**文档维护者：** ReflectGuard Team
**许可证：** MIT License
**PAI 版本：** 2.5
