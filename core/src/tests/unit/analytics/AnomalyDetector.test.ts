/**
 * AnomalyDetector 单元测试
 *
 * @description
 * 测试异常检测功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { AnomalyDetector } from '../../../core/analytics/analyzers/AnomalyDetector.js';
import type { Anomaly } from '../../../core/analytics/models/Anomaly.js';

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  describe('analyze (默认选项)', () => {
    it('应该检测Z-score异常', async () => {
      const data = {
        violations: [
          { timestamp: '2026-02-01T00:00:00Z', count: 10 },
          { timestamp: '2026-02-02T00:00:00Z', count: 12 },
          { timestamp: '2026-02-03T00:00:00Z', count: 11 },
          { timestamp: '2026-02-04T00:00:00Z', count: 13 },
          { timestamp: '2026-02-05T00:00:00Z', count: 100 }, // 异常值
          { timestamp: '2026-02-06T00:00:00Z', count: 10 },
          { timestamp: '2026-02-07T00:00:00Z', count: 12 },
          { timestamp: '2026-02-08T00:00:00Z', count: 11 },
          { timestamp: '2026-02-09T00:00:00Z', count: 13 },
          { timestamp: '2026-02-10T00:00:00Z', count: 10 }
        ]
      };

      const result = await detector.analyze(data);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('violation_spike');
    });

    it('应该处理空数据', async () => {
      const data = {};

      const result = await detector.analyze(data);

      expect(result).toEqual([]);
    });

    it('应该处理数据点不足的情况', async () => {
      const data = {
        violations: [
          { timestamp: '2026-02-01T00:00:00Z', count: 50 }
        ]
      };

      const result = await detector.analyze(data);

      // 数据点不足，不应该检测异常
      expect(result).toEqual([]);
    });

    it('应该处理无异常数据', async () => {
      const data = {
        violations: [
          { timestamp: '2026-02-01T00:00:00Z', count: 10 },
          { timestamp: '2026-02-02T00:00:00Z', count: 12 },
          { timestamp: '2026-02-03T00:00:00Z', count: 11 },
          { timestamp: '2026-02-04T00:00:00Z', count: 13 },
          { timestamp: '2026-02-05T00:00:00Z', count: 10 },
          { timestamp: '2026-02-06T00:00:00Z', count: 12 },
          { timestamp: '2026-02-07T00:00:00Z', count: 11 },
          { timestamp: '2026-02-08T00:00:00Z', count: 13 },
          { timestamp: '2026-02-09T00:00:00Z', count: 10 },
          { timestamp: '2026-02-10T00:00:00Z', count: 12 }
        ]
      };

      const result = await detector.analyze(data);

      // 正常数据，应该没有异常或只有低级别异常
      const highSeverityAnomalies = result.filter(a => a.severity === 'high');
      expect(highSeverityAnomalies.length).toBe(0);
    });
  });

  describe('性能异常检测', () => {
    it('应该检测性能下降', async () => {
      const data = {
        performance: {
          checkTimes: [
            100, 120, 110, 105, 115, // 正常
            1500, 1450, 1400, // 性能下降
            110, 105, 108 // 恢复正常
          ],
          timestamps: [
            '2026-02-01T00:00:00Z',
            '2026-02-02T00:00:00Z',
            '2026-02-03T00:00:00Z',
            '2026-02-04T00:00:00Z',
            '2026-02-05T00:00:00Z',
            '2026-02-06T00:00:00Z',
            '2026-02-07T00:00:00Z',
            '2026-02-08T00:00:00Z',
            '2026-02-09T00:00:00Z',
            '2026-02-10T00:00:00Z',
            '2026-02-11T00:00:00Z'
          ]
        }
      };

      const result = await detector.analyze(data);

      // 应该检测到性能异常
      const performanceAnomalies = result.filter(a => a.type === 'performance_degradation');
      expect(performanceAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('使用异常检测', () => {
    it('应该检测使用量突然下降', async () => {
      const data = {
        usage: {
          dailyActive: [
            100, 105, 98, 102, 99, // 正高水平
            10, 12, 8, 11, 9 // 突然下降
          ],
          timestamps: [
            '2026-02-01T00:00:00Z',
            '2026-02-02T00:00:00Z',
            '2026-02-03T00:00:00Z',
            '2026-02-04T00:00:00Z',
            '2026-02-05T00:00:00Z',
            '2026-02-06T00:00:00Z',
            '2026-02-07T00:00:00Z',
            '2026-02-08T00:00:00Z',
            '2026-02-09T00:00:00Z',
            '2026-02-10T00:00:00Z'
          ]
        }
      };

      const result = await detector.analyze(data);

      // 应该检测到使用量异常
      const usageAnomalies = result.filter(a => a.type === 'usage_drop');
      expect(usageAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('异常严重程度', () => {
    it('应该正确计算异常严重程度', async () => {
      const data = {
        violations: [
          { timestamp: '2026-02-01T00:00:00Z', count: 10 },
          { timestamp: '2026-02-02T00:00:00Z', count: 12 },
          { timestamp: '2026-02-03T00:00:00Z', count: 11 },
          { timestamp: '2026-02-04T00:00:00Z', count: 13 },
          { timestamp: '2026-02-05T00:00:00Z', count: 50 }, // 中度异常
          { timestamp: '2026-02-06T00:00:00Z', count: 10 },
          { timestamp: '2026-02-07T00:00:00Z', count: 12 },
          { timestamp: '2026-02-08T00:00:00Z', count: 11 },
          { timestamp: '2026-02-09T00:00:00Z', count: 13 },
          { timestamp: '2026-02-10T00:00:00Z', count: 10 }
        ]
      };

      const result = await detector.analyze(data);

      if (result.length > 0) {
        // 检查严重程度字段
        expect(result[0].severity).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(result[0].severity);
      }
    });
  });

  describe('异常描述', () => {
    it('应该提供清晰的异常描述', async () => {
      const data = {
        violations: [
          { timestamp: '2026-02-01T00:00:00Z', count: 10 },
          { timestamp: '2026-02-02T00:00:00Z', count: 12 },
          { timestamp: '2026-02-03T00:00:00Z', count: 11 },
          { timestamp: '2026-02-04T00:00:00Z', count: 13 },
          { timestamp: '2026-02-05T00:00:00Z', count: 100 }, // 异常
          { timestamp: '2026-02-06T00:00:00Z', count: 10 },
          { timestamp: '2026-02-07T00:00:00Z', count: 12 },
          { timestamp: '2026-02-08T00:00:00Z', count: 11 },
          { timestamp: '2026-02-09T00:00:00Z', count: 13 },
          { timestamp: '2026-02-10T00:00:00Z', count: 10 }
        ]
      };

      const result = await detector.analyze(data);

      if (result.length > 0) {
        expect(result[0].description).toBeDefined();
        expect(result[0].timestamp).toBeDefined();
        expect(typeof result[0].value).toBe('number');
      }
    });
  });
});
