/**
 * PRISM-Gateway Health Check Types
 *
 * @module infrastructure/health/types
 */

/**
 * Health status levels
 */
export enum HealthStatus {
  /** All checks passed */
  Healthy = 'healthy',
  /** Some non-critical issues detected */
  Degraded = 'degraded',
  /** Critical issues detected */
  Unhealthy = 'unhealthy',
  /** Check could not be performed */
  Unknown = 'unknown'
}

/**
 * Health check severity levels
 */
export enum CheckSeverity {
  /** Critical check - failure means system is unhealthy */
  Critical = 'critical',
  /** Important check - failure means system is degraded */
  Important = 'important',
  /** Optional check - failure is informational */
  Optional = 'optional'
}

/**
 * Result of a single health check
 */
export interface HealthCheckResult {
  /** Check name */
  name: string;
  /** Check status */
  status: HealthStatus;
  /** Check severity */
  severity: CheckSeverity;
  /** Check duration in milliseconds */
  duration: number;
  /** Timestamp when check was performed */
  timestamp: string;
  /** Human-readable message */
  message: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Error if check failed */
  error?: string;
}

/**
 * Overall system health report
 */
export interface HealthReport {
  /** Overall status */
  status: HealthStatus;
  /** Individual check results */
  checks: HealthCheckResult[];
  /** Timestamp of report generation */
  timestamp: string;
  /** Report generation duration */
  duration: number;
  /** System uptime in seconds */
  uptime: number;
  /** System version */
  version: string;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Check name (must be unique) */
  name: string;
  /** Check severity */
  severity: CheckSeverity;
  /** Check interval in seconds */
  interval: number;
  /** Check timeout in milliseconds */
  timeout: number;
  /** Whether check is enabled */
  enabled: boolean;
  /** Check-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Health check schedule configuration
 */
export interface HealthScheduleConfig {
  /** Schedule for critical checks (seconds) */
  criticalInterval: number;
  /** Schedule for important checks (seconds) */
  importantInterval: number;
  /** Schedule for optional checks (seconds) */
  optionalInterval: number;
  /** Whether to run all checks on startup */
  runOnStartup: boolean;
}

/**
 * Health check statistics
 */
export interface HealthStats {
  /** Total checks performed */
  totalChecks: number;
  /** Successful checks */
  successfulChecks: number;
  /** Failed checks */
  failedChecks: number;
  /** Average check duration (ms) */
  avgDuration: number;
  /** Last check timestamp */
  lastCheck?: string;
  /** Uptime percentage (0-100) */
  uptimePercentage: number;
}

/**
 * System health metrics
 */
export interface SystemMetrics {
  /** CPU usage percentage (0-100) */
  cpuUsage: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Total memory in bytes */
  totalMemory: number;
  /** Memory usage percentage (0-100) */
  memoryPercentage: number;
  /** System load average (1, 5, 15 minutes) */
  loadAverage: [number, number, number];
  /** Process uptime in seconds */
  uptime: number;
}

/**
 * Disk health metrics
 */
export interface DiskMetrics {
  /** Disk path */
  path: string;
  /** Total space in bytes */
  total: number;
  /** Used space in bytes */
  used: number;
  /** Available space in bytes */
  available: number;
  /** Usage percentage (0-100) */
  percentage: number;
}

/**
 * Data integrity check result
 */
export interface DataIntegrityResult {
  /** File path */
  path: string;
  /** Whether file exists */
  exists: boolean;
  /** Whether file is readable */
  readable: boolean;
  /** Whether file is writable */
  writable: boolean;
  /** File size in bytes */
  size?: number;
  /** Last modified timestamp */
  modified?: string;
}

/**
 * Service health check result
 */
export interface ServiceHealthResult {
  /** Service name */
  name: string;
  /** Service status */
  status: 'running' | 'stopped' | 'error';
  /** Service response time (ms) */
  responseTime?: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Network health check result
 */
export interface NetworkHealthResult {
  /** Target host/URL */
  target: string;
  /** Whether target is reachable */
  reachable: boolean;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Status code (for HTTP checks) */
  statusCode?: number;
  /** Error message if unreachable */
  error?: string;
}

/**
 * Health check history entry
 */
export interface HealthHistoryEntry {
  /** Check name */
  name: string;
  /** Check status */
  status: HealthStatus;
  /** Timestamp */
  timestamp: string;
  /** Check duration */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Health check filter options
 */
export interface HealthCheckFilter {
  /** Filter by check name */
  name?: string;
  /** Filter by status */
  status?: HealthStatus;
  /** Filter by severity */
  severity?: CheckSeverity;
  /** Filter by enabled state */
  enabled?: boolean;
}

/**
 * Health alert configuration
 */
export interface HealthAlertConfig {
  /** Alert threshold for degraded state (percentage of failed checks) */
  degradedThreshold: number;
  /** Alert threshold for unhealthy state (percentage of failed checks) */
  unhealthyThreshold: number;
  /** Cooldown period between alerts (seconds) */
  cooldownPeriod: number;
  /** Whether to enable self-healing */
  enableSelfHealing: boolean;
}

/**
 * Self-healing action
 */
export interface SelfHealingAction {
  /** Action name */
  name: string;
  /** Check that triggered this action */
  checkName: string;
  /** Action function */
  action: () => Promise<void>;
  /** Maximum retry attempts */
  maxRetries: number;
}
