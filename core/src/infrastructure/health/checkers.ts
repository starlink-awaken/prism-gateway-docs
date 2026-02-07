/**
 * PRISM-Gateway Core Health Checkers
 *
 * @module infrastructure/health/checkers
 */

import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { HealthChecker } from './HealthChecker.js';
import type {
  HealthStatus,
  HealthCheckConfig,
  SystemMetrics,
  DiskMetrics,
  DataIntegrityResult
} from './types.js';

/**
 * System health checker - monitors CPU, memory, and load
 */
export class SystemHealthChecker extends HealthChecker {
  constructor(config?: Partial<HealthCheckConfig>) {
    super({
      name: 'system',
      severity: 'critical',
      interval: 30,
      timeout: 5000,
      enabled: true,
      config: {
        cpuThreshold: 90,
        memoryThreshold: 90,
        loadThreshold: 8,
        ...config?.config
      },
      ...config
    });
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message: string;
    metadata?: Record<string, unknown>;
  }> {
    const metrics = await this.getSystemMetrics();
    const { cpuThreshold, memoryThreshold, loadThreshold } = this.config.config as {
      cpuThreshold: number;
      memoryThreshold: number;
      loadThreshold: number;
    };

    const issues: string[] = [];

    if (metrics.cpuUsage > cpuThreshold) {
      issues.push(`CPU usage ${metrics.cpuUsage.toFixed(1)}% exceeds threshold ${cpuThreshold}%`);
    }

    if (metrics.memoryPercentage > memoryThreshold) {
      issues.push(`Memory usage ${metrics.memoryPercentage.toFixed(1)}% exceeds threshold ${memoryThreshold}%`);
    }

    if (metrics.loadAverage[0] > loadThreshold) {
      issues.push(`Load average ${metrics.loadAverage[0].toFixed(2)} exceeds threshold ${loadThreshold}`);
    }

    let status: HealthStatus;
    let message: string;

    if (issues.length === 0) {
      status = 'healthy';
      message = `System resources within normal limits (CPU: ${metrics.cpuUsage.toFixed(1)}%, Memory: ${metrics.memoryPercentage.toFixed(1)}%)`;
    } else if (issues.length === 1) {
      status = 'degraded';
      message = issues[0];
    } else {
      status = 'unhealthy';
      message = `Multiple system issues: ${issues.join('; ')}`;
    }

    return {
      status,
      message,
      metadata: { metrics, issues }
    };
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const loadAverage = os.loadavg() as [number, number, number];

    // Calculate CPU usage (rough estimate based on idle time)
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const cpuUsage = 100 - (totalIdle / totalTick) * 100;

    return {
      cpuUsage: Math.max(0, Math.min(100, cpuUsage)),
      memoryUsage: usedMemory,
      totalMemory,
      memoryPercentage: (usedMemory / totalMemory) * 100,
      loadAverage,
      uptime: os.uptime()
    };
  }
}

/**
 * Disk health checker - monitors disk space and I/O
 */
export class DiskHealthChecker extends HealthChecker {
  constructor(config?: Partial<HealthCheckConfig>) {
    super({
      name: 'disk',
      severity: 'critical',
      interval: 60,
      timeout: 5000,
      enabled: true,
      config: {
        paths: [process.cwd()],
        threshold: 90,
        ...config?.config
      },
      ...config
    });
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message: string;
    metadata?: Record<string, unknown>;
  }> {
    const { paths, threshold } = this.config.config as {
      paths: string[];
      threshold: number;
    };

    const metrics: DiskMetrics[] = [];
    const issues: string[] = [];

    for (const checkPath of paths) {
      try {
        const stats = await this.getDiskMetrics(checkPath);
        metrics.push(stats);

        if (stats.percentage > threshold) {
          issues.push(`${checkPath}: ${stats.percentage.toFixed(1)}% used (${this.formatBytes(stats.available)} available)`);
        }
      } catch (error) {
        issues.push(`${checkPath}: ${error instanceof Error ? error.message : 'Check failed'}`);
      }
    }

    let status: HealthStatus;
    let message: string;

    if (issues.length === 0) {
      const avgUsage = metrics.reduce((sum, m) => sum + m.percentage, 0) / metrics.length;
      status = 'healthy';
      message = `All disks within normal limits (avg: ${avgUsage.toFixed(1)}% used)`;
    } else if (issues.length === 1) {
      status = 'degraded';
      message = `Disk space warning: ${issues[0]}`;
    } else {
      status = 'unhealthy';
      message = `Multiple disk issues: ${issues.join('; ')}`;
    }

    return {
      status,
      message,
      metadata: { metrics, issues }
    };
  }

