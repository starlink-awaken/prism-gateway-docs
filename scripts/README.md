# ReflectGuard 重构脚本快速参考

## 概述

本目录包含 ReflectGuard 项目的重构执行脚本。所有脚本都经过设计，遵循 Shadow Migration Pattern，确保零停机迁移。

## 脚本列表

| 脚本 | 功能 | 时间 | 风险 |
|------|------|------|------|
| `00-prepare.sh` | 准备和备份 | 5分钟 | 低 |
| `01-integrate-configs.sh` | 配置文件整合 | 10分钟 | 中 |
| `02-move-reports.sh` | 报告文件迁移 | 5分钟 | 低 |
| `03-organize-data.sh` | 数据目录重组 | 5分钟 | 低 |
| `04-integrate-docs.sh` | 文档目录整合 | 10分钟 | 低 |
| `05-update-imports.sh` | Import 路径更新 | 15分钟 | 低 |
| `06-verify.sh` | 验证和测试 | 10分钟 | 中 |
| `07-cleanup.sh` | 清理原始文件 | 5分钟 | 低 |
| `rollback.sh` | 回滚脚本 | - | - |

## 快速开始

### 完整执行流程

```bash
cd /Volumes/Model/Workspace/Agent/prism-gateway-docs

# 依次执行所有脚本
bash scripts/00-prepare.sh
bash scripts/01-integrate-configs.sh
bash scripts/02-move-reports.sh
bash scripts/03-organize-data.sh
bash scripts/04-integrate-docs.sh
bash scripts/05-update-imports.sh
bash scripts/06-verify.sh

# 可选：清理原始文件
bash scripts/07-cleanup.sh
```

### 一键执行（推荐）

```bash
cd /Volumes/Model/Workspace/Agent/prism-gateway-docs

# 创建一键执行脚本
cat > scripts/run-all.sh << 'EOF'
#!/bin/bash
for script in 00-prepare 01-integrate-configs 02-move-reports 03-organize-data 04-integrate-docs 05-update-imports 06-verify; do
    echo "执行: scripts/${script}.sh"
    bash "scripts/${script}.sh"
    if [ $? -ne 0 ]; then
        echo "错误: scripts/${script}.sh 执行失败"
        exit 1
    fi
    echo "按回车继续..."
    read
done
echo "所有脚本执行完成！"
EOF

chmod +x scripts/run-all.sh
bash scripts/run-all.sh
```

## 重构目标结构

### 重构前

```
prism-gateway/
├── *.md (13个报告文件)
├── docs/
│   ├── api/
│   ├── api_html/
│   └── api_new/
├── level-1-hot/
├── level-2-warm/
├── level-3-cold/
├── tsconfig.json
├── typedoc.json
├── typedoc-html.json
└── hooks.config.json
```

### 重构后

```
prism-gateway/
├── .prism/                    # 数据目录
│   ├── config/
│   │   └── hooks.json
│   ├── level-1-hot/
│   ├── level-2-warm/
│   ├── level-3-cold/
│   └── state/
├── config/                    # 构建配置
│   ├── tsconfig.json
│   ├── typedoc.json
│   └── tsconfig.paths.json
├── reports/                   # 报告集中
│   └── *.md (所有报告)
├── docs/
│   ├── api/                   # 权威 API 文档
│   ├── guides/                # 用户指南
│   ├── reference/             # 参考文档
│   ├── api_html/ (标记废弃)
│   └── api_new/ (标记废弃)
├── REPORTS.md                 # 报告索引
├── REFACTOR_VERIFICATION.md   # 验证报告
└── tsconfig.json              # 引用 config/tsconfig.json
```

## 回滚

如果重构出现问题，可以随时回滚：

```bash
cd /Volumes/Model/Workspace/Agent/prism-gateway-docs
bash scripts/rollback.sh
```

## 注意事项

1. **备份**: 每次执行前都会创建备份，保存在 `backups/` 目录
2. **验证**: 每个阶段执行后建议检查输出结果
3. **测试**: 阶段 6 会运行完整测试套件，确保功能完整
4. **清理**: 阶段 7 是可选的，可以保留原始文件作为对照

## 常见问题

### Q: 脚本执行失败怎么办？

A: 检查错误信息，修复问题后重新执行该脚本。如果需要，可以使用 `rollback.sh` 恢复。

### Q: 可以跳过某些阶段吗？

A: 可以，但建议按顺序执行。如果跳过，可能需要手动处理依赖关系。

### Q: import 路径会受影响吗？

A: 由于 `src/` 目录结构未改变，import 路径无需更新。脚本 5 会验证这一点。

### Q: 配置文件冲突如何处理？

A: `typedoc.json` 和 `typedoc-html.json` 会合并，优先级为 `typedoc.json` > `typedoc-html.json`。

## 联系

如有问题，请查看 `refactor-plan.md` 获取详细设计文档。
