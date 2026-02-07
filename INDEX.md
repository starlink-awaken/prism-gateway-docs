# PRISM-Gateway 项目文档索引

**项目：** PRISM-Gateway - 统一的7维度复盘和Gateway系统
**文档版本：** 3.0.0
**最后更新：** 2026-02-07

---

## 📚 文档结构

```
prism-gateway-docs/
├── api/            # API文档
├── docs/           # 使用文档和指南（按角色分类）
├── reports/        # 项目报告和复盘（按类型分类）
├── scripts/        # 重构执行脚本
└── prism-gateway/  # 主项目代码
```

---

## 🎯 快速导航

### 新手入门

1. **[README.md](README.md)** - 项目简介和快速开始
2. **[CLAUDE.md](CLAUDE.md)** - AI上下文文档（完整项目信息）
3. **[FAQ.md](FAQ.md)** - 常见问题解答

### 核心文档

- **[API文档](api/)** - 完整的API参考文档
- **[使用文档](docs/)** - 按角色分类的使用指南
- **[项目报告](reports/)** - 按类型分类的项目报告

---

## 📊 项目报告 (reports/)

reports/ 目录按类型组织了所有项目报告。

### 报告分类

| 分类 | 目录 | 说明 |
|------|------|------|
| **里程碑报告** | milestone/ | Phase、Week完成报告、Release Notes |
| **任务报告** | task/ | Task完成报告 |
| **质量报告** | quality/ | 验证报告、测试报告、覆盖率报告 |
| **架构报告** | architecture/ | 设计文档、重构报告 |
| **项目管理** | project/ | 进度、路线图 |
| **其他** | operations/, testing/, governance/, github/, archive/ | 运维、测试、治理等 |

### 重要报告快速访问

| 文档 | 描述 |
|------|------|
| [PHASE2_ARCHITECTURE.md](reports/architecture/PHASE2_ARCHITECTURE.md) | Phase 2系统架构设计（37KB） |
| [QA_ASSURANCE_FRAMEWORK.md](reports/QA_ASSURANCE_FRAMEWORK.md) | 质量保证框架 |
| [README.md](reports/README.md) | 报告模块详细说明 |
| [CLAUDE.md](reports/CLAUDE.md) | 报告模块导航 |

---

## 📖 使用文档 (docs/)

docs/ 目录包含按角色分类的使用文档和指南。

### 按角色分类

| 角色 | 目录 | 文档内容 |
|------|------|----------|
| **👤 用户** | users/ | 快速开始、安装、用户指南、配置、FAQ、故障排查 |
| **👨‍💻 开发者** | developers/ | 开发环境、架构、API参考、贡献、测试、编码规范 |
| **🤝 贡献者** | contributors/ | 工作流程、代码审查、项目标准 |
| **🔧 运维** | operators/ | 部署、监控、故障排查 |

### 核心技术文档

| 文档 | 描述 |
|------|------|
| [MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) | 数据迁移指南 |
| [FILE_LOCK_USAGE.md](docs/FILE_LOCK_USAGE.md) | 文件锁使用文档 |
| [mcp-server.md](docs/mcp-server.md) | MCP Server集成文档 |
| [CLAUDE.md](docs/CLAUDE.md) | 文档模块导航 |

---

## 🔌 API文档 (api/)

api/ 目录包含完整的API参考文档。

### 核心 API

| 文档 | 描述 |
|------|------|
| [README.md](api/README.md) | API文档总览和快速开始（13KB） ⭐ |
| [GatewayGuard.md](api/GatewayGuard.md) | Gateway检查器 |
| [MemoryStore.md](api/MemoryStore.md) | 三层MEMORY架构 |
| [DataExtractor.md](api/DataExtractor.md) | 7维度数据提取 |
| [RetrospectiveCore.md](api/RetrospectiveCore.md) | 复盘核心引擎 |
| [QuickReview.md](api/QuickReview.md) | 快速复盘工具 |

### 模式匹配器

