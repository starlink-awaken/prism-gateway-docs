/**
 * PRISM-Gateway Metrics Types
 *
 * @module infrastructure/metrics/types
 */

/**
 * Metric data point
 */
export interface MetricDataPoint {
  /** Metric name */
  name: string;
  /** Data point value */
  value: number;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Optional labels for dimensional metrics */
  labels?: Record<string, string>;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Metric types
 */
export enum MetricType {
  /** Counter - monotonically increasing value */
  Counter = 'counter',
  /** Gauge - arbitrary value that can go up or down */
  Gauge = 'gauge',
  /** Histogram - distribution of values */
  Histogram = 'histogram',
  /** Summary - similar to histogram with quantiles */
  Summary = 'summary'
}

/**
 * Aggregation functions
 */
export enum AggregationFunction {
  Sum = 'sum',
  Average = 'avg',
  Min = 'min',
  Max = 'max',
  Count = 'count',
  P50 = 'p50',
  P95 = 'p95',
  P99 = 'p99'
}

/**
 * Time series granularity levels
 */
export enum TimeSeriesGranularity {
  /** Raw data points */
  Raw = 'raw',
  /** 1-minute aggregation */
  OneMinute = '1m',
  /** 5-minute aggregation */
  FiveMinutes = '5m',
  /** 1-hour aggregation */
  OneHour = '1h'
}

/**
 * Aggregated metric data point
 */
export interface AggregatedMetricPoint {
  /** Metric name */
  name: string;
  /** Start of time bucket */
  timestamp: number;
  /** Aggregation function used */
  aggregation: AggregationFunction;
  /** Aggregated value */
  value: number;
  /** Number of data points in aggregation */
  count: number;
  /** Optional labels */
  labels?: Record<string, string>;
}

/**
 * Metric collector configuration
 */
export interface MetricCollectorConfig {
  /** Collector name */
  name: string;
  /** Collection interval in seconds */
  interval: number;
  /** Whether collector is enabled */
  enabled: boolean;
  /** Collector-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * System metrics snapshot
 */
export interface SystemMetricsSnapshot {
  /** CPU usage percentage (0-100) */
  cpuUsage: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Total memory in bytes */
  totalMemory: number;
  /** Memory usage percentage (0-100) */
  memoryPercentage: number;
  /** Load average [1m, 5m, 15m] */
  loadAverage: [number, number, number];
  /** Uptime in seconds */
  uptime: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Process metrics snapshot
 */
export interface ProcessMetricsSnapshot {
  /** Process ID */
  pid: number;
  /** Process uptime in seconds */
  uptime: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Event loop delay in milliseconds */
  eventLoopDelay: number;
  /** Active handles count */
  activeHandles: number;
  /** Active requests count */
  activeRequests: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * API metrics snapshot
 */
export interface APIMetricsSnapshot {
  /** Total requests */
  totalRequests: number;
  /** Successful requests (2xx) */
  successfulRequests: number;
  /** Failed requests (4xx, 5xx) */
  failedRequests: number;
  /** Average response time (ms) */
  avgResponseTime: number;
  /** P50 response time (ms) */
  p50ResponseTime: number;
  /** P95 response time (ms) */
  p95ResponseTime: number;
  /** P99 response time (ms) */
  p99ResponseTime: number;
  /** Requests per second */
  requestsPerSecond: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * WebSocket metrics snapshot
 */
export interface WebSocketMetricsSnapshot {
  /** Total connections */
  totalConnections: number;
  /** Active connections */
  activeConnections: number;
  /** Messages sent */
  messagesSent: number;
  /** Messages received */
  messagesReceived: number;
  /** Bytes sent */
  bytesSent: number;
  /** Bytes received */
  bytesReceived: number;
  /** Average message size */
  avgMessageSize: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Business metrics snapshot
 */
export interface BusinessMetricsSnapshot {
  /** Gateway checks performed */
  gatewayChecks: number;
  /** Violations detected */
  violations: number;
  /** Retrospectives completed */
  retrospectives: number;
  /** Patterns matched */
  patternsMatched: number;
  /** Active users */
  activeUsers: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Data metrics snapshot
 */
export interface DataMetricsSnapshot {
  /** Total data size in bytes */
  totalSize: number;
  /** Hot data size */
  hotDataSize: number;
  /** Warm data size */
  warmDataSize: number;
  /** Cold data size */
  coldDataSize: number;
  /** Total files */
  totalFiles: number;
  /** Data growth rate (bytes/second) */
  growthRate: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Metrics query filter
 */
export interface MetricsQueryFilter {
  /** Metric names to query */
  names?: string[];
  /** Start timestamp (ms) */
  startTime?: number;
  /** End timestamp (ms) */
  endTime?: number;
  /** Time series granularity */
  granularity?: TimeSeriesGranularity;
  /** Label filters */
  labels?: Record<string, string>;
  /** Aggregation function */
  aggregation?: AggregationFunction;
  /** Limit number of results */
  limit?: number;
}

/**
 * Metrics query result
 */
export interface MetricsQueryResult {
  /** Metric name */
  name: string;
  /** Data points */
  dataPoints: MetricDataPoint[];
  /** Query metadata */
  metadata: {
    /** Total points matched */
    totalPoints: number;
    /** Query start time */
    startTime: number;
    /** Query end time */
    endTime: number;
    /** Granularity used */
    granularity: TimeSeriesGranularity;
    /** Query duration (ms) */
    queryDuration: number;
  };
}

/**
 * Metrics storage configuration
 */
export interface MetricsStorageConfig {
  /** Storage root directory */
  storageRoot: string;
  /** Retention policy for raw data (hours) */
  rawRetentionHours: number;
  /** Retention policy for 1m data (days) */
  oneMinuteRetentionDays: number;
  /** Retention policy for 5m data (days) */
  fiveMinutesRetentionDays: number;
  /** Retention policy for 1h data (days) */
  oneHourRetentionDays: number;
  /** Maximum points per file */
  maxPointsPerFile: number;
}

/**
 * Metrics storage statistics
 */
export interface MetricsStorageStats {
  /** Total data points stored */
  totalPoints: number;
  /** Total storage size (bytes) */
  totalSize: number;
  /** Points by granularity */
  pointsByGranularity: Record<TimeSeriesGranularity, number>;
  /** Size by granularity */
  sizeByGranularity: Record<TimeSeriesGranularity, number>;
  /** Oldest data timestamp */
  oldestTimestamp?: number;
  /** Newest data timestamp */
  newestTimestamp?: number;
}

/**
 * Metrics service statistics
 */
export interface MetricsServiceStats {
  /** Number of registered collectors */
  totalCollectors: number;
  /** Number of active collectors */
  activeCollectors: number;
  /** Total metrics collected */
  totalMetricsCollected: number;
  /** Collection errors */
  collectionErrors: number;
  /** Average collection time (ms) */
  avgCollectionTime: number;
  /** Storage statistics */
  storage: MetricsStorageStats;
  /** Last collection timestamp */
  lastCollection?: number;
}

/**
 * Metric metadata
 */
export interface MetricMetadata {
  /** Metric name */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Human-readable description */
  description: string;
  /** Unit of measurement */
  unit: string;
  /** Label names */
  labels: string[];
  /** Collection interval (seconds) */
  interval: number;
}

/**
 * Time range for queries
 */
export interface TimeRange {
  /** Start timestamp (ms) */
  start: number;
  /** End timestamp (ms) */
  end: number;
}

/**
 * Downsampling configuration
 */
export interface DownsamplingConfig {
  /** Target number of points */
  targetPoints: number;
  /** Aggregation function to use */
  aggregation: AggregationFunction;
}

/**
 * Metrics snapshot (real-time)
 */
export interface MetricsSnapshot {
  /** System metrics */
  system: SystemMetricsSnapshot;
  /** Process metrics */
  process: ProcessMetricsSnapshot;
  /** API metrics */
  api: APIMetricsSnapshot;
  /** WebSocket metrics */
  websocket: WebSocketMetricsSnapshot;
  /** Business metrics */
  business: BusinessMetricsSnapshot;
  /** Data metrics */
  data: DataMetricsSnapshot;
  /** Snapshot timestamp */
  timestamp: number;
}
