# 运维故障排查

ReflectGuard 的运维故障排查指南。

## 诊断工具

### 健康检查

```bash
# 基本健康检查
prism health

# 详细诊断
prism doctor
```

### 系统状态

```bash
# 服务状态
systemctl status prism-gateway

# 查看日志
journalctl -u prism-gateway -n 100

# 实时日志
journalctl -u prism-gateway -f
```

### 资源使用

```bash
# 内存使用
free -h

# 磁盘使用
df -h /var/lib/prism-gateway

# CPU 使用
top -p $(pgrep -f prism-gateway)
```

## 常见问题

### 服务无法启动

#### 症状

```bash
systemctl start prism-gateway
# Job failed
```

#### 诊断

```bash
# 查看详细错误
journalctl -u prism-gateway -n 50 --no-pager

# 检查配置
prism config validate

# 检查端口占用
netstat -tlnp | grep 3000
```

#### 解决方案

1. **端口被占用**
```bash
# 找到占用进程
lsof -i :3000

# 结束进程
kill -9 <PID>
```

2. **权限问题**
```bash
# 检查目录权限
ls -la /var/lib/prism-gateway

# 修复权限
chown -R prism-gateway:prism-gateway /var/lib/prism-gateway
```

3. **配置错误**
```bash
# 验证配置
prism config validate

# 重置配置
prism config reset
```

### 性能下降

#### 症状

- 响应时间 >1 秒
- CPU 使用率 >80%
- 内存持续增长

#### 诊断

```bash
# 查看性能指标
curl http://localhost:3000/metrics

# 分析慢查询
grep "duration" /var/log/prism-gateway/app.log | \
  jq -r 'select(.duration > 1000)'
```

#### 解决方案

1. **启用缓存**
```json
{
  "cache": {
    "enabled": true,
    "ttl": 3600
  }
}
```

2. **清理旧数据**
```bash
prism cleanup --older-than 30days
```

3. **增加资源**
```bash
# 调整 systemd 服务限制
# 在 service 文件中添加:
MemoryLimit=1G
CPUQuota=50%
```

### 内存泄漏

#### 症状

- 内存持续增长
- OOM (Out of Memory)

#### 诊断

```bash
# 监控内存使用
watch -n 5 'ps aux | grep prism-gateway'

# 使用 heapdump（如果启用）
kill -USR2 $(pgrep -f prism-gateway)
```

#### 解决方案

1. **重启服务**
```bash
systemctl restart prism-gateway
```

2. **调整内存限制**
```json
{
  "analytics": {
    "retentionDays": 30
  }
}
```

3. **定期清理**
```bash
# 添加到 crontab
0 2 * * * prism cleanup --older-than 7days
```

### 数据损坏

#### 症状

```
Error: Invalid data format
Error: Cannot parse JSON
```

#### 诊断

```bash
# 验证数据
prism data validate

# 检查文件完整性
ls -la ~/.prism-gateway/level-*/
```

#### 解决方案

1. **从备份恢复**
```bash
prism backup list
prism backup restore <backup-id>
```

2. **重新初始化**
```bash
# 最后手段
prism init --force
```

## 紧急处理

### P0: 服务完全宕机

```bash
# 1. 立即尝试重启
systemctl restart prism-gateway

# 2. 检查错误日志
journalctl -u prism-gateway -n 100

# 3. 如果无法修复，启用备份
# （如果有备用节点）
```

### P1: 功能严重降级

```bash
# 1. 确认降级范围
curl http://localhost:3000/health/detailed

# 2. 查看错误日志
tail -f /var/log/prism-gateway/app.log

# 3. 尝试清理缓存
prism cache clear
```

### P2: 性能下降

```bash
# 1. 检查资源使用
top

# 2. 清理旧数据
prism cleanup --older-than 7days

# 3. 重启服务
systemctl restart prism-gateway
```

## 日志分析

### 错误模式

```bash
# 统计错误类型
grep "ERROR" /var/log/prism-gateway/app.log | \
  jq -r '.error_type' | sort | uniq -c | sort -rn

# 查找超时
grep "timeout" /var/log/prism-gateway/app.log

# 查找内存不足
grep "OOM" /var/log/prism-gateway/app.log
```

### 性能分析

```bash
# 按耗时排序
grep "duration" /var/log/prism-gateway/app.log | \
  jq -r '.duration' | sort -rn | head -20
```

## 获取帮助

如果以上方法都无法解决问题：

1. 收集诊断信息
```bash
prism doctor > diagnostics.txt
journalctl -u prism-gateway -n 500 > service.log
```

2. 创建 GitHub Issue
- 附上诊断信息
- 描述复现步骤
- 附上相关日志

---

**相关文档：**
- [部署指南](deployment.md)
- [监控指南](monitoring.md)
- [备份恢复](backup-recovery.md)

---

**最后更新:** 2026-02-07
