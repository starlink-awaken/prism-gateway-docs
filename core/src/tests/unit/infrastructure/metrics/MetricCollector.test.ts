/**
 * MetricCollector 单元测试
 *
 * @description
 * 测试指标收集器基类的核心功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { MetricCollector } from '../../../../infrastructure/metrics/MetricCollector.js';
import type { MetricDataPoint, MetricCollectorConfig, MetricType } from '../../../../infrastructure/metrics/types.js';
import { MetricType as MetricTypeEnum } from '../../../../infrastructure/metrics/types.js';

// 创建测试用的具体收集器实现
class TestCollector extends MetricCollector {
  private shouldFail: boolean = false;
  private metricsToReturn: MetricDataPoint[] = [];

  constructor(config: MetricCollectorConfig) {
    super(config);
  }

  getMetricType(): MetricType {
    return MetricTypeEnum.Gauge;
  }

  protected async performCollection(): Promise<MetricDataPoint[]> {
    if (this.shouldFail) {
      throw new Error('Collection failed intentionally');
    }
    return this.metricsToReturn;
  }

  // Test helpers
  setMetrics(metrics: MetricDataPoint[]): void {
    this.metricsToReturn = metrics;
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  // Expose protected method for testing
  public testCreateDataPoint(
    name: string,
    value: number,
    labels?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): MetricDataPoint {
    return this.createDataPoint(name, value, labels, metadata);
  }
}

describe('MetricCollector', () => {
  let collector: TestCollector;
  let config: MetricCollectorConfig;

  beforeEach(() => {
    config = {
      name: 'test-collector',
      interval: 1000,
      enabled: true
    };
    collector = new TestCollector(config);
  });

  describe('基础属性', () => {
    it('should return correct name', () => {
      expect(collector.name).toBe('test-collector');
    });

    it('should return correct interval', () => {
      expect(collector.interval).toBe(1000);
    });

    it('should return correct enabled status', () => {
      expect(collector.enabled).toBe(true);
    });

    it('should return correct metric type', () => {
      expect(collector.getMetricType()).toBe(MetricTypeEnum.Gauge);
    });
  });

  describe('collect()', () => {
    it('should collect metrics successfully', async () => {
      const testMetrics: MetricDataPoint[] = [
        { name: 'test.metric1', value: 100, timestamp: Date.now() },
        { name: 'test.metric2', value: 200, timestamp: Date.now() }
      ];
      collector.setMetrics(testMetrics);

      const metrics = await collector.collect();

      expect(metrics).toHaveLength(2);
      expect(metrics[0].name).toBe('test.metric1');
      expect(metrics[1].name).toBe('test.metric2');
    });

    it('should return empty array when disabled', async () => {
      collector.updateConfig({ enabled: false });
      collector.setMetrics([
        { name: 'test.metric', value: 100, timestamp: Date.now() }
      ]);

      const metrics = await collector.collect();

      expect(metrics).toHaveLength(0);
    });

    it('should update collection count on success', async () => {
      collector.setMetrics([{ name: 'test.metric', value: 100, timestamp: Date.now() }]);

      await collector.collect();
      await collector.collect();

      const stats = collector.getStats();
      expect(stats.collectionCount).toBe(2);
    });

    it('should update error count on failure', async () => {
      collector.setShouldFail(true);

      try {
        await collector.collect();
      } catch (error) {
        // Expected
      }

      const stats = collector.getStats();
      expect(stats.errorCount).toBe(1);
    });

    it('should set lastCollection timestamp', async () => {
      collector.setMetrics([{ name: 'test.metric', value: 100, timestamp: Date.now() }]);

      const beforeCollect = Date.now();
      await collector.collect();
      const afterCollect = Date.now();

      const stats = collector.getStats();
      expect(stats.lastCollection).toBeGreaterThanOrEqual(beforeCollect);
      expect(stats.lastCollection).toBeLessThanOrEqual(afterCollect);
    });

    it('should throw error on collection failure', async () => {
      collector.setShouldFail(true);

      await expect(collector.collect()).rejects.toThrow('Collection failed intentionally');
    });
  });

  describe('getStats()', () => {
    it('should return correct initial stats', () => {
      const stats = collector.getStats();

      expect(stats.name).toBe('test-collector');
      expect(stats.enabled).toBe(true);
      expect(stats.collectionCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.lastCollection).toBeUndefined();
    });

    it('should reflect updated stats after collections', async () => {
      collector.setMetrics([{ name: 'test.metric', value: 100, timestamp: Date.now() }]);

      await collector.collect();
      await collector.collect();

      const stats = collector.getStats();
      expect(stats.collectionCount).toBe(2);
      expect(stats.errorCount).toBe(0);
      expect(stats.lastCollection).toBeDefined();
    });

    it('should reflect error stats after failed collections', async () => {
      collector.setShouldFail(true);

      try {
        await collector.collect();
      } catch (error) {
        // Expected
      }

      const stats = collector.getStats();
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('updateConfig()', () => {
    it('should update interval', () => {
      collector.updateConfig({ interval: 2000 });

      expect(collector.interval).toBe(2000);
    });

    it('should update enabled status', () => {
      collector.updateConfig({ enabled: false });

      expect(collector.enabled).toBe(false);
    });

    it('should preserve other config values', () => {
      collector.updateConfig({ interval: 3000 });

      expect(collector.name).toBe('test-collector');
      expect(collector.enabled).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should reset all state', async () => {
      collector.setMetrics([{ name: 'test.metric', value: 100, timestamp: Date.now() }]);
      await collector.collect();
      await collector.collect();

      collector.reset();

      const stats = collector.getStats();
      expect(stats.collectionCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.lastCollection).toBeUndefined();
    });
  });

  describe('createDataPoint()', () => {
    it('should create basic data point', () => {
      const dataPoint = collector.testCreateDataPoint('test.metric', 42);

      expect(dataPoint.name).toBe('test.metric');
      expect(dataPoint.value).toBe(42);
      expect(dataPoint.timestamp).toBeGreaterThan(0);
      expect(dataPoint.labels).toBeUndefined();
      expect(dataPoint.metadata).toBeUndefined();
    });

    it('should create data point with labels', () => {
      const labels = { environment: 'test', service: 'api' };
      const dataPoint = collector.testCreateDataPoint('test.metric', 42, labels);

      expect(dataPoint.labels).toEqual(labels);
    });

    it('should create data point with metadata', () => {
      const metadata = { source: 'collector', version: '1.0' };
      const dataPoint = collector.testCreateDataPoint('test.metric', 42, undefined, metadata);

      expect(dataPoint.metadata).toEqual(metadata);
    });

    it('should create data point with both labels and metadata', () => {
      const labels = { environment: 'test' };
      const metadata = { source: 'collector' };
      const dataPoint = collector.testCreateDataPoint('test.metric', 42, labels, metadata);

      expect(dataPoint.labels).toEqual(labels);
      expect(dataPoint.metadata).toEqual(metadata);
    });
  });
});
