# 标准操作流程：监控运维 (Monitoring Operations SOP)

> **版本**: 1.0.0
> **最后更新**: 2026-02-07
> **适用范围**: PRISM-Gateway 监控和告警系统操作

---

## 目的

本 SOP 规范化 PRISM-Gateway 监控和告警系统的日常运维流程，确保系统健康、性能可观测和异常及时响应。

---

## 适用角色

- **SRE/运维工程师**: 监控系统健康，响应告警
- **开发工程师**: 诊断性能问题，优化代码
- **系统管理员**: 配置监控策略和告警规则

---

## 1. 监控体系概览

### 1.1 三层监控架构

```
┌─────────────────────────────────────────────┐
│         Layer 1: 健康检查 (Health Check)    │
│  ├─ 系统健康 (CPU/内存/磁盘)                │
│  ├─ 服务健康 (API/WebSocket)                │
│  └─ 数据健康 (完整性检查)                    │
├─────────────────────────────────────────────┤
│         Layer 2: 指标收集 (Metrics)         │
│  ├─ 系统指标 (资源使用)                      │
│  ├─ 业务指标 (请求/违规/复盘)               │
│  └─ 性能指标 (延迟/吞吐量)                  │
├─────────────────────────────────────────────┤
│         Layer 3: 告警系统 (Alerting)        │
│  ├─ 规则引擎 (阈值/变化率/组合)             │
│  ├─ 降噪处理 (去重/合并/节流)               │
│  └─ 通知渠道 (Console/File/Webhook)         │
└─────────────────────────────────────────────┘
```

### 1.2 监控指标分类

| 类别 | 指标 | 采集频率 | 保留期 |
|------|------|---------|--------|
| **系统指标** | CPU, 内存, 磁盘, 网络 | 1s | raw: 1h, 1m: 24h, 5m: 7d, 1h: 30d |
| **业务指标** | 检查次数, 违规率, 复盘次数 | 实时 | 同上 |
| **性能指标** | 响应时间, P50/P95/P99 | 实时 | 同上 |
| **健康指标** | 服务状态, 数据完整性 | 30s/60s/120s | 7d |

---

## 2. 健康检查操作

### 2.1 查看系统健康状态

**场景**: 日常巡检、问题排查、上线前验证

**步骤**:

1. **快速健康检查**
   ```bash
   prism health
   ```

   **输出示例**:
   ```
   ✅ Overall Status: Healthy
   ✅ System: Healthy (CPU: 12%, Memory: 45%, Disk: 62%)
   ✅ API: Healthy (latency: 23ms, success rate: 99.8%)
   ✅ WebSocket: Healthy (connections: 5, message rate: 120/min)
   ✅ Data: Healthy (files: 1,234, integrity: 100%)
   ⚠️  Network: Degraded (DNS: 89ms, external API: slow)
   ```

2. **详细健康报告**
   ```bash
   prism health --full
   ```

   **包含内容**:
   - 所有检查器的详细结果
   - 历史健康趋势（最近 1 小时）
   - 性能指标
   - 建议的优化措施

3. **单个检查器执行**
   ```bash
   prism health check system
   prism health check disk
   prism health check api
   ```

**健康状态定义**:
- **Healthy**: 所有指标正常，无告警
- **Degraded**: 部分指标降级，有警告但不影响核心功能
- **Error**: 关键指标异常，影响核心功能

---

### 2.2 查看健康历史

**场景**: 趋势分析、问题追溯、性能评估

**步骤**:

1. **查看最近健康历史**
   ```bash
   prism health history --hours 24
   ```

2. **按检查器过滤**
   ```bash
   prism health history --checker system --hours 24
   ```

3. **查看健康趋势**
   ```bash
   prism health trend --days 7
   ```

   **输出示例**:
   ```
   Health Trend (Last 7 Days):
   ┌──────────┬──────────┬──────────┬──────────┐
   │  Date    │ Healthy  │ Degraded │  Error   │
   ├──────────┼──────────┼──────────┼──────────┤
   │ 02/01    │  100%    │    0%    │    0%    │
   │ 02/02    │  98.5%   │   1.5%   │    0%    │
   │ 02/03    │  99.2%   │   0.8%   │    0%    │
   │ 02/04    │  100%    │    0%    │    0%    │
   │ 02/05    │  97.8%   │   2.2%   │    0%    │
   │ 02/06    │  100%    │    0%    │    0%    │
   │ 02/07    │  100%    │    0%    │    0%    │
   └──────────┴──────────┴──────────┴──────────┘
   ```

