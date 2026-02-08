/**
 * IAggregator - 聚合器接口
 *
 * @description
 * 定义数据聚合的通用契约
 *
 * @remarks
 * 设计原则：
 * - 泛型设计：支持不同类型的输入输出
 * - 单一职责：只负责数据聚合，不负责数据读取
 * - 增量支持：支持全量和增量聚合
 *
 * @example
 * ```typescript
 * class UsageAggregator implements IAggregator<RetroRecord, UsageMetrics> {
 *   async aggregate(retros: RetroRecord[], period: TimePeriod): Promise<UsageMetrics> {
 *     // 聚合逻辑
 *   }
 * }
 * ```
 */

import type { TimePeriod } from '../models/TimePeriod.js';

/**
 * IAggregator - 聚合器接口
 *
 * @description
 * 定义数据聚合的通用操作
 *
 * @typeParam TInput - 输入数据类型
 * @typeParam TOutput - 输出聚合结果类型
 *
 * @remarks
 * 所有聚合器必须实现此接口
 */
export interface IAggregator<TInput, TOutput> {
  /**
   * 聚合数据
   *
   * @param data - 原始数据列表
   * @param period - 时间范围
   * @returns 聚合结果
   *
   * @example
   * ```typescript
   * const retros = await reader.readAll();
   * const metrics = await aggregator.aggregate(retros, TimePeriod.week());
   * ```
   */
  aggregate(data: TInput[], period: TimePeriod): Promise<TOutput>;

  /**
   * 增量聚合（用于缓存更新）
   *
   * @param previous - 上次聚合结果
   * @param newData - 新增数据
   * @returns 更新后的聚合结果
   *
   * @remarks
   * 增量聚合应该比全量聚合更高效
   * 适用于缓存更新场景
   *
   * @example
   * ```typescript
   * const cached = await cache.get('analytics:usage:week');
   * const newRetros = await reader.read(startTime, endTime);
   * const updated = await aggregator.aggregateIncremental(cached, newRetros);
   * ```
   */
  aggregateIncremental(
    previous: TOutput,
    newData: TInput[]
  ): Promise<TOutput>;
}
