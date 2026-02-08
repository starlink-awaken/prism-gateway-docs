# 检查清单：运维工具部署 (Operations Tools Deployment Checklist)

> **版本**: 1.0.0
> **最后更新**: 2026-02-07
> **适用场景**: 部署备份、监控、告警系统

---

## 目的

本检查清单用于确保运维工具（Backup, HealthCheck, Metrics, Alerting）正确部署和配置，满足生产环境要求。

---

## 使用说明

- ✅ = 已完成并验证
- ⏳ = 进行中
- ❌ = 未完成或验证失败
- N/A = 不适用

---

## 1. 部署前准备

### 1.1 环境验证

- [ ] **系统要求检查**
  - [ ] OS: Linux / macOS
  - [ ] Bun 版本 >= 1.0
  - [ ] Node.js 版本 >= 18 (备用)
  - [ ] 可用磁盘空间 >= 10GB
  - [ ] 可用内存 >= 4GB

- [ ] **依赖检查**
  - [ ] `gzip` 已安装（备份压缩）
  - [ ] `tar` 已安装（归档）
  - [ ] `curl` 已安装（健康检查）
  - [ ] `jq` 已安装（JSON 处理）

- [ ] **权限验证**
  - [ ] 用户对 `~/.prism-gateway` 目录有读写权限
  - [ ] 用户对 `~/.prism-gateway-backups` 目录有读写权限
  - [ ] 用户可以创建系统服务（可选，systemd）

### 1.2 配置备份

- [ ] **备份当前配置**
  ```bash
  cp -r ~/.prism-gateway/config ~/.prism-gateway/config.backup.$(date +%Y%m%d)
  ```

- [ ] **备份当前数据**
  ```bash
  prism backup create --type full --comment "Pre-deployment backup"
  ```

### 1.3 文档准备

- [ ] 已阅读 [PHASE3_WEEK4_IMPLEMENTATION_PLAN.md](../../../../reports/PHASE3_WEEK4_IMPLEMENTATION_PLAN.md)
- [ ] 已阅读 [backup-operations.md SOP](../sops/backup-operations.md)
- [ ] 已阅读 [monitoring-operations.md SOP](../sops/monitoring-operations.md)
- [ ] 准备回滚计划

---

## 2. BackupService 部署

### 2.1 代码部署

- [ ] **拉取最新代码**
  ```bash
  cd ~/.prism-gateway
  git pull origin main
  ```

- [ ] **安装依赖**
  ```bash
  bun install
  ```

- [ ] **编译 TypeScript**
  ```bash
  bun run build
  ```

- [ ] **验证编译产物**
  ```bash
  ls -lh dist/infrastructure/backup/
  # 应包含: BackupService.js, BackupEngine.js, StorageManager.js, BackupScheduler.js
  ```

### 2.2 配置部署

- [ ] **创建备份配置文件**
  ```bash
  cat > ~/.prism-gateway/config/backup.json <<EOF
  {
    "backup": {
      "enabled": true,
      "storage_path": "~/.prism-gateway-backups",
      "retention_policy": {
        "full_backups_count": 7,
        "full_backups_age_days": 7,
        "incremental_backups_count": 30,
        "incremental_backups_age_days": 30,
        "max_total_backups": 50
      },
      "schedule": {
        "full_backup": "0 2 * * 0",
        "incremental_backup": "0 3 * * 1-5",
        "cleanup": "0 4 * * 0"
      },
      "compression": {
        "enabled": true,
        "level": 9
      },
      "checksum": {
        "algorithm": "sha256",
        "verify_on_restore": true
      }
    }
  }
  EOF
  ```

- [ ] **验证配置文件**
  ```bash
  jq . ~/.prism-gateway/config/backup.json
  # 确保 JSON 格式正确
  ```

- [ ] **创建备份目录**
  ```bash
  mkdir -p ~/.prism-gateway-backups
  chmod 750 ~/.prism-gateway-backups
  ```

### 2.3 功能测试

- [ ] **测试手动全量备份**
  ```bash
  prism backup create --type full --comment "Deployment test"
  # 预期: 完成时间 <30s, 压缩率 >70%
  ```

- [ ] **测试备份列表**
  ```bash
  prism backup list
  # 预期: 显示刚创建的备份
  ```

- [ ] **测试备份验证**
  ```bash
  prism backup verify <backup-id>
  # 预期: status: completed, checksum: verified
  ```

- [ ] **测试备份恢复（到临时目录）**
  ```bash
  mkdir -p /tmp/restore-test
  prism backup restore <backup-id> --target /tmp/restore-test --confirm
  # 预期: 恢复成功，文件完整
  ```

