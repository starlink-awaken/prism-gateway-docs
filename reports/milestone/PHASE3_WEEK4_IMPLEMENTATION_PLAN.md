# Phase 3 Week 4: 运维工具实施计划

> **计划日期**: 2026-02-07
> **计划版本**: 1.0.0
> **实施周期**: Week 3.5 + Week 4 (2026-03-04 ~ 2026-03-14)

---

## 执行摘要

本计划基于 Phase 3 Week 3 完成的 4 份设计文档（~200KB），制定详细的实施路线图。计划分为两个阶段：Week 3.5 (3天) 和 Week 4 (5天)，总计 **40 小时**（32h 实施 + 8h 测试）。

**核心目标**:
- ✅ 实现 4 个运维系统（Backup, HealthCheck, Metrics, Alerting）
- ✅ 达成所有性能目标（备份 <30s，检查 <100ms，采集 <10ms，告警 <5s）
- ✅ 测试覆盖率 >90%（>180 个新测试）
- ✅ 完善文档和用户指南

---

## 1. 实施策略

### 1.1 实施原则

| 原则 | 描述 | 优先级 |
|------|------|--------|
| **依赖优先** | 按依赖关系顺序实施（Backup → Health → Metrics → Alerting） | P0 |
| **测试驱动** | TDD 开发，先写测试再写实现 | P0 |
| **增量交付** | 每个系统完成后立即集成测试 | P0 |
| **性能监控** | 实时监控性能指标，确保达标 | P1 |
| **文档同步** | 实施过程持续更新文档 | P1 |

### 1.2 实施顺序

根据依赖关系和风险评估，确定以下实施顺序：

```
Week 3.5 (03/04-03/07):
  Priority 1: BackupService (10h) - 最独立，无外部依赖
  Priority 2: HealthCheckService (8h, 部分) - 依赖 BackupService

Week 4 (03/08-03/14):
  Priority 3: HealthCheckService 完成 + 测试
  Priority 4: MetricsService (8h) - 为 Alerting 提供数据
  Priority 5: AlertingService (6h) - 整合 Health + Metrics
  Priority 6: 集成测试和文档 (8h)
```

**关键路径**: BackupService → HealthCheckService → MetricsService → AlertingService

---

## 2. Week 3.5 实施计划 (03/04-03/07)

### 2.1 Day 1-2: BackupService 实施 (10h)

#### 目标
实现完整的备份服务，包括全量备份、增量备份、压缩、校验、保留策略。

#### 任务分解

**Day 1 (5h):**
- [x] **Task 1.1**: 创建项目结构和基础类 (1h)
  ```bash
  mkdir -p src/infrastructure/backup
  touch src/infrastructure/backup/BackupService.ts
  touch src/infrastructure/backup/BackupEngine.ts
  touch src/infrastructure/backup/StorageManager.ts
  touch src/infrastructure/backup/BackupScheduler.ts
  ```
- [x] **Task 1.2**: 实现 BackupEngine 核心功能 (2h)
  - `copyTree()` - 递归复制文件树
  - `diff()` - 计算文件差异
  - `compress()` - gzip 压缩
  - `checksum()` - SHA256 校验和
- [x] **Task 1.3**: 实现 StorageManager (2h)
  - `save()` - 保存备份元数据
  - `load()` - 加载备份元数据
  - `list()` - 列出所有备份
  - `applyRetentionPolicy()` - 应用保留策略

**Day 2 (5h):**
- [x] **Task 1.4**: 实现 BackupScheduler (1h)
  - 集成 `node-cron` 定时调度
  - 全量备份：每周日凌晨 2:00
  - 增量备份：工作日凌晨 3:00
  - 自动清理：每周日凌晨 4:00
- [x] **Task 1.5**: 实现 BackupService 统一接口 (1h)
  - `createBackup(type: BackupType)`
  - `restoreBackup(id: string)`
  - `listBackups()`
  - `verifyBackup(id: string)`
  - `getBackupStats()`
- [x] **Task 1.6**: 编写单元测试 (3h)
  - BackupEngine 测试：15 个
  - StorageManager 测试：12 个
  - BackupScheduler 测试：8 个
  - BackupService 集成测试：15 个
  - **目标**: 50+ 测试，覆盖率 >90%

