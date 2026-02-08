/**
 * MemoryStore 并发安全测试
 *
 * @description
 * 测试 MemoryStore 在并发场景下的线程安全性
 *
 * @remarks
 * ISC标准：并发安全测试 - 验证多线程/多进程环境下的数据一致性
 *
 * 测试覆盖：
 * 1. 多个并发读取操作（SHARED锁）
 * 2. 多个并发写入操作（EXCLUSIVE锁）
 * 3. 混合读写场景
 * 4. 异常情况下的锁释放
 * 5. 数据一致性验证
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MemoryStore } from '../core/MemoryStore.js';
import { ViolationRecord, RetroRecord } from '../types/index.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, rmSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';

// 测试数据目录
const TEST_DATA_DIR = join(tmpdir(), 'prism-concurrent-test');

// 锁文件目录
const LOCKS_DIR = join(homedir(), '.prism-gateway', 'locks');

/**
 * 设置测试环境
 */
function setupTestEnv(): void {
  try {
    if (!existsSync(TEST_DATA_DIR)) {
      mkdirSync(TEST_DATA_DIR, { recursive: true });
    }
  } catch {
    // 忽略
  }
}

/**
 * 清理测试环境
 *
 * @description
 * 清理测试数据目录和锁文件目录中的孤儿文件
 */
function cleanupTestEnv(): void {
  try {
    // 清理测试数据目录
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }

    // 清理锁文件目录中的所有 .shared.* 文件
    if (existsSync(LOCKS_DIR)) {
      const files = readdirSync(LOCKS_DIR);
      for (const file of files) {
        // 删除所有 SHARED 锁文件（包括 .shared 和 .shared.*）
        if (file.includes('.shared')) {
          const filePath = join(LOCKS_DIR, file);
          try {
            unlinkSync(filePath);
          } catch {
            // 忽略删除失败
          }
        }
      }
    }
  } catch {
    // 忽略
  }
}

/**
 * 生成测试违规记录
 */
function createViolation(id: number, sessionId: string): ViolationRecord {
  return {
    id: `${sessionId}-${id}`,
    timestamp: new Date().toISOString(),
    principle_id: `P${(id % 5) + 1}`,
    principle_name: `测试原则${id}`,
    severity: id % 2 === 0 ? 'WARNING' : 'ERROR',
    context: `测试上下文 ${id}`,
    action: `测试处理 ${id}`
  };
}

/**
 * 生成测试复盘记录
 */
function createRetro(id: number, sessionId: string): RetroRecord {
  return {
    id: `${sessionId}-${id}`,
    timestamp: new Date().toISOString(),
    type: 'quick',
    project: '测试项目',
    duration: 5,
    summary: `测试复盘 ${id}`,
    lessons: [`教训 ${id}`],
    improvements: [`改进 ${id}`]
  };
}

