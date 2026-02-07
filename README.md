# PRISM-Gateway

> **7维度复盘系统 + AI Agent 行为准则门禁**

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-624%2B-brightgreen.svg)](#)
[![Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)](#)

---

## 什么是 PRISM-Gateway？

PRISM-Gateway 是一套**个人 AI 基础设施系统**（Personal AI Infrastructure），帮助你：

- 🛡️ **Gateway（门禁）** - 在任务执行前检查是否违反行为准则
- 🔄 **Retrospective（复盘）** - 从7个维度（原则、模式、基准、陷阱、成功、工具、数据）全面复盘
- 📊 **Analytics（分析）** - 持续追踪指标，识别趋势和异常
- 🔒 **Security（安全）** - 生产级 JWT 认证、RBAC 授权、速率限制
- 💾 **Operations（运维）** - 自动备份、健康监控、告警系统

**核心理念：** 通过复盘总结规律 → 内化为 Gateway 实时检查 → 形成持续进化的智能系统

---

## 快速开始

### 安装

```bash
# 克隆项目
cd ~/.prism-gateway

# 安装依赖（需要 Bun >= 1.0）
bun install

# 运行测试
bun test
```

### 基本使用

```bash
# 检查任务意图是否符合原则
prism check "实现用户登录功能"

# 执行快速复盘（5分钟）
prism retro quick

# 查看统计数据
prism stats

# 启动 Web UI
prism ui
```

更多详情请参考 [快速入门指南](prism-gateway/docs/QUICK_START.md)

---

## 核心功能

### 1. Gateway 门禁系统

在执行任务前检查是否违反行为准则：

```typescript
const result = await gateway.check("实现 XXX 功能");
if (result.status === 'BLOCKED') {
  console.log('违反原则:', result.violations);
}
```

**三层检查：**
- 🚫 **MANDATORY** - 原则检查（必须通过）
- ⚠️ **WARNING** - 模式匹配（提醒注意）
- 💡 **ADVISORY** - 陷阱识别（建议参考）

### 2. 7维度复盘框架

从多个角度全面分析项目经验：

| 维度 | 说明 | 数据源 |
|------|------|--------|
| **原则** (Principles) | 违反的行为准则 | Gateway 检查记录 |
| **模式** (Patterns) | 成功/失败模式 | PatternMatcher |
| **基准** (Benchmarks) | 能力评估指标 | Analytics 数据 |
| **陷阱** (Traps) | 常见陷阱 | TrapDetector |
| **成功** (Success) | 成功因素 | DataExtractor |
| **工具** (Tools) | 使用的工具 | 环境上下文 |
| **数据** (Data) | 关键数据点 | 数据模型 |

### 3. Analytics 数据分析

- 📈 **指标聚合** - 使用率、质量、性能、趋势
- 🔍 **趋势分析** - 线性回归、移动平均、变化点检测
- ⚡ **异常检测** - Z-score 方法识别异常
- 🎯 **智能告警** - 自动生成描述和修复建议

### 4. 生产级安全

- 🔐 JWT + RBAC 认证授权
- 🚦 三层速率限制（API、WebSocket、消息）
- 🔒 OWASP Top 10 合规（100%）
- 🛡️ 零安全威胁（0 critical/high/medium）

### 5. 运维工具

- 💾 **自动备份** - 全量/增量备份，压缩率 >70%
- 🏥 **健康监控** - 7个系统检查器，自愈机制
- 📊 **指标收集** - 6个采集器，4级时序存储
- 🚨 **智能告警** - 5个通知渠道，降噪机制

### 6. Web UI Dashboard

- ⚛️ React 18 + TypeScript + Vite 5
- 📊 实时图表和统计卡片
- 🔄 WebSocket 实时事件流
- 🎨 Tailwind CSS 深色模式

---

## 架构设计

### 三层 MEMORY 架构

```
~/.prism-gateway/
├── level-1-hot/      # 实时查询（<100ms）
│   ├── principles.json
│   └── patterns/
├── level-2-warm/     # 复盘历史（可读写）
│   ├── retros/
│   └── violations.jsonl
└── level-3-cold/     # 知识库（只读）
    ├── sops/
    ├── checklists/
    └── templates/
```

### 系统分层

```
用户交互层：CLI、Web UI、REST API、WebSocket
        ↓
核心服务层：Gateway、Retrospective、Analytics、Auth
        ↓
数据层：Hot Store、Warm Archive、Cold Knowledge
```

更多架构细节请参考 [架构文档](reports/architecture/PHASE2_ARCHITECTURE.md)

---

## 文档导航

### 📖 用户文档
- [快速入门](prism-gateway/docs/QUICK_START.md) - 5分钟上手
- [配置指南](prism-gateway/docs/CONFIGURATION_GUIDE.md) - 完整配置参考
- [迁移指南](prism-gateway/docs/MIGRATION_GUIDE_V3.md) - v2.x → v3.0 升级
- [常见问题](FAQ.md)

### 👨‍💻 开发者文档
- [开发指南](docs/developers/getting-started.md) - 开发环境搭建
- [API 参考](api/README.md) - 完整 API 文档
- [测试指南](docs/developers/testing-guide.md)
- [贡献指南](docs/developers/contributing-guide.md)

### 🔧 运维文档
- [部署指南](docs/operators/deployment.md) - 生产环境部署
- [监控指南](docs/operators/monitoring.md) - 监控和告警
- [故障排查](docs/operators/troubleshooting.md)

### 📊 项目状态
- [项目状态](PROJECT_STATE.md) - 当前进度和规划
- [变更日志](CHANGELOG.md) - 版本历史
- [发布说明](prism-gateway/RELEASE_NOTES_V3.0.md) - v3.0.0 新功能

---

## 技术栈

- **运行时:** Bun >= 1.0
- **语言:** TypeScript 5.3+
- **HTTP:** Hono
- **测试:** Bun Test (624+ 测试，>90% 覆盖率)
- **MCP:** @modelcontextprotocol/sdk
- **前端:** React 18 + Vite 5 + TypeScript
- **样式:** Tailwind CSS
- **图表:** Chart.js

---

## 性能指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| Gateway 检查 | <1000ms | <100ms | ✅ 10x |
| MEMORY 读写 | <100ms | <100ms | ✅ |
| API P95 响应 | <100ms | <50ms | ✅ 2x |
| 备份速度 | <60s | <30s | ✅ 2x |
| 测试覆盖率 | >90% | >90% | ✅ |

---

## 项目状态

**当前版本:** v3.0.0 🎉
**状态:** 生产就绪 ✅
**测试:** 624+ 测试全部通过
**安全:** OWASP Top 10 合规（100%）

### Phase 3 完成情况

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| Week 1: 安全加固 | ✅ | 100% |
| Week 2: Web UI MVP | ✅ | 100% |
| Week 3: 运维工具设计 | ✅ | 100% |
| Week 4: 运维工具实现 | ✅ | 100% |
| Week 5: 文档和发布 | ✅ | 100% |

**下一步:** v3.1.0 规划中（Web UI 增强、高级分析）

---

## 社区

### 贡献

欢迎贡献！请查看：

- [贡献指南](docs/developers/contributing-guide.md) - 如何参与开发
- [行为准则](CODE_OF_CONDUCT.md) - 社区规范
- [贡献者列表](CONTRIBUTORS.md) - 感谢所有贡献者

### 支持

- 📖 [文档中心](docs/)
- 💬 [GitHub Discussions](https://github.com/starlink-awaken/prism-gateway-docs/discussions)
- 🐛 [问题反馈](https://github.com/starlink-awaken/prism-gateway-docs/issues)
- 📧 [支持政策](SUPPORT.md)

---

## 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 相关链接

- **主项目:** [prism-gateway/](prism-gateway/)
- **文档索引:** [INDEX.md](INDEX.md)
- **完整文档:** [docs/](docs/)
- **API 文档:** [api/](api/)
- **项目报告:** [reports/](reports/)

---

**版本:** 3.0.0
**最后更新:** 2026-02-07

*PAI - Personal AI Infrastructure*
