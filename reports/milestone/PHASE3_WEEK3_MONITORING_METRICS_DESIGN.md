# Phase 3 Week 3: 监控指标收集设计文档

> **任务编号**: Task 3.3
> **设计时间**: 2026-02-07
> **预计工时**: 8 小时
> **状态**: 📝 设计中

---

## 1. 设计目标

### 1.1 核心目标

为 PRISM-Gateway 系统设计和实现一个轻量级的监控指标收集系统，实时采集系统运行数据，为分析和告警提供数据支撑。

**关键要求**:
- **多维度指标**: 覆盖系统、应用、业务等多个层面
- **高性能**: 最小化采集开销，不影响主业务
- **灵活聚合**: 支持多种时间粒度的聚合
- **持久化存储**: 保留历史数据，支持趋势分析
- **易于扩展**: 方便添加新的指标类型

### 1.2 验收标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| **采集延迟** | 单次采集耗时 | <10ms |
| **采集频率** | 高频指标采集间隔 | 1s |
| **存储开销** | 1天数据存储空间 | <50MB |
| **查询性能** | 单次查询响应时间 | <100ms |
| **CPU 开销** | 采集进程 CPU 占用 | <1% |
| **内存开销** | 采集进程内存占用 | <30MB |

---

## 2. 架构设计

### 2.1 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    监控指标收集系统架构图                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      │
│  │  采集器      │─────>│  聚合器      │─────>│  存储引擎    │      │
│  │ Collectors  │      │ Aggregators │      │  Storage    │      │
│  └─────────────┘      └─────────────┘      └─────────────┘      │
│       │                     │                     │              │
│       │                     │                     │              │
│       ▼                     ▼                     ▼              │
│  ┌────────────────────────────────────────────────────────┐     │
│  │               指标类型 (Metric Types)                  │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │     │
│  │ │ Counter  │ │  Gauge   │ │Histogram │ │ Summary  │  │     │
│  │ │  计数器   │ │  仪表盘   │ │ 直方图   │ │  摘要    │  │     │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              指标采集项 (Metric Collectors)             │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ • SystemMetrics    (CPU, 内存, 负载)                   │     │
│  │ • ProcessMetrics   (进程信息)                          │     │
│  │ • APIMetrics       (请求数, 响应时间, 错误率)           │     │
│  │ • WebSocketMetrics (连接数, 消息数, 延迟)               │     │
│  │ • BusinessMetrics  (Gateway 检查, 复盘, 违规)          │     │
│  │ • DataMetrics      (文件大小, 数据量)                   │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              时序数据存储 (Time Series Store)           │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ ~/.prism-gateway/metrics/                              │     │
│  │   ├── raw/         (原始数据, 1s 粒度, 保留 1h)        │     │
│  │   ├── 1m/          (1分钟聚合, 保留 24h)               │     │
│  │   ├── 5m/          (5分钟聚合, 保留 7d)                │     │
│  │   ├── 1h/          (1小时聚合, 保留 30d)               │     │
│  │   └── manifest.json (指标元数据)                       │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                查询引擎 (Query Engine)                  │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ • 时间范围查询                                          │     │
│  │ • 聚合计算 (sum, avg, min, max, p50, p95, p99)        │     │
│  │ • 降采样 (downsampling)                                │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 MetricsService (主服务类)

```typescript
/**
 * 监控指标服务主类
 * 提供指标注册、采集、查询等功能
 */
export class MetricsService {
  private collectors: Map<string, MetricCollector>;
  private storage: MetricsStorage;
  private aggregator: MetricsAggregator;
  private scheduler: MetricsScheduler;

  /**
   * 注册指标采集器
   * @param collector 采集器实例
   */
  registerCollector(collector: MetricCollector): void {
    this.collectors.set(collector.name, collector);
  }

  /**
   * 采集所有指标
   * @returns 采集结果
   */
  async collectAll(): Promise<MetricSnapshot> {
    const metrics: Metric[] = [];
    const timestamp = Date.now();

    for (const [name, collector] of this.collectors) {
      try {
        const collectorMetrics = await collector.collect();
        metrics.push(...collectorMetrics);
      } catch (error) {
        logger.error(`Failed to collect metrics from ${name}:`, error);
      }
    }

    const snapshot: MetricSnapshot = {
      timestamp,
      metrics
    };

    // 保存到存储
    await this.storage.saveSnapshot(snapshot);

    return snapshot;
  }

  /**
   * 查询指标数据
   * @param query 查询条件
   * @returns 查询结果
   */
  async query(query: MetricQuery): Promise<MetricQueryResult> {
    return await this.storage.query(query);
  }

  /**
   * 获取指标统计
   * @param metricName 指标名称
   * @param timeRange 时间范围
   * @returns 统计结果
   */
  async getStats(metricName: string, timeRange: TimeRange): Promise<MetricStats> {
    const data = await this.storage.query({
      metricName,
      startTime: timeRange.start,
      endTime: timeRange.end
    });

    return this.aggregator.calculateStats(data.points);
  }

  /**
   * 启动指标采集
   */
  async start(): Promise<void> {
    // 立即采集一次
    await this.collectAll();

    // 启动定时采集
    await this.scheduler.start();

    // 启动聚合任务
    await this.aggregator.start();
  }

  /**
   * 停止指标采集
   */
  async stop(): Promise<void> {
    await this.scheduler.stop();
    await this.aggregator.stop();
  }
}
```