#### 验收标准
- ✅ 所有类实现完整，无 TODO 标记
- ✅ 50+ 单元测试，100% 通过
- ✅ 测试覆盖率 >90%
- ✅ TypeScript 编译无错误
- ✅ ESLint 无错误/警告
- ✅ 性能测试：50MB 数据备份 <30s，恢复 <10s

---

### 2.2 Day 3: HealthCheckService 实施（部分，4h）

#### 目标
实现健康检查服务的核心框架和 2-3 个检查器。

#### 任务分解

**Day 3 (4h):**
- [x] **Task 2.1**: 创建项目结构和基类 (1h)
  ```bash
  mkdir -p src/infrastructure/health
  touch src/infrastructure/health/HealthCheckService.ts
  touch src/infrastructure/health/HealthChecker.ts
  touch src/infrastructure/health/HealthScheduler.ts
  touch src/infrastructure/health/HealthStore.ts
  ```
- [x] **Task 2.2**: 实现 HealthChecker 基类 (0.5h)
  - 抽象方法：`check()`
  - 通用方法：`getName()`, `getDescription()`
- [x] **Task 2.3**: 实现 3 个核心检查器 (1.5h)
  - `SystemHealthChecker` - CPU/内存/负载
  - `DiskHealthChecker` - 磁盘空间/I/O
  - `DataHealthChecker` - 数据文件完整性
- [x] **Task 2.4**: 编写初步单元测试 (1h)
  - HealthChecker 基类测试：5 个
  - SystemHealthChecker 测试：8 个
  - DiskHealthChecker 测试：8 个
  - DataHealthChecker 测试：8 个
  - **目标**: 29 个测试，覆盖率 >85%

#### 验收标准
- ✅ HealthChecker 基类和 3 个检查器实现完整
- ✅ 29+ 单元测试，100% 通过
- ✅ 测试覆盖率 >85%
- ✅ TypeScript 编译无错误

---

## 3. Week 4 实施计划 (03/08-03/14)

### 3.1 Day 1: HealthCheckService 完成 + 测试 (6h)

#### 目标
完成剩余 4 个检查器，实现调度器和存储，编写完整测试。

#### 任务分解

**Day 1 (6h):**
- [x] **Task 2.5**: 实现剩余 4 个检查器 (2h)
  - `APIHealthChecker` - REST API 可用性
  - `WebSocketHealthChecker` - WebSocket 连接
  - `ServiceHealthChecker` - 外部服务依赖
  - `NetworkHealthChecker` - 网络连通性
- [x] **Task 2.6**: 实现 HealthScheduler (1h)
  - 关键检查：30s 间隔
  - 次要检查：60s 间隔
  - 普通检查：120s 间隔
- [x] **Task 2.7**: 实现 HealthStore (0.5h)
  - `saveCurrent()` - 保存当前状态
  - `loadCurrent()` - 加载当前状态
  - `appendHistory()` - 追加历史记录
  - `queryHistory()` - 查询历史
- [x] **Task 2.8**: 实现 HealthCheckService 统一接口 (0.5h)
  - `getCurrentHealth()`
  - `getFullReport()`
  - `runCheck(name: string)`
  - `getHealthHistory()`
  - `getHealthStats()`
- [x] **Task 2.9**: 编写完整单元测试 (2h)
  - 4 个检查器测试：32 个
  - HealthScheduler 测试：5 个
  - HealthStore 测试：6 个
  - HealthCheckService 集成测试：8 个
  - **总计**: 40+ 测试（加上 Day 3 的 29 个，共 69 个），覆盖率 >90%

#### 验收标准
- ✅ 7 个检查器全部实现
- ✅ HealthScheduler 和 HealthStore 实现完整
- ✅ 69+ 单元测试，100% 通过
- ✅ 测试覆盖率 >90%
- ✅ 性能测试：单次检查 <100ms

---

### 3.2 Day 2-3: MetricsService 实施 (8h)

#### 目标
实现完整的监控指标收集系统，包括 6 个采集器、时序存储、查询引擎。

#### 任务分解