| 文档 | 描述 |
|------|------|
| [PatternMatcher.md](api/PatternMatcher.md) | 模式匹配器 |
| [PrincipleChecker.md](api/PrincipleChecker.md) | 原则检查器 |
| [TrapDetector.md](api/TrapDetector.md) | 陷阱检测器 |

### REST API

| 文档 | 描述 |
|------|------|
| [REST_API_GUIDE.md](api/REST_API_GUIDE.md) | REST API使用指南 |
| [CONTEXT_SYNC_API.md](api/CONTEXT_SYNC_API.md) | 上下文同步API |
| [CLAUDE.md](api/CLAUDE.md) | API模块导航 |

---

## 📈 项目统计

### 文档统计

- **总文档数：** 234+ 个（优化后）
- **报告文档：** 35+ 个（按类型分类）
- **使用文档：** 43+ 个（按角色分类）
- **API文档：** 13 个（统一位置）
- **归档文档：** 11 个（历史参考）

### 项目进度

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| Phase 1 MVP | ✅ 完成 | 100% |
| Phase 2 基础设施 | ✅ 完成 | 100% |
| Phase 3 生产就绪 | ✅ 完成 | 100% |

**当前版本：** v3.0.0 🎉
**整体进度：** 生产就绪 ✅

---

## 📝 文档维护

### 更新日志

**v3.0.0** (2026-02-07)
- 🎉 **文档组织重构和v3.0.0发布**
  - 归档旧迁移文档（Phase 1→2）至 docs/archive/old-migrations/
  - 归档实验性框架（SIX_ORG）至 docs/archive/experimental-frameworks/
  - 整理 35+ Phase 3 报告至 reports/milestone/
  - 更新所有核心文档到 v3.0.0
  - 创建文档标准指南
- 详见：[DOCUMENT_REORGANIZATION_REPORT_V2.md](DOCUMENT_REORGANIZATION_REPORT_V2.md)

**v2.0.0** (2026-02-07)
- 🎉 **大规模文档整理和清理**
  - 删除10个重复文件
  - 重新组织20个报告文件
  - 新增5个配置文件
  - 精简CLAUDE.md文件1,030行
  - 增强.gitignore文件（11行→87行）
- 详见：[DOCUMENT_CLEANUP_REPORT.md](DOCUMENT_CLEANUP_REPORT.md)

**v1.1.0** (2026-02-03)
- 添加 Week 2-3 完成报告
- 添加 MCP Server 完成报告
- 添加数据迁移文档
- 添加文件锁使用文档

**v1.0.0** (2026-02-03)
- Phase 1 MVP 完成报告
- Phase 1 深度复盘报告
- Phase 2 架构设计

---

## 🔗 相关链接

### 项目文档

- **[README.md](README.md)** - 项目主页
- **[CLAUDE.md](CLAUDE.md)** - AI上下文文档
- **[CHANGELOG.md](CHANGELOG.md)** - 版本历史
- **[CONTRIBUTING.md](prism-gateway/CONTRIBUTING.md)** - 贡献指南

### 社区文档

- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** - 行为准则
- **[GOVERNANCE.md](GOVERNANCE.md)** - 治理文档
- **[SUPPORT.md](SUPPORT.md)** - 支持政策
- **[CONTACT.md](CONTACT.md)** - 联系方式

### 报告文档

- **[PROJECT_STATE.md](PROJECT_STATE.md)** - 项目状态（v3.0.0）
- **[DOCUMENT_REORGANIZATION_REPORT_V2.md](DOCUMENT_REORGANIZATION_REPORT_V2.md)** - 文档重组报告（v3.0.0） ⭐ NEW
- **[DOCUMENT_CLEANUP_REPORT.md](DOCUMENT_CLEANUP_REPORT.md)** - 文档清理报告（v2.0.0）

---

**文档索引生成时间：** 2026-02-07
**文档版本：** 3.0.0

*PAI - Personal AI Infrastructure*
*Version: 2.5*
