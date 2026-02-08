/**
 * Health Check Infrastructure Module
 *
 * @module infrastructure/health
 */

// Core classes
export { HealthCheckService } from './HealthCheckService.js';
export type { HealthCheckServiceConfig } from './HealthCheckService.js';
export { HealthChecker } from './HealthChecker.js';
export { HealthScheduler } from './HealthScheduler.js';

// Built-in checkers
export {
  SystemHealthChecker,
  DiskHealthChecker,
  DataHealthChecker,
  APIHealthChecker
} from './checkers.js';

// Types
export {
  HealthStatus,
  CheckSeverity
} from './types.js';

export type {
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
} from './types.js';
