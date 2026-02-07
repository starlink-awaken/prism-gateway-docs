# PRISM-Gateway 数据迁移指南

## 概述

本文档提供从 PRISM-Gateway Phase 1 到 Phase 2 的完整数据迁移指南。

### 迁移特点

- **零停机迁移**：Phase 1 数据永不修改，迁移过程不影响使用
- **Shadow Migration Pattern**：Phase 2 与 Phase 1 并存
- **完整回滚支持**：随时可以恢复到 Phase 1
- **数据完整性保证**：自动备份和验证

### 版本信息

| 项目 | 版本 |
|------|------|
| Phase 1 | 1.0 |
| Phase 2 | 2.0 |

---

## 前置条件

### 系统要求

- **Node.js**: 18+ 或 **Bun**: 1.0+
- **磁盘空间**: 至少 100MB 可用空间
- **操作系统**: macOS, Linux, Windows (WSL)

### Phase 1 数据检查

确保以下数据存在且有效：

```bash
# 检查 Phase 1 数据目录
ls -la ~/.prism-gateway/level-1-hot/
ls -la ~/.prism-gateway/level-2-warm/
ls -la ~/.prism-gateway/level-3-cold/

# 必需文件
~/.prism-gateway/level-1-hot/principles.json
~/.prism-gateway/level-1-hot/patterns/success_patterns.json
~/.prism-gateway/level-1-hot/patterns/failure_patterns.json
```

---

## 迁移步骤

### 步骤 1：准备迁移

建议先进行预检查：

```bash
# 检查系统状态
prism status

# 检查统计信息
prism stats
```

### 步骤 2：模拟迁移（推荐）

首先进行干运行（Dry Run）以验证迁移流程：

```bash
# CLI 方式
prism migrate --dry-run

# 或直接运行脚本
bun run src/migration/scripts/phase1-to-phase2.ts --dry-run
```

### 步骤 3：执行迁移

确认无误后执行实际迁移：

```bash
# CLI 方式
prism migrate

# 或直接运行脚本
bun run src/migration/scripts/phase1-to-phase2.ts
```

### 步骤 4：验证迁移

检查迁移状态：

```bash
# 查看迁移状态
prism migrate --status

# 验证数据完整性
# 迁移脚本会自动验证以下内容：
# - 原则数据 (principles.json)
# - 成功模式 (success_patterns.json)
# - 失败模式 (failure_patterns.json)
# - 复盘记录 (retros/index.jsonl)
# - 违规记录 (violations.jsonl)
```

### 步骤 5：测试 Phase 2 功能

迁移完成后，测试 Phase 2 新功能：

```bash
# 测试 Gateway 检查
prism check "测试任务描述"

# 测试复盘功能
prism retro quick
prism retro standard
prism retro deep

# 查看统计
prism stats
```

---

## 迁移过程详解

### 迁移步骤

迁移过程包含以下 8 个步骤：

| 步骤 | 名称 | 描述 | 是否可回滚 |
|------|------|------|-----------|
| 1 | pre_validation | 系统预验证 | 否 |
| 2 | backup | 备份 Phase 1 数据 | 否 |
| 3 | init_directories | 创建 Phase 2 目录结构 | 是 |
| 4 | init_config | 初始化 Phase 2 配置 | 是 |
| 5 | init_analytics | 初始化分析存储 | 是 |
| 6 | validate_compatibility | 验证 Phase 1 兼容性 | 否 |
| 7 | data_integrity_check | 数据完整性检查 | 否 |
| 8 | write_migration_state | 写入迁移状态 | 是 |

### 目录变化

迁移后将创建以下新目录：

```
~/.prism-gateway/
├── analytics/                    # [新增] 分析数据
│   ├── metrics.jsonl             # 指标记录
│   └── aggregated/               # 聚合数据
│       └── index.json
├── cache/                        # [新增] 缓存数据
│   └── index.json
├── config/                       # [新增] 配置文件
│   ├── default.json              # 默认配置
│   ├── user.json.local           # 用户配置
│   └── .gitignore
├── logs/                         # [新增] 活动日志
│   └── activity.jsonl
├── .migration/                   # [新增] 迁移状态
│   └── state.json
├── level-1-hot/                  # [保持] Phase 1 热数据
├── level-2-warm/                 # [保持] Phase 1 温数据
└── level-3-cold/                 # [保持] Phase 1 冷数据
```

