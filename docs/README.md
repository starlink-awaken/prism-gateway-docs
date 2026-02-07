# PRISM-Gateway 文档中心

> **最后更新：** 2026-02-07
> **状态：** 按角色分类组织（4个角色，40+ 文档）

---

## 📚 文档分类导航

本项目所有使用文档已按用户角色重新组织，方便不同角色的用户快速找到所需文档。

### 👤 [users/](./users/) - 用户文档（8个）

面向 PRISM-Gateway 最终用户的使用指南。

**包含内容：**
- 快速开始指南
- 安装说明
- 用户指南
- 配置说明
- 常见问题（FAQ）
- 故障排查

**快速访问：**
- [quick-start.md](./users/quick-start.md) - 5分钟快速上手
- [installation.md](./users/installation.md) - 系统安装指南
- [user-guide.md](./users/user-guide.md) - 完整使用指南
- [configuration.md](./users/configuration.md) - 配置参考
- [faq.md](./users/faq.md) - 常见问题解答
- [troubleshooting.md](./users/troubleshooting.md) - 问题排查指南

---

### 👨‍💻 [developers/](./developers/) - 开发者文档（7个）

面向 PRISM-Gateway 开发者的技术文档。

**包含内容：**
- 开发环境搭建
- 系统架构设计
- API 参考文档
- 贡献指南
- 测试指南
- 编码规范

**快速访问：**
- [getting-started.md](./developers/getting-started.md) - 开发环境搭建
- [architecture.md](./developers/architecture.md) - 系统架构设计
- [api-reference.md](./developers/api-reference.md) - API 参考
- [contributing-guide.md](./developers/contributing-guide.md) - 贡献流程
- [testing-guide.md](./developers/testing-guide.md) - 测试规范
- [coding-standards.md](./developers/coding-standards.md) - 代码规范

---

### 🤝 [contributors/](./contributors/) - 贡献者文档（4个）

面向项目贡献者的协作流程文档。

**包含内容：**
- 工作流程
- 代码审查规范
- 项目标准
- 协作指南

**快速访问：**
- [workflow.md](./contributors/workflow.md) - 贡献工作流程
- [code-review.md](./contributors/code-review.md) - 代码审查规范
- [standards.md](./contributors/standards.md) - 项目标准

---

### 🔧 [operators/](./operators/) - 运维文档（4个）

面向系统运维人员的部署和运维文档。

**包含内容：**
- 部署指南
- 监控配置
- 故障排查
- 运维最佳实践

**快速访问：**
- [deployment.md](./operators/deployment.md) - 生产环境部署
- [monitoring.md](./operators/monitoring.md) - 监控和告警配置
- [troubleshooting.md](./operators/troubleshooting.md) - 运维故障排查

---

### 📖 核心技术文档（根目录）

**认证和安全：**
- [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) - JWT + RBAC 认证指南（21KB）
- [SECURITY_SCAN_GUIDE.md](./SECURITY_SCAN_GUIDE.md) - 安全扫描指南（13KB）
- [rate-limit.md](./rate-limit.md) - 速率限制配置（6KB）

**部署和运维：**
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 完整部署指南（19KB）
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - 部署检查清单（7KB）
- [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md) - 运维手册（22KB）
- [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) - 故障排查指南（18KB）

**集成和技术：**
- [mcp-server.md](./mcp-server.md) - MCP Server 集成文档（7KB）
- [FILE_LOCK_USAGE.md](./FILE_LOCK_USAGE.md) - 文件锁使用文档（8KB）

---

### 📦 [archive/](./archive/) - 历史归档