#### 2.2.2 MetricCollector (采集器基类)

```typescript
/**
 * 指标采集器基类
 * 所有采集器必须继承此类
 */
export abstract class MetricCollector {
  abstract name: string;
  abstract description: string;
  abstract interval: number; // 采集间隔（毫秒）

  /**
   * 采集指标
   * @returns 指标列表
   */
  async collect(): Promise<Metric[]> {
    const startTime = Date.now();

    try {
      const metrics = await this.performCollect();
      const duration = Date.now() - startTime;

      // 添加采集元数据
      metrics.forEach(metric => {
        metric.labels = {
          ...metric.labels,
          collector: this.name
        };
      });

      return metrics;
    } catch (error) {
      logger.error(`Collection failed for ${this.name}:`, error);
      return [];
    }
  }

  /**
   * 实际采集逻辑（子类实现）
   */
  protected abstract performCollect(): Promise<Metric[]>;
}
```

#### 2.2.3 内置采集器

##### SystemMetricsCollector (系统指标采集)

```typescript
/**
 * 系统指标采集器
 * 采集 CPU、内存、负载等系统级指标
 */
export class SystemMetricsCollector extends MetricCollector {
  name = 'system';
  description = 'System resource metrics';
  interval = 1000; // 1 second

  protected async performCollect(): Promise<Metric[]> {
    const metrics: Metric[] = [];

    // CPU 使用率
    const cpuUsage = await this.getCPUUsage();
    metrics.push({
      name: 'system_cpu_usage',
      type: MetricType.Gauge,
      value: cpuUsage,
      unit: 'percent',
      timestamp: Date.now()
    });

    // 内存使用
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    metrics.push({
      name: 'system_memory_total',
      type: MetricType.Gauge,
      value: totalMemory,
      unit: 'bytes',
      timestamp: Date.now()
    });

    metrics.push({
      name: 'system_memory_used',
      type: MetricType.Gauge,
      value: usedMemory,
      unit: 'bytes',
      timestamp: Date.now()
    });

    metrics.push({
      name: 'system_memory_usage',
      type: MetricType.Gauge,
      value: memoryUsage,
      unit: 'percent',
      timestamp: Date.now()
    });

    // 负载平均值
    const [load1, load5, load15] = os.loadavg();
    metrics.push({
      name: 'system_load_1m',
      type: MetricType.Gauge,
      value: load1,
      timestamp: Date.now()
    });

    metrics.push({
      name: 'system_load_5m',
      type: MetricType.Gauge,
      value: load5,
      timestamp: Date.now()
    });

    metrics.push({
      name: 'system_load_15m',
      type: MetricType.Gauge,
      value: load15,
      timestamp: Date.now()
    });

    return metrics;
  }

  private async getCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    return ((totalTick - totalIdle) / totalTick) * 100;
  }
}
```

##### ProcessMetricsCollector (进程指标采集)

```typescript
/**
 * 进程指标采集器
 * 采集当前进程的资源使用情况
 */
export class ProcessMetricsCollector extends MetricCollector {
  name = 'process';
  description = 'Process resource metrics';
  interval = 5000; // 5 seconds

  protected async performCollect(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    const memUsage = process.memoryUsage();

    // 内存使用
    metrics.push({
      name: 'process_memory_rss',
      type: MetricType.Gauge,
      value: memUsage.rss,
      unit: 'bytes',
      timestamp: Date.now(),
      labels: { pid: process.pid.toString() }
    });

    metrics.push({
      name: 'process_memory_heap_total',
      type: MetricType.Gauge,
      value: memUsage.heapTotal,
      unit: 'bytes',
      timestamp: Date.now(),
      labels: { pid: process.pid.toString() }
    });

    metrics.push({
      name: 'process_memory_heap_used',
      type: MetricType.Gauge,
      value: memUsage.heapUsed,
      unit: 'bytes',
      timestamp: Date.now(),
      labels: { pid: process.pid.toString() }
    });

    // CPU 时间
    const cpuUsage = process.cpuUsage();
    metrics.push({
      name: 'process_cpu_user',
      type: MetricType.Counter,
      value: cpuUsage.user / 1000, // 转换为毫秒
      unit: 'milliseconds',
      timestamp: Date.now(),
      labels: { pid: process.pid.toString() }
    });

    metrics.push({
      name: 'process_cpu_system',
      type: MetricType.Counter,
      value: cpuUsage.system / 1000,
      unit: 'milliseconds',
      timestamp: Date.now(),
      labels: { pid: process.pid.toString() }
    });

    // 运行时间
    metrics.push({
      name: 'process_uptime',
      type: MetricType.Gauge,
      value: process.uptime(),
      unit: 'seconds',
      timestamp: Date.now(),
      labels: { pid: process.pid.toString() }
    });

    return metrics;
  }
}
```