- [ ] **测试增量备份**
  ```bash
  # 修改一个文件
  echo "test" >> ~/.prism-gateway/level-2-warm/test.txt
  prism backup create --type incremental --comment "Incremental test"
  # 预期: 仅包含变更文件
  ```

- [ ] **测试自动清理**
  ```bash
  prism backup cleanup --dry-run
  # 预期: 显示将被清理的备份
  ```

### 2.4 调度器部署

- [ ] **启动备份调度器**
  ```bash
  prism backup schedule start
  # 或: systemctl start prism-backup-scheduler (如果使用 systemd)
  ```

- [ ] **验证调度器状态**
  ```bash
  prism backup schedule status
  # 预期: status: running
  ```

- [ ] **检查调度任务**
  ```bash
  prism backup schedule list
  # 预期: 显示 3 个调度任务（全量、增量、清理）
  ```

---

## 3. HealthCheckService 部署

### 3.1 代码部署

- [ ] **验证编译产物**
  ```bash
  ls -lh dist/infrastructure/health/
  # 应包含: HealthCheckService.js, HealthChecker.js, 7 个检查器文件
  ```

### 3.2 配置部署

- [ ] **创建健康检查配置文件**
  ```bash
  cat > ~/.prism-gateway/config/health-check.json <<EOF
  {
    "health_check": {
      "enabled": true,
      "checkers": {
        "system": { "enabled": true, "interval": 30, "priority": "critical" },
        "disk": { "enabled": true, "interval": 60, "priority": "high" },
        "api": { "enabled": true, "interval": 30, "priority": "critical" },
        "websocket": { "enabled": true, "interval": 60, "priority": "high" },
        "data": { "enabled": true, "interval": 120, "priority": "medium" },
        "service": { "enabled": true, "interval": 120, "priority": "medium" },
        "network": { "enabled": true, "interval": 120, "priority": "low" }
      },
      "thresholds": {
        "cpu_usage": 80,
        "memory_usage": 90,
        "disk_usage": 90
      },
      "auto_heal": {
        "enabled": true,
        "actions": ["restart_service", "clear_cache", "rotate_logs"]
      }
    }
  }
  EOF
  ```

- [ ] **验证配置文件**
  ```bash
  jq . ~/.prism-gateway/config/health-check.json
  ```

### 3.3 功能测试

- [ ] **测试单个检查器**
  ```bash
  prism health check system
  # 预期: status: healthy, 耗时 <100ms
  ```

- [ ] **测试所有检查器**
  ```bash
  prism health
  # 预期: 7 个检查器全部返回结果
  ```

- [ ] **测试健康历史**
  ```bash
  prism health history --hours 1
  # 预期: 显示历史记录
  ```

- [ ] **测试健康趋势**
  ```bash
  prism health trend --days 7
  # 预期: 显示趋势图
  ```

### 3.4 服务部署

- [ ] **启动健康检查服务**
  ```bash
  prism health start
  # 或: systemctl start prism-health-check (如果使用 systemd)
  ```

- [ ] **验证服务状态**
  ```bash
  prism health status
  # 预期: status: running, uptime: >0s
  ```

- [ ] **检查后台日志**
  ```bash
  tail -f ~/.prism-gateway/logs/health-check.log
  # 预期: 定期输出健康检查结果
  ```

---

## 4. MetricsService 部署

### 4.1 代码部署

- [ ] **验证编译产物**
  ```bash
  ls -lh dist/infrastructure/metrics/
  # 应包含: MetricsService.js, 6 个采集器文件, MetricsStorage.js, QueryEngine.js
  ```

### 4.2 配置部署

- [ ] **创建监控配置文件**
  ```bash
  cat > ~/.prism-gateway/config/metrics.json <<EOF
  {
    "metrics": {
      "enabled": true,
      "collectors": {
        "system": { "enabled": true, "interval": 1 },
        "process": { "enabled": true, "interval": 5 },
        "api": { "enabled": true, "interval": 1 },
        "websocket": { "enabled": true, "interval": 5 },
        "business": { "enabled": true, "interval": 5 },
        "data": { "enabled": true, "interval": 60 }
      },
      "storage": {
        "path": "~/.prism-gateway/level-2-warm/metrics",
        "retention": {
          "raw": "1h",
          "1m": "24h",
          "5m": "7d",
          "1h": "30d"
        }
      },
      "concurrency": 5
    }
  }
  EOF
  ```

- [ ] **验证配置文件**
  ```bash
  jq . ~/.prism-gateway/config/metrics.json
  ```

- [ ] **创建指标存储目录**
  ```bash
  mkdir -p ~/.prism-gateway/level-2-warm/metrics/{raw,1m,5m,1h}
  ```

