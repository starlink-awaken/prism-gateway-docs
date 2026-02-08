/**
 * PRISM-Gateway Metrics Storage
 *
 * @module infrastructure/metrics/MetricsStorage
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import type {
  MetricDataPoint,
  TimeSeriesGranularity,
  MetricsStorageConfig,
  MetricsStorageStats,
  AggregatedMetricPoint
} from './types.js';

/**
 * Time-series metrics storage with 4 granularity levels
 */
export class MetricsStorage {
  private config: Required<MetricsStorageConfig>;
  private storageReady: boolean = false;

  constructor(config?: Partial<MetricsStorageConfig>) {
    const defaultRoot = path.join(homedir(), '.prism-gateway', 'metrics');

    this.config = {
      storageRoot: config?.storageRoot || defaultRoot,
      rawRetentionHours: config?.rawRetentionHours || 24,
      oneMinuteRetentionDays: config?.oneMinuteRetentionDays || 7,
      fiveMinutesRetentionDays: config?.fiveMinutesRetentionDays || 30,
      oneHourRetentionDays: config?.oneHourRetentionDays || 365,
      maxPointsPerFile: config?.maxPointsPerFile || 10000
    };
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    if (this.storageReady) {
      return;
    }

    // Create directories for each granularity level
    const dirs = [
      path.join(this.config.storageRoot, 'raw'),
      path.join(this.config.storageRoot, '1m'),
      path.join(this.config.storageRoot, '5m'),
      path.join(this.config.storageRoot, '1h')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    this.storageReady = true;
  }

  /**
   * Write raw metric data points
   */
  async write(dataPoints: MetricDataPoint[]): Promise<void> {
    if (!this.storageReady) {
      throw new Error('Storage not initialized');
    }

    if (dataPoints.length === 0) {
      return;
    }

    // Group by metric name
    const grouped = new Map<string, MetricDataPoint[]>();
    for (const point of dataPoints) {
      if (!grouped.has(point.name)) {
        grouped.set(point.name, []);
      }
      grouped.get(point.name)!.push(point);
    }

    // Write each metric to its own file
    for (const [name, points] of grouped.entries()) {
      await this.writeMetric('raw', name, points);
    }
  }

  /**
   * Write aggregated metric points
   */
  async writeAggregated(
    granularity: TimeSeriesGranularity,
    points: AggregatedMetricPoint[]
  ): Promise<void> {
    if (!this.storageReady) {
      throw new Error('Storage not initialized');
    }

    if (granularity === 'raw') {
      throw new Error('Use write() for raw data points');
    }

    // Group by metric name
    const grouped = new Map<string, AggregatedMetricPoint[]>();
    for (const point of points) {
      if (!grouped.has(point.name)) {
        grouped.set(point.name, []);
      }
      grouped.get(point.name)!.push(point);
    }

    // Write each metric
    for (const [name, metricPoints] of grouped.entries()) {
      await this.writeMetric(granularity, name, metricPoints);
    }
  }

  /**
   * Read metric data points
   */
  async read(
    granularity: TimeSeriesGranularity,
    metricName: string,
    startTime: number,
    endTime: number
  ): Promise<MetricDataPoint[] | AggregatedMetricPoint[]> {
    if (!this.storageReady) {
      throw new Error('Storage not initialized');
    }

    const metricDir = path.join(this.config.storageRoot, granularity, this.sanitizeMetricName(metricName));

    try {
      await fs.access(metricDir);
    } catch {
      return [];
    }

    // List all files in the metric directory
    const files = await fs.readdir(metricDir);
    const dataFiles = files.filter(f => f.endsWith('.jsonl')).sort();

    const results: any[] = [];

    for (const file of dataFiles) {
      const filePath = path.join(metricDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.length > 0);

      for (const line of lines) {
        try {
          const point = JSON.parse(line);
          if (point.timestamp >= startTime && point.timestamp <= endTime) {
            results.push(point);
          }
        } catch (error) {
          console.error('[MetricsStorage] Failed to parse line:', error);
        }
      }
    }

    return results;
  }

  /**
   * List all metric names
   */
  async listMetrics(granularity: TimeSeriesGranularity = 'raw'): Promise<string[]> {
    if (!this.storageReady) {
      throw new Error('Storage not initialized');
    }

    const granularityDir = path.join(this.config.storageRoot, granularity);

    try {
      const entries = await fs.readdir(granularityDir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory())
        .map(e => this.desanitizeMetricName(e.name));
    } catch {
      return [];
    }
  }

  /**
   * Cleanup expired data
   */
  async cleanup(): Promise<number> {
    if (!this.storageReady) {
      throw new Error('Storage not initialized');
    }

    const now = Date.now();
    let deletedFiles = 0;

    // Cleanup raw data (24 hours)
    deletedFiles += await this.cleanupGranularity(
      'raw',
      now - this.config.rawRetentionHours * 60 * 60 * 1000
    );

    // Cleanup 1m data (7 days)
    deletedFiles += await this.cleanupGranularity(
      '1m',
      now - this.config.oneMinuteRetentionDays * 24 * 60 * 60 * 1000
    );

    // Cleanup 5m data (30 days)
    deletedFiles += await this.cleanupGranularity(
      '5m',
      now - this.config.fiveMinutesRetentionDays * 24 * 60 * 60 * 1000
    );

    // Cleanup 1h data (365 days)
    deletedFiles += await this.cleanupGranularity(
      '1h',
      now - this.config.oneHourRetentionDays * 24 * 60 * 60 * 1000
    );

    return deletedFiles;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<MetricsStorageStats> {
    if (!this.storageReady) {
      throw new Error('Storage not initialized');
    }

    const stats: MetricsStorageStats = {
      totalPoints: 0,
      totalSize: 0,
      pointsByGranularity: {
        raw: 0,
        '1m': 0,
        '5m': 0,
        '1h': 0
      },
      sizeByGranularity: {
        raw: 0,
        '1m': 0,
        '5m': 0,
        '1h': 0
      }
    };

    for (const granularity of ['raw', '1m', '5m', '1h'] as TimeSeriesGranularity[]) {
      const granularityStats = await this.getGranularityStats(granularity);
      stats.totalPoints += granularityStats.points;
      stats.totalSize += granularityStats.size;
      stats.pointsByGranularity[granularity] = granularityStats.points;
      stats.sizeByGranularity[granularity] = granularityStats.size;

      if (granularityStats.oldestTimestamp !== undefined) {
        if (stats.oldestTimestamp === undefined || granularityStats.oldestTimestamp < stats.oldestTimestamp) {
          stats.oldestTimestamp = granularityStats.oldestTimestamp;
        }
      }

      if (granularityStats.newestTimestamp !== undefined) {
        if (stats.newestTimestamp === undefined || granularityStats.newestTimestamp > stats.newestTimestamp) {
          stats.newestTimestamp = granularityStats.newestTimestamp;
        }
      }
    }

    return stats;
  }

  private async writeMetric(
    granularity: TimeSeriesGranularity,
    metricName: string,
    points: any[]
  ): Promise<void> {
    const metricDir = path.join(this.config.storageRoot, granularity, this.sanitizeMetricName(metricName));
    await fs.mkdir(metricDir, { recursive: true });

    // Use current timestamp for file name
    const timestamp = Date.now();
    const fileName = `${timestamp}.jsonl`;
    const filePath = path.join(metricDir, fileName);

    // Append to file (or create if not exists)
    const lines = points.map(p => JSON.stringify(p)).join('\n') + '\n';
    await fs.appendFile(filePath, lines);
  }

  private async cleanupGranularity(
    granularity: TimeSeriesGranularity,
    cutoffTimestamp: number
  ): Promise<number> {
    const granularityDir = path.join(this.config.storageRoot, granularity);
    let deletedFiles = 0;

    try {
      const metricDirs = await fs.readdir(granularityDir, { withFileTypes: true });

      for (const metricDir of metricDirs) {
        if (!metricDir.isDirectory()) continue;

        const metricPath = path.join(granularityDir, metricDir.name);
        const files = await fs.readdir(metricPath);

        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue;

          // Extract timestamp from filename
          const fileTimestamp = parseInt(file.replace('.jsonl', ''), 10);

          if (fileTimestamp < cutoffTimestamp) {
            await fs.unlink(path.join(metricPath, file));
            deletedFiles++;
          }
        }
      }
    } catch (error) {
      console.error(`[MetricsStorage] Cleanup failed for ${granularity}:`, error);
    }

    return deletedFiles;
  }

  private async getGranularityStats(
    granularity: TimeSeriesGranularity
  ): Promise<{ points: number; size: number; oldestTimestamp?: number; newestTimestamp?: number }> {
    const granularityDir = path.join(this.config.storageRoot, granularity);
    let totalPoints = 0;
    let totalSize = 0;
    let oldestTimestamp: number | undefined;
    let newestTimestamp: number | undefined;

    try {
      const metricDirs = await fs.readdir(granularityDir, { withFileTypes: true });

      for (const metricDir of metricDirs) {
        if (!metricDir.isDirectory()) continue;

        const metricPath = path.join(granularityDir, metricDir.name);
        const files = await fs.readdir(metricPath);

        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue;

          const filePath = path.join(metricPath, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;

          // Count lines
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n').filter(l => l.length > 0);
          totalPoints += lines.length;

          // Extract timestamp from filename
          const fileTimestamp = parseInt(file.replace('.jsonl', ''), 10);
          if (oldestTimestamp === undefined || fileTimestamp < oldestTimestamp) {
            oldestTimestamp = fileTimestamp;
          }
          if (newestTimestamp === undefined || fileTimestamp > newestTimestamp) {
            newestTimestamp = fileTimestamp;
          }
        }
      }
    } catch (error) {
      // Directory might not exist yet
    }

    return { points: totalPoints, size: totalSize, oldestTimestamp, newestTimestamp };
  }

  private sanitizeMetricName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private desanitizeMetricName(name: string): string {
    // For now, just return as-is since we don't have a way to reverse the sanitization
    return name;
  }
}