##### APIMetricsCollector (API 指标采集)

```typescript
/**
 * API 指标采集器
 * 采集 REST API 请求相关指标
 */
export class APIMetricsCollector extends MetricCollector {
  name = 'api';
  description = 'API request metrics';
  interval = 10000; // 10 seconds

  private requestCounter = new Map<string, number>();
  private responseTimeHistogram = new Map<string, number[]>();
  private errorCounter = new Map<string, number>();

  protected async performCollect(): Promise<Metric[]> {
    const metrics: Metric[] = [];

    // 请求计数
    for (const [endpoint, count] of this.requestCounter) {
      metrics.push({
        name: 'api_requests_total',
        type: MetricType.Counter,
        value: count,
        timestamp: Date.now(),
        labels: { endpoint }
      });
    }

    // 响应时间统计
    for (const [endpoint, times] of this.responseTimeHistogram) {
      if (times.length === 0) continue;

      const sorted = times.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const avg = times.reduce((sum, t) => sum + t, 0) / times.length;

      metrics.push({
        name: 'api_response_time_avg',
        type: MetricType.Gauge,
        value: avg,
        unit: 'milliseconds',
        timestamp: Date.now(),
        labels: { endpoint }
      });

      metrics.push({
        name: 'api_response_time_p50',
        type: MetricType.Gauge,
        value: p50,
        unit: 'milliseconds',
        timestamp: Date.now(),
        labels: { endpoint }
      });

      metrics.push({
        name: 'api_response_time_p95',
        type: MetricType.Gauge,
        value: p95,
        unit: 'milliseconds',
        timestamp: Date.now(),
        labels: { endpoint }
      });

      metrics.push({
        name: 'api_response_time_p99',
        type: MetricType.Gauge,
        value: p99,
        unit: 'milliseconds',
        timestamp: Date.now(),
        labels: { endpoint }
      });
    }

    // 错误计数
    for (const [endpoint, count] of this.errorCounter) {
      metrics.push({
        name: 'api_errors_total',
        type: MetricType.Counter,
        value: count,
        timestamp: Date.now(),
        labels: { endpoint }
      });
    }

    // 清空缓存（用于下一次采集）
    this.responseTimeHistogram.clear();

    return metrics;
  }

  /**
   * 记录 API 请求（由 API 中间件调用）
   */
  recordRequest(endpoint: string, responseTime: number, error: boolean): void {
    // 更新请求计数
    this.requestCounter.set(endpoint, (this.requestCounter.get(endpoint) || 0) + 1);

    // 记录响应时间
    if (!this.responseTimeHistogram.has(endpoint)) {
      this.responseTimeHistogram.set(endpoint, []);
    }
    this.responseTimeHistogram.get(endpoint)!.push(responseTime);

    // 更新错误计数
    if (error) {
      this.errorCounter.set(endpoint, (this.errorCounter.get(endpoint) || 0) + 1);
    }
  }
}
```

##### WebSocketMetricsCollector (WebSocket 指标采集)