**Day 2 (4h):**
- [x] **Task 3.1**: 创建项目结构和基类 (0.5h)
  ```bash
  mkdir -p src/infrastructure/metrics
  touch src/infrastructure/metrics/MetricsService.ts
  touch src/infrastructure/metrics/MetricCollector.ts
  touch src/infrastructure/metrics/MetricsStorage.ts
  touch src/infrastructure/metrics/MetricsAggregator.ts
  touch src/infrastructure/metrics/QueryEngine.ts
  ```
- [x] **Task 3.2**: 实现 MetricCollector 基类 (0.5h)
  - 抽象方法：`collect()`
  - 通用方法：`getName()`, `getInterval()`
- [x] **Task 3.3**: 实现 6 个采集器 (2h)
  - `SystemMetricsCollector` - 系统资源
  - `ProcessMetricsCollector` - 进程资源
  - `APIMetricsCollector` - API 请求指标
  - `WebSocketMetricsCollector` - WebSocket 指标
  - `BusinessMetricsCollector` - 业务指标
  - `DataMetricsCollector` - 数据量指标
- [x] **Task 3.4**: 编写采集器测试 (1h)
  - 6 个采集器测试：30 个
  - **目标**: 30 个测试，覆盖率 >90%

**Day 3 (4h):**
- [x] **Task 3.5**: 实现 MetricsStorage (1h)
  - 4 级时序存储：raw, 1m, 5m, 1h
  - `write()` - 写入原始数据
  - `read()` - 读取数据
  - `cleanup()` - 清理过期数据
- [x] **Task 3.6**: 实现 MetricsAggregator (1h)
  - `aggregate1m()` - 1 分钟聚合
  - `aggregate5m()` - 5 分钟聚合
  - `aggregate1h()` - 1 小时聚合
  - 支持多种聚合函数：sum, avg, min, max, p50, p95, p99
- [x] **Task 3.7**: 实现 QueryEngine (0.5h)
  - `timeRangeQuery()` - 时间范围查询
  - `aggregation()` - 聚合计算
  - `downsampling()` - 降采样
- [x] **Task 3.8**: 实现 MetricsService 统一接口 (0.5h)
  - `snapshot()` - 获取实时指标
  - `query()` - 查询指标数据
  - `listMetrics()` - 列出所有指标
  - `getStats()` - 获取统计信息
- [x] **Task 3.9**: 编写完整单元测试 (1h)
  - MetricsStorage 测试：10 个
  - MetricsAggregator 测试：12 个
  - QueryEngine 测试：8 个
  - MetricsService 集成测试：10 个
  - **总计**: 60+ 测试，覆盖率 >90%

#### 验收标准
- ✅ 6 个采集器全部实现
- ✅ 时序存储和聚合器实现完整
- ✅ 查询引擎支持灵活查询
- ✅ 60+ 单元测试，100% 通过
- ✅ 测试覆盖率 >90%
- ✅ 性能测试：采集延迟 <10ms，查询性能 <100ms

---

### 3.3 Day 4: AlertingService 实施 (6h)

#### 目标
实现完整的告警系统，包括规则引擎、通知管理器、去重器、存储。

#### 任务分解

**Day 4 (6h):**
- [x] **Task 4.1**: 创建项目结构 (0.5h)
  ```bash
  mkdir -p src/infrastructure/alerting
  touch src/infrastructure/alerting/AlertingService.ts
  touch src/infrastructure/alerting/AlertRuleEngine.ts
  touch src/infrastructure/alerting/AlertNotifier.ts
  touch src/infrastructure/alerting/AlertDeduplicator.ts
  touch src/infrastructure/alerting/AlertStorage.ts
  ```
- [x] **Task 4.2**: 实现 AlertRuleEngine (1.5h)
  - 阈值规则 (Threshold)
  - 变化率规则 (Rate of Change)
  - 组合规则 (Composite)
  - 时间窗口规则 (Time Window)
  - 静默规则 (Silence)
- [x] **Task 4.3**: 实现 AlertNotifier (1h)
  - `ConsoleChannel` - 控制台输出
  - `FileChannel` - 文件日志
  - `WebhookChannel` - HTTP 回调
  - 可选：`EmailChannel`, `SlackChannel`
