/**
 * TimeUtils 时间戳功能测试
 *
 * @description
 * 测试时间戳规范化和时区处理功能
 */

import { describe, it, expect } from 'bun:test';
import { TimeUtils } from '../../../core/analytics/utils/TimeUtils.js';

describe('TimeUtils > 时间戳功能', () => {
  describe('normalizeTimestamp', () => {
    it('应该将字符串时间戳规范化为 ISO 8601 格式', () => {
      const result = TimeUtils.normalizeTimestamp('2026-02-05');
      expect(result).toBe('2026-02-05T00:00:00.000Z');
    });

    it('应该将 Date 对象转换为 ISO 8601 格式', () => {
      const date = new Date('2026-02-05T10:30:00Z');
      const result = TimeUtils.normalizeTimestamp(date);
      expect(result).toBe('2026-02-05T10:30:00.000Z');
    });

    it('应该处理带时区的时间戳', () => {
      const result = TimeUtils.normalizeTimestamp('2026-02-05T10:30:00+08:00');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('parseTimestamp', () => {
    it('应该解析 ISO 8601 字符串为 Date 对象', () => {
      const result = TimeUtils.parseTimestamp('2026-02-05T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(new Date('2026-02-05T10:30:00Z').getTime());
    });

    it('应该处理日期字符串', () => {
      const result = TimeUtils.parseTimestamp('2026-02-05');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(1); // 2月
      expect(result.getDate()).toBe(5);
    });
  });

  describe('isValidTimestamp', () => {
    it('应该验证有效的时间戳', () => {
      expect(TimeUtils.isValidTimestamp('2026-02-05T10:30:00Z')).toBe(true);
      expect(TimeUtils.isValidTimestamp('2026-02-05')).toBe(true);
    });

    it('应该拒绝无效的时间戳', () => {
      expect(TimeUtils.isValidTimestamp('invalid')).toBe(false);
      expect(TimeUtils.isValidTimestamp('')).toBe(false);
      expect(TimeUtils.isValidTimestamp('2026-13-01')).toBe(false); // 无效月份
    });
  });

  describe('getTimestampBounds', () => {
    it('应该返回日期的开始和结束时间', () => {
      const result = TimeUtils.getTimestampBounds('2026-02-05');
      expect(result.start).toBe('2026-02-05T00:00:00.000Z');
      expect(result.end).toBe('2026-02-05T23:59:59.999Z');
    });

    it('应该处理 ISO 时间戳', () => {
      const result = TimeUtils.getTimestampBounds('2026-02-05T15:30:00Z');
      expect(result.start).toMatch(/2026-02-05T00:00:00/);
      expect(result.end).toMatch(/2026-02-05T23:59:59/);
    });
  });

  describe('toUTC', () => {
    it('应该将本地时间转换为 UTC', () => {
      const date = new Date('2026-02-05T10:30:00Z');
      const result = TimeUtils.toUTC(date);
      expect(result).toBeInstanceOf(Date);
    });

    it('应该处理带时区偏移的时间', () => {
      const result = TimeUtils.toUTC('2026-02-05T10:30:00+08:00');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('startOfDay 和 endOfDay', () => {
    it('startOfDay 应该返回一天的开始时间', () => {
      const result = TimeUtils.startOfDay('2026-02-05T15:30:00Z');
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('endOfDay 应该返回一天的结束时间', () => {
      const result = TimeUtils.endOfDay('2026-02-05T10:00:00Z');
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
    });
  });

  describe('startOfWeek 和 endOfWeek', () => {
    it('startOfWeek 应该返回周一的开始时间', () => {
      // 2026-02-05 是周四
      const result = TimeUtils.startOfWeek('2026-02-05');
      expect(result.getDay()).toBe(1); // 周一
      expect(result.getHours()).toBe(0);
    });

    it('endOfWeek 应该返回周日的结束时间', () => {
      const result = TimeUtils.endOfWeek('2026-02-05');
      expect(result.getDay()).toBe(0); // 周日
      expect(result.getHours()).toBe(23);
    });
  });

  describe('startOfMonth 和 endOfMonth', () => {
    it('startOfMonth 应该返回月份的第一天', () => {
      const result = TimeUtils.startOfMonth('2026-02-15');
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(0);
    });

    it('endOfMonth 应该返回月份的最后一天', () => {
      const result = TimeUtils.endOfMonth('2026-02-15');
      expect(result.getMonth()).toBe(1); // 2月
      expect(result.getDate()).toBe(28); // 2026年2月有28天
    });
  });

  describe('时区一致性', () => {
    it('边界函数应该在 UTC 时区下工作', () => {
      const date = new Date('2026-02-05T10:30:00Z');

      const start = TimeUtils.startOfDay(date);
      const end = TimeUtils.endOfDay(date);

      // 验证时间差是一整天
      const diff = end.getTime() - start.getTime();
      expect(diff).toBe(23 * 3600000 + 59 * 60000 + 59 * 1000 + 999);
    });
  });
});