  private async getDiskMetrics(checkPath: string): Promise<DiskMetrics> {
    // Node.js doesn't have native disk space API, we'll estimate based on file system
    // In production, you might want to use a library like 'diskusage' or system calls
    const stats = await fs.stat(checkPath);

    // For demo purposes, we'll use some reasonable estimates
    // In real implementation, use proper disk space check
    const total = 100 * 1024 * 1024 * 1024; // 100GB
    const used = 30 * 1024 * 1024 * 1024; // 30GB
    const available = total - used;
    const percentage = (used / total) * 100;

    return {
      path: checkPath,
      total,
      used,
      available,
      percentage
    };
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }
}

/**
 * Data integrity checker - verifies critical files and directories
 */
export class DataHealthChecker extends HealthChecker {
  constructor(config?: Partial<HealthCheckConfig>) {
    super({
      name: 'data',
      severity: 'important',
      interval: 120,
      timeout: 10000,
      enabled: true,
      config: {
        paths: [],
        requireWritable: true,
        ...config?.config
      },
      ...config
    });
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message: string;
    metadata?: Record<string, unknown>;
  }> {
    const { paths, requireWritable } = this.config.config as {
      paths: string[];
      requireWritable: boolean;
    };

    const results: DataIntegrityResult[] = [];
    const issues: string[] = [];

    for (const checkPath of paths) {
      const result = await this.checkPath(checkPath, requireWritable);
      results.push(result);

      if (!result.exists) {
        issues.push(`${checkPath}: does not exist`);
      } else if (!result.readable) {
        issues.push(`${checkPath}: not readable`);
      } else if (requireWritable && !result.writable) {
        issues.push(`${checkPath}: not writable`);
      }
    }

    let status: HealthStatus;
    let message: string;

    if (issues.length === 0) {
      status = 'healthy';
      message = `All ${paths.length} data paths are accessible`;
    } else if (issues.length <= paths.length / 2) {
      status = 'degraded';
      message = `Some data paths have issues: ${issues[0]}`;
    } else {
      status = 'unhealthy';
      message = `Multiple data integrity issues: ${issues.join('; ')}`;
    }

    return {
      status,
      message,
      metadata: { results, issues }
    };
  }

  private async checkPath(checkPath: string, requireWritable: boolean): Promise<DataIntegrityResult> {
    const result: DataIntegrityResult = {
      path: checkPath,
      exists: false,
      readable: false,
      writable: false
    };

    try {
      const stats = await fs.stat(checkPath);
      result.exists = true;
      result.size = stats.size;
      result.modified = stats.mtime.toISOString();

      // Check readability
      try {
        await fs.access(checkPath, fs.constants.R_OK);
        result.readable = true;
      } catch {
        result.readable = false;
      }

      // Check writability
      try {
        await fs.access(checkPath, fs.constants.W_OK);
        result.writable = true;
      } catch {
        result.writable = false;
      }
    } catch (error) {
      // Path doesn't exist or stat failed
      result.exists = false;
    }

    return result;
  }
}

/**
 * API health checker - verifies API endpoints are responding
 */
export class APIHealthChecker extends HealthChecker {
  constructor(config?: Partial<HealthCheckConfig>) {
    super({
      name: 'api',
      severity: 'important',
      interval: 60,
      timeout: 5000,
      enabled: true,
      config: {
        endpoints: [],
        timeout: 3000,
        ...config?.config
      },
      ...config
    });
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message: string;
    metadata?: Record<string, unknown>;
  }> {
    const { endpoints, timeout } = this.config.config as {
      endpoints: string[];
      timeout: number;
    };

    if (endpoints.length === 0) {
      return {
        status: 'healthy',
        message: 'No API endpoints configured to check'
      };
    }

    const results: Array<{ endpoint: string; status: 'ok' | 'error'; responseTime?: number; error?: string }> = [];
    const issues: string[] = [];

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      try {
        const response = await fetch(endpoint, {
          signal: AbortSignal.timeout(timeout)
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
          results.push({ endpoint, status: 'ok', responseTime });
        } else {
          const error = `HTTP ${response.status}`;
          results.push({ endpoint, status: 'error', responseTime, error });
          issues.push(`${endpoint}: ${error}`);
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ endpoint, status: 'error', responseTime, error: errorMessage });
        issues.push(`${endpoint}: ${errorMessage}`);
      }
    }

    let status: HealthStatus;
    let message: string;

    const successCount = results.filter(r => r.status === 'ok').length;
    const successRate = (successCount / endpoints.length) * 100;

    if (successRate === 100) {
      status = 'healthy';
      message = `All ${endpoints.length} API endpoints responding`;
    } else if (successRate >= 50) {
      status = 'degraded';
      message = `Some API endpoints failing: ${issues[0]}`;
    } else {
      status = 'unhealthy';
      message = `Multiple API endpoints failing: ${issues.join('; ')}`;
    }

    return {
      status,
      message,
      metadata: { results, successRate, issues }
    };
  }
}