- [x] **Task 4.4**: 实现 AlertDeduplicator (0.5h)
  - 去重 (Deduplication)
  - 合并 (Aggregation)
  - 抑制 (Suppression)
  - 节流 (Throttling)
- [x] **Task 4.5**: 实现 AlertStorage (0.5h)
  - `save()` - 保存告警
  - `load()` - 加载告警
  - `update()` - 更新告警状态
  - `query()` - 查询告警
- [x] **Task 4.6**: 实现 AlertingService 统一接口 (0.5h)
  - `createAlert()` - 创建告警
  - `acknowledgeAlert()` - 确认告警
  - `resolveAlert()` - 解决告警
  - `getActiveAlerts()` - 获取活跃告警
  - `getAlertHistory()` - 查询告警历史
  - `addSilenceRule()` - 添加静默规则
- [x] **Task 4.7**: 编写完整单元测试 (2h)
  - AlertRuleEngine 测试：15 个
  - AlertNotifier 测试：10 个
  - AlertDeduplicator 测试：8 个
  - AlertStorage 测试：7 个
  - AlertingService 集成测试：10 个
  - **总计**: 50+ 测试，覆盖率 >90%

#### 验收标准
- ✅ 规则引擎支持 5 种规则类型
- ✅ 通知管理器至少支持 3 个渠道
- ✅ 去重器实现 4 种降噪机制
- ✅ 50+ 单元测试，100% 通过
- ✅ 测试覆盖率 >90%
- ✅ 性能测试：告警延迟 <5s

---

### 3.4 Day 5: 集成测试和文档 (8h)

#### 目标
完成端到端集成测试，编写用户文档和 API 文档。

#### 任务分解

**Day 5 (8h):**
- [x] **Task 5.1**: 编写集成测试 (3h)
  - **场景 1**: 备份 → 恢复 → 验证完整周期 (1h)
  - **场景 2**: 健康检查 → 告警触发 → 通知发送 (1h)
  - **场景 3**: 指标采集 → 告警规则 → 告警触发 (1h)
  - **目标**: 20+ 集成测试，覆盖核心场景
- [x] **Task 5.2**: 性能基准测试 (2h)
  - BackupService: 50MB 数据备份 <30s
  - HealthCheckService: 单次检查 <100ms
  - MetricsService: 采集延迟 <10ms
  - AlertingService: 告警延迟 <5s
  - **目标**: 所有性能指标达标
- [x] **Task 5.3**: 编写用户文档 (2h)
  - CLI 命令使用指南
  - API 端点使用文档
  - 配置和部署指南
  - 故障排查手册
- [x] **Task 5.4**: 代码审查和优化 (1h)
  - TypeScript 类型完善
  - ESLint 规则检查
  - 代码复用优化
  - 错误处理完善

#### 验收标准
- ✅ 20+ 集成测试，100% 通过
- ✅ 所有性能指标达标
- ✅ 用户文档完整（至少 30KB）
- ✅ 代码质量：0 TypeScript 错误，0 ESLint 错误/警告

---

## 4. 测试计划

### 4.1 测试策略

| 测试类型 | 目标数量 | 覆盖率目标 | 负责人 |
|---------|---------|-----------|--------|
| **单元测试** | >180 | >90% | 开发工程师 |
| **集成测试** | >20 | >85% | QA 工程师 |
| **性能测试** | 4 套 | 100% 达标 | 性能工程师 |
| **E2E 测试** | >5 | 核心场景 | QA 工程师 |

### 4.2 测试分解

#### BackupService 测试（50+ 测试）
- BackupEngine 单元测试：15 个
- StorageManager 单元测试：12 个
- BackupScheduler 单元测试：8 个
- BackupService 集成测试：15 个

#### HealthCheckService 测试（69+ 测试）
- HealthChecker 基类测试：5 个
- 7 个检查器单元测试：56 个（每个 8 个）
- HealthScheduler 测试：5 个
- HealthStore 测试：6 个
- HealthCheckService 集成测试：8 个

