/**
 * TrendAggregator 单元测试
 *
 * @description
 * 测试趋势指标聚合功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { TrendAggregator } from '../../../core/analytics/aggregators/TrendAggregator.js';
import { TimePeriod } from '../../../core/analytics/models/TimePeriod.js';
import type { ViolationRecord } from '../../../types/index.js';
import { MemoryStore } from '../../../core/MemoryStore.js';

describe('TrendAggregator', () => {
  let aggregator: TrendAggregator;
  let mockMemoryStore: MemoryStore;

  beforeEach(() => {
    // 创建Mock MemoryStore
    mockMemoryStore = {
      listAllRetros: async () => [],
      getRetroRecord: async () => null,
      clearCache: () => {}
    } as unknown as MemoryStore;

    aggregator = new TrendAggregator(mockMemoryStore);
  });

  describe('aggregate', () => {
    it('应该正确聚合趋势指标（高违规数）', async () => {
      const violations: ViolationRecord[] = Array.from({ length: 150 }, (_, i) => ({
        id: `v${i}`,
        timestamp: '2026-02-01T10:00:00Z',
        principle_id: i % 3 === 0 ? 'p1' : i % 3 === 1 ? 'p2' : 'p3',
        principle_name: i % 3 === 0 ? '原则1' : i % 3 === 1 ? '原则2' : '原则3',
        severity: i % 3 === 0 ? 'BLOCK' : i % 3 === 1 ? 'WARNING' : 'ADVISORY',
        context: `上下文${i}`,
        action: `action${i}`
      }));

      const metrics = await aggregator.aggregate(violations, TimePeriod.week());

      // 高违规数 -> 趋势为 up
      expect(metrics.violationTrend).toBe('up');

      // 违规数150，改进率约 1 / (1 + 150/50) = 0.25
      expect(metrics.improvementRate).toBeCloseTo(0.25, 1);

      // 应该有Top 5违规
      expect(metrics.topViolations.length).toBe(3);
      expect(metrics.topViolations[0].principleId).toBeDefined();
      expect(metrics.topViolations[0].principleName).toBeDefined();
      expect(metrics.topViolations[0].count).toBeGreaterThan(0);

      // 百分比总和应该接近1.0
      const totalPercentage = metrics.topViolations.reduce((sum, v) => sum + v.percentage, 0);
      expect(totalPercentage).toBeCloseTo(1.0, 1);

      expect(metrics.period).toBe('week');
      expect(metrics.calculatedAt).toBeDefined();
    });

    it('应该正确聚合趋势指标（低违规数）', async () => {
      const violations: ViolationRecord[] = Array.from({ length: 10 }, (_, i) => ({
        id: `v${i}`,
        timestamp: '2026-02-01T10:00:00Z',
        principle_id: 'p1',
        principle_name: '原则1',
        severity: 'WARNING',
        context: `上下文${i}`,
        action: `action${i}`
      }));

      const metrics = await aggregator.aggregate(violations, TimePeriod.week());

      // 低违规数 -> 趋势为 down
      expect(metrics.violationTrend).toBe('down');

      // 违规数10，改进率约 1 / (1 + 10/50) = 0.833
      expect(metrics.improvementRate).toBeCloseTo(0.833, 1);
    });

    it('应该正确聚合趋势指标（中等违规数）', async () => {
      const violations: ViolationRecord[] = Array.from({ length: 50 }, (_, i) => ({
        id: `v${i}`,
        timestamp: '2026-02-01T10:00:00Z',
        principle_id: 'p1',
        principle_name: '原则1',
        severity: 'WARNING',
        context: `上下文${i}`,
        action: `action${i}`
      }));

      const metrics = await aggregator.aggregate(violations, TimePeriod.week());

      // 中等违规数 -> 趋势为 stable
      expect(metrics.violationTrend).toBe('stable');

      // 违规数50，改进率约 1 / (1 + 50/50) = 0.5
      expect(metrics.improvementRate).toBeCloseTo(0.5, 1);
    });

    it('应该正确计算Top违规', async () => {
      const violations: ViolationRecord[] = [
        // p1: 10次
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `v1-${i}`,
          timestamp: '2026-02-01T10:00:00Z',
          principle_id: 'p1',
          principle_name: '原则1',
          severity: 'BLOCK',
          context: '上下文',
          action: 'action'
        })),
        // p2: 5次
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `v2-${i}`,
          timestamp: '2026-02-01T10:00:00Z',
          principle_id: 'p2',
          principle_name: '原则2',
          severity: 'WARNING',
          context: '上下文',
          action: 'action'
        })),
        // p3: 3次
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `v3-${i}`,
          timestamp: '2026-02-01T10:00:00Z',
          principle_id: 'p3',
          principle_name: '原则3',
          severity: 'ADVISORY',
          context: '上下文',
          action: 'action'
        }))
      ];

      const metrics = await aggregator.aggregate(violations, TimePeriod.week());

      // Top 3违规
      expect(metrics.topViolations.length).toBe(3);

      // 第一个应该是p1（10次）
      expect(metrics.topViolations[0].principleId).toBe('p1');
      expect(metrics.topViolations[0].principleName).toBe('原则1');
      expect(metrics.topViolations[0].count).toBe(10);
      expect(metrics.topViolations[0].percentage).toBeCloseTo(0.556, 2); // 10/18

      // 第二个应该是p2（5次）
      expect(metrics.topViolations[1].principleId).toBe('p2');
      expect(metrics.topViolations[1].count).toBe(5);
      expect(metrics.topViolations[1].percentage).toBeCloseTo(0.278, 2); // 5/18

      // 第三个应该是p3（3次）
      expect(metrics.topViolations[2].principleId).toBe('p3');
      expect(metrics.topViolations[2].count).toBe(3);
      expect(metrics.topViolations[2].percentage).toBeCloseTo(0.167, 2); // 3/18
    });

    it('应该处理空数组', async () => {
      const metrics = await aggregator.aggregate([], TimePeriod.week());

      expect(metrics.violationTrend).toBe('stable'); // 默认stable
      expect(metrics.improvementRate).toBe(1.0); // 无违规，完全改进
      expect(metrics.topViolations.length).toBe(0);
    });

    it('应该使用ViolationRecord中的principle_name', async () => {
      const violations: ViolationRecord[] = [
        {
          id: 'v1',
          timestamp: '2026-02-01T10:00:00Z',
          principle_id: 'p1',
          principle_name: '不直接阻塞',
          severity: 'BLOCK',
          context: '上下文',
          action: 'action'
        },
        {
          id: 'v2',
          timestamp: '2026-02-01T11:00:00Z',
          principle_id: 'p2',
          principle_name: '先理解再行动',
          severity: 'WARNING',
          context: '上下文',
          action: 'action'
        }
      ];

      const metrics = await aggregator.aggregate(violations, TimePeriod.week());

      expect(metrics.topViolations[0].principleName).toBe('不直接阻塞');
      expect(metrics.topViolations[1].principleName).toBe('先理解再行动');
    });
  });

  describe('aggregateIncremental', () => {
    it('应该保留原有值并更新时间戳', async () => {
      const previous = {
        violationTrend: 'up' as const,
        improvementRate: 0.25,
        topViolations: [
          {
            principleId: 'p1',
            principleName: '原则1',
            count: 10,
            percentage: 0.5
          }
        ],
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
      expect(updated.violationTrend).toBe('up');
      expect(updated.improvementRate).toBe(0.25);
      expect(updated.topViolations.length).toBe(1);

      // 更新时间戳
      expect(updated.calculatedAt).toBeDefined();
      expect(new Date(updated.calculatedAt).getTime()).toBeGreaterThan(
        new Date(previous.calculatedAt).getTime()
      );
    });
  });
});
