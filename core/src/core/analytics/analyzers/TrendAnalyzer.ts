/**
 * TrendAnalyzer - 趋势分析器
 *
 * @description
 * 分析数据趋势（线性回归、移动平均、变化点检测）
 */

import type { IAnalyzer, AnalysisOptions } from './IAnalyzer.js';
import type { TrendData, TrendAnalysis, DataPoint, ChangePoint } from '../models/Metrics.js';
import { MathUtils, type Point2D } from '../utils/MathUtils.js';

/**
 * TrendAnalyzer 类
 *
 * @description
 * 分析数据趋势
 *
 * @example
 * ```typescript
 * const analyzer = new TrendAnalyzer();
 * const trendData: TrendData = {
 *   metric: 'violations',
 *   period: 'month',
 *   points: [
 *     { timestamp: '2026-01-01T00:00:00Z', value: 10 },
 *     { timestamp: '2026-01-02T00:00:00Z', value: 15 },
 *     { timestamp: '2026-01-03T00:00:00Z', value: 12 }
 *   ]
 * };
 * const analysis = await analyzer.analyze(trendData);
 * console.log(`趋势方向: ${analysis.direction}`);
 * ```
 */
export class TrendAnalyzer implements IAnalyzer<TrendData, TrendAnalysis> {
  /**
   * 分析趋势
   *
   * @param data - 趋势数据
   * @param options - 分析选项
   * @returns 趋势分析结果
   */
  async analyze(
    data: TrendData,
    options: AnalysisOptions = {}
  ): Promise<TrendAnalysis> {
    const { points } = data;
    const windowSize = options.windowSize || 7;

    // 处理边界情况
    if (points.length === 0) {
      return {
        direction: 'stable',
        slope: 0,
        rSquared: 0,
        smoothed: [],
        changePoints: [],
        confidence: 0
      };
    }

    if (points.length === 1) {
      return {
        direction: 'stable',
        slope: 0,
        rSquared: 1, // 单点完全拟合
        smoothed: [...points],
        changePoints: [],
        confidence: 0.5 // 单点置信度中等
      };
    }

    // 1. 线性回归
    const regressionPoints: Point2D[] = points.map((p, i) => ({ x: i, y: p.value }));
    const regression = MathUtils.linearRegression(regressionPoints);

    // 2. 趋势方向
    const direction = this.getDirection(regression.slope);

    // 3. 移动平均
    const smoothed = this.movingAverage(points, windowSize);

    // 4. 变化点检测
    const changePoints = this.detectChangePoints(points);

    // 5. 置信度
    const confidence = this.calculateConfidence(regression.rSquared);

    return {
      direction,
      slope: regression.slope,
      rSquared: regression.rSquared,
      smoothed,
      changePoints,
      confidence
    };
  }

  /**
   * 获取趋势方向
   *
   * @param slope - 线性回归斜率
   * @returns 趋势方向
   *
   * @private
   * @remarks
   * 阈值设置为0.1，以避免因微小波动而误判趋势
   */
  private getDirection(slope: number): 'up' | 'down' | 'stable' {
    const threshold = 0.5; // 提高阈值，使判断更宽松
    if (Math.abs(slope) < threshold) return 'stable';
    return slope > 0 ? 'up' : 'down';
  }

  /**
   * 计算移动平均
   *
   * @param points - 数据点数组
   * @param windowSize - 窗口大小
   * @returns 平滑后的数据点
   *
   * @private
   */
  private movingAverage(
    points: DataPoint[],
    windowSize: number
  ): DataPoint[] {
    const result: DataPoint[] = [];

    for (let i = 0; i < points.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = points.slice(start, i + 1);
      const avg = MathUtils.mean(window.map(p => p.value));
      result.push({ ...points[i], value: avg });
    }

    return result;
  }

  /**
   * 检测变化点
   *
   * @param points - 数据点数组
   * @returns 变化点列表
   *
   * @private
   * @remarks
   * 检测数据中的显著变化点（阶段变化）
   *
   * 算法：
   * 1. 计算相邻点之间的差值
   * 2. 使用中位数绝对偏差（MAD）检测异常差值
   * 3. 差值超过阈值的点标记为变化点
   */
  private detectChangePoints(points: DataPoint[]): ChangePoint[] {
    if (points.length < 3) return [];

    const changes: ChangePoint[] = [];

    // 计算相邻点之间的差值
    const diffs: number[] = [];
    for (let i = 1; i < points.length; i++) {
      diffs.push(points[i].value - points[i - 1].value);
    }

    // 计算差值的绝对值的中位数
    const absDiffs = diffs.map(d => Math.abs(d));
    const sortedAbsDiffs = [...absDiffs].sort((a, b) => a - b);
    const medianAbsDiff = sortedAbsDiffs[Math.floor(sortedAbsDiffs.length / 2)] || 0;

    // 使用MAD * 3作为阈值（更敏感）
    const threshold = medianAbsDiff * 3;

    // 检测差值超过阈值的点
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(diffs[i - 1]);

      if (diff > threshold && diff > 5) { // 至少5的差异才认为是变化点
        changes.push({
          index: i,
          timestamp: points[i].timestamp,
          before: points[i - 1].value,
          after: points[i].value,
          magnitude: diff
        });
      }
    }

    return changes;
  }

  /**
   * 计算置信度
   *
   * @param rSquared - R²（拟合优度）
   * @returns 置信度（0-1）
   *
   * @private
   */
  private calculateConfidence(rSquared: number): number {
    return Math.max(0, Math.min(1, rSquared));
  }
}