#### MetricsService 测试（60+ 测试）
- 6 个采集器单元测试：30 个（每个 5 个）
- MetricsStorage 测试：10 个
- MetricsAggregator 测试：12 个
- QueryEngine 测试：8 个
- MetricsService 集成测试：10 个

#### AlertingService 测试（50+ 测试）
- AlertRuleEngine 测试：15 个
- AlertNotifier 测试：10 个
- AlertDeduplicator 测试：8 个
- AlertStorage 测试：7 个
- AlertingService 集成测试：10 个

**总计**: >229 个单元测试 + 20+ 集成测试 = **>249 个测试**

### 4.3 性能测试矩阵

| 系统 | 测试场景 | 性能目标 | 验收标准 |
|------|---------|---------|---------|
| **BackupService** | 50MB 数据全量备份 | <30s | P95 <30s |
| **BackupService** | 单个备份恢复 | <10s | P95 <10s |
| **HealthCheckService** | 单个检查器执行 | <100ms | P95 <100ms |
| **HealthCheckService** | 全部检查器并发执行 | <500ms | P95 <500ms |
| **MetricsService** | 单次指标采集 | <10ms | P95 <10ms |
| **MetricsService** | 时间范围查询 | <100ms | P95 <100ms |
| **AlertingService** | 告警触发到通知发送 | <5s | P95 <5s |
| **AlertingService** | 降噪处理延迟 | <100ms | P95 <100ms |

---

## 5. 风险管理

### 5.1 风险识别与缓解

| 风险 | 影响 | 概率 | 缓解措施 | 负责人 |
|------|------|------|---------|--------|
| **时间估算不足** | 高 | 中 | 每个任务预留 20% buffer | PM |
| **依赖关系复杂** | 中 | 低 | 严格按顺序实施，增量集成 | Tech Lead |
| **性能目标未达** | 高 | 低 | 提前性能基准测试，持续监控 | 性能工程师 |
| **测试覆盖不足** | 高 | 中 | TDD 开发，代码审查 | QA Lead |
| **文档不同步** | 中 | 中 | 实施过程持续更新文档 | Tech Writer |
| **集成问题** | 中 | 中 | 每日集成测试，早发现早解决 | DevOps |
| **Bun 兼容性问题** | 中 | 低 | 优先使用 Node.js 标准库 | Tech Lead |
| **并发竞态条件** | 高 | 低 | 文件锁保护关键操作 | 开发工程师 |

### 5.2 风险应对计划

**P0 风险（关键）：**
- **时间延迟**: 如单个系统超时 >20%，立即触发紧急评审
- **性能未达标**: 如性能测试失败，暂停后续开发，优先优化
- **测试失败率 >5%**: 暂停新功能开发，修复失败测试

**P1 风险（重要）：**
- **代码质量问题**: 每日代码审查，ESLint 强制 0 错误
- **文档不完整**: 每个系统完成后立即更新文档

---

## 6. 质量保证

### 6.1 代码质量标准

| 标准 | 要求 | 验证方式 |
|------|------|---------|
| **TypeScript 严格模式** | 100% 类型覆盖 | tsc --noEmit |
| **ESLint** | 0 错误/警告 | eslint src/ |
| **代码复用** | DRY 原则 | Code Review |
| **错误处理** | 所有异步操作 try-catch | Code Review |
| **日志记录** | 结构化日志，分级输出 | Code Review |
| **文档注释** | 所有公共方法 TSDoc | Code Review |

### 6.2 测试质量标准

| 标准 | 要求 | 验证方式 |
|------|------|---------|
| **单元测试覆盖率** | >90% | bun test --coverage |
| **集成测试覆盖** | 核心场景 100% | 手工验证 |
| **性能测试通过率** | 100% | 性能基准测试 |
| **回归测试** | 0 失败 | CI/CD Pipeline |

### 6.3 文档质量标准

| 文档类型 | 要求 | 验证方式 |
|---------|------|---------|
| **代码注释** | TSDoc 格式，所有公共方法 | Code Review |
| **用户指南** | CLI + API 完整示例 | 用户验收 |
| **API 文档** | 所有端点完整说明 | Swagger/OpenAPI |
| **故障排查** | 常见问题覆盖 | 用户反馈 |

