/**
 * MathUtils - 数学工具类
 *
 * @description
 * 提供统计分析相关的数学计算函数
 *
 * @remarks
 * 包含常用的统计计算：
 * - 平均值、中位数、众数
 * - 标准差、方差
 * - 百分位数
 * - 线性回归
 */

/**
 * 线性回归结果
 */
export interface LinearRegressionResult {
  /**
   * 斜率
   */
  slope: number;

  /**
   * 截距
   */
  intercept: number;

  /**
   * R²（拟合优度）
   */
  rSquared: number;

  /**
   * 相关系数
   */
  correlation: number;
}

/**
 * 二维点（用于线性回归）
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 数学工具类
 */
export class MathUtils {
  /**
   * 计算平均值
   *
   * @param values - 数值数组
   * @returns 平均值，空数组返回 0
   *
   * @example
   * ```typescript
   * MathUtils.mean([1, 2, 3, 4, 5]); // 3
   * ```
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * 计算中位数
   *
   * @param values - 数值数组
   * @returns 中位数，空数组返回 0
   *
   * @example
   * ```typescript
   * MathUtils.median([1, 2, 3, 4, 5]); // 3
   * MathUtils.median([1, 2, 3, 4]); // 2.5
   * ```
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * 计算众数（出现最频繁的值）
   *
   * @param values - 数值数组
   * @returns 众数值数组，空数组返回空数组
   *
   * @example
   * ```typescript
   * MathUtils.mode([1, 2, 2, 3, 3, 3]); // [3]
   * MathUtils.mode([1, 1, 2, 2]); // [1, 2]
   * ```
   */
  static mode(values: number[]): number[] {
    if (values.length === 0) return [];

    const frequency = new Map<number, number>();
    for (const value of values) {
      frequency.set(value, (frequency.get(value) || 0) + 1);
    }

    const maxFreq = Math.max(...frequency.values());
    const modes = Array.from(frequency.entries())
      .filter(([_, freq]) => freq === maxFreq)
      .map(([value, _]) => value);

    return modes;
  }

  /**
   * 计算方差
   *
   * @param values - 数值数组
   * @returns 方差，空数组返回 0
   *
   * @example
   * ```typescript
   * MathUtils.variance([1, 2, 3, 4, 5]); // 2
   * ```
   */
  static variance(values: number[]): number {
    if (values.length === 0) return 0;

    const mu = this.mean(values);
    const squaredDiffs = values.map(value => Math.pow(value - mu, 2));
    return this.mean(squaredDiffs);
  }

  /**
   * 计算标准差
   *
   * @param values - 数值数组
   * @returns 标准差，空数组返回 0
   *
   * @example
   * ```typescript
   * MathUtils.standardDeviation([1, 2, 3, 4, 5]); // ~1.414
   * ```
   */
  static standardDeviation(values: number[]): number {
    return Math.sqrt(this.variance(values));
  }

  /**
   * 计算百分位数
   *
   * @param values - 数值数组
   * @param percentile - 百分位数（0-100）
   * @returns 百分位数值，空数组返回 0
   *
   * @example
   * ```typescript
   * MathUtils.percentile([1, 2, 3, 4, 5], 50); // 3 (中位数)
   * MathUtils.percentile([1, 2, 3, 4, 5], 95); // 4.8 (P95)
   * ```
   */
  static percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    if (percentile < 0 || percentile > 100) {
      throw new Error('Percentile must be between 0 and 100');
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);

    if (Number.isInteger(index)) {
      return sorted[index];
    } else {
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
  }

  /**
   * 计算最小值
   *
   * @param values - 数值数组
   * @returns 最小值，空数组返回 Infinity
   *
   * @example
   * ```typescript
   * MathUtils.min([1, 2, 3, 4, 5]); // 1
   * ```
   */
  static min(values: number[]): number {
    if (values.length === 0) return Infinity;
    return Math.min(...values);
  }

  /**
   * 计算最大值
   *
   * @param values - 数值数组
   * @returns 最大值，空数组返回 -Infinity
   *
   * @example
   * ```typescript
   * MathUtils.max([1, 2, 3, 4, 5]); // 5
   * ```
   */
  static max(values: number[]): number {
    if (values.length === 0) return -Infinity;
    return Math.max(...values);
  }

  /**
   * 计算总和
   *
   * @param values - 数值数组
   * @returns 总和，空数组返回 0
   *
   * @example
   * ```typescript
   * MathUtils.sum([1, 2, 3, 4, 5]); // 15
   * ```
   */
  static sum(values: number[]): number {
    return values.reduce((acc, val) => acc + val, 0);
  }

  /**
   * 线性回归分析
   *
   * @param points - 二维点数组
   * @returns 线性回归结果
   *
   * @example
   * ```typescript
   * const points = [
   *   { x: 0, y: 1 },
   *   { x: 1, y: 2 },
   *   { x: 2, y: 3 }
   * ];
   * const result = MathUtils.linearRegression(points);
   * // result.slope ≈ 1
   * // result.intercept ≈ 1
   * // result.rSquared ≈ 1
   * ```
   */
  static linearRegression(points: Point2D[]): LinearRegressionResult {
    if (points.length < 2) {
      throw new Error('At least 2 points are required for linear regression');
    }

    const n = points.length;
    const sumX = this.sum(points.map(p => p.x));
    const sumY = this.sum(points.map(p => p.y));
    const sumXY = this.sum(points.map(p => p.x * p.y));
    const sumXX = this.sum(points.map(p => p.x * p.x));
    const sumYY = this.sum(points.map(p => p.y * p.y));

    // 计算斜率和截距
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算相关系数
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY)
    );
    const correlation = denominator === 0 ? 0 : numerator / denominator;

    // 计算 R²
    const rSquared = correlation * correlation;

    return {
      slope,
      intercept,
      rSquared,
      correlation
    };
  }

  /**
   * 四舍五入到指定小数位
   *
   * @param value - 数值
   * @param decimals - 小数位数
   * @returns 四舍五入后的数值
   *
   * @example
   * ```typescript
   * MathUtils.round(3.14159, 2); // 3.14
   * MathUtils.round(3.14159, 4); // 3.1416
   * ```
   */
  static round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * 计算变化率
   *
   * @param oldValue - 旧值
   * @param newValue - 新值
   * @returns 变化率（百分比）
   *
   * @example
   * ```typescript
   * MathUtils.rateOfChange(100, 150); // 0.5 (增长50%)
   * MathUtils.rateOfChange(150, 100); // -0.333... (下降33.3%)
   * ```
   */
  static rateOfChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return (newValue - oldValue) / Math.abs(oldValue);
  }

  /**
   * 计算移动平均
   *
   * @param values - 数值数组
   * @param windowSize - 窗口大小
   * @returns 移动平均数组
   *
   * @example
   * ```typescript
   * MathUtils.movingAverage([1, 2, 3, 4, 5], 3); // [2, 3, 4]
   * ```
   */
  static movingAverage(values: number[], windowSize: number): number[] {
    if (windowSize <= 0 || windowSize > values.length) {
      throw new Error('Invalid window size');
    }

    const result: number[] = [];

    for (let i = 0; i <= values.length - windowSize; i++) {
      const window = values.slice(i, i + windowSize);
      result.push(this.mean(window));
    }

    return result;
  }

  /**
   * 计算 Z-score
   *
   * @param value - 数值
   * @param mean - 平均值
   * @param stdDev - 标准差
   * @returns Z-score
   *
   * @example
   * ```typescript
   * MathUtils.zScore(15, 10, 2); // 2.5
   * ```
   */
  static zScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }
}
