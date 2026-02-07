# Level-3-Cold：冷数据知识库

> 只读知识库，包含 SOPs、检查清单和模板

**类型：** Cold 数据（知识库，只读）
**访问频率：** 罕见（N/A）
**用途：** 知识库、参考文档、标准流程
**最后更新：** 2026-02-07

---

## 📚 目录结构

```
level-3-cold/
├── sops/                    # 标准操作流程（Standard Operating Procedures）
│   ├── code-review.md      # 代码审查流程
│   ├── deployment.md       # 部署流程
│   ├── incident-response.md # 应急响应流程
│   └── retrospective.md    # 复盘流程
├── checklists/             # 检查清单
│   ├── deployment.md       # 部署检查清单
│   ├── security.md         # 安全检查清单
│   ├── pr-review.md        # PR 审查清单
│   └── testing.md          # 测试检查清单
└── templates/              # 文档模板
    ├── retro-report.md     # 复盘报告模板
    ├── weekly-report.md    # 周报模板
    ├── decision-log.md     # 决策日志模板
    └── meeting-minutes.md  # 会议纪要模板
```

---

## 🎯 使用说明

### 什么是 Level-3-Cold？

Level-3-Cold 是 PRISM-Gateway 三层 MEMORY 架构的**冷数据层**，存储长期不变的知识库内容：

| 特性 | 说明 |
|------|------|
| **访问频率** | 罕见（需要时查阅） |
| **数据类型** | 标准流程、检查清单、模板 |
| **读写权限** | 只读（仅系统初始化时写入） |
| **响应要求** | 无（按需查阅） |
| **更新频率** | 极低（版本升级时更新） |

### 与其他层的关系

```
┌─────────────────────────────────────────────────────┐
│ Level-1-Hot (热数据)                                 │
│ ├── principles.json     ← 5条核心原则                │
│ └── patterns/           ← 成功/失败模式              │
│ 访问: 每次检查          响应: <100ms                 │
└─────────────────────────────────────────────────────┘
                      ↓ 违规记录
┌─────────────────────────────────────────────────────┐
│ Level-2-Warm (温数据)                                │
│ ├── retros/             ← 复盘历史记录               │
│ └── violations.jsonl    ← 违规日志                   │
│ 访问: 复盘时            响应: <500ms                 │
└─────────────────────────────────────────────────────┘
                      ↓ 参考流程
┌─────────────────────────────────────────────────────┐
│ Level-3-Cold (冷数据) ← 当前层                       │
│ ├── sops/               ← 标准操作流程               │
│ ├── checklists/         ← 检查清单                   │
│ └── templates/          ← 文档模板                   │
│ 访问: 需要时查阅        响应: 按需                   │
└─────────────────────────────────────────────────────┘
```

---

## 📖 内容说明

### SOPs (标准操作流程)

**位置：** `level-3-cold/sops/`

存储标准化的操作流程文档，确保团队遵循统一的工作方式：

| 文件 | 描述 | 适用场景 |
|------|------|----------|
| `code-review.md` | 代码审查流程 | PR 审查时参考 |
| `deployment.md` | 部署流程 | 生产部署时参考 |
| `incident-response.md` | 应急响应流程 | 生产故障时参考 |
| `retrospective.md` | 复盘流程 | 执行复盘时参考 |

**访问方式：**
```typescript
// 通过 MemoryStore API
const sop = await memoryStore.readSOP('code-review');

// 或直接读取文件
cat level-3-cold/sops/code-review.md
```

### Checklists (检查清单)

**位置：** `level-3-cold/checklists/`

存储各类检查清单，确保关键步骤不遗漏：

| 文件 | 描述 | 适用场景 |
|------|------|----------|
| `deployment.md` | 部署检查清单 | 部署前/后验证 |
| `security.md` | 安全检查清单 | 安全审计时使用 |
| `pr-review.md` | PR 审查清单 | PR 审查时使用 |
| `testing.md` | 测试检查清单 | 测试规划时使用 |

**访问方式：**
```typescript
// 通过 MemoryStore API
const checklist = await memoryStore.readChecklist('deployment');

// 或直接读取文件
cat level-3-cold/checklists/deployment.md
```

### Templates (文档模板)

**位置：** `level-3-cold/templates/`

存储标准化的文档模板，确保文档格式统一：

| 文件 | 描述 | 适用场景 |
|------|------|----------|
| `retro-report.md` | 复盘报告模板 | 执行复盘后生成报告 |
| `weekly-report.md` | 周报模板 | 每周生成周报 |
| `decision-log.md` | 决策日志模板 | 记录重要决策 |
| `meeting-minutes.md` | 会议纪要模板 | 记录会议内容 |

**访问方式：**
```typescript
// 通过 MemoryStore API
const template = await memoryStore.readTemplate('retro-report');

// 或直接读取文件
cat level-3-cold/templates/retro-report.md
```

---

## 🔧 开发者指南

### 添加新的 SOP

1. 创建 Markdown 文件：`level-3-cold/sops/{name}.md`
2. 遵循标准格式（见现有 SOP）
3. 通过 `readSOP()` 方法访问

### 添加新的 Checklist

1. 创建 Markdown 文件：`level-3-cold/checklists/{name}.md`
2. 使用复选框格式：`- [ ] 任务项`
3. 通过 `readChecklist()` 方法访问

### 添加新的 Template

1. 创建 Markdown 文件：`level-3-cold/templates/{name}.md`
2. 使用占位符：`[描述]`、`YYYY-MM-DD` 等
3. 通过 `readTemplate()` 方法访问

---

## 📊 数据统计

**目录信息：**
- **SOPs：** 4 个标准流程
- **Checklists：** 4 个检查清单
- **Templates：** 4 个文档模板
- **总大小：** ~50KB
- **访问频率：** 低（按需）

**维护策略：**
- **更新频率：** 版本升级时更新
- **质量控制：** 专家评审
- **版本管理：** Git 版本控制
- **备份策略：** 随系统备份

---

## 🔗 相关文档

- [MemoryStore API 文档](../../api/MemoryStore.md)
- [三层架构设计](../../docs/ARCHITECTURE.md)
- [部署指南](../../docs/DEPLOYMENT_GUIDE.md)
- [运维手册](../../docs/OPERATIONS_MANUAL.md)

---

**维护者：** PRISM-Gateway Team
**许可证：** MIT License
**PAI 版本：** 2.5