---

## 7. 团队协作

### 7.1 角色分工

| 角色 | 姓名 | 负责任务 | 工时 |
|------|------|---------|------|
| **Tech Lead** | - | 架构设计，技术评审 | 全程 |
| **DevOps Engineer** | - | BackupService 实施 | 10h |
| **Backend Engineer 1** | - | HealthCheckService 实施 | 8h |
| **Backend Engineer 2** | - | MetricsService 实施 | 8h |
| **Full-stack Engineer** | - | AlertingService 实施 | 6h |
| **QA Engineer** | - | 测试覆盖和验证 | 8h |
| **Tech Writer** | - | 文档编写和维护 | 全程 |

### 7.2 沟通机制

| 会议类型 | 频率 | 时长 | 参与人 |
|---------|------|------|--------|
| **每日站会** | 每天 9:30 | 15 分钟 | 全员 |
| **设计评审** | 每个系统前 | 30 分钟 | Tech Lead + 开发 |
| **代码评审** | PR 提交后 | 按需 | Tech Lead + 同行 |
| **周报会** | 每周五 | 30 分钟 | 全员 |
| **风险评审** | 每周三 | 30 分钟 | Tech Lead + PM |

### 7.3 协作工具

| 工具 | 用途 |
|------|------|
| **Git + GitHub** | 代码版本控制 |
| **GitHub Projects** | 任务跟踪 |
| **Slack** | 即时通讯 |
| **Notion** | 文档协作 |
| **Figma** | UI/UX 设计 |

---

## 8. 交付清单

### 8.1 代码交付

- [ ] BackupService 完整实现（4 个类，~500 行代码）
- [ ] HealthCheckService 完整实现（9 个类，~800 行代码）
- [ ] MetricsService 完整实现（10 个类，~900 行代码）
- [ ] AlertingService 完整实现（5 个类，~600 行代码）
- [ ] 单元测试 >180 个，覆盖率 >90%
- [ ] 集成测试 >20 个
- [ ] 性能测试 4 套

### 8.2 文档交付

- [ ] 用户指南（CLI 命令使用）
- [ ] API 文档（REST API 端点）
- [ ] 配置指南（系统配置说明）
- [ ] 故障排查手册
- [ ] 架构文档更新（系统架构图）
- [ ] 代码注释（TSDoc 格式）

### 8.3 CI/CD 配置

- [ ] GitHub Actions Workflow（自动化测试）
- [ ] 代码覆盖率报告（Codecov 集成）
- [ ] 性能基准测试（定时执行）
- [ ] 自动化部署脚本

---

## 9. 验收标准

### 9.1 功能验收

| 功能模块 | 验收标准 | 状态 |
|---------|---------|------|
| **BackupService** | 全量/增量备份正常，恢复成功率 100% | ⏳ |
| **HealthCheckService** | 7 个检查器正常运行，异常检测准确率 >95% | ⏳ |
| **MetricsService** | 6 个采集器正常运行，查询结果准确 | ⏳ |
| **AlertingService** | 规则触发正常，通知发送成功率 >99% | ⏳ |

### 9.2 性能验收

| 性能指标 | 目标值 | 实际值 | 状态 |
|---------|--------|--------|------|
| 备份速度（50MB） | <30s | - | ⏳ |
| 恢复速度（单个） | <10s | - | ⏳ |
| 健康检查延迟 | <100ms | - | ⏳ |
| 指标采集延迟 | <10ms | - | ⏳ |
| 告警触发延迟 | <5s | - | ⏳ |

### 9.3 质量验收

| 质量指标 | 目标值 | 实际值 | 状态 |
|---------|--------|--------|------|
| 单元测试数量 | >180 | - | ⏳ |
| 测试覆盖率 | >90% | - | ⏳ |
| TypeScript 错误 | 0 | - | ⏳ |
| ESLint 错误/警告 | 0 | - | ⏳ |
| 文档完整性 | 100% | - | ⏳ |

---

## 10. 下一步行动

### 10.1 立即开始（Week 3.5）

**Day 1 (03/04):**
- [ ] 创建实施分支 `feature/week3-operations-tools`
- [ ] BackupService 结构和基础类
- [ ] BackupEngine 核心功能实施

