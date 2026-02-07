/**
 * RetroDataReader 单元测试
 *
 * @description
 * 测试 RetroDataReader 类的功能
 *
 * @test_coverage
 * - read() 方法测试
 * - readAll() 方法测试
 * - getMetadata() 方法测试
 * - 错误处理测试
 * - 时间范围过滤测试
 * - 记录类型过滤测试
 *
 * @module tests/unit/analytics/readers/RetroDataReader.test
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { RetroDataReader } from '../../../core/analytics/readers/index.js';
import type { RetroRecord } from '../../../core/types/index.js';

// 模拟 MemoryStore
class MockMemoryStore {
  private retros: RetroRecord[] = [];
  private shouldFail: boolean = false;

  setRetros(retros: RetroRecord[]) {
    this.retros = retros;
  }

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }

  async listAllRetros(): Promise<RetroRecord[]> {
    if (this.shouldFail) {
      throw new Error('MemoryStore error');
    }
    return [...this.retros];
  }

  async getRetroRecord(id: string): Promise<RetroRecord | null> {
    if (this.shouldFail) {
      throw new Error('MemoryStore error');
    }
    return this.retros.find(r => r.id === id) || null;
  }
}

describe('RetroDataReader', () => {
  let mockStore: MockMemoryStore;
  let reader: RetroDataReader;
  const testRetros: RetroRecord[] = [
    {
      id: 'retro1',
      type: 'quick',
      timestamp: '2026-02-01T10:00:00Z',
      summary: 'First retro',
      successFactors: [],
      failureReasons: [],
      lessonsLearned: [],
      actionItems: []
    },
    {
      id: 'retro2',
      type: 'standard',
      timestamp: '2026-02-02T14:00:00Z',
      summary: 'Second retro',
      successFactors: [],
      failureReasons: [],
      lessonsLearned: [],
      actionItems: []
    },
    {
      id: 'retro3',
      type: 'quick',
      timestamp: '2026-02-03T16:00:00Z',
      summary: 'Third retro',
      successFactors: [],
      failureReasons: [],
      lessonsLearned: [],
      actionItems: []
    },
    {
      id: 'retro4',
      type: 'standard',
      timestamp: '2026-02-04T09:00:00Z',
      summary: 'Fourth retro',
      successFactors: [],
      failureReasons: [],
      lessonsLearned: [],
      actionItems: []
    },
    {
      id: 'retro5',
      type: 'quick',
      timestamp: '2026-02-05T11:00:00Z',
      summary: 'Fifth retro',
      successFactors: [],
      failureReasons: [],
      lessonsLearned: [],
      actionItems: []
    }
  ];

  beforeEach(() => {
    mockStore = new MockMemoryStore();
    mockStore.setRetros(testRetros);
    reader = new RetroDataReader({ memoryStore: mockStore as any });
  });

  describe('构造函数', () => {
    it('应该使用 MemoryStore 实例创建', () => {
      expect(reader).toBeInstanceOf(RetroDataReader);
    });

    it('当 MemoryStore 未提供时应该创建实例（但会失败在调用时）', () => {
      // RetroDataReader 构造函数不会抛出错误，
      // 但在调用方法时可能会因为 memoryStore 为 undefined 而失败
      // 这里测试的是构造函数的行为
      const readerWithoutStore = new RetroDataReader({ memoryStore: undefined as any });
      expect(readerWithoutStore).toBeInstanceOf(RetroDataReader);
    });

    it('当 MemoryStore 未提供时 readAll 应该返回空数组', async () => {
      // RetroDataReader 的 readAll 有 try-catch，即使 memoryStore 为 undefined 也不会抛出错误
      const readerWithoutStore = new RetroDataReader({ memoryStore: undefined as any });
      const result = await readerWithoutStore.readAll();
      expect(result).toEqual([]);
    });
  });

  describe('readAll()', () => {
    it('应该返回所有复盘记录', async () => {
      const retros = await reader.readAll();

      expect(retros).toHaveLength(5);
      expect(retros[0].id).toBe('retro1');
      expect(retros[4].id).toBe('retro5');
    });

    it('应该保持记录的原始顺序', async () => {
      const retros = await reader.readAll();

      expect(retros.map(r => r.id)).toEqual([
        'retro1', 'retro2', 'retro3', 'retro4', 'retro5'
      ]);
    });

    it('应该返回空数组当没有记录时', async () => {
      mockStore.setRetros([]);
      const retros = await reader.readAll();

      expect(retros).toEqual([]);
    });

    it('应该处理 MemoryStore 错误', async () => {
      mockStore.setShouldFail(true);
      const retros = await reader.readAll();

      // 应该返回空数组而不是抛出错误
      expect(retros).toEqual([]);
    });
  });

  describe('read() - 时间范围过滤', () => {
    it('应该返回时间范围内的所有记录', async () => {
      const start = new Date('2026-02-02T00:00:00Z');
      const end = new Date('2026-02-04T23:59:59Z');

      const retros = await reader.read(start, end);

      expect(retros).toHaveLength(3);
      expect(retros.map(r => r.id)).toEqual(['retro2', 'retro3', 'retro4']);
    });

    it('应该排除开始时间之前的记录', async () => {
      const start = new Date('2026-02-03T00:00:00Z');
      const end = new Date('2026-02-05T23:59:59Z');

      const retros = await reader.read(start, end);

      expect(retros).toHaveLength(3);
      expect(retros.map(r => r.id)).toEqual(['retro3', 'retro4', 'retro5']);
    });

    it('应该排除结束时间之后的记录', async () => {
      const start = new Date('2026-02-01T00:00:00Z');
      const end = new Date('2026-02-03T00:00:00Z');

      const retros = await reader.read(start, end);

      expect(retros).toHaveLength(2);
      expect(retros.map(r => r.id)).toEqual(['retro1', 'retro2']);
    });

    it('应该包含边界时间点的记录', async () => {
      const start = new Date('2026-02-02T14:00:00Z');
      const end = new Date('2026-02-04T09:00:00Z');

      const retros = await reader.read(start, end);

      // 应该包含边界上的记录
      expect(retros).toHaveLength(3);
      expect(retros.map(r => r.id)).toEqual(['retro2', 'retro3', 'retro4']);
    });

    it('当时间范围为空时应该返回空数组', async () => {
      const start = new Date('2026-03-01T00:00:00Z');
      const end = new Date('2026-03-31T23:59:59Z');

      const retros = await reader.read(start, end);

      expect(retros).toHaveLength(0);
    });

    it('应该正确处理单日范围', async () => {
      const start = new Date('2026-02-03T00:00:00Z');
      const end = new Date('2026-02-03T23:59:59Z');

      const retros = await reader.read(start, end);

      expect(retros).toHaveLength(1);
      expect(retros[0].id).toBe('retro3');
    });
  });

  describe('getMetadata()', () => {
    it('应该返回正确的数据类型', async () => {
      const metadata = await reader.getMetadata();

      expect(metadata).toHaveProperty('type', 'retrospective');
      expect(metadata).toHaveProperty('count');
      expect(metadata).toHaveProperty('oldestTimestamp');
      expect(metadata).toHaveProperty('newestTimestamp');
    });

    it('应该返回正确的记录数量', async () => {
      const metadata = await reader.getMetadata();

      expect(metadata.count).toBe(5);
    });

    it('当没有数据时应该返回空元数据', async () => {
      mockStore.setRetros([]);
      const metadata = await reader.getMetadata();

      expect(metadata).toEqual({
        type: 'retrospective',
        count: 0,
        oldestTimestamp: null,
        newestTimestamp: null
      });
    });

    it('应该正确计算最早和最新时间戳', async () => {
      const metadata = await reader.getMetadata();

      expect(metadata.oldestTimestamp).toBe('2026-02-01T10:00:00Z');
      expect(metadata.newestTimestamp).toBe('2026-02-05T11:00:00Z');
    });

    it('应该处理无序的时间戳数据', async () => {
      const unorderedRetros = [
        testRetros[4], // retro5
        testRetros[0], // retro1
        testRetros[2]  // retro3
      ];
      mockStore.setRetros(unorderedRetros);

      const metadata = await reader.getMetadata();

      expect(metadata.oldestTimestamp).toBe('2026-02-01T10:00:00Z'); // retro1
      expect(metadata.newestTimestamp).toBe('2026-02-05T11:00:00Z'); // retro5
    });
  });

  describe('记录类型过滤', () => {
    it('readAll() 应该返回所有类型的记录', async () => {
      const retros = await reader.readAll();

      const types = retros.map(r => r.type);
      expect(types).toContain('quick');
      expect(types).toContain('standard');
    });

    it('应该能够通过后续过滤获取特定类型', async () => {
      const allRetros = await reader.readAll();
      const quickRetros = allRetros.filter(r => r.type === 'quick');

      expect(quickRetros).toHaveLength(3);
      expect(quickRetros.every(r => r.type === 'quick')).toBe(true);
    });

    it('应该能够过滤 standard 类型记录', async () => {
      const allRetros = await reader.readAll();
      const standardRetros = allRetros.filter(r => r.type === 'standard');

      expect(standardRetros).toHaveLength(2);
      expect(standardRetros.every(r => r.type === 'standard')).toBe(true);
    });
  });

  describe('复杂时间范围场景', () => {
    it('应该正确处理跨越多月的范围', async () => {
      const multiMonthRetros: RetroRecord[] = [
        {
          id: 'jan1',
          type: 'quick',
          timestamp: '2026-01-31T23:59:59Z',
          summary: 'Jan record',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        },
        {
          id: 'feb1',
          type: 'quick',
          timestamp: '2026-02-01T00:00:00Z',
          summary: 'Feb record',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        },
        {
          id: 'feb28',
          type: 'quick',
          timestamp: '2026-02-28T23:59:59Z',
          summary: 'Feb end',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        },
        {
          id: 'mar1',
          type: 'quick',
          timestamp: '2026-03-01T00:00:00Z',
          summary: 'Mar record',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        }
      ];

      mockStore.setRetros(multiMonthRetros);

      // 查询二月的数据
      const start = new Date('2026-02-01T00:00:00Z');
      const end = new Date('2026-02-28T23:59:59Z');

      const retros = await reader.read(start, end);

      expect(retros).toHaveLength(2);
      expect(retros.map(r => r.id)).toEqual(['feb1', 'feb28']);
    });

    it('应该正确处理闰年日期', async () => {
      const leapYearRetros: RetroRecord[] = [
        {
          id: 'before',
          type: 'quick',
          timestamp: '2024-02-28T23:59:59Z',
          summary: 'Before leap day',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        },
        {
          id: 'leap',
          type: 'quick',
          timestamp: '2024-02-29T12:00:00Z',
          summary: 'Leap day',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        },
        {
          id: 'after',
          type: 'quick',
          timestamp: '2024-03-01T00:00:00Z',
          summary: 'After leap day',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        }
      ];

      mockStore.setRetros(leapYearRetros);

      const start = new Date('2024-02-29T00:00:00Z');
      const end = new Date('2024-02-29T23:59:59Z');

      const retros = await reader.read(start, end);

      expect(retros).toHaveLength(1);
      expect(retros[0].id).toBe('leap');
    });
  });

  describe('边界情况', () => {
    it('应该处理相同开始和结束时间', async () => {
      const sameTime = new Date('2026-02-03T16:00:00Z');

      const retros = await reader.read(sameTime, sameTime);

      expect(retros).toHaveLength(1);
      expect(retros[0].id).toBe('retro3');
    });

    it('应该处理开始时间晚于结束时间', async () => {
      const start = new Date('2026-02-05T00:00:00Z');
      const end = new Date('2026-02-01T00:00:00Z');

      const retros = await reader.read(start, end);

      // 应该返回空数组
      expect(retros).toHaveLength(0);
    });

    it('应该处理记录中缺少时间戳的情况', async () => {
      const retrosWithMissingTimestamp: RetroRecord[] = [
        {
          id: 'valid',
          type: 'quick',
          timestamp: '2026-02-01T10:00:00Z',
          summary: 'Valid timestamp',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        },
        {
          id: 'invalid',
          type: 'quick',
          timestamp: '',
          summary: 'Invalid timestamp',
          successFactors: [],
          failureReasons: [],
          lessonsLearned: [],
          actionItems: []
        }
      ];

      mockStore.setRetros(retrosWithMissingTimestamp);

      const start = new Date('2026-02-01T00:00:00Z');
      const end = new Date('2026-02-01T23:59:59Z');

      const retros = await reader.read(start, end);

      // 只有有效时间戳的记录应该被返回
      expect(retros).toHaveLength(1);
      expect(retros[0].id).toBe('valid');
    });
  });
});
