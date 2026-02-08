/**
 * Metrics Infrastructure Module
 *
 * @module infrastructure/metrics
 */

// Core classes
export { MetricsService } from './MetricsService.js';
export type { MetricsServiceConfig } from './MetricsService.js';
export { MetricCollector } from './MetricCollector.js';
export { MetricsStorage } from './MetricsStorage.js';
export { MetricsAggregator } from './MetricsAggregator.js';
export { QueryEngine } from './QueryEngine.js';

// Built-in collectors
export {
  SystemMetricsCollector,
  ProcessMetricsCollector,
  APIMetricsCollector,
  WebSocketMetricsCollector,
  BusinessMetricsCollector,
  DataMetricsCollector
} from './collectors.js';

// Types
export {
  MetricType,
  AggregationFunction,
  TimeSeriesGranularity
} from './types.js';

export type {
  MetricDataPoint,
  AggregatedMetricPoint,
  MetricCollectorConfig,
  SystemMetricsSnapshot,
  ProcessMetricsSnapshot,
  APIMetricsSnapshot,
  WebSocketMetricsSnapshot,
  BusinessMetricsSnapshot,
  DataMetricsSnapshot,
  MetricsQueryFilter,
  MetricsQueryResult,
  MetricsStorageConfig,
  MetricsStorageStats,
  MetricsServiceStats,
  MetricMetadata,
  TimeRange,
  DownsamplingConfig,
  MetricsSnapshot
} from './types.js';
