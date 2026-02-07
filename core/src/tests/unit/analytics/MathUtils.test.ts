/**
 * MathUtils 单元测试
 *
 * @description
 * 测试 MathUtils 类的统计计算功能
 */

import { describe, it, expect } from 'bun:test';
import { MathUtils } from '../../../core/analytics/utils/MathUtils.js';

describe('MathUtils', () => {
  describe('基础统计', () => {
    it('应该计算平均值', () => {
      expect(MathUtils.mean([1, 2, 3, 4, 5])).toBe(3);
      expect(MathUtils.mean([10, 20, 30])).toBe(20);
      expect(MathUtils.mean([])).toBe(0);
    });

    it('应该计算中位数', () => {
      expect(MathUtils.median([1, 2, 3, 4, 5])).toBe(3);
      expect(MathUtils.median([1, 2, 3, 4])).toBe(2.5);
      expect(MathUtils.median([])).toBe(0);
    });

    it('应该计算众数', () => {
      expect(MathUtils.mode([1, 2, 2, 3, 3, 3])).toEqual([3]);
      expect(MathUtils.mode([1, 1, 2, 2])).toEqual([1, 2]);
      expect(MathUtils.mode([])).toEqual([]);
    });
  });

  describe('方差和标准差', () => {
    it('应该计算方差', () => {
      expect(MathUtils.variance([1, 2, 3, 4, 5])).toBe(2);
      expect(MathUtils.variance([])).toBe(0);
    });

    it('应该计算标准差', () => {
      const result = MathUtils.standardDeviation([1, 2, 3, 4, 5]);
      expect(result).toBeCloseTo(1.414, 3);
      expect(MathUtils.standardDeviation([])).toBe(0);
    });
  });

  describe('极值和总和', () => {
    it('应该计算最小值', () => {
      expect(MathUtils.min([1, 2, 3, 4, 5])).toBe(1);
      expect(MathUtils.min([5, 4, 3, 2, 1])).toBe(1);
      expect(MathUtils.min([])).toBe(Infinity);
    });

    it('应该计算最大值', () => {
      expect(MathUtils.max([1, 2, 3, 4, 5])).toBe(5);
      expect(MathUtils.max([5, 4, 3, 2, 1])).toBe(5);
      expect(MathUtils.max([])).toBe(-Infinity);
    });

    it('应该计算总和', () => {
      expect(MathUtils.sum([1, 2, 3, 4, 5])).toBe(15);
      expect(MathUtils.sum([])).toBe(0);
    });
  });

  describe('百分位数', () => {
    it('应该计算百分位数', () => {
      expect(MathUtils.percentile([1, 2, 3, 4, 5], 50)).toBe(3); // 中位数
      expect(MathUtils.percentile([1, 2, 3, 4, 5], 0)).toBe(1); // 最小值
      expect(MathUtils.percentile([1, 2, 3, 4, 5], 100)).toBe(5); // 最大值
      expect(MathUtils.percentile([1, 2, 3, 4, 5], 95)).toBe(4.8); // P95
    });

    it('应该拒绝无效的百分位数', () => {
      expect(() => MathUtils.percentile([1, 2, 3], -1)).toThrow();
      expect(() => MathUtils.percentile([1, 2, 3], 101)).toThrow();
    });
  });

  describe('线性回归', () => {
    it('应该计算线性回归', () => {
      const points = [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 3 }
      ];

      const result = MathUtils.linearRegression(points);

      expect(result.slope).toBeCloseTo(1, 5);
      expect(result.intercept).toBeCloseTo(1, 5);
      expect(result.rSquared).toBeCloseTo(1, 5);
      expect(result.correlation).toBeCloseTo(1, 5);
    });

    it('应该拒绝少于2个点的数据', () => {
      expect(() => MathUtils.linearRegression([{ x: 0, y: 1 }])).toThrow();
    });
  });

  describe('工具函数', () => {
    it('应该四舍五入', () => {
      expect(MathUtils.round(3.14159, 2)).toBe(3.14);
      expect(MathUtils.round(3.14159, 4)).toBe(3.1416);
      expect(MathUtils.round(3.5, 0)).toBe(4);
    });

    it('应该计算变化率', () => {
      expect(MathUtils.rateOfChange(100, 150)).toBe(0.5); // 增长50%
      expect(MathUtils.rateOfChange(150, 100)).toBeCloseTo(-0.333, 3); // 下降33.3%
      expect(MathUtils.rateOfChange(100, 100)).toBe(0); // 无变化
      expect(MathUtils.rateOfChange(0, 100)).toBe(0); // 除零保护
    });

    it('应该计算移动平均', () => {
      expect(MathUtils.movingAverage([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4]);
      expect(MathUtils.movingAverage([1, 2, 3], 3)).toEqual([2]);
      expect(() => MathUtils.movingAverage([1, 2], 3)).toThrow();
    });

    it('应该计算 Z-score', () => {
      expect(MathUtils.zScore(15, 10, 2)).toBe(2.5);
      expect(MathUtils.zScore(10, 10, 2)).toBe(0);
      expect(MathUtils.zScore(10, 10, 0)).toBe(0); // 除零保护
    });
  });
});
