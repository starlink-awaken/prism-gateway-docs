/**
 * Anomaly 模型
 *
 * @description
 * 异常检测相关的类型定义
 *
 * @remarks
 * 从 Metrics.ts 重新导出异常相关类型，保持模块化
 */

// 重新导出 Metrics.ts 中的异常相关类型
export type {
  Anomaly,
  AnomalyType,
  AnomalySeverity
} from './Metrics.js';

/**
 * 异常检测配置
 *
 * @description
 * 异常检测算法的配置参数
 */
export interface AnomalyDetectionConfig {
  /**
   * Z-score 阈值（用于统计异常检测）
   *
   * @default 2.5
   */
  zScoreThreshold: number;

  /**
   * 性能阈值（毫秒）
   *
   * @default 1000
   */
  performanceThreshold: number;

  /**
   * 最小数据点数量
   *
   * @default 10
   */
  minDataPoints: number;

  /**
   * 使用下降阈值（0-1）
   *
   * @default 0.5
   */
  usageDropThreshold: number;
}

/**
 * 默认异常检测配置
 */
export const defaultAnomalyDetectionConfig: AnomalyDetectionConfig = {
  zScoreThreshold: 2.5,
  performanceThreshold: 1000,
  minDataPoints: 10,
  usageDropThreshold: 0.5
};

/**
 * 异常检测结果
 *
 * @description
 * 包含检测到的异常列表和统计信息
 */
export interface AnomalyDetectionResult {
  /**
   * 检测到的异常列表
   */
  anomalies: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high';
    metric: string;
    value: number;
    expected: number;
    timestamp: string;
    description: string;
  }>;

  /**
   * 检测的数据点总数
   */
  totalDataPoints: number;

  /**
   * 异常数量
   */
  anomalyCount: number;

  /**
   * 检测时间（ISO 8601）
   */
  detectedAt: string;
}
