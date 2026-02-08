/**
 * TimeUtils 单元测试
 *
 * @description
 * 测试 TimeUtils 类的所有方法
 *
 * @test_coverage
 * - 日期键转换 (toDateKey, toHourKey, toWeekKey, toMonthKey)
 * - 时间边界函数 (startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth)
 * - 时间计算 (daysDiff, hoursDiff, addDays, addHours)
 * - 时间戳处理 (normalizeTimestamp, parseTimestamp, isValidTimestamp)
 * - 时间范围检查 (isInRange, getTimestampBounds)
 * - 时区处理 (toUTC)
 * - 边界条件和特殊情况
 *
 * @module tests/unit/analytics/utils/TimeUtils.test
 */

import { describe, it, expect } from 'bun:test';
import { TimeUtils } from '../../../core/analytics/utils/index.js';

describe('TimeUtils', () => {
  describe('日期键转换', () => {
    describe('toDateKey()', () => {
      it('应该将 Date 对象转换为 YYYY-MM-DD 格式', () => {
        const date = new Date('2026-02-05T15:30:00Z');
        const key = TimeUtils.toDateKey(date);
        expect(key).toBe('2026-02-05');
      });

      it('应该将 ISO 字符串转换为 YYYY-MM-DD 格式', () => {
        const key = TimeUtils.toDateKey('2026-02-05T15:30:00Z');
        expect(key).toBe('2026-02-05');
      });

      it('应该正确处理单月日期（前导零）', () => {
        const date = new Date('2026-01-09T00:00:00Z');
        const key = TimeUtils.toDateKey(date);
        expect(key).toBe('2026-01-09');
      });

      it('应该正确处理双位数月份', () => {
        const date = new Date('2026-12-31T23:59:59Z');
        const key = TimeUtils.toDateKey(date);
        expect(key).toBe('2026-12-31');
      });
    });

    describe('toHourKey()', () => {
      it('应该将日期转换为 YYYY-MM-DD-HH 格式', () => {
        const key = TimeUtils.toHourKey('2026-02-05T15:30:00Z');
        expect(key).toBe('2026-02-05-15');
      });

      it('应该正确处理单小时（前导零）', () => {
        const key = TimeUtils.toHourKey('2026-02-05T03:30:00Z');
        expect(key).toBe('2026-02-05-03');
      });

      it('应该正确处理午夜（0点）', () => {
        const key = TimeUtils.toHourKey('2026-02-05T00:00:00Z');
        expect(key).toBe('2026-02-05-00');
      });
    });

    describe('toWeekKey()', () => {
      it('应该将日期转换为 YYYY-Www 格式', () => {
        const key = TimeUtils.toWeekKey('2026-02-05T10:00:00Z');
        expect(key).toBe('2026-W06');
      });

      it('应该正确处理第一周', () => {
        const key = TimeUtils.toWeekKey('2026-01-01T00:00:00Z');
        expect(key).toBe('2026-W01');
      });

      it('应该正确处理年末周', () => {
        const key = TimeUtils.toWeekKey('2026-12-31T23:59:59Z');
        expect(key).toMatch(/2026-W5[0-3]/);
      });
    });

    describe('toMonthKey()', () => {
      it('应该将日期转换为 YYYY-MM 格式', () => {
        const key = TimeUtils.toMonthKey('2026-02-05T10:00:00Z');
        expect(key).toBe('2026-02');
      });

      it('应该正确处理单月', () => {
        const key = TimeUtils.toMonthKey('2026-01-15T00:00:00Z');
        expect(key).toBe('2026-01');
      });
    });
  });

  describe('时间边界函数', () => {
    describe('startOfDay()', () => {
      it('应该返回当天 00:00:00.000', () => {
        const date = new Date('2026-02-05T15:30:45.123Z');
        const start = TimeUtils.startOfDay(date);
        expect(start.toISOString()).toBe('2026-02-05T00:00:00.000Z');
      });

      it('应该支持字符串输入', () => {
        const start = TimeUtils.startOfDay('2026-02-05T15:30:00Z');
        expect(start.toISOString()).toBe('2026-02-05T00:00:00.000Z');
      });

      it('应该正确处理跨时区的时间', () => {
        const date = new Date('2026-02-05T23:59:59Z');
        const start = TimeUtils.startOfDay(date);
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
        expect(start.getSeconds()).toBe(0);
        expect(start.getMilliseconds()).toBe(0);
      });
    });

    describe('endOfDay()', () => {
      it('应该返回当天 23:59:59.999', () => {
        const date = new Date('2026-02-05T10:00:00Z');
        const end = TimeUtils.endOfDay(date);
        expect(end.toISOString()).toBe('2026-02-05T23:59:59.999Z');
      });

      it('应该支持字符串输入', () => {
        const end = TimeUtils.endOfDay('2026-02-05T00:00:00Z');
        expect(end.toISOString()).toBe('2026-02-05T23:59:59.999Z');
      });
    });

    describe('startOfWeek()', () => {
      it('周五应该返回当周周一', () => {
        // 2026-02-07 是周五
        const date = new Date('2026-02-07T15:30:00Z');
        const start = TimeUtils.startOfWeek(date);
        // 2026-02-02 是周一
        expect(start.toISOString()).toBe('2026-02-02T00:00:00.000Z');
      });

      it('周一应该返回自己', () => {
        // 2026-02-02 是周一
        const date = new Date('2026-02-02T15:30:00Z');
        const start = TimeUtils.startOfWeek(date);
        expect(start.toISOString()).toBe('2026-02-02T00:00:00.000Z');
      });

      it('周日应该返回当周周一', () => {
        // 2026-02-08 是周日
        const date = new Date('2026-02-08T15:30:00Z');
        const start = TimeUtils.startOfWeek(date);
        expect(start.toISOString()).toBe('2026-02-02T00:00:00.000Z');
      });
    });

    describe('endOfWeek()', () => {
      it('周五应该返回当周周日', () => {
        const date = new Date('2026-02-07T15:30:00Z');
        const end = TimeUtils.endOfWeek(date);
        expect(end.toISOString()).toBe('2026-02-08T23:59:59.999Z');
      });

      it('周日应该返回自己（末尾时间）', () => {
        const date = new Date('2026-02-08T15:30:00Z');
        const end = TimeUtils.endOfWeek(date);
        expect(end.toISOString()).toBe('2026-02-08T23:59:59.999Z');
      });
    });

    describe('startOfMonth()', () => {
      it('月中应该返回月初 00:00:00.000', () => {
        const date = new Date('2026-02-15T14:30:00Z');
        const start = TimeUtils.startOfMonth(date);
        expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      });

      it('月初应该返回自己', () => {
        const date = new Date('2026-02-01T10:00:00Z');
        const start = TimeUtils.startOfMonth(date);
        expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      });
    });

    describe('endOfMonth()', () => {
      it('二月（非闰年）应该返回 2 月 28 日', () => {
        const date = new Date('2026-02-15T00:00:00Z');
        const end = TimeUtils.endOfMonth(date);
        expect(end.toISOString()).toBe('2026-02-28T23:59:59.999Z');
      });

      it('闰年二月应该返回 2 月 29 日', () => {
        const date = new Date('2024-02-15T00:00:00Z');
        const end = TimeUtils.endOfMonth(date);
        expect(end.toISOString()).toBe('2024-02-29T23:59:59.999Z');
      });

      it('一月应该返回 1 月 31 日', () => {
        const date = new Date('2026-01-15T00:00:00Z');
        const end = TimeUtils.endOfMonth(date);
        expect(end.toISOString()).toBe('2026-01-31T23:59:59.999Z');
      });

      it('十二月应该返回 12 月 31 日', () => {
        const date = new Date('2026-12-15T00:00:00Z');
        const end = TimeUtils.endOfMonth(date);
        expect(end.toISOString()).toBe('2026-12-31T23:59:59.999Z');
      });

      it('四月（30天）应该返回 4 月 30 日', () => {
        const date = new Date('2026-04-15T00:00:00Z');
        const end = TimeUtils.endOfMonth(date);
        expect(end.toISOString()).toBe('2026-04-30T23:59:59.999Z');
      });
    });
  });

  describe('时间计算', () => {
    describe('daysDiff()', () => {
      it('应该计算正确的天数差', () => {
        const diff = TimeUtils.daysDiff('2026-02-01', '2026-02-05');
        expect(diff).toBe(4);
      });

      it('应该返回绝对值', () => {
        const diff1 = TimeUtils.daysDiff('2026-02-01', '2026-02-05');
        const diff2 = TimeUtils.daysDiff('2026-02-05', '2026-02-01');
        expect(diff1).toBe(diff2);
      });

      it('同一天应该返回 0', () => {
        const diff = TimeUtils.daysDiff('2026-02-05', '2026-02-05');
        expect(diff).toBe(0);
      });
    });

    describe('hoursDiff()', () => {
      it('应该计算正确的小时差', () => {
        const diff = TimeUtils.hoursDiff(
          '2026-02-05T10:00:00Z',
          '2026-02-05T15:00:00Z'
        );
        expect(diff).toBe(5);
      });

      it('应该跨天计算小时差', () => {
        const diff = TimeUtils.hoursDiff(
          '2026-02-05T22:00:00Z',
          '2026-02-06T02:00:00Z'
        );
        expect(diff).toBe(4);
      });
    });

    describe('addDays()', () => {
      it('应该正确添加正数天', () => {
        const result = TimeUtils.addDays('2026-02-05', 7);
        expect(result.toISOString()).toBe('2026-02-12T00:00:00.000Z');
      });

      it('应该正确添加负数天（减去）', () => {
        const result = TimeUtils.addDays('2026-02-05', -7);
        expect(result.toISOString()).toBe('2026-01-29T00:00:00.000Z');
      });

      it('应该正确跨月', () => {
        const result = TimeUtils.addDays('2026-01-30', 5);
        expect(result.toISOString()).toBe('2026-02-04T00:00:00.000Z');
      });

      it('应该正确跨年', () => {
        const result = TimeUtils.addDays('2026-12-30', 5);
        expect(result.toISOString()).toBe('2027-01-04T00:00:00.000Z');
      });
    });

    describe('addHours()', () => {
      it('应该正确添加小时', () => {
        const result = TimeUtils.addHours('2026-02-05T10:00:00Z', 5);
        expect(result.toISOString()).toBe('2026-02-05T15:00:00.000Z');
      });

      it('应该正确跨天', () => {
        const result = TimeUtils.addHours('2026-02-05T22:00:00Z', 5);
        expect(result.toISOString()).toBe('2026-02-06T03:00:00.000Z');
      });
    });
  });

  describe('时间戳处理', () => {
    describe('normalizeTimestamp()', () => {
      it('应该将日期字符串转换为 ISO 格式', () => {
        const normalized = TimeUtils.normalizeTimestamp('2026-02-05');
        expect(normalized).toBe('2026-02-05T00:00:00.000Z');
      });

      it('应该将 Date 对象转换为 ISO 格式', () => {
        const date = new Date('2026-02-05T10:30:00Z');
        const normalized = TimeUtils.normalizeTimestamp(date);
        expect(normalized).toBe('2026-02-05T10:30:00.000Z');
      });
    });

    describe('parseTimestamp()', () => {
      it('应该将 ISO 字符串解析为 Date 对象', () => {
        const date = TimeUtils.parseTimestamp('2026-02-05T10:30:00Z');
        expect(date).toBeInstanceOf(Date);
        expect(date.toISOString()).toBe('2026-02-05T10:30:00.000Z');
      });
    });

    describe('isValidTimestamp()', () => {
      it('应该接受有效的 ISO 时间戳', () => {
        expect(TimeUtils.isValidTimestamp('2026-02-05T10:30:00Z')).toBe(true);
      });

      it('应该接受日期字符串', () => {
        expect(TimeUtils.isValidTimestamp('2026-02-05')).toBe(true);
      });

      it('应该拒绝无效的时间戳', () => {
        expect(TimeUtils.isValidTimestamp('invalid-date')).toBe(false);
      });

      it('应该拒绝空字符串', () => {
        expect(TimeUtils.isValidTimestamp('')).toBe(false);
      });
    });
  });

  describe('时间范围检查', () => {
    describe('isInRange()', () => {
      it('应该返回 true 当日期在范围内', () => {
        const inRange = TimeUtils.isInRange(
          '2026-02-05',
          '2026-02-01',
          '2026-02-10'
        );
        expect(inRange).toBe(true);
      });

      it('应该返回 true 当日期等于开始日期', () => {
        const inRange = TimeUtils.isInRange(
          '2026-02-01',
          '2026-02-01',
          '2026-02-10'
        );
        expect(inRange).toBe(true);
      });

      it('应该返回 true 当日期等于结束日期', () => {
        const inRange = TimeUtils.isInRange(
          '2026-02-10',
          '2026-02-01',
          '2026-02-10'
        );
        expect(inRange).toBe(true);
      });

      it('应该返回 false 当日期在范围之前', () => {
        const inRange = TimeUtils.isInRange(
          '2026-01-30',
          '2026-02-01',
          '2026-02-10'
        );
        expect(inRange).toBe(false);
      });

      it('应该返回 false 当日期在范围之后', () => {
        const inRange = TimeUtils.isInRange(
          '2026-02-15',
          '2026-02-01',
          '2026-02-10'
        );
        expect(inRange).toBe(false);
      });
    });

    describe('getTimestampBounds()', () => {
      it('应该返回时间戳的开始和结束时间', () => {
        const bounds = TimeUtils.getTimestampBounds('2026-02-05');
        expect(bounds).toEqual({
          start: '2026-02-05T00:00:00.000Z',
          end: '2026-02-05T23:59:59.999Z'
        });
      });

      it('应该处理完整的时间戳', () => {
        const bounds = TimeUtils.getTimestampBounds('2026-02-05T15:30:00Z');
        expect(bounds.start).toBe('2026-02-05T00:00:00.000Z');
        expect(bounds.end).toBe('2026-02-05T23:59:59.999Z');
      });
    });
  });

  describe('时区处理', () => {
    describe('toUTC()', () => {
      it('应该将本地时间转换为 UTC', () => {
        // 此测试的行为取决于运行环境的时区
        const date = new Date('2026-02-05T10:00:00Z');
        const utc = TimeUtils.toUTC(date);
        expect(utc).toBeInstanceOf(Date);
      });

      it('应该处理字符串输入', () => {
        const utc = TimeUtils.toUTC('2026-02-05T10:00:00+08:00');
        expect(utc).toBeInstanceOf(Date);
      });
    });
  });

  describe('周数计算', () => {
    describe('getWeekNumber()', () => {
      it('应该返回正确的 ISO 周数', () => {
        const week = TimeUtils.getWeekNumber(new Date('2026-02-05'));
        expect(week).toBe(6);
      });

      it('应该处理年初日期', () => {
        const week = TimeUtils.getWeekNumber(new Date('2026-01-01'));
        expect(week).toBe(1);
      });

      it('应该处理年末日期', () => {
        const week = TimeUtils.getWeekNumber(new Date('2026-12-31'));
        expect(week).toBeGreaterThanOrEqual(52);
        expect(week).toBeLessThanOrEqual(53);
      });
    });
  });

  describe('边界条件和特殊情况', () => {
    describe('闰年处理', () => {
      it('应该正确识别闰年（2024）', () => {
        const feb2024 = TimeUtils.endOfMonth('2024-02-15');
        expect(feb2024.getUTCDate()).toBe(29);
      });

      it('应该正确识别非闰年（2026）', () => {
        const feb2026 = TimeUtils.endOfMonth('2026-02-15');
        expect(feb2026.getUTCDate()).toBe(28);
      });

      it('应该正确处理闰年二月跨周', () => {
        const leapDay = new Date('2024-02-29T12:00:00Z');
        const week = TimeUtils.getWeekNumber(leapDay);
        expect(week).toBeGreaterThanOrEqual(1);
        expect(week).toBeLessThanOrEqual(53);
      });
    });

    describe('月末边界', () => {
      it('一月有 31 天', () => {
        const end = TimeUtils.endOfMonth('2026-01-15');
        expect(end.getUTCDate()).toBe(31);
      });

      it('三月有 31 天', () => {
        const end = TimeUtils.endOfMonth('2026-03-15');
        expect(end.getUTCDate()).toBe(31);
      });

      it('四月有 30 天', () => {
        const end = TimeUtils.endOfMonth('2026-04-15');
        expect(end.getUTCDate()).toBe(30);
      });

      it('五月有 31 天', () => {
        const end = TimeUtils.endOfMonth('2026-05-15');
        expect(end.getUTCDate()).toBe(31);
      });

      it('六月有 30 天', () => {
        const end = TimeUtils.endOfMonth('2026-06-15');
        expect(end.getUTCDate()).toBe(30);
      });

      it('七月有 31 天', () => {
        const end = TimeUtils.endOfMonth('2026-07-15');
        expect(end.getUTCDate()).toBe(31);
      });

      it('八月有 31 天', () => {
        const end = TimeUtils.endOfMonth('2026-08-15');
        expect(end.getUTCDate()).toBe(31);
      });

      it('九月有 30 天', () => {
        const end = TimeUtils.endOfMonth('2026-09-15');
        expect(end.getUTCDate()).toBe(30);
      });

      it('十月有 31 天', () => {
        const end = TimeUtils.endOfMonth('2026-10-15');
        expect(end.getUTCDate()).toBe(31);
      });

      it('十一月有 30 天', () => {
        const end = TimeUtils.endOfMonth('2026-11-15');
        expect(end.getUTCDate()).toBe(30);
      });

      it('十二月有 31 天', () => {
        const end = TimeUtils.endOfMonth('2026-12-15');
        expect(end.getUTCDate()).toBe(31);
      });
    });

    describe('跨年边界', () => {
      it('应该正确处理从 12 月到 1 月的日期添加', () => {
        const result = TimeUtils.addDays('2026-12-30', 5);
        expect(result.getUTCFullYear()).toBe(2027);
        expect(result.getUTCMonth()).toBe(0); // 一月
        expect(result.getUTCDate()).toBe(4);
      });

      it('应该正确处理周跨年', () => {
        // 2025-12-31 是周三
        const date = new Date('2025-12-31T12:00:00Z');
        const start = TimeUtils.startOfWeek(date);
        // 应该是那一周的周一（可能在 2025 年）
        expect(start.getDay()).toBe(1); // 周一
      });
    });

    describe('零值处理', () => {
      it('addDays(0) 应该返回相同日期', () => {
        const date = new Date('2026-02-05T10:00:00Z');
        const result = TimeUtils.addDays(date, 0);
        expect(result.toISOString()).toBe(date.toISOString());
      });

      it('addHours(0) 应该返回相同日期', () => {
        const date = new Date('2026-02-05T10:00:00Z');
        const result = TimeUtils.addHours(date, 0);
        expect(result.toISOString()).toBe(date.toISOString());
      });
    });

    describe('输入类型处理', () => {
      it('所有方法应该支持 Date 对象输入', () => {
        const date = new Date('2026-02-05T10:00:00Z');

        expect(TimeUtils.toDateKey(date)).toBe('2026-02-05');
        expect(TimeUtils.startOfDay(date)).toBeInstanceOf(Date);
        expect(TimeUtils.endOfDay(date)).toBeInstanceOf(Date);
        expect(TimeUtils.startOfWeek(date)).toBeInstanceOf(Date);
        expect(TimeUtils.endOfWeek(date)).toBeInstanceOf(Date);
        expect(TimeUtils.startOfMonth(date)).toBeInstanceOf(Date);
        expect(TimeUtils.endOfMonth(date)).toBeInstanceOf(Date);
      });

      it('所有方法应该支持字符串输入', () => {
        const dateStr = '2026-02-05T10:00:00Z';

        expect(TimeUtils.toDateKey(dateStr)).toBe('2026-02-05');
        expect(TimeUtils.startOfDay(dateStr)).toBeInstanceOf(Date);
        expect(TimeUtils.endOfDay(dateStr)).toBeInstanceOf(Date);
        expect(TimeUtils.startOfWeek(dateStr)).toBeInstanceOf(Date);
        expect(TimeUtils.endOfWeek(dateStr)).toBeInstanceOf(Date);
        expect(TimeUtils.startOfMonth(dateStr)).toBeInstanceOf(Date);
        expect(TimeUtils.endOfMonth(dateStr)).toBeInstanceOf(Date);
      });
    });
  });
});
