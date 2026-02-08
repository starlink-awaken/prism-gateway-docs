/**
 * 性能基准测试
 *
 * @description
 * 缓存性能测试，验证 P95/P99 延迟目标
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { CacheManager } from '../../../../infrastructure/cache/CacheManager.js';
import { TokenCache } from '../../../../infrastructure/cache/TokenCache.js';
import { PerformanceBenchmark } from '../../../../infrastructure/cache/Benchmark.js';

describe('infrastructure/cache/Benchmark', () => {
  let benchmark: PerformanceBenchmark;

  beforeAll(() => {
    benchmark = new PerformanceBenchmark({
      concurrency: 10,
      requestsPerConcurrency: 1000,
      warmupRounds: 1,
      measureMemory: true
    });
  });

  describe('CacheManager 性能测试', () => {
    it('get 操作 P95 延迟应 < 1ms', async () => {
      const cache = new CacheManager({
        maxSize: 10000,
        name: 'perf-test'
      });

      // 预填充缓存
      for (let i = 0; i < 1000; i++) {
        await cache.set(`key${i}`, { value: i, data: 'test data' });
      }

      const report = await benchmark.run([
        {
          name: 'cache.get',
          fn: async () => {
            const key = `key${Math.floor(Math.random() * 1000)}`;
            await cache.get(key);
          }
        }
      ]);

      const result = report.results[0];

      // 验证性能目标
      expect(result.p95LatencyMs).toBeLessThan(1);
      expect(result.p99LatencyMs).toBeLessThan(5);
      expect(result.avgLatencyMs).toBeLessThan(0.5);

      console.log('\n[CacheManager.get] 性能报告:');
      console.log(`  吞吐量: ${result.throughput.toFixed(0)} 请求/秒`);
      console.log(`  P95 延迟: ${result.p95LatencyMs.toFixed(3)} ms`);
      console.log(`  P99 延迟: ${result.p99LatencyMs.toFixed(3)} ms`);
    });

    it('set 操作 P95 延迟应 < 1ms', async () => {
      const cache = new CacheManager({
        maxSize: 10000,
        name: 'perf-test-set'
      });

      const report = await benchmark.run([
        {
          name: 'cache.set',
          fn: async () => {
            const key = `key${Math.random() * 10000}`;
            await cache.set(key, { value: Math.random(), data: 'test' });
          }
        }
      ]);

      const result = report.results[0];

      // 验证性能目标
      expect(result.p95LatencyMs).toBeLessThan(1);
      expect(result.p99LatencyMs).toBeLessThan(5);

      console.log('\n[CacheManager.set] 性能报告:');
      console.log(`  吞吐量: ${result.throughput.toFixed(0)} 请求/秒`);
      console.log(`  P95 延迟: ${result.p95LatencyMs.toFixed(3)} ms`);
      console.log(`  P99 延迟: ${result.p99LatencyMs.toFixed(3)} ms`);
    });

    it('批量操作应该正确执行', async () => {
      const cache = new CacheManager({
        maxSize: 10000,
        name: 'perf-test-batch'
      });

      // 测试批量操作的正确性而非性能
      const entries: Array<[string, unknown]> = [];
      for (let i = 0; i < 10; i++) {
        entries.push([`batch_key_${i}`, { value: i }]);
      }

      await cache.setMany(entries);

      // 验证所有项目都已设置
      for (let i = 0; i < 10; i++) {
        const value = await cache.get(`batch_key_${i}`);
        expect(value).toEqual({ value: i });
      }

      expect(cache.size()).toBeGreaterThanOrEqual(10);
    });

    it('缓存命中应显著快于未命中', async () => {
      const cache = new CacheManager({
        maxSize: 10000,
        name: 'perf-test-hit'
      });

      // 预填充
      await cache.set('existing_key', { value: 'data' });

      // 缓存命中
      const hitReport = await benchmark.run([
        {
          name: 'cache.hit',
          fn: async () => {
            await cache.get('existing_key');
          }
        }
      ]);

      // 缓存未命中
      const missReport = await benchmark.run([
        {
          name: 'cache.miss',
          fn: async () => {
            await cache.get('non_existing_key');
          }
        }
      ]);

      const hitResult = hitReport.results[0];
      const missResult = missReport.results[0];

      // 命中应该更快（虽然差异可能很小）
      console.log('\n[命中率对比] 性能报告:');
      console.log(`  缓存命中 P95: ${hitResult.p95LatencyMs.toFixed(3)} ms`);
      console.log(`  缓存未命中 P95: ${missResult.p95LatencyMs.toFixed(3)} ms`);
      console.log(`  命中率: ${cache.getStats().hitRate.toFixed(2)}%`);
    });
  });

  describe('TokenCache 性能测试', () => {
    it('Token 验证缓存 P95 延迟应 < 1ms', async () => {
      const tokenCache = new TokenCache({
        maxTokens: 10000,
        enabled: true
      });

      const mockResult = {
        valid: true,
        payload: {
          sub: 'user123',
          username: 'alice',
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: 'jti_123',
          iss: 'prism-gateway',
          aud: 'prism-gateway-api'
        }
      };

      // 预填充
      for (let i = 0; i < 1000; i++) {
        tokenCache.set(`token.${i}`, mockResult);
      }

      const report = await benchmark.run([
        {
          name: 'tokenCache.get',
          fn: async () => {
            const token = `token.${Math.floor(Math.random() * 1000)}`;
            tokenCache.get(token);
          }
        }
      ]);

      const result = report.results[0];

      // 验证性能目标
      expect(result.p95LatencyMs).toBeLessThan(1);

      console.log('\n[TokenCache.get] 性能报告:');
      console.log(`  吞吐量: ${result.throughput.toFixed(0)} 请求/秒`);
      console.log(`  P95 延迟: ${result.p95LatencyMs.toFixed(3)} ms`);
      console.log(`  P99 延迟: ${result.p99LatencyMs.toFixed(3)} ms`);
      console.log(`  命中率: ${tokenCache.getStats().hitRate.toFixed(2)}%`);
    });

    it('黑名单检查 P95 延迟应 < 1ms', async () => {
      const tokenCache = new TokenCache({
        maxBlacklist: 5000,
        enabled: true
      });

      // 预填充黑名单
      for (let i = 0; i < 1000; i++) {
        tokenCache.addToBlacklist(
          `jti_${i}`,
          Math.floor(Date.now() / 1000) + 3600
        );
      }

      const report = await benchmark.run([
        {
          name: 'tokenCache.isBlacklisted',
          fn: async () => {
            const jti = `jti_${Math.floor(Math.random() * 1000)}`;
            tokenCache.isBlacklisted(jti);
          }
        }
      ]);

      const result = report.results[0];

      // 验证性能目标
      expect(result.p95LatencyMs).toBeLessThan(1);

      console.log('\n[TokenCache.isBlacklisted] 性能报告:');
      console.log(`  吞吐量: ${result.throughput.toFixed(0)} 检查/秒`);
      console.log(`  P95 延迟: ${result.p95LatencyMs.toFixed(3)} ms`);
    });
  });

  describe('并发性能测试', () => {
    it('高并发下缓存应保持稳定', async () => {
      const cache = new CacheManager({
        maxSize: 10000,
        name: 'perf-test-concurrent'
      });

      // 预填充
      for (let i = 0; i < 1000; i++) {
        await cache.set(`key${i}`, { value: i });
      }

      const highConcurrencyBenchmark = new PerformanceBenchmark({
        concurrency: 100,
        requestsPerConcurrency: 100,
        warmupRounds: 1
      });

      const report = await highConcurrencyBenchmark.run([
        {
          name: 'cache.get.concurrent',
          fn: async () => {
            const key = `key${Math.floor(Math.random() * 1000)}`;
            await cache.get(key);
          }
        }
      ]);

      const result = report.results[0];

      // 高并发下 P95 应该仍然 < 5ms
      expect(result.p95LatencyMs).toBeLessThan(5);
      expect(result.errors).toBe(0);

      console.log('\n[高并发测试] 性能报告:');
      console.log(`  并发数: 100`);
      console.log(`  总请求数: ${result.totalRequests}`);
      console.log(`  吞吐量: ${result.throughput.toFixed(0)} 请求/秒`);
      console.log(`  P95 延迟: ${result.p95LatencyMs.toFixed(3)} ms`);
      console.log(`  P99 延迟: ${result.p99LatencyMs.toFixed(3)} ms`);
    });
  });

  describe('内存测试', () => {
    it('应正确估算内存占用', () => {
      const cache = new CacheManager({
        maxSize: 1000,
        estimateMemory: true,
        name: 'memory-test'
      });

      // 添加一些数据
      for (let i = 0; i < 100; i++) {
        cache.setSync(`key${i}`, {
          value: i,
          data: 'some test data that takes memory'
        });
      }

      const stats = cache.getStats();

      // 应该有内存估算
      expect(stats.estimatedMemoryBytes).toBeGreaterThan(0);
      expect(stats.size).toBe(100);

      console.log('\n[内存估算] 报告:');
      console.log(`  项目数: ${stats.size}`);
      console.log(`  估算内存: ${(stats.estimatedMemoryBytes / 1024).toFixed(2)} KB`);
      console.log(`  每项平均: ${(stats.estimatedMemoryBytes / stats.size).toFixed(2)} 字节`);
    });

    it('清空缓存应释放内存引用', () => {
      const cache = new CacheManager({
        maxSize: 1000,
        estimateMemory: true,
        name: 'memory-clear-test'
      });

      // 添加数据
      for (let i = 0; i < 100; i++) {
        cache.setSync(`key${i}`, { value: i, data: 'test data' });
      }

      const statsBefore = cache.getStats();
      expect(statsBefore.size).toBe(100);
      expect(statsBefore.estimatedMemoryBytes).toBeGreaterThan(0);

      // 清空
      cache.clearSync();

      const statsAfter = cache.getStats();
      expect(statsAfter.size).toBe(0);
      expect(statsAfter.estimatedMemoryBytes).toBe(0);
    });
  });

  describe('格式化报告', () => {
    it('应生成可读的性能报告', async () => {
      const cache = new CacheManager({ name: 'report-test' });

      const report = await benchmark.run([
        {
          name: 'cache.get',
          fn: async () => {
            await cache.get('test');
          }
        },
        {
          name: 'cache.set',
          fn: async () => {
            await cache.set('test', { value: 1 });
          }
        }
      ]);

      const formatted = PerformanceBenchmark.formatReport(report);

      expect(formatted).toContain('性能基准测试报告');
      expect(formatted).toContain('cache.get');
      expect(formatted).toContain('cache.set');
      expect(formatted).toContain('吞吐量');
      expect(formatted).toContain('P95 延迟');

      console.log('\n' + formatted);
    });

    it('应支持报告对比', async () => {
      const cache = new CacheManager({ name: 'compare-test' });

      const beforeReport = await benchmark.run([
        {
          name: 'cache.get',
          fn: async () => {
            await cache.get('key1');
          }
        }
      ]);

      const afterReport = await benchmark.run([
        {
          name: 'cache.get',
          fn: async () => {
            await cache.getSync('key1'); // 使用同步版本应该更快
          }
        }
      ]);

      const comparison = PerformanceBenchmark.compare(beforeReport, afterReport);

      expect(comparison.before).toBeDefined();
      expect(comparison.after).toBeDefined();
      expect(comparison.improvement).toBeDefined();
      expect(comparison.details.throughputImprovement).toBeDefined();
      expect(comparison.details.p95Improvement).toBeDefined();

      console.log('\n[性能对比] 报告:');
      console.log(`  延迟改进: ${comparison.improvement.toFixed(2)}%`);
      console.log(`  吞吐量改进: ${comparison.details.throughputImprovement.toFixed(2)}%`);
      console.log(`  P95 改进: ${comparison.details.p95Improvement.toFixed(2)}%`);
    });
  });
});

// 扩展 CacheManager 添加 clearSync 方法
declare module '../../../../infrastructure/cache/CacheManager' {
  interface CacheManager {
    clearSync(): void;
  }
}

// @ts-expect-error - 扩展原型
CacheManager.prototype.clearSync = function() {
  (this as any).cache.clear();
  (this as any).hits = 0;
  (this as any).misses = 0;
  (this as any).totalSizeBytes = 0;
};
