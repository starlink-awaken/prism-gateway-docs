/**
 * MetricsService 单元测试
 *
 * @description
 * 测试统一指标服务 API
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MetricsService } from '../../../../infrastructure/metrics/MetricsService.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('MetricsService', () => {
  let service: MetricsService;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metrics-service-test-'));
    service = new MetricsService({
      storage: { basePath: testDir },
      enableBuiltInCollectors: true
    });
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialize()', () => {
    it('should initialize successfully', async () => {
      const newService = new MetricsService({
        storage: { basePath: testDir + '-new' },
        enableBuiltInCollectors: false
      });

      await expect(newService.initialize()).resolves.not.toThrow();
      await newService.shutdown();
    });

    it('should not initialize twice', async () => {
      // Already initialized in beforeEach
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should register built-in collectors when enabled', () => {
      const collectors = service.listCollectors();

      expect(collectors.length).toBeGreaterThan(0);
      expect(collectors).toContain('system');
      expect(collectors).toContain('process');
    });
  });

  describe('snapshot()', () => {
    it('should return metrics snapshot', async () => {
      // Wait a bit for collectors to run
      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = await service.snapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(Array.isArray(snapshot.metrics)).toBe(true);
    });

    it('should include metrics from all collectors', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = await service.snapshot();

      expect(snapshot.metrics.length).toBeGreaterThan(0);
    });
  });

  describe('query()', () => {
    it('should query metrics by name', async () => {
      // Let collectors run and record some data
      await new Promise(resolve => setTimeout(resolve, 200));

      const result = await service.query({
        name: 'system.cpu.usage',
        start: Date.now() - 1000,
        end: Date.now()
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter by time range', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const now = Date.now();
      const result = await service.query({
        name: 'process.memory.rss',
        start: now - 500,
        end: now
      });

      result.data.forEach(point => {
        expect(point.timestamp).toBeGreaterThanOrEqual(now - 500);
        expect(point.timestamp).toBeLessThanOrEqual(now);
      });
    });

    it('should apply aggregation', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const result = await service.query({
        name: 'system.memory.used',
        start: Date.now() - 1000,
        end: Date.now(),
        aggregation: 'avg'
      });

      expect(result).toBeDefined();
      expect(typeof result.aggregatedValue).toBe('number');
    });
  });

  describe('listMetrics()', () => {
    it('should list all available metrics', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = await service.listMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include metric metadata', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = await service.listMetrics();

      metrics.forEach(metric => {
        expect(metric.name).toBeDefined();
        expect(metric.type).toBeDefined();
      });
    });
  });

  describe('getStats()', () => {
    it('should return service statistics', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = await service.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalCollectors).toBeGreaterThan(0);
      expect(stats.totalMetrics).toBeGreaterThanOrEqual(0);
      expect(stats.totalDataPoints).toBeGreaterThanOrEqual(0);
    });

    it('should include collector stats', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = await service.getStats();

      expect(stats.collectorStats).toBeDefined();
      expect(Object.keys(stats.collectorStats).length).toBeGreaterThan(0);
    });
  });

  describe('registerCollector()', () => {
    it('should allow registering custom collector', async () => {
      // Create a mock collector
      const customCollector = {
        name: 'custom',
        interval: 10,
        enabled: true,
        getMetricType: () => 'gauge' as const,
        collect: async () => [
          { name: 'custom.metric', value: 42, timestamp: Date.now() }
        ],
        getStats: () => ({
          name: 'custom',
          enabled: true,
          collectionCount: 0,
          errorCount: 0
        }),
        updateConfig: () => {},
        reset: () => {}
      };

      service.registerCollector(customCollector);

      const collectors = service.listCollectors();
      expect(collectors).toContain('custom');
    });
  });

  describe('unregisterCollector()', () => {
    it('should allow unregistering collector', async () => {
      service.unregisterCollector('system');

      const collectors = service.listCollectors();
      expect(collectors).not.toContain('system');
    });
  });

  describe('listCollectors()', () => {
    it('should list all registered collectors', () => {
      const collectors = service.listCollectors();

      expect(Array.isArray(collectors)).toBe(true);
      expect(collectors.length).toBeGreaterThan(0);
    });

    it('should include built-in collectors', () => {
      const collectors = service.listCollectors();

      expect(collectors).toContain('system');
      expect(collectors).toContain('process');
      expect(collectors).toContain('api');
      expect(collectors).toContain('websocket');
      expect(collectors).toContain('business');
      expect(collectors).toContain('data');
    });
  });

  describe('Event recording methods', () => {
    it('should record API request', async () => {
      service.recordAPIRequest('/test', 'GET', 200, 150);

      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = await service.snapshot();
      const apiMetrics = snapshot.metrics.filter(m => m.name.startsWith('api.'));

      expect(apiMetrics.length).toBeGreaterThan(0);
    });

    it('should record WebSocket connection', () => {
      service.recordWSConnection('client-1');
      service.recordWSDisconnection('client-1');
      service.recordWSMessage('text', 'sent', 1024);
    });

    it('should record business events', () => {
      service.recordGatewayCheck('PASS', 150);
      service.recordRetrospective('quick');
      service.recordViolation('principle-1', 'high');
    });
  });

  describe('shutdown()', () => {
    it('should shutdown cleanly', async () => {
      await expect(service.shutdown()).resolves.not.toThrow();
    });

    it('should stop all timers', async () => {
      await service.shutdown();

      // Service should be inactive after shutdown
      const newService = new MetricsService({
        storage: { basePath: testDir + '-shutdown' },
        enableBuiltInCollectors: false
      });

      await newService.initialize();
      await newService.shutdown();
    });
  });

  describe('Configuration', () => {
    it('should use custom aggregation interval', async () => {
      const customService = new MetricsService({
        storage: { basePath: testDir + '-custom' },
        aggregationInterval: 30,
        enableBuiltInCollectors: false
      });

      await customService.initialize();
      await customService.shutdown();
    });

    it('should use custom cleanup interval', async () => {
      const customService = new MetricsService({
        storage: { basePath: testDir + '-cleanup' },
        cleanupInterval: 1800,
        enableBuiltInCollectors: false
      });

      await customService.initialize();
      await customService.shutdown();
    });

    it('should allow disabling built-in collectors', async () => {
      const customService = new MetricsService({
        storage: { basePath: testDir + '-disabled' },
        enableBuiltInCollectors: false
      });

      await customService.initialize();

      const collectors = customService.listCollectors();
      expect(collectors.length).toBe(0);

      await customService.shutdown();
    });
  });
});
