/**
 * PRISM-Gateway Metrics Service
 *
 * @module infrastructure/metrics/MetricsService
 */

import { MetricCollector } from './MetricCollector.js';
import { MetricsStorage } from './MetricsStorage.js';
import { MetricsAggregator } from './MetricsAggregator.js';
import { QueryEngine } from './QueryEngine.js';
import {
  SystemMetricsCollector,
  ProcessMetricsCollector,
  APIMetricsCollector,
  WebSocketMetricsCollector,
  BusinessMetricsCollector,
  DataMetricsCollector
} from './collectors.js';
import type {
  MetricDataPoint,
  MetricsSnapshot,
  MetricsQueryFilter,
  MetricsQueryResult,
  MetricsServiceStats,
  MetricMetadata,
  MetricsStorageConfig
} from './types.js';

/**
 * Metrics service configuration
 */
export interface MetricsServiceConfig {
  /** Storage configuration */
  storage?: Partial<MetricsStorageConfig>;
  /** Whether to enable built-in collectors */
  enableBuiltInCollectors?: boolean;
  /** Aggregation interval in seconds */
  aggregationInterval?: number;
  /** Cleanup interval in seconds */
  cleanupInterval?: number;
}

/**
 * Unified metrics service
 */
export class MetricsService {
  private collectors: Map<string, MetricCollector>;
  private storage: MetricsStorage;
  private aggregator: MetricsAggregator;
  private queryEngine: QueryEngine;
  private config: Required<MetricsServiceConfig>;
  private initialized: boolean = false;
  private collectionTimers: Map<string, NodeJS.Timeout>;
  private aggregationTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  // Built-in collector references for recording events
  private apiCollector?: APIMetricsCollector;
  private wsCollector?: WebSocketMetricsCollector;
  private businessCollector?: BusinessMetricsCollector;

  constructor(config?: MetricsServiceConfig) {
    this.collectors = new Map();
    this.storage = new MetricsStorage(config?.storage);
    this.aggregator = new MetricsAggregator();
    this.queryEngine = new QueryEngine(this.storage, this.aggregator);
    this.collectionTimers = new Map();

    this.config = {
      storage: config?.storage || {},
      enableBuiltInCollectors: config?.enableBuiltInCollectors ?? true,
      aggregationInterval: config?.aggregationInterval || 60,
      cleanupInterval: config?.cleanupInterval || 3600
    };
  }

  /**
   * Initialize metrics service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize storage
    await this.storage.initialize();

    // Register built-in collectors if enabled
    if (this.config.enableBuiltInCollectors) {
      await this.registerBuiltInCollectors();
    }

    // Start collection timers
    this.startCollectors();

    // Start aggregation timer
    this.startAggregation();

    // Start cleanup timer
    this.startCleanup();

    this.initialized = true;
    console.log('[MetricsService] Metrics service initialized');
  }

  /**
   * Get real-time metrics snapshot
   */
  async snapshot(): Promise<MetricsSnapshot> {
    if (!this.initialized) {
      throw new Error('Metrics service not initialized');
    }

    // Collect all metrics now
    const allMetrics: MetricDataPoint[] = [];

    for (const collector of this.collectors.values()) {
      try {
        const metrics = await collector.collect();
        allMetrics.push(...metrics);
      } catch (error) {
        console.error(`[MetricsService] Collection failed for ${collector.name}:`, error);
      }
    }

    // Organize into snapshot structure
    const snapshot: any = { timestamp: Date.now() };

    // Group metrics by collector type
    for (const metric of allMetrics) {
      const parts = metric.name.split('.');
      if (parts.length >= 2) {
        const category = parts[0];
        if (!snapshot[category]) {
          snapshot[category] = {};
        }
      }
    }

    return snapshot as MetricsSnapshot;
  }

