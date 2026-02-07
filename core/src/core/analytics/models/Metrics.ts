/**
 * Analytics 数据模型定义
 *
 * @description
 * 定义所有 Analytics 模块使用的数据结构
 *
 * @remarks
 * 包含四类核心指标：
 * 1. UsageMetrics - 使用指标
 * 2. QualityMetrics - 质量指标
 * 3. PerformanceMetrics - 性能指标
 * 4. TrendMetrics - 趋势指标
 */

/**
 * 使用指标
 *
 * @description
 * 衡量 PRISM-Gateway 的使用情况
 */
export interface UsageMetrics {
  /**
   * 总检查次数
   */
  totalChecks: number;

  /**
   * 总复盘次数
   */
  totalRetrospectives: number;

  /**
   * 日活用户数（平均）
   */
  dailyActiveUsers: number;

  /**
   * 平均会话时长（毫秒）
   */
  avgSessionDuration: number;

  /**
   * 时间范围
   */
  period: string;

  /**
   * 计算时间（ISO 8601）
   */
  calculatedAt: string;
}

/**
 * 质量指标
 *
 * @description
 * 衡量 PRISM-Gateway 的质量表现
 */
export interface QualityMetrics {
  /**
   * 违规率（违规次数 / 总检查次数）
   */
  violationRate: number;

  /**
   * 误报率
   */
  falsePositiveRate: number;

  /**
   * 模式匹配准确率
   */
  patternMatchAccuracy: number;

  /**
   * 时间范围
   */
  period: string;

  /**
   * 计算时间（ISO 8601）
   */
  calculatedAt: string;
}

/**
 * 性能指标
 *
 * @description
 * 衡量 PRISM-Gateway 的性能表现
 */
export interface PerformanceMetrics {
  /**
   * 平均检查时间（毫秒）
   */
  avgCheckTime: number;

  /**
   * 平均提取时间（毫秒）
   */
  avgExtractTime: number;

  /**
   * P95 检查时间（毫秒）
   */
  p95CheckTime: number;

  /**
   * P99 检查时间（毫秒）
   */
  p99CheckTime: number;

  /**
   * 最小检查时间（毫秒）
   */
  minCheckTime: number;

  /**
   * 最大检查时间（毫秒）
   */
  maxCheckTime: number;

  /**
   * 时间范围
   */
  period: string;

  /**
   * 计算时间（ISO 8601）
   */
  calculatedAt: string;
}

/**
 * Top 违规项
 *
 * @description
 * 最常见的违规统计
 */
export interface TopViolation {
  /**
   * 原则ID
   */
  principleId: string;

  /**
   * 原则名称
   */
  principleName: string;

  /**
   * 违规次数
   */
  count: number;

  /**
   * 占比（0-1）
   */
  percentage: number;
}

/**
 * 趋势指标
 *
 * @description
 * 衡量指标的变化趋势
 */
export interface TrendMetrics {
  /**
   * 违规趋势方向
   */
  violationTrend: 'up' | 'down' | 'stable';

  /**
   * 改进率（0-1）
   */
  improvementRate: number;

  /**
   * Top 违规列表
   */
  topViolations: TopViolation[];

  /**
   * 时间范围
   */
  period: string;

  /**
   * 计算时间（ISO 8601）
   */
  calculatedAt: string;
}

/**
 * 数据点
 *
 * @description
 * 时间序列数据的一个点
 */
export interface DataPoint {
  /**
   * 时间戳（ISO 8601）
   */
  timestamp: string;

  /**
   * 数值
   */
  value: number;
}

/**
 * 趋势数据
 *
 * @description
 * 用于趋势分析的时间序列数据
 */
export interface TrendData {
  /**
   * 指标名称
   */
  metric: string;

  /**
   * 时间范围
   */
  period: string;

  /**
   * 数据点数组
   */
  points: DataPoint[];
}

/**
 * 变化点
 *
 * @description
 * 检测到的数据变化点
 */
export interface ChangePoint {
  /**
   * 索引位置
   */
  index: number;

  /**
   * 时间戳（ISO 8601）
   */
  timestamp: string;

  /**
   * 变化前的值
   */
  before: number;

  /**
   * 变化后的值
   */
  after: number;

  /**
   * 变化幅度
   */
  magnitude: number;
}

/**
 * 趋势分析结果
 *
 * @description
 * 趋势分析的完整结果
 */
