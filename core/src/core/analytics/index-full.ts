/**
 * Analytics 模块统一导出入口
 *
 * @description
 * 解决 Bun 模块解析问题，提供统一的导出入口
 *
 * @usage
 * ```typescript
 * // 使用绝对导入
 * import { AnalyticsService } from './core/analytics/index-full.js';
 * ```
 */

// 导出所有模型
export * from './models/TimePeriod.js';
export * from './models/Metrics.js';
export * from './models/Anomaly.js';

// 导出工具类
export * from './utils/MathUtils.js';
export * from './utils/TimeUtils.js';

// 导出缓存
export * from './cache/CacheManager.js';
export * from './cache/CacheKey.js';

// 导出聚合器
export * from './aggregators/IAggregator.js';
export * from './aggregators/UsageAggregator.js';
export * from './aggregators/QualityAggregator.js';
export * from './aggregators/PerformanceAggregator.js';
export * from './aggregators/TrendAggregator.js';

// 导出分析器
export * from './analyzers/IAnalyzer.js';
export * from './analyzers/TrendAnalyzer.js';
export * from './analyzers/AnomalyDetector.js';

// 导出读取器
export * from './readers/IDataReader.js';
export * from './readers/RetroDataReader.js';
export * from './readers/ViolationDataReader.js';
export * from './readers/MetricsDataReader.js';

// 导出主服务
export { AnalyticsService } from './AnalyticsService.js';
export type { AnalyticsServiceConfig } from './AnalyticsService.js';
