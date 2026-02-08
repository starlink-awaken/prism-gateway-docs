/**
 * ViolationDataReader 单元测试
 *
 * @description
 * 测试 ViolationDataReader 的功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ViolationDataReader } from '../../../core/analytics/readers/ViolationDataReader.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ViolationDataReader', () => {
  const testDataDir = join(tmpdir(), 'prism-violation-test');
  const reader = new ViolationDataReader({
    dataPath: testDataDir,
    fileName: 'test-violations.jsonl'
  });

  beforeEach(async () => {
    // 创建测试目录
    await mkdir(testDataDir, { recursive: true });

    // 创建测试数据
    const testViolations = [
      {
        id: 'v1',
        timestamp: '2026-02-01T10:00:00Z',
        principle_id: 'P1',
        principle_name: '测试原则1',
        severity: 'BLOCK',
        context: '测试上下文1',
        action: '测试处理1'
      },
      {
        id: 'v2',
        timestamp: '2026-02-03T10:00:00Z',
        principle_id: 'P2',
        principle_name: '测试原则2',
        severity: 'WARNING',
        context: '测试上下文2',
        action: '测试处理2'
      },
      {
        id: 'v3',
        timestamp: '2026-02-05T10:00:00Z',
        principle_id: 'P1',
        principle_name: '测试原则1',
        severity: 'BLOCK',
        context: '测试上下文3',
        action: '测试处理3'
      }
    ];

    const jsonlContent = testViolations.map(v => JSON.stringify(v)).join('\n');
    await writeFile(join(testDataDir, 'test-violations.jsonl'), jsonlContent, 'utf-8');
  });

  afterEach(async () => {
    // 清理测试目录
    await rm(testDataDir, { recursive: true, force: true });
  });

  describe('readAll', () => {
    it('应该读取所有违规记录', async () => {
      const violations = await reader.readAll();

      expect(violations).toHaveLength(3);
      expect(violations[0].id).toBe('v1');
      expect(violations[1].id).toBe('v2');
      expect(violations[2].id).toBe('v3');
    });

    it('应该处理文件不存在的情况', async () => {
      const emptyReader = new ViolationDataReader({
        dataPath: join(tmpdir(), 'nonexistent'),
        fileName: 'violations.jsonl'
      });

      const violations = await emptyReader.readAll();

      expect(violations).toEqual([]);
    });
  });

  describe('read', () => {
    it('应该按时间范围过滤', async () => {
      const start = new Date('2026-02-01T00:00:00Z');
      const end = new Date('2026-02-03T23:59:59Z');

      const violations = await reader.read(start, end);

      expect(violations).toHaveLength(2);
      expect(violations[0].id).toBe('v1');
      expect(violations[1].id).toBe('v2');
    });

    it('应该包含边界时间', async () => {
      const start = new Date('2026-02-03T10:00:00Z');
      const end = new Date('2026-02-03T10:00:00Z');

      const violations = await reader.read(start, end);

      expect(violations).toHaveLength(1);
      expect(violations[0].id).toBe('v2');
    });

    it('应该处理空范围', async () => {
      const start = new Date('2026-03-01T00:00:00Z');
      const end = new Date('2026-03-31T23:59:59Z');

      const violations = await reader.read(start, end);

      expect(violations).toHaveLength(0);
    });
  });

  describe('getMetadata', () => {
    it('应该返回正确的元数据', async () => {
      const metadata = await reader.getMetadata();

      expect(metadata.type).toBe('violation');
      expect(metadata.count).toBe(3);
      expect(metadata.oldestTimestamp).toBe('2026-02-01T10:00:00Z');
      expect(metadata.newestTimestamp).toBe('2026-02-05T10:00:00Z');
    });

    it('应该处理空数据的情况', async () => {
      const emptyReader = new ViolationDataReader({
        dataPath: join(tmpdir(), 'nonexistent'),
        fileName: 'violations.jsonl'
      });

      const metadata = await emptyReader.getMetadata();

      expect(metadata.type).toBe('violation');
      expect(metadata.count).toBe(0);
      expect(metadata.oldestTimestamp).toBeNull();
      expect(metadata.newestTimestamp).toBeNull();
    });
  });
});
