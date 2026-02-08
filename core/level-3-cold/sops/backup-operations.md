# 标准操作流程：备份操作 (Backup Operations SOP)

> **版本**: 1.0.0
> **最后更新**: 2026-02-07
> **适用范围**: PRISM-Gateway 备份服务操作

---

## 目的

本 SOP 规范化 PRISM-Gateway 备份服务的日常操作流程，确保数据安全和系统可恢复性。

---

## 适用角色

- **DevOps 工程师**: 执行备份操作，监控备份状态
- **系统管理员**: 配置备份策略，管理备份存储
- **开发工程师**: 开发环境备份测试

---

## 1. 备份类型和策略

### 1.1 备份类型

| 类型 | 频率 | 时间 | 保留期 | 用途 |
|------|------|------|--------|------|
| **全量备份** | 每周一次 | 周日 02:00 | 7 天 | 完整系统恢复 |
| **增量备份** | 每日 | 工作日 03:00 | 30 天 | 快速数据恢复 |
| **手动备份** | 按需 | - | 永久（手动删除） | 关键变更前 |

### 1.2 备份内容

**包含目录**:
```
~/.prism-gateway/level-1-hot/      # 热数据
~/.prism-gateway/level-2-warm/     # 温数据
~/.prism-gateway/level-3-cold/     # 冷知识库
~/.prism-gateway/config/           # 配置文件
```

**排除内容**:
```
~/.prism-gateway/logs/             # 日志文件（可选）
~/.prism-gateway/temp/             # 临时文件
~/.prism-gateway/node_modules/     # 依赖包
~/.prism-gateway/.git/             # Git 仓库（代码已托管）
```

---

## 2. 日常备份操作

### 2.1 执行手动全量备份

**场景**: 重大变更前（升级、配置修改、数据迁移等）

**步骤**:

1. **验证磁盘空间**
   ```bash
   df -h ~/.prism-gateway-backups
   # 确保至少有 2x 数据大小的空间
   ```

2. **执行备份**
   ```bash
   prism backup create --type full --comment "Pre-upgrade backup v2.5 -> v3.0"
   ```

3. **验证备份**
   ```bash
   prism backup verify <backup-id>
   # 检查输出: status: completed, checksum: verified
   ```

4. **记录备份信息**
   ```bash
   # 保存备份 ID 到变更记录
   echo "Backup ID: <backup-id>" >> change-log.txt
   ```

**预期结果**:
- ✅ 备份完成时间 <30s（50MB 数据）
- ✅ 压缩率 >70%
- ✅ 校验和验证通过

**常见问题**:
- **磁盘空间不足**: 清理过期备份 `prism backup cleanup`
- **备份超时**: 检查磁盘 I/O 性能 `iostat -x 1 5`
- **权限错误**: 检查备份目录权限 `ls -ld ~/.prism-gateway-backups`

---

### 2.2 执行手动增量备份

**场景**: 重要数据变更后的快速备份

**步骤**:

1. **确认基准备份**
   ```bash
   prism backup list --type full --limit 1
   # 确保存在最近的全量备份
   ```

2. **执行增量备份**
   ```bash
   prism backup create --type incremental --comment "Daily incremental"
   ```

3. **快速验证**
   ```bash
   prism backup stats
   # 检查最新备份状态
   ```

**预期结果**:
- ✅ 备份完成时间 <10s（增量数据）
- ✅ 仅包含变更文件

---

### 2.3 查看备份列表

**场景**: 查找特定备份或审计备份历史

**步骤**:

1. **列出所有备份**
   ```bash
   prism backup list
   ```

2. **按类型过滤**
   ```bash
   prism backup list --type full
   prism backup list --type incremental
   ```

3. **按时间范围过滤**
   ```bash
   prism backup list --from "7 days ago" --to now
   ```

4. **查看详细信息**
   ```bash
   prism backup info <backup-id>
   ```

**输出示例**:
```
ID: backup_20260207_020015_full
Type: full
Status: completed
Created: 2026-02-07 02:00:15
Size: 12.3 MB (original: 45.2 MB)
Compression: 72.8%
Checksum: a1b2c3d4e5f6...
Files: 1,234
```

---

## 3. 备份恢复操作

### 3.1 恢复全量备份

**场景**: 系统故障、数据损坏、回退到历史版本

**⚠️ 警告**: 恢复操作将覆盖当前数据，务必谨慎！

**步骤**:

1. **停止 PRISM-Gateway 服务**
   ```bash
   prism stop
   # 或: systemctl stop prism-gateway
   ```

2. **备份当前状态（可选）**
   ```bash
   prism backup create --type full --comment "Pre-restore backup"
   ```