**Day 2 (03/05):**
- [ ] BackupScheduler 实施
- [ ] BackupService 统一接口
- [ ] BackupService 单元测试（50+ 测试）

**Day 3 (03/06):**
- [ ] HealthCheckService 结构和基类
- [ ] 3 个核心检查器实施
- [ ] HealthCheckService 初步测试（29+ 测试）

### 10.2 Week 4 计划（03/08-03/14）

详见 [3. Week 4 实施计划](#3-week-4-实施计划-0308-0314)

### 10.3 后续迭代（Week 5-6）

**Week 5:**
- 性能优化（基于性能测试结果）
- 用户验收测试
- 文档完善

**Week 6:**
- 发布准备（版本号、CHANGELOG）
- 正式上线
- 监控和反馈收集

---

## 11. 参考资料

### 11.1 设计文档

- [PHASE3_WEEK3_BACKUP_SERVICE_DESIGN.md](./PHASE3_WEEK3_BACKUP_SERVICE_DESIGN.md)
- [PHASE3_WEEK3_HEALTH_CHECK_DESIGN.md](./PHASE3_WEEK3_HEALTH_CHECK_DESIGN.md)
- [PHASE3_WEEK3_MONITORING_METRICS_DESIGN.md](./PHASE3_WEEK3_MONITORING_METRICS_DESIGN.md)
- [PHASE3_WEEK3_ALERTING_SYSTEM_DESIGN.md](./PHASE3_WEEK3_ALERTING_SYSTEM_DESIGN.md)

### 11.2 完成报告

- [PHASE3_WEEK3_COMPLETION_REPORT.md](./PHASE3_WEEK3_COMPLETION_REPORT.md)

### 11.3 内部文档

- [Phase 3 Iteration Plan](./PHASE3_ITERATION_PLAN.md)
- [Week 1 Completion Report](./PHASE3_WEEK1_COMPLETION_REPORT.md)
- [Week 2 Completion Report](./PHASE3_WEEK2_COMPLETION_REPORT.md)
- [CLAUDE.md](../CLAUDE.md) - AI 上下文文档

---

## 12. 附录

### 12.1 关键依赖库

| 库名 | 版本 | 用途 |
|------|------|------|
| **node-cron** | ^3.0.3 | 定时任务调度 |
| **tar** | ^7.4.3 | 备份压缩 |
| **fast-glob** | ^3.3.2 | 文件模式匹配 |
| **systeminformation** | ^5.23.5 | 系统信息采集 |
| **pino** | ^9.5.0 | 结构化日志 |

### 12.2 性能优化技巧

**1. 并发优化:**
```typescript
// 并发执行多个健康检查
const results = await Promise.all(
  checkers.map(checker => checker.check())
);
```

**2. 流式处理:**
```typescript
// 流式备份大文件
const readStream = fs.createReadStream(sourceFile);
const writeStream = fs.createWriteStream(targetFile);
await pipeline(readStream, gzip, writeStream);
```

**3. 缓存优化:**
```typescript
// LRU + TTL 缓存
const cache = new Map<string, { value: any; expiry: number }>();
```

### 12.3 故障排查清单

**BackupService 常见问题:**
- [ ] 检查磁盘空间是否充足（至少 2x 数据大小）
- [ ] 检查文件权限（读写权限）
- [ ] 检查备份目录是否存在

**HealthCheckService 常见问题:**
- [ ] 检查系统资源是否充足（CPU <80%, 内存 <90%）
- [ ] 检查网络连接是否正常
- [ ] 检查数据文件是否损坏

**MetricsService 常见问题:**
- [ ] 检查采集频率是否过高
- [ ] 检查存储空间是否充足
- [ ] 检查时序数据是否正确聚合

**AlertingService 常见问题:**
- [ ] 检查规则配置是否正确
- [ ] 检查通知渠道是否正常
- [ ] 检查静默规则是否生效

---

**计划生成时间**: 2026-02-07 13:00:00
**计划作者**: AI Assistant (Claude Sonnet 4.5)
**审核人**: PRISM-Gateway Team
**版本**: 1.0.0
