/**
 * Monitoring 模块导出
 *
 * @description
 * 统一导出监控相关的类型和函数
 */

export {
  Metrics,
  CounterMetric,
  HistogramMetric,
  GaugeMetric,
  MetricType
} from './Metrics.js';
export type { HttpRequestMetric, MetricLabels, PercentileResult } from './Metrics.js';

export {
  AlertManager,
  createAlertManager,
  AlertRule,
  AlertSeverity,
  AlertStatus,
  AlertCondition
} from './AlertManager.js';
export type { AlertEvent, AlertManagerOptions } from './AlertManager.js';

export { Dashboard } from './Dashboard.js';
export type { DashboardOptions, HealthStatus } from './Dashboard.js';
