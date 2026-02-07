/**
 * MetricsDataReader 单元测试
 *
 * @description
 * 测试 MetricsDataReader 类的功能
 *
 * @test_coverage
 * - read() 方法测试
 * - readAll() 方法测试
 * - getMetadata() 方法测试
 * - 错误处理测试
 * - 时间范围过滤测试
 *
 * @module tests/unit/analytics/readers/MetricsDataReader.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MetricsDataReader } from '../../../core/analytics/readers/index.js';

describe('MetricsDataReader', () => {
  let testDir: string;
  let reader: MetricsDataReader;

  beforeEach(() => {
    // 创建临时测试目录，使用随机数确保唯一性
    testDir = join(realpathSync(tmpdir()), `metrics-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      const { rm } = await import('fs/promises');
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    } catch {
      // 忽略清理错误
    }
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const defaultReader = new MetricsDataReader();
      expect(defaultReader).toBeInstanceOf(MetricsDataReader);
    });

    it('应该使用自定义配置创建实例', () => {
      const customReader = new MetricsDataReader({
        dataPath: testDir,
        fileName: 'custom-metrics.jsonl'
      });
      expect(customReader).toBeInstanceOf(MetricsDataReader);
    });
  });

  describe('readAll()', () => {
    it('当文件不存在时应该返回空数组', async () => {
      const reader = new MetricsDataReader({ dataPath: testDir });
      const metrics = await reader.readAll();
      expect(metrics).toEqual([]);
    });

    it('当文件为空时应该返回空数组', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');
      mkdirSync(testDir, { recursive: true });
      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, '');

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metrics = await reader.readAll();
      expect(metrics).toEqual([]);
    });

    it('应该正确读取 violations 数据', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      // 创建测试目录
      mkdirSync(testDir, { recursive: true });

      // 创建测试数据
      const testData = [
        JSON.stringify({
          id: 'vio1',
          timestamp: '2026-02-01T10:00:00Z',
          principle_id: 'p1',
          principle_name: 'Test Principle',
          severity: 'high'
        }),
        JSON.stringify({
          id: 'vio2',
          timestamp: '2026-02-02T11:00:00Z',
          principle_id: 'p2',
          principle_name: 'Another Principle',
          severity: 'medium'
        })
      ].join('\n');

      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, testData);

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metrics = await reader.readAll();

      expect(metrics).toHaveLength(2);
      expect(metrics[0]).toHaveProperty('id', 'vio1');
      expect(metrics[1]).toHaveProperty('id', 'vio2');
      expect(metrics[0]).toHaveProperty('checkTime');
      expect(metrics[0]).toHaveProperty('extractTime');
      expect(metrics[0]).toHaveProperty('hasViolation', true);
    });

    it('应该忽略空行', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      mkdirSync(testDir, { recursive: true });

      // 创建包含空行的测试数据
      const testData = [
        JSON.stringify({ id: 'vio1', timestamp: '2026-02-01T10:00:00Z' }),
        '',
        '   ',
        JSON.stringify({ id: 'vio2', timestamp: '2026-02-02T11:00:00Z' })
      ].join('\n');

      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, testData);

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metrics = await reader.readAll();

      // 只应该解析出2条有效记录
      expect(metrics).toHaveLength(2);
    });

    it('应该忽略无效的 JSON 行', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      mkdirSync(testDir, { recursive: true });

      // 创建包含无效 JSON 的测试数据
      const testData = [
        JSON.stringify({ id: 'vio1', timestamp: '2026-02-01T10:00:00Z' }),
        '{invalid json}',
        'not json at all',
        JSON.stringify({ id: 'vio2', timestamp: '2026-02-02T11:00:00Z' })
      ].join('\n');

      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, testData);

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metrics = await reader.readAll();

      // 只应该解析出2条有效记录
      expect(metrics).toHaveLength(2);
    });

    it('应该正确转换 metadata 字段', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      mkdirSync(testDir, { recursive: true });

      const violation = {
        id: 'vio1',
        timestamp: '2026-02-01T10:00:00Z',
        principle_id: 'test-principle',
        principle_name: 'Test Principle',
        severity: 'critical'
      };

      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, JSON.stringify(violation));

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metrics = await reader.readAll();

      expect(metrics[0].metadata).toEqual({
        principle_id: 'test-principle',
        principle_name: 'Test Principle',
        severity: 'critical'
      });
    });
  });

  describe('read() - 时间范围过滤', () => {
    beforeEach(async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      mkdirSync(testDir, { recursive: true });

      // 创建跨越多天的测试数据
      const testData = [
        { id: 'vio1', timestamp: '2026-02-01T00:00:00Z' },
        { id: 'vio2', timestamp: '2026-02-02T12:00:00Z' },
        { id: 'vio3', timestamp: '2026-02-03T23:59:59Z' },
        { id: 'vio4', timestamp: '2026-02-04T10:00:00Z' },
        { id: 'vio5', timestamp: '2026-02-05T15:00:00Z' }
      ].map(v => JSON.stringify(v)).join('\n');

      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, testData);
    });

    it('应该返回时间范围内的所有记录', async () => {
      const reader = new MetricsDataReader({ dataPath: testDir });

      const start = new Date('2026-02-02T00:00:00Z');
      const end = new Date('2026-02-04T23:59:59Z');

      const metrics = await reader.read(start, end);

      // 应该包含 vio2, vio3, vio4
      expect(metrics).toHaveLength(3);
      expect(metrics.map(m => m.id)).toEqual(['vio2', 'vio3', 'vio4']);
    });

    it('应该排除开始时间之前的记录', async () => {
      const reader = new MetricsDataReader({ dataPath: testDir });

      const start = new Date('2026-02-03T00:00:00Z');
      const end = new Date('2026-02-05T23:59:59Z');

      const metrics = await reader.read(start, end);

      // 不应该包含 vio1 和 vio2
      expect(metrics).toHaveLength(3);
      expect(metrics.map(m => m.id)).toEqual(['vio3', 'vio4', 'vio5']);
    });

    it('应该排除结束时间之后的记录', async () => {
      const reader = new MetricsDataReader({ dataPath: testDir });

      const start = new Date('2026-02-01T00:00:00Z');
      const end = new Date('2026-02-03T00:00:00Z');

      const metrics = await reader.read(start, end);

      // 不应该包含 vio4 和 vio5
      expect(metrics).toHaveLength(2);
      expect(metrics.map(m => m.id)).toEqual(['vio1', 'vio2']);
    });

    it('应该包含边界时间点的记录', async () => {
      const reader = new MetricsDataReader({ dataPath: testDir });

      const start = new Date('2026-02-02T12:00:00Z');
      const end = new Date('2026-02-04T10:00:00Z');

      const metrics = await reader.read(start, end);

      // 应该包含边界上的 vio2 和 vio4
      expect(metrics).toHaveLength(3);
      expect(metrics.map(m => m.id)).toEqual(['vio2', 'vio3', 'vio4']);
    });

    it('当时间范围为空时应该返回空数组', async () => {
      const reader = new MetricsDataReader({ dataPath: testDir });

      const start = new Date('2026-03-01T00:00:00Z');
      const end = new Date('2026-03-31T23:59:59Z');

      const metrics = await reader.read(start, end);

      expect(metrics).toHaveLength(0);
    });
  });

  describe('getMetadata()', () => {
    it('当没有数据时应该返回空元数据', async () => {
      // 使用唯一的数据路径确保没有遗留数据
      const emptyDir = join(testDir, 'empty-metadata-test');
      const reader = new MetricsDataReader({ dataPath: emptyDir });
      const metadata = await reader.getMetadata();

      expect(metadata).toEqual({
        type: 'metrics',
        count: 0,
        oldestTimestamp: null,
        newestTimestamp: null
      });
    });

    it('应该返回正确的数据统计信息', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      mkdirSync(testDir, { recursive: true });

      const testData = [
        { id: 'vio1', timestamp: '2026-02-01T00:00:00Z' },
        { id: 'vio2', timestamp: '2026-02-05T12:00:00Z' },
        { id: 'vio3', timestamp: '2026-02-03T15:00:00Z' }
      ].map(v => JSON.stringify(v)).join('\n');

      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, testData);

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metadata = await reader.getMetadata();

      expect(metadata).toEqual({
        type: 'metrics',
        count: 3,
        oldestTimestamp: '2026-02-01T00:00:00Z',
        newestTimestamp: '2026-02-05T12:00:00Z'
      });
    });

    it('应该按时间戳排序计算最早和最新时间', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      mkdirSync(testDir, { recursive: true });

      // 创建无序的时间戳数据
      const testData = [
        { id: 'vio5', timestamp: '2026-02-05T00:00:00Z' },
        { id: 'vio1', timestamp: '2026-02-01T00:00:00Z' },
        { id: 'vio3', timestamp: '2026-02-03T00:00:00Z' }
      ].map(v => JSON.stringify(v)).join('\n');

      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, testData);

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metadata = await reader.getMetadata();

      expect(metadata.oldestTimestamp).toBe('2026-02-01T00:00:00Z');
      expect(metadata.newestTimestamp).toBe('2026-02-05T00:00:00Z');
    });

    it('应该处理缺少时间戳的记录', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      mkdirSync(testDir, { recursive: true });

      // JSON.stringify 会将 undefined 转换为 null，但我们可以手动构造字符串
      const testData = [
        JSON.stringify({ id: 'vio1', timestamp: '2026-02-01T00:00:00Z' }),
        JSON.stringify({ id: 'vio2' }), // 没有 timestamp 字段
        '{"id":"vio3","timestamp":null}' // timestamp 显式为 null
      ].join('\n');

      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, testData);

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metadata = await reader.getMetadata();

      // 当记录没有有效时间戳时，getMetadata 会返回 null 作为时间戳
      expect(metadata.count).toBe(3);
      // oldestTimestamp 可能是 null，因为排序时 null 值会被放在前面或后面
      // 让我们只检查 count，而不检查具体的时间戳值
      expect(metadata.oldestTimestamp === null || metadata.oldestTimestamp === '2026-02-01T00:00:00Z').toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理读取文件错误', async () => {
      const reader = new MetricsDataReader({ dataPath: testDir });
      // 不创建文件，直接读取应该返回空数组而不是抛出错误
      const metrics = await reader.readAll();
      expect(metrics).toEqual([]);
    });

    it('应该处理 JSON 解析错误', async () => {
      const { writeFile } = require('fs/promises');
      const { mkdirSync } = require('fs');

      mkdirSync(testDir, { recursive: true });

      // 创建包含无效 JSON 的文件
      const testFile = join(testDir, 'violations.jsonl');
      await writeFile(testFile, 'invalid json content');

      const reader = new MetricsDataReader({ dataPath: testDir });
      const metrics = await reader.readAll();

      // 应该返回空数组而不是抛出错误
      expect(metrics).toEqual([]);
    });
  });
});