### 4.3 功能测试

- [ ] **测试实时指标**
  ```bash
  prism metrics
  # 预期: 显示系统、业务、性能指标
  ```

- [ ] **测试指标查询**
  ```bash
  prism metrics query system_cpu_usage --from "1 hour ago" --to now
  # 预期: 返回时序数据
  ```

- [ ] **测试指标聚合**
  ```bash
  prism metrics query system_cpu_usage \
    --from "24 hours ago" \
    --group-by 1h \
    --agg avg
  # 预期: 返回每小时平均值
  ```

- [ ] **测试指标导出**
  ```bash
  prism metrics export --metric system_cpu_usage --format csv --output /tmp/test.csv
  # 预期: 生成 CSV 文件
  ```

### 4.4 服务部署

- [ ] **启动指标采集服务**
  ```bash
  prism metrics start
  # 或: systemctl start prism-metrics (如果使用 systemd)
  ```

- [ ] **验证服务状态**
  ```bash
  prism metrics status
  # 预期: status: running, collectors: 6 active
  ```

- [ ] **检查后台日志**
  ```bash
  tail -f ~/.prism-gateway/logs/metrics.log
  # 预期: 定期输出采集日志
  ```

---

## 5. AlertingService 部署

### 5.1 代码部署

- [ ] **验证编译产物**
  ```bash
  ls -lh dist/infrastructure/alerting/
  # 应包含: AlertingService.js, AlertRuleEngine.js, AlertNotifier.js, AlertDeduplicator.js
  ```

### 5.2 配置部署

- [ ] **创建告警配置文件**
  ```bash
  cat > ~/.prism-gateway/config/alerting.json <<EOF
  {
    "alerting": {
      "enabled": true,
      "notifications": {
        "console": {
          "enabled": true,
          "severity_filter": ["critical", "high"]
        },
        "file": {
          "enabled": true,
          "path": "~/.prism-gateway/logs/alerts.log",
          "severity_filter": ["critical", "high", "medium"]
        },
        "webhook": {
          "enabled": false,
          "url": "https://example.com/webhook/alerts"
        }
      },
      "deduplication": {
        "enabled": true,
        "window": 300
      },
      "throttling": {
        "enabled": true,
        "max_per_minute": 10
      }
    }
  }
  EOF
  ```

- [ ] **验证配置文件**
  ```bash
  jq . ~/.prism-gateway/config/alerting.json
  ```

### 5.3 规则配置

- [ ] **创建默认告警规则**
  ```bash
  # CPU 使用率高
  prism alerts rule create \
    --name "High CPU Usage" \
    --type threshold \
    --metric "system_cpu_usage" \
    --operator ">" \
    --threshold 80 \
    --duration "5m" \
    --severity high

  # 磁盘使用率高
  prism alerts rule create \
    --name "High Disk Usage" \
    --type threshold \
    --metric "system_disk_usage" \
    --operator ">" \
    --threshold 90 \
    --duration "1m" \
    --severity critical

  # API 延迟高
  prism alerts rule create \
    --name "High API Latency" \
    --type threshold \
    --metric "api_request_latency_p95" \
    --operator ">" \
    --threshold 100 \
    --duration "5m" \
    --severity medium
  ```

- [ ] **验证规则列表**
  ```bash
  prism alerts rule list
  # 预期: 显示 3+ 条规则
  ```

### 5.4 功能测试

- [ ] **测试告警创建**
  ```bash
  prism alerts notify send \
    --severity high \
    --title "Test Alert" \
    --message "This is a test"
  # 预期: 告警创建成功
  ```

- [ ] **测试告警列表**
  ```bash
  prism alerts
  # 预期: 显示活跃告警
  ```

- [ ] **测试告警确认**
  ```bash
  prism alerts ack <alert-id> --by "admin" --comment "Test"
  # 预期: 告警状态变更为 Acknowledged
  ```

- [ ] **测试告警解决**
  ```bash
  prism alerts resolve <alert-id> --resolution "Test completed" --by "admin"
  # 预期: 告警状态变更为 Resolved
  ```

- [ ] **测试通知渠道**
  ```bash
  prism alerts notify test
  # 预期: 所有启用的渠道收到测试通知
  ```

### 5.5 服务部署

- [ ] **启动告警服务**
  ```bash
  prism alerts start
  # 或: systemctl start prism-alerting (如果使用 systemd)
  ```

- [ ] **验证服务状态**
  ```bash
  prism alerts status
  # 预期: status: running, active rules: 3+
  ```

