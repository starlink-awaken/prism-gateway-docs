/**
 * UsageAggregator 单元测试
 *
 * @description
 * 测试使用指标聚合功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { UsageAggregator } from '../../../core/analytics/aggregators/UsageAggregator.js';
import { TimePeriod } from '../../../core/analytics/models/TimePeriod.js';
import type { RetroRecord } from '../../../types/index.js';

describe('UsageAggregator', () => {
  let aggregator: UsageAggregator;

  beforeEach(() => {
    aggregator = new UsageAggregator();
  });

  describe('aggregate', () => {
    it('应该正确聚合使用指标', async () => {
      const retros: RetroRecord[] = [
        {
          id: 'retro1',
          timestamp: '2026-02-01T10:00:00Z',
          type: 'quick',
          project: '测试项目',
          duration: 180000, // 3分钟
          summary: '测试复盘',
          lessons: ['教训1'],
          improvements: ['改进1'],
          userId: 'user1'
        },
        {
          id: 'retro2',
          timestamp: '2026-02-02T10:00:00Z',
          type: 'quick',
          project: '测试项目',
          duration: 120000, // 2分钟
          summary: '测试复盘2',
          lessons: ['教训2'],
          improvements: ['改进2'],
          userId: 'user2'
        },
        {
          id: 'retro3',
          timestamp: '2026-02-02T14:00:00Z',
          type: 'quick',
          project: '测试项目',
          duration: 240000, // 4分钟
          summary: '测试复盘3',
          lessons: ['教训3'],
          improvements: ['改进3'],
          userId: 'user1'
        }
      ];

      const period = TimePeriod.week();
      const metrics = await aggregator.aggregate(retros, period);

      expect(metrics.totalRetrospectives).toBe(3);
      expect(metrics.totalChecks).toBeGreaterThanOrEqual(0);
      expect(metrics.avgSessionDuration).toBe(180000); // (3 + 2 + 4) / 3 = 3分钟
      expect(metrics.dailyActiveUsers).toBeCloseTo(1.5, 1); // 第1天1个用户，第2天2个用户，平均1.5
      expect(metrics.period).toBe('week');
    });

    it('应该处理空数组', async () => {
      const metrics = await aggregator.aggregate([], TimePeriod.week());

      expect(metrics.totalRetrospectives).toBe(0);
      expect(metrics.totalChecks).toBe(0);
      expect(metrics.avgSessionDuration).toBe(0);
      expect(metrics.dailyActiveUsers).toBe(0);
    });

    it('应该正确计算日活用户', async () => {
      const retros: RetroRecord[] = [
        {
          id: 'retro1',
          timestamp: '2026-02-01T10:00:00Z',
          type: 'quick',
          project: '测试项目',
          duration: 180000,
          summary: '测试复盘',
          lessons: [],
          improvements: [],
          userId: 'user1'
        },
        {
          id: 'retro2',
          timestamp: '2026-02-01T14:00:00Z',
          type: 'quick',
          project: '测试项目',
          duration: 120000,
          summary: '测试复盘2',
          lessons: [],
          improvements: [],
          userId: 'user2'
        },
        {
          id: 'retro3',
          timestamp: '2026-02-02T10:00:00Z',
          type: 'quick',
          project: '测试项目',
          duration: 240000,
          summary: '测试复盘3',
          lessons: [],
          improvements: [],
          userId: 'user1'
        }
      ];

      const metrics = await aggregator.aggregate(retros, TimePeriod.week());

      // 第1天有2个用户，第2天有1个用户，平均 = 1.5
      expect(metrics.dailyActiveUsers).toBeCloseTo(1.5, 1);
    });
  });

  describe('aggregateIncremental', () => {
    it('应该正确增量更新', async () => {
      const previous = {
        totalChecks: 100,
        totalRetrospectives: 10,
        dailyActiveUsers: 2.5,
        avgSessionDuration: 180000,
        period: 'week',
        calculatedAt: '2026-02-01T10:00:00Z'
      };

      const newData: RetroRecord[] = [
        {
          id: 'retro1',
          timestamp: '2026-02-02T10:00:00Z',
          type: 'quick',
          project: '测试项目',
          duration: 120000,
          summary: '测试复盘',
          lessons: [],
          improvements: [],
          userId: 'user1'
        },
        {
          id: 'retro2',
          timestamp: '2026-02-02T14:00:00Z',
          type: 'quick',
          project: '测试项目',
          duration: 240000,
          summary: '测试复盘2',
          lessons: [],
          improvements: [],
          userId: 'user2'
        }
      ];

      const updated = await aggregator.aggregateIncremental(previous, newData);

      expect(updated.totalRetrospectives).toBe(12); // 10 + 2
      expect(updated.calculatedAt).toBeDefined();
      // calculatedAt 应该是新的时间戳
      expect(new Date(updated.calculatedAt).getTime()).toBeGreaterThan(
        new Date(previous.calculatedAt).getTime()
      );
    });
  });
});
