/**
 * PerformanceAggregator - 性能指标聚合器
 *
 * @description
 * 聚合性能指标（平均检查时间、P95/P99 检查时间等）
 * 支持增量更新以提高性能
 */

import type { IAggregator } from './IAggregator.js';
import type { TimePeriod } from '../models/TimePeriod.js';
import type { PerformanceMetrics } from '../models/Metrics.js';
import type { MetricsRecord } from '../models/Metrics.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * 性能指标增量更新缓存
 */
interface PerformanceIncrementalCache {
  lastUpdateTime: Date;
  cachedResult: PerformanceMetrics;
  allCheckTimes: number[];
  allExtractTimes: number[];
}

/**
 * PerformanceAggregator 类
 *
 * @description
 * 聚合性能指标
 *
 * @example
 * ```typescript
 * const aggregator = new PerformanceAggregator();
 * const metrics = await reader.readAll();
 * const performance = await aggregator.aggregate(metrics, TimePeriod.week());
 * console.log(`平均检查时间: ${performance.avgCheckTime}ms`);
 * console.log(`P95 检查时间: ${performance.p95CheckTime}ms`);
 * ```
 */
export class PerformanceAggregator implements IAggregator<MetricsRecord, PerformanceMetrics> {
  /**
   * 增量更新缓存
   */
  private incrementalCache: Map<string, PerformanceIncrementalCache> = new Map();

  /**
   * 聚合性能指标
   *
   * @param metrics - 指标记录列表
   * @param period - 时间范围
   * @returns 性能指标
   */
  async aggregate(
    metrics: MetricsRecord[],
    period: TimePeriod
  ): Promise<PerformanceMetrics> {
    // 提取检查时间
    const checkTimes = metrics
      .filter(m => m.checkTime && m.checkTime > 0)
      .map(m => m.checkTime!);

    // 提取提取时间
    const extractTimes = metrics
      .filter(m => m.extractTime && m.extractTime > 0)
      .map(m => m.extractTime!);

    return {
      avgCheckTime: MathUtils.mean(checkTimes),
      avgExtractTime: MathUtils.mean(extractTimes),
      p95CheckTime: MathUtils.percentile(checkTimes, 95),
      p99CheckTime: MathUtils.percentile(checkTimes, 99),
      minCheckTime: MathUtils.min(checkTimes),
      maxCheckTime: MathUtils.max(checkTimes),
      period: period.toString(),
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * 增量聚合
   *
   * @param previous - 上次聚合结果
   * @param newData - 新增指标记录
   * @returns 更新后的性能指标
   *
   * @remarks
   * 注意：百分位数无法增量更新，需要重新计算
   */
  async aggregateIncremental(
    previous: PerformanceMetrics,
    newData: MetricsRecord[]
  ): Promise<PerformanceMetrics> {
    // 提取新数据的检查时间
    const newCheckTimes = newData
      .filter(m => m.checkTime && m.checkTime > 0)
      .map(m => m.checkTime!);

    const newExtractTimes = newData
      .filter(m => m.extractTime && m.extractTime > 0)
      .map(m => m.extractTime!);

    if (newCheckTimes.length === 0 && newExtractTimes.length === 0) {
      return { ...previous, calculatedAt: new Date().toISOString() };
    }

    // 合并历史数据重新计算（需要缓存）
    const allCheckTimes = [...newCheckTimes]; // 实际需要合并历史数据
    const allExtractTimes = [...newExtractTimes];

    return {
      avgCheckTime: MathUtils.mean(allCheckTimes),
      avgExtractTime: MathUtils.mean(allExtractTimes),
      p95CheckTime: MathUtils.percentile(allCheckTimes, 95),
      p99CheckTime: MathUtils.percentile(allCheckTimes, 99),
      minCheckTime: MathUtils.min(allCheckTimes),
      maxCheckTime: MathUtils.max(allCheckTimes),
      period: previous.period,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * 支持缓存的聚合（带增量更新）
   *
   * @param metrics - 指标记录列表
   * @param period - 时间范围
   * @param enableIncremental - 是否启用增量更新
   * @returns 性能指标
   */
  async aggregateWithCache(
    metrics: MetricsRecord[],
    period: TimePeriod,
    enableIncremental: boolean = true
  ): Promise<PerformanceMetrics> {
    const cacheKey = period.toString();

    if (enableIncremental && this.incrementalCache.has(cacheKey)) {
      const cache = this.incrementalCache.get(cacheKey)!;

      // 过滤新增数据
      const newData = metrics.filter(m => {
        const timestamp = new Date(m.timestamp);
        return timestamp > cache.lastUpdateTime;
      });

      if (newData.length === 0) {
        return { ...cache.cachedResult, calculatedAt: new Date().toISOString() };
      }

      // 合并数据重新计算
      const newCheckTimes = newData
        .filter(m => m.checkTime && m.checkTime > 0)
        .map(m => m.checkTime!);

      const newExtractTimes = newData
        .filter(m => m.extractTime && m.extractTime > 0)
        .map(m => m.extractTime!);

      const allCheckTimes = [...cache.allCheckTimes, ...newCheckTimes];
      const allExtractTimes = [...cache.allExtractTimes, ...newExtractTimes];

      const result: PerformanceMetrics = {
        avgCheckTime: MathUtils.mean(allCheckTimes),
        avgExtractTime: MathUtils.mean(allExtractTimes),
        p95CheckTime: MathUtils.percentile(allCheckTimes, 95),
        p99CheckTime: MathUtils.percentile(allCheckTimes, 99),
        minCheckTime: MathUtils.min(allCheckTimes),
        maxCheckTime: MathUtils.max(allCheckTimes),
        period: period.toString(),
        calculatedAt: new Date().toISOString()
      };

      // 更新缓存（限制数组大小防止内存溢出）
      const maxCacheSize = 10000;
      const trimmedCheckTimes = allCheckTimes.length > maxCacheSize
        ? allCheckTimes.slice(-maxCacheSize)
        : allCheckTimes;
      const trimmedExtractTimes = allExtractTimes.length > maxCacheSize
        ? allExtractTimes.slice(-maxCacheSize)
        : allExtractTimes;

      this.incrementalCache.set(cacheKey, {
        lastUpdateTime: new Date(),
        cachedResult: result,
        allCheckTimes: trimmedCheckTimes,
        allExtractTimes: trimmedExtractTimes
      });

      return result;
    }

    // 首次全量聚合
    const result = await this.aggregate(metrics, period);

    // 保存到缓存
    const checkTimes = metrics
      .filter(m => m.checkTime && m.checkTime > 0)
      .map(m => m.checkTime!);
    const extractTimes = metrics
      .filter(m => m.extractTime && m.extractTime > 0)
      .map(m => m.extractTime!);

    this.incrementalCache.set(cacheKey, {
      lastUpdateTime: new Date(),
      cachedResult: result,
      allCheckTimes: checkTimes,
      allExtractTimes: extractTimes
    });

    return result;
  }

  /**
   * 清除增量缓存
   */
  clearIncrementalCache(period?: TimePeriod): void {
    if (period) {
      this.incrementalCache.delete(period.toString());
    } else {
      this.incrementalCache.clear();
    }
  }
}
