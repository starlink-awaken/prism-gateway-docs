/**
 * PRISM-Gateway Built-in Metric Collectors
 *
 * @module infrastructure/metrics/collectors
 */

import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { MetricCollector } from './MetricCollector.js';
import type {
  MetricDataPoint,
  MetricCollectorConfig,
  MetricType,
  SystemMetricsSnapshot,
  ProcessMetricsSnapshot
} from './types.js';

/**
 * System metrics collector - CPU, memory, load
 */
export class SystemMetricsCollector extends MetricCollector {
  constructor(config?: Partial<MetricCollectorConfig>) {
    super({
      name: 'system',
      interval: 10,
      enabled: true,
      ...config
    });
  }

  getMetricType(): MetricType {
    return 'gauge' as MetricType;
  }

  protected async performCollection(): Promise<MetricDataPoint[]> {
    const metrics: MetricDataPoint[] = [];
    const timestamp = Date.now();

    // CPU usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const cpuUsage = Math.max(0, Math.min(100, 100 - (totalIdle / totalTick) * 100));
    metrics.push(this.createDataPoint('system.cpu.usage', cpuUsage, { unit: 'percent' }));

    // Memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    metrics.push(this.createDataPoint('system.memory.used', usedMemory, { unit: 'bytes' }));
    metrics.push(this.createDataPoint('system.memory.total', totalMemory, { unit: 'bytes' }));
    metrics.push(this.createDataPoint('system.memory.free', freeMemory, { unit: 'bytes' }));
    metrics.push(this.createDataPoint('system.memory.percentage', memoryPercentage, { unit: 'percent' }));

    // Load average
    const loadAverage = os.loadavg();
    metrics.push(this.createDataPoint('system.load.1m', loadAverage[0]));
    metrics.push(this.createDataPoint('system.load.5m', loadAverage[1]));
    metrics.push(this.createDataPoint('system.load.15m', loadAverage[2]));

    // Uptime
    const uptime = os.uptime();
    metrics.push(this.createDataPoint('system.uptime', uptime, { unit: 'seconds' }));

    return metrics;
  }
}

/**
 * Process metrics collector - Node.js process metrics
 */
export class ProcessMetricsCollector extends MetricCollector {
  private startTime: number;
  private lastCpuUsage?: NodeJS.CpuUsage;
  private lastCheck?: number;

  constructor(config?: Partial<MetricCollectorConfig>) {
    super({
      name: 'process',
      interval: 10,
      enabled: true,
      ...config
    });
    this.startTime = Date.now();
  }

  getMetricType(): MetricType {
    return 'gauge' as MetricType;
  }

  protected async performCollection(): Promise<MetricDataPoint[]> {
    const metrics: MetricDataPoint[] = [];
    const timestamp = Date.now();

    // Process ID
    metrics.push(this.createDataPoint('process.pid', process.pid));

    // Process uptime
    const uptime = (timestamp - this.startTime) / 1000;
    metrics.push(this.createDataPoint('process.uptime', uptime, { unit: 'seconds' }));

    // Memory usage
    const memoryUsage = process.memoryUsage();
    metrics.push(this.createDataPoint('process.memory.rss', memoryUsage.rss, { unit: 'bytes' }));
    metrics.push(this.createDataPoint('process.memory.heapTotal', memoryUsage.heapTotal, { unit: 'bytes' }));
    metrics.push(this.createDataPoint('process.memory.heapUsed', memoryUsage.heapUsed, { unit: 'bytes' }));
    metrics.push(this.createDataPoint('process.memory.external', memoryUsage.external, { unit: 'bytes' }));

    // CPU usage (%)
    if (this.lastCpuUsage && this.lastCheck) {
      const currentCpu = process.cpuUsage(this.lastCpuUsage);
      const elapsedMs = timestamp - this.lastCheck;
      const cpuPercent = ((currentCpu.user + currentCpu.system) / 1000 / elapsedMs) * 100;
      metrics.push(this.createDataPoint('process.cpu.usage', cpuPercent, { unit: 'percent' }));
    }

    this.lastCpuUsage = process.cpuUsage();
    this.lastCheck = timestamp;

    // Event loop metrics (if available)
    if (typeof (performance as any).eventLoopUtilization === 'function') {
      const elu = (performance as any).eventLoopUtilization();
      metrics.push(this.createDataPoint('process.eventLoop.utilization', elu.utilization * 100, { unit: 'percent' }));
    }

    // Active handles and requests
    const handles = (process as any)._getActiveHandles?.()?.length || 0;
    const requests = (process as any)._getActiveRequests?.()?.length || 0;

    metrics.push(this.createDataPoint('process.handles.active', handles));
    metrics.push(this.createDataPoint('process.requests.active', requests));

    return metrics;
  }
}

/**
 * API metrics collector - HTTP request metrics
 */
export class APIMetricsCollector extends MetricCollector {
  private requestCounts: Map<string, number>;
  private responseTimes: Map<string, number[]>;
  private lastReset: number;

