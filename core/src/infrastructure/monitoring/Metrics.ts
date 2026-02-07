/**
 * Metrics - 指标收集模块
 *
 * @description
 * 轻量级指标收集系统，提供：
 * - Counter（计数器）：单调递增的计数
 * - Histogram（直方图）：数值分布统计
 * - Gauge（仪表）：可增减的当前值
 * - HTTP 请求指标
 * - 缓存指标
 * - 速率限制指标
 *
 * @features
 * - 内存存储，零外部依赖
 * - 百分位数计算（P50/P95/P99）
 * - 标签支持
 * - Prometheus 格式导出
 *
 * @example
 * ```ts
 * import { Metrics } from './Metrics.js';
 *
 * const metrics = new Metrics({ prefix: 'prism' });
 *
 * // 记录 HTTP 请求
 * metrics.recordHttpRequest({
 *   method: 'GET',
 *   path: '/api/v1/analytics',
 *   status: 200,
 *   duration: 50
 * });
 *
 * // 记录缓存命中
 * metrics.recordCacheHit('analytics');
 *
 * // 获取指标
 * const requests = metrics.getCounter('http_requests_total');
 * console.log(`总请求数: ${requests.value}`);
 *
 * // 导出 Prometheus 格式
 * console.log(metrics.toPrometheus());
 * ```
 *
 * @module infrastructure/monitoring
 */

/**
 * 指标类型枚举
 */
export enum MetricType {
  COUNTER = 'counter',
  HISTOGRAM = 'histogram',
  GAUGE = 'gauge'
}

/**
 * HTTP 请求记录
 */
export interface HttpRequestMetric {
  /** HTTP 方法 */
  method: string;
  /** 请求路径 */
  path: string;
  /** 响应状态码 */
  status: number;
  /** 请求持续时间（毫秒） */
  duration: number;
  /** 用户 ID（可选） */
  userId?: string;
}

/**
 * 指标标签
 */
export interface MetricLabels {
  [key: string]: string | number | boolean;
}

/**
 * 百分位数结果
 */
export interface PercentileResult {
  /** P50 值 */
  p50: number;
  /** P95 值 */
  p95: number;
  /** P99 值 */
  p99: number;
}

/**
 * 直方图桶配置
 */
const HISTOGRAM_BUCKETS = [
  1, 5, 10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 2000, 5000
];

/**
 * 计算百分位数
 *
 * @param values - 排序后的数值数组
 * @param percentile - 百分位数（0-100）
 * @returns 计算得到的百分位数值
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const index = (percentile / 100) * (values.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= values.length) {
    return values[values.length - 1];
  }

  return values[lower] * (1 - weight) + values[upper] * weight;
}

/**
 * CounterMetric - 计数器指标
 *
 * @description
 * 单调递增的计数器，用于记录事件发生的次数
 */
export class CounterMetric {
  private _value: number = 0;
  private readonly _labelledValues: Map<string, number> = new Map();

  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly labels: string[] = []
  ) {}

  /** 当前值 */
  get value(): number {
    return this._value;
  }

  /**
   * 增加计数
   *
   * @param delta - 增加量（默认 1）
   * @param tags - 标签
   */
  inc(delta: number = 1, tags?: MetricLabels): void {
    this._value += delta;

    if (tags && this.labels.length > 0) {
      const key = this.serializeLabels(tags);
      const current = this._labelledValues.get(key) ?? 0;
      this._labelledValues.set(key, current + delta);
    }
  }

  /**
   * 重置计数器
   */
  reset(): void {
    this._value = 0;
    this._labelledValues.clear();
  }

  /**
   * 获取带标签的值
   *
   * @param tags - 标签
   * @returns 该标签组合的值
   */
  getLabelledValue(tags: MetricLabels): number {
    const key = this.serializeLabels(tags);
    return this._labelledValues.get(key) ?? 0;
  }

  /**
   * 序列化标签为字符串键
   */
  private serializeLabels(tags: MetricLabels): string {
    const pairs = this.labels
      .map((label) => `${label}="${tags[label] ?? ''}"`)
      .sort()
      .join(',');
    return pairs;
  }

  /**
   * 导出为对象
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      name: this.name,
      help: this.help,
      type: MetricType.COUNTER,
      value: this._value
    };

    if (this._labelledValues.size > 0) {
      result.labelledValues = Object.fromEntries(this._labelledValues);
    }

    return result;
  }
}

/**
 * HistogramMetric - 直方图指标
 *
 * @description
 * 记录数值分布，支持百分位数计算
 */
