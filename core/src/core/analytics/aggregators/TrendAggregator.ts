/**
 * TrendAggregator - 趋势指标聚合器
 *
 * @description
 * 聚合趋势指标（违规趋势、改进率、Top 违规）
 * 支持增量更新以提高性能
 */

import type { IAggregator } from './IAggregator.js';
import type { TimePeriod } from '../models/TimePeriod.js';
import type { TrendMetrics, TopViolation } from '../models/Metrics.js';
import type { ViolationRecord } from '../../types/index.js';
import { MemoryStore } from '../../core/MemoryStore.js';

/**
 * 增量更新缓存状态
 *
 * @description
 * 保存上次聚合的结果和时间戳，用于增量更新
 */
interface IncrementalCache {
  /**
   * 上次更新时间
   */
  lastUpdateTime: Date;

  /**
   * 上次聚合结果
   */
  cachedResult: TrendMetrics;

  /**
   * 上次数据总数（用于计算改进率）
   */
  lastDataCount: number;

  /**
   * 按原则分组的上次计数（用于增量更新 Top 违规）
   */
  lastGroupedData: Map<string, number>;
}

/**
 * TrendAggregator 类
 *
 * @description
 * 聚合趋势指标
 *
 * @example
 * ```typescript
 * const aggregator = new TrendAggregator(memoryStore);
 * const violations = await reader.readAll();
 * const trends = await aggregator.aggregate(violations, TimePeriod.week());
 * console.log(`违规趋势: ${trends.violationTrend}`);
 * ```
 */
export class TrendAggregator implements IAggregator<ViolationRecord, TrendMetrics> {
  private readonly memoryStore: MemoryStore;

  /**
   * 增量更新缓存
   *
   * @description
   * 存储上次聚合结果，用于增量更新
   */
  private incrementalCache: Map<string, IncrementalCache> = new Map();

