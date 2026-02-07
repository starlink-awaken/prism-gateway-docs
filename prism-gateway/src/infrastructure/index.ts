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
