/**
 * AnalyticsService - Analytics 主服务
 *
 * @description
 * 编排所有聚合器和分析器，提供统一的 Analytics 查询接口
 *
 * @remarks
 * 核心职责：
 * 1. 编排聚合器和分析器
 * 2. 管理缓存
 * 3. 提供查询接口
 */

import type { TimePeriod } from './models/TimePeriod.js';
import type {
  UsageMetrics,
  QualityMetrics,
  PerformanceMetrics,
  TrendMetrics,
  TrendData,
  DashboardData,
  Anomaly,
  TrendComparison
} from './models/Metrics.js';
import type { DataSourceMetadata } from './models/Metrics.js';

import type { IDataReader } from './readers/IDataReader.js';
import type { RetroRecord } from '../../types/index.js';
import type { ViolationRecord } from '../../types/index.js';
import type { MetricsRecord } from './models/Metrics.js';

import {
  CacheManager,
  CacheKey,
  UsageAggregator,
  QualityAggregator,
  PerformanceAggregator,
  TrendAggregator,
  TrendAnalyzer,
  AnomalyDetector
} from './index-full.js';
import { ViolationDataReader } from './readers/ViolationDataReader.js';
import { RetroDataReader } from './readers/RetroDataReader.js';
import { MetricsDataReader } from './readers/MetricsDataReader.js';
import { MemoryStore } from '../MemoryStore.js';

/**
 * AnalyticsService 配置
 */
export interface AnalyticsServiceConfig {
  /**
   * MemoryStore 实例
   */
  memoryStore: MemoryStore;

  /**
   * 缓存管理器（可选，默认创建新的）
   */
  cache?: CacheManager;

  /**
   * 缓存容量（默认 1000）
   */
  cacheSize?: number;

  /**
   * 默认 TTL（毫秒，默认 5 分钟）
   */
  defaultTTL?: number;
}

/**
 * AnalyticsService 类
 *
 * @description
 * Analytics 模块的主服务类
 *
 * @example
 * ```typescript
 * const service = new AnalyticsService({ memoryStore });
 * const metrics = await service.getUsageMetrics(TimePeriod.week());
 * const trend = await service.getTrendAnalysis('violations', TimePeriod.month());
 * const anomalies = await service.detectAnomalies();
 * ```
 */
export class AnalyticsService {
  private readonly retroReader: IDataReader<RetroRecord>;
  private readonly violationReader: IDataReader<ViolationRecord>;
  private readonly metricsReader: IDataReader<MetricsRecord>;

  private readonly usageAggregator: UsageAggregator;
  private readonly qualityAggregator: QualityAggregator;
  private readonly performanceAggregator: PerformanceAggregator;
  private readonly trendAggregator: TrendAggregator;

  private readonly trendAnalyzer: TrendAnalyzer;
  private readonly anomalyDetector: AnomalyDetector;

  private readonly cache: CacheManager;
  private readonly memoryStore: MemoryStore;

  /**
   * 构造函数
   *
   * @param config - 配置选项
   */
  constructor(config: AnalyticsServiceConfig) {
    this.memoryStore = config.memoryStore;

    // 初始化数据读取器（使用实际的 Reader 类）
    this.retroReader = new RetroDataReader({ memoryStore: this.memoryStore });
    this.violationReader = new ViolationDataReader({});
    this.metricsReader = new MetricsDataReader({});

    // 初始化聚合器
    this.usageAggregator = new UsageAggregator();
    this.qualityAggregator = new QualityAggregator();
    this.performanceAggregator = new PerformanceAggregator();
    this.trendAggregator = new TrendAggregator(this.memoryStore);

    // 初始化分析器
    this.trendAnalyzer = new TrendAnalyzer();
    this.anomalyDetector = new AnomalyDetector();

    // 初始化缓存
    this.cache = config.cache || new CacheManager({
      maxSize: config.cacheSize || 1000,
      defaultTTL: config.defaultTTL || 5 * 60 * 1000 // 5 分钟
    });
  }

  /**
   * 获取使用指标（带缓存）
   *
   * @param period - 时间范围
   * @returns 使用指标
   */
  async getUsageMetrics(period: TimePeriod): Promise<UsageMetrics> {
    const cacheKey = CacheKey.forUsage(period);
    const cached = await this.cache.get<UsageMetrics>(cacheKey);

    if (cached) {
      return cached;
    }

    // 读取数据
    const retros = await this.retroReader.readAll();

    // 聚合
    const metrics = await this.usageAggregator.aggregate(
      retros as any,
      period
    );

    // 缓存结果（5分钟 TTL）
    await this.cache.set(cacheKey, metrics, 5 * 60 * 1000);

    return metrics;
  }

