/**
 * PRISM-Gateway Metric Collector Base Class
 *
 * @module infrastructure/metrics/MetricCollector
 */

import type { MetricDataPoint, MetricCollectorConfig, MetricType } from './types.js';

/**
 * Abstract base class for metric collectors
 */
export abstract class MetricCollector {
  protected config: MetricCollectorConfig;
  protected lastCollection?: number;
  protected collectionCount: number = 0;
  protected errorCount: number = 0;

  constructor(config: MetricCollectorConfig) {
    this.config = config;
  }

  /**
   * Get collector name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get collection interval
   */
  get interval(): number {
    return this.config.interval;
  }

  /**
   * Check if collector is enabled
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get metric type
   */
  abstract getMetricType(): MetricType;

  /**
   * Collect metrics
   */
  async collect(): Promise<MetricDataPoint[]> {
    if (!this.config.enabled) {
      return [];
    }

    const startTime = Date.now();

    try {
      const metrics = await this.performCollection();
      this.lastCollection = Date.now();
      this.collectionCount++;

      return metrics;
    } catch (error) {
      this.errorCount++;
      console.error(`[MetricCollector] Collection failed for ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Perform the actual metric collection (to be implemented by subclasses)
   */
  protected abstract performCollection(): Promise<MetricDataPoint[]>;

  /**
   * Get collector statistics
   */
  getStats(): {
    name: string;
    enabled: boolean;
    collectionCount: number;
    errorCount: number;
    lastCollection?: number;
  } {
    return {
      name: this.name,
      enabled: this.enabled,
      collectionCount: this.collectionCount,
      errorCount: this.errorCount,
      lastCollection: this.lastCollection
    };
  }

  /**
   * Update collector configuration
   */
  updateConfig(config: Partial<MetricCollectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset collector state
   */
  reset(): void {
    this.lastCollection = undefined;
    this.collectionCount = 0;
    this.errorCount = 0;
  }

  /**
   * Create a metric data point
   */
  protected createDataPoint(
    name: string,
    value: number,
    labels?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): MetricDataPoint {
    return {
      name,
      value,
      timestamp: Date.now(),
      ...(labels && { labels }),
      ...(metadata && { metadata })
    };
  }
}
