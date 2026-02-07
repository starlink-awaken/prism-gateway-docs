/**
 * UsageAggregator - 使用指标聚合器
 *
 * @description
 * 聚合使用指标（总检查次数、总复盘次数、日活用户、平均会话时长）
 */

import type { IAggregator } from './IAggregator.js';
import type { TimePeriod } from '../models/TimePeriod.js';
import type { UsageMetrics } from '../models/Metrics.js';
import type { RetroRecord } from '../../types/index.js';
import { MathUtils } from '../utils/MathUtils.js';
import { TimeUtils } from '../utils/TimeUtils.js';

/**
 * RetroRecord 扩展（包含 userId）
 *
 * @description
 * UsageAggregator 需要的额外字段
 */
interface RetroRecordWithUser extends RetroRecord {
  userId?: string;
}

/**
 * UsageAggregator 类
 *
 * @description
 * 聚合使用指标
 *
 * @example
 * ```typescript
 * const aggregator = new UsageAggregator();
 * const retros = await reader.readAll();
 * const metrics = await aggregator.aggregate(retros, TimePeriod.week());
 * console.log(`总复盘数: ${metrics.totalRetrospectives}`);
 * ```
 */
export class UsageAggregator implements IAggregator<RetroRecordWithUser, UsageMetrics> {
  /**
   * 聚合使用指标
   *
   * @param retros - 复盘记录列表
   * @param period - 时间范围
   * @returns 使用指标
   */
  async aggregate(
    retros: RetroRecordWithUser[],
    period: TimePeriod
  ): Promise<UsageMetrics> {
    // 计算总复盘数
    const totalRetrospectives = retros.length;

    // 计算总检查次数（基于复盘类型和时长估算）
    const totalChecks = this.estimateTotalChecks(retros);

    // 提取用户ID（假设 RetroRecord 有 userId 字段）
    const uniqueUsers = new Set(
      retros.map(r => r.userId || 'anonymous')
    );
    const dailyActiveUsers = this.calculateDailyActive(retros);

    // 计算平均会话时长
    const durations = retros
      .filter(r => r.duration > 0)
      .map(r => r.duration);
    const avgSessionDuration = durations.length > 0
      ? MathUtils.mean(durations)
      : 0;

    return {
      totalChecks,
      totalRetrospectives,
      dailyActiveUsers,
      avgSessionDuration,
      period: period.toString(),
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * 增量聚合
   *
   * @param previous - 上次聚合结果
   * @param newData - 新增复盘记录
   * @returns 更新后的使用指标
   */
  async aggregateIncremental(
    previous: UsageMetrics,
    newData: RetroRecordWithUser[]
  ): Promise<UsageMetrics> {
    // 增量更新：累加新增数据
    return {
      ...previous,
      totalRetrospectives: previous.totalRetrospectives + newData.length,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * 估算总检查次数
   *
   * @param retros - 复盘记录列表
   * @returns 估算的总检查次数
   *
   * @private
   * @remarks
   * 基于复盘类型和时长估算检查次数：
   * - quick: 约 5-10 次检查
   * - standard: 约 20-30 次检查
   * - deep: 约 50-100 次检查
   * - 使用时长作为辅助验证（假设每次检查平均 1-2 分钟）
   */
  private estimateTotalChecks(retros: RetroRecordWithUser[]): number {
    return retros.reduce((sum, retro) => {
      let baseChecks = 0;

      // 基于复盘类型的基础检查次数
      switch (retro.type) {
        case 'quick':
          baseChecks = 8; // 8次检查
          break;
        case 'standard':
          baseChecks = 25; // 25次检查
          break;
        case 'deep':
          baseChecks = 75; // 75次检查
          break;
        default:
          baseChecks = 10; // 默认10次
      }

      // 基于时长调整（假设每次检查平均 1.5 分钟）
      const durationMinutes = retro.duration / (1000 * 60);
      const durationBasedChecks = Math.round(durationMinutes / 1.5);

      // 取两者中的较大值
      return sum + Math.max(baseChecks, durationBasedChecks);
    }, 0);
  }

  /**
   * 计算日活用户数（平均）
   *
   * @param retros - 复盘记录列表
   * @returns 平均日活用户数
   *
   * @private
   */
  private calculateDailyActive(retros: RetroRecordWithUser[]): number {
    if (retros.length === 0) return 0;

    // 按日期分组，计算平均日活
    const byDate = new Map<string, Set<string>>();

    for (const retro of retros) {
      const date = TimeUtils.toDateKey(retro.timestamp);
      if (!byDate.has(date)) {
        byDate.set(date, new Set());
      }
      byDate.get(date)!.add(retro.userId || 'anonymous');
    }

    const dailyCounts = Array.from(byDate.values()).map(s => s.size);
    return MathUtils.mean(dailyCounts);
  }
}