  /**
   * 获取质量指标（带缓存）
   *
   * @param period - 时间范围
   * @returns 质量指标
   */
  async getQualityMetrics(period: TimePeriod): Promise<QualityMetrics> {
    const cacheKey = CacheKey.forQuality(period);
    const cached = await this.cache.get<QualityMetrics>(cacheKey);

    if (cached) {
      return cached;
    }

    // 读取数据
    const violations = await this.violationReader.readAll();

    // 聚合
    const metrics = await this.qualityAggregator.aggregate(violations, period);

    // 缓存结果
    await this.cache.set(cacheKey, metrics, 5 * 60 * 1000);

    return metrics;
  }

  /**
   * 获取性能指标（带缓存）
   *
   * @param period - 时间范围
   * @returns 性能指标
   */
  async getPerformanceMetrics(period: TimePeriod): Promise<PerformanceMetrics> {
    const cacheKey = CacheKey.forPerformance(period);
    const cached = await this.cache.get<PerformanceMetrics>(cacheKey);

    if (cached) {
      return cached;
    }

    // 读取数据
    const metrics = await this.metricsReader.readAll();

    // 聚合
    const perfMetrics = await this.performanceAggregator.aggregate(metrics, period);

    // 缓存结果
    await this.cache.set(cacheKey, perfMetrics, 5 * 60 * 1000);

    return perfMetrics;
  }

  /**
   * 获取趋势分析
   *
   * @param metric - 指标名称（'violations', 'usage', 'performance'）
   * @param period - 时间范围
   * @returns 趋势分析结果
   */
  async getTrendAnalysis(
    metric: string,
    period: TimePeriod
  ): Promise<TrendAnalysis> {
    const cacheKey = CacheKey.forTrend(metric, period);
    const cached = await this.cache.get<TrendAnalysis>(cacheKey);

    if (cached) {
      return cached;
    }

    // 构建趋势数据（从历史违规数据）
    const trendData = await this.buildTrendData(metric, period);

    // 分析
    const analysis = await this.trendAnalyzer.analyze(trendData);

    // 缓存结果
    await this.cache.set(cacheKey, analysis, 5 * 60 * 1000);

    return analysis;
  }

