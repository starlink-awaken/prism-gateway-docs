/**
 * Analytics API 集成测试
 *
 * @description
 * 测试 Analytics REST API 端点
 *
 * @remarks
 * 注意：这些测试需要 AnalyticsService 初始化
 */

import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { AnalyticsService } from '../../core/analytics/AnalyticsService';
import { TimePeriod } from '../../core/analytics/models/TimePeriod';
import type { ViolationRecord, RetroRecord } from '../../types';

describe('Analytics API 集成测试', () => {
  let service: AnalyticsService;
  let mockMemoryStore: any;

  beforeAll(async () => {
    // 创建 Mock MemoryStore
    mockMemoryStore = {
      listAllRetros: async (): Promise<RetroRecord[]> => {
        return [
          {
            id: 'retro1',
            timestamp: '2026-02-01T10:00:00Z',
            type: 'quick',
            project: '测试项目',
            duration: 180000,
            summary: '测试复盘',
            lessons: ['教训1'],
            improvements: ['改进1']
          },
          {
            id: 'retro2',
            timestamp: '2026-02-03T10:00:00Z',
            type: 'quick',
            project: '测试项目',
            duration: 120000,
            summary: '测试复盘2',
            lessons: ['教训2'],
            improvements: ['改进2']
          }
        ];
      },
      getRetroRecord: async (id: string): Promise<RetroRecord | null> => {
        return mockMemoryStore.listAllRetros().then(retros =>
          retros.find(r => r.id === id) || null
        );
      },
      clearCache: () => {}
    };

    // 初始化服务
    service = new AnalyticsService({
      memoryStore: mockMemoryStore as any
    });
  });

  describe('UsageMetrics API', () => {
    it('应该返回使用指标', async () => {
      const metrics = await service.getUsageMetrics(TimePeriod.week());

      expect(metrics).toBeDefined();
      expect(metrics.totalRetrospectives).toBeGreaterThan(0);
      expect(metrics.period).toBe('week');
    });
  });

  describe('QualityMetrics API', () => {
    it('应该返回质量指标', async () => {
      const metrics = await service.getQualityMetrics(TimePeriod.week());

      expect(metrics).toBeDefined();
      expect(metrics.violationRate).toBeGreaterThanOrEqual(0);
      expect(metrics.period).toBe('week');
    });
  });

  describe('PerformanceMetrics API', () => {
    it('应该返回性能指标', async () => {
      const metrics = await service.getPerformanceMetrics(TimePeriod.week());

      expect(metrics).toBeDefined();
      expect(metrics.avgCheckTime).toBeGreaterThanOrEqual(0);
      expect(metrics.period).toBe('week');
    });
  });

  describe('TrendAnalysis API', () => {
    it('应该返回趋势分析', async () => {
      const analysis = await service.getTrendAnalysis('violations', TimePeriod.month());

      expect(analysis).toBeDefined();
      expect(analysis.direction).toMatch(/up|down|stable/);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('AnomalyDetection API', () => {
    it('应该返回异常列表', async () => {
      const anomalies = await service.detectAnomalies();

      expect(anomalies).toBeDefined();
      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('Dashboard API', () => {
    it('应该返回仪表板数据', async () => {
      const dashboard = await service.getDashboard(TimePeriod.week());

      expect(dashboard).toBeDefined();
      expect(dashboard.summary).toBeDefined();
      expect(dashboard.trends).toBeDefined();
      expect(dashboard.alerts).toBeDefined();
      expect(dashboard.period).toBe('week');
    });
  });

  describe('Cache Management API', () => {
    it('应该返回缓存统计', () => {
      const stats = service.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it('应该清除缓存', async () => {
      await service.clearCache();

      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