### 备份位置

迁移会自动创建备份：

```
~/.prism-gateway-backup-YYYYMMDD-MS/
├── level-1-hot/          # Phase 1 热数据备份
├── level-2-warm/         # Phase 1 温数据备份
└── level-3-cold/         # Phase 1 冷数据备份
```

**备份保留建议**：建议保留备份 30 天。

---

## 验证方法

### 四层验证机制

#### Layer 1: 系统兼容性验证

验证系统环境是否满足迁移要求：

- Phase 1 数据目录存在
- 文件读写权限正常
- 必需文件完整

#### Layer 2: 数据完整性验证

验证 Phase 1 数据完整性：

- [ ] principles.json 可解析且结构正确
- [ ] success_patterns.json 可解析且结构正确
- [ ] failure_patterns.json 可解析且结构正确
- [ ] retros/index.jsonl 格式正确
- [ ] violations.jsonl 格式正确

#### Layer 3: 业务逻辑验证

验证 Phase 2 功能正常：

- [ ] Gateway 检查功能正常
- [ ] 复盘功能正常
- [ ] 数据读取功能正常
- [ ] 统计功能正常

#### Layer 4: 性能验证

验证性能达标：

- [ ] 100 条记录迁移 < 1 秒
- [ ] 1000 条记录迁移 < 5 分钟
- [ ] 数据读取性能无明显下降

### 验证命令

```bash
# 完整验证
prism migrate --status

# 手动验证各项功能
prism check "测试 Gateway 检查"
prism retro quick
prism stats
prism principles
prism patterns
```

---

## 回滚流程

### 何时需要回滚

以下情况建议回滚：

1. 迁移过程中出现错误
2. Phase 2 功能异常
3. 数据完整性验证失败
4. 用户明确要求回滚

### 回滚步骤

```bash
# 执行回滚
prism migrate --rollback

# 或使用脚本
bun run src/migration/scripts/phase1-to-phase2.ts --rollback
```

### 回滚后状态

回滚后：

- Phase 2 新目录将被删除
- Phase 1 数据保持完整
- 系统恢复到迁移前状态

### 回滚验证

```bash
# 验证 Phase 1 数据完整
ls -la ~/.prism-gateway/level-1-hot/
ls -la ~/.prism-gateway/level-2-warm/
ls -la ~/.prism-gateway/level-3-cold/

# 验证 Phase 2 目录已删除
[ ! -d ~/.prism-gateway/analytics ] && echo "Analytics 已删除"
[ ! -d ~/.prism-gateway/cache ] && echo "Cache 已删除"
[ ! -d ~/.prism-gateway/config ] && echo "Config 已删除"
[ ! -d ~/.prism-gateway/.migration ] && echo "Migration 状态已清除"
```

---

## 故障排查

### 问题：迁移失败 - 预验证失败

**症状**：预迁移验证检查失败

**解决方案**：
1. 检查 Phase 1 数据是否完整
2. 检查文件权限
3. 修复损坏的 JSON 文件

```bash
# 检查必需文件
cat ~/.prism-gateway/level-1-hot/principles.json | jq .
cat ~/.prism-gateway/level-1-hot/patterns/success_patterns.json | jq .
```

### 问题：迁移失败 - 备份失败

**症状**：创建备份时失败

**解决方案**：
1. 检查磁盘空间
2. 检查目标目录权限
3. 检查是否有其他进程占用文件

```bash
# 检查磁盘空间
df -h ~

# 检查权限
ls -la ~/.prism-gateway/
```

### 问题：迁移失败 - 配置创建失败

**症状**：无法创建配置文件

**解决方案**：
1. 检查 config 目录权限
2. 手动创建 config 目录
3. 检查磁盘空间

```bash
# 手动创建目录
mkdir -p ~/.prism-gateway/config
chmod 755 ~/.prism-gateway/config
```

### 问题：Phase 2 功能异常

**症状**：迁移后功能不正常

**解决方案**：
1. 检查迁移状态
2. 验证数据完整性
3. 如果问题严重，考虑回滚

```bash
# 检查状态
prism migrate --status

# 如果需要，回滚
prism migrate --rollback
```

### 问题：回滚失败

**症状**：无法完成回滚

**解决方案**：
1. 手动删除 Phase 2 目录
2. 清理迁移状态文件
3. Phase 1 数据应保持完整

