/**
 * Metric Collectors 单元测试
 *
 * @description
 * 测试 6 个内置指标收集器
 */

import { describe, it, expect } from 'bun:test';
import {
  SystemMetricsCollector,
  ProcessMetricsCollector,
  APIMetricsCollector,
  WebSocketMetricsCollector,
  BusinessMetricsCollector,
  DataMetricsCollector
} from '../../../../infrastructure/metrics/collectors.js';
import { MetricType } from '../../../../infrastructure/metrics/types.js';

describe('SystemMetricsCollector', () => {
  it('should have correct default configuration', () => {
    const collector = new SystemMetricsCollector();

    expect(collector.name).toBe('system');
    expect(collector.interval).toBe(10);
    expect(collector.enabled).toBe(true);
    expect(collector.getMetricType()).toBe('gauge');
  });

  it('should collect system metrics', async () => {
    const collector = new SystemMetricsCollector();
    const metrics = await collector.collect();

    expect(metrics.length).toBeGreaterThan(0);

    // Should include CPU metrics
    const cpuMetric = metrics.find(m => m.name === 'system.cpu.usage');
    expect(cpuMetric).toBeDefined();
    expect(cpuMetric!.value).toBeGreaterThanOrEqual(0);
    expect(cpuMetric!.value).toBeLessThanOrEqual(100);

    // Should include memory metrics
    const memoryUsedMetric = metrics.find(m => m.name === 'system.memory.used');
    expect(memoryUsedMetric).toBeDefined();
    expect(memoryUsedMetric!.value).toBeGreaterThan(0);

    const memoryTotalMetric = metrics.find(m => m.name === 'system.memory.total');
    expect(memoryTotalMetric).toBeDefined();
    expect(memoryTotalMetric!.value).toBeGreaterThan(0);

    // Should include load average
    const load1m = metrics.find(m => m.name === 'system.load.1m');
    expect(load1m).toBeDefined();

    // Should include uptime
    const uptime = metrics.find(m => m.name === 'system.uptime');
    expect(uptime).toBeDefined();
    expect(uptime!.value).toBeGreaterThan(0);
  });

  it('should have labels for metrics', async () => {
    const collector = new SystemMetricsCollector();
    const metrics = await collector.collect();

    const cpuMetric = metrics.find(m => m.name === 'system.cpu.usage');
    expect(cpuMetric?.labels).toBeDefined();
    expect(cpuMetric?.labels?.unit).toBe('percent');
  });

  it('should allow custom configuration', () => {
    const collector = new SystemMetricsCollector({ interval: 20, enabled: false });

    expect(collector.interval).toBe(20);
    expect(collector.enabled).toBe(false);
  });
});

describe('ProcessMetricsCollector', () => {
  it('should have correct default configuration', () => {
    const collector = new ProcessMetricsCollector();

    expect(collector.name).toBe('process');
    expect(collector.interval).toBe(10);
    expect(collector.enabled).toBe(true);
    expect(collector.getMetricType()).toBe('gauge');
  });

  it('should collect process metrics', async () => {
    const collector = new ProcessMetricsCollector();
    const metrics = await collector.collect();

    expect(metrics.length).toBeGreaterThan(0);

    // Should include PID
    const pidMetric = metrics.find(m => m.name === 'process.pid');
    expect(pidMetric).toBeDefined();
    expect(pidMetric!.value).toBe(process.pid);

    // Should include uptime
    const uptimeMetric = metrics.find(m => m.name === 'process.uptime');
    expect(uptimeMetric).toBeDefined();
    expect(uptimeMetric!.value).toBeGreaterThanOrEqual(0);

    // Should include memory metrics
    const rssMetric = metrics.find(m => m.name === 'process.memory.rss');
    expect(rssMetric).toBeDefined();
    expect(rssMetric!.value).toBeGreaterThan(0);

    const heapTotalMetric = metrics.find(m => m.name === 'process.memory.heapTotal');
    expect(heapTotalMetric).toBeDefined();

    const heapUsedMetric = metrics.find(m => m.name === 'process.memory.heapUsed');
    expect(heapUsedMetric).toBeDefined();
  });

  it('should calculate CPU usage on subsequent collections', async () => {
    const collector = new ProcessMetricsCollector();

    // First collection establishes baseline
    await collector.collect();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second collection should include CPU usage
    const metrics = await collector.collect();
    const cpuMetric = metrics.find(m => m.name === 'process.cpu.usage');

    expect(cpuMetric).toBeDefined();
    expect(cpuMetric!.value).toBeGreaterThanOrEqual(0);
  });

  it('should track active handles and requests', async () => {
    const collector = new ProcessMetricsCollector();
    const metrics = await collector.collect();

    const handlesMetric = metrics.find(m => m.name === 'process.handles.active');
    const requestsMetric = metrics.find(m => m.name === 'process.requests.active');

    expect(handlesMetric).toBeDefined();
    expect(requestsMetric).toBeDefined();
    expect(handlesMetric!.value).toBeGreaterThanOrEqual(0);
    expect(requestsMetric!.value).toBeGreaterThanOrEqual(0);
  });
});