  /**
   * 构建趋势数据
   *
   * @param metric - 指标名称
   * @param period - 时间范围
   * @returns 趋势数据
   *
   * @private
   */
  private async buildTrendData(
    metric: string,
    period: TimePeriod
  ): Promise<TrendData> {
    const { TimeUtils } = await import('./utils/index.js');
    const violations = await this.violationReader.read(period.startTime, period.endTime);

    // 按天分组数据
    const dailyData = new Map<string, number>();

    // 初始化所有日期为 0
    let currentDate = TimeUtils.startOfDay(period.startTime);
    const endDate = TimeUtils.endOfDay(period.endTime);

    while (currentDate <= endDate) {
      const dateKey = TimeUtils.toDateKey(currentDate);
      dailyData.set(dateKey, 0);
      currentDate = TimeUtils.addDays(currentDate, 1);
    }

    // 填充实际数据
    for (const v of violations) {
      const dateKey = TimeUtils.toDateKey(v.timestamp);
      const count = dailyData.get(dateKey) || 0;
      dailyData.set(dateKey, count + 1);
    }

    // 转换为数据点
    const points = Array.from(dailyData.entries())
      .map(([date, value]) => ({
        timestamp: `${date}T12:00:00.000Z`,
        value
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return {
      metric,
      period: period.toString(),
      points
    };
  }

  /**
   * 检测异常
   *
   * @returns 异常列表
   */
  async detectAnomalies(): Promise<Anomaly[]> {
    const cacheKey = CacheKey.forAnomalies();
    const cached = await this.cache.get<Anomaly[]>(cacheKey);

    if (cached) {
      return cached;
    }

    // 获取最近 7 天的数据进行异常检测
    const { TimePeriod } = await import('./models/TimePeriod.js');
    // 使用 week() 方法获取最近7天
    const recentPeriod = TimePeriod.week();

    // 构建检测数据
    const violations = await this.violationReader.read(recentPeriod.startTime, recentPeriod.endTime);
    const retros = await this.retroReader.read(recentPeriod.startTime, recentPeriod.endTime);

    // 按天分组违规数据
    const { TimeUtils } = await import('./utils/index.js');
    const dailyViolations = new Map<string, number>();

    let currentDate = TimeUtils.startOfDay(recentPeriod.startTime);
    const endDate = TimeUtils.endOfDay(recentPeriod.endTime);

    while (currentDate <= endDate) {
      const dateKey = TimeUtils.toDateKey(currentDate);
      dailyViolations.set(dateKey, 0);
      currentDate = TimeUtils.addDays(currentDate, 1);
    }

    for (const v of violations) {
      const dateKey = TimeUtils.toDateKey(v.timestamp);
      const count = dailyViolations.get(dateKey) || 0;
      dailyViolations.set(dateKey, count + 1);
    }

    const violationValues = Array.from(dailyViolations.values());

    // 构建检测数据结构
    const data = {
      violations: violationValues,
      usage: [retros.length], // 简化：使用总复盘数
      performance: [], // 暂无性能数据
      quality: [violations.length > 0 ? violations.length / Math.max(1, retros.length) : 0] // 违规率
    };

    // 检测异常
    const anomalies = await this.anomalyDetector.analyze(data);

    // 缓存结果（较短 TTL，因为异常需要及时检测）
    await this.cache.set(cacheKey, anomalies, 60 * 1000); // 1 分钟 TTL

    return anomalies;
  }

  /**
   * 获取概览仪表板数据（综合）
   *
   * @param period - 时间范围
   * @returns 仪表板数据
   */
  async getDashboard(period: TimePeriod): Promise<DashboardData> {
    const cacheKey = CacheKey.forDashboard(period);
    const cached = await this.cache.get<DashboardData>(cacheKey);

    if (cached) {
      return cached;
    }

    // 并行获取所有指标
    const [usage, quality, performance, anomalies, trendAnalysis] = await Promise.all([
      this.getUsageMetrics(period),
      this.getQualityMetrics(period),
      this.getPerformanceMetrics(period),
      this.detectAnomalies(),
      this.getTrendAnalysis('violations', period)
    ]);

    // 获取趋势指标（包含 Top 违规）
    const violations = await this.violationReader.read(period.startTime, period.endTime);
    const trendMetrics = await this.trendAggregator.aggregate(violations, period);

    // 组装仪表板数据
    const dashboard: DashboardData = {
      summary: {
        totalChecks: usage.totalChecks,
        totalRetrospectives: usage.totalRetrospectives,
        avgViolationRate: quality.violationRate,
        avgPerformance: performance.avgCheckTime
      },
      trends: {
        violationTrend: trendAnalysis.direction,
        usageTrend: 'stable' // TODO: 可从使用趋势分析获取
      },
      alerts: anomalies,
      topViolations: trendMetrics.topViolations,
      period: period.toString(),
      generatedAt: new Date().toISOString()
    };

    // 缓存结果
    await this.cache.set(cacheKey, dashboard, 5 * 60 * 1000);

    return dashboard;
  }

  /**
   * 获取缓存统计
   *
   * @returns 缓存统计信息
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * 清除特定模式的缓存
   *
   * @param pattern - 缓存键模式
   * @returns 清理的项数
   */
  async clearCachePattern(pattern: string): Promise<number> {
    return await this.cache.deletePattern(pattern);
  }

  /**
   * 获取趋势对比（当前周期 vs 上一周期）
   *
   * @param metric - 指标名称
   * @param period - 当前周期时间范围
   * @returns 趋势对比结果
   */
  async getTrendComparison(
    metric: string,
    period: TimePeriod
  ): Promise<TrendComparison> {
    const cacheKey = `trend:compare:${metric}:${period.toString()}`;
    const cached = await this.cache.get<TrendComparison>(cacheKey);

    if (cached) {
      return cached;
    }

    // 计算上一周期（相同长度）
    const periodDuration = period.endTime.getTime() - period.startTime.getTime();
    const previousEndTime = new Date(period.startTime.getTime() - 1);
    const previousStartTime = new Date(previousEndTime.getTime() - periodDuration + 1);

    const { TimePeriod } = await import('./models/TimePeriod.js');
    const previousPeriod = new TimePeriod(previousStartTime, previousEndTime);

    // 并行获取两个周期的趋势分析
    const [currentAnalysis, previousAnalysis] = await Promise.all([
      this.getTrendAnalysis(metric, period),
      this.getTrendAnalysis(metric, previousPeriod)
    ]);

    // 计算当前值和上一周期值（使用数据点总和）
    const currentValue = this.sumDataPoints(currentAnalysis.smoothed);
    const previousValue = this.sumDataPoints(previousAnalysis.smoothed);

    const change = currentValue - previousValue;
    const percentChange = previousValue !== 0
      ? (change / previousValue)
      : 0;

    // 确定方向
    const direction: 'up' | 'down' | 'stable' = Math.abs(percentChange) < 0.05
      ? 'stable'
      : change > 0
        ? 'up'
        : 'down';

    // 计算改进率（对于违规指标，减少是改进）
    const isViolationMetric = metric === 'violations';
    const improvementRate = isViolationMetric
      ? (previousValue > 0 ? Math.max(0, -percentChange) : 1)
      : (previousValue > 0 ? Math.max(0, percentChange) : 0);

    const comparison: TrendComparison = {
      metric,
      currentValue,
      previousValue,
      change,
      percentChange,
      direction,
      improvementRate: Math.min(1, Math.max(0, improvementRate)),
      currentAnalysis,
      previousAnalysis
    };

    // 缓存结果
    await this.cache.set(cacheKey, comparison, 5 * 60 * 1000);

    return comparison;
  }

  /**
   * 计算数据点总和
   *
   * @param points - 数据点数组
   * @returns 总和
   *
   * @private
   */
  private sumDataPoints(points: { value: number }[]): number {
    return points.reduce((sum, point) => sum + point.value, 0);
  }
}
