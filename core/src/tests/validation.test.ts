/**
 * P0-4: Zod 运行时类型验证测试
 *
 * 测试目标:
 * 1. 验证 RetroRecord ID 格式 (retro_YYYYMMDD_HHMMSS_uuid)
 * 2. 验证时间戳范围 (不允许未来时间)
 * 3. 验证字段长度限制
 * 4. 对象冻结防止原型污染
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  RetroRecordSchema,
  validateRetroRecord,
  ValidationResult,
  sanitizeRetroRecord,
  RetroRecordInput
} from '../types/validation.js';

describe('P0-4: Zod 运行时类型验证', () => {
  describe('RetroRecordSchema - ID 格式验证', () => {
    const validBase = {
      id: 'retro_20260101_120000_abc123def456',
      timestamp: '2026-01-01T12:00:00.000Z',
      type: 'quick' as const,
      project: 'test-project',
      duration: 5000,
      summary: 'Test summary',
      lessons: ['lesson1'],
      improvements: ['improvement1']
    };

    it('应该接受有效的 retro ID 格式', () => {
      const result = RetroRecordSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('应该拒绝没有 retro_ 前缀的 ID', () => {
      const invalid = { ...validBase, id: 'invalid_20260101_120000_abc123' };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('id');
      }
    });

    it('应该拒绝格式错误的 ID', () => {
      const invalidCases = [
        'retro_20260101_abc123',  // 缺少时间部分
        'retro_20260101_120000',  // 缺少 UUID
        'retro_2026-01-01_120000_abc123',  // 日期格式错误
        'retro_20260101_120000_!',  // 无效 UUID
      ];

      for (const invalidId of invalidCases) {
        const invalid = { ...validBase, id: invalidId };
        const result = RetroRecordSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      }
    });

    it('应该拒绝无效的日期部分 (月份 > 12)', () => {
      const invalid = { ...validBase, id: 'retro_20261301_120000_abc123def456' };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效的日期部分 (日期 > 31)', () => {
      const invalid = { ...validBase, id: 'retro_20260132_120000_abc123def456' };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效的时间部分 (小时 > 23)', () => {
      const invalid = { ...validBase, id: 'retro_20260101_240000_abc123def456' };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效的时间部分 (分钟 > 59)', () => {
      const invalid = { ...validBase, id: 'retro_20260101_126000_abc123def456' };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效的时间部分 (秒 > 59)', () => {
      const invalid = { ...validBase, id: 'retro_20260101_120060_abc123def456' };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('RetroRecordSchema - 时间戳范围验证', () => {
    const validBase = {
      id: 'retro_20260101_120000_abc123def456',
      timestamp: '2026-01-01T12:00:00.000Z',
      type: 'quick' as const,
      project: 'test-project',
      duration: 5000,
      summary: 'Test summary',
      lessons: ['lesson1'],
      improvements: ['improvement1']
    };

    it('应该接受有效的 ISO 8601 时间戳', () => {
      const result = RetroRecordSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('应该拒绝未来的时间戳', () => {
      // 获取当前 UTC 时间并加 1 天
      const future = new Date();
      future.setDate(future.getDate() + 1);
      const futureTimestamp = future.toISOString();

      const invalid = { ...validBase, timestamp: futureTimestamp };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效的时间戳格式', () => {
      const invalidCases = [
        '2026-01-01 12:00:00',  // 缺少 T 和 Z
        '2026-01-01',  // 只有日期
        'invalid-date',  // 完全无效
        '2026-13-01T12:00:00.000Z',  // 无效月份
      ];

      for (const invalidTimestamp of invalidCases) {
        const invalid = { ...validBase, timestamp: invalidTimestamp };
        const result = RetroRecordSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      }
    });

    it('应该接受过去的时间戳', () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      const pastTimestamp = past.toISOString();

      const valid = { ...validBase, timestamp: pastTimestamp };
      const result = RetroRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('应该接受当前时间戳', () => {
      const now = new Date().toISOString();
      const valid = { ...validBase, timestamp: now };
      const result = RetroRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('RetroRecordSchema - 字段长度验证', () => {
    const validBase = {
      id: 'retro_20260101_120000_abc123def456',
      timestamp: '2026-01-01T12:00:00.000Z',
      type: 'quick' as const,
      project: 'test-project',
      duration: 5000,
      summary: 'Test summary',
      lessons: ['lesson1'],
      improvements: ['improvement1']
    };

    it('应该限制 summary 字段最大长度为 2000 字符', () => {
      const longSummary = 'x'.repeat(2001);
      const invalid = { ...validBase, summary: longSummary };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该接受 2000 字符的 summary', () => {
      const validSummary = 'x'.repeat(2000);
      const valid = { ...validBase, summary: validSummary };
      const result = RetroRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('应该限制 project 字段最大长度为 100 字符', () => {
      const longProject = 'x'.repeat(101);
      const invalid = { ...validBase, project: longProject };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该限制每个 lesson 最大长度为 500 字符', () => {
      const longLesson = ['x'.repeat(501)];
      const invalid = { ...validBase, lessons: longLesson };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该限制每个 improvement 最大长度为 500 字符', () => {
      const longImprovement = ['x'.repeat(501)];
      const invalid = { ...validBase, improvements: longImprovement };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该限制数组最大长度为 50 项 (lessons)', () => {
      const manyLessons = Array.from({ length: 51 }, (_, i) => `lesson${i}`);
      const invalid = { ...validBase, lessons: manyLessons };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该限制数组最大长度为 50 项 (improvements)', () => {
      const manyImprovements = Array.from({ length: 51 }, (_, i) => `improvement${i}`);
      const invalid = { ...validBase, improvements: manyImprovements };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该拒绝空的 lessons 数组', () => {
      const invalid = { ...validBase, lessons: [] };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该拒绝空的 improvements 数组', () => {
      const invalid = { ...validBase, improvements: [] };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('RetroRecordSchema - type 枚举验证', () => {
    const validBase = {
      id: 'retro_20260101_120000_abc123def456',
      timestamp: '2026-01-01T12:00:00.000Z',
      type: 'quick' as const,
      project: 'test-project',
      duration: 5000,
      summary: 'Test summary',
      lessons: ['lesson1'],
      improvements: ['improvement1']
    };

    it('应该接受 type 为 quick', () => {
      const valid = { ...validBase, type: 'quick' as const };
      const result = RetroRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('应该接受 type 为 standard', () => {
      const valid = { ...validBase, type: 'standard' as const };
      const result = RetroRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('应该接受 type 为 deep', () => {
      const valid = { ...validBase, type: 'deep' as const };
      const result = RetroRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('应该拒绝无效的 type 值', () => {
      const invalid = { ...validBase, type: 'invalid' as const };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('RetroRecordSchema - duration 验证', () => {
    const validBase = {
      id: 'retro_20260101_120000_abc123def456',
      timestamp: '2026-01-01T12:00:00.000Z',
      type: 'quick' as const,
      project: 'test-project',
      duration: 5000,
      summary: 'Test summary',
      lessons: ['lesson1'],
      improvements: ['improvement1']
    };

    it('应该拒绝负数 duration', () => {
      const invalid = { ...validBase, duration: -1000 };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该拒绝超过合理上限的 duration (24小时)', () => {
      const invalid = { ...validBase, duration: 24 * 60 * 60 * 1000 + 1 };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该接受 0 duration', () => {
      const valid = { ...validBase, duration: 0 };
      const result = RetroRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('RetroRecordSchema - violations 可选字段验证', () => {
    const validBase = {
      id: 'retro_20260101_120000_abc123def456',
      timestamp: '2026-01-01T12:00:00.000Z',
      type: 'quick' as const,
      project: 'test-project',
      duration: 5000,
      summary: 'Test summary',
      lessons: ['lesson1'],
      improvements: ['improvement1']
    };

    it('应该接受没有 violations 字段的记录', () => {
      const result = RetroRecordSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('应该接受有效的 violations 数组', () => {
      const valid = {
        ...validBase,
        violations: ['P1', 'P2']
      };
      const result = RetroRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('应该限制 violations 数组最大长度为 20', () => {
      const manyViolations = Array.from({ length: 21 }, (_, i) => `P${i}`);
      const invalid = { ...validBase, violations: manyViolations };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('应该限制每个 violation 最大长度为 50 字符', () => {
      const longViolation = ['x'.repeat(51)];
      const invalid = { ...validBase, violations: longViolation };
      const result = RetroRecordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('validateRetroRecord 函数', () => {
    it('应该返回成功状态和解析后的数据', () => {
      const input: RetroRecordInput = {
        id: 'retro_20260101_120000_abc123def456',
        timestamp: '2026-01-01T12:00:00.000Z',
        type: 'quick',
        project: 'test-project',
        duration: 5000,
        summary: 'Test summary',
        lessons: ['lesson1'],
        improvements: ['improvement1']
      };

      const result = validateRetroRecord(input);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(input.id);
    });

    it('应该返回失败状态和错误信息', () => {
      const input: RetroRecordInput = {
        id: 'invalid-id',
        timestamp: '2026-01-01T12:00:00.000Z',
        type: 'quick',
        project: 'test-project',
        duration: 5000,
        summary: 'Test summary',
        lessons: ['lesson1'],
        improvements: ['improvement1']
      };

      const result = validateRetroRecord(input);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('应该处理未定义的输入', () => {
      const result = validateRetroRecord(undefined as any);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('应该处理 null 输入', () => {
      const result = validateRetroRecord(null as any);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('sanitizeRetroRecord 函数', () => {
    it('应该移除未知字段并返回清理后的对象', () => {
      const input = {
        id: 'retro_20260101_120000_abc123def456',
        timestamp: '2026-01-01T12:00:00.000Z',
        type: 'quick' as const,
        project: 'test-project',
        duration: 5000,
        summary: 'Test summary',
        lessons: ['lesson1'],
        improvements: ['improvement1'],
        unknownField: 'should be removed'
      };

      const result = sanitizeRetroRecord(input as any);
      expect(result).toBeDefined();
      expect((result as any).unknownField).toBeUndefined();
      expect(result.id).toBe(input.id);
    });

    it('应该冻结返回的对象防止修改', () => {
      const input = {
        id: 'retro_20260101_120000_abc123def456',
        timestamp: '2026-01-01T12:00:00.000Z',
        type: 'quick' as const,
        project: 'test-project',
        duration: 5000,
        summary: 'Test summary',
        lessons: ['lesson1'],
        improvements: ['improvement1']
      };

      const result = sanitizeRetroRecord(input);

      // 尝试修改应该失败（在严格模式下会抛出错误）
      expect(() => {
        'use strict';
        (result as any).id = 'modified-id';
      }).toThrow();
    });

    it('应该冻结数组防止修改', () => {
      const input = {
        id: 'retro_20260101_120000_abc123def456',
        timestamp: '2026-01-01T12:00:00.000Z',
        type: 'quick' as const,
        project: 'test-project',
        duration: 5000,
        summary: 'Test summary',
        lessons: ['lesson1'],
        improvements: ['improvement1']
      };

      const result = sanitizeRetroRecord(input);

      // 尝试修改数组应该失败
      expect(() => {
        'use strict';
        result.lessons.push('new-lesson');
      }).toThrow();
    });

    it('应该拒绝包含 prototype 字段的输入', () => {
      const maliciousInput = {
        id: 'retro_20260101_120000_abc123def456',
        timestamp: '2026-01-01T12:00:00.000Z',
        type: 'quick' as const,
        project: 'test-project',
        duration: 5000,
        summary: 'Test summary',
        lessons: ['lesson1'],
        improvements: ['improvement1'],
        prototype: { polluted: true }
      };

      expect(() => sanitizeRetroRecord(maliciousInput as any)).toThrow();
    });

    it('应该拒绝包含 toString 等危险字段的输入', () => {
      const maliciousInput = {
        id: 'retro_20260101_120000_abc123def456',
        timestamp: '2026-01-01T12:00:00.000Z',
        type: 'quick' as const,
        project: 'test-project',
        duration: 5000,
        summary: 'Test summary',
        lessons: ['lesson1'],
        improvements: ['improvement1'],
        toString: 'malicious'
      };

      expect(() => sanitizeRetroRecord(maliciousInput as any)).toThrow();
    });
  });

  describe('边界情况处理', () => {
    const validBase = {
      id: 'retro_20260101_120000_abc123def456',
      timestamp: '2026-01-01T12:00:00.000Z',
      type: 'quick' as const,
      project: 'test-project',
      duration: 5000,
      summary: 'Test summary',
      lessons: ['lesson1'],
      improvements: ['improvement1']
    };

    it('应该处理字符串数字', () => {
      const input = { ...validBase, duration: '5000' as any };
      const result = RetroRecordSchema.safeParse(input);
      // Zod 应该自动转换或拒绝
      expect(result.success).toBe(false);
    });

    it('应该拒绝缺少必填字段', () => {
      const { id, ...incomplete } = validBase;
      const result = RetroRecordSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('应该拒绝额外的未知字段 (strict 模式)', () => {
      const withExtra = {
        ...validBase,
        extraField: 'not allowed'
      };
      const result = RetroRecordSchema.safeParse(withExtra);
      expect(result.success).toBe(false);
    });
  });
});