export interface TrendAnalysis {
  /**
   * 趋势方向
   */
  direction: 'up' | 'down' | 'stable';

  /**
   * 线性回归斜率
   */
  slope: number;

  /**
   * R²（拟合优度）
   */
  rSquared: number;

  /**
   * 平滑后的数据点
   */
  smoothed: DataPoint[];

  /**
   * 变化点列表
   */
  changePoints: ChangePoint[];

  /**
   * 置信度（0-1）
   */
  confidence: number;
}

/**
 * 趋势对比结果
 *
 * @description
 * 当前周期与上一周期的对比数据
 */
export interface TrendComparison {
  /**
   * 指标名称
   */
  metric: string;

  /**
   * 当前值
   */
  currentValue: number;

  /**
   * 上一周期值
   */
  previousValue: number;

  /**
   * 绝对变化量
   */
  change: number;

  /**
   * 百分比变化（-1 到 1）
   */
  percentChange: number;

  /**
   * 变化方向
   */
  direction: 'up' | 'down' | 'stable';

  /**
   * 改进率（0-1）
   */
  improvementRate: number;

  /**
   * 当前周期趋势分析
   */
  currentAnalysis: TrendAnalysis;

  /**
   * 上一周期趋势分析
   */
  previousAnalysis: TrendAnalysis;
}

/**
 * 异常类型
 */
export type AnomalyType =
  | 'violation_spike'      // 违规激增
  | 'usage_drop'           // 使用骤降
  | 'performance_degradation'  // 性能下降
  | 'quality_drop';        // 质量下降

/**
 * 异常严重程度
 */
export type AnomalySeverity = 'low' | 'medium' | 'high';

/**
 * 异常
 *
 * @description
 * 检测到的数据异常
 */
export interface Anomaly {
  /**
   * 异常ID
   */
  id: string;

  /**
   * 异常类型
   */
  type: AnomalyType;

  /**
   * 严重程度
   */
  severity: AnomalySeverity;

  /**
   * 相关指标名称
   */
  metric: string;

  /**
   * 实际值
   */
  value: number;

  /**
   * 期望值
   */
  expected: number;

  /**
   * 时间戳（ISO 8601）
   */
  timestamp: string;

  /**
   * 描述信息
   */
  description: string;
}

/**
 * 仪表板数据
 *
 * @description
 * 综合仪表板数据，包含各类指标摘要
 */
export interface DashboardData {
  /**
   * 摘要统计
   */
  summary: {
    /**
     * 总检查次数
     */
    totalChecks: number;

    /**
     * 总复盘次数
     */
    totalRetrospectives: number;

    /**
     * 平均违规率
     */
    avgViolationRate: number;

    /**
     * 平均性能（毫秒）
     */
    avgPerformance: number;
  };

  /**
   * 趋势摘要
   */
  trends: {
    /**
     * 违规趋势
     */
    violationTrend: 'up' | 'down' | 'stable';

    /**
     * 使用趋势
     */
    usageTrend: 'up' | 'down' | 'stable';
  };

  /**
   * 告警列表（异常）
   */
  alerts: Anomaly[];

  /**
   * Top 违规列表
   */
  topViolations: TopViolation[];

  /**
   * 时间范围
   */
  period: string;

  /**
   * 生成时间（ISO 8601）
   */
  generatedAt: string;
}

/**
 * 指标记录（用于数据读取）
 *
 * @description
 * 从指标存储读取的原始记录
 */
export interface MetricsRecord {
  /**
   * 记录ID
   */
  id: string;

  /**
   * 时间戳（ISO 8601）
   */
  timestamp: string;

  /**
   * 检查时间（毫秒）
   */
  checkTime?: number;

  /**
   * 提取时间（毫秒）
   */
  extractTime?: number;

  /**
   * 是否有违规
   */
  hasViolation?: boolean;

  /**
   * 复盘ID（可选）
   */
  retroId?: string;

  /**
   * 其他元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * 数据源元信息
 *
 * @description
 * 数据源的元数据
 */
export interface DataSourceMetadata {
  /**
   * 数据源类型
   */
  type: string;

  /**
   * 数据总数
   */
  count: number;

  /**
   * 最早时间戳（ISO 8601）
   */
  oldestTimestamp: string | null;

  /**
   * 最晚时间戳（ISO 8601）
   */
  newestTimestamp: string | null;
}