```bash
# 手动清理
rm -rf ~/.prism-gateway/analytics
rm -rf ~/.prism-gateway/cache
rm -rf ~/.prism-gateway/config
rm -rf ~/.prism-gateway/logs
rm -rf ~/.prism-gateway/.migration

# 验证 Phase 1 数据完整
ls -la ~/.prism-gateway/level-*/
```

---

## 迁移清单

### 预迁移清单

- [ ] 备份重要数据（虽然迁移会自动备份）
- [ ] 确认磁盘空间充足（>100MB）
- [ ] 阅读完整迁移指南
- [ ] 了解回滚流程
- [ ] 确认系统时间正确

### 迁移中清单

- [ ] 执行 dry-run 模拟
- [ ] 检查预验证结果
- [ ] 观察迁移日志输出
- [ ] 记录迁移时间
- [ ] 保存备份位置

### 迁移后清单

- [ ] 验证迁移状态
- [ ] 检查数据完整性
- [ ] 测试 Phase 2 功能
- [ ] 验证性能指标
- [ ] 记录迁移结果

---

## 高级选项

### 自定义基础路径

如果 PRISM-Gateway 安装在非标准位置：

```bash
prism migrate --path /custom/path/to/prism-gateway
```

### 批量迁移

对于多个安装：

```bash
#!/bin/bash
# 批量迁移脚本

for path in /path/to/installation/*; do
  echo "迁移: $path"
  prism migrate --path "$path"
done
```

### 自动化迁移

在 CI/CD 中使用：

```yaml
# GitHub Actions 示例
- name: 迁移 PRISM-Gateway
  run: |
    prism migrate --dry-run
    prism migrate
    prism migrate --status
```

---

## 技术参考

### Shadow Migration Pattern

PRISM-Gateway 使用 Shadow Migration Pattern：

1. **Phase 1 数据永不修改**
2. **备份在变更前创建**
3. **Phase 2 与 Phase 1 共存**
4. **回滚随时可用**

### 数据兼容性

Phase 2 完全兼容 Phase 1 数据格式：

- Phase 1 的 JSON 文件无需转换
- Phase 1 的 JSONL 文件无需转换
- Phase 2 可直接读取 Phase 1 数据

### 迁移性能

| 数据量 | 预期时间 | 记录/秒 |
|--------|----------|---------|
| 100 条 | < 1 秒 | >100 |
| 1000 条 | < 5 分钟 | >3 |
| 10000 条 | < 30 分钟 | >5 |

---

## 联系与支持

### 文档资源

- [数据迁移方案](DATA_MIGRATION_PLAN.md)
- [Phase 2 架构文档](PHASE2_ARCHITECTURE.md)
- [项目 README](README.md)

### 问题报告

如遇到迁移问题，请提供以下信息：

1. PRISM-Gateway 版本
2. 迁移状态输出 (`prism migrate --status`)
3. 错误日志
4. 系统环境信息

---

## 附录

### A. 迁移状态文件格式

```json
{
  "version": "2.0",
  "phase1_version": "1.0",
  "phase2_version": "2.0",
  "migration_started": "2026-02-04T10:00:00Z",
  "migration_completed": "2026-02-04T10:00:05Z",
  "steps": [
    {
      "name": "backup",
      "status": "completed",
      "started_at": "2026-02-04T10:00:00Z",
      "completed_at": "2026-02-04T10:00:01Z"
    }
  ],
  "rollback_available": true,
  "backup_location": "/Users/user/.prism-gateway-backup-1738665600000"
}
```

### B. 配置文件格式

`~/.prism-gateway/config/default.json`:

```json
{
  "version": "2.0",
  "created_at": "2026-02-04T10:00:00Z",
  "gateway": {
    "check_timeout": 5000,
    "parallel_checks": 10,
    "cache_ttl": 60000
  },
  "retrospective": {
    "auto_trigger": true,
    "trigger_conditions": [
      {
        "type": "violation_count",
        "threshold": 5,
        "window": "1h"
      }
    ]
  },
  "analytics": {
    "enabled": true,
    "aggregation_interval": "daily",
    "retention_days": 90
  },
  "api": {
    "enabled": false,
    "port": 3000,
    "cors_origins": ["http://localhost:3000"]
  },
  "migration": {
    "phase1_version": "1.0",
    "phase2_version": "2.0",
    "completed": true
  }
}
```

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-04
**维护者**: PRISM-Gateway Team
