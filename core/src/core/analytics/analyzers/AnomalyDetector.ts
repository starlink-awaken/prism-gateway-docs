/**
 * AnomalyDetector - 异常检测器
 *
 * @description
 * 检测数据异常（Z-score、性能下降、使用骤降）
 */

import type { IAnalyzer, AnalysisOptions } from './IAnalyzer.js';
import type {
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyDetectionConfig
} from '../models/Anomaly.js';
import { defaultAnomalyDetectionConfig } from '../models/Anomaly.js';
import type { MetricsData, DashboardData } from '../models/Metrics.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * 扩展的 MetricsData（包含 violations）
 */
interface ExtendedMetricsData extends MetricsData {
  violations?: Array<{
    timestamp: string;
    count?: number;
  }>;
  performance?: {
    checkTimes?: number[];
    timestamps?: string[];
  };
  usage?: {
    dailyActive?: number[];
    timestamps?: string[];
  };
}

/**
 * AnomalyDetector 类
 *
 * @description
 * 检测数据异常
 *
 * @example
 * ```typescript
 * const detector = new AnomalyDetector();
 * const data: ExtendedMetricsData = { violations: [...], ... };
 * const anomalies = await detector.analyze(data);
 * console.log(`检测到 ${anomalies.length} 个异常`);
 * ```
 */
export class AnomalyDetector implements IAnalyzer<ExtendedMetricsData, Anomaly[]> {
  private readonly config: AnomalyDetectionConfig;

  /**
   * 构造函数
   *
   * @param config - 异常检测配置
   */
  constructor(config: AnomalyDetectionConfig = {}) {
    this.config = { ...defaultAnomalyDetectionConfig, ...config };
  }

  /**
   * 检测异常
   *
   * @param data - 数据
   * @param options - 分析选项
   * @returns 异常列表
   */
  async analyze(
    data: ExtendedMetricsData,
    options?: AnalysisOptions
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // 1. 检测违规率异常
    const violationAnomalies = this.detectViolationAnomalies(data);
    anomalies.push(...violationAnomalies);

    // 2. 检测性能异常
    const performanceAnomalies = this.detectPerformanceAnomalies(data);
    anomalies.push(...performanceAnomalies);

    // 3. 检测使用异常（如突然下降）
    const usageAnomalies = this.detectUsageAnomalies(data);
    anomalies.push(...usageAnomalies);

    return anomalies;
  }

  /**
   * 检测违规异常
   *
   * @param data - 数据
   * @returns 违规异常列表
   *
   * @private
   */
  private detectViolationAnomalies(data: ExtendedMetricsData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const violations = data.violations || [];

    if (violations.length < this.config.minDataPoints) {
      return [];
    }

    // 提取违规数量
    const values = violations.map(v => v.count || 1);

    // Z-score 检测
    const mean = MathUtils.mean(values);
    const std = MathUtils.standardDeviation(values);

    for (let i = 0; i < violations.length; i++) {
      const value = values[i];
      const zScore = Math.abs((value - mean) / std);

      if (zScore > this.config.zScoreThreshold) {
        const severity = zScore > 3 ? 'high' : 'medium';

        anomalies.push({
          id: `violation-${i}`,
          type: 'violation_spike',
          severity,
          metric: 'violations',
          value,
          expected: mean,
          timestamp: violations[i].timestamp,
          description: `违规数量异常: ${value} (期望: ${mean.toFixed(2)})`
        });
      }
    }

    return anomalies;
  }

  /**
   * 检测性能异常
   *
   * @param data - 数据
   * @returns 性能异常列表
   *
   * @private
   */
  private detectPerformanceAnomalies(data: ExtendedMetricsData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const checkTimes = data.performance?.checkTimes || [];
    const timestamps = data.performance?.timestamps || [];

    if (checkTimes.length === 0) {
      return [];
    }

    const threshold = this.config.performanceThreshold;

    for (let i = 0; i < checkTimes.length; i++) {
      const value = checkTimes[i];

      if (value > threshold) {
        const severity = value > threshold * 2 ? 'high' : 'medium';

        anomalies.push({
          id: `perf-${i}`,
          type: 'performance_degradation',
          severity,
          metric: 'check_time',
          value,
          expected: threshold,
          timestamp: timestamps[i] || new Date().toISOString(),
          description: `检查时间过长: ${value}ms (阈值: ${threshold}ms)`
        });
      }
    }

    return anomalies;
  }

  /**
   * 检测使用异常
   *
   * @param data - 数据
   * @returns 使用异常列表
   *
   * @private
   */
  private detectUsageAnomalies(data: ExtendedMetricsData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const dailyActive = data.usage?.dailyActive || [];

    if (dailyActive.length < 2) {
      return [];
    }

    // 检测日活突然下降
    for (let i = 1; i < dailyActive.length; i++) {
      const drop = dailyActive[i - 1] - dailyActive[i];
      const dropRate = drop / (dailyActive[i - 1] || 1);

      if (dropRate > this.config.usageDropThreshold) {
        anomalies.push({
          id: `usage-${i}`,
          type: 'usage_drop',
          severity: 'high',
          metric: 'daily_active_users',
          value: dailyActive[i],
          expected: dailyActive[i - 1],
          timestamp: data.usage?.timestamps?.[i] || new Date().toISOString(),
          description: `日活用户骤降: ${dailyActive[i]} (前日: ${dailyActive[i - 1]})`
        });
      }
    }

    return anomalies;
  }
}
