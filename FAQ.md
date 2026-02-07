# ReflectGuard 常见问题（FAQ）

## 目录

- [项目简介](#项目简介)
- [快速开始](#快速开始)
- [技术问题](#技术问题)
- [使用问题](#使用问题)
- [贡献相关](#贡献相关)
- [社区与支持](#社区与支持)

---

## 项目简介

### ReflectGuard 是什么？

ReflectGuard 是一套**个人 AI 基础设施系统**（Personal AI Infrastructure），融合了 Gateway（行为准则门禁）和 Retrospective（复盘系统）两大核心能力。

它帮助您：

- **实时检查**：在执行任务前检查是否符合行为准则
- **多维复盘**：从 7 个维度全面复盘工作
- **持续进化**：通过模式识别不断改进

### 谁应该使用 ReflectGuard？

- **AI 助手用户**：希望 AI 助手遵循特定行为准则
- **开发者**：需要复盘和改进开发流程
- **知识工作者**：希望系统化复盘和改进工作方式
- **研究者**：研究 AI 行为控制和复盘系统

### ReflectGuard 是免费的吗？

是的，ReflectGuard 完全开源，使用 MIT 许可证。您可以免费使用、修改和分发。

---

## 快速开始

### 如何安装 ReflectGuard？

```bash
# 克隆项目
git clone https://github.com/starlink-awaken/prism-gateway-docs.git
cd prism-gateway-docs/prism-gateway

# 安装依赖
bun install

# 验证安装
bun test
```

### 系统要求是什么？

- **运行时**: Bun >= 1.0
- **Node.js**: >= 18.0.0（Bun 依赖）
- **操作系统**: macOS, Linux, Windows (WSL)
- **内存**: 至少 2GB 可用内存
- **磁盘**: 至少 500MB 可用空间

### 支持哪些语言？

目前主要支持**中文和英文**。我们欢迎社区贡献其他语言的本地化。

### 第一步应该做什么？

1. 阅读 [README.md](./README.md) 了解项目
2. 查看 [快速开始指南](./docs/QUICK_START.md)
3. 运行 `bun test` 验证安装
4. 尝试 CLI 命令：`prism check "测试任务"`

---

## 技术问题

### 为什么选择 Bun 而不是 Node.js？

Bun 提供了：

- **更快的启动速度**：比 Node.js 快 3-4 倍
- **内置测试**：无需额外测试框架
- **原生 TypeScript**：无需编译步骤
- **更小的依赖**：合并了多种工具

### 为什么使用文件系统而不是数据库？

文件系统存储的优势：

- **零配置**：无需安装和配置数据库
- **易备份**：直接复制目录即可
- **可读性**：JSON 文件可直接查看和编辑
- **轻量级**：适合个人和小团队使用

### 数据存储在哪里？

```
~/.core/
├── level-1-hot/          # 热数据（实时查询）
│   ├── principles.json   # 行为准则
│   └── patterns/         # 模式
├── level-2-warm/         # 温数据（复盘历史）
│   ├── retros/           # 复盘记录
│   └── violations.jsonl  # 违规记录
└── level-3-cold/         # 冷数据（知识库）
    ├── sops/             # 标准操作流程
    ├── checklists/       # 检查清单
    └── templates/        # 模板
```

### 如何备份数据？

```bash
# 完整备份
cp -r ~/.reflectguard ~/.reflectguard.backup.$(date +%Y%m%d)

# 或使用内置命令
prism backup
```

### 如何迁移到新机器？

```bash
# 1. 在旧机器上打包数据
cd ~/.reflectguard
tar czf prism-gateway-data.tar.gz *

# 2. 传输到新机器
scp prism-gateway-data.tar.gz new-machine:~

# 3. 在新机器上解压
mkdir -p ~/.reflectguard
cd ~/.reflectguard
tar xzf ~/prism-gateway-data.tar.gz
```

### 支持哪些 MCP 协议？

ReflectGuard 实现了完整的 Model Context Protocol (MCP)：

- **资源访问**：读取原则、模式、复盘数据
- **工具调用**：检查意图、创建复盘、获取分析
- **事件订阅**：实时事件推送（WebSocket）

### 性能如何？

| 操作 | 目标 | 实际 |
|------|------|------|
| Gateway 检查 | <1000ms | <100ms |
| 快速复盘 | <5min | <5min |
| MEMORY 读写 | <100ms | <100ms |
| MCP 响应 | <100ms | <20ms |

---

## 使用问题

### 如何自定义行为准则？

编辑 `~/.core/level-1-hot/principles.json`：

```json
{
  "principles": [
    {
      "id": "principle-1",
      "name": "您的原则名称",
      "description": "原则描述",
      "severity": "high",
      "enabled": true
    }
  ]
}
```

### 如何创建复盘？

```bash
# 快速复盘（使用默认模板）
prism retro quick

# 标准复盘（交互式）
prism retro standard

# 使用特定模板
prism retro --template deep
```

### 如何查看统计数据？

```bash
# 查看概览统计
prism stats

# 查看详细分析
prism analytics

# 查看趋势
prism trends --period week
```

### 如何导出复盘数据？

```bash
# 导出为 JSON
prism export --format json --output retros.json

# 导出为 Markdown
prism export --format markdown --output retros.md
```

### 如何与其他工具集成？

ReflectGuard 提供多种集成方式：

1. **MCP Server**：与支持 MCP 的 AI 助手集成
2. **REST API**：通过 HTTP 调用
3. **CLI**：在脚本中使用
4. **WebSocket**：实时事件推送

### 支持导入数据吗？

```bash
# 从 Phase 1 迁移
prism migrate --dry-run    # 预检查
prism migrate              # 执行迁移

# 从其他格式导入
prism import --format csv --input data.csv
```

---

## 贡献相关

### 如何贡献代码？

1. Fork 项目仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m "Add: your feature"`
4. 推送到 Fork：`git push origin feature/your-feature`
5. 创建 Pull Request

### 代码规范是什么？

- **语言**: TypeScript 严格模式
- **测试**: TDD，测试先行
- **文档**: 公共方法必须有 TSDoc
- **风格**: ESLint 配置自动检查

### 如何运行测试？

```bash
# 运行所有测试
bun test

# 运行特定文件
bun test path/to/test.test.ts

# 查看覆盖率
bun test --coverage
```

### 测试覆盖率要求是多少？

- **总体覆盖率**: >80%
- **核心模块**: >90%
- **关键路径**: 100%

### 如何报告 Bug？

在 [GitHub Issues](https://github.com/starlink-awaken/prism-gateway-docs/issues) 创建问题，包含：

1. 清晰的标题
2. 环境信息（操作系统、Bun 版本）
3. 复现步骤
4. 期望行为 vs 实际行为
5. 错误日志

### 如何请求功能？

在 [GitHub Issues](https://github.com/starlink-awaken/prism-gateway-docs/issues) 创建功能请求，包含：

1. 功能描述
2. 使用场景
3. 期望的 API 或行为
4. 是否愿意自己实现

### 贡献者协议（CLA）？

目前不需要签署 CLA。提交 PR 即表示您同意：

- 您有权提交该代码
- 代码以 MIT 许可证发布
- 代码是您原创的

---

## 社区与支持

### 如何获得帮助？

| 方式 | 适用场景 | 响应时间 |
|------|----------|----------|
| GitHub Discussions | 技术讨论、问题 | 社区响应 |
| GitHub Issues | Bug 报告、功能请求 | 维护者处理 |
| Discord/Slack | 实时交流 | 社区响应 |

### 有商业支持吗？

目前没有商业支持。如需企业级支持，请联系：conduct@prism-gateway.dev

### 如何联系维护者？

- **邮件**: conduct@prism-gateway.dev
- **GitHub**: @隔壁老王, @pai-system

### 是否有培训或认证？

目前没有正式培训计划。我们可以考虑：

- 定期举办线上研讨会
- 提供社区贡献者认证
- 发布官方学习资源

### 可以在商业项目中使用吗？

是的！ReflectGuard 使用 MIT 许可证，允许商业使用。

---

## 其他问题

### 项目名称含义是什么？

**PRISM** 代表：

- **P**rinciples（原则）
- **R**etrospective（复盘）
- **I**nsight（洞察）
- **S**trategy（策略）
- **M**etrics（指标）

**Gateway** 代表实时检查和门禁机制。

### 项目路线图是什么？

- **Phase 1** (已完成): MVP 基础功能
- **Phase 2** (进行中): Analytics + API
- **Phase 3** (规划中): Web UI + Scheduler
- **Phase 4** (未来): 多人协作 + 企业功能

### 如何获取最新更新？

- **Watch GitHub 仓库**: 获取 Release 通知
- **加入社区**: 参与讨论
- **订阅 RSS**: 关注 CHANGELOG

### 与其他工具的区别？

| 特性 | ReflectGuard | 其他工具 |
|------|--------------|----------|
| 开源 | 完全开源 | 部分开源 |
| 轻量级 | 文件系统存储 | 需要数据库 |
| 实时检查 | Gateway 机制 | 无 |
| 多维复盘 | 7 维度分析 | 少于 7 维 |
| MCP 协议 | 原生支持 | 需要适配 |

---

*本 FAQ 最后更新：2026-02-07*
*版本：1.0.0*

有问题？[创建 Issue](https://github.com/starlink-awaken/prism-gateway-docs/issues) 或加入 [Discussions](https://github.com/starlink-awaken/prism-gateway-docs/discussions)