---

### 2.3 健康检查服务管理

**启动健康检查服务**:
```bash
prism health start
# 后台启动健康检查守护进程
```

**停止健康检查服务**:
```bash
prism health stop
```

**重启健康检查服务**:
```bash
prism health restart
```

**查看服务状态**:
```bash
prism health status
```

**配置检查频率**:
```bash
# 编辑配置文件
vim ~/.prism-gateway/config/health-check.json

# 重新加载配置
prism health reload
```

---

## 3. 指标监控操作

### 3.1 查看实时指标

**场景**: 性能监控、资源评估、容量规划

**步骤**:

1. **查看所有实时指标**
   ```bash
   prism metrics
   ```

   **输出示例**:
   ```
   === System Metrics ===
   CPU Usage:        15.2% (8 cores)
   Memory Usage:     2.3 GB / 16 GB (14.4%)
   Disk Usage:       28.5 GB / 100 GB (28.5%)
   Network In:       1.2 MB/s
   Network Out:      0.8 MB/s

   === Business Metrics ===
   Gateway Checks:   1,234 (today)
   Violations:       23 (today)
   Retrospectives:   5 (today)
   Active Users:     12

   === Performance Metrics ===
   API Latency:      P50: 18ms, P95: 45ms, P99: 89ms
   WebSocket Msg:    120 msg/min
   Check Duration:   Avg: 78ms, P95: 156ms
   ```

2. **查看特定指标**
   ```bash
   prism metrics show system_cpu_usage
   prism metrics show api_request_latency_p95
   prism metrics show gateway_violations_total
   ```

3. **实时监控（自动刷新）**
   ```bash
   prism metrics watch --interval 5
   # 每 5 秒刷新一次
   ```

---

### 3.2 查询历史指标

**场景**: 趋势分析、性能调优、容量规划

**步骤**:

1. **查询时间范围数据**
   ```bash
   prism metrics query system_cpu_usage \
     --from "1 hour ago" \
     --to now
   ```

2. **聚合查询**
   ```bash
   prism metrics query api_request_latency_p95 \
     --from "24 hours ago" \
     --to now \
     --group-by 1h \
     --agg avg
   ```

   **聚合函数**: sum, avg, min, max, p50, p95, p99

3. **多指标对比**
   ```bash
   prism metrics query \
     --metrics "system_cpu_usage,system_memory_usage" \
     --from "7 days ago" \
     --to now \
     --group-by 1d
   ```

4. **导出指标数据**
   ```bash
   prism metrics export \
     --metric system_cpu_usage \
     --from "7 days ago" \
     --format csv \
     --output cpu-usage-7d.csv
   ```

   **支持格式**: csv, json, excel

---

### 3.3 指标可视化

**图表查看**:
```bash
# ASCII 图表
prism metrics chart system_cpu_usage --from "1 hour ago"
```

**输出示例**:
```
System CPU Usage (Last 1 Hour)
100% ┤
 75% ┤                                    ╭─╮
 50% ┤              ╭─╮             ╭────╯ ╰─╮
 25% ┤      ╭───────╯ ╰─────────────╯        ╰───
  0% ┼──────╯
     └─────────────────────────────────────────→
     12:00  12:15  12:30  12:45  13:00  13:15
```

**Web UI 查看**:
```bash
# 启动 Web UI（如果已安装）
prism ui start
# 访问: http://localhost:3000/metrics
```

---

## 4. 告警管理操作

### 4.1 查看活跃告警

**场景**: 事件响应、问题排查、系统巡检

**步骤**:

1. **查看所有活跃告警**
   ```bash
   prism alerts
   ```

   **输出示例**:
   ```
   Active Alerts (3):

   🔴 CRITICAL - System Disk Usage High
      Message: Disk usage at 92%, exceeds threshold 90%
      Source: HealthCheckService.DiskHealthChecker
      Started: 2026-02-07 12:45:30 (5m ago)
      Status: Active
      Alert ID: alert_20260207_124530_001

   🟡 MEDIUM - API Response Slow
      Message: API P95 latency 156ms, exceeds threshold 100ms
      Source: MetricsService.APIMetricsCollector
      Started: 2026-02-07 13:10:15 (2m ago)
      Status: Active
      Alert ID: alert_20260207_131015_002

   🟢 LOW - WebSocket Connection Drop
      Message: WebSocket connection dropped unexpectedly
      Source: HealthCheckService.WebSocketHealthChecker
      Started: 2026-02-07 13:15:00 (30s ago)
      Status: Active
      Alert ID: alert_20260207_131500_003
   ```

2. **按严重性过滤**
   ```bash
   prism alerts --severity critical
   prism alerts --severity high
   prism alerts --severity medium
   prism alerts --severity low
   ```

3. **按来源过滤**
   ```bash
   prism alerts --source HealthCheckService
   prism alerts --source MetricsService
   ```

---

### 4.2 处理告警

**场景**: 事件响应、告警确认、问题解决

**步骤**:

1. **确认告警（Acknowledge）**
   ```bash
   prism alerts ack <alert-id> --by "admin" --comment "Investigating disk usage"
   ```

   **效果**:
   - 告警状态变更为 `Acknowledged`
   - 停止发送重复通知
   - 记录处理人和备注

2. **解决告警（Resolve）**
   ```bash
   prism alerts resolve <alert-id> \
     --resolution "Cleaned up old backups, disk usage now 65%" \
     --by "admin"
   ```

   **效果**:
   - 告警状态变更为 `Resolved`
   - 停止监控此告警
   - 记录解决方案

3. **批量操作**
   ```bash
   # 批量确认所有 medium 级别告警
   prism alerts ack --severity medium --by "admin"

   # 批量解决已修复的告警
   prism alerts resolve --source HealthCheckService --by "admin"
   ```

---

### 4.3 查看告警历史

**场景**: 故障分析、SLA 统计、趋势分析

**步骤**:

1. **查询告警历史**
   ```bash
   prism alerts history --hours 24
   ```

2. **按时间范围查询**
   ```bash
   prism alerts history \
     --from "7 days ago" \
     --to now
   ```

3. **告警统计**
   ```bash
   prism alerts stats --days 7
   ```

   **输出示例**:
   ```
   Alert Statistics (Last 7 Days):

   Total Alerts:        45
   By Severity:
     - Critical:        2 (4.4%)
     - High:            8 (17.8%)
     - Medium:          20 (44.4%)
     - Low:             15 (33.3%)

   Resolution Time:
     - Avg:             15m
     - P50:             10m
     - P95:             45m

   Top Alert Sources:
     1. HealthCheckService (25 alerts)
     2. MetricsService (15 alerts)
     3. AlertingService (5 alerts)

   Top Alert Types:
     1. Disk Usage High (12 alerts)
     2. API Latency High (8 alerts)
     3. Memory Usage High (6 alerts)
   ```

---

### 4.4 静默规则管理

**场景**: 计划维护、临时屏蔽、误报抑制

**步骤**:

1. **添加静默规则**
   ```bash
   prism alerts silence add \
     --name "Weekly Maintenance" \
     --start "2026-02-08 02:00" \
     --end "2026-02-08 04:00" \
     --source "HealthCheckService" \
     --reason "Scheduled maintenance window"
   ```

2. **列出静默规则**
   ```bash
   prism alerts silence list
   ```

   **输出示例**:
   ```
   Active Silence Rules:

   1. Weekly Maintenance
      Source: HealthCheckService
      Start: 2026-02-08 02:00
      End: 2026-02-08 04:00
      Reason: Scheduled maintenance window
      Rule ID: silence_001

   2. API Load Test
      Source: MetricsService.APIMetricsCollector
      Start: 2026-02-09 10:00
      End: 2026-02-09 12:00
      Reason: Load testing in progress
      Rule ID: silence_002
   ```

