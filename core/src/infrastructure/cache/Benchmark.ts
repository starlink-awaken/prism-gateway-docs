/**
 * 性能基准测试工具
 *
 * @description
 * 提供缓存性能测试功能，包括：
 * - 延迟测试（P50, P95, P99）
 * - 吞吐量测试
 * - 内存占用测试
 * - 并发性能测试
 *
 * @module infrastructure/cache
 */

/**
 * 基准测试配置
 *
 * @interface BenchmarkConfig
 */
export interface BenchmarkConfig {
  /**
   * 并发数
   *
   * @default 10
   */
  concurrency?: number;

  /**
   * 每个并发执行的请求数
   *
   * @default 1000
   */
  requestsPerConcurrency?: number;

  /**
   * 预热轮数
   *
   * @default 1
   */
  warmupRounds?: number;

  /**
   * 是否启用内存测量
   *
   * @default true
   */
  measureMemory?: boolean;

  /**
   * 测试超时时间（毫秒）
   *
   * @default 30000
   */
  timeout?: number;
}

/**
 * 基准测试操作
 *
 * @interface BenchmarkOperation
 */
export interface BenchmarkOperation {
  /**
   * 操作名称
   */
  name: string;

  /**
   * 要测试的函数
   */
  fn: () => Promise<unknown> | unknown;
}

/**
 * 单次基准测试结果
 *
 * @interface BenchmarkResult
 */
export interface BenchmarkResult {
  /**
   * 操作名称
   */
  name: string;

  /**
   * 总请求数
   */
  totalRequests: number;

  /**
   * 总耗时（毫秒）
   */
  totalTimeMs: number;

  /**
   * 吞吐量（请求/秒）
   */
  throughput: number;

  /**
   * 平均延迟（毫秒）
   */
  avgLatencyMs: number;

  /**
   * 最小延迟（毫秒）
   */
  minLatencyMs: number;

  /**
   * 最大延迟（毫秒）
   */
  maxLatencyMs: number;

  /**
   * P50 延迟（毫秒）
   */
  p50LatencyMs: number;

  /**
   * P95 延迟（毫秒）
   */
  p95LatencyMs: number;

  /**
   * P99 延迟（毫秒）
   */
  p99LatencyMs: number;

  /**
   * P99.9 延迟（毫秒）
   */
  p999LatencyMs: number;

  /**
   * 标准差（毫秒）
   */
  stdDevMs: number;

  /**
   * 错误数
   */
  errors: number;

  /**
   * 错误率（百分比）
   */
  errorRate: number;

  /**
   * 内存增量（字节）
   */
  memoryDeltaBytes: number;
}

/**
 * 基准测试报告
 *
 * @interface BenchmarkReport
 */
export interface BenchmarkReport {
  /**
   * 测试时间
   */
  timestamp: string;

  /**
   * 测试配置
   */
  config: Required<BenchmarkConfig>;

  /**
   * 所有测试结果
   */
  results: BenchmarkResult[];

  /**
   * 对比分析
   */
  comparison?: {
    /**
     * 最快的操作
     */
    fastest: string;

    /**
     * 最慢的操作
     */
    slowest: string;

    /**
     * 性能提升百分比
     */
    improvements: Array<{
      from: string;
      to: string;
      improvement: number;
    }>;
  };
}

/**
 * 计算百分位数
 *
 * @param arr - 排序后的数值数组
 * @param percentile - 百分位数 (0-100)
 * @returns 百分位数值
 */
function percentile(arr: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * arr.length) - 1;
  return arr[index] || 0;
}

/**
 * 计算标准差
 *
 * @param arr - 数值数组
 * @param mean - 平均值
 * @returns 标准差
 */
