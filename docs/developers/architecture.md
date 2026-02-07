# 系统架构

ReflectGuard 的完整系统架构文档。

## 概览

ReflectGuard 采用**分层架构**设计，遵循**依赖倒置原则**和**单一职责原则**。

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户交互层                                │
├─────────────────────────────────────────────────────────────────┤
│  CLI  │  Web UI  │  REST API  │  WebSocket  │  MCP Server      │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          集成层                                  │
├─────────────────────────────────────────────────────────────────┤
│  Skill Framework  │  Hook System  │  Event Bus                 │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         核心服务层                                │
├─────────────────────────────────────────────────────────────────┤
│ Gateway │ Retrospective │ Analytics │ Scheduler │ Notifier     │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        基础设施层                                │
├─────────────────────────────────────────────────────────────────┤
│  文件锁  │  缓存  │  日志  │  配置  │  监控                    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          数据层                                  │
├─────────────────────────────────────────────────────────────────┤
│  Hot Store  │  Warm Archive  │  Cold Knowledge                │
└─────────────────────────────────────────────────────────────────┘
```

## 核心模块

### Gateway 模块

```typescript
/**
 * Gateway 检查器
 * 负责检查任务意图是否符合行为准则
 */
class GatewayGuard {
  async check(intent: string): Promise<CheckResult>
  async loadPrinciples(): Promise<Principle[]>
  async validate(result: CheckResult): Promise<boolean>
}
```

**职责：**
- 加载和验证行为准则
- 检查任务意图
- 返回检查结果
- 记录违规行为

### Retrospective 模块

```typescript
/**
 * 复盘核心引擎
 * 负责 7 维度数据提取和分析
 */
class RetrospectiveCore {
  async extract(conversation: string): Promise<ExtractionResult>
  async analyze(retrospective: Retrospective): Promise<Analysis>
  async generateReport(analysis: Analysis): Promise<Report>
}
```

**职责：**
- 提取 7 维度数据
- 分析模式匹配
- 生成复盘报告
- 存储复盘结果

### Analytics 模块

```typescript
/**
 * 分析服务
 * 负责数据聚合、趋势分析和异常检测
 */
class AnalyticsService {
  async getUsageMetrics(period: TimePeriod): Promise<UsageMetrics>
  async getQualityMetrics(period: TimePeriod): Promise<QualityMetrics>
  async getTrendAnalysis(metric: string, period: TimePeriod): Promise<TrendAnalysis>
  async detectAnomalies(): Promise<Anomaly[]>
}
```

**职责：**
- 聚合使用指标
- 分析质量趋势
- 检测异常行为
- 生成仪表板数据

## 数据流

### 检查流程

```
用户输入任务
    ▼
GatewayGuard.check()
    ▼
加载原则 (level-1-hot)
    ▼
模式匹配 (PatternMatcher)
    ▼
陷阱识别 (TrapDetector)
    ▼
生成结果
    ▼
记录违规 (level-2-warm)
```

### 复盘流程

```
触发复盘
    ▼
数据提取 (DataExtractor)
    ▼
7维度分析
    ▼
模式匹配
    ▼
趋势分析 (Analytics)
    ▼
生成报告
    ▼
存储结果 (level-2-warm)
```

## 设计原则

### 1. 轻量级优先

- 不使用数据库
- 不使用消息队列
- 不使用容器编排
- 使用文件系统存储

### 2. 类型安全

- TypeScript 严格模式
- 100% 类型覆盖
- 无 `any` 类型

### 3. 测试驱动

- 所有功能有测试
- 测试覆盖率 >85%
- TDD 开发流程

### 4. 渐进式增强

- 在现有基础上增强
- 避免大规模重构
- 保持向后兼容

## 依赖关系

```
┌─────────────────────────────────────────────────────┐
│                    CLI                              │
├─────────────────────────────────────────────────────┤
│         MCP Server  │  Web Server                   │
├─────────────────────────────────────────────────────┤
│  Gateway │ Retrospective │ Analytics │ Scheduler    │
├─────────────────────────────────────────────────────┤
│  FileLock │ Cache │ Logger │ Config │ Monitor       │
├─────────────────────────────────────────────────────┤
│  Hot Store │ Warm Archive │ Cold Knowledge         │
└─────────────────────────────────────────────────────┘
```

## 扩展点

### 1. 自定义原则

编辑 `level-1-hot/principles.json`

### 2. 自定义模式

编辑 `level-1-hot/patterns/` 下的 JSON 文件

### 3. 自定义聚合器

实现 `Aggregator` 接口：

```typescript
interface Aggregator<T> {
  aggregate(data: MetricsData[]): Promise<T>;
}
```

### 4. MCP 工具

实现 `Tool` 接口：

```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute(input: unknown): Promise<ToolResult>;
}
```

---

**相关文档：**
- [API 参考](api-reference.md)
- [贡献指南](contributing-guide.md)
- [测试指南](testing-guide.md)

---

**最后更新:** 2026-02-07