3. **选择恢复点**
   ```bash
   prism backup list
   # 选择目标备份 ID
   ```

4. **执行恢复（DRY-RUN 模式）**
   ```bash
   prism backup restore <backup-id> --dry-run
   # 预览将要恢复的文件
   ```

5. **确认并执行恢复**
   ```bash
   prism backup restore <backup-id> --confirm
   ```

6. **验证数据完整性**
   ```bash
   prism health check data
   # 检查数据文件完整性
   ```

7. **重启服务**
   ```bash
   prism start
   ```

**预期结果**:
- ✅ 恢复完成时间 <10s
- ✅ 数据完整性检查通过
- ✅ 服务正常启动

**回滚计划**:
- 如果恢复失败，立即停止服务
- 检查恢复日志 `~/.prism-gateway/logs/backup-restore.log`
- 联系技术支持

---

### 3.2 恢复增量备份

**场景**: 恢复到特定时间点

**⚠️ 注意**: 增量备份依赖基准全量备份

**步骤**:

1. **确定恢复链**
   ```bash
   prism backup chain <incremental-backup-id>
   # 显示: full_backup_id -> inc1 -> inc2 -> target_inc
   ```

2. **按顺序恢复**
   ```bash
   # 1. 先恢复全量备份
   prism backup restore <full-backup-id> --confirm

   # 2. 依次恢复增量备份
   prism backup restore <inc1-id> --incremental --confirm
   prism backup restore <inc2-id> --incremental --confirm
   prism backup restore <target-inc-id> --incremental --confirm
   ```

3. **验证和重启**（同全量恢复）

**自动化恢复**:
```bash
# 一条命令恢复到指定增量备份点（自动处理依赖链）
prism backup restore <incremental-backup-id> --auto-chain --confirm
```

---

## 4. 备份维护操作

### 4.1 清理过期备份

**场景**: 定期释放存储空间

**步骤**:

1. **查看保留策略**
   ```bash
   prism backup policy
   ```

   **输出示例**:
   ```yaml
   retention_policy:
     full_backups:
       count: 7
       age_days: 7
     incremental_backups:
       count: 30
       age_days: 30
     max_total_backups: 50
   ```

2. **预览将被清理的备份**
   ```bash
   prism backup cleanup --dry-run
   ```

3. **执行清理**
   ```bash
   prism backup cleanup
   ```

4. **验证结果**
   ```bash
   prism backup stats
   # 检查备份数量和总大小
   ```

**自动清理**:
- 已配置自动清理任务（每周日 04:00）
- 无需手动干预，除非需要立即释放空间

---

### 4.2 删除特定备份

**场景**: 删除错误的或不需要的备份

**⚠️ 警告**: 删除操作不可逆！

**步骤**:

1. **确认目标备份**
   ```bash
   prism backup info <backup-id>
   ```

2. **检查依赖关系**
   ```bash
   prism backup dependencies <backup-id>
   # 如果有增量备份依赖此全量备份，将显示警告
   ```

3. **执行删除**
   ```bash
   prism backup delete <backup-id> --confirm
   ```

**最佳实践**:
- ❌ 不要删除最近 3 天的全量备份
- ❌ 不要删除有增量备份依赖的全量备份
- ✅ 优先使用 `cleanup` 命令自动清理

---

### 4.3 验证备份完整性

**场景**: 定期审计、可疑故障后验证

**步骤**:

1. **验证单个备份**
   ```bash
   prism backup verify <backup-id>
   ```

2. **验证所有备份**
   ```bash
   prism backup verify --all
   ```

3. **详细验证报告**
   ```bash
   prism backup verify <backup-id> --verbose
   ```

**验证内容**:
- ✅ 备份文件存在
- ✅ SHA256 校验和匹配
- ✅ 压缩文件可解压
- ✅ 元数据完整

**失败处理**:
- 如果验证失败，标记备份为 `corrupted`
- 自动触发告警（如果配置了告警系统）
- 考虑重新创建全量备份

---

## 5. 监控和告警

### 5.1 备份状态监控

**每日检查项**:

```bash
# 1. 检查最近备份状态
prism backup list --limit 5

# 2. 检查备份失败记录
prism backup failures --days 7

# 3. 检查存储空间
prism backup stats
```

**健康指标**:
- ✅ 最近 24 小时内有成功备份
- ✅ 备份失败率 <1%
- ✅ 备份存储空间占用 <80%

### 5.2 告警触发条件

**Critical 级别**:
- 连续 3 次备份失败
- 最近 48 小时无成功备份
- 存储空间 >95%

**High 级别**:
- 单次备份失败
- 备份校验失败
- 存储空间 >90%