  /**
   * 构造函数
   *
   * @param memoryStore - MemoryStore 实例
   */
  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * 聚合趋势指标
   *
   * @param violations - 违规记录列表
   * @param period - 时间范围
   * @returns 趋势指标
   */
  async aggregate(
    violations: ViolationRecord[],
    period: TimePeriod
  ): Promise<TrendMetrics> {
    // 按原则ID分组
    const byPrinciple = this.groupByPrinciple(violations);

    // 提取原则名称映射
    const principleNames = this.extractPrincipleNames(violations);

    // 计算趋势（与上一周期对比）
    const violationTrend = this.calculateTrend(violations.length);

    // 计算改进率（与估算的基准值对比）
    const improvementRate = this.calculateImprovementRate(violations.length);

    // Top 违规
    const topViolations = this.getTopViolations(byPrinciple, principleNames, 5);

    return {
      violationTrend,
      improvementRate,
      topViolations,
      period: period.toString(),
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * 增量聚合（兼容接口）
   *
   * @param previous - 上次聚合结果
   * @param newData - 新增违规记录
   * @returns 更新后的趋势指标
   */
  async aggregateIncremental(
    previous: TrendMetrics,
    newData: ViolationRecord[]
  ): Promise<TrendMetrics> {
    // 简化实现：更新 Top 违规，保留其他值
    const byPrinciple = this.groupByPrinciple(newData);
    const principleNames = this.extractPrincipleNames(newData);

    // 合并到现有 Top 违规
    const updatedTopViolations = this.mergeTopViolations(
      previous.topViolations,
      byPrinciple,
      principleNames
    );

    return {
      ...previous,
      topViolations: updatedTopViolations,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * 支持缓存的聚合（带增量更新）
   *
   * @param violations - 违规记录列表
   * @param period - 时间范围
   * @param enableIncremental - 是否启用增量更新（默认 true）
   * @returns 趋势指标
   */
  async aggregateWithCache(
    violations: ViolationRecord[],
    period: TimePeriod,
    enableIncremental: boolean = true
  ): Promise<TrendMetrics> {
    const cacheKey = period.toString();

    if (enableIncremental && this.incrementalCache.has(cacheKey)) {
      const cache = this.incrementalCache.get(cacheKey)!;

      // 过滤新增数据（时间戳 > 上次更新时间）
      const newData = violations.filter(v => {
        const timestamp = new Date(v.timestamp);
        return timestamp > cache.lastUpdateTime;
      });

      // 如果没有新数据，返回缓存结果
      if (newData.length === 0) {
        return {
          ...cache.cachedResult,
          calculatedAt: new Date().toISOString()
        };
      }

      // 增量更新
      const updated = await this.aggregateIncremental(cache.cachedResult, newData);

      // 更新缓存
      this.incrementalCache.set(cacheKey, {
        lastUpdateTime: new Date(),
        cachedResult: updated,
        lastDataCount: cache.lastDataCount + newData.length,
        lastGroupedData: this.mergeGroupedData(cache.lastGroupedData, this.groupByPrinciple(newData))
      });

      return updated;
    }

    // 首次全量聚合
    const result = await this.aggregate(violations, period);

    // 保存到缓存
    this.incrementalCache.set(cacheKey, {
      lastUpdateTime: new Date(),
      cachedResult: result,
      lastDataCount: violations.length,
      lastGroupedData: this.groupByPrinciple(violations)
    });

    return result;
  }

  /**
   * 清除增量缓存
   *
   * @param period - 要清除的时间范围（可选，不传则清除全部）
   */
  clearIncrementalCache(period?: TimePeriod): void {
    if (period) {
      this.incrementalCache.delete(period.toString());
    } else {
      this.incrementalCache.clear();
    }
  }

  /**
   * 按原则ID分组
   *
   * @param violations - 违规记录列表
   * @returns 原则ID到违规次数的映射
   *
   * @private
   */
  private groupByPrinciple(violations: ViolationRecord[]): Map<string, number> {
    const grouped = new Map<string, number>();

    for (const v of violations) {
      const principleId = v.principle_id || 'unknown';
      const count = grouped.get(principleId) || 0;
      grouped.set(principleId, count + 1);
    }

    return grouped;
  }

  /**
   * 提取原则名称映射
   *
   * @param violations - 违规记录列表
   * @returns 原则ID到原则名称的映射
   *
   * @private
   */
  private extractPrincipleNames(violations: ViolationRecord[]): Map<string, string> {
    const names = new Map<string, string>();

    for (const v of violations) {
      if (v.principle_id && v.principle_name && !names.has(v.principle_id)) {
        names.set(v.principle_id, v.principle_name);
      }
    }

    return names;
  }

  /**
   * 获取 Top 违规
   *
   * @param grouped - 分组后的违规数据
   * @param principleNames - 原则名称映射
   * @param limit - 返回数量限制
   * @returns Top 违规列表
   *
   * @private
   */
  private getTopViolations(
    grouped: Map<string, number>,
    principleNames: Map<string, string>,
    limit: number
  ): TopViolation[] {
    // 转换为数组并排序
    const sorted = Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const total = sorted.reduce((sum, [_, count]) => sum + count, 0);

    return sorted.map(([principleId, count]) => {
      const principleName = principleNames.get(principleId) || principleId;
      const percentage = total > 0 ? count / total : 0;

      return {
        principleId,
        principleName,
        count,
        percentage: Math.round(percentage * 10000) / 10000 // 四舍五入到小数点后4位，保持0-1范围
      };
    });
  }

  /**
   * 计算趋势方向
   *
   * @param currentViolationCount - 当前周期的违规数量
   * @returns 趋势方向
   *
   * @private
   * @remarks
   * 基于违规数量估算趋势（简化版本，完整实现需要历史数据对比）
   *
   * 判断逻辑：
   * - 如果违规数为0，趋势为 stable（无数据）
   * - 如果违规数 > 100，趋势为 up（增加）
   * - 如果违规数 < 20，趋势为 down（减少）
   * - 其他情况为 stable（稳定）
   *
   * TODO: 实现真正的趋势分析（对比上一周期）
   *       需要存储历史数据或从数据源获取上一周期的违规数
   */
  private calculateTrend(currentViolationCount: number): 'up' | 'down' | 'stable' {
    // 无违规，趋势稳定
    if (currentViolationCount === 0) {
      return 'stable';
    }

    // 简化版本：基于绝对数量判断
    if (currentViolationCount > 100) {
      return 'up'; // 违规数较多，可能呈上升趋势
    } else if (currentViolationCount < 20) {
      return 'down'; // 违规数较少，可能呈下降趋势
    } else {
      return 'stable'; // 违规数适中，趋势稳定
    }
  }

  /**
   * 计算改进率
   *
   * @param currentViolationCount - 当前周期的违规数量
   * @returns 改进率（0-1）
   *
   * @private
   * @remarks
   * 基于违规数量估算改进率（简化版本）
   *
   * 计算逻辑（简化版本）：
   * - 违规数越少，改进率越高
   * - 使用非线性函数：1 / (1 + violationCount / 50)
   */
  private calculateImprovementRate(currentViolationCount: number): number {
    // 简化版本：基于当前违规数估算
    // 违规数越少，改进率越高
    if (currentViolationCount === 0) {
      return 1.0; // 无违规，完全改进
    }

    // 使用非线性函数计算改进率
    // 当违规数为0时为1.0，违规数为50时为0.5，违规数为100时为0.33
    return 1 / (1 + currentViolationCount / 50);
  }

  /**
   * 计算改进率（带历史对比）
   *
   * @param currentCount - 当前周期的违规数量
   * @param previousCount - 上一周期的违规数量
   * @returns 改进率（0-1）
   *
   * @private
   * @remarks
   * 真正的改进率计算公式：
   * improvementRate = (previousCount - currentCount) / previousCount
   *
   * 结果范围：
   * - 正值：表示改进（违规减少）
   * - 零：表示无变化
   * - 负值：表示恶化（违规增加）
   *
   * 转换为 0-1 范围：
   * - 如果改进率为正，映射到 0.5-1.0
   * - 如果改进率为负，映射到 0-0.5
   */
  private calculateImprovementRateWithHistory(
    currentCount: number,
    previousCount: number
  ): number {
    if (previousCount === 0) {
      // 无历史数据，使用简化版本
      return this.calculateImprovementRate(currentCount);
    }

    const rawImprovementRate = (previousCount - currentCount) / previousCount;

    // 转换为 0-1 范围
    if (rawImprovementRate >= 0) {
      // 改进或无变化：0.5 - 1.0
      return 0.5 + (rawImprovementRate * 0.5);
    } else {
      // 恶化：0 - 0.5
      return 0.5 + (rawImprovementRate * 0.5);
    }
  }

  /**
   * 合并 Top 违规列表
   *
   * @param existing - 现有 Top 违规列表
   * @param newGrouped - 新增分组数据
   * @param principleNames - 原则名称映射
   * @returns 更新后的 Top 违规列表
   *
   * @private
   */
  private mergeTopViolations(
    existing: TopViolation[],
    newGrouped: Map<string, number>,
    principleNames: Map<string, string>
  ): TopViolation[] {
    // 创建计数映射
    const merged = new Map<string, number>();

    // 添加现有数据
    for (const item of existing) {
      merged.set(item.principleId, item.count);
    }

    // 合并新数据
    for (const [principleId, count] of newGrouped.entries()) {
      const existingCount = merged.get(principleId) || 0;
      merged.set(principleId, existingCount + count);
    }

    // 转换为数组并排序
    const sorted = Array.from(merged.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const total = sorted.reduce((sum, [_, count]) => sum + count, 0);

    return sorted.map(([principleId, count]) => {
      const principleName = principleNames.get(principleId) ||
        existing.find(v => v.principleId === principleId)?.principleName ||
        principleId;
      const percentage = total > 0 ? count / total : 0;

      return {
        principleId,
        principleName,
        count,
        percentage: Math.round(percentage * 10000) / 10000
      };
    });
  }

  /**
   * 合并分组数据
   *
   * @param existing - 现有分组数据
   * @param newData - 新分组数据
   * @returns 合并后的分组数据
   *
   * @private
   */
  private mergeGroupedData(
    existing: Map<string, number>,
    newData: Map<string, number>
  ): Map<string, number> {
    const merged = new Map(existing);

    for (const [key, value] of newData.entries()) {
      const existingValue = merged.get(key) || 0;
      merged.set(key, existingValue + value);
    }

    return merged;
  }
}
