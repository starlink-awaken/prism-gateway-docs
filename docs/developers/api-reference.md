# API 参考

ReflectGuard 的完整 API 参考。

## 核心类

### GatewayGuard

Gateway 检查器，负责验证任务意图。

```typescript
class GatewayGuard {
  constructor(config: GatewayConfig)

  /**
   * 检查任务意图
   */
  async check(intent: string, context?: CheckContext): Promise<CheckResult>

  /**
   * 加载原则
   */
  async loadPrinciples(): Promise<Principle[]>

  /**
   * 验证检查结果
   */
  async validate(result: CheckResult): Promise<boolean>
}
```

**类型定义：**

```typescript
interface CheckResult {
  status: 'PASSED' | 'BLOCKED' | 'WARNING';
  violations: Violation[];
  warnings: Warning[];
  score: number;
}

interface CheckContext {
  project?: string;
  timeframe?: TimeFrame;
  priority?: 'low' | 'medium' | 'high';
}

interface Violation {
  principleId: string;
  category: string;
  message: string;
  level: 'MANDATORY' | 'WARNING' | 'ADVISORY';
}
```

### RetrospectiveCore

复盘核心引擎。

```typescript
class RetrospectiveCore {
  constructor(config: RetrospectiveConfig)

  /**
   * 提取 7 维度数据
   */
  async extract(conversation: string, options?: ExtractOptions): Promise<ExtractionResult>

  /**
   * 分析复盘数据
   */
  async analyze(retrospective: Retrospective): Promise<Analysis>

  /**
   * 生成复盘报告
   */
  async generateReport(analysis: Analysis, format?: 'markdown' | 'json'): Promise<string>
}
```

**类型定义：**

```typescript
interface ExtractionResult {
  principles?: PrincipleData;
  patterns?: PatternData;
  benchmarks?: BenchmarkData;
  traps?: TrapData;
  success?: SuccessData;
  tools?: ToolData;
  data?: DataPoint[];
}

interface Retrospective {
  id: string;
  timestamp: Date;
  conversation: string;
  extraction: ExtractionResult;
  analysis?: Analysis;
}
```

### AnalyticsService

数据分析服务。

```typescript
class AnalyticsService {
  constructor(config: AnalyticsConfig)

  /**
   * 获取使用指标
   */
  async getUsageMetrics(period: TimePeriod): Promise<UsageMetrics>

  /**
   * 获取质量指标
   */
  async getQualityMetrics(period: TimePeriod): Promise<QualityMetrics>

  /**
   * 获取性能指标
   */
  async getPerformanceMetrics(period: TimePeriod): Promise<PerformanceMetrics>

  /**
   * 获取趋势分析
   */
  async getTrendAnalysis(metric: string, period: TimePeriod): Promise<TrendAnalysis>

  /**
   * 检测异常
   */
  async detectAnomalies(): Promise<Anomaly[]>

  /**
   * 获取仪表板
   */
  async getDashboard(period: TimePeriod): Promise<Dashboard>
}
```

**类型定义：**

```typescript
interface UsageMetrics {
  totalChecks: number;
  totalRetro: number;
  activeUsers: number;
  averageDuration: number;
}

interface QualityMetrics {
  violationRate: number;
  falsePositiveRate: number;
  topViolations: TopViolation[];
}

interface PerformanceMetrics {
  average: number;
  p50: number;
  p95: number;
  p99: number;
}

interface TrendAnalysis {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  slope: number;
  r2: number;
  changePoints: Date[];
}

interface Dashboard {
  summary: SummaryMetrics;
  trends: TrendMetrics;
  alerts: Alert[];
}
```

## CLI API

### 命令行接口

```bash
# 检查命令
prism check <intent> [options]

# 复盘命令
prism retro <mode> [options]

# 分析命令
prism analytics <metric> [options]

# 配置命令
prism config <action> [options]

# 备份命令
prism backup <action> [options]
```

### 选项

| 选项 | 全称 | 说明 | 默认值 |
|------|------|------|--------|
| `-o` | `--output` | 输出格式 | `detailed` |
| `-p` | `--period` | 时间范围 | `today` |
| `-j` | `--json` | JSON 输出 | `false` |
| `-v` | `--verbose` | 详细输出 | `false` |
| `-q` | `--quiet` | 静默模式 | `false` |

## MCP 工具 API

### gateway_check

检查任务意图。

```typescript
{
  name: "gateway_check",
  description: "检查任务意图是否符合行为准则",
  inputSchema: {
    type: "object",
    properties: {
      intent: { type: "string" },
      context: { type: "object" }
    },
    required: ["intent"]
  }
}
```

### extract_data

提取 7 维度数据。

```typescript
{
  name: "extract_data",
  description: "从对话中提取7维度数据",
  inputSchema: {
    type: "object",
    properties: {
      conversation: { type: "string" },
      dimensions: { type: "array", items: { type: "string" } }
    },
    required: ["conversation"]
  }
}
```

### trigger_retro

触发复盘。

```typescript
{
  name: "trigger_retro",
  description: "触发复盘分析",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["quick", "standard", "deep"] },
      project: { type: "string" },
      timeframe: { type: "string" }
    },
    required: ["mode"]
  }
}
```

### query_patterns

查询模式。

```typescript
{
  name: "query_patterns",
  description: "查询成功/失败模式",
  inputSchema: {
    type: "object",
    properties: {
      keyword: { type: "string" },
      category: { type: "string" }
    }
  }
}
```

### query_principles

查询原则。

```typescript
{
  name: "query_principles",
  description: "查询行为准则",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string" },
      level: { type: "string", enum: ["MANDATORY", "WARNING", "ADVISORY"] }
    }
  }
}
```

### get_stats

获取统计信息。

```typescript
{
  name: "get_stats",
  description: "获取使用统计",
  inputSchema: {
    type: "object",
    properties: {
      period: { type: "string", enum: ["today", "week", "month"] },
      metrics: { type: "array", items: { type: "string" } }
    }
  }
}
```

## 错误代码

| 代码 | 说明 | HTTP 状态码 |
|------|------|-------------|
| ERR_0001 | 配置无效 | 400 |
| ERR_0002 | 数据格式错误 | 400 |
| ERR_0003 | 资源不存在 | 404 |
| ERR_0004 | 权限不足 | 403 |
| ERR_0005 | 服务不可用 | 503 |
| ERR_0006 | 超时 | 408 |
| ERR_0007 | 违反原则 | 422 |

---

**相关文档：**
- [架构设计](architecture.md)
- [测试指南](testing-guide.md)
- [用户指南](../users/user-guide.md)

---

**最后更新:** 2026-02-07
