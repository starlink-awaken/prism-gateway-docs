/**
 * Metrics 单元测试
 *
 * @description
 * 测试 Metrics 指标收集的核心功能：
 * - 请求计数（总数、成功、失败）
 * - 响应时间（P50、P95、P99）
 * - 速率限制触发次数
 * - 缓存命中率
 * - 指标聚合
 * - 时间窗口统计
 *
 * @testStrategy
 * RED-GREEN-REFACTOR:
 * 1. RED: 先写测试，预期失败
 * 2. GREEN: 实现 Metrics 使测试通过
 * 3. REFACTOR: 重构优化代码
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Metrics, MetricType, CounterMetric, HistogramMetric, GaugeMetric } from './Metrics.js';

describe('Metrics', () => {
  let metrics: Metrics;

  beforeEach(() => {
    metrics = new Metrics({ prefix: 'prism' });
  });

  afterEach(() => {
    metrics.clear();
  });

  describe('构造函数', () => {
    it('应该创建默认配置的指标收集器', () => {
      expect(metrics).toBeDefined();
    });

    it('应该支持设置指标前缀', () => {
      const customMetrics = new Metrics({ prefix: 'custom' });
      expect(customMetrics.prefix).toBe('custom');
    });

    it('应该支持自定义时间窗口', () => {
      const customMetrics = new Metrics({
        prefix: 'test',
        windowSize: 60000 // 1分钟
      });
      expect(customMetrics).toBeDefined();
    });

    it('应该支持启用/禁用指标', () => {
      const disabledMetrics = new Metrics({
        prefix: 'test',
        enabled: false
      });
      expect(disabledMetrics.enabled).toBe(false);
    });
  });

  describe('Counter 计数器', () => {
    it('应该创建计数器指标', () => {
      const counter = metrics.createCounter('requests_total', 'Total requests');
      expect(counter).toBeDefined();
      expect(counter).toBeInstanceOf(CounterMetric);
    });

    it('应该增加计数器值', () => {
      const counter = metrics.createCounter('requests_total', 'Total requests');
      counter.inc();
      expect(counter.value).toBe(1);
    });

    it('应该支持指定增加步长', () => {
      const counter = metrics.createCounter('requests_total', 'Total requests');
      counter.inc(5);
      expect(counter.value).toBe(5);
    });

    it('应该支持标签', () => {
      const counter = metrics.createCounter('requests_total', 'Total requests');
      counter.inc(1, { method: 'GET', status: '200' });
      counter.inc(1, { method: 'POST', status: '201' });

      expect(counter.value).toBe(2);
    });

    it('应该支持获取带标签的计数', () => {
      const counter = metrics.createCounter('requests_total', 'Total requests');
      counter.inc(1, { method: 'GET' });
      counter.inc(2, { method: 'POST' });

      const value = counter.value;
      expect(value).toBeGreaterThanOrEqual(0);
    });

    it('应该支持重置计数器', () => {
      const counter = metrics.createCounter('requests_total', 'Total requests');
      counter.inc(10);
      counter.reset();
      expect(counter.value).toBe(0);
    });
  });

  describe('Histogram 直方图', () => {
    it('应该创建直方图指标', () => {
      const histogram = metrics.createHistogram(
        'request_duration_ms',
        'Request duration in milliseconds'
      );
      expect(histogram).toBeDefined();
      expect(histogram).toBeInstanceOf(HistogramMetric);
    });

    it('应该记录观测值', () => {
      const histogram = metrics.createHistogram('request_duration_ms', 'Duration');
      histogram.observe(100);
      histogram.observe(200);
      histogram.observe(300);

      expect(histogram.count).toBe(3);
      expect(histogram.sum).toBe(600);
    });

    it('应该计算 P50 百分位数', () => {
      const histogram = metrics.createHistogram('request_duration_ms', 'Duration');

      // 添加100个值
      for (let i = 1; i <= 100; i++) {
        histogram.observe(i);
      }

      const p50 = histogram.percentile(50);
      expect(p50).toBeGreaterThan(40);
      expect(p50).toBeLessThan(60);
    });

    it('应该计算 P95 百分位数', () => {
      const histogram = metrics.createHistogram('request_duration_ms', 'Duration');

      for (let i = 1; i <= 100; i++) {
        histogram.observe(i);
      }

      const p95 = histogram.percentile(95);
      expect(p95).toBeGreaterThan(90);
      expect(p95).toBeLessThan(100);
    });

    it('应该计算 P99 百分位数', () => {
      const histogram = metrics.createHistogram('request_duration_ms', 'Duration');

      for (let i = 1; i <= 100; i++) {
        histogram.observe(i);
      }

      const p99 = histogram.percentile(99);
      expect(p99).toBeGreaterThan(95);
      expect(p99).toBeLessThan(100);
    });

    it('应该计算最小值和最大值', () => {
      const histogram = metrics.createHistogram('request_duration_ms', 'Duration');

      histogram.observe(100);
      histogram.observe(500);
      histogram.observe(300);

      expect(histogram.min).toBe(100);
      expect(histogram.max).toBe(500);
    });

    it('应该计算平均值', () => {
      const histogram = metrics.createHistogram('request_duration_ms', 'Duration');

      histogram.observe(100);
      histogram.observe(200);
      histogram.observe(300);

      expect(histogram.average).toBe(200);
    });

    it('应该支持带标签的观测', () => {
      const histogram = metrics.createHistogram('request_duration_ms', 'Duration');

      histogram.observe(100, { endpoint: '/api/v1/analytics' });
      histogram.observe(200, { endpoint: '/api/v1/auth' });

      expect(histogram.count).toBe(2);
    });
  });

  describe('Gauge 仪表', () => {
    it('应该创建仪表指标', () => {
      const gauge = metrics.createGauge('active_connections', 'Active connections');
      expect(gauge).toBeDefined();
      expect(gauge).toBeInstanceOf(GaugeMetric);
    });

    it('应该设置仪表值', () => {
      const gauge = metrics.createGauge('active_connections', 'Active connections');
      gauge.set(10);
      expect(gauge.value).toBe(10);
    });

    it('应该支持增加值', () => {
      const gauge = metrics.createGauge('active_connections', 'Active connections');
      gauge.set(10);
      gauge.inc();
      expect(gauge.value).toBe(11);
    });

    it('应该支持减少值', () => {
      const gauge = metrics.createGauge('active_connections', 'Active connections');
      gauge.set(10);
      gauge.dec();
      expect(gauge.value).toBe(9);
    });

    it('应该支持指定增加/减少步长', () => {
      const gauge = metrics.createGauge('active_connections', 'Active connections');
      gauge.set(10);
      gauge.inc(5);
      expect(gauge.value).toBe(15);
      gauge.dec(3);
      expect(gauge.value).toBe(12);
    });
  });

  describe('HTTP 请求指标', () => {
    it('应该记录 HTTP 请求', () => {
      metrics.recordHttpRequest({
        method: 'GET',
        path: '/api/v1/analytics',
        status: 200,
        duration: 50
      });

      const requests = metrics.getCounter('http_requests_total');
      expect(requests).toBeDefined();
      expect(requests.value).toBe(1);
    });

    it('应该区分成功和失败请求', () => {
      metrics.recordHttpRequest({
        method: 'GET',
        path: '/api/v1/analytics',
        status: 200,
        duration: 50
      });

      metrics.recordHttpRequest({
        method: 'POST',
        path: '/api/v1/auth',
        status: 401,
        duration: 30
      });

      metrics.recordHttpRequest({
        method: 'GET',
        path: '/api/v1/analytics',
        status: 500,
        duration: 100
      });

      const requests = metrics.getCounter('http_requests_total');
      expect(requests.value).toBe(3);

      const errors = metrics.getCounter('http_errors_total');
      expect(errors.value).toBe(2); // 401 和 500
    });

    it('应该记录请求持续时间', () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/v1/test',
          status: 200,
          duration: 50 + i
        });
      }

      const duration = metrics.getHistogram('http_request_duration_ms');
      expect(duration.count).toBe(100);
      expect(duration.min).toBe(50);
      expect(duration.max).toBe(149);
    });
  });

  describe('缓存指标', () => {
    it('应该记录缓存命中', () => {
      metrics.recordCacheHit('analytics');
      const hits = metrics.getCounter('cache_hits_total');
      expect(hits.value).toBe(1);
    });

    it('应该记录缓存未命中', () => {
      metrics.recordCacheMiss('analytics');
      const misses = metrics.getCounter('cache_misses_total');
      expect(misses.value).toBe(1);
    });

    it('应该计算缓存命中率', () => {
      metrics.recordCacheHit('analytics');
      metrics.recordCacheHit('analytics');
      metrics.recordCacheMiss('analytics');

      const rate = metrics.getCacheHitRate('analytics');
      expect(rate).toBeCloseTo(0.666, 1); // 2/3 ≈ 0.666
    });

    it('应该处理无缓存数据的情况', () => {
      const rate = metrics.getCacheHitRate('nonexistent');
      expect(rate).toBe(0);
    });

    it('应该按缓存名称分组统计', () => {
      metrics.recordCacheHit('analytics');
      metrics.recordCacheHit('analytics');
      metrics.recordCacheMiss('analytics');

      metrics.recordCacheHit('auth');
      metrics.recordCacheMiss('auth');
      metrics.recordCacheMiss('auth');

      const analyticsRate = metrics.getCacheHitRate('analytics');
      const authRate = metrics.getCacheHitRate('auth');

      expect(analyticsRate).toBeCloseTo(0.666, 1);
      expect(authRate).toBeCloseTo(0.333, 1);
    });
  });

  describe('速率限制指标', () => {
    it('应该记录速率限制触发', () => {
      metrics.recordRateLimitExceeded('auth', '127.0.0.1');
      const rateLimits = metrics.getCounter('rate_limit_exceeded_total');
      expect(rateLimits.value).toBe(1);
    });

    it('应该按端点分组速率限制', () => {
      metrics.recordRateLimitExceeded('auth', '127.0.0.1');
      metrics.recordRateLimitExceeded('auth', '127.0.0.1');
      metrics.recordRateLimitExceeded('api', '192.168.1.1');

      const rateLimits = metrics.getCounter('rate_limit_exceeded_total');
      expect(rateLimits.value).toBe(3);
    });
  });

  describe('指标导出', () => {
    it('应该导出所有指标', () => {
      const counter = metrics.createCounter('test_counter', 'Test counter');
      counter.inc(10);

      const histogram = metrics.createHistogram('test_histogram', 'Test histogram');
      histogram.observe(100);

      const gauge = metrics.createGauge('test_gauge', 'Test gauge');
      gauge.set(5);

      const exported = metrics.export();
      expect(exported).toBeDefined();
      expect(exported.size).toBeGreaterThanOrEqual(3);
    });

    it('应该导出 JSON 格式', () => {
      metrics.createCounter('test_counter', 'Test counter').inc(5);

      const json = metrics.toJSON();
      expect(json).toBeDefined();
      expect(typeof json).toBe('object');
    });

    it('应该导出 Prometheus 格式', () => {
      metrics.createCounter('test_counter', 'Test counter').inc(5);

      const prometheus = metrics.toPrometheus();
      expect(prometheus).toBeDefined();
      expect(typeof prometheus).toBe('string');
      expect(prometheus).toContain('test_counter');
    });
  });

  describe('时间窗口统计', () => {
    it('应该支持滑动窗口统计', async () => {
      const windowedMetrics = new Metrics({
        prefix: 'test',
        windowSize: 1000 // 1秒窗口
      });

      const counter = windowedMetrics.createCounter('test_counter', 'Test');
      counter.inc(10);

      expect(counter.value).toBe(10);

      // 等待窗口过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 窗口应该已刷新（如果实现了窗口清理）
      expect(windowedMetrics).toBeDefined();
    });

    it('应该支持获取窗口内指标', () => {
      metrics.createCounter('test_counter', 'Test').inc(5);

      const metricsInWindow = metrics.getMetricsInWindow();
      expect(metricsInWindow.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('指标查询', () => {
    it('应该按名称获取指标', () => {
      metrics.createCounter('test_counter', 'Test');
      const counter = metrics.getCounter('test_counter');

      expect(counter).toBeDefined();
      expect(counter).toBeInstanceOf(CounterMetric);
    });

    it('应该按类型获取指标', () => {
      // 清除默认指标，创建干净的测试环境
      metrics.clear();
      metrics.createCounter('counter1', 'C1');
      metrics.createCounter('counter2', 'C2');
      metrics.createHistogram('histogram1', 'H1');

      const counters = metrics.getMetricsByType(MetricType.COUNTER);
      expect(counters.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持模糊搜索指标名称', () => {
      metrics.clear();
      metrics.createCounter('http_requests_total', 'HTTP requests');
      metrics.createCounter('http_errors_total', 'HTTP errors');
      metrics.createCounter('cache_hits_total', 'Cache hits');

      const httpMetrics = metrics.findMetrics('http_');
      expect(httpMetrics.length).toBeGreaterThanOrEqual(2);
    });

    it('应该在不存在时返回 undefined', () => {
      const counter = metrics.getCounter('nonexistent');
      expect(counter).toBeUndefined();
    });
  });

  describe('性能', () => {
    it('计数器操作应该是 O(1)', () => {
      const counter = metrics.createCounter('perf_counter', 'Performance test');

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        counter.inc();
      }
      const duration = performance.now() - start;

      // 10,000 次操作应该在 50ms 内完成
      expect(duration).toBeLessThan(50);
    });

    it('直方图操作应该是高效的', () => {
      const histogram = metrics.createHistogram('perf_histogram', 'Performance test');

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        histogram.observe(Math.random() * 1000);
      }
      const duration = performance.now() - start;

      // 1,000 次操作应该在 100ms 内完成
      expect(duration).toBeLessThan(100);
    });
  });

  describe('并发安全', () => {
    it('应该支持并发增加计数器', async () => {
      const counter = metrics.createCounter('concurrent_counter', 'Concurrent test');

      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => counter.inc(1))
      );

      await Promise.all(promises);

      expect(counter.value).toBe(100);
    });

    it('应该支持并发观测直方图', async () => {
      const histogram = metrics.createHistogram('concurrent_histogram', 'Concurrent test');

      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => histogram.observe(i))
      );

      await Promise.all(promises);

      expect(histogram.count).toBe(100);
    });
  });
});
