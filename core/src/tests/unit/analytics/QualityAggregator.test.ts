/**
 * QualityAggregator 单元测试
 *
 * @description
 * 测试质量指标聚合功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { QualityAggregator } from '../../../core/analytics/aggregators/QualityAggregator.js';
import { TimePeriod } from '../../../core/analytics/models/TimePeriod.js';
import type { ViolationRecord } from '../../../types/index.js';

describe('QualityAggregator', () => {
  let aggregator: QualityAggregator;

  beforeEach(() => {
    aggregator = new QualityAggregator();
  });

  describe('aggregate', () => {
    it('应该正确聚合质量指标（无明确标记）', async () => {
      const violations: ViolationRecord[] = [
        {
          id: 'v1',
          timestamp: '2026-02-01T10:00:00Z',
          principle_id: 'p1',
          principle_name: '原则1',
          severity: 'BLOCK',
          context: '上下文1',
          action: 'action1'
        },
        {
          id: 'v2',
          timestamp: '2026-02-01T11:00:00Z',
          principle_id: 'p1',
          principle_name: '原则1',
          severity: 'WARNING',
          context: '上下文2',
          action: 'action2'
        },
        {
          id: 'v3',
          timestamp: '2026-02-01T12:00:00Z',
          principle_id: 'p2',
          principle_name: '原则2',
          severity: 'ADVISORY',
          context: '上下文3',
          action: 'action3'
        },
        {
          id: 'v4',
          timestamp: '2026-02-01T13:00:00Z',
          principle_id: 'p2',
          principle_name: '原则2',
          severity: 'ADVISORY',
          context: '上下文4',
          action: 'action4'
        }
      ];

      const metrics = await aggregator.aggregate(violations, TimePeriod.week());

      // 违规率 = 4 / (4 * 10) = 0.1
      expect(metrics.violationRate).toBeCloseTo(0.1, 2);

      // 误报率：(BLOCK: 0.05 + WARNING: 0.1 + ADVISORY: 0.3*2) / 4 = 0.1875
      expect(metrics.falsePositiveRate).toBeCloseTo(0.1875, 2);

      // 模式匹配准确率：(BLOCK: 0.95 + WARNING: 0.85 + ADVISORY: 0.70*2) / 4 = 0.8
      expect(metrics.patternMatchAccuracy).toBeCloseTo(0.8, 1);

      expect(metrics.period).toBe('week');
      expect(metrics.calculatedAt).toBeDefined();
    });

    it('应该使用明确的误报标记', async () => {
      const violations: ViolationRecord[] = [
        {
          id: 'v1',
          timestamp: '2026-02-01T10:00:00Z',
          principle_id: 'p1',
          principle_name: '原则1',
          severity: 'BLOCK',
          context: '上下文1',
          action: 'action1',
          isFalsePositive: false
        },
        {
          id: 'v2',
          timestamp: '2026-02-01T11:00:00Z',
          principle_id: 'p1',
          principle_name: '原则1',
          severity: 'WARNING',
          context: '上下文2',
          action: 'action2',
          isFalsePositive: true
        },
        {
          id: 'v3',
          timestamp: '2026-02-01T12:00:00Z',
          principle_id: 'p2',
          principle_name: '原则2',
          severity: 'ADVISORY',
          context: '上下文3',
          action: 'action3',
          isFalsePositive: false
        }
      ];

      const metrics = await aggregator.aggregate(violations, TimePeriod.week());

      // 误报率 = 1 / 3 = 0.333
      expect(metrics.falsePositiveRate).toBeCloseTo(0.333, 2);
    });

    it('应该使用明确的模式匹配标记', async () => {
      const violations: ViolationRecord[] = [
        {
          id: 'v1',
          timestamp: '2026-02-01T10:00:00Z',
          principle_id: 'p1',
          principle_name: '原则1',
          severity: 'BLOCK',
          context: '上下文1',
          action: 'action1',
          patternMatched: true
        },
        {
          id: 'v2',
          timestamp: '2026-02-01T11:00:00Z',
          principle_id: 'p1',
          principle_name: '原则1',
          severity: 'WARNING',
          context: '上下文2',
          action: 'action2',
          patternMatched: true
        },
        {
          id: 'v3',
          timestamp: '2026-02-01T12:00:00Z',
          principle_id: 'p2',
          principle_name: '原则2',
          severity: 'ADVISORY',
          context: '上下文3',
          action: 'action3',
          patternMatched: false
        },
        {
          id: 'v4',
          timestamp: '2026-02-01T13:00:00Z',
          principle_id: 'p2',
          principle_name: '原则2',
          severity: 'ADVISORY',
          context: '上下文4',
          action: 'action4',
          patternMatched: true
        }
      ];

      const metrics = await aggregator.aggregate(violations, TimePeriod.week());

      // 模式匹配准确率 = 3 / 4 = 0.75
      expect(metrics.patternMatchAccuracy).toBeCloseTo(0.75, 2);
    });

    it('应该处理空数组', async () => {
      const metrics = await aggregator.aggregate([], TimePeriod.week());

      expect(metrics.violationRate).toBe(0);
      expect(metrics.falsePositiveRate).toBe(0);
      expect(metrics.patternMatchAccuracy).toBe(0);
    });
  });

  describe('aggregateIncremental', () => {
    it('应该保留原有值并更新时间戳', async () => {
      const previous = {
        violationRate: 0.15,
        falsePositiveRate: 0.05,
        patternMatchAccuracy: 0.85,
        period: 'week',
        calculatedAt: '2026-02-01T10:00:00Z'
      };

      const newData: ViolationRecord[] = [
        {
          id: 'v1',
          timestamp: '2026-02-02T10:00:00Z',
          principle_id: 'p1',
          principle_name: '原则1',
          severity: 'BLOCK',
          context: '上下文',
          action: 'action'
        }
      ];

      const updated = await aggregator.aggregateIncremental(previous, newData);

      // 增量更新保留原有值（TODO: 实现真正的增量计算）
      expect(updated.violationRate).toBe(0.15);
      expect(updated.falsePositiveRate).toBe(0.05);
      expect(updated.patternMatchAccuracy).toBe(0.85);

      // 更新时间戳
      expect(updated.calculatedAt).toBeDefined();
      expect(new Date(updated.calculatedAt).getTime()).toBeGreaterThan(
        new Date(previous.calculatedAt).getTime()
      );
    });
  });
});
