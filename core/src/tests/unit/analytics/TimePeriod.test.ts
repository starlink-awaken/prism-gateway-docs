/**
 * TimePeriod 单元测试
 *
 * @description
 * 测试 TimePeriod 类的功能
 */

import { describe, it, expect } from 'bun:test';
import { TimePeriod } from '../../../core/analytics/models/TimePeriod.js';

describe('TimePeriod', () => {
  describe('预设范围', () => {
    it('应该创建 today 范围', () => {
      const today = TimePeriod.today();
      const range = today.toDateRange();

      expect(range.start).toBeDefined();
      expect(range.end).toBeDefined();
      expect(range.start <= range.end).toBe(true);
    });

    it('应该创建 week 范围（7天）', () => {
      const week = TimePeriod.week();
      const range = week.toDateRange();

      const diff = range.end.getTime() - range.start.getTime();
      const days = diff / (1000 * 60 * 60 * 24);

      expect(days).toBeGreaterThan(6);
      expect(days).toBeLessThan(8);
    });

    it('应该创建 month 范围（30天）', () => {
      const month = TimePeriod.month();
      const range = month.toDateRange();

      const diff = range.end.getTime() - range.start.getTime();
      const days = diff / (1000 * 60 * 60 * 24);

      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(31);
    });
  });

  describe('自定义范围', () => {
    it('应该创建自定义时间范围', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      const custom = TimePeriod.custom(start, end);

      const range = custom.toDateRange();

      expect(range.start.getFullYear()).toBe(2026);
      expect(range.start.getMonth()).toBe(0);
      expect(range.start.getDate()).toBe(1);

      expect(range.end.getFullYear()).toBe(2026);
      expect(range.end.getMonth()).toBe(0);
      expect(range.end.getDate()).toBe(31);
    });
  });

  describe('字符串转换', () => {
    it('应该正确转换预设范围为字符串', () => {
      const today = TimePeriod.today();
      expect(today.toString()).toBe('today');

      const week = TimePeriod.week();
      expect(week.toString()).toBe('week');
    });

    it('应该正确转换自定义范围为字符串', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const end = new Date('2026-01-31T23:59:59Z');
      const custom = TimePeriod.custom(start, end);

      const str = custom.toString();
      expect(str).toContain('2026-01-01T00:00:00.000Z');
      expect(str).toContain('2026-01-31T23:59:59.000Z');
    });

    it('应该从字符串解析 TimePeriod', () => {
      const today = TimePeriod.fromString('today');
      const range = today.toDateRange();

      expect(range.start).toBeDefined();
      expect(range.end).toBeDefined();
    });
  });

  describe('类型检查', () => {
    it('应该正确识别预设范围', () => {
      const today = TimePeriod.today();
      expect(today.isPreset()).toBe(true);
      expect(today.isCustom()).toBe(false);
    });

    it('应该正确识别自定义范围', () => {
      const custom = TimePeriod.custom(new Date(), new Date());
      expect(custom.isCustom()).toBe(true);
      expect(custom.isPreset()).toBe(false);
    });
  });
});