**Medium 级别**:
- 备份时间超过阈值 2x
- 存储空间 >80%

---

## 6. 故障排查

### 6.1 备份失败

**症状**: 备份命令返回错误

**排查步骤**:

1. **检查错误日志**
   ```bash
   tail -f ~/.prism-gateway/logs/backup.log
   ```

2. **常见错误和解决方案**

   | 错误代码 | 错误信息 | 原因 | 解决方案 |
   |---------|---------|------|---------|
   | ERR_BACKUP_001 | Disk space insufficient | 磁盘空间不足 | 清理过期备份或扩容 |
   | ERR_BACKUP_002 | Permission denied | 权限错误 | 检查文件权限 |
   | ERR_BACKUP_003 | Source directory not found | 源目录不存在 | 检查配置路径 |
   | ERR_BACKUP_004 | Compression failed | 压缩失败 | 检查 gzip 安装 |
   | ERR_BACKUP_005 | Checksum mismatch | 校验和错误 | 重试备份 |

3. **验证系统资源**
   ```bash
   # 磁盘空间
   df -h ~/.prism-gateway-backups

   # 磁盘 I/O
   iostat -x 1 5

   # 内存
   free -h
   ```

---

### 6.2 恢复失败

**症状**: 恢复命令执行异常或数据不完整

**排查步骤**:

1. **检查备份完整性**
   ```bash
   prism backup verify <backup-id> --verbose
   ```

2. **检查目标目录权限**
   ```bash
   ls -ld ~/.prism-gateway/
   ```

3. **逐步恢复**
   ```bash
   # 先恢复到临时目录验证
   prism backup restore <backup-id> --target /tmp/restore-test

   # 验证无误后再恢复到生产目录
   prism backup restore <backup-id> --target ~/.prism-gateway --confirm
   ```

---

## 7. 最佳实践

### 7.1 3-2-1 备份原则

- **3** 份数据副本（1 份生产 + 2 份备份）
- **2** 种不同存储介质（本地磁盘 + 云存储）
- **1** 份异地备份（远程位置）

**PRISM-Gateway 实现**:
- ✅ 本地备份：`~/.prism-gateway-backups/`
- ✅ 云存储：考虑配置 AWS S3 / Azure Blob（可选）
- ✅ 异地备份：定期复制到远程服务器

### 7.2 备份前检查清单

- [ ] 确认磁盘空间充足（>2x 数据大小）
- [ ] 验证上一次备份成功
- [ ] 关闭不必要的写操作（可选）
- [ ] 记录当前系统状态

### 7.3 恢复前检查清单

- [ ] 停止 PRISM-Gateway 服务
- [ ] 验证备份完整性
- [ ] 备份当前状态（安全网）
- [ ] 使用 --dry-run 预览
- [ ] 准备回滚计划

### 7.4 定期演练

**每月一次**:
- 执行完整的备份恢复演练
- 验证恢复时间 <10s
- 测试数据完整性
- 更新文档和流程

---

## 8. 应急响应

### 8.1 数据丢失应急

**场景**: 意外删除、磁盘故障、勒索软件

**立即行动**:
1. **隔离问题** - 停止服务，防止进一步损坏
2. **评估损失** - 确定丢失数据范围
3. **选择恢复点** - 最近的已验证备份
4. **执行恢复** - 按 SOP 执行恢复流程
5. **验证恢复** - 全面数据完整性检查
6. **恢复服务** - 重启并监控

**通知链**:
1. 技术负责人（立即）
2. 项目经理（15 分钟内）
3. 用户（如果影响服务）

---

## 9. 配置参考

### 9.1 备份配置文件

**位置**: `~/.prism-gateway/config/backup.json`

```json
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
```

### 9.2 环境变量

```bash
# 备份存储路径（覆盖配置文件）
export PRISM_BACKUP_PATH=/mnt/backup

# 备份并行度
export PRISM_BACKUP_CONCURRENCY=5

# 启用详细日志
export PRISM_BACKUP_VERBOSE=true
```

---

## 10. 参考文档

- [PHASE3_WEEK3_BACKUP_SERVICE_DESIGN.md](../../../../reports/PHASE3_WEEK3_BACKUP_SERVICE_DESIGN.md) - 备份服务设计文档
- [PHASE3_WEEK4_IMPLEMENTATION_PLAN.md](../../../../reports/PHASE3_WEEK4_IMPLEMENTATION_PLAN.md) - 实施计划
- [Backup Service API 文档](../../../../api/backup-service.md)（待创建）

---

**文档维护者**: PRISM-Gateway DevOps Team
**审核周期**: 每季度
**下次审核**: 2026-05-07