```typescript
/**
 * WebSocket 指标采集器
 * 采集 WebSocket 连接和消息相关指标
 */
export class WebSocketMetricsCollector extends MetricCollector {
  name = 'websocket';
  description = 'WebSocket connection metrics';
  interval = 5000; // 5 seconds

  private activeConnections = 0;
  private totalMessages = 0;
  private messageLatencies: number[] = [];

  protected async performCollect(): Promise<Metric[]> {
    const metrics: Metric[] = [];

    // 活跃连接数
    metrics.push({
      name: 'websocket_connections_active',
      type: MetricType.Gauge,
      value: this.activeConnections,
      timestamp: Date.now()
    });

    // 消息总数
    metrics.push({
      name: 'websocket_messages_total',
      type: MetricType.Counter,
      value: this.totalMessages,
      timestamp: Date.now()
    });

    // 消息延迟统计
    if (this.messageLatencies.length > 0) {
      const sorted = this.messageLatencies.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const avg = this.messageLatencies.reduce((sum, l) => sum + l, 0) / this.messageLatencies.length;

      metrics.push({
        name: 'websocket_latency_avg',
        type: MetricType.Gauge,
        value: avg,
        unit: 'milliseconds',
        timestamp: Date.now()
      });

      metrics.push({
        name: 'websocket_latency_p50',
        type: MetricType.Gauge,
        value: p50,
        unit: 'milliseconds',
        timestamp: Date.now()
      });

      metrics.push({
        name: 'websocket_latency_p95',
        type: MetricType.Gauge,
        value: p95,
        unit: 'milliseconds',
        timestamp: Date.now()
      });

      // 清空延迟缓存
      this.messageLatencies = [];
    }

    return metrics;
  }

  /**
   * 记录连接建立
   */
  recordConnection(): void {
    this.activeConnections++;
  }

  /**
   * 记录连接断开
   */
  recordDisconnection(): void {
    this.activeConnections--;
  }

  /**
   * 记录消息发送
   */
  recordMessage(latency: number): void {
    this.totalMessages++;
    this.messageLatencies.push(latency);
  }
}
```

##### BusinessMetricsCollector (业务指标采集)

```typescript
/**
 * 业务指标采集器
 * 采集 PRISM-Gateway 业务相关指标
 */
export class BusinessMetricsCollector extends MetricCollector {
  name = 'business';
  description = 'Business metrics';
  interval = 60000; // 60 seconds

  protected async performCollect(): Promise<Metric[]> {
    const metrics: Metric[] = [];

    // 读取违规记录统计
    const violations = await this.getViolationStats();
    metrics.push({
      name: 'business_violations_total',
      type: MetricType.Counter,
      value: violations.total,
      timestamp: Date.now()
    });

    metrics.push({
      name: 'business_violations_today',
      type: MetricType.Gauge,
      value: violations.today,
      timestamp: Date.now()
    });

    // 读取复盘统计
    const retros = await this.getRetroStats();
    metrics.push({
      name: 'business_retros_total',
      type: MetricType.Counter,
      value: retros.total,
      timestamp: Date.now()
    });

    metrics.push({
      name: 'business_retros_today',
      type: MetricType.Gauge,
      value: retros.today,
      timestamp: Date.now()
    });

    // Gateway 检查统计
    const checks = await this.getCheckStats();
    metrics.push({
      name: 'business_checks_total',
      type: MetricType.Counter,
      value: checks.total,
      timestamp: Date.now()
    });

    metrics.push({
      name: 'business_checks_today',
      type: MetricType.Gauge,
      value: checks.today,
      timestamp: Date.now()
    });

    return metrics;
  }

  private async getViolationStats(): Promise<{ total: number; today: number }> {
    // 读取 level-2-warm/violations.jsonl
    const violationsPath = path.join(process.env.HOME!, '.prism-gateway/level-2-warm/violations.jsonl');
    const lines = (await fs.readFile(violationsPath, 'utf-8')).split('\n').filter(l => l.trim());

    const today = new Date().toISOString().split('T')[0];
    const todayViolations = lines.filter(line => {
      try {
        const record = JSON.parse(line);
        return record.timestamp?.startsWith(today);
      } catch {
        return false;
      }
    });

    return {
      total: lines.length,
      today: todayViolations.length
    };
  }

  private async getRetroStats(): Promise<{ total: number; today: number }> {
    // 读取 level-2-warm/retros/
    const retrosPath = path.join(process.env.HOME!, '.prism-gateway/level-2-warm/retros');
    const files = await fs.readdir(retrosPath);

    const today = new Date().toISOString().split('T')[0];
    const todayRetros = files.filter(file => file.startsWith(today));

    return {
      total: files.length,
      today: todayRetros.length
    };
  }

  private async getCheckStats(): Promise<{ total: number; today: number }> {
    // 从 Analytics 服务获取检查统计
    // 这里简化实现，实际应调用 AnalyticsService
    return {
      total: 1000, // 示例值
      today: 50    // 示例值
    };
  }
}
```

##### DataMetricsCollector (数据指标采集)

