/**
 * PRISM-Gateway Analytics 模块
 *
 * @description
 * 数据分析核心模块，提供聚合、分析和查询功能
 *
 * @example
 * ```typescript
 * import { AnalyticsService } from './core/analytics/AnalyticsService.js';
 * import { TimePeriod } from './core/analytics/models/TimePeriod.js';
 *
 * const service = new AnalyticsService({ memoryStore });
 * const metrics = await service.getUsageMetrics(TimePeriod.week());
 * ```
 */

// 数据模型
export * from './models/TimePeriod.js';
export * from './models/Metrics.js';
export * from './models/Anomaly.js';

// 工具类
export * from './utils/MathUtils.js';
export * from './utils/TimeUtils.js';

// 缓存管理
export * from './cache/CacheKey.js';
export * from './cache/CacheManager.js';

// 数据读取器
export * from './readers/IDataReader.js';
export * from './readers/ViolationDataReader.js';
export * from './readers/RetroDataReader.js';
export * from './readers/MetricsDataReader.js';

// 聚合器
export * from './aggregators/IAggregator.js';
export * from './aggregators/UsageAggregator.js';
export * from './aggregators/QualityAggregator.js';
export * from './aggregators/PerformanceAggregator.js';
export * from './aggregators/TrendAggregator.js';

// 分析器
export * from './analyzers/IAnalyzer.js';
export * from './analyzers/TrendAnalyzer.js';
export * from './analyzers/AnomalyDetector.js';

// 主服务
export { AnalyticsService } from './AnalyticsService.js';
export type { AnalyticsServiceConfig } from './AnalyticsService.js';