  /**
   * Query historical metrics
   */
  async query(filter: MetricsQueryFilter): Promise<MetricsQueryResult[]> {
    if (!this.initialized) {
      throw new Error('Metrics service not initialized');
    }

    return this.queryEngine.query(filter);
  }

  /**
   * List all available metrics
   */
  async listMetrics(): Promise<MetricMetadata[]> {
    if (!this.initialized) {
      throw new Error('Metrics service not initialized');
    }

    const metricNames = await this.storage.listMetrics('raw');
    const metadata: MetricMetadata[] = [];

    // Get metadata from collectors
    for (const collector of this.collectors.values()) {
      // Collect to get metric names
      try {
        const metrics = await collector.collect();
        for (const metric of metrics) {
          if (!metricNames.includes(metric.name)) {
            continue;
          }

          metadata.push({
            name: metric.name,
            type: collector.getMetricType(),
            description: `Metric from ${collector.name} collector`,
            unit: (metric.labels?.unit as string) || '',
            labels: metric.labels ? Object.keys(metric.labels) : [],
            interval: collector.interval
          });
        }
      } catch (error) {
        // Skip on error
      }
    }

    return metadata;
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<MetricsServiceStats> {
    if (!this.initialized) {
      throw new Error('Metrics service not initialized');
    }

    const collectors = Array.from(this.collectors.values());
    let totalCollected = 0;
    let totalErrors = 0;
    let totalCollectionTime = 0;
    let lastCollection: number | undefined;

    for (const collector of collectors) {
      const stats = collector.getStats();
      totalCollected += stats.collectionCount;
      totalErrors += stats.errorCount;

      if (stats.lastCollection) {
        if (!lastCollection || stats.lastCollection > lastCollection) {
          lastCollection = stats.lastCollection;
        }
      }
    }

    const avgCollectionTime = totalCollected > 0 ? totalCollectionTime / totalCollected : 0;
    const storageStats = await this.storage.getStats();

    return {
      totalCollectors: collectors.length,
      activeCollectors: collectors.filter(c => c.enabled).length,
      totalMetricsCollected: totalCollected,
      collectionErrors: totalErrors,
      avgCollectionTime,
      storage: storageStats,
      lastCollection
    };
  }

  /**
   * Add custom collector
   */
  addCollector(collector: MetricCollector): void {
    if (this.collectors.has(collector.name)) {
      throw new Error(`Collector already exists: ${collector.name}`);
    }

    this.collectors.set(collector.name, collector);

    // Start collection timer if initialized
    if (this.initialized) {
      this.startCollector(collector);
    }

    console.log(`[MetricsService] Added collector: ${collector.name}`);
  }

  /**
   * Remove collector
   */
  removeCollector(name: string): void {
    const collector = this.collectors.get(name);
    if (!collector) {
      return;
    }

    // Stop collection timer
    const timer = this.collectionTimers.get(name);
    if (timer) {
      clearInterval(timer);
      this.collectionTimers.delete(name);
    }

    this.collectors.delete(name);
    console.log(`[MetricsService] Removed collector: ${name}`);
  }

  /**
   * Record API request (convenience method)
   */
  recordAPIRequest(endpoint: string, statusCode: number, responseTime: number): void {
    this.apiCollector?.recordRequest(endpoint, statusCode, responseTime);
  }

  /**
   * Record WebSocket event (convenience methods)
   */
  recordWSConnection(): void {
    this.wsCollector?.recordConnection();
  }

  recordWSDisconnection(): void {
    this.wsCollector?.recordDisconnection();
  }

  recordWSMessage(sent: boolean, bytes: number): void {
    if (sent) {
      this.wsCollector?.recordMessageSent(bytes);
    } else {
      this.wsCollector?.recordMessageReceived(bytes);
    }
  }

  /**
   * Record business event (convenience methods)
   */
  recordGatewayCheck(violated: boolean): void {
    this.businessCollector?.recordGatewayCheck(violated);
  }

  recordRetrospective(): void {
    this.businessCollector?.recordRetrospective();
  }

  recordPatternMatch(): void {
    this.businessCollector?.recordPatternMatch();
  }

  recordActiveUser(userId: string): void {
    this.businessCollector?.recordActiveUser(userId);
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Stop all timers
    for (const timer of this.collectionTimers.values()) {
      clearInterval(timer);
    }
    this.collectionTimers.clear();

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.initialized = false;
    console.log('[MetricsService] Metrics service stopped');
  }

  private async registerBuiltInCollectors(): Promise<void> {
    // System metrics
    this.addCollector(new SystemMetricsCollector());

    // Process metrics
    this.addCollector(new ProcessMetricsCollector());

    // API metrics
    const apiCollector = new APIMetricsCollector();
    this.addCollector(apiCollector);
    this.apiCollector = apiCollector;

    // WebSocket metrics
    const wsCollector = new WebSocketMetricsCollector();
    this.addCollector(wsCollector);
    this.wsCollector = wsCollector;

    // Business metrics
    const businessCollector = new BusinessMetricsCollector();
    this.addCollector(businessCollector);
    this.businessCollector = businessCollector;

    // Data metrics
    const dataRoot = this.config.storage?.storageRoot?.replace('/metrics', '') || '~/.prism-gateway';
    this.addCollector(new DataMetricsCollector({ config: { dataRoot } }));

    console.log('[MetricsService] Registered built-in collectors');
  }

  private startCollectors(): void {
    for (const collector of this.collectors.values()) {
      this.startCollector(collector);
    }
  }

  private startCollector(collector: MetricCollector): void {
    if (!collector.enabled) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const metrics = await collector.collect();
        if (metrics.length > 0) {
          await this.storage.write(metrics);
        }
      } catch (error) {
        console.error(`[MetricsService] Collection failed for ${collector.name}:`, error);
      }
    }, collector.interval * 1000);

    this.collectionTimers.set(collector.name, timer);
  }

  private startAggregation(): void {
    this.aggregationTimer = setInterval(async () => {
      try {
        await this.performAggregation();
      } catch (error) {
        console.error('[MetricsService] Aggregation failed:', error);
      }
    }, this.config.aggregationInterval * 1000);
  }

  private async performAggregation(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Get all metrics from the last minute
    const metricNames = await this.storage.listMetrics('raw');

    for (const name of metricNames) {
      const dataPoints = await this.storage.read('raw', name, oneMinuteAgo, now);

      if (dataPoints.length === 0) {
        continue;
      }

      // Aggregate to 1m
      const aggregated1m = this.aggregator.aggregate1m(dataPoints as MetricDataPoint[]);
      if (aggregated1m.length > 0) {
        await this.storage.writeAggregated('1m', aggregated1m);
      }

      // Aggregate to 5m (from 1m data)
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const data1m = await this.storage.read('1m', name, fiveMinutesAgo, now);
      if (data1m.length > 0) {
        const aggregated5m = this.aggregator.aggregate5m(data1m as MetricDataPoint[]);
        if (aggregated5m.length > 0) {
          await this.storage.writeAggregated('5m', aggregated5m);
        }
      }

      // Aggregate to 1h (from 5m data)
      const oneHourAgo = now - 60 * 60 * 1000;
      const data5m = await this.storage.read('5m', name, oneHourAgo, now);
      if (data5m.length > 0) {
        const aggregated1h = this.aggregator.aggregate1h(data5m as MetricDataPoint[]);
        if (aggregated1h.length > 0) {
          await this.storage.writeAggregated('1h', aggregated1h);
        }
      }
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        const deleted = await this.storage.cleanup();
        console.log(`[MetricsService] Cleanup deleted ${deleted} files`);
      } catch (error) {
        console.error('[MetricsService] Cleanup failed:', error);
      }
    }, this.config.cleanupInterval * 1000);
  }
}