```typescript
/**
 * 数据指标采集器
 * 采集数据文件大小、数据量等指标
 */
export class DataMetricsCollector extends MetricCollector {
  name = 'data';
  description = 'Data volume metrics';
  interval = 300000; // 5 minutes

  protected async performCollect(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    const dataRoot = path.join(process.env.HOME!, '.prism-gateway');

    // level-1-hot 数据大小
    const hotSize = await this.getDirectorySize(path.join(dataRoot, 'level-1-hot'));
    metrics.push({
      name: 'data_size_hot',
      type: MetricType.Gauge,
      value: hotSize,
      unit: 'bytes',
      timestamp: Date.now()
    });

    // level-2-warm 数据大小
    const warmSize = await this.getDirectorySize(path.join(dataRoot, 'level-2-warm'));
    metrics.push({
      name: 'data_size_warm',
      type: MetricType.Gauge,
      value: warmSize,
      unit: 'bytes',
      timestamp: Date.now()
    });

    // level-3-cold 数据大小
    const coldSize = await this.getDirectorySize(path.join(dataRoot, 'level-3-cold'));
    metrics.push({
      name: 'data_size_cold',
      type: MetricType.Gauge,
      value: coldSize,
      unit: 'bytes',
      timestamp: Date.now()
    });

    // 总数据大小
    metrics.push({
      name: 'data_size_total',
      type: MetricType.Gauge,
      value: hotSize + warmSize + coldSize,
      unit: 'bytes',
      timestamp: Date.now()
    });

    return metrics;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true, recursive: true });

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(dirPath, file.name);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.warn(`Failed to calculate directory size for ${dirPath}:`, error);
    }

    return totalSize;
  }
}
```

---

## 3. 数据模型

### 3.1 核心类型定义

```typescript
/**
 * 指标类型
 */
export enum MetricType {
  Counter = 'counter',       // 计数器（只增不减）
  Gauge = 'gauge',           // 仪表盘（可增可减）
  Histogram = 'histogram',   // 直方图（分布统计）
  Summary = 'summary'        // 摘要（统计摘要）
}

/**
 * 指标数据点
 */
export interface Metric {
  /** 指标名称 */
  name: string;

  /** 指标类型 */
  type: MetricType;

  /** 指标值 */
  value: number;

  /** 单位（可选） */
  unit?: string;

  /** 标签（可选） */
  labels?: Record<string, string>;

  /** 时间戳（毫秒） */
  timestamp: number;
}

/**
 * 指标快照
 */
export interface MetricSnapshot {
  /** 快照时间戳 */
  timestamp: number;

  /** 所有指标 */
  metrics: Metric[];
}

/**
 * 指标查询条件
 */
export interface MetricQuery {
  /** 指标名称 */
  metricName: string;

  /** 开始时间 */
  startTime: number;

  /** 结束时间 */
  endTime: number;

  /** 标签过滤（可选） */
  labels?: Record<string, string>;

  /** 聚合函数（可选） */
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'p50' | 'p95' | 'p99';

  /** 时间分组（可选，单位：毫秒） */
  groupBy?: number;
}

/**
 * 指标查询结果
 */
export interface MetricQueryResult {
  /** 指标名称 */
  metricName: string;

  /** 数据点 */
  points: MetricDataPoint[];

  /** 元数据 */
  metadata: {
    startTime: number;
    endTime: number;
    count: number;
  };
}

/**
 * 指标数据点（查询结果）
 */
export interface MetricDataPoint {
  /** 时间戳 */
  timestamp: number;

  /** 值 */
  value: number;

  /** 标签（如果有） */
  labels?: Record<string, string>;
}

/**
 * 指标统计
 */
export interface MetricStats {
  /** 总数 */
  count: number;

  /** 总和 */
  sum: number;

  /** 平均值 */
  avg: number;

  /** 最小值 */
  min: number;

  /** 最大值 */
  max: number;

  /** P50 */
  p50: number;

  /** P95 */
  p95: number;

  /** P99 */
  p99: number;
}

/**
 * 时间范围
 */
export interface TimeRange {
  /** 开始时间 */
  start: number;

  /** 结束时间 */
  end: number;
}
```

---

## 4. 存储设计

### 4.1 多级时序存储

```typescript
/**
 * 时序数据存储策略:
 *
 * ~/.prism-gateway/metrics/
 * ├── raw/           # 原始数据（1秒粒度）
 * │   ├── 2026-02-07-12.jsonl   # 按小时分文件
 * │   ├── 2026-02-07-13.jsonl
 * │   └── ...
 * ├── 1m/            # 1分钟聚合数据
 * │   ├── 2026-02-07.jsonl      # 按天分文件
 * │   └── ...
 * ├── 5m/            # 5分钟聚合数据
 * │   ├── 2026-02-07.jsonl
 * │   └── ...
 * ├── 1h/            # 1小时聚合数据
 * │   ├── 2026-02.jsonl         # 按月分文件
 * │   └── ...
 * └── manifest.json  # 指标元数据索引
 */

// raw/ 文件格式（JSONL，每行一个快照）
{"timestamp":1707312000000,"metrics":[{"name":"system_cpu_usage","type":"gauge","value":23.5,"unit":"percent","timestamp":1707312000000},...]}
{"timestamp":1707312001000,"metrics":[{"name":"system_cpu_usage","type":"gauge","value":24.1,"unit":"percent","timestamp":1707312001000},...]}

// 1m/ 文件格式（聚合后数据）
{"timestamp":1707312060000,"metricName":"system_cpu_usage","stats":{"count":60,"sum":1420,"avg":23.67,"min":20.1,"max":28.9,"p50":23.5,"p95":27.8,"p99":28.5}}

// manifest.json 格式
{
  "metrics": [
    {
      "name": "system_cpu_usage",
      "type": "gauge",
      "unit": "percent",
      "description": "System CPU usage percentage",
      "firstSeen": 1707312000000,
      "lastSeen": 1707398400000
    },
    // ... 其他指标
  ],
  "retention": {
    "raw": "1h",
    "1m": "24h",
    "5m": "7d",
    "1h": "30d"
  },
  "lastCleanup": 1707398400000
}
```