export class HistogramMetric {
  private _values: number[] = [];
  private _count: number = 0;
  private _sum: number = 0;
  private readonly _labelledValues: Map<string, number[]> = new Map();
  private readonly _buckets = [...HISTOGRAM_BUCKETS];

  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly labels: string[] = [],
    customBuckets?: number[]
  ) {
    if (customBuckets) {
      this._buckets = customBuckets.sort((a, b) => a - b);
    }
  }

  /** 观测次数 */
  get count(): number {
    return this._count;
  }

  /** 所有观测值的总和 */
  get sum(): number {
    return this._sum;
  }

  /** 最小值 */
  get min(): number {
    if (this._values.length === 0) return 0;
    return this._values[0]!;
  }

  /** 最大值 */
  get max(): number {
    if (this._values.length === 0) return 0;
    return this._values[this._values.length - 1]!;
  }

  /** 平均值 */
  get average(): number {
    if (this._count === 0) return 0;
    return this._sum / this._count;
  }

  /** 所有观测值（已排序） */
  get values(): number[] {
    return [...this._values];
  }

  /**
   * 记录观测值
   *
   * @param value - 观测到的数值
   * @param tags - 标签
   */
  observe(value: number, tags?: MetricLabels): void {
    // 插入排序保持数组有序
    let inserted = false;
    for (let i = 0; i < this._values.length; i++) {
      if (this._values[i]! > value) {
        this._values.splice(i, 0, value);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this._values.push(value);
    }

    this._count++;
    this._sum += value;

    // 如果内存占用过大，保留最近 1000 个值
    if (this._values.length > 1000) {
      this._values.shift();
    }

    // 处理带标签的数据（也存储到特定标签中）
    if (tags && this.labels.length > 0) {
      const key = this.serializeLabels(tags);
      if (!this._labelledValues.has(key)) {
        this._labelledValues.set(key, []);
      }
      const labelledValues = this._labelledValues.get(key)!;
      labelledValues.push(value);

      // 限制标签值数组大小
      if (labelledValues.length > 1000) {
        labelledValues.shift();
      }
    }
  }

  /**
   * 计算百分位数
   *
   * @param percentile - 百分位数（0-100）
   * @param tags - 可选标签，如果提供则只计算该标签组合的百分位数值
   * @returns 计算得到的百分位数值
   */
  percentile(percentile: number, tags?: MetricLabels): number {
    if (tags && this.labels.length > 0) {
      const key = this.serializeLabels(tags);
      const labelledValues = this._labelledValues.get(key);
      if (labelledValues && labelledValues.length > 0) {
        // 排序标签值
        const sorted = [...labelledValues].sort((a, b) => a - b);
        return calculatePercentile(sorted, percentile);
      }
      return 0;
    }
    return calculatePercentile(this._values, percentile);
  }

  /**
   * 获取所有常用百分位数
   *
   * @param tags - 可选标签
   * @returns P50、P95、P99
   */
  percentiles(tags?: MetricLabels): PercentileResult {
    return {
      p50: this.percentile(50, tags),
      p95: this.percentile(95, tags),
      p99: this.percentile(99, tags)
    };
  }

  /**
   * 重置直方图
   */
  reset(): void {
    this._values = [];
    this._count = 0;
    this._sum = 0;
    this._labelledValues.clear();
  }

  /**
   * 序列化标签为字符串键
   */
  private serializeLabels(tags: MetricLabels): string {
    const pairs = this.labels
      .map((label) => `${label}="${tags[label] ?? ''}"`)
      .sort()
      .join(',');
    return pairs;
  }

  /**
   * 导出为对象
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      help: this.help,
      type: MetricType.HISTOGRAM,
      count: this._count,
      sum: this._sum,
      min: this.min,
      max: this.max,
      average: this.average,
      percentiles: this.percentiles()
    };
  }
}

/**
 * GaugeMetric - 仪表指标
 *
 * @description
 * 可以增减的当前值，用于记录瞬时状态
 */
export class GaugeMetric {
  private _value: number = 0;
  private readonly _labelledValues: Map<string, number> = new Map();

  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly labels: string[] = []
  ) {}

  /** 当前值 */
  get value(): number {
    return this._value;
  }

  /**
   * 设置值
   *
   * @param value - 新值
   * @param tags - 标签
   */
  set(value: number, tags?: MetricLabels): void {
    if (tags && this.labels.length > 0) {
      const key = this.serializeLabels(tags);
      this._labelledValues.set(key, value);
    } else {
      this._value = value;
    }
  }

  /**
   * 增加值
   *
   * @param delta - 增加量（默认 1）
   * @param tags - 标签
   */
  inc(delta: number = 1, tags?: MetricLabels): void {
    if (tags && this.labels.length > 0) {
      const key = this.serializeLabels(tags);
      const current = this._labelledValues.get(key) ?? 0;
      this._labelledValues.set(key, current + delta);
    } else {
      this._value += delta;
    }
  }

  /**
   * 减少值
   *
   * @param delta - 减少量（默认 1）
   * @param tags - 标签
   */
  dec(delta: number = 1, tags?: MetricLabels): void {
    if (tags && this.labels.length > 0) {
      const key = this.serializeLabels(tags);
      const current = this._labelledValues.get(key) ?? 0;
      this._labelledValues.set(key, current - delta);
    } else {
      this._value -= delta;
    }
  }

  /**
   * 序列化标签为字符串键
   */
  private serializeLabels(tags: MetricLabels): string {
    const pairs = this.labels
      .map((label) => `${label}="${tags[label] ?? ''}"`)
      .sort()
      .join(',');
    return pairs;
  }

  /**
   * 导出为对象
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      help: this.help,
      type: MetricType.GAUGE,
      value: this._value
    };
  }
}

/**
 * Metrics - 指标收集器
 *
 * @description
 * 主要的指标收集器类，管理所有指标
 */
export class Metrics {
  /** 指标前缀 */
  readonly prefix: string;
  /** 是否启用指标收集 */
  readonly enabled: boolean;
  /** 时间窗口大小（毫秒） */
  readonly windowSize: number;

  private readonly counters: Map<string, CounterMetric> = new Map();
  private readonly histograms: Map<string, HistogramMetric> = new Map();
  private readonly gauges: Map<string, GaugeMetric> = new Map();
  private readonly cacheStats: Map<string, { hits: number; misses: number }> = new Map();

  private createdAt: number = Date.now();

  /**
   * 创建指标收集器实例
   *
   * @param options - 配置选项
   */
  constructor(options: {
    /** 指标前缀 */
    prefix?: string;
    /** 是否启用 */
    enabled?: boolean;
    /** 时间窗口大小（毫秒） */
    windowSize?: number;
  } = {}) {
    this.prefix = options.prefix ?? 'prism';
    this.enabled = options.enabled ?? true;
    this.windowSize = options.windowSize ?? 60000; // 默认 1 分钟

    // 初始化默认指标
    this.initializeDefaultMetrics();
  }

  /**
   * 初始化默认指标
   */
  private initializeDefaultMetrics(): void {
    // HTTP 请求指标
    this.createCounter('http_requests_total', 'Total HTTP requests', ['method', 'status']);
    this.createCounter('http_errors_total', 'Total HTTP errors', ['status']);
    this.createHistogram('http_request_duration_ms', 'HTTP request duration in milliseconds', ['path']);
    this.createGauge('http_requests_in_progress', 'HTTP requests currently in progress');

    // 缓存指标
    this.createCounter('cache_hits_total', 'Total cache hits', ['cache']);
    this.createCounter('cache_misses_total', 'Total cache misses', ['cache']);

    // 速率限制指标
    this.createCounter('rate_limit_exceeded_total', 'Total rate limit exceeded', ['endpoint']);

    // 系统指标
    this.createGauge('memory_usage_bytes', 'Memory usage in bytes');
    this.createGauge('active_connections', 'Active connections');
  }

  /**
   * 创建计数器
   *
   * @param name - 指标名称
   * @param help - 指标描述
   * @param labels - 标签名称列表
   * @returns CounterMetric 实例
   */
  createCounter(name: string, help: string, labels: string[] = []): CounterMetric {
    const fullName = `${this.prefix}_${name}`;
    const counter = new CounterMetric(fullName, help, labels);
    this.counters.set(fullName, counter);
    return counter;
  }

  /**
   * 创建直方图
   *
   * @param name - 指标名称
   * @param help - 指标描述
   * @param labels - 标签名称列表
   * @param buckets - 自定义桶边界
   * @returns HistogramMetric 实例
   */
  createHistogram(
    name: string,
    help: string,
    labels: string[] = [],
    buckets?: number[]
  ): HistogramMetric {
    const fullName = `${this.prefix}_${name}`;
    const histogram = new HistogramMetric(fullName, help, labels, buckets);
    this.histograms.set(fullName, histogram);
    return histogram;
  }

  /**
   * 创建仪表
   *
   * @param name - 指标名称
   * @param help - 指标描述
   * @param labels - 标签名称列表
   * @returns GaugeMetric 实例
   */
  createGauge(name: string, help: string, labels: string[] = []): GaugeMetric {
    const fullName = `${this.prefix}_${name}`;
    const gauge = new GaugeMetric(fullName, help, labels);
    this.gauges.set(fullName, gauge);
    return gauge;
  }

  /**
   * 获取计数器
   *
   * @param name - 指标名称
   * @returns CounterMetric 实例或 undefined
   */
  getCounter(name: string): CounterMetric | undefined {
    const fullName = name.startsWith(this.prefix) ? name : `${this.prefix}_${name}`;
    return this.counters.get(fullName);
  }

  /**
   * 获取直方图
   *
   * @param name - 指标名称
   * @returns HistogramMetric 实例或 undefined
   */
  getHistogram(name: string): HistogramMetric | undefined {
    const fullName = name.startsWith(this.prefix) ? name : `${this.prefix}_${name}`;
    return this.histograms.get(fullName);
  }

  /**
   * 获取仪表
   *
   * @param name - 指标名称
   * @returns GaugeMetric 实例或 undefined
   */
  getGauge(name: string): GaugeMetric | undefined {
    const fullName = name.startsWith(this.prefix) ? name : `${this.prefix}_${name}`;
    return this.gauges.get(fullName);
  }

  /**
   * 记录 HTTP 请求
   *
   * @param metric - HTTP 请求指标
   */
  recordHttpRequest(metric: HttpRequestMetric): void {
    if (!this.enabled) return;

    // 总请求计数
    const totalRequests = this.getCounter('http_requests_total');
    totalRequests?.inc(1, { method: metric.method, status: metric.status.toString() });

    // 错误计数
    if (metric.status >= 400) {
      const errors = this.getCounter('http_errors_total');
      errors?.inc(1, { status: metric.status.toString() });
    }

    // 响应时间
    const duration = this.getHistogram('http_request_duration_ms');
    duration?.observe(metric.duration, { path: metric.path });
  }

  /**
   * 记录缓存命中
   *
   * @param cacheName - 缓存名称
   */
  recordCacheHit(cacheName: string): void {
    if (!this.enabled) return;

    const hits = this.getCounter('cache_hits_total');
    hits?.inc(1, { cache: cacheName });

    // 更新缓存统计
    if (!this.cacheStats.has(cacheName)) {
      this.cacheStats.set(cacheName, { hits: 0, misses: 0 });
    }
    const stats = this.cacheStats.get(cacheName)!;
    stats.hits++;
  }

  /**
   * 记录缓存未命中
   *
   * @param cacheName - 缓存名称
   */
  recordCacheMiss(cacheName: string): void {
    if (!this.enabled) return;

    const misses = this.getCounter('cache_misses_total');
    misses?.inc(1, { cache: cacheName });

    // 更新缓存统计
    if (!this.cacheStats.has(cacheName)) {
      this.cacheStats.set(cacheName, { hits: 0, misses: 0 });
    }
    const stats = this.cacheStats.get(cacheName)!;
    stats.misses++;
  }

  /**
   * 获取缓存命中率
   *
   * @param cacheName - 缓存名称
   * @returns 命中率（0-1）
   */
  getCacheHitRate(cacheName: string): number {
    const stats = this.cacheStats.get(cacheName);
    if (!stats || stats.hits + stats.misses === 0) {
      return 0;
    }
    return stats.hits / (stats.hits + stats.misses);
  }

  /**
   * 记录速率限制触发
   *
   * @param endpoint - 端点名称
   * @param clientIp - 客户端 IP
   */
  recordRateLimitExceeded(endpoint: string, clientIp: string): void {
    if (!this.enabled) return;

    const rateLimits = this.getCounter('rate_limit_exceeded_total');
    rateLimits?.inc(1, { endpoint });
  }

  /**
   * 更新内存使用量
   */
  updateMemoryUsage(): void {
    if (!this.enabled) return;

    const memory = this.getGauge('memory_usage_bytes');
    if (memory) {
      const usage = process.memoryUsage();
      memory.set(usage.heapUsed);
    }
  }

  /**
   * 获取所有指标
   *
   * @returns 所有指标的 Map
   */
  export(): Map<string, CounterMetric | HistogramMetric | GaugeMetric> {
    const all = new Map<string, CounterMetric | HistogramMetric | GaugeMetric>();

    for (const [name, counter] of this.counters) {
      all.set(name, counter);
    }
    for (const [name, histogram] of this.histograms) {
      all.set(name, histogram);
    }
    for (const [name, gauge] of this.gauges) {
      all.set(name, gauge);
    }

    return all;
  }

  /**
   * 导出为 JSON 格式
   *
   * @returns JSON 对象
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      prefix: this.prefix,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.createdAt,
      counters: {},
      histograms: {},
      gauges: {},
      cacheStats: Object.fromEntries(this.cacheStats)
    };

    for (const [name, counter] of this.counters) {
      (result.counters as Record<string, unknown>)[name] = counter.toJSON();
    }

    for (const [name, histogram] of this.histograms) {
      (result.histograms as Record<string, unknown>)[name] = histogram.toJSON();
    }

    for (const [name, gauge] of this.gauges) {
      (result.gauges as Record<string, unknown>)[name] = gauge.toJSON();
    }

    return result;
  }

  /**
   * 导出为 Prometheus 格式
   *
   * @returns Prometheus 格式的字符串
   */
  toPrometheus(): string {
    const lines: string[] = [];

    // 输出计数器
    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} ${MetricType.COUNTER}`);
      lines.push(`${counter.name} ${counter.value}`);
      lines.push('');
    }

    // 输出直方图
    for (const histogram of this.histograms.values()) {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`);
      lines.push(`# TYPE ${histogram.name} ${MetricType.HISTOGRAM}`);
      lines.push(`${histogram.name}_count ${histogram.count}`);
      lines.push(`${histogram.name}_sum ${histogram.sum}`);
      const ps = histogram.percentiles();
      lines.push(`${histogram.name}_p50 ${ps.p50}`);
      lines.push(`${histogram.name}_p95 ${ps.p95}`);
      lines.push(`${histogram.name}_p99 ${ps.p99}`);
      lines.push('');
    }

    // 输出仪表
    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} ${MetricType.GAUGE}`);
      lines.push(`${gauge.name} ${gauge.value}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 获取时间窗口内的指标
   *
   * @returns 窗口内的指标
   */
  getMetricsInWindow(): Map<string, CounterMetric | HistogramMetric | GaugeMetric> {
    // 简化实现：返回所有指标
    // 完整实现应该基于 createdAt 和 windowSize 过滤
    return this.export();
  }

  /**
   * 按类型获取指标
   *
   * @param type - 指标类型
   * @returns 指标数组
   */
  getMetricsByType(type: MetricType): Array<CounterMetric | HistogramMetric | GaugeMetric> {
    const result: Array<CounterMetric | HistogramMetric | GaugeMetric> = [];

    switch (type) {
      case MetricType.COUNTER:
        result.push(...this.counters.values());
        break;
      case MetricType.HISTOGRAM:
        result.push(...this.histograms.values());
        break;
      case MetricType.GAUGE:
        result.push(...this.gauges.values());
        break;
    }

    return result;
  }

  /**
   * 模糊搜索指标
   *
   * @param pattern - 搜索模式
   * @returns 匹配的指标
   */
  findMetrics(pattern: string): Array<CounterMetric | HistogramMetric | GaugeMetric> {
    const result: Array<CounterMetric | HistogramMetric | GaugeMetric> = [];
    const regex = new RegExp(pattern, 'i');

    for (const metric of this.export().values()) {
      if (regex.test(metric.name)) {
        result.push(metric);
      }
    }

    return result;
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.cacheStats.clear();
    this.createdAt = Date.now();
    this.initializeDefaultMetrics();
  }

  /**
   * 获取系统摘要
   *
   * @returns 系统指标摘要
   */
  getSummary(): {
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    cacheHitRate: number;
    rateLimitCount: number;
  } {
    const totalRequests = this.getCounter('http_requests_total');
    const errors = this.getCounter('http_errors_total');
    const duration = this.getHistogram('http_request_duration_ms');
    const rateLimits = this.getCounter('rate_limit_exceeded_total');

    const total = totalRequests?.value ?? 0;
    const errorCount = errors?.value ?? 0;
    const avgDuration = duration?.average ?? 0;
    const p95 = duration?.percentile(95) ?? 0;
    const p99 = duration?.percentile(99) ?? 0;
    const limitCount = rateLimits?.value ?? 0;

    // 计算整体缓存命中率
    let totalHits = 0;
    let totalCacheOps = 0;
    for (const stats of this.cacheStats.values()) {
      totalHits += stats.hits;
      totalCacheOps += stats.hits + stats.misses;
    }
    const cacheHitRate = totalCacheOps > 0 ? totalHits / totalCacheOps : 0;

    return {
      totalRequests: total,
      errorRate: total > 0 ? errorCount / total : 0,
      avgResponseTime: avgDuration,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      cacheHitRate,
      rateLimitCount: limitCount
    };
  }
}