3. **删除静默规则**
   ```bash
   prism alerts silence remove <silence-id>
   ```

---

## 5. 监控仪表板

### 5.1 CLI 仪表板

**启动交互式仪表板**:
```bash
prism dashboard
```

**仪表板布局**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    PRISM-Gateway Dashboard                      │
├─────────────────────────────────────────────────────────────────┤
│ System Health: ✅ Healthy  │  Active Alerts: 2                  │
│ Uptime: 15d 7h 23m         │  Last Check: 5s ago                │
├────────────────────┬────────────────────────────────────────────┤
│  System Metrics    │           Performance Metrics              │
├────────────────────┼────────────────────────────────────────────┤
│ CPU:      15.2%    │  API Latency:    P95: 45ms                │
│ Memory:   14.4%    │  Check Duration: Avg: 78ms                │
│ Disk:     28.5%    │  WebSocket Msg:  120/min                  │
│ Network:  1.2 MB/s │  Gateway Checks: 1,234 (today)            │
├────────────────────┴────────────────────────────────────────────┤
│                     Recent Alerts                               │
├─────────────────────────────────────────────────────────────────┤
│ 🔴 12:45 - Disk usage high (92%)                                │
│ 🟡 13:10 - API latency high (156ms)                             │
├─────────────────────────────────────────────────────────────────┤
│ [R] Refresh  [Q] Quit  [A] Alerts  [M] Metrics  [H] Health    │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Web UI 仪表板

**启动 Web UI**:
```bash
prism ui start --port 3000
```

**访问地址**: http://localhost:3000

**功能模块**:
- **Overview**: 系统健康概览
- **Metrics**: 指标可视化图表
- **Alerts**: 告警管理界面
- **Health**: 健康检查详情
- **Settings**: 配置管理

---

## 6. 告警规则配置

### 6.1 创建告警规则

**阈值规则示例**:
```bash
prism alerts rule create \
  --name "High CPU Usage" \
  --type threshold \
  --metric "system_cpu_usage" \
  --operator ">" \
  --threshold 80 \
  --duration "5m" \
  --severity high \
  --message "CPU usage exceeds 80% for 5 minutes"
```

**变化率规则示例**:
```bash
prism alerts rule create \
  --name "Sudden Memory Increase" \
  --type rate \
  --metric "system_memory_usage" \
  --rate ">20%" \
  --window "10m" \
  --severity medium \
  --message "Memory usage increased by >20% in 10 minutes"
```

**组合规则示例**:
```bash
prism alerts rule create \
  --name "System Overload" \
  --type composite \
  --conditions "cpu>80 AND memory>90" \
  --severity critical \
  --message "System is overloaded"
```

---

### 6.2 管理告警规则

**列出所有规则**:
```bash
prism alerts rule list
```

**查看规则详情**:
```bash
prism alerts rule info <rule-id>
```

**更新规则**:
```bash
prism alerts rule update <rule-id> --threshold 85
```

**启用/禁用规则**:
```bash
prism alerts rule enable <rule-id>
prism alerts rule disable <rule-id>
```

**删除规则**:
```bash
prism alerts rule delete <rule-id>
```

---

## 7. 通知渠道配置

### 7.1 配置通知渠道

**Console 通知**（默认启用）:
```json
{
  "notifications": {
    "console": {
      "enabled": true,
      "severity_filter": ["critical", "high"]
    }
  }
}
```

**文件通知**:
```json
{
  "notifications": {
    "file": {
      "enabled": true,
      "path": "~/.prism-gateway/logs/alerts.log",
      "severity_filter": ["critical", "high", "medium"]
    }
  }
}
```

**Webhook 通知**:
```json
{
  "notifications": {
    "webhook": {
      "enabled": true,
      "url": "https://example.com/webhook/alerts",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      },
      "severity_filter": ["critical", "high"]
    }
  }
}
```

**Email 通知**（可选）:
```json
{
  "notifications": {
    "email": {
      "enabled": true,
      "smtp_host": "smtp.example.com",
      "smtp_port": 587,
      "from": "alerts@prism-gateway.local",
      "to": ["admin@example.com"],
      "severity_filter": ["critical"]
    }
  }
}
```