### 4.2 MetricsStorage 实现

```typescript
/**
 * 指标存储引擎
 */
export class MetricsStorage {
  private metricsRoot: string;
  private manifest: MetricsManifest;

  /**
   * 保存指标快照
   * @param snapshot 快照数据
   */
  async saveSnapshot(snapshot: MetricSnapshot): Promise<void> {
    const timestamp = snapshot.timestamp;
    const date = new Date(timestamp);

    // 保存到 raw/ 目录（按小时分文件）
    const rawFileName = `${date.toISOString().slice(0, 13)}.jsonl`;
    const rawFilePath = path.join(this.metricsRoot, 'raw', rawFileName);

    // 追加写入（JSONL 格式）
    await fs.appendFile(rawFilePath, JSON.stringify(snapshot) + '\n');

    // 更新 manifest
    this.updateManifest(snapshot.metrics);
  }

  /**
   * 查询指标数据
   * @param query 查询条件
   * @returns 查询结果
   */
  async query(query: MetricQuery): Promise<MetricQueryResult> {
    const { metricName, startTime, endTime, labels, aggregation, groupBy } = query;

    // 确定查询哪个存储级别（raw, 1m, 5m, 1h）
    const storageLevel = this.selectStorageLevel(startTime, endTime, groupBy);

    // 读取文件
    const files = await this.getFilesForTimeRange(storageLevel, startTime, endTime);
    const dataPoints: MetricDataPoint[] = [];

    for (const file of files) {
      const lines = (await fs.readFile(file, 'utf-8')).split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const snapshot = JSON.parse(line) as MetricSnapshot;

          // 过滤时间范围
          if (snapshot.timestamp < startTime || snapshot.timestamp > endTime) {
            continue;
          }

          // 查找匹配的指标
          for (const metric of snapshot.metrics) {
            if (metric.name !== metricName) continue;

            // 标签过滤
            if (labels && !this.matchLabels(metric.labels, labels)) {
              continue;
            }

            dataPoints.push({
              timestamp: metric.timestamp,
              value: metric.value,
              labels: metric.labels
            });
          }
        } catch (error) {
          logger.warn('Failed to parse metric line:', error);
        }
      }
    }

    // 应用聚合
    let finalPoints = dataPoints;
    if (groupBy) {
      finalPoints = this.groupByTime(dataPoints, groupBy, aggregation);
    }

    return {
      metricName,
      points: finalPoints,
      metadata: {
        startTime,
        endTime,
        count: finalPoints.length
      }
    };
  }

  /**
   * 选择存储级别
   */
  private selectStorageLevel(startTime: number, endTime: number, groupBy?: number): 'raw' | '1m' | '5m' | '1h' {
    const duration = endTime - startTime;

    // 如果查询时间范围 ≤ 1小时，使用原始数据
    if (duration <= 3600000) {
      return 'raw';
    }

    // 如果查询时间范围 ≤ 24小时，使用 1分钟聚合
    if (duration <= 86400000) {
      return '1m';
    }

    // 如果查询时间范围 ≤ 7天，使用 5分钟聚合
    if (duration <= 604800000) {
      return '5m';
    }

    // 否则使用 1小时聚合
    return '1h';
  }

  /**
   * 按时间分组
   */
  private groupByTime(
    points: MetricDataPoint[],
    groupBy: number,
    aggregation?: string
  ): MetricDataPoint[] {
    const groups = new Map<number, number[]>();

    // 按时间窗口分组
    for (const point of points) {
      const bucketTime = Math.floor(point.timestamp / groupBy) * groupBy;
      if (!groups.has(bucketTime)) {
        groups.set(bucketTime, []);
      }
      groups.get(bucketTime)!.push(point.value);
    }

    // 聚合计算
    const result: MetricDataPoint[] = [];
    for (const [timestamp, values] of groups) {
      let aggregatedValue: number;

      switch (aggregation) {
        case 'sum':
          aggregatedValue = values.reduce((sum, v) => sum + v, 0);
          break;
        case 'avg':
          aggregatedValue = values.reduce((sum, v) => sum + v, 0) / values.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'p50':
          aggregatedValue = this.percentile(values, 0.5);
          break;
        case 'p95':
          aggregatedValue = this.percentile(values, 0.95);
          break;
        case 'p99':
          aggregatedValue = this.percentile(values, 0.99);
          break;
        default:
          aggregatedValue = values[values.length - 1]; // 最后一个值
      }

      result.push({ timestamp, value: aggregatedValue });
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 计算百分位数
   */
  private percentile(values: number[], p: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p);
    return sorted[index];
  }
}
```

