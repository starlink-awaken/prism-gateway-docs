# 监控指南

ReflectGuard 的监控指标和告警配置。

## 核心指标

### 1. 业务指标

| 指标 | 类型 | 说明 |
|------|------|------|
| `prism_checks_total` | Counter | 检查总数 |
| `prism_violations_total` | Counter | 违规总数 |
| `prism_retro_total` | Counter | 复盘总数 |
| `prism_pass_rate` | Gauge | 通过率 |

### 2. 性能指标

| 指标 | 类型 | 说明 | 目标 |
|------|------|------|------|
| `prism_check_duration` | Histogram | 检查耗时 | <100ms |
| `prism_retro_duration` | Histogram | 复盘耗时 | <5min |
| `prism_api_request_duration` | Histogram | API 请求耗时 | <50ms |

### 3. 系统指标

| 指标 | 类型 | 说明 |
|------|------|------|
| `prism_memory_usage` | Gauge | 内存使用 |
| `prism_cache_hit_rate` | Gauge | 缓存命中率 |
| `prism_active_connections` | Gauge | 活跃连接数 |

## Prometheus 配置

### scrape 配置

```yaml
scrape_configs:
  - job_name: 'prism-gateway'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Grafana 仪表板

导入仪表板 JSON 或创建面板：

**检查成功率面板：**
```promql
sum(rate(prism_checks_total{status="passed"}[5m])) /
sum(rate(prism_checks_total[5m]))
```

**P95 响应时间：**
```promql
histogram_quantile(0.95,
  rate(prism_check_duration_seconds_bucket[5m])
)
```

**违规率趋势：**
```promql
sum(rate(prism_violations_total[1h])) by (category)
```

## 告警规则

### P0 告警（立即响应）

```yaml
- alert: ServiceDown
  expr: up{job="prism-gateway"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "ReflectGuard 服务宕机"
    description: "{{ $labels.instance }} 已经宕机超过 1 分钟"
```

### P1 告警（1 小时内响应）

```yaml
- alert: HighFailureRate
  expr: |
    sum(rate(prism_checks_total{status="blocked"}[5m])) /
    sum(rate(prism_checks_total[5m])) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "高失败率检测"
    description: "失败率超过 10%"
```

### P2 告警（当天响应）

```yaml
- alert: HighLatency
  expr: |
    histogram_quantile(0.95,
      rate(prism_check_duration_seconds_bucket[5m])
    ) > 0.5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "高延迟检测"
    description: "P95 延迟超过 500ms"
```

## 日志监控

### 关键日志级别

| 级别 | 说明 | 示例 |
|------|------|------|
| ERROR | 错误，需要立即处理 | 检查失败、服务异常 |
| WARN | 警告，需要关注 | 性能下降、配置异常 |
| INFO | 信息，正常事件 | 服务启动、检查完成 |
| DEBUG | 调试，详细信息 | 详细执行流程 |

### 日志查询示例

```bash
# 查看错误日志
grep "ERROR" /var/log/prism-gateway/app.log

# 查看特定时间段
grep "2026-02-07 10:" /var/log/prism-gateway/app.log

# 统计错误类型
grep "ERROR" /var/log/prism-gateway/app.log | \
  jq -r '.error_type' | sort | uniq -c
```

## 健康检查

### HTTP 端点

```bash
# 基本健康检查
curl http://localhost:3000/health

# 详细健康检查
curl http://localhost:3000/health/detailed
```

### 返回格式

```json
{
  "status": "healthy",
  "uptime": 86400,
  "checks": {
    "datastore": "ok",
    "cache": "ok",
    "memory": "ok"
  },
  "metrics": {
    "memory_used": "128MB",
    "cache_hit_rate": 0.85
  }
}
```

## 性能基准

### 目标指标

| 操作 | P50 | P95 | P99 |
|------|-----|-----|-----|
| Gateway 检查 | 50ms | 100ms | 200ms |
| 快速复盘 | 1s | 3s | 5s |
| API 请求 | 10ms | 50ms | 100ms |

### 容量规划

| 并发 | CPU | 内存 | 磁盘 I/O |
|------|-----|------|----------|
| 10 | <5% | <100MB | 极低 |
| 100 | <20% | <200MB | 低 |
| 1000 | <50% | <500MB | 中等 |

## 监控仪表板

### 推荐面板

1. **概览面板**
   - 服务状态
   - 请求速率
   - 错误率
   - P95 延迟

2. **业务面板**
   - 检查统计（按状态）
   - 违规统计（按类别）
   - 复盘统计
   - 通过率趋势

3. **系统面板**
   - CPU 使用率
   - 内存使用量
   - 磁盘 I/O
   - 网络流量

---

**相关文档：**
- [部署指南](deployment.md)
- [日志管理](logging.md)
- [故障排查](troubleshooting.md)

---

**最后更新:** 2026-02-07