---

### 7.2 测试通知渠道

**测试所有渠道**:
```bash
prism alerts notify test
```

**测试特定渠道**:
```bash
prism alerts notify test --channel webhook
```

**发送测试告警**:
```bash
prism alerts notify send \
  --severity high \
  --title "Test Alert" \
  --message "This is a test alert"
```

---

## 8. 性能调优

### 8.1 采集器性能优化

**调整采集频率**:
```json
{
  "metrics": {
    "collectors": {
      "system": { "interval": 1 },      // 1s
      "api": { "interval": 1 },          // 1s
      "business": { "interval": 5 }      // 5s
    }
  }
}
```

**限制并发采集**:
```json
{
  "metrics": {
    "concurrency": 5
  }
}
```

---

### 8.2 存储优化

**配置保留策略**:
```json
{
  "metrics": {
    "storage": {
      "raw": { "retention": "1h" },
      "1m": { "retention": "24h" },
      "5m": { "retention": "7d" },
      "1h": { "retention": "30d" }
    }
  }
}
```

**自动清理过期数据**:
```bash
prism metrics cleanup --older-than "30 days"
```

---

## 9. 故障排查

### 9.1 监控数据缺失

**症状**: 指标查询返回空结果

**排查步骤**:
1. 检查采集器状态: `prism metrics collectors status`
2. 查看采集器日志: `tail -f ~/.prism-gateway/logs/metrics.log`
3. 验证存储路径: `ls -lh ~/.prism-gateway/level-2-warm/metrics/`
4. 手动触发采集: `prism metrics collect --now`

---

### 9.2 告警风暴

**症状**: 短时间内大量告警触发

**排查步骤**:
1. 查看告警统计: `prism alerts stats --hours 1`
2. 识别告警来源: 找出最频繁的告警规则
3. 临时静默规则: `prism alerts silence add ...`
4. 调整规则阈值: `prism alerts rule update <rule-id> --threshold <new-value>`
5. 启用降噪: 确认去重/节流机制生效

---

### 9.3 健康检查失败

**症状**: 健康检查持续报告 Error 状态

**排查步骤**:
1. 查看详细错误: `prism health check <checker-name> --verbose`
2. 检查系统资源: `prism metrics show system_*`
3. 查看服务日志: `tail -f ~/.prism-gateway/logs/health-check.log`
4. 手动验证: 手动执行健康检查项（如 `curl http://localhost:8080/health`）

---

## 10. 最佳实践

### 10.1 监控配置

- ✅ 根据业务需求调整采集频率（关键指标 1s，次要指标 5s）
- ✅ 合理设置告警阈值（避免误报和漏报）
- ✅ 配置多级告警（critical/high/medium/low）
- ✅ 启用降噪机制（去重/合并/节流）

### 10.2 运维习惯

- ✅ 每日查看健康仪表板
- ✅ 每周查看告警统计和趋势
- ✅ 每月进行告警规则审查和优化
- ✅ 定期清理过期监控数据

### 10.3 告警处理

- ✅ 立即响应 Critical 级别告警（<5 分钟）
- ✅ 1 小时内响应 High 级别告警
- ✅ 确认告警时记录处理计划
- ✅ 解决告警时记录解决方案

---

## 11. 参考文档

- [PHASE3_WEEK3_HEALTH_CHECK_DESIGN.md](../../../../reports/PHASE3_WEEK3_HEALTH_CHECK_DESIGN.md)
- [PHASE3_WEEK3_MONITORING_METRICS_DESIGN.md](../../../../reports/PHASE3_WEEK3_MONITORING_METRICS_DESIGN.md)
- [PHASE3_WEEK3_ALERTING_SYSTEM_DESIGN.md](../../../../reports/PHASE3_WEEK3_ALERTING_SYSTEM_DESIGN.md)
- [PHASE3_WEEK4_IMPLEMENTATION_PLAN.md](../../../../reports/PHASE3_WEEK4_IMPLEMENTATION_PLAN.md)

---

**文档维护者**: PRISM-Gateway SRE Team
**审核周期**: 每季度
**下次审核**: 2026-05-07