### 4.3 MetricsAggregator 实现

```typescript
/**
 * 指标聚合器
 * 负责定时将原始数据聚合为不同粒度
 */
export class MetricsAggregator {
  private storage: MetricsStorage;
  private timers: NodeJS.Timeout[] = [];

  /**
   * 启动聚合任务
   */
  async start(): Promise<void> {
    // 每分钟聚合一次（生成 1m/ 数据）
    this.timers.push(setInterval(() => {
      this.aggregate1m();
    }, 60000));

    // 每5分钟聚合一次（生成 5m/ 数据）
    this.timers.push(setInterval(() => {
      this.aggregate5m();
    }, 300000));

    // 每小时聚合一次（生成 1h/ 数据）
    this.timers.push(setInterval(() => {
      this.aggregate1h();
    }, 3600000));

    // 每小时清理过期数据
    this.timers.push(setInterval(() => {
      this.cleanup();
    }, 3600000));
  }

  /**
   * 停止聚合任务
   */
  async stop(): Promise<void> {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];
  }

  /**
   * 1分钟聚合
   */
  private async aggregate1m(): Promise<void> {
    // 读取过去1分钟的原始数据
    const now = Date.now();
    const startTime = now - 60000;

    // 按指标名称分组聚合
    // ... 实现省略
  }

  /**
   * 5分钟聚合
   */
  private async aggregate5m(): Promise<void> {
    // 类似 aggregate1m
  }

  /**
   * 1小时聚合
   */
  private async aggregate1h(): Promise<void> {
    // 类似 aggregate1m
  }

  /**
   * 清理过期数据
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();

    // 删除 1小时前的 raw/ 数据
    await this.cleanupLevel('raw', now - 3600000);

    // 删除 24小时前的 1m/ 数据
    await this.cleanupLevel('1m', now - 86400000);

    // 删除 7天前的 5m/ 数据
    await this.cleanupLevel('5m', now - 604800000);

    // 删除 30天前的 1h/ 数据
    await this.cleanupLevel('1h', now - 2592000000);
  }

  private async cleanupLevel(level: string, cutoffTime: number): Promise<void> {
    // 删除指定时间之前的文件
    // ... 实现省略
  }
}
```

---

## 5. CLI 命令设计

```bash
# 查看实时指标
prism metrics
# Output:
# 📊 System Metrics (real-time):
#
# System:
#   CPU Usage:     23.5%
#   Memory Usage:  45.2% (7.2 GB / 16 GB)
#   Load Average:  1.23 (1m), 1.45 (5m), 1.67 (15m)
#
# Process:
#   Memory RSS:    45.3 MB
#   Heap Used:     28.7 MB / 42.1 MB
#   Uptime:        3h 24m 15s
#
# API:
#   Requests/min:  127
#   Avg Latency:   89ms
#   Error Rate:    0.2%
#
# WebSocket:
#   Connections:   5
#   Messages/min:  342
#   Latency (p95): 23ms
#
# Business:
#   Checks Today:  50
#   Violations:    3
#   Retros:        1

# 查询特定指标
prism metrics query system_cpu_usage --from "1h ago" --to now
# Output:
# Metric: system_cpu_usage
# Period: 2026-02-07 11:00 - 2026-02-07 12:00
#
# Time                Value
# ──────────────────────────
# 11:00:00           23.5%
# 11:01:00           24.1%
# 11:02:00           22.8%
# ...
#
# Stats:
#   Min:  20.1%
#   Max:  28.9%
#   Avg:  23.67%
#   P50:  23.5%
#   P95:  27.8%

# 查询聚合数据
prism metrics query api_requests_total --from "24h ago" --to now --group-by 1h --agg sum
# Output:
# Metric: api_requests_total (sum per hour)
# Period: 2026-02-06 12:00 - 2026-02-07 12:00
#
# Time                Total Requests
# ──────────────────────────────────
# 2026-02-06 12:00    7,234
# 2026-02-06 13:00    8,567
# 2026-02-06 14:00    9,123
# ...
#
# Total: 189,456 requests

# 导出指标数据
prism metrics export --metric system_cpu_usage --from "7d ago" --to now --format csv > cpu_usage_7d.csv
# Output:
# ✅ Exported 10,080 data points to cpu_usage_7d.csv

# 列出所有指标
prism metrics list
# Output:
# Available Metrics:
#
# System Metrics:
#   • system_cpu_usage          CPU usage percentage
#   • system_memory_total       Total system memory
#   • system_memory_used        Used system memory
#   • system_load_1m            1-minute load average
#   • system_load_5m            5-minute load average
#   • system_load_15m           15-minute load average
#
# Process Metrics:
#   • process_memory_rss        Resident set size
#   • process_memory_heap_used  Heap memory used
#   • process_cpu_user          User CPU time
#   • process_uptime            Process uptime
#
# API Metrics:
#   • api_requests_total        Total API requests
#   • api_response_time_avg     Average response time
#   • api_response_time_p95     95th percentile response time
#   • api_errors_total          Total API errors
#
# WebSocket Metrics:
#   • websocket_connections_active  Active connections
#   • websocket_messages_total      Total messages sent
#   • websocket_latency_avg         Average message latency
#
# Business Metrics:
#   • business_checks_total     Total Gateway checks
#   • business_violations_total Total violations
#   • business_retros_total     Total retrospectives
#
# Data Metrics:
#   • data_size_hot             Hot data size
#   • data_size_warm            Warm data size
#   • data_size_cold            Cold data size
#
# Total: 28 metrics
```