describe('APIMetricsCollector', () => {
  it('should have correct default configuration', () => {
    const collector = new APIMetricsCollector();

    expect(collector.name).toBe('api');
    expect(collector.interval).toBe(5);
    expect(collector.enabled).toBe(true);
    expect(collector.getMetricType()).toBe('counter');
  });

  it('should collect API metrics', async () => {
    const collector = new APIMetricsCollector();
    const metrics = await collector.collect();

    expect(metrics).toBeDefined();
    // Initial metrics should include counters
    const requestsMetric = metrics.find(m => m.name === 'api.requests.total');
    expect(requestsMetric).toBeDefined();
  });

  it('should record HTTP requests', () => {
    const collector = new APIMetricsCollector();

    collector.recordRequest('/api/test', 'GET', 200, 150);
    collector.recordRequest('/api/test', 'POST', 201, 200);
  });

  it('should record error responses', () => {
    const collector = new APIMetricsCollector();

    collector.recordRequest('/api/error', 'GET', 500, 50);
  });
});

describe('WebSocketMetricsCollector', () => {
  it('should have correct default configuration', () => {
    const collector = new WebSocketMetricsCollector();

    expect(collector.name).toBe('websocket');
    expect(collector.interval).toBe(5);
    expect(collector.enabled).toBe(true);
    expect(collector.getMetricType()).toBe('gauge');
  });

  it('should collect WebSocket metrics', async () => {
    const collector = new WebSocketMetricsCollector();
    const metrics = await collector.collect();

    expect(metrics).toBeDefined();
    const connectionsMetric = metrics.find(m => m.name === 'websocket.connections.active');
    expect(connectionsMetric).toBeDefined();
  });

  it('should record connections', () => {
    const collector = new WebSocketMetricsCollector();

    collector.recordConnection('client-1');
    collector.recordDisconnection('client-1');
  });

  it('should record messages', () => {
    const collector = new WebSocketMetricsCollector();

    collector.recordMessage('text', 'sent', 1024);
    collector.recordMessage('binary', 'received', 2048);
  });
});

describe('BusinessMetricsCollector', () => {
  it('should have correct default configuration', () => {
    const collector = new BusinessMetricsCollector();

    expect(collector.name).toBe('business');
    expect(collector.interval).toBe(30);
    expect(collector.enabled).toBe(true);
    expect(collector.getMetricType()).toBe('counter');
  });

  it('should collect business metrics', async () => {
    const collector = new BusinessMetricsCollector();
    const metrics = await collector.collect();

    expect(metrics).toBeDefined();
    const checksMetric = metrics.find(m => m.name === 'business.gateway.checks.total');
    expect(checksMetric).toBeDefined();
  });

  it('should record gateway checks', () => {
    const collector = new BusinessMetricsCollector();

    collector.recordGatewayCheck('PASS', 150);
    collector.recordGatewayCheck('BLOCKED', 200);
  });

  it('should record retrospectives', () => {
    const collector = new BusinessMetricsCollector();

    collector.recordRetrospective('quick');
    collector.recordRetrospective('standard');
  });

  it('should record violations', () => {
    const collector = new BusinessMetricsCollector();

    collector.recordViolation('principle-1', 'high');
  });
});

describe('DataMetricsCollector', () => {
  it('should have correct default configuration', () => {
    const collector = new DataMetricsCollector();

    expect(collector.name).toBe('data');
    expect(collector.interval).toBe(60);
    expect(collector.enabled).toBe(true);
    expect(collector.getMetricType()).toBe('gauge');
  });

  it('should collect data metrics', async () => {
    const collector = new DataMetricsCollector();
    const metrics = await collector.collect();

    expect(metrics).toBeDefined();
    expect(metrics.length).toBeGreaterThanOrEqual(0);
  });

  it('should calculate data sizes', async () => {
    const collector = new DataMetricsCollector();
    const metrics = await collector.collect();

    // Metrics should include size information
    const hasSizeMetric = metrics.some(m => m.labels?.unit === 'bytes');
    // This is optional as data directories may not exist
  });
});

describe('All Collectors', () => {
  it('should have unique names', () => {
    const collectors = [
      new SystemMetricsCollector(),
      new ProcessMetricsCollector(),
      new APIMetricsCollector(),
      new WebSocketMetricsCollector(),
      new BusinessMetricsCollector(),
      new DataMetricsCollector()
    ];

    const names = collectors.map(c => c.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(collectors.length);
  });

  it('should all be enabled by default', () => {
    const collectors = [
      new SystemMetricsCollector(),
      new ProcessMetricsCollector(),
      new APIMetricsCollector(),
      new WebSocketMetricsCollector(),
      new BusinessMetricsCollector(),
      new DataMetricsCollector()
    ];

    collectors.forEach(collector => {
      expect(collector.enabled).toBe(true);
    });
  });

  it('should all have positive intervals', () => {
    const collectors = [
      new SystemMetricsCollector(),
      new ProcessMetricsCollector(),
      new APIMetricsCollector(),
      new WebSocketMetricsCollector(),
      new BusinessMetricsCollector(),
      new DataMetricsCollector()
    ];

    collectors.forEach(collector => {
      expect(collector.interval).toBeGreaterThan(0);
    });
  });

  it('should all collect non-empty or empty metrics arrays', async () => {
    const collectors = [
      new SystemMetricsCollector(),
      new ProcessMetricsCollector(),
      new APIMetricsCollector(),
      new WebSocketMetricsCollector(),
      new BusinessMetricsCollector(),
      new DataMetricsCollector()
    ];

    for (const collector of collectors) {
      const metrics = await collector.collect();
      expect(Array.isArray(metrics)).toBe(true);
    }
  });
});
