# ReflectGuard 虚拟团队专业 Agent 角色体系设计

**版本：** 1.0.0
**创建时间：** 2026-02-05
**设计者：** Nova (高能力问题解决者)
**项目状态：** Phase 2 Week 4-5 | Analytics 模块完成 | 412 测试通过

---

## 📋 文档目录

1. [设计背景与目标](#1-设计背景与目标)
2. [核心角色定义](#2-核心角色定义)
3. [角色工作流程](#3-角色工作流程)
4. [角色工具和能力](#4-角色工具和能力)
5. [虚拟团队协作机制](#5-虚拟团队协作机制)
6. [实施路线图](#6-实施路线图)
7. [监控与优化](#7-监控与优化)
8. [附录：角色配置示例](#8-附录角色配置示例)

---

## 1. 设计背景与目标

### 1.1 项目现状分析

**项目特点：**
- **规模：** ~5,000 行代码，~210 文件，412 个测试
- **状态：** Phase 2 Week 4-5，Analytics 模块完成（82 测试，>90% 覆盖率）
- **团队：** 单人开发（隔壁老王）+ AI 辅助
- **技术栈：** TypeScript + Bun + MCP SDK + Hono
- **设计原则：** 轻量级优先、类型安全、测试驱动

**Council 分析共识：**
1. ✅ 采用 3 项目组逻辑架构（Core Platform、Integration Hub、Experience Layer）
2. ✅ 不推荐真实多团队（协调成本过高）
3. ✅ 推荐虚拟团队模式（AI 角色化）
4. 🔴 P0 优先级：API 安全加固
5. 🔴 P0 优先级：质量保证体系

### 1.2 设计目标

**核心目标：** 建立一套轻量级、高效率的虚拟团队 Agent 角色体系，模拟专业团队协作，提升单人开发效率和质量。

**具体目标：**
1. **角色专业化** - 每个 Agent 角色有明确的职责边界和专业领域
2. **协作机制化** - 角色间协作有清晰的工作流程和决策机制
3. **上下文共享** - 共享项目文档和知识库，避免重复沟通
4. **质量保障** - 内置 Code Review、测试验证、安全检查流程
5. **平滑过渡** - 从现有工作模式平滑过渡，不破坏现有流程

### 1.3 设计原则

1. **轻量级** - 不引入重量级框架，保持简单高效
2. **角色驱动** - 每个 AI 对话以角色身份进行，增强专业性和一致性
3. **按需激活** - 角色按需激活，不强制所有角色同时运行
4. **文档先行** - 角色激活前先阅读相关文档，建立共享上下文
5. **持续优化** - 根据使用反馈持续优化角色定义和工作流程

---

## 2. 核心角色定义

### 2.1 角色总览

基于 ReflectGuard 项目特点和 Council 分析，定义 **7 个核心角色**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ReflectGuard 虚拟团队角色体系                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                    │
│  │ 🏛️ Architect  │  │ ⚙️ Engineer   │  │ 🔐 Pentester  │                    │
│  │   架构师      │  │   工程师      │  │   安全专家    │                    │
│  └───────────────┘  └───────────────┘  └───────────────┘                    │
│         │                  │                  │                              │
│         ▼                  ▼                  ▼                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                    │
│  │ ✅ QATester   │  │ 📊 Analyst    │  │ 📝 Writer     │                    │
│  │   质量专家    │  │   数据分析师  │  │   文档工程师  │                    │
│  └───────────────┘  └───────────────┘  └───────────────┘                    │
│         │                  │                                                      │
│         └──────────────────┼──────────────────┐                                │
│                            ▼                  ▼                                │
│                    ┌───────────────┐  ┌───────────────┐                        │
│                    │ 🎯 Coordinator│  │ 🧠 Researcher │                        │
│                    │   协调员      │  │   研究员      │                        │
│                    └───────────────┘  └───────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 角色详细定义

#### 🏛️ Architect（架构师）

**核心职责：**
- 系统架构设计和技术选型
- 重大技术决策和架构变更评审
- 设计模式选择和最佳实践应用
- 技术债务管理和重构规划

**专业技能：**
- 系统架构设计（分层架构、微服务、事件驱动）
- 技术栈评估和选型（TypeScript、Bun、MCP SDK）
- 性能优化和扩展性设计
- 架构决策记录（ADR）编写

**工作模式：** 独立工作 + 关键节点评审

**协作关系：**
- 上游：用户需求、Council 分析结果
- 下游：Engineer（提供架构指导）、Pentester（安全设计评审）
- 协作：QATester（质量标准对齐）、Analyst（数据架构设计）

**激活条件：**
- 新功能模块设计（如 Web UI、WebSocket）
- 架构变更或重构（如文件系统存储迁移）
- 技术选型决策（如选择 HTTP 框架）
- 性能瓶颈优化（如缓存策略设计）

**典型任务：**
```
示例 1：设计 REST API 架构
- 分析 Phase 2 架构文档
- 设计 RESTful API 路由结构
- 选择 Hono 框架（轻量级、TypeScript 原生）
- 定义 API 规范（请求/响应格式、状态码、错误处理）
- 输出：ADR-002: 采用 Hono 框架

示例 2：优化 GatewayGuard 性能
- 分析当前性能瓶颈（检查时间 >100ms）
- 设计缓存策略（L1 内存缓存 + L2 文件缓存）
- 提出并行检查方案（批量检查，每批 10 个）
- 评估优化效果（目标 <50ms）
- 输出：性能优化方案 + 性能测试计划
```

---

#### ⚙️ Engineer（工程师）

**核心职责：**
- 功能开发和代码实现
- 单元测试和集成测试编写
- Bug 修复和技术债务偿还
- 代码重构和优化

**专业技能：**
- TypeScript 开发（严格模式、类型注解、泛型）
- Bun 运行时和工具链
- 测试驱动开发（TDD：RED-GREEN-REFACTOR）
- 并发编程和异步模式

**工作模式：** 独立工作 + 持续集成

**协作关系：**
- 上游：Architect（架构设计）、QATester（质量要求）
- 下游：QATester（提交 Code Review）、Pentester（安全检查）
- 协作：Analyst（数据分析需求对接）、Writer（文档编写）

**激活条件：**
- 有明确的开发任务（如实现 API 路由）
- Bug 修复需求（如 FileLock 死锁问题）
- 技术债务偿还（如重构 DataExtractor）

**典型任务：**
```
示例 1：实现 AnalyticsService
- 阅读 Analytics 模块 README（功能需求）
- 阅读架构文档（设计约束）
- 实现 UsageAggregator、QualityAggregator 等类
- 编写 82 个单元测试（TDD 流程）
- 输出：AnalyticsService 完整实现 + 测试套件

示例 2：修复 FileLock 死锁
- 阅读 FileLock 测试失败报告
- 分析死锁原因（acquire 后未 release）
- 修复代码缺陷（添加 try-finally 确保释放）
- 添加回归测试（防止复发）
- 输出：修复后的 FileLock + 新增测试用例
```

**推荐模型：** Claude Sonnet 4.5（平衡速度和质量）

---

#### 🔐 Pentester（安全专家）

**核心职责：**
- 安全漏洞识别和修复验证
- 安全编码规范制定和检查
- 威胁建模和安全测试
- 安全最佳实践推广

**专业技能：**
- Web 安全（OWASP Top 10、注入攻击、XSS、CSRF）
- API 安全（认证授权、输入验证、敏感数据保护）
- 文件系统安全（权限控制、路径遍历、注入攻击）
- 安全测试工具（静态分析、动态扫描、渗透测试）

**工作模式：** 按需评审 + 持续监控

**协作关系：**
- 上游：Architect（安全设计评审）
- 下游：Engineer（安全漏洞修复指导）、QATester（安全测试用例）
- 协作：Coordinator（安全风险评估）

**激活条件：**
- 新功能开发前（威胁建模、安全设计评审）
- 代码提交后（安全 Code Review）
- 发现安全漏洞（根因分析、修复验证）
- 定期安全审计（每周一次）

**典型任务：**
```
示例 1：REST API 安全加固（P0 优先级）
- 分析当前 API 路由（GET /api/v1/gateway/check）
- 识别安全风险：
  * 无认证授权机制（任何请求可访问）
  * 无输入验证（intent 参数可能注入恶意代码）
  * 无速率限制（易受 DDoS 攻击）
- 设计安全方案：
  * 添加 API Key 认证（中间件）
  * 实现输入验证器（JSON Schema）
  * 添加速率限制器（令牌桶算法）
- 输出：API 安全加固方案 + 安全测试用例

示例 2：文件系统安全审计
- 审计文件读写操作（FileLock、MemoryStore）
- 识别安全风险：
  * 路径遍历漏洞（未验证文件路径）
  * 权限问题（~/.reflectguard 权限过宽）
  * 敏感数据泄露（violation.jsonl 包含敏感信息）
- 提出修复建议：
  * 添加路径验证函数（阻止 ../ 等路径遍历）
  * 设置严格文件权限（600）
  * 敏感数据脱敏处理
- 输出：安全审计报告 + 修复优先级（P0/P1/P2）
```

**推荐模型：** Claude Opus 4.5（复杂安全分析）

**特殊能力：**
- STRIDE 威胁建模
- OWASP 安全检查清单
- 自动化安全扫描脚本生成

---

#### ✅ QATester（质量专家）

**核心职责：**
- Code Review 和质量门禁检查
- 测试策略制定和测试用例设计
- 性能基准测试和回归测试
- 质量指标监控和持续改进

**专业技能：**
- 代码审查（Clean Code、SOLID 原则、设计模式）
- 测试策略（单元测试、集成测试、E2E 测试）
- 性能测试（基准测试、负载测试、压力测试）
- 质量指标（覆盖率、复杂度、技术债务）

**工作模式：** 持续评审 + 里程碑验证

**协作关系：**
- 上游：Architect（质量标准对齐）
- 下游：Engineer（Code Review 反馈）
- 协作：Pentester（安全测试）、Analyst（质量数据分析）

**激活条件：**
- 每个 Pull Request 提交后（Code Review）
- 功能开发完成后（测试验证）
- 性能优化后（基准测试）
- 里程碑节点（质量评估）

**典型任务：**
```
示例 1：AnalyticsService Code Review
- 审查代码变更（4 个聚合器 + 2 个分析器）
- 检查代码质量：
  ✅ 遵循 TypeScript 严格模式
  ✅ 所有公开方法有 TSDoc 注释
  ✅ 测试覆盖率 >90%（82 个测试）
  ✅ 性能符合要求（响应时间 <100ms）
- 发现问题：
  ⚠️ MathUtils.average 未处理空数组
  ⚠️ TrendAnalyzer 线性回归未做异常值处理
- 提出改进建议：
  * 添加空数组校验（抛出 DomainError）
  * 使用 RANSAC 算法处理异常值
- 输出：Code Review 报告 + 改进建议（P2 优先级）

示例 2：性能基准测试
- 设计性能测试方案：
  * 测试工具：Bun Test + benchmark 模块
  * 测试场景：1/10/100/1000 次检查
  * 测试指标：平均/P50/P95/P99 响应时间
- 执行性能测试：
  * Gateway Check: 平均 45ms (目标 <50ms) ✅
  * Data Extract: 平均 28ms (目标 <30ms) ✅
  * Retro Create: 平均 420μs (目标 <500μs) ✅
- 输出：性能测试报告 + 性能优化建议
```

**推荐模型：** Claude Sonnet 4.5（快速 Code Review）

**特殊能力：**
- 自动化 Code Review 脚本
- 测试覆盖率分析
- 技术债务量化评估

---

#### 📊 Analyst（数据分析师）

**核心职责：**
- 系统使用数据收集和分析
- 质量指标监控和趋势分析
- 异常检测和告警
- 数据驱动决策支持

**专业技能：**
- 数据分析（Pandas、统计分析、趋势预测）
- 数据可视化（Chart.js、Grafana）
- 异常检测（Z-score、孤立森林、LSTM）
- SQL 查询（虽然 PRISM 用文件系统）

**工作模式：** 定期分析 + 按需查询

**协作关系：**
- 上游：Engineer（数据采集需求）、QATester（质量指标）
- 下游：Architect（架构优化建议）、Coordinator（决策支持）
- 协作：Writer（数据分析报告）

**激活条件：**
- 每日/每周数据聚合
- 发现异常数据（违规激增、性能下降）
- 需要数据支持决策（如是否优化某模块）
- 里程碑节点（生成数据分析报告）

**典型任务：**
```
示例 1：每周质量指标分析
- 收集本周数据：
  * 使用指标：420 次检查，35 次复盘
  * 质量指标：违规率 12%，误报率 3%
  * 性能指标：平均检查时间 48ms，P95 75ms
- 趋势分析：
  * 违规率：上周 10% → 本周 12% ↗（需要关注）
  * 性能：上周 52ms → 本周 48ms ↘（缓存生效）
  * 误报率：稳定在 3% ✅
- 异常检测：
  * 周三违规激增（28 次，Z-score = 3.2）
  * 根因分析：新增"复杂嵌套"模式匹配不准确
  * 修复建议：优化 PatternMatcher 模糊匹配算法
- 输出：每周质量报告 + 改进建议

示例 2：性能瓶颈分析
- 分析 Gateway Check 性能数据：
  * P50: 35ms, P95: 75ms, P99: 120ms
  * 慢检查占比：8%（>100ms）
- 瓶颈定位：
  * 原则匹配：65% 时间（正则匹配慢）
  * 模式匹配：25% 时间（模糊匹配慢）
  * 数据提取：10% 时间
- 优化建议：
  * 预编译正则表达式（预期提升 40%）
  * 索引常用模式（预期提升 20%）
- 输出：性能优化方案 + 预期效果评估
```

**推荐模型：** Claude Sonnet 4.5（数据分析）

**特殊能力：**
- 自动化数据聚合脚本
- 趋势预测模型
- 异常检测算法（Z-score、孤立森林）

---

#### 📝 Writer（文档工程师）

**核心职责：**
- 技术文档编写和维护
- API 文档生成和更新
- 用户指南和教程编写
- 文档质量评审和优化

**专业技能：**
- 技术写作（清晰、简洁、结构化）
- API 文档（OpenAPI、TSDoc、JSDoc）
- 文档工具（Markdown、TypeDoc、Docsify）
- 用户教育（教程、示例、最佳实践）

**工作模式：** 持续更新 + 里程碑整理

**协作关系：**
- 上游：所有角色（收集文档需求）
- 下游：用户（提供文档支持）
- 协作：QATester（文档完整性检查）

**激活条件：**
- 新功能开发完成后（API 文档）
- 代码变更后（更新相关文档）
- 里程碑节点（生成阶段报告）
- 发现文档缺陷（缺失、过时、不准确）

**典型任务：**
```
示例 1：Analytics 模块文档
- 阅读 AnalyticsService 代码（TSDoc 注释）
- 生成 API 文档：
  * 类和方法签名
  * 参数说明和返回值
  * 使用示例
- 编写模块 README：
  * 功能概述（4 大能力）
  * 快速开始（初始化、基本用法）
  * API 参考（所有公开方法）
  * 性能优化（缓存机制、并行查询）
- 输出：Analytics 模块 README（30KB）

示例 2：API 文档生成
- 提取 REST API 路由定义
- 生成 OpenAPI 规范：
  openapi: 3.0.0
  info:
    title: ReflectGuard API
    version: 2.0.0
  paths:
    /api/v1/gateway/check:
      post:
        summary: 执行 Gateway 检查
        requestBody:
          content:
            application/json:
              schema:
                type: object
                properties:
                  intent: { type: string }
        responses:
          200:
            description: 检查成功
- 生成 HTML 文档（使用 TypeDoc + 自定义主题）
- 输出：API 文档站点（可部署到 GitHub Pages）
```

**推荐模型：** Claude Haiku 3.5（快速文档生成）

**特殊能力：**
- TSDoc → OpenAPI 转换
- 自动生成使用示例
- 文档质量检查脚本

---

#### 🎯 Coordinator（协调员）

**核心职责：**
- 虚拟团队协作调度
- 任务分配和进度跟踪
- 冲突解决和决策协调
- 跨角色沟通和上下文同步

**专业技能：**
- 项目管理（敏捷开发、Scrum、看板）
- 任务调度（优先级管理、依赖管理）
- 沟通协调（异步沟通、冲突解决）
- 风险管理（风险识别、应对措施）

**工作模式：** 持续运行 + 按需调度

**协作关系：**
- 上游：用户（需求输入）
- 下游：所有角色（任务分配）
- 协作：所有角色（上下文同步）

**激活条件：**
- 用户提出新需求
- 跨角色协作需要
- 冲突或分歧需要解决
- 里程碑节点复盘

**典型任务：**
```
示例 1：API 安全加固任务协调（P0 优先级）
- 用户需求："加固 REST API 安全"
- 分析需求：
  * 优先级：P0（安全红线）
  * 复杂度：高（涉及认证、验证、限流）
  * 依赖：无
- 分配任务：
  1. Pentester（主责）：威胁建模、安全设计
  2. Architect（评审）：架构安全评审
  3. Engineer（实现）：安全中间件实现
  4. QATester（验证）：安全测试用例
- 制定时间表：
  * Day 1-2: Pentester 威胁建模 + 方案设计
  * Day 3-4: Architect 评审 + Engineer 实现
  * Day 5: QATester 测试验证
- 跟踪进度：
  * 每日检查：任务进度、阻塞问题
  * 风险评估：是否有延期风险
- 输出：任务完成报告 + 复盘总结

示例 2：冲突解决
- 冲突场景：Engineer 想快速实现，QATester 要求完整测试
- 分析冲突：
  * Engineer 视角：P0 任务，需要快速上线
  * QATester 视角：质量红线，测试覆盖率 >85%
- 寻找共识：
  * 方案：采用 MVP 策略
    - 核心功能：完整测试（>85% 覆盖）
    - 边缘场景：标记为 TODO，后续补充
  * 时间：先上线 MVP，1 周内补充测试
- 输出：冲突解决方案 + 任务调整
```

**推荐模型：** Claude Sonnet 4.5（协调和沟通）

**特殊能力：**
- TaskList 工具管理
- 依赖关系分析
- 风险评估脚本

---

#### 🧠 Researcher（研究员）

**核心职责：**
- 技术调研和最佳实践研究
- 外部资料收集和知识整理
- 新技术评估和可行性分析
- 知识库维护和更新

**专业技能：**
- 技术调研（文献检索、实验验证、对比分析）
- 知识管理（分类、索引、检索）
- 最佳实践提炼（模式总结、案例研究）
- 技术写作（研究报告、技术分享）

**工作模式：** 按需调研 + 定期整理

**协作关系：**
- 上游：所有角色（调研需求）
- 下游：Architect（技术选型支持）、Engineer（实现指导）
- 协作：Writer（知识库文档）

**激活条件：**
- 遇到技术难题（如文件锁性能优化）
- 技术选型决策（如选择 HTTP 框架）
- 最佳实践探索（如 TypeScript 并发模式）
- 定期知识库整理

**典型任务：**
```
示例 1：文件锁性能优化调研
- 调研目标：优化 FileLock acquire 性能（当前 >50ms）
- 技术调研：
  * 方案 1：flock 系统调用（性能最好，但不跨平台）
  * 方案 2：mkdir 原子操作（当前方案，性能中等）
  * 方案 3：shared lock（多读单写，性能提升 8.7 倍）
- 实验验证：
  * 实现 shared lock 方案
  * 性能测试：acquire 5.2ms（vs 原来 45ms）
  * 兼容性测试：macOS/Linux ✅, Windows ❌
- 可行性分析：
  * 性能提升：8.7 倍 ✅
  * 跨平台：需要降级方案 ⚠️
  * 复杂度：中等 ⚠️
- 输出：调研报告 + 技术选型建议

示例 2：TypeScript 并发模式调研
- 调研目标：总结 TypeScript 并发编程最佳实践
- 资料收集：
  * 官方文档（async/await、Promise）
  * 社区最佳实践（tsx、node-api）
  * 开源项目案例（Bun、Deno）
- 模式提炼：
  1. async/await 优先（回调地狱）
  2. Promise.all 并行（批量操作）
  3. 错误处理（try-catch + error-first callback）
  4. 资源清理（try-finally + AbortController）
- 输出：TypeScript 并发模式指南 + 代码示例
```

**推荐模型：** Claude Opus 4.5（复杂调研）、Haiku 3.5（快速查询）

**特殊能力：**
- Web 搜索和资料收集
- 实验设计和验证
- 最佳实践提炼

---

### 2.3 角色对比矩阵

| 角色 | 核心职责 | 工作模式 | 推荐模型 | 激活频率 | P0 任务 |
|------|---------|---------|----------|----------|---------|
| **Architect** | 架构设计、技术选型 | 独立 + 评审 | Opus 4.5 | 低（按需） | ✅ API 安全架构设计 |
| **Engineer** | 代码开发、测试 | 独立 + CI | Sonnet 4.5 | 高（每日） | ✅ API 安全加固实现 |
| **Pentester** | 安全审计、漏洞修复 | 按需评审 | Opus 4.5 | 中（每周） | ✅ API 安全加固（主责） |
| **QATester** | Code Review、质量门禁 | 持续评审 | Sonnet 4.5 | 高（每次 PR） | ✅ 质量保证体系 |
| **Analyst** | 数据分析、异常检测 | 定期分析 | Sonnet 4.5 | 中（每周） | - 质量指标监控 |
| **Writer** | 文档编写、维护 | 持续更新 | Haiku 3.5 | 中（每次变更） | - API 文档生成 |
| **Coordinator** | 协作调度、任务分配 | 持续运行 | Sonnet 4.5 | 高（每日） | - 任务协调 |
| **Researcher** | 技术调研、知识管理 | 按需调研 | Opus/Haiku | 低（按需） | - 安全最佳实践 |

---

## 3. 角色工作流程

### 3.1 角色激活流程

#### 3.1.1 自动激活触发条件

| 角色 | 触发条件 | 激活时机 | 优先级 |
|------|---------|---------|--------|
| **Coordinator** | 用户提出新需求 | 立即 | 最高 |
| **Pentester** | P0 安全任务 | 立即 | P0 |
| **Architect** | 架构变更需求 | 任务分配后 | P0/P1 |
| **Engineer** | 开发任务就绪 | 设计完成后 | P0/P1/P2 |
| **QATester** | PR 提交 | 每个 PR | 高 |
| **Analyst** | 定期分析 | 每周/每日 | 中 |
| **Writer** | 代码变更完成 | 合并后 | 中 |
| **Researcher** | 技术难题 | 按需 | 低 |

#### 3.1.2 激活流程图

```
用户提出需求
    ↓
🎯 Coordinator 分析需求
    ├─ 简单任务 → 直接分配给 Engineer
    ├─ 架构变更 → 启动 Architect
    ├─ 安全问题 → 启动 Pentester
    ├─ 质量问题 → 启动 QATester
    └─ 复杂任务 → Council 模式（多角色讨论）
    ↓
相关角色激活
    ├─ 阅读 CLAUDE.md（项目上下文）
    ├─ 阅读相关文档（模块文档、API 文档）
    └─ 理解任务需求
    ↓
角色执行任务
    ├─ 输出成果（代码/文档/方案）
    ├─ 更新 TaskList（进度跟踪）
    └─ 通知 Coordinator（完成状态）
    ↓
质量验证
    ├─ QATester Code Review
    ├─ Pentester 安全检查
    └─ Analyst 性能分析
    ↓
任务完成
    ├─ 更新文档（Writer）
    ├─ 合并代码（Engineer）
    └─ 复盘总结（Coordinator）
```

### 3.2 任务传递机制

#### 3.2.1 任务分配模式

**模式 1：链式传递（简单任务）**
```
用户 → Coordinator → Engineer → QATester → 完成
```

**模式 2：并行协作（中等任务）**
```
          ┌─ Architect ─┐
用户 → Coordinator ─┼─ Engineer ───┼─ QATester → 完成
          └─ Pentester ┘┘
```

**模式 3：Council 模式（复杂任务）**
```
                          ┌─ Researcher ─┐
                          │              ↓
用户 → Coordinator → Council ← Architect ─┤
                          │              ↓
                          └─ Pentester ──┘
                              ↓
                          Engineer
                              ↓
                          QATester
                              ↓
                          完成
```

#### 3.2.2 任务传递协议

**任务定义格式：**
```typescript
interface TaskDefinition {
  taskId: string;              // 任务 ID（自动生成）
  title: string;               // 任务标题
  description: string;         // 详细描述
  assignee: Role;              // 负责角色
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dependencies?: string[];     // 依赖的任务 ID
  context: {
    documents: string[];       // 需要阅读的文档
    codeFiles?: string[];      // 涉及的代码文件
    relatedTasks?: string[];   // 相关任务
  };
  acceptanceCriteria: string[]; // 验收标准
  deadline?: string;           // 截止时间
}
```

**示例任务定义：**
```json
{
  "taskId": "TASK-2026-0501",
  "title": "REST API 安全加固",
  "description": "为 ReflectGuard REST API 添加认证、验证和限流机制",
  "assignee": "Pentester",
  "priority": "P0",
  "dependencies": [],
  "context": {
    "documents": [
      "CLAUDE.md",
      "reports/PHASE2_ARCHITECTURE.md",
      "api/CLAUDE.md"
    ],
    "codeFiles": [
      "src/api/server.ts",
      "src/api/middleware/"
    ]
  },
  "acceptanceCriteria": [
    "实现 API Key 认证中间件",
    "实现输入验证器（JSON Schema）",
    "实现速率限制器（令牌桶）",
    "安全测试通过（OWASP Top 10）",
    "性能测试通过（<100ms 响应）"
  ],
  "deadline": "2026-02-07"
}
```

#### 3.2.3 任务状态流转

```
┌────────┐   激活    ┌──────────┐   开始执行   ┌──────────┐
│ Pending │ ──────→ │ InProgress│ ──────────→ │ Reviewing│
└────────┘          └──────────┘             └──────────┘
     ▲                                            │
     │                                            ↓
     │                                         ┌─────────┐
     │              验收不通过                  │ Blocked │
     │              ─────────────               └─────────┘
     │                    │                         │
     └────────────────────┴─────────────────────────┘
                     重新执行

┌──────────┐   验收通过   ┌─────────┐
│ Reviewing│ ──────────→ │Completed│
└──────────┘             └─────────┘
```

### 3.3 决策机制

#### 3.3.1 决策分级

| 决策级别 | 描述 | 参与角色 | 决策方式 |
|---------|------|---------|---------|
| **L1（小型）** | 不影响架构的实现细节 | Engineer 单独决策 | 记录到 Git commit |
| **L2（中型）** | 影响多个模块的技术决策 | Architect + Engineer | ADR 记录 |
| **L3（大型）** | 改变项目方向的重大决策 | Council 模式 | 决策文档 + ADR |

#### 3.3.2 Council 模式流程

**触发条件：**
- 架构重大变更
- 技术选型决策
- P0/P1 安全风险应对
- 里程碑方向调整

**参与角色（根据议题选择）：**
- 核心角色：Architect、Engineer、Pentester
- 咨询角色：QATester、Analyst、Researcher
- 协调角色：Coordinator

**流程：**
```
1. Coordinator 发起 Council 讨论
    ↓
2. 各角色准备观点（基于文档和数据）
    ├─ Architect：架构视角
    ├─ Pentester：安全视角
    ├─ Engineer：实现视角
    ├─ QATester：质量视角
    └─ Analyst：数据视角
    ↓
3. 观点陈述和辩论
    ├─ 每个角色陈述观点
    ├─ 其他角色质疑和补充
    └─ Researcher 提供外部资料
    ↓
4. 多方案对比分析
    ├─ 方案 A：优势/劣势/成本/风险
    ├─ 方案 B：优势/劣势/成本/风险
    └─ 方案 C：优势/劣势/成本/风险
    ↓
5. Algorithm 组评估可行性
    ├─ 技术可行性
    ├─ 时间成本评估
    └─ 资源需求评估
    ↓
6. 用户最终决策
    ├─ 审核各方案分析
    ├─ 选择方案
    └─ 批准执行
    ↓
7. 记录决策
    ├─ 生成决策文档（DECISION.md）
    ├─ 创建 ADR（Architecture Decision Record）
    └─ 更新相关文档
    ↓
8. 执行决策
    ├─ Coordinator 分配任务
    └─ 相关角色执行
```

**示例 Council 讨论：**
```
议题：是否采用 WebSocket 实现实时通信？

参与角色：Architect、Engineer、Pentester、QATester

Architect 观点：
  ✅ 优势：原生支持、轻量级、实时性好
  ⚠️ 劣势：增加复杂度、需要心跳机制、错误处理复杂
  📊 成本：2 周开发时间

Pentester 观点：
  ⚠️ 安全风险：WebSocket 连接易受劫持攻击
  ✅ 缓解措施：使用 WSS（TLS 加密）、Origin 验证、速率限制
  📊 成本：增加 3 天安全加固工作

Engineer 观点：
  ✅ 实现可行：使用 ws 库或 Hono WS
  ⚠️ 复杂度：需要管理连接池、重连机制、消息队列
  📊 成本：1.5 周开发 + 3 天测试

QATester 观点：
  ⚠️ 测试挑战：WebSocket 测试需要专用工具（如 Autobahn）
  ✅ 质量保障：编写集成测试、模拟并发连接
  📊 成本：1 周测试工作

Algorithm 组评估：
  ✅ 技术可行性：高（成熟技术栈）
  ⚠️ 时间成本：3-4 周（超出原计划）
  ⚠️ 资源需求：需要额外测试环境

对比方案：
  方案 A（WebSocket）：实时性最好，但复杂度高
  方案 B（轮询）：简单可靠，但实时性差
  方案 C（SSE）：折中方案，单向推送，易实现

用户决策：
  选择方案 C（SSE）
  理由：
    1. 满足需求（单向推送告警通知）
    2. 复杂度可控（1 周实现）
    3. 向后兼容（基于 HTTP）

决策输出：
  - ADR-003: 采用 SSE 实现实时通知
  - 更新架构文档（Phase 2.3：Scheduler + Notifier）
  - 分配任务给 Engineer
```

### 3.4 冲突解决机制

#### 3.4.1 常见冲突类型

| 冲突类型 | 示例 | 解决机制 |
|---------|------|---------|
| **优先级冲突** | Engineer 想快速实现，QATester 要求完整测试 | MVP 策略（核心功能完整测试，边缘场景 TODO） |
| **技术分歧** | Architect 和 Engineer 对实现方案有分歧 | Council 讨论 + 实验验证 |
| **资源竞争** | 多个任务需要同一角色 | 优先级排序（P0 > P1 > P2 > P3） |
| **质量标准** | QATester 和 Pentester 对质量要求不一致 | 制定统一质量标准文档 |

#### 3.4.2 冲突解决流程

```
1. 识别冲突
    ↓
2. Coordinator 调停
    ├─ 分析冲突原因
    ├─ 听取各方观点
    └─ 寻找共同目标
    ↓
3. 提出解决方案
    ├─ 方案 A：折中方案（推荐）
    ├─ 方案 B：优先级排序
    └─ 方案 C：Council 讨论（复杂冲突）
    ↓
4. 达成共识
    ├─ 各角色同意方案
    └─ 更新任务计划
    ↓
5. 执行和跟踪
    ├─ 执行解决方案
    └─ Coordinator 跟踪效果
```

**示例冲突解决：**
```
冲突：Engineer 想快速实现 API 认证，QATester 要求完整测试

Coordinator 调停：
  - 分析：工程师想在 1 天内完成，测试要求至少 2 天测试
  - 共同目标：P0 任务，需要快速上线，但质量不能妥协

解决方案（MVP 策略）：
  1. 核心功能（API Key 认证）：完整测试（85% 覆盖）
  2. 边缘场景（错误处理、重试）：标记为 TODO
  3. 时间：先上线 MVP，1 周内补充测试

各方接受：
  - Engineer：1 天实现核心功能 ✅
  - QATester：核心功能有完整测试 ✅
  - Pentester：安全性有保障 ✅

输出：
  - 调整任务计划
  - 创建 TODO 任务（补充边缘测试）
  - 更新 TaskList
```

---

## 4. 角色工具和能力

### 4.1 工具清单

#### 4.1.1 通用工具（所有角色）

| 工具 | 用途 | 使用频率 | 备注 |
|------|------|---------|------|
| **CLAUDE.md** | 项目上下文 | 每次激活必读 | 根文档 |
| **Glob** | 查找文件 | 高频 | 文件搜索 |
| **Grep** | 搜索内容 | 高频 | 代码搜索 |
| **Read** | 读取文件 | 高频 | 文件阅读 |
| **Write** | 写入文件 | 中频 | 文档生成 |
| **Edit** | 编辑文件 | 中频 | 代码修改 |
| **Bash** | 执行命令 | 中频 | 测试、构建 |
| **TaskList** | 任务管理 | 中频 | 进度跟踪 |
| **TaskUpdate** | 更新任务 | 中频 | 状态更新 |

#### 4.1.2 角色专属工具

**Architect 工具：**
- **C4 Model 工具**：架构图绘制（Mermaid）
- **ADR 模板**：架构决策记录
- **技术栈评估脚本**：对比分析

**Engineer 工具：**
- **Bun**：运行和测试
- **TypeScript 编译器**：类型检查
- **Git**：版本控制
- **代码生成模板**：快速生成代码框架

**Pentester 工具：**
- **OWASP 检查清单**：安全检查项
- **STRIDE 模型**：威胁建模
- **安全扫描脚本**：自动化安全检查

**QATester 工具：**
- **Bun Test**：单元测试
- **Code Review 脚本**：自动化审查
- **覆盖率工具**：测试覆盖率分析
- **性能基准测试**：性能测试

**Analyst 工具：**
- **数据聚合脚本**：自动收集指标
- **Chart.js**：数据可视化
- **异常检测算法**：Z-score、孤立森林
- **趋势分析模型**：线性回归、移动平均

**Writer 工具：**
- **TypeDoc**：API 文档生成
- **Markdown 模板**：文档模板
- **文档质量检查**：完整性、准确性

**Coordinator 工具：**
- **TaskList**：任务管理
- **依赖关系分析**：任务依赖
- **风险评估脚本**：风险识别

**Researcher 工具：**
- **Web 搜索**：资料收集
- **实验框架**：技术验证
- **知识库索引**：资料管理

### 4.2 模型选择策略

#### 4.2.1 模型对比

| 模型 | 速度 | 质量 | 成本 | 适用场景 |
|------|------|------|------|---------|
| **Claude Haiku 3.5** | ⚡⚡⚡ 最快 | ⭐⭐ 中等 | 💰 最低 | 文档生成、快速查询 |
| **Claude Sonnet 4.5** | ⚡⚡ 快 | ⭐⭐⭐ 高 | 💰💰 中等 | 代码开发、常规任务 |
| **Claude Opus 4.5** | ⚡ 慢 | ⭐⭐⭐⭐⭐ 最高 | 💰💰💰 最高 | 复杂分析、架构设计 |

#### 4.2.2 角色模型映射

| 角色 | 首选模型 | 备选模型 | 使用场景 |
|------|---------|---------|---------|
| **Architect** | Opus 4.5 | Sonnet 4.5 | 架构设计用 Opus，日常评审用 Sonnet |
| **Engineer** | Sonnet 4.5 | Haiku 3.5 | 开发用 Sonnet，简单修改用 Haiku |
| **Pentester** | Opus 4.5 | Sonnet 4.5 | 漏洞分析用 Opus，日常检查用 Sonnet |
| **QATester** | Sonnet 4.5 | Haiku 3.5 | Code Review 用 Sonnet，文档检查用 Haiku |
| **Analyst** | Sonnet 4.5 | - | 数据分析（中等复杂度） |
| **Writer** | Haiku 3.5 | Sonnet 4.5 | 文档生成用 Haiku，技术文档用 Sonnet |
| **Coordinator** | Sonnet 4.5 | - | 协调沟通（需要平衡速度和质量） |
| **Researcher** | Opus 4.5 / Haiku 3.5 | Sonnet 4.5 | 复杂调研用 Opus，快速查询用 Haiku |

#### 4.2.3 模型切换策略

**自动切换条件：**
- **任务复杂度**：简单 → Haiku，复杂 → Opus
- **时间压力**：紧急 → Sonnet（平衡速度和质量）
- **成本预算**：预算充足 → Opus，预算紧张 → Sonnet

**示例：**
```
场景 1：快速文档更新（简单任务）
  - 使用模型：Haiku 3.5
  - 理由：快速、成本低

场景 2：安全漏洞分析（复杂任务）
  - 使用模型：Opus 4.5
  - 理由：需要深度分析，质量优先

场景 3：功能开发（中等任务）
  - 使用模型：Sonnet 4.5
  - 理由：平衡速度和质量

场景 4：紧急 Bug 修复（P0，时间紧迫）
  - 使用模型：Sonnet 4.5
  - 理由：快速响应，质量有保障
```

### 4.3 特殊能力定义

#### 4.3.1 Pentester 特殊能力

**STRIDE 威胁建模：**
```typescript
interface STRIDEAnalysis {
  Spoofing: string[];    // 伪装攻击（如 API Key 劫持）
  Tampering: string[];   // 篡改攻击（如数据注入）
  Repudiation: string[]; // 抵赖攻击（如无审计日志）
  InformationDisclosure: string[]; // 信息泄露（如敏感数据暴露）
  Denial of Service: string[];     // 拒绝服务（如 DDoS）
  Elevation of Privilege: string[]; // 提权攻击（如越权访问）
}

// 示例输出
{
  "Spoofing": ["API Key 劫持", "会话劫持"],
  "Tampering": ["JSON 注入", "参数篡改"],
  "Repudiation": ["无审计日志"],
  "InformationDisclosure": ["敏感数据未脱敏", "错误信息泄露"],
  "Denial of Service": ["无速率限制", "资源耗尽"],
  "Elevation of Privilege": ["越权访问", "权限提升"]
}
```

**OWASP Top 10 检查清单：**
- [ ] A01:2021 – 访问控制失效
- [ ] A02:2021 – 加密失败
- [ ] A03:2021 – 注入
- [ ] A04:2021 – 不安全设计
- [ ] A05:2021 – 错误的安全配置
- [ ] A06:2021 – 易受攻击和过时的组件
- [ ] A07:2021 – 身份识别和身份验证失败
- [ ] A08:2021 – 软件和数据完整性故障
- [ ] A09:2021 – 安全日志和监控故障
- [ ] A10:2021 – 服务器端请求伪造 (SSRF)

#### 4.3.2 QATester 特殊能力

**自动化 Code Review 脚本：**
```typescript
interface CodeReviewResult {
  file: string;
  issues: {
    severity: 'error' | 'warning' | 'info';
    category: 'security' | 'performance' | 'maintainability' | 'testing';
    message: string;
    line?: number;
    suggestion?: string;
  }[];
  metrics: {
    coverage: number;
    complexity: number;
    linesOfCode: number;
  };
}

// 示例输出
{
  "file": "src/api/middleware/auth.ts",
  "issues": [
    {
      "severity": "error",
      "category": "security",
      "message": "API Key 未验证强度",
      "line": 15,
      "suggestion": "添加最小长度和复杂度检查"
    },
    {
      "severity": "warning",
      "category": "performance",
      "message": "每次请求都读取配置文件",
      "line": 20,
      "suggestion": "缓存配置，避免频繁 I/O"
    }
  ],
  "metrics": {
    "coverage": 0.85,
    "complexity": 8,
    "linesOfCode": 120
  }
}
```

**技术债务量化评估：**
```typescript
interface TechnicalDebt {
  category: string;
  debt: number; // 小时数
  interest: number; // 每周额外成本（小时）
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  description: string;
}

// 示例输出
[
  {
    "category": "测试覆盖不足",
    "debt": 16,
    "interest": 2,
    "priority": "P1",
    "description": "AnalyticsService 边缘场景缺少测试"
  },
  {
    "category": "性能优化",
    "debt": 8,
    "interest": 1,
    "priority": "P2",
    "description": "Gateway Check 正则匹配慢"
  }
]
```

#### 4.3.3 Analyst 特殊能力

**异常检测算法（Z-score）：**
```typescript
interface AnomalyDetectionResult {
  timestamp: string;
  metric: string;
  value: number;
  zscore: number;
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

// 示例输出
{
  "timestamp": "2026-02-05T14:30:00Z",
  "metric": "violations",
  "value": 28,
  "zscore": 3.2,
  "isAnomaly": true,
  "severity": "high",
  "description": "违规次数异常增加（日均 8 次）",
  "suggestion": "检查新增模式匹配是否过于严格"
}
```

**趋势预测（线性回归）：**
```typescript
interface TrendPrediction {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  slope: number;
  r_squared: number; // 拟合度
  prediction: {
    next_week: number;
    next_month: number;
  };
  confidence: 'low' | 'medium' | 'high';
}

// 示例输出
{
  "metric": "violation_rate",
  "direction": "up",
  "slope": 0.02,
  "r_squared": 0.85,
  "prediction": {
    "next_week": 0.14,
    "next_month": 0.18
  },
  "confidence": "medium",
  "suggestion": "违规率持续上升，建议优化原则定义"
}
```

---

## 5. 虚拟团队协作机制

### 5.1 共享上下文管理

#### 5.1.1 上下文层次

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ReflectGuard 共享上下文体系                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  L1: 项目级上下文（所有角色必读）                                            │
│  ├─ CLAUDE.md（根文档）                                                     │
│  ├─ reports/PHASE2_ARCHITECTURE.md（架构设计）                              │
│  └─ reports/WEEK4-5_RISK_MONITORING_FRAMEWORK.md（风险框架）               │
│                                                                             │
│  L2: 模块级上下文（按需阅读）                                               │
│  ├─ api/CLAUDE.md（API 模块）                                              │
│  ├─ reflectguard/src/core/analytics/README.md（Analytics 模块）          │
│  └─ docs/mcp-server.md（MCP Server 文档）                                  │
│                                                                             │
│  L3: 任务级上下文（任务相关）                                               │
│  ├─ TaskList（当前任务列表）                                                │
│  ├─ DECISIONS.md（决策记录）                                                │
│  └─ ADR/（架构决策记录）                                                    │
│                                                                             │
│  L4: 知识库（历史经验）                                                     │
│  ├─ ~/.claude/MEMORY/LEARNING/Gateway/（知识库）                            │
│  └─ reports/PHASE1_MVP_DEEP_RETROSPECTIVE_REPORT.md（复盘报告）           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 5.1.2 上下文加载协议

**角色激活时必读：**
```typescript
interface RoleActivationContext {
  role: string;
  requiredDocuments: string[];
  optionalDocuments: string[];
  taskContext?: {
    taskId: string;
    relatedFiles: string[];
    relatedTasks: string[];
  };
}

// 示例：Engineer 激活
{
  "role": "Engineer",
  "requiredDocuments": [
    "CLAUDE.md",
    "reports/PHASE2_ARCHITECTURE.md"
  ],
  "optionalDocuments": [
    "reflectguard/README.md",
    "docs/CODING_STANDARDS.md"
  ],
  "taskContext": {
    "taskId": "TASK-2026-0501",
    "relatedFiles": [
      "src/api/server.ts",
      "src/api/middleware/"
    ],
    "relatedTasks": []
  }
}
```

**上下文更新机制：**
- **实时更新**：代码变更后立即更新上下文
- **定期同步**：每日同步项目进度和决策
- **事件驱动**：里程碑完成后更新共享上下文

### 5.2 任务分配系统

#### 5.2.1 TaskList 工具使用

**TaskList 数据结构：**
```typescript
interface Task {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignee: string; // 角色名
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dependencies: string[]; // 依赖的任务 ID
  blockedBy: string[]; // 被阻塞的任务 ID
  blocks: string[]; // 阻塞的任务 ID
  metadata: {
    documents: string[];
    codeFiles?: string[];
    estimatedHours?: number;
    deadline?: string;
  };
  activeForm: string; // 进行中的描述
}
```

**任务分配流程：**
```
1. Coordinator 创建任务
    ↓
2. 设置任务属性
    ├─ 优先级（P0/P1/P2/P3）
    ├─ 负责角色（Architect/Engineer/...）
    └─ 依赖关系（dependencies）
    ↓
3. TaskList 工具记录任务
    ↓
4. 相关角色接收任务通知
    ↓
5. 角色开始执行（更新状态为 in_progress）
    ↓
6. 任务完成（更新状态为 completed）
    ↓
7. Coordinator 验收并关闭任务
```

**示例任务列表：**
```typescript
[
  {
    "id": "1",
    "subject": "REST API 安全加固设计",
    "description": "威胁建模和安全方案设计",
    "status": "in_progress",
    "assignee": "Pentester",
    "priority": "P0",
    "dependencies": [],
    "blockedBy": [],
    "blocks": ["2", "3"],
    "metadata": {
      "documents": ["CLAUDE.md", "reports/PHASE2_ARCHITECTURE.md"],
      "estimatedHours": 8,
      "deadline": "2026-02-07"
    },
    "activeForm": "设计 REST API 安全方案"
  },
  {
    "id": "2",
    "subject": "API 认证中间件实现",
    "description": "实现 API Key 认证",
    "status": "pending",
    "assignee": "Engineer",
    "priority": "P0",
    "dependencies": ["1"],
    "blockedBy": ["1"],
    "blocks": [],
    "metadata": {
      "codeFiles": ["src/api/middleware/auth.ts"],
      "estimatedHours": 6
    },
    "activeForm": "实现 API Key 认证"
  },
  {
    "id": "3",
    "subject": "安全测试验证",
    "description": "OWASP Top 10 检查",
    "status": "pending",
    "assignee": "QATester",
    "priority": "P0",
    "dependencies": ["2"],
    "blockedBy": ["2"],
    "blocks": [],
    "metadata": {
      "estimatedHours": 4
    },
    "activeForm": "执行安全测试"
  }
]
```

#### 5.2.2 优先级排序规则

**P0（严重）：**
- 系统不可用、数据泄露、高危安全漏洞
- 立即处理，停止其他任务

**P1（紧急）：**
- 核心功能异常、中危安全漏洞
- 优先处理，暂停其他任务

**P2（重要）：**
- 功能增强、性能优化
- 正常排期处理

**P3（一般）：**
- 文档完善、代码清理
- 有时间再做

**优先级冲突处理：**
```
规则 1：P0 > P1 > P2 > P3
规则 2：安全任务 > 功能任务 > 文档任务
规则 3：阻塞任务 > 独立任务
规则 4：依赖任务完成后再执行后续任务
```

### 5.3 冲突解决流程

#### 5.3.1 冲突识别

**自动识别（Coordinator）：**
- TaskList 依赖冲突（循环依赖）
- 资源竞争（多个任务需要同一角色）
- 优先级冲突（P0 任务太多）

**手动报告（角色主动）：**
- 技术分歧（Architect vs Engineer）
- 质量标准不一致（QATester vs Pentester）

#### 5.3.2 冲突解决策略

**策略 1：优先级排序**
```
冲突：3 个 P0 任务，但只有 1 个 Pentester
解决：
  1. 评估 P0 任务紧急程度
  2. 排序：API 安全（P0-严重） > 数据安全（P0-紧急） > 代码审计（P0-重要）
  3. 串行执行：先 API 安全，再数据安全，最后代码审计
```

**策略 2：角色分工**
```
冲突：Engineer 既要开发又要修 Bug
解决：
  1. 分离任务：开发任务用 Engineer，Bug 修复用 Engineer（备份）
  2. 并行执行：两个任务并行，不冲突
```

**策略 3：Council 讨论**
```
冲突：Architect 和 Engineer 对实现方案有分歧
解决：
  1. Coordinator 发起 Council 讨论
  2. 各自陈述观点和证据
  3. Researcher 提供外部资料
  4. 实验验证（如果可行）
  5. 用户最终决策
```

### 5.4 协作最佳实践

#### 5.4.1 沟通规范

**异步沟通优先：**
- 优先使用文档、评论、Issue
- 避免"实时"会议（除非紧急）

**清晰的消息格式：**
```markdown
## 任务更新：API 安全加固设计

**角色：** Pentester
**任务 ID：** TASK-2026-0501
**状态：** 进行中

### 进度
- ✅ 完成威胁建模（STRIDE）
- ⏳ 进行中：安全方案设计
- ⏸️ 待办：编写测试用例

### 阻塞问题
无

### 预计完成时间
2026-02-07 18:00

### 下一步
输出 API 安全加固方案文档
```

#### 5.4.2 文档协作

**文档更新流程：**
```
角色变更代码 → Writer 更新文档 → QATester 验证文档完整性
```

**文档版本控制：**
- 所有文档纳入 Git 版本控制
- 重大变更记录到 Changelog
- 废弃文档移到 ARCHIVE/ 目录

#### 5.4.3 知识共享

**每周知识分享（可选）：**
```
格式：15 分钟分享
主题：本周学到的技术/经验/教训
示例：
  - Architect：分享 SSE vs WebSocket 架构选择
  - Pentester：分享 OWASP Top 10 新变化
  - QATester：分享测试覆盖率优化技巧
```

---

## 6. 实施路线图

### 6.1 Week 4-5 剩余时间分配

**当前状态（2026-02-05）：**
- ✅ Analytics 模块完成（82 测试，>90% 覆盖率）
- 🔴 P0 任务：API 安全加固
- 🔴 P0 任务：质量保证体系

**剩余时间（Week 4-5，共 7 天）：**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Week 4-5 实施计划（2026-02-05 ~ 02-11）                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Day 1 (2/5, 周三)                                                          │
│  ├─ 上午：虚拟团队角色定义完成 ✅                                            │
│  ├─ 下午：激活 Pentester + Architect（API 安全威胁建模 + 架构设计）         │
│  └─ 晚上：输出 API 安全加固方案                                              │
│                                                                             │
│  Day 2 (2/6, 周四)                                                          │
│  ├─ 上午：Architect 评审安全方案                                             │
│  ├─ 下午：激活 Engineer（实现安全中间件）                                    │
│  └─ 晚上：QATester Code Review                                              │
│                                                                             │
│  Day 3 (2/7, 周五)                                                          │
│  ├─ 上午：Pentester 安全测试验证                                            │
│  ├─ 下午：修复发现的问题                                                    │
│  └─ 晚上：集成测试 + 性能测试                                               │
│                                                                             │
│  Day 4-5 (2/8-2/9, 周六-周日)                                               │
│  ├─ Day 4：质量保证体系建立                                                 │
│  │   ├─ QATester：定义质量标准文档                                          │
│  │   ├─ QATester：自动化 Code Review 脚本                                   │
│  │   └─ QATester：性能基准测试脚本                                          │
│  └─ Day 5：文档完善                                                         │
│      ├─ Writer：API 文档生成                                                │
│      ├─ Writer：安全最佳实践文档                                            │
│      └─ Coordinator：Week 4-5 复盘报告                                      │
│                                                                             │
│  Day 6-7 (2/10-2/11, 周一-周二)                                             │
│  ├─ Day 6：缓冲时间（处理意外问题）                                         │
│  └─ Day 7：里程碑复盘 + 下周计划                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 角色激活优先级

**Week 4-5 核心角色：**

| 优先级 | 角色 | 激活时间 | 任务 | 预计时长 |
|--------|------|---------|------|---------|
| **P0** | Pentester | Day 1 上午 | API 安全威胁建模 | 4h |
| **P0** | Architect | Day 1 下午 | API 安全架构设计 | 4h |
| **P0** | Architect | Day 2 上午 | 评审安全方案 | 2h |
| **P0** | Engineer | Day 2 下午 | 实现安全中间件 | 6h |
| **P0** | QATester | Day 2 晚上 | Code Review | 2h |
| **P0** | Pentester | Day 3 上午 | 安全测试验证 | 4h |
| **P0** | Engineer | Day 3 下午 | 修复问题 | 4h |
| **P1** | QATester | Day 4 | 质量保证体系 | 8h |
| **P1** | Writer | Day 5 | 文档完善 | 8h |
| **P2** | Coordinator | Day 7 | 复盘总结 | 4h |

### 6.3 平滑过渡方案

#### 6.3.1 阶段 1：角色定义（Day 1，已完成）

**目标：** 定义 7 个核心角色，明确职责和协作机制

**输出：**
- ✅ 角色定义文档（本文档）
- ✅ 角色激活流程
- ✅ 协作机制设计

**验证标准：**
- 角色职责边界清晰
- 协作流程无歧义
- 工具和能力定义完整

#### 6.3.2 阶段 2：角色试运行（Day 1-3）

**目标：** 在 P0 任务中试运行虚拟团队模式

**任务：** API 安全加固

**角色激活顺序：**
```
Day 1:
  - Pentester（主责）：威胁建模 + 安全方案
  - Architect（协作）：架构安全评审

Day 2:
  - Architect（评审）：方案评审
  - Engineer（实现）：代码实现
  - QATester（评审）：Code Review

Day 3:
  - Pentester（验证）：安全测试
  - Engineer（修复）：问题修复
  - QATester（验证）：集成测试
```

**验证标准：**
- 角色激活流程顺畅
- 任务传递无阻塞
- 协作效率提升（相比单人模式）

#### 6.3.3 阶段 3：体系优化（Day 4-5）

**目标：** 基于试运行反馈优化角色体系

**优化项：**
- 角色职责调整（如果发现重叠或遗漏）
- 协作流程优化（简化不必要的步骤）
- 工具配置优化（提高自动化程度）

**示例优化：**
```
发现：Pentester 和 QATester 在安全测试上有职责重叠
优化：
  - Pentester：专注威胁建模和漏洞分析
  - QATester：专注安全测试用例和验证
  - 协作：Pentester 提供威胁模型，QATester 编写测试
```

#### 6.3.4 阶段 4：全面推广（Day 6-7 及以后）

**目标：** 在所有任务中使用虚拟团队模式

**推广策略：**
- 所有新任务都通过 Coordinator 分配
- 所有角色按需激活
- 所有任务记录到 TaskList

**长期优化：**
- 每周复盘角色体系效果
- 根据反馈持续优化
- 积累最佳实践案例

### 6.4 成功指标

#### 6.4.1 效率指标

| 指标 | 当前（单人） | 目标（虚拟团队） | 测量方式 |
|------|-------------|----------------|---------|
| **任务完成速度** | 基线 | 提升 30% | 任务时长对比 |
| **代码质量** | >85% 覆盖率 | >90% 覆盖率 | 测试覆盖率 |
| **安全漏洞** | 未知 | P0 漏洞为 0 | 安全扫描 |
| **文档完整性** | ~80% | 100% | 文档检查 |

#### 6.4.2 质量指标

| 指标 | 当前 | 目标 | 测量方式 |
|------|------|------|---------|
| **Code Review 通过率** | ~70% | >90% | PR 评论 |
| **测试通过率** | 100% | 100% | 自动化测试 |
| **性能达标率** | ~80% | >95% | 性能测试 |
| **文档准确率** | ~75% | >90% | 用户反馈 |

#### 6.4.3 协作指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| **角色激活准确率** | >95% | 是否激活了正确的角色 |
| **任务分配准确率** | >90% | 任务是否分配给合适的角色 |
| **冲突解决时间** | <2h | 从发现到解决的时间 |
| **上下文共享完整度** | >85% | 角色是否阅读了必要的文档 |

---

## 7. 监控与优化

### 7.1 角色绩效监控

#### 7.1.1 绩效指标

**角色维度指标：**
```typescript
interface RoleMetrics {
  role: string;
  tasksCompleted: number;
  tasksOnTime: number; // 按时完成率
  avgTaskDuration: number; // 平均任务时长
  qualityScore: number; // 质量评分（0-100）
  collaborationScore: number; // 协作评分（0-100）
}

// 示例数据
{
  "role": "Pentester",
  "tasksCompleted": 12,
  "tasksOnTime": 11, // 91.7% 按时完成
  "avgTaskDuration": 4.5, // 小时
  "qualityScore": 95,
  "collaborationScore": 88
}
```

**任务维度指标：**
```typescript
interface TaskMetrics {
  taskId: string;
  title: string;
  assignee: string;
  status: string;
  plannedHours: number;
  actualHours: number;
  qualityScore: number;
  blockers: string[];
  lessonsLearned: string[];
}
```

#### 7.1.2 定期评估

**每周评估（Coordinator 负责）：**
```
1. 收集本周数据
   ├─ 任务完成情况
   ├─ 质量指标
   └─ 协作效果

2. 分析问题
   ├─ 哪些任务延期？原因？
   ├─ 哪些角色协作不顺？
   └─ 哪些流程需要优化？

3. 提出改进建议
   ├─ 角色职责调整
   ├─ 协作流程优化
   └─ 工具配置改进

4. 输出周报
   └─ WEEK-X_PERFORMANCE_REPORT.md
```

### 7.2 持续优化

#### 7.2.1 优化方向

**方向 1：角色职责优化**
- 问题：职责重叠（如 Pentester 和 QATester）
- 优化：明确边界，减少重叠

**方向 2：协作流程优化**
- 问题：任务传递效率低
- 优化：简化流程，自动化传递

**方向 3：工具配置优化**
- 问题：工具使用不便
- 优化：统一工具接口，提高易用性

**方向 4：上下文管理优化**
- 问题：上下文加载慢
- 优化：缓存上下文，增量更新

#### 7.2.2 优化实验

**实验方法：**
```
1. 提出假设
   例："如果自动化 Code Review，可以提升 50% 效率"

2. 设计实验
   ├─ 控制组：人工 Code Review
   ├─ 实验组：自动化 Code Review
   └─ 测量指标：Review 时长、质量

3. 执行实验
   └─ 运行 1-2 周

4. 分析结果
   ├─ 效率提升是否达标？
   └─ 质量是否有下降？

5. 决策
   ├─ 成功 → 全面推广
   └─ 失败 → 分析原因，调整方案
```

### 7.3 知识库积累

#### 7.3.1 最佳实践文档

**格式：**
```markdown
# [角色] 最佳实践：[主题]

## 场景描述
[具体场景]

## 解决方案
[详细步骤]

## 效果
[量化指标]

## 注意事项
[避坑指南]

## 相关案例
[链接到相关任务或文档]
```

**示例：**
```markdown
# Pentester 最佳实践：API 安全加固

## 场景描述
ReflectGuard REST API 需要添加认证、验证和限流机制

## 解决方案
1. STRIDE 威胁建模
2. 设计安全方案（认证 + 验证 + 限流）
3. 编写安全测试用例
4. 验证修复效果

## 效果
- P0 安全漏洞：0
- 安全测试通过率：100%
- 性能影响：<10ms

## 注意事项
- 认证机制要简单（API Key 即可）
- 输入验证要严格（JSON Schema）
- 限流要合理（令牌桶算法）

## 相关案例
- TASK-2026-0501: REST API 安全加固
- ADR-004: 采用 API Key 认证
```

#### 7.3.2 案例库

**案例格式：**
```typescript
interface CaseStudy {
  title: string;
  roles: string[];
  task: string;
  process: string[];
  outcome: string;
  lessons: string[];
  tags: string[];
}

// 示例
{
  "title": "API 安全加固协作案例",
  "roles": ["Pentester", "Architect", "Engineer", "QATester"],
  "task": "REST API 安全加固",
  "process": [
    "Pentester 威胁建模",
    "Architect 架构评审",
    "Engineer 代码实现",
    "QATester 测试验证"
  ],
  "outcome": "P0 安全漏洞为 0，性能影响 <10ms",
  "lessons": [
    "威胁建模应在架构设计前完成",
    "安全方案要考虑性能影响"
  ],
  "tags": ["安全", "协作", "API"]
}
```

---

## 8. 附录：角色配置示例

### 8.1 角色激活脚本

**示例：激活 Pentester 角色**
```typescript
// 1. 定义角色上下文
const pentesterContext = {
  role: "Pentester",
  mission: "API 安全威胁建模和方案设计",
  requiredDocuments: [
    "CLAUDE.md",
    "reports/PHASE2_ARCHITECTURE.md",
    "api/CLAUDE.md",
    "reports/WEEK4-5_RISK_MONITORING_FRAMEWORK.md"
  ],
  taskContext: {
    taskId: "TASK-2026-0501",
    title: "REST API 安全加固",
    priority: "P0",
    deadline: "2026-02-07"
  },
  tools: ["STRIDE", "OWASP Top 10", "安全扫描脚本"],
  capabilities: ["威胁建模", "漏洞分析", "安全测试"],
  collaboration: {
    upstream: ["Coordinator"],
    downstream: ["Architect", "Engineer", "QATester"]
  }
};

// 2. 角色激活提示词
const pentesterPrompt = `
你现在是 ReflectGuard 虚拟团队中的 **Pentester（安全专家）** 角色。

## 你的核心职责
- 安全漏洞识别和修复验证
- 安全编码规范制定和检查
- 威胁建模和安全测试
- 安全最佳实践推广

## 当前任务
**任务 ID：** TASK-2026-0501
**任务标题：** REST API 安全加固
**优先级：** P0（严重）
**截止时间：** 2026-02-07

## 任务描述
为 ReflectGuard REST API 添加认证、验证和限流机制，确保 API 安全。

## 你需要做的事情
1. 阅读项目上下文文档（CLAUDE.md、PHASE2_ARCHITECTURE.md）
2. 使用 STRIDE 模型进行威胁建模
3. 设计安全方案（认证 + 验证 + 限流）
4. 编写安全测试用例
5. 与 Architect、Engineer、QATester 协作

## 你的工具
- STRIDE 威胁建模
- OWASP Top 10 检查清单
- 安全扫描脚本

## 你的协作伙伴
- 上游：Coordinator（任务分配）
- 下游：Architect（架构评审）、Engineer（代码实现）、QATester（测试验证）

## 输出要求
1. 威胁建模报告（STRIDE 分析）
2. 安全方案文档（详细设计）
3. 安全测试用例（OWASP Top 10）

请开始你的工作。
`;
```

### 8.2 角色切换示例

**场景：从 Engineer 切换到 QATester**
```typescript
// 1. Engineer 完成任务
const engineerComplete = {
  role: "Engineer",
  task: "实现 API 认证中间件",
  status: "completed",
  output: {
    codeFiles: ["src/api/middleware/auth.ts"],
    testFiles: ["tests/api/middleware/auth.test.ts"],
    coverage: 0.87
  },
  nextAction: "提交给 QATester Code Review"
};

// 2. Coordinator 切换角色
const coordinatorAction = {
  from: "Engineer",
  to: "QATester",
  reason: "代码实现完成，需要 Code Review",
  taskContext: {
    taskId: "TASK-2026-0502",
    title: "API 认证中间件 Code Review",
    priority: "P0",
    relatedFiles: ["src/api/middleware/auth.ts"]
  }
};

// 3. QATester 激活
const qaTesterPrompt = `
你现在是 ReflectGuard 虚拟团队中的 **QATester（质量专家）** 角色。

## 当前任务
**任务 ID：** TASK-2026-0502
**任务标题：** API 认证中间件 Code Review
**优先级：** P0
**前置任务：** TASK-2026-0501（API 认证中间件实现）✅

## 你需要做的事情
1. 审查 Engineer 提交的代码
2. 检查代码质量：
   - 遵循 TypeScript 严格模式 ✅
   - 所有公开方法有 TSDoc 注释 ✅
   - 测试覆盖率 >85% ✅
   - 性能符合要求 ✅
3. 识别潜在问题
4. 提出改进建议
5. 输出 Code Review 报告

## 你的工具
- 自动化 Code Review 脚本
- 测试覆盖率分析
- 技术债务量化评估

请开始 Code Review。
`;
```

### 8.3 角色协作示例

**场景：API 安全加固协作流程**
```typescript
// 协作时间线
const collaborationTimeline = [
  {
    time: "Day 1 09:00",
    role: "Coordinator",
    action: "分配 TASK-2026-0501 给 Pentester"
  },
  {
    time: "Day 1 09:30",
    role: "Pentester",
    action: "阅读 CLAUDE.md 和架构文档",
    output: "理解项目上下文"
  },
  {
    time: "Day 1 10:00",
    role: "Pentester",
    action: "STRIDE 威胁建模",
    output: "威胁建模报告"
  },
  {
    time: "Day 1 14:00",
    role: "Pentester",
    action: "设计安全方案",
    output: "API 安全加固方案"
  },
  {
    time: "Day 1 16:00",
    role: "Architect",
    action: "评审安全方案",
    output: "架构评审意见"
  },
  {
    time: "Day 2 09:00",
    role: "Coordinator",
    action: "分配 TASK-2026-0502 给 Engineer"
  },
  {
    time: "Day 2 09:30",
    role: "Engineer",
    action: "实现 API 认证中间件",
    output: "auth.ts + auth.test.ts"
  },
  {
    time: "Day 2 16:00",
    role: "QATester",
    action: "Code Review",
    output: "Code Review 报告"
  },
  {
    time: "Day 3 09:00",
    role: "Pentester",
    action: "安全测试验证",
    output: "安全测试报告"
  },
  {
    time: "Day 3 14:00",
    role: "Engineer",
    action: "修复发现的问题",
    output: "修复后的代码"
  },
  {
    time: "Day 3 16:00",
    role: "Coordinator",
    action: "任务验收并关闭",
    output: "任务完成报告"
  }
];
```

---

## 总结

本文档设计了 ReflectGuard 虚拟团队专业 Agent 角色体系，包括：

**核心成果：**
1. ✅ 7 个核心角色定义（Architect、Engineer、Pentester、QATester、Analyst、Writer、Coordinator、Researcher）
2. ✅ 角色工作流程（激活、传递、决策、冲突解决）
3. ✅ 角色工具和能力（工具清单、模型选择、特殊能力）
4. ✅ 虚拟团队协作机制（上下文共享、任务分配、冲突解决）
5. ✅ 实施路线图（Week 4-5 时间分配、角色激活优先级、平滑过渡方案）

**设计特点：**
- **轻量级**：不引入重量级框架，保持简单高效
- **角色驱动**：每个 AI 对话以角色身份进行，增强专业性
- **按需激活**：角色按需激活，不强制所有角色同时运行
- **文档先行**：角色激活前先阅读相关文档，建立共享上下文
- **持续优化**：根据使用反馈持续优化角色定义和工作流程

**下一步行动：**
1. Day 1 下午：激活 Pentester + Architect，开始 API 安全加固
2. Day 2-3：按协作流程执行任务
3. Day 4-5：基于反馈优化角色体系
4. Day 6-7：里程碑复盘 + 下周计划

---

**文档版本：** 1.0.0
**最后更新：** 2026-02-05
**维护者：** ReflectGuard Team
**状态：** ✅ 完成
