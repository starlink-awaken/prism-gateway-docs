/**
 * Infrastructure 模块导出
 *
 * @description
 * 统一导出基础设施相关的类型和函数
 */

// 日志模块
export { Logger, createLogger, defaultLogger, LogLevel } from './logging/index.js';
export type { LoggerOptions, LogContext, LogMetadata } from './logging/index.js';

// 监控模块
export {
  Metrics,
  CounterMetric,
  HistogramMetric,
  GaugeMetric,
  MetricType,
  AlertManager,
  createAlertManager,
  AlertRule,
  AlertSeverity,
  AlertStatus,
  AlertCondition,
  Dashboard
} from './monitoring/index.js';
export type {
  HttpRequestMetric,
  MetricLabels,
  PercentileResult,
  AlertEvent,
  AlertManagerOptions,
  DashboardOptions,
  HealthStatus
} from './monitoring/index.js';

// 文件锁模块
export { FileLock, LockMonitor } from './lock/index.js';
export type {
  FileLockOptions,
  LockAcquireOptions,
  LockStats,
  LockMonitorOptions
} from './lock/index.js';

// 备份模块
export { BackupService, BackupEngine, StorageManager, BackupScheduler } from './backup/index.js';
export type {
  BackupConfig,
  BackupMetadata,
  BackupFilter,
  BackupStats,
  VerifyResult,
  RestoreOptions,
  StorageStats,
  FileDiff,
  CompressResult,
  BackupManifest,
  RetentionPolicy,
  ScheduleConfig
} from './backup/index.js';
export { BackupType, BackupStatus } from './backup/index.js';

// 健康检查模块
export {
  HealthCheckService,
  HealthChecker,
  HealthScheduler,
  SystemHealthChecker,
  DiskHealthChecker,
  DataHealthChecker,
  APIHealthChecker,
  HealthStatus,
  CheckSeverity
} from './health/index.js';
export type {
  HealthCheckServiceConfig,
  HealthCheckResult,
  HealthReport,
  HealthCheckConfig,
  HealthScheduleConfig,
  HealthStats,
  SystemMetrics,
  DiskMetrics,
  DataIntegrityResult,
  ServiceHealthResult,
  NetworkHealthResult,
  HealthHistoryEntry,
  HealthCheckFilter,
  HealthAlertConfig,
  SelfHealingAction
} from './health/index.js';

// 指标收集模块
export {
  MetricsService,
  MetricCollector,
  MetricsStorage,
  MetricsAggregator,
  QueryEngine,
  SystemMetricsCollector,
  ProcessMetricsCollector,
  APIMetricsCollector,
  WebSocketMetricsCollector,
  BusinessMetricsCollector,
  DataMetricsCollector,
  MetricType,
  AggregationFunction,
  TimeSeriesGranularity
} from './metrics/index.js';
export type {
  MetricsServiceConfig,
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
} from './metrics/index.js';