  constructor(config?: Partial<MetricCollectorConfig>) {
    super({
      name: 'api',
      interval: 10,
      enabled: true,
      config: {
        resetInterval: 60000, // Reset counters every 60 seconds
        ...config?.config
      },
      ...config
    });
    this.requestCounts = new Map();
    this.responseTimes = new Map();
    this.lastReset = Date.now();
  }

  getMetricType(): MetricType {
    return 'counter' as MetricType;
  }

  /**
   * Record an API request
   */
  recordRequest(endpoint: string, statusCode: number, responseTime: number): void {
    const key = `${endpoint}:${statusCode}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

    if (!this.responseTimes.has(endpoint)) {
      this.responseTimes.set(endpoint, []);
    }
    this.responseTimes.get(endpoint)!.push(responseTime);
  }

  protected async performCollection(): Promise<MetricDataPoint[]> {
    const metrics: MetricDataPoint[] = [];
    const timestamp = Date.now();

    // Check if we need to reset counters
    const resetInterval = (this.config.config?.resetInterval as number) || 60000;
    if (timestamp - this.lastReset > resetInterval) {
      this.requestCounts.clear();
      this.responseTimes.clear();
      this.lastReset = timestamp;
    }

    // Total requests
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    for (const [key, count] of this.requestCounts.entries()) {
      const [endpoint, statusCodeStr] = key.split(':');
      const statusCode = parseInt(statusCodeStr, 10);

      totalRequests += count;

      if (statusCode >= 200 && statusCode < 300) {
        successfulRequests += count;
      } else if (statusCode >= 400) {
        failedRequests += count;
      }

      // Per-endpoint request count
      metrics.push(this.createDataPoint(
        'api.requests.count',
        count,
        { endpoint, statusCode: statusCodeStr }
      ));
    }

    metrics.push(this.createDataPoint('api.requests.total', totalRequests));
    metrics.push(this.createDataPoint('api.requests.successful', successfulRequests));
    metrics.push(this.createDataPoint('api.requests.failed', failedRequests));

    // Response times
    for (const [endpoint, times] of this.responseTimes.entries()) {
      if (times.length === 0) continue;

      const sorted = times.slice().sort((a, b) => a - b);
      const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      metrics.push(this.createDataPoint('api.response.avg', avg, { endpoint, unit: 'ms' }));
      metrics.push(this.createDataPoint('api.response.p50', p50, { endpoint, unit: 'ms' }));
      metrics.push(this.createDataPoint('api.response.p95', p95, { endpoint, unit: 'ms' }));
      metrics.push(this.createDataPoint('api.response.p99', p99, { endpoint, unit: 'ms' }));
    }

    // Requests per second
    const elapsed = (timestamp - this.lastReset) / 1000;
    const rps = elapsed > 0 ? totalRequests / elapsed : 0;
    metrics.push(this.createDataPoint('api.requests.rps', rps));

    return metrics;
  }
}

/**
 * WebSocket metrics collector
 */
export class WebSocketMetricsCollector extends MetricCollector {
  private totalConnections: number = 0;
  private activeConnections: number = 0;
  private messagesSent: number = 0;
  private messagesReceived: number = 0;
  private bytesSent: number = 0;
  private bytesReceived: number = 0;

  constructor(config?: Partial<MetricCollectorConfig>) {
    super({
      name: 'websocket',
      interval: 10,
      enabled: true,
      ...config
    });
  }

  getMetricType(): MetricType {
    return 'counter' as MetricType;
  }

  /**
   * Record connection event
   */
  recordConnection(): void {
    this.totalConnections++;
    this.activeConnections++;
  }

  /**
   * Record disconnection event
   */
  recordDisconnection(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  /**
   * Record message sent
   */
  recordMessageSent(bytes: number): void {
    this.messagesSent++;
    this.bytesSent += bytes;
  }

  /**
   * Record message received
   */
  recordMessageReceived(bytes: number): void {
    this.messagesReceived++;
    this.bytesReceived += bytes;
  }

  protected async performCollection(): Promise<MetricDataPoint[]> {
    const metrics: MetricDataPoint[] = [];

    metrics.push(this.createDataPoint('websocket.connections.total', this.totalConnections));
    metrics.push(this.createDataPoint('websocket.connections.active', this.activeConnections));
    metrics.push(this.createDataPoint('websocket.messages.sent', this.messagesSent));
    metrics.push(this.createDataPoint('websocket.messages.received', this.messagesReceived));
    metrics.push(this.createDataPoint('websocket.bytes.sent', this.bytesSent, { unit: 'bytes' }));
    metrics.push(this.createDataPoint('websocket.bytes.received', this.bytesReceived, { unit: 'bytes' }));

    const totalMessages = this.messagesSent + this.messagesReceived;
    const totalBytes = this.bytesSent + this.bytesReceived;
    const avgMessageSize = totalMessages > 0 ? totalBytes / totalMessages : 0;

    metrics.push(this.createDataPoint('websocket.messages.avgSize', avgMessageSize, { unit: 'bytes' }));

    return metrics;
  }
}

/**
 * Business metrics collector - custom business metrics
 */
export class BusinessMetricsCollector extends MetricCollector {
  private gatewayChecks: number = 0;
  private violations: number = 0;
  private retrospectives: number = 0;
  private patternsMatched: number = 0;
  private activeUsers: Set<string>;

  constructor(config?: Partial<MetricCollectorConfig>) {
    super({
      name: 'business',
      interval: 30,
      enabled: true,
      ...config
    });
    this.activeUsers = new Set();
  }

  getMetricType(): MetricType {
    return 'counter' as MetricType;
  }

  /**
   * Record gateway check
   */
  recordGatewayCheck(violated: boolean): void {
    this.gatewayChecks++;
    if (violated) {
      this.violations++;
    }
  }

  /**
   * Record retrospective
   */
  recordRetrospective(): void {
    this.retrospectives++;
  }

  /**
   * Record pattern match
   */
  recordPatternMatch(): void {
    this.patternsMatched++;
  }

  /**
   * Record active user
   */
  recordActiveUser(userId: string): void {
    this.activeUsers.add(userId);
  }

  protected async performCollection(): Promise<MetricDataPoint[]> {
    const metrics: MetricDataPoint[] = [];

    metrics.push(this.createDataPoint('business.gateway.checks', this.gatewayChecks));
    metrics.push(this.createDataPoint('business.gateway.violations', this.violations));
    metrics.push(this.createDataPoint('business.retrospectives', this.retrospectives));
    metrics.push(this.createDataPoint('business.patterns.matched', this.patternsMatched));
    metrics.push(this.createDataPoint('business.users.active', this.activeUsers.size));

    // Violation rate
    const violationRate = this.gatewayChecks > 0 ? (this.violations / this.gatewayChecks) * 100 : 0;
    metrics.push(this.createDataPoint('business.gateway.violationRate', violationRate, { unit: 'percent' }));

    return metrics;
  }
}

/**
 * Data metrics collector - data volume and growth
 */
export class DataMetricsCollector extends MetricCollector {
  private dataRoot: string;
  private lastSizes?: { total: number; hot: number; warm: number; cold: number };
  private lastCheck?: number;

  constructor(config?: Partial<MetricCollectorConfig>) {
    super({
      name: 'data',
      interval: 60,
      enabled: true,
      config: {
        dataRoot: config?.config?.dataRoot || '~/.prism-gateway',
        ...config?.config
      },
      ...config
    });
    this.dataRoot = (this.config.config?.dataRoot as string) || '~/.prism-gateway';
  }

  getMetricType(): MetricType {
    return 'gauge' as MetricType;
  }

  protected async performCollection(): Promise<MetricDataPoint[]> {
    const metrics: MetricDataPoint[] = [];
    const timestamp = Date.now();

    try {
      // Get directory sizes
      const hotPath = path.join(this.dataRoot, 'level-1-hot');
      const warmPath = path.join(this.dataRoot, 'level-2-warm');
      const coldPath = path.join(this.dataRoot, 'level-3-cold');

      const [hotSize, warmSize, coldSize] = await Promise.all([
        this.getDirectorySize(hotPath),
        this.getDirectorySize(warmPath),
        this.getDirectorySize(coldPath)
      ]);

      const totalSize = hotSize + warmSize + coldSize;

      metrics.push(this.createDataPoint('data.size.total', totalSize, { unit: 'bytes' }));
      metrics.push(this.createDataPoint('data.size.hot', hotSize, { unit: 'bytes' }));
      metrics.push(this.createDataPoint('data.size.warm', warmSize, { unit: 'bytes' }));
      metrics.push(this.createDataPoint('data.size.cold', coldSize, { unit: 'bytes' }));

      // File counts
      const [hotFiles, warmFiles, coldFiles] = await Promise.all([
        this.countFiles(hotPath),
        this.countFiles(warmPath),
        this.countFiles(coldPath)
      ]);

      const totalFiles = hotFiles + warmFiles + coldFiles;
      metrics.push(this.createDataPoint('data.files.total', totalFiles));
      metrics.push(this.createDataPoint('data.files.hot', hotFiles));
      metrics.push(this.createDataPoint('data.files.warm', warmFiles));
      metrics.push(this.createDataPoint('data.files.cold', coldFiles));

      // Growth rate
      if (this.lastSizes && this.lastCheck) {
        const sizeDelta = totalSize - this.lastSizes.total;
        const timeDelta = (timestamp - this.lastCheck) / 1000; // seconds
        const growthRate = timeDelta > 0 ? sizeDelta / timeDelta : 0;

        metrics.push(this.createDataPoint('data.growth.rate', growthRate, { unit: 'bytes/second' }));
      }

      this.lastSizes = { total: totalSize, hot: hotSize, warm: warmSize, cold: coldSize };
      this.lastCheck = timestamp;
    } catch (error) {
      console.error('[DataMetricsCollector] Collection failed:', error);
      // Return empty metrics on error
    }

    return metrics;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Directory might not exist, return 0
      return 0;
    }

    return totalSize;
  }

  private async countFiles(dirPath: string): Promise<number> {
    let fileCount = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          fileCount += await this.countFiles(fullPath);
        } else if (entry.isFile()) {
          fileCount++;
        }
      }
    } catch (error) {
      // Directory might not exist, return 0
      return 0;
    }

    return fileCount;
  }
}
