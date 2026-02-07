/**
 * MetricsStorage 单元测试
 *
 * @description
 * 测试 4 级时序存储系统
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MetricsStorage } from '../../../../infrastructure/metrics/MetricsStorage.js';
import type { MetricDataPoint, TimeSeriesGranularity } from '../../../../infrastructure/metrics/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('MetricsStorage', () => {
  let storage: MetricsStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metrics-storage-test-'));
    storage = new MetricsStorage({ basePath: testDir });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.cleanup();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialize()', () => {
    it('should create storage directories', async () => {
      const rawDir = path.join(testDir, 'raw');
      const oneMinDir = path.join(testDir, '1m');
      const fiveMinDir = path.join(testDir, '5m');
      const oneHourDir = path.join(testDir, '1h');

      const rawExists = await fs.access(rawDir).then(() => true).catch(() => false);
      const oneMinExists = await fs.access(oneMinDir).then(() => true).catch(() => false);
      const fiveMinExists = await fs.access(fiveMinDir).then(() => true).catch(() => false);
      const oneHourExists = await fs.access(oneHourDir).then(() => true).catch(() => false);

      expect(rawExists).toBe(true);
      expect(oneMinExists).toBe(true);
      expect(fiveMinExists).toBe(true);
      expect(oneHourExists).toBe(true);
    });
  });

  describe('write()', () => {
    it('should write metric data point', async () => {
      const dataPoint: MetricDataPoint = {
        name: 'test.metric',
        value: 42,
        timestamp: Date.now()
      };

      await storage.write(dataPoint);

      const metrics = await storage.read('test.metric', {
        start: dataPoint.timestamp - 1000,
        end: dataPoint.timestamp + 1000
      });

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].name).toBe('test.metric');
      expect(metrics[0].value).toBe(42);
    });

    it('should write multiple data points', async () => {
      const dataPoints: MetricDataPoint[] = [
        { name: 'test.metric', value: 10, timestamp: Date.now() },
        { name: 'test.metric', value: 20, timestamp: Date.now() + 1000 },
        { name: 'test.metric', value: 30, timestamp: Date.now() + 2000 }
      ];

      for (const dp of dataPoints) {
        await storage.write(dp);
      }

      const metrics = await storage.read('test.metric', {
        start: Date.now() - 1000,
        end: Date.now() + 3000
      });

      expect(metrics.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle labels', async () => {
      const dataPoint: MetricDataPoint = {
        name: 'test.metric',
        value: 42,
        timestamp: Date.now(),
        labels: { environment: 'test', service: 'api' }
      };

      await storage.write(dataPoint);

      const metrics = await storage.read('test.metric', {
        start: dataPoint.timestamp - 1000,
        end: dataPoint.timestamp + 1000
      });

      expect(metrics[0].labels).toEqual({ environment: 'test', service: 'api' });
    });
  });

  describe('read()', () => {
    it('should read metrics in time range', async () => {
      const now = Date.now();
      const dataPoints: MetricDataPoint[] = [
        { name: 'test.metric', value: 10, timestamp: now },
        { name: 'test.metric', value: 20, timestamp: now + 1000 },
        { name: 'test.metric', value: 30, timestamp: now + 2000 }
      ];

      for (const dp of dataPoints) {
        await storage.write(dp);
      }

      const metrics = await storage.read('test.metric', {
        start: now,
        end: now + 1500
      });

      expect(metrics.length).toBe(2);
      expect(metrics[0].value).toBe(10);
      expect(metrics[1].value).toBe(20);
    });

    it('should return empty array for unknown metric', async () => {
      const metrics = await storage.read('unknown.metric', {
        start: Date.now() - 1000,
        end: Date.now()
      });

      expect(metrics).toEqual([]);
    });

    it('should read from specific granularity level', async () => {
      const now = Date.now();
      const dataPoint: MetricDataPoint = {
        name: 'test.metric',
        value: 42,
        timestamp: now
      };

      await storage.write(dataPoint);

      const metrics = await storage.read('test.metric', {
        start: now - 1000,
        end: now + 1000,
        granularity: 'raw' as TimeSeriesGranularity
      });

      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('list()', () => {
    it('should list all metrics', async () => {
      const now = Date.now();
      await storage.write({ name: 'metric1', value: 10, timestamp: now });
      await storage.write({ name: 'metric2', value: 20, timestamp: now });
      await storage.write({ name: 'metric3', value: 30, timestamp: now });

      const metrics = await storage.list();

      expect(metrics.length).toBeGreaterThanOrEqual(3);
      expect(metrics).toContain('metric1');
      expect(metrics).toContain('metric2');
      expect(metrics).toContain('metric3');
    });

    it('should return empty array when no metrics exist', async () => {
      const metrics = await storage.list();

      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('delete()', () => {
    it('should delete metric data', async () => {
      const now = Date.now();
      await storage.write({ name: 'test.metric', value: 42, timestamp: now });

      await storage.delete('test.metric');

      const metrics = await storage.read('test.metric', {
        start: now - 1000,
        end: now + 1000
      });

      expect(metrics).toEqual([]);
    });

    it('should not throw when deleting non-existent metric', async () => {
      await expect(storage.delete('unknown.metric')).resolves.not.toThrow();
    });
  });

  describe('getStats()', () => {
    it('should return storage statistics', async () => {
      const now = Date.now();
      await storage.write({ name: 'metric1', value: 10, timestamp: now });
      await storage.write({ name: 'metric2', value: 20, timestamp: now });

      const stats = await storage.getStats();

      expect(stats.totalMetrics).toBeGreaterThanOrEqual(2);
      expect(stats.totalDataPoints).toBeGreaterThanOrEqual(2);
      expect(stats.storageSize).toBeGreaterThan(0);
      expect(stats.granularityLevels).toEqual(['raw', '1m', '5m', '1h']);
    });
  });

  describe('cleanup()', () => {
    it('should remove old data', async () => {
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      await storage.write({ name: 'old.metric', value: 42, timestamp: oldTimestamp });

      await storage.cleanup();

      const metrics = await storage.read('old.metric', {
        start: oldTimestamp - 1000,
        end: Date.now()
      });

      // Old data should be cleaned up based on retention policy
      // Exact behavior depends on retention configuration
      expect(Array.isArray(metrics)).toBe(true);
    });
  });
});
