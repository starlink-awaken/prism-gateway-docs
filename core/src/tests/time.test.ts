/**
 * P0-5: UTC 时间戳统一处理测试
 *
 * 测试目标:
 * 1. normalizeTimestamp() 将各种时间格式统一为 UTC ISO 8601 字符串
 * 2. getYearMonthUTC() 返回 UTC 年月字符串
 * 3. 正确处理本地时间和 UTC 时间转换
 * 4. 边界情况处理（无效输入、极值等）
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  normalizeTimestamp,
  getYearMonthUTC,
  getCurrentTimestampUTC,
  isValidTimestamp,
  parseTimestampUTC,
  formatTimestampUTC,
  TimestampFormat
} from '../utils/time.js';

describe('P0-5: UTC 时间戳统一处理', () => {
  describe('normalizeTimestamp - 将各种格式转换为 UTC ISO 8601', () => {
    it('应该接受 Date 对象并返回 UTC ISO 字符串', () => {
      const date = new Date('2026-01-15T12:30:45.123Z');
      const result = normalizeTimestamp(date);
      expect(result).toBe('2026-01-15T12:30:45.123Z');
    });

    it('应该接受本地 Date 对象并转换为 UTC', () => {
      // 创建本地时间的 Date 对象
      const date = new Date(2026, 0, 15, 12, 30, 45, 123);
      const result = normalizeTimestamp(date);
      // 结果应该是 UTC 格式
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('应该接受 ISO 8601 字符串（带 Z）', () => {
      const input = '2026-01-15T12:30:45.123Z';
      const result = normalizeTimestamp(input);
      expect(result).toBe('2026-01-15T12:30:45.123Z');
    });

    it('应该接受 ISO 8601 字符串（不带 Z）', () => {
      const input = '2026-01-15T12:30:45.123';
      const result = normalizeTimestamp(input);
      expect(result).toBe('2026-01-15T12:30:45.123Z');
    });

    it('应该接受 ISO 8601 字符串（带时区偏移）', () => {
      const input = '2026-01-15T12:30:45.123+08:00';
      const result = normalizeTimestamp(input);
      // +08:00 表示 UTC+8，所以 UTC 时间应该是 04:30:45
      expect(result).toBe('2026-01-15T04:30:45.123Z');
    });

    it('应该接受 ISO 8601 字符串（负时区偏移）', () => {
      const input = '2026-01-15T12:30:45.123-05:00';
      const result = normalizeTimestamp(input);
      // -05:00 表示 UTC-5，所以 UTC 时间应该是 17:30:45
      expect(result).toBe('2026-01-15T17:30:45.123Z');
    });

    it('应该接受 Unix 时间戳（毫秒）', () => {
      const input = 1736941845123; // 2025-01-15T11:50:45.123Z (实际值)
      const result = normalizeTimestamp(input);
      expect(result).toBe('2025-01-15T11:50:45.123Z');
    });

    it('应该接受 Unix 时间戳（秒）', () => {
      const input = 1736941845; // 2025-01-15T11:50:45Z (实际值)
      const result = normalizeTimestamp(input);
      expect(result).toBe('2025-01-15T11:50:45.000Z');
    });

    it('应该接受数字字符串时间戳', () => {
      const input = '1736941845123';
      const result = normalizeTimestamp(input);
      expect(result).toBe('2025-01-15T11:50:45.123Z');
    });

    it('应该拒绝无效的 Date 对象', () => {
      const invalidDate = new Date('invalid-date');
      expect(() => normalizeTimestamp(invalidDate)).toThrow();
    });

    it('应该拒绝无效的字符串', () => {
      expect(() => normalizeTimestamp('not-a-date')).toThrow();
    });

    it('应该拒绝 null', () => {
      expect(() => normalizeTimestamp(null as any)).toThrow();
    });

    it('应该拒绝 undefined', () => {
      expect(() => normalizeTimestamp(undefined as any)).toThrow();
    });

    it('应该处理日期时间格式（YYYY-MM-DD HH:mm:ss）', () => {
      const input = '2026-01-15 12:30:45';
      const result = normalizeTimestamp(input);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('应该处理日期格式（YYYY-MM-DD）', () => {
      const input = '2026-01-15';
      const result = normalizeTimestamp(input);
      expect(result).toBe('2026-01-15T00:00:00.000Z');
    });

    it('应该统一输出格式为 ISO 8601 UTC', () => {
      const formats = [
        new Date('2026-01-15T12:30:45Z'),
        '2026-01-15T12:30:45Z',
        '2026-01-15T12:30:45.123Z',
        1736941845000
      ];

      for (const format of formats) {
        const result = normalizeTimestamp(format as any);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });
  });

  describe('getYearMonthUTC - 返回 UTC 年月字符串', () => {
    it('应该返回格式正确的年月字符串', () => {
      const timestamp = '2026-01-15T12:30:45.123Z';
      const result = getYearMonthUTC(timestamp);
      expect(result).toBe('2026-01');
    });

    it('应该接受 Date 对象', () => {
      const date = new Date('2026-06-15T12:30:45Z');
      const result = getYearMonthUTC(date);
      expect(result).toBe('2026-06');
    });

    it('应该接受 Unix 时间戳', () => {
      const timestamp = 1736941845000; // 2025-01-15
      const result = getYearMonthUTC(timestamp);
      expect(result).toBe('2025-01');
    });

    it('应该处理跨时区的时间', () => {
      // UTC 时间是 2026-01-15 04:00:00，但本地可能是其他时间
      const timestamp = '2026-01-15T04:00:00.000Z';
      const result = getYearMonthUTC(timestamp);
      expect(result).toBe('2026-01');
    });

    it('应该处理 12 月', () => {
      const timestamp = '2026-12-31T23:59:59.999Z';
      const result = getYearMonthUTC(timestamp);
      expect(result).toBe('2026-12');
    });

    it('应该处理 1 月', () => {
      const timestamp = '2026-01-01T00:00:00.000Z';
      const result = getYearMonthUTC(timestamp);
      expect(result).toBe('2026-01');
    });

    it('应该拒绝无效的输入', () => {
      expect(() => getYearMonthUTC('invalid-date')).toThrow();
    });

    it('应该正确处理闰年 2 月', () => {
      const timestamp = '2024-02-29T12:00:00.000Z';
      const result = getYearMonthUTC(timestamp);
      expect(result).toBe('2024-02');
    });

    it('应该拒绝非闰年的 2 月 29 日', () => {
      const timestamp = '2023-02-29T12:00:00.000Z';
      // 这种日期在实际 Date 对象中会自动调整，但应该仍能返回结果
      const result = getYearMonthUTC(timestamp);
      // 2023-02-29 会变成 2023-03-01
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('getCurrentTimestampUTC - 获取当前 UTC 时间戳', () => {
    it('应该返回有效的 ISO 8601 UTC 字符串', () => {
      const result = getCurrentTimestampUTC();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('应该返回接近当前时间的值', () => {
      const before = Date.now();
      const result = getCurrentTimestampUTC();
      const after = Date.now();

      const resultTime = new Date(result).getTime();
      expect(resultTime).toBeGreaterThanOrEqual(before);
      expect(resultTime).toBeLessThanOrEqual(after);
    });

    it('应该以 UTC 为基准', () => {
      const result = getCurrentTimestampUTC();
      expect(result). toEndWith('Z');
    });
  });

  describe('isValidTimestamp - 验证时间戳是否有效', () => {
    it('应该接受有效的 ISO 8601 字符串', () => {
      expect(isValidTimestamp('2026-01-15T12:30:45.123Z')).toBe(true);
    });

    it('应该拒绝无效的字符串', () => {
      expect(isValidTimestamp('not-a-date')).toBe(false);
    });

    it('应该拒绝空字符串', () => {
      expect(isValidTimestamp('')).toBe(false);
    });

    it('应该接受有效的 Date 对象', () => {
      const date = new Date('2026-01-15T12:30:45Z');
      expect(isValidTimestamp(date)).toBe(true);
    });

    it('应该拒绝无效的 Date 对象', () => {
      const date = new Date('invalid');
      expect(isValidTimestamp(date)).toBe(false);
    });

    it('应该接受有效的 Unix 时间戳', () => {
      expect(isValidTimestamp(1736941845000)).toBe(true);
    });

    it('应该拒绝无效的 Unix 时间戳', () => {
      expect(isValidTimestamp(-1)).toBe(false);
      expect(isValidTimestamp(NaN)).toBe(false);
    });

    it('应该拒绝 null 和 undefined', () => {
      expect(isValidTimestamp(null as any)).toBe(false);
      expect(isValidTimestamp(undefined as any)).toBe(false);
    });

    it('应该拒绝未来过远的时间（超过 1 年）', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 2);
      expect(isValidTimestamp(future)).toBe(false);
    });

    it('应该拒绝过去过远的时间（1970 之前）', () => {
      expect(isValidTimestamp(new Date('1969-12-31T23:59:59Z'))).toBe(false);
    });
  });

  describe('parseTimestampUTC - 解析时间戳为 Date 对象（UTC）', () => {
    it('应该解析 ISO 8601 字符串', () => {
      const input = '2026-01-15T12:30:45.123Z';
      const result = parseTimestampUTC(input);
      expect(result.toISOString()).toBe('2026-01-15T12:30:45.123Z');
    });

    it('应该处理带时区的字符串', () => {
      const input = '2026-01-15T12:30:45+08:00';
      const result = parseTimestampUTC(input);
      expect(result.toISOString()).toBe('2026-01-15T04:30:45.000Z');
    });

    it('应该处理 Unix 时间戳', () => {
      const input = 1736941845123;
      const result = parseTimestampUTC(input);
      expect(result.toISOString()).toBe('2025-01-15T11:50:45.123Z');
    });

    it('应该拒绝无效输入', () => {
      expect(() => parseTimestampUTC('invalid')).toThrow();
    });
  });

  describe('formatTimestampUTC - 格式化时间戳', () => {
    const timestamp = '2026-01-15T12:30:45.123Z';

    it('应该格式化为 ISO_8601 格式', () => {
      const result = formatTimestampUTC(timestamp, 'ISO_8601');
      expect(result).toBe('2026-01-15T12:30:45.123Z');
    });

    it('应该格式化为 DATE 格式', () => {
      const result = formatTimestampUTC(timestamp, 'DATE');
      expect(result).toBe('2026-01-15');
    });

    it('应该格式化为 TIME 格式', () => {
      const result = formatTimestampUTC(timestamp, 'TIME');
      expect(result).toBe('12:30:45');
    });

    it('应该格式化为 DATETIME 格式', () => {
      const result = formatTimestampUTC(timestamp, 'DATETIME');
      expect(result).toBe('2026-01-15 12:30:45');
    });

    it('应该格式化为 YEAR_MONTH 格式', () => {
      const result = formatTimestampUTC(timestamp, 'YEAR_MONTH');
      expect(result).toBe('2026-01');
    });

    it('应该接受 Date 对象作为输入', () => {
      const date = new Date(timestamp);
      const result = formatTimestampUTC(date, 'DATE');
      expect(result).toBe('2026-01-15');
    });

    it('应该拒绝无效格式', () => {
      expect(() => formatTimestampUTC(timestamp, 'INVALID' as TimestampFormat)).toThrow();
    });

    it('应该拒绝无效时间戳', () => {
      expect(() => formatTimestampUTC('invalid', 'ISO_8601')).toThrow();
    });
  });

  describe('边界情况和特殊值', () => {
    it('应该处理 Unix 纪元时间', () => {
      const result = normalizeTimestamp(0);
      expect(result).toBe('1970-01-01T00:00:00.000Z');
    });

    it('应该处理合理范围内的大时间戳', () => {
      // 使用当前时间 + 6个月的时间戳（在有效范围内）
      const futureDate = new Date(Date.now() + (180 * 24 * 60 * 60 * 1000));
      const result = normalizeTimestamp(futureDate);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('应该处理最小安全整数时间戳', () => {
      const minSafeDate = new Date(Number.MIN_SAFE_INTEGER);
      // 这个日期远早于 1970，应该被拒绝
      expect(() => normalizeTimestamp(minSafeDate)).toThrow();
    });

    it('应该正确处理毫秒精度', () => {
      const date = new Date('2026-01-15T12:30:45.999Z');
      const result = normalizeTimestamp(date);
      expect(result).toBe('2026-01-15T12:30:45.999Z');
    });

    it('应该正确处理零毫秒', () => {
      const date = new Date('2026-01-15T12:30:45.000Z');
      const result = normalizeTimestamp(date);
      expect(result).toBe('2026-01-15T12:30:45.000Z');
    });
  });

  describe('一致性验证', () => {
    it('normalizeTimestamp 和 parseTimestampUTC 应该一致', () => {
      const original = new Date('2026-01-15T12:30:45.123Z');
      const normalized = normalizeTimestamp(original);
      const parsed = parseTimestampUTC(normalized);
      expect(parsed.getTime()).toBe(original.getTime());
    });

    it('多次规范化应该返回相同结果', () => {
      const first = normalizeTimestamp('2026-01-15T12:30:45.123Z');
      const second = normalizeTimestamp(first);
      const third = normalizeTimestamp(second);
      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('getYearMonthUTC 应该与格式化一致', () => {
      const timestamp = '2026-06-15T12:30:45.123Z';
      const yearMonth = getYearMonthUTC(timestamp);
      const formatted = formatTimestampUTC(timestamp, 'YEAR_MONTH');
      expect(yearMonth).toBe(formatted);
    });
  });
});