function stdDev(arr: number[], mean: number): number {
  const squareDiffs = arr.map((value: number) => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * 性能基准测试类
 *
 * @description
 * 提供缓存和其他操作的性能测试能力
 *
 * @example
 * ```typescript
 * const benchmark = new PerformanceBenchmark();
 *
 * // 测试缓存性能
 * const cache = new CacheManager({ maxSize: 1000 });
 *
 * const report = await benchmark.run([
 *   {
 *     name: 'cache.set',
 *     fn: async () => {
 *       await cache.set(`key${Math.random()}`, { data: 'test' });
 *     }
 *   },
 *   {
 *     name: 'cache.get',
 *     fn: async () => {
 *       await cache.get('key1');
 *     }
 *   }
 * ], { concurrency: 10, requestsPerConcurrency: 1000 });
 *
 * console.log(report);
 * ```
 *
 * @class PerformanceBenchmark
 */
export class PerformanceBenchmark {
  private config: Required<BenchmarkConfig>;

  constructor(config?: BenchmarkConfig) {
    this.config = {
      concurrency: 10,
      requestsPerConcurrency: 1000,
      warmupRounds: 1,
      measureMemory: true,
      timeout: 30000,
      ...config
    };
  }

  /**
   * 运行基准测试
   *
   * @param operations - 要测试的操作数组
   * @param config - 测试配置（可选）
   * @returns 测试报告
   */
  async run(
    operations: BenchmarkOperation[],
    config?: BenchmarkConfig
  ): Promise<BenchmarkReport> {
    const cfg = config ? { ...this.config, ...config } : this.config;
    const results: BenchmarkResult[] = [];

    for (const op of operations) {
      // 预热
      for (let i = 0; i < cfg.warmupRounds; i++) {
        await this.warmup(op.fn);
      }

      // 执行测试
      const result = await this.benchmark(op, cfg);
      results.push(result);
    }

    // 生成对比分析
    const comparison = this.generateComparison(results);

    return {
      timestamp: new Date().toISOString(),
      config: cfg,
      results,
      comparison
    };
  }

  /**
   * 对比两次测试结果
   *
   * @param before - 优化前的报告
   * @param after - 优化后的报告
   * @returns 对比结果
   *
   * @example
   * ```typescript
   * const beforeReport = await benchmark.run([{ name: 'test', fn: async () => {} }]);
   * // 进行优化...
   * const afterReport = await benchmark.run([{ name: 'test', fn: async () => {} }]);
   *
   * const comparison = PerformanceBenchmark.compare(beforeReport, afterReport);
   * console.log(`性能提升: ${comparison.improvement}%`);
   * ```
   */
  static compare(
    before: BenchmarkReport,
    after: BenchmarkReport
  ): {
    improvement: number;
    before: BenchmarkResult;
    after: BenchmarkResult;
    details: {
      throughputImprovement: number;
      latencyImprovement: number;
      p95Improvement: number;
      p99Improvement: number;
    };
  } {
    if (before.results.length !== after.results.length) {
      throw new Error('报告格式不一致');
    }

    // 取第一个操作进行比较
    const beforeResult = before.results[0];
    const afterResult = after.results[0];

    const throughputImprovement =
      ((afterResult.throughput - beforeResult.throughput) /
        beforeResult.throughput) *
      100;

    const latencyImprovement =
      ((beforeResult.avgLatencyMs - afterResult.avgLatencyMs) /
        beforeResult.avgLatencyMs) *
      100;

    const p95Improvement =
      ((beforeResult.p95LatencyMs - afterResult.p95LatencyMs) /
        beforeResult.p95LatencyMs) *
      100;

    const p99Improvement =
      ((beforeResult.p99LatencyMs - afterResult.p99LatencyMs) /
        beforeResult.p99LatencyMs) *
      100;

    return {
      improvement: latencyImprovement,
      before: beforeResult,
      after: afterResult,
      details: {
        throughputImprovement,
        latencyImprovement,
        p95Improvement,
        p99Improvement
      }
    };
  }

  /**
   * 生成可读的报告
   *
   * @param report - 基准测试报告
   * @returns 格式化的报告字符串
   */
  static formatReport(report: BenchmarkReport): string {
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push('性能基准测试报告');
    lines.push('='.repeat(60));
    lines.push(`测试时间: ${report.timestamp}`);
    lines.push(`配置: 并发=${report.config.concurrency}, ` +
      `请求数/并发=${report.config.requestsPerConcurrency}`);
    lines.push('');

    for (const result of report.results) {
      lines.push(`-`.repeat(60));
      lines.push(`操作: ${result.name}`);
      lines.push(`-`.repeat(60));
      lines.push(`吞吐量: ${result.throughput.toFixed(2)} 请求/秒`);
      lines.push(`平均延迟: ${result.avgLatencyMs.toFixed(2)} ms`);
      lines.push(`最小延迟: ${result.minLatencyMs.toFixed(2)} ms`);
      lines.push(`最大延迟: ${result.maxLatencyMs.toFixed(2)} ms`);
      lines.push(`P50 延迟: ${result.p50LatencyMs.toFixed(2)} ms`);
      lines.push(`P95 延迟: ${result.p95LatencyMs.toFixed(2)} ms`);
      lines.push(`P99 延迟: ${result.p99LatencyMs.toFixed(2)} ms`);
      lines.push(`P99.9 延迟: ${result.p999LatencyMs.toFixed(2)} ms`);
      lines.push(`标准差: ${result.stdDevMs.toFixed(2)} ms`);
      lines.push(`错误数: ${result.errors} (${result.errorRate.toFixed(2)}%)`);
      lines.push(`内存增量: ${(result.memoryDeltaBytes / 1024).toFixed(2)} KB`);
      lines.push('');
    }

    if (report.comparison) {
      lines.push(`-`.repeat(60));
      lines.push('对比分析');
      lines.push(`-`.repeat(60));
      lines.push(`最快: ${report.comparison.fastest}`);
      lines.push(`最慢: ${report.comparison.slowest}`);
      lines.push('');
    }

    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  /**
   * 预热
   */
  private async warmup(fn: () => unknown): Promise<void> {
    const warmupCount = 10;
    for (let i = 0; i < warmupCount; i++) {
      await fn();
    }
  }

  /**
   * 执行单个基准测试
   */
  private async benchmark(
    operation: BenchmarkOperation,
    config: Required<BenchmarkConfig>
  ): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    let errors = 0;
    let memoryBefore = 0;
    let memoryAfter = 0;

    if (config.measureMemory) {
      memoryBefore = this.getMemoryUsage();
    }

    const totalRequests = config.concurrency * config.requestsPerConcurrency;
    const startTime = Date.now();

    // 执行并发测试
    const workers: Promise<void>[] = [];
    for (let i = 0; i < config.concurrency; i++) {
      workers.push(
        this.runWorker(operation.fn, config.requestsPerConcurrency, latencies, () => {
          errors++;
        })
      );
    }

    await Promise.all(workers);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    if (config.measureMemory) {
      memoryAfter = this.getMemoryUsage();
    }

    // 计算统计数据
    latencies.sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = latencies[0] || 0;
    const maxLatency = latencies[latencies.length - 1] || 0;

    return {
      name: operation.name,
      totalRequests,
      totalTimeMs: totalTime,
      throughput: (totalRequests / totalTime) * 1000,
      avgLatencyMs: avgLatency,
      minLatencyMs: minLatency,
      maxLatencyMs: maxLatency,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      p99LatencyMs: percentile(latencies, 99),
      p999LatencyMs: percentile(latencies, 99.9),
      stdDevMs: stdDev(latencies, avgLatency),
      errors,
      errorRate: (errors / totalRequests) * 100,
      memoryDeltaBytes: memoryAfter - memoryBefore
    };
  }

  /**
   * 执行工作线程
   */
  private async runWorker(
    fn: () => unknown,
    count: number,
    latencies: number[],
    onError: () => void
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      const start = Date.now();
      try {
        await Promise.resolve(fn());
        const end = Date.now();
        latencies.push(end - start);
      } catch {
        onError();
      }
    }
  }

  /**
   * 获取当前内存使用量
   */
  private getMemoryUsage(): number {
    // Bun 使用 process.memoryUsage()
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * 生成对比分析
   */
  private generateComparison(results: BenchmarkResult[]): BenchmarkReport['comparison'] {
    if (results.length === 0) {
      return undefined;
    }

    const sortedByThroughput = [...results].sort(
      (a, b) => b.throughput - a.throughput
    );

    const fastest = sortedByThroughput[0].name;
    const slowest = sortedByThroughput[sortedByThroughput.length - 1].name;

    const improvements: Array<{
      from: string;
      to: string;
      improvement: number;
    }> = [];

    // 计算最慢和最快的差异
    if (results.length > 1) {
      const slowestResult = sortedByThroughput[sortedByThroughput.length - 1];
      const fastestResult = sortedByThroughput[0];
      const improvement =
        ((slowestResult.avgLatencyMs - fastestResult.avgLatencyMs) /
          slowestResult.avgLatencyMs) *
        100;
      improvements.push({
        from: slowest,
        to: fastest,
        improvement
      });
    }

    return {
      fastest,
      slowest,
      improvements
    };
  }
}

/**
 * 导出类型
 */
export type {
  BenchmarkConfig,
  BenchmarkOperation,
  BenchmarkResult,
  BenchmarkReport
};