**old-migrations/** - 旧版本迁移文档（Phase 1→2）
- [MIGRATION_GUIDE.md](./archive/old-migrations/MIGRATION_GUIDE.md) - 旧迁移指南
- [DATA_MIGRATION_PLAN.md](./archive/old-migrations/DATA_MIGRATION_PLAN.md) - 数据迁移计划
- [MIGRATION_ROLLBACK_PLAN.md](./archive/old-migrations/MIGRATION_ROLLBACK_PLAN.md) - 回滚计划

**experimental-frameworks/** - 实验性框架（已废弃）
- [SIX_ORG_COLLABORATION_FRAMEWORK.md](./archive/experimental-frameworks/SIX_ORG_COLLABORATION_FRAMEWORK.md) - 多组织协作框架
- [SIX_ORG_IMPLEMENTATION_GUIDE.md](./archive/experimental-frameworks/SIX_ORG_IMPLEMENTATION_GUIDE.md) - 实施指南

---

## 📈 统计摘要

| 分类 | 文件数 | 主要内容 |
|------|--------|----------|
| users/ | 8 | 用户使用指南 |
| developers/ | 7 | 开发技术文档 |
| contributors/ | 4 | 贡献协作流程 |
| operators/ | 4 | 部署运维指南 |
| 核心技术文档 | 9 | 认证、安全、集成 |
| archive/ | 11 | 历史归档文档 |
| **合计** | **43** | **完整文档体系** |

---

## 🔍 快速查找指南

### 按角色查找

**我是新用户，想快速上手：** → `users/quick-start.md`

**我想了解系统架构：** → `developers/architecture.md`

**我想参与开发贡献：** → `contributors/workflow.md` + `developers/contributing-guide.md`

**我要部署到生产环境：** → `operators/deployment.md` + `DEPLOYMENT_GUIDE.md`

**我遇到问题需要排查：** → `users/troubleshooting.md` + `TROUBLESHOOTING_GUIDE.md`

### 按主题查找

**认证和安全：**
- JWT + RBAC 认证：`AUTHENTICATION_GUIDE.md`
- 速率限制：`rate-limit.md`
- 安全扫描：`SECURITY_SCAN_GUIDE.md`

**安装和部署：**
- 快速安装：`users/installation.md`
- 生产部署：`DEPLOYMENT_GUIDE.md` + `operators/deployment.md`
- 部署检查：`DEPLOYMENT_CHECKLIST.md`

**配置和运维：**
- 用户配置：`users/configuration.md`
- 运维手册：`OPERATIONS_MANUAL.md`
- 监控配置：`operators/monitoring.md`

**开发和测试：**
- 开发环境：`developers/getting-started.md`
- 测试指南：`developers/testing-guide.md`
- 代码规范：`developers/coding-standards.md`

**集成和工具：**
- MCP Server：`mcp-server.md`
- 文件锁：`FILE_LOCK_USAGE.md`

---

## 🎯 推荐学习路径

### 新用户路径（1-2小时）

1. 📖 [quick-start.md](./users/quick-start.md) - 5分钟快速上手
2. 📦 [installation.md](./users/installation.md) - 完整安装
3. 📚 [user-guide.md](./users/user-guide.md) - 深入使用
4. ⚙️ [configuration.md](./users/configuration.md) - 自定义配置
5. ❓ [faq.md](./users/faq.md) - 常见问题

### 开发者路径（2-4小时）

1. 🚀 [developers/getting-started.md](./developers/getting-started.md) - 环境搭建
2. 🏗️ [developers/architecture.md](./developers/architecture.md) - 理解架构
3. 📝 [developers/api-reference.md](./developers/api-reference.md) - API 使用
4. 🧪 [developers/testing-guide.md](./developers/testing-guide.md) - 测试规范
5. ✨ [developers/coding-standards.md](./developers/coding-standards.md) - 代码规范
6. 🤝 [developers/contributing-guide.md](./developers/contributing-guide.md) - 参与贡献

### 运维人员路径（3-5小时）

1. 📋 [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - 部署前检查
2. 🚀 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 完整部署流程
3. 🔐 [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) - 认证配置
4. 📊 [operators/monitoring.md](./operators/monitoring.md) - 监控配置
5. 📖 [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md) - 运维手册
6. 🔧 [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) - 故障排查

---

## 📝 文档维护指南

### 添加新文档

1. **确定文档角色** - 根据目标受众选择合适的目录
   - 用户文档 → `users/`
   - 开发者文档 → `developers/`
   - 贡献者文档 → `contributors/`
   - 运维文档 → `operators/`
   - 核心技术文档 → 根目录

2. **创建文档** - 使用清晰的文件名（kebab-case）

3. **更新索引** - 在相应目录的 INDEX.md 中添加链接

4. **更新本 README** - 在相应分类下添加快速访问链接

### 文档命名规范

- **用户/开发者/贡献者/运维文档：** 使用 kebab-case
  - `quick-start.md`, `api-reference.md`, `code-review.md`

- **根目录核心文档：** 使用 UPPER_SNAKE_CASE
  - `AUTHENTICATION_GUIDE.md`, `DEPLOYMENT_GUIDE.md`

### 文档质量标准

- ✅ 清晰的章节结构
- ✅ 实用的代码示例
- ✅ 完整的使用说明
- ✅ 准确的链接引用
- ✅ 及时的版本更新

---

## 🔗 相关链接

### 项目文档

- **项目主页：** [README.md](../README.md)
- **AI 上下文：** [CLAUDE.md](../CLAUDE.md)
- **文档索引：** [INDEX.md](../INDEX.md)
- **项目状态：** [PROJECT_STATE.md](../PROJECT_STATE.md)

### 其他模块

- **API 文档：** [api/](../api/)
- **项目报告：** [reports/](../reports/)
- **主项目代码：** [prism-gateway/](../prism-gateway/)

### 社区资源

- **行为准则：** [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- **贡献者列表：** [CONTRIBUTORS.md](../CONTRIBUTORS.md)
- **支持政策：** [SUPPORT.md](../SUPPORT.md)
- **常见问题：** [FAQ.md](../FAQ.md)

---

## 💡 使用建议

### 首次使用

1. 📖 **浏览本 README** 了解文档结构
2. 🎯 **选择学习路径** 根据您的角色
3. 🔍 **使用查找指南** 快速定位所需文档
4. 📚 **按顺序阅读** 系统学习项目

### 日常使用

- 💡 **遇到问题：** 先查 FAQ 和 troubleshooting
- 🔧 **需要配置：** 查阅 configuration 和相关指南
- 📖 **参与开发：** 阅读 contributing-guide 和 coding-standards
- 🚀 **生产部署：** 遵循 deployment-guide 和 checklist

### 文档反馈

如果您发现：
- 📝 文档有误或过时
- 🔍 缺少重要内容
- 💡 有改进建议

请通过以下方式反馈：
- 提交 Issue 到 GitHub
- 直接提交 Pull Request
- 联系项目维护者

---

**整理完成时间：** 2026-02-07
**文档组织者：** PRISM-Gateway Team
**文档目标：** 让每个角色的用户都能快速找到所需文档
**文档原则：** 结构清晰、内容完整、易于查找、持续更新

---

*PRISM-Gateway 文档中心 - Personal AI Infrastructure*
*版本：v3.0.0*
