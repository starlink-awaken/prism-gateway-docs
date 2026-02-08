/**
 * TrendAnalyzer 单元测试
 *
 * @description
 * 测试趋势分析功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { TrendAnalyzer } from '../../../core/analytics/analyzers/TrendAnalyzer.js';
import type { TrendData, TrendAnalysis, AnalysisOptions } from '../../../core/analytics/models/Metrics.js';

describe('TrendAnalyzer', () => {
  let analyzer: TrendAnalyzer;

  beforeEach(() => {
    analyzer = new TrendAnalyzer();
  });

  describe('analyze', () => {
    it('应该检测上升趋势', async () => {
      const trendData: TrendData = {
        metric: 'violations',
        period: 'week',
        points: [
          { timestamp: '2026-02-01T00:00:00Z', value: 10 },
          { timestamp: '2026-02-02T00:00:00Z', value: 20 },
          { timestamp: '2026-02-03T00:00:00Z', value: 30 },
          { timestamp: '2026-02-04T00:00:00Z', value: 40 },
          { timestamp: '2026-02-05T00:00:00Z', value: 50 }
        ]
      };

      const result = await analyzer.analyze(trendData);

      expect(result.direction).toBe('up');
      expect(result.slope).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.smoothed).toBeDefined();
      expect(result.smoothed.length).toBe(trendData.points.length);
      expect(result.changePoints).toBeDefined();
      expect(Array.isArray(result.changePoints)).toBe(true);
    });

    it('应该检测下降趋势', async () => {
      const trendData: TrendData = {
        metric: 'violations',
        period: 'week',
        points: [
          { timestamp: '2026-02-01T00:00:00Z', value: 50 },
          { timestamp: '2026-02-02T00:00:00Z', value: 40 },
          { timestamp: '2026-02-03T00:00:00Z', value: 30 },
          { timestamp: '2026-02-04T00:00:00Z', value: 20 },
          { timestamp: '2026-02-05T00:00:00Z', value: 10 }
        ]
      };

      const result = await analyzer.analyze(trendData);

      expect(result.direction).toBe('down');
      expect(result.slope).toBeLessThan(0);
    });

    it('应该检测稳定趋势', async () => {
      const trendData: TrendData = {
        metric: 'violations',
        period: 'week',
        points: [
          { timestamp: '2026-02-01T00:00:00Z', value: 30 },
          { timestamp: '2026-02-02T00:00:00Z', value: 31 },
          { timestamp: '2026-02-03T00:00:00Z', value: 29 },
          { timestamp: '2026-02-04T00:00:00Z', value: 30 },
          { timestamp: '2026-02-05T00:00:00Z', value: 30 }
        ]
      };

      const result = await analyzer.analyze(trendData);

      expect(result.direction).toBe('stable');
      expect(Math.abs(result.slope)).toBeLessThan(1); // slope应该接近0
    });

    it('应该应用移动平均平滑', async () => {
      const trendData: TrendData = {
        metric: 'violations',
        period: 'week',
        points: [
          { timestamp: '2026-02-01T00:00:00Z', value: 10 },
          { timestamp: '2026-02-02T00:00:00Z', value: 50 },
          { timestamp: '2026-02-03T00:00:00Z', value: 10 },
          { timestamp: '2026-02-04T00:00:00Z', value: 50 },
          { timestamp: '2026-02-05T00:00:00Z', value: 10 }
        ]
      };

      const options: AnalysisOptions = {
        windowSize: 3
      };

      const result = await analyzer.analyze(trendData, options);

      // 平滑后的数据应该波动较小
      const originalVariance = calculateVariance(trendData.points.map(p => p.value));
      const smoothedVariance = calculateVariance(result.smoothed.map(p => p.value));

      expect(smoothedVariance).toBeLessThan(originalVariance);
    });

    it('应该检测变点', async () => {
      const trendData: TrendData = {
        metric: 'violations',
        period: 'week',
        points: [
          // 前5个点：低值
          { timestamp: '2026-02-01T00:00:00Z', value: 10 },
          { timestamp: '2026-02-02T00:00:00Z', value: 12 },
          { timestamp: '2026-02-03T00:00:00Z', value: 11 },
          { timestamp: '2026-02-04T00:00:00Z', value: 13 },
          { timestamp: '2026-02-05T00:00:00Z', value: 10 },
          // 后5个点：高值（明显跳跃）
          { timestamp: '2026-02-06T00:00:00Z', value: 50 },
          { timestamp: '2026-02-07T00:00:00Z', value: 52 },
          { timestamp: '2026-02-08T00:00:00Z', value: 51 },
          { timestamp: '2026-02-09T00:00:00Z', value: 53 },
          { timestamp: '2026-02-10T00:00:00Z', value: 50 }
        ]
      };

      const result = await analyzer.analyze(trendData);

      // 应该检测到至少一个变点
      expect(result.changePoints.length).toBeGreaterThan(0);

      // 变点应该在第5-6个点之间
      const changePoint = result.changePoints[0];
      expect(changePoint.index).toBeGreaterThanOrEqual(4);
      expect(changePoint.index).toBeLessThanOrEqual(6);
    });

    it('应该处理空数据', async () => {
      const trendData: TrendData = {
        metric: 'violations',
        period: 'week',
        points: []
      };

      const result = await analyzer.analyze(trendData);

      expect(result.direction).toBe('stable');
      expect(result.slope).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.smoothed).toEqual([]);
      expect(result.changePoints).toEqual([]);
    });

    it('应该处理单个数据点', async () => {
      const trendData: TrendData = {
        metric: 'violations',
        period: 'week',
        points: [
          { timestamp: '2026-02-01T00:00:00Z', value: 30 }
        ]
      };

      const result = await analyzer.analyze(trendData);

      expect(result.direction).toBe('stable');
      expect(result.smoothed.length).toBe(1);
      expect(result.smoothed[0].value).toBe(30);
    });

    it('应该计算高置信度（强线性关系）', async () => {
      const trendData: TrendData = {
        metric: 'violations',
        period: 'week',
        points: [
          { timestamp: '2026-02-01T00:00:00Z', value: 10 },
          { timestamp: '2026-02-02T00:00:00Z', value: 20 },
          { timestamp: '2026-02-03T00:00:00Z', value: 30 },
          { timestamp: '2026-02-04T00:00:00Z', value: 40 },
          { timestamp: '2026-02-05T00:00:00Z', value: 50 }
        ]
      };

      const result = await analyzer.analyze(trendData);

      // 完美的线性关系应该有较高的置信度
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.rSquared).toBeGreaterThan(0.8);
    });
  });
});

/**
 * 计算方差
 *
 * @param values - 数值数组
 * @returns 方差
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}