---

## 6. API 接口设计

```typescript
// GET /api/v1/metrics
// 获取实时指标快照
router.get('/metrics', async (c) => {
  const snapshot = await metricsService.getCurrentSnapshot();
  return c.json(snapshot);
});

// GET /api/v1/metrics/query
// 查询指标数据
router.get('/metrics/query', async (c) => {
  const query = {
    metricName: c.req.query('metric')!,
    startTime: parseInt(c.req.query('start')!),
    endTime: parseInt(c.req.query('end')!),
    aggregation: c.req.query('agg') as any,
    groupBy: c.req.query('groupBy') ? parseInt(c.req.query('groupBy')!) : undefined
  };

  const result = await metricsService.query(query);
  return c.json(result);
});

// GET /api/v1/metrics/list
// 列出所有指标
router.get('/metrics/list', async (c) => {
  const metrics = await metricsService.listMetrics();
  return c.json({ metrics });
});

// GET /api/v1/metrics/stats
// 获取指标统计
router.get('/metrics/stats', async (c) => {
  const metricName = c.req.query('metric')!;
  const startTime = parseInt(c.req.query('start')!);
  const endTime = parseInt(c.req.query('end')!);

  const stats = await metricsService.getStats(metricName, { start: startTime, end: endTime });
  return c.json(stats);
});
```

---

## 7. 实现计划

### 7.1 任务分解 (8 小时)

| 任务 | 工时 | 优先级 | 依赖 |
|------|------|--------|------|
| **1. 数据模型定义** | 0.5h | P0 | 无 |
| **2. MetricCollector 基类** | 0.5h | P0 | 1 |
| **3. MetricsStorage 实现** | 1.5h | P0 | 1 |
| **4. MetricsAggregator 实现** | 1h | P0 | 3 |
| **5. MetricsService 实现** | 1h | P0 | 2, 3, 4 |
| **6. 内置采集器实现** | 2h | P0 | 2 |
| **7. MetricsScheduler 实现** | 0.5h | P1 | 5 |
| **8. CLI 命令实现** | 0.5h | P1 | 5 |
| **9. API 端点实现** | 0.5h | P2 | 5 |
| **10. 单元测试** | 1h | P0 | 2-9 |

### 7.2 验收检查清单

- [ ] 所有内置采集器正常工作
- [ ] 指标数据正确存储和聚合
- [ ] 查询引擎性能达标 (<100ms)
- [ ] 多级存储正常运作
- [ ] CLI 命令全部可用
- [ ] API 端点全部可用
- [ ] 单元测试覆盖率 >90%
- [ ] 集成测试通过
- [ ] 性能开销 <1% CPU, <30MB 内存
- [ ] 文档完整清晰

---

## 8. 参考文档

- [Prometheus Data Model](https://prometheus.io/docs/concepts/data_model/)
- [OpenTelemetry Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)
- [InfluxDB Storage Engine](https://docs.influxdata.com/influxdb/v2.7/reference/internals/storage-engine/)
- [Grafana Time Series Database](https://grafana.com/docs/grafana/latest/fundamentals/timeseries/)

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-07
**作者**: AI Assistant (Claude Sonnet 4.5)
**审核人**: PRISM-Gateway Team
**下一步**: Task 3.4 告警系统设计