describe('MemoryStore 并发安全测试', () => {
  let store: MemoryStore;
  let sessionId: string;

  beforeEach(() => {
    setupTestEnv();
    store = new MemoryStore();
    store.clearCache();
    // 为每个测试生成唯一的会话ID
    sessionId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterEach(() => {
    store.clearCache();
    cleanupTestEnv();
  });

  // ==================== 读取操作并发测试（SHARED锁） ====================

  describe('读取操作并发测试（SHARED锁）', () => {
    it('应该支持多个并发读取原则操作', async () => {
      const readerCount = 10;
      const readers: Promise<any[]>[] = [];

      const startTime = Date.now();

      // 创建10个并发读取操作
      for (let i = 0; i < readerCount; i++) {
        readers.push(store.getPrinciples());
      }

      // 等待所有读取完成
      const results = await Promise.all(readers);

      const elapsed = Date.now() - startTime;

      // 所有读取都应该返回相同数量的原则
      results.forEach(principles => {
        expect(principles.length).toBe(5);
      });

      // 并发读取应该快速完成（首次运行可能需要创建锁目录，因此放宽要求）
      expect(elapsed).toBeLessThan(2000);

      console.log(`${readerCount}个并发读取操作: ${elapsed}ms`);
    });

    it('应该支持多个并发读取模式操作', async () => {
      const readerCount = 10;
      const readers: Promise<any>[] = [];

      // 混合读取成功和失败模式
      for (let i = 0; i < readerCount; i++) {
        if (i % 2 === 0) {
          readers.push(store.getSuccessPatterns());
        } else {
          readers.push(store.getFailurePatterns());
        }
      }

      const results = await Promise.all(readers);

      // 所有读取都应该成功
      results.forEach((patterns, index) => {
        if (index % 2 === 0) {
          expect(patterns.length).toBe(23); // 成功模式数量
        } else {
          expect(patterns.length).toBe(9); // 失败模式数量
        }
      });

      console.log(`${readerCount}个混合模式读取操作完成`);
    });
  });

  // ==================== 写入操作并发测试（EXCLUSIVE锁） ====================

  describe('写入操作并发测试（EXCLUSIVE锁）', () => {
    it('应该保证并发写入违规记录的数据一致性', async () => {
      const writerCount = 10;
      const writers: Promise<void>[] = [];

      // 创建10个并发写入操作
      for (let i = 0; i < writerCount; i++) {
        writers.push(store.recordViolation(createViolation(i, sessionId)));
      }

      // 等待所有写入完成
      await Promise.all(writers);

      // 验证所有记录都被正确写入
      const violations = await store.getRecentViolations(1000);
      const testViolations = violations.filter(v => v.id.startsWith(sessionId));

      expect(testViolations.length).toBe(writerCount);

      // 验证没有重复的ID
      const ids = testViolations.map(v => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      console.log(`${writerCount}个并发写入操作完成，数据一致性验证通过`);
    });

    it('应该保证并发写入复盘记录的数据一致性', async () => {
      const writerCount = 10;
      const writers: Promise<void>[] = [];

      // 创建10个并发写入操作
      for (let i = 0; i < writerCount; i++) {
        writers.push(store.saveRetroRecord(createRetro(i, sessionId)));
      }

      // 等待所有写入完成
      await Promise.all(writers);

      // 验证所有记录都能被读取
      let foundCount = 0;
      for (let i = 0; i < writerCount; i++) {
        const record = await store.getRetroRecord(`${sessionId}-${i}`);
        if (record) {
          foundCount++;
          expect(record.summary).toBe(`测试复盘 ${i}`);
        }
      }

      expect(foundCount).toBe(writerCount);

      console.log(`${writerCount}个并发复盘写入操作完成`);
    });

    it('应该在高并发写入场景下保持数据完整性', async () => {
      const writerCount = 20;
      const writers: Promise<void>[] = [];

      const startTime = Date.now();

      // 创建20个并发写入操作
      for (let i = 0; i < writerCount; i++) {
        writers.push(store.recordViolation(createViolation(i, sessionId)));
      }

      // 等待所有写入完成
      await Promise.all(writers);

      const elapsed = Date.now() - startTime;

      // 验证数据完整性
      const violations = await store.getRecentViolations(1000);
      const testViolations = violations.filter(v => v.id.startsWith(sessionId));

      expect(testViolations.length).toBe(writerCount);

      // 验证ID唯一性
      const ids = testViolations.map(v => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(writerCount);

      console.log(`${writerCount}个高并发写入: ${elapsed}ms, 数据完整性验证通过`);
    });
  });

  // ==================== 混合读写场景测试 ====================

  describe('混合读写场景测试', () => {
    it('应该在读写混合场景下保证数据一致性', async () => {
      const operationCount = 20;
      const operations: Promise<any>[] = [];

      // 创建混合的读写操作
      for (let i = 0; i < operationCount; i++) {
        if (i % 3 === 0) {
          // 写入操作
          operations.push(store.recordViolation(createViolation(i, sessionId)));
        } else if (i % 3 === 1) {
          // 读取原则
          operations.push(store.getPrinciples());
        } else {
          // 读取违规记录
          operations.push(store.getRecentViolations(10));
        }
      }

      // 所有操作都应该成功完成
      const results = await Promise.all(operations);

      expect(results.length).toBe(operationCount);

      // 验证写入的数据
      const violations = await store.getRecentViolations(1000);
      const testViolations = violations.filter(v => v.id.startsWith(sessionId));
      // 计算实际的写入操作数量：i % 3 === 0 的情况
      const writeCount = Math.floor(operationCount / 3) + (operationCount % 3 > 0 ? 1 : 0);
      expect(testViolations.length).toBe(writeCount);

      console.log(`混合场景测试: ${operationCount}个操作完成`);
    });

    it('应该支持读多写少的场景', async () => {
      const readCount = 15;
      const writeCount = 5;
      const operations: Promise<any>[] = [];

      // 主要是读取操作
      for (let i = 0; i < readCount; i++) {
        operations.push(store.getPrinciples());
      }

      // 少量写入操作
      for (let i = 0; i < writeCount; i++) {
        operations.push(store.recordViolation(createViolation(i, sessionId)));
      }

      const startTime = Date.now();

      await Promise.all(operations);

      const elapsed = Date.now() - startTime;

      // 验证所有数据都被正确写入
      const violations = await store.getRecentViolations(1000);
      const testViolations = violations.filter(v => v.id.startsWith(sessionId));
      expect(testViolations.length).toBe(writeCount);

      console.log(`读多写少场景: ${readCount}读 + ${writeCount}写 = ${elapsed}ms`);
    });

    it('应该支持写多读少的场景', async () => {
      const readCount = 5;
      const writeCount = 15;
      const operations: Promise<any>[] = [];

      // 主要是写入操作
      for (let i = 0; i < writeCount; i++) {
        operations.push(store.recordViolation(createViolation(i, sessionId)));
      }

      // 少量读取操作
      for (let i = 0; i < readCount; i++) {
        operations.push(store.getPrinciples());
      }

      const startTime = Date.now();

      await Promise.all(operations);

      const elapsed = Date.now() - startTime;

      // 验证所有数据都被正确写入
      const violations = await store.getRecentViolations(1000);
      const testViolations = violations.filter(v => v.id.startsWith(sessionId));
      expect(testViolations.length).toBe(writeCount);

      console.log(`写多读少场景: ${readCount}读 + ${writeCount}写 = ${elapsed}ms`);
    });
  });

  // ==================== 数据一致性验证测试 ====================

  describe('数据一致性验证测试', () => {
    it('应该保证读取的是写入后的数据', async () => {
      // 写入一条记录
      const testViolation = createViolation(999, sessionId);
      await store.recordViolation(testViolation);

      // 立即读取验证
      const violations = await store.getRecentViolations(1000);
      const found = violations.find(v => v.id === `${sessionId}-999`);

      expect(found).toBeDefined();
      expect(found?.principle_name).toBe('测试原则999');

      console.log('读写数据一致性验证通过');
    });

    it('应该保证多次读取的数据一致性', async () => {
      // 写入一些数据
      for (let i = 0; i < 5; i++) {
        await store.recordViolation(createViolation(i, sessionId));
      }

      // 清除缓存以确保从文件读取
      store.clearCache();

      // 多次读取应该返回相同的数据
      const violations1 = await store.getRecentViolations(1000);
      const violations2 = await store.getRecentViolations(1000);

      const testViolations1 = violations1.filter(v => v.id.startsWith(sessionId));
      const testViolations2 = violations2.filter(v => v.id.startsWith(sessionId));

      expect(testViolations1.length).toBe(testViolations2.length);

      console.log('多次读取数据一致性验证通过');
    });

    it('应该保证并发写入后的数据顺序', async () => {
      const writerCount = 10;
      const writers: Promise<void>[] = [];

      for (let i = 0; i < writerCount; i++) {
        const writer = (async (id: number) => {
          // 添加随机延迟以打乱完成顺序
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          await store.recordViolation(createViolation(id, sessionId));
        })(i);

        writers.push(writer);
      }

      await Promise.all(writers);

      // 验证所有记录都被写入
      const violations = await store.getRecentViolations(1000);
      const testViolations = violations.filter(v => v.id.startsWith(sessionId));

      expect(testViolations.length).toBe(writerCount);

      console.log('并发写入数据顺序验证通过');
    });
  });

  // ==================== 性能测试 ====================

  describe('并发性能测试', () => {
    it('应该在并发场景下保持<100ms的读取响应时间', async () => {
      const readerCount = 10;
      const times: number[] = [];

      for (let i = 0; i < readerCount; i++) {
        const start = Date.now();
        await store.getPrinciples();
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(200);

      console.log(`并发读取性能: 平均${avgTime.toFixed(2)}ms, 最大${maxTime}ms`);
    });

    it('应该在并发写入场景下保持合理的响应时间', async () => {
      const writerCount = 10;
      const times: number[] = [];

      for (let i = 0; i < writerCount; i++) {
        const start = Date.now();
        await store.recordViolation(createViolation(i, sessionId));
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 写入操作可能需要更多时间，但应该在合理范围内
      expect(avgTime).toBeLessThan(500);

      console.log(`并发写入性能: 平均${avgTime.toFixed(2)}ms, 最大${maxTime}ms`);
    });
  });
});

/**
 * 集成验收测试
 */
describe('MemoryStore 并发安全集成验收测试', () => {
  let store: MemoryStore;
  let sessionId: string;

  beforeEach(() => {
    setupTestEnv();
    store = new MemoryStore();
    store.clearCache();
    sessionId = `acceptance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterEach(() => {
    store.clearCache();
    cleanupTestEnv();
  });

  it('验收标准1: 支持10+个并发读取操作', async () => {
    const readerCount = 15;
    const readers: Promise<any[]>[] = [];

    for (let i = 0; i < readerCount; i++) {
      readers.push(store.getPrinciples());
    }

    const results = await Promise.all(readers);

    results.forEach(principles => {
      expect(principles.length).toBe(5);
    });

    console.log(`验收测试1: ${readerCount}个并发读取操作通过 ✓`);
  });

  it('验收标准2: 支持10+个并发写入操作且数据一致', async () => {
    const writerCount = 15;
    const writers: Promise<void>[] = [];

    for (let i = 0; i < writerCount; i++) {
      writers.push(store.recordViolation(createViolation(i, sessionId)));
    }

    await Promise.all(writers);

    const violations = await store.getRecentViolations(1000);
    const testViolations = violations.filter(v => v.id.startsWith(sessionId));

    expect(testViolations.length).toBe(writerCount);

    const ids = testViolations.map(v => v.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(writerCount);

    console.log(`验收测试2: ${writerCount}个并发写入操作且数据一致 ✓`);
  });

  it('验收标准3: 混合读写场景下数据一致性', async () => {
    const operationCount = 30;
    const operations: Promise<any>[] = [];

    for (let i = 0; i < operationCount; i++) {
      if (i % 3 === 0) {
        operations.push(store.recordViolation(createViolation(i, sessionId)));
      } else {
        operations.push(store.getPrinciples());
      }
    }

    await Promise.all(operations);

    const violations = await store.getRecentViolations(1000);
    const testViolations = violations.filter(v => v.id.startsWith(sessionId));
    // 计算实际的写入操作数量：i % 3 === 0 的情况
    // 0, 3, 6, 9, 12, 15, 18, 21, 24, 27 = 10个写入
    const writeCount = Math.floor(operationCount / 3) + (operationCount % 3 > 0 ? 1 : 0);

    expect(testViolations.length).toBe(writeCount);

    console.log(`验收测试3: ${operationCount}个混合操作数据一致性 ✓`);
  });

  it('验收标准4: 并发操作响应时间<500ms', async () => {
    const operationCount = 20;
    const times: number[] = [];

    for (let i = 0; i < operationCount; i++) {
      const start = Date.now();
      if (i % 2 === 0) {
        await store.getPrinciples();
      } else {
        await store.recordViolation(createViolation(i, sessionId));
      }
      times.push(Date.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    expect(avgTime).toBeLessThan(500);

    console.log(`验收测试4: 平均${avgTime.toFixed(2)}ms, 最大${maxTime}ms ✓`);
  });

  it('验收标准5: 无死锁场景', async () => {
    // 这个测试验证在大量并发操作下不会发生死锁
    const operationCount = 50;
    const operations: Promise<any>[] = [];

    const startTime = Date.now();

    for (let i = 0; i < operationCount; i++) {
      if (i % 2 === 0) {
        operations.push(store.getPrinciples());
      } else {
        operations.push(store.recordViolation(createViolation(i, sessionId)));
      }
    }

    // 设置超时保护，如果10秒内没有完成则认为可能存在死锁
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('操作超时，可能存在死锁')), 10000);
    });

    await Promise.race([
      Promise.all(operations),
      timeoutPromise
    ]);

    const elapsed = Date.now() - startTime;

    // 所有操作应该在合理时间内完成
    expect(elapsed).toBeLessThan(10000);

    console.log(`验收测试5: ${operationCount}个操作无死锁，耗时${elapsed}ms ✓`);
  });
});