- [ ] **检查后台日志**
  ```bash
  tail -f ~/.prism-gateway/logs/alerting.log
  # 预期: 定期输出告警评估日志
  ```

---

## 6. 集成测试

### 6.1 端到端场景测试

- [ ] **场景 1: 备份 → 恢复 → 验证**
  ```bash
  # 1. 创建全量备份
  prism backup create --type full

  # 2. 修改数据
  echo "test" >> ~/.prism-gateway/level-2-warm/test.txt

  # 3. 恢复备份
  backup_id=$(prism backup list --limit 1 --format json | jq -r '.[0].id')
  prism backup restore $backup_id --confirm

  # 4. 验证数据恢复
  [ ! -f ~/.prism-gateway/level-2-warm/test.txt ] && echo "✅ Restore successful"
  ```

- [ ] **场景 2: 健康检查 → 告警触发**
  ```bash
  # 1. 模拟磁盘使用率高（如果可能）
  # dd if=/dev/zero of=/tmp/largefile bs=1M count=1000

  # 2. 触发健康检查
  prism health check disk

  # 3. 验证告警触发
  prism alerts | grep "Disk"
  # 预期: 显示磁盘告警
  ```

- [ ] **场景 3: 指标采集 → 告警触发**
  ```bash
  # 1. 验证指标采集
  prism metrics show system_cpu_usage

  # 2. 模拟 CPU 负载（如果可能）
  # stress --cpu 8 --timeout 60s

  # 3. 验证告警触发
  prism alerts | grep "CPU"
  # 预期: 如果 CPU >80%，显示 CPU 告警
  ```

### 6.2 性能基准测试

- [ ] **备份性能测试**
  ```bash
  time prism backup create --type full
  # 预期: <30s (50MB 数据)
  ```

- [ ] **恢复性能测试**
  ```bash
  time prism backup restore <backup-id> --target /tmp/restore-test --confirm
  # 预期: <10s
  ```

- [ ] **健康检查性能测试**
  ```bash
  time prism health check system
  # 预期: <100ms
  ```

- [ ] **指标采集性能测试**
  ```bash
  time prism metrics snapshot
  # 预期: <10ms
  ```

- [ ] **告警触发性能测试**
  ```bash
  # 模拟触发告警，测量延迟
  start_time=$(date +%s%3N)
  prism alerts notify send --severity critical --title "Perf Test"
  end_time=$(date +%s%3N)
  latency=$((end_time - start_time))
  echo "Alert latency: ${latency}ms"
  # 预期: <5000ms (5s)
  ```

---

## 7. 生产环境配置

### 7.1 系统服务配置（Systemd）

- [ ] **创建 BackupService systemd 单元**
  ```bash
  sudo tee /etc/systemd/system/prism-backup.service <<EOF
  [Unit]
  Description=PRISM-Gateway Backup Service
  After=network.target

  [Service]
  Type=simple
  User=$USER
  WorkingDirectory=$HOME/.prism-gateway
  ExecStart=/usr/local/bin/prism backup schedule start
  Restart=on-failure
  RestartSec=10

  [Install]
  WantedBy=multi-user.target
  EOF
  ```

- [ ] **创建 HealthCheckService systemd 单元**
  ```bash
  sudo tee /etc/systemd/system/prism-health-check.service <<EOF
  [Unit]
  Description=PRISM-Gateway Health Check Service
  After=network.target

  [Service]
  Type=simple
  User=$USER
  WorkingDirectory=$HOME/.prism-gateway
  ExecStart=/usr/local/bin/prism health start
  Restart=on-failure
  RestartSec=10

  [Install]
  WantedBy=multi-user.target
  EOF
  ```

- [ ] **创建 MetricsService systemd 单元**
  ```bash
  sudo tee /etc/systemd/system/prism-metrics.service <<EOF
  [Unit]
  Description=PRISM-Gateway Metrics Service
  After=network.target

  [Service]
  Type=simple
  User=$USER
  WorkingDirectory=$HOME/.prism-gateway
  ExecStart=/usr/local/bin/prism metrics start
  Restart=on-failure
  RestartSec=10

  [Install]
  WantedBy=multi-user.target
  EOF
  ```

- [ ] **创建 AlertingService systemd 单元**
  ```bash
  sudo tee /etc/systemd/system/prism-alerting.service <<EOF
  [Unit]
  Description=PRISM-Gateway Alerting Service
  After=network.target prism-health-check.service prism-metrics.service

  [Service]
  Type=simple
  User=$USER
  WorkingDirectory=$HOME/.prism-gateway
  ExecStart=/usr/local/bin/prism alerts start
  Restart=on-failure
  RestartSec=10

  [Install]
  WantedBy=multi-user.target
  EOF
  ```

- [ ] **重新加载 systemd**
  ```bash
  sudo systemctl daemon-reload
  ```

- [ ] **启用自动启动**
  ```bash
  sudo systemctl enable prism-backup.service
  sudo systemctl enable prism-health-check.service
  sudo systemctl enable prism-metrics.service
  sudo systemctl enable prism-alerting.service
  ```

- [ ] **启动所有服务**
  ```bash
  sudo systemctl start prism-backup.service
  sudo systemctl start prism-health-check.service
  sudo systemctl start prism-metrics.service
  sudo systemctl start prism-alerting.service
  ```

- [ ] **验证服务状态**
  ```bash
  sudo systemctl status prism-backup.service
  sudo systemctl status prism-health-check.service
  sudo systemctl status prism-metrics.service
  sudo systemctl status prism-alerting.service
  # 预期: 所有服务 active (running)
  ```

### 7.2 日志轮转配置

- [ ] **配置 logrotate**
  ```bash
  sudo tee /etc/logrotate.d/prism-gateway <<EOF
  /home/$USER/.prism-gateway/logs/*.log {
      daily
      rotate 7
      compress
      delaycompress
      missingok
      notifempty
      create 0640 $USER $USER
      sharedscripts
      postrotate
          systemctl reload prism-*.service > /dev/null 2>&1 || true
      endscript
  }
  EOF
  ```

- [ ] **测试 logrotate 配置**
  ```bash
  sudo logrotate -d /etc/logrotate.d/prism-gateway
  # 预期: 无错误
  ```

---

## 8. 监控和验证

### 8.1 服务健康检查

- [ ] **检查所有服务状态**
  ```bash
  prism health
  # 预期: Overall Status: Healthy
  ```

- [ ] **检查备份状态**
  ```bash
  prism backup stats
  # 预期: 显示备份统计信息
  ```

- [ ] **检查指标采集状态**
  ```bash
  prism metrics status
  # 预期: 所有采集器 active
  ```

- [ ] **检查告警状态**
  ```bash
  prism alerts stats --days 1
  # 预期: 显示告警统计
  ```

### 8.2 24 小时观察

- [ ] **Day 1: 监控服务稳定性**
  - [ ] 检查服务是否持续运行
  - [ ] 检查 CPU/内存使用率是否正常（<5%）
  - [ ] 检查是否有异常日志

- [ ] **Day 1: 验证自动化任务**
  - [ ] 验证增量备份是否自动执行（如果是工作日）
  - [ ] 验证健康检查是否定期执行
  - [ ] 验证指标采集是否持续进行

- [ ] **Day 1: 验证告警触发**
  - [ ] 模拟异常情况（如手动填满磁盘）
  - [ ] 验证告警是否正确触发
  - [ ] 验证通知是否正确发送
  - [ ] 恢复正常后验证告警是否自动解决

---

## 9. 文档交付

### 9.1 运维文档

- [ ] 备份操作 SOP 已审查并部署到位
- [ ] 监控运维 SOP 已审查并部署到位
- [ ] 故障排查手册已准备
- [ ] 应急响应预案已准备

### 9.2 配置文档

- [ ] 所有配置文件已备份到 Git 仓库
- [ ] 配置更改记录已更新
- [ ] 环境变量文档已完善

---

## 10. 签署确认

### 部署人员

- **姓名**: _________________
- **日期**: _________________
- **签名**: _________________

### 审核人员

- **姓名**: _________________
- **日期**: _________________
- **签名**: _________________

### 项目负责人

- **姓名**: _________________
- **日期**: _________________
- **签名**: _________________

---

## 11. 回滚计划

如果部署失败或发现重大问题：

1. **立即停止所有运维服务**
   ```bash
   sudo systemctl stop prism-backup.service
   sudo systemctl stop prism-health-check.service
   sudo systemctl stop prism-metrics.service
   sudo systemctl stop prism-alerting.service
   ```

2. **恢复配置备份**
   ```bash
   rm -rf ~/.prism-gateway/config
   cp -r ~/.prism-gateway/config.backup.$(date +%Y%m%d) ~/.prism-gateway/config
   ```

3. **恢复数据备份**
   ```bash
   prism backup restore <backup-id> --confirm
   ```

4. **回滚代码**
   ```bash
   cd ~/.prism-gateway
   git reset --hard <previous-commit>
   bun install
   bun run build
   ```

5. **重启核心服务**
   ```bash
   prism start
   ```

---

**检查清单版本**: 1.0.0
**维护者**: PRISM-Gateway DevOps Team
**下次更新**: 实施过程中根据实际情况更新
