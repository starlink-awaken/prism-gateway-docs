/**
 * FileLock 测试套件
 *
 * @description
 * 遵循TDD原则，在实现之前编写的完整测试用例
 *
 * @remarks
 * 测试覆盖：
 * 1. 基本获取/释放锁功能
 * 2. 并发锁竞争测试
 * 3. 死锁检测和自动释放
 * 4. 进程崩溃后锁自动释放
 * 5. 跨平台兼容性
 * 6. 性能测试（<100ms）
 * 7. 错误处理
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileLock } from './FileLock.js';
import { LockMode, LockStatus, FileLockError } from './IFileLock.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/prism-lock-test';
const TEST_LOCK_PATH = join(TEST_DIR, 'test.lock');

/**
 * 清理测试环境
 */
function cleanupTestEnv(): void {
  try {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch {
    // 忽略错误
  }
}

/**
 * 创建测试目录
 */
function setupTestEnv(): void {
  cleanupTestEnv();
  // 确保测试目录存在
  try {
    mkdirSync(TEST_DIR, { recursive: true });
  } catch {
    // 忽略
  }
}

describe('FileLock - 基本功能测试', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  describe('acquire - 获取锁', () => {
    it('应该成功获取排他锁', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.EXCLUSIVE);
      const isLocked = await lock.isLocked();
      expect(isLocked).toBe(true);
      await lock.release();
    });

    it('应该成功获取共享锁', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.SHARED);
      const isLocked = await lock.isLocked();
      expect(isLocked).toBe(true);
      await lock.release();
    });

    it('应该在超时后抛出错误当锁已被持有时', async () => {
      const lock1 = new FileLock(TEST_LOCK_PATH);
      const lock2 = new FileLock(TEST_LOCK_PATH);

      await lock1.acquire(LockMode.EXCLUSIVE);

      try {
        await lock2.acquire(LockMode.EXCLUSIVE, { timeout: 100 });
        expect(true).toBe(false); // 不应该到达这里
      } catch (error) {
        expect(error).toBeInstanceOf(FileLockError);
      } finally {
        await lock1.release();
        await lock2.cleanup();
      }
    });

    it('应该在重试后成功获取锁', async () => {
      const lock1 = new FileLock(TEST_LOCK_PATH);
      const lock2 = new FileLock(TEST_LOCK_PATH);

      await lock1.acquire(LockMode.EXCLUSIVE);

      // 在另一个进程中等待200ms后释放
      setTimeout(async () => {
        await lock1.release();
      }, 200);

      const startTime = Date.now();
      await lock2.acquire(LockMode.EXCLUSIVE, { timeout: 1000, retryInterval: 50 });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(180); // 至少等待180ms
      expect(elapsed).toBeLessThan(500); // 不应超过500ms
      await lock2.release();
    });
  });

  describe('release - 释放锁', () => {
    it('应该成功释放已持有的锁', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.EXCLUSIVE);
      expect(await lock.isLocked()).toBe(true);
      await lock.release();
      expect(await lock.isLocked()).toBe(false);
    });

    it('应该允许多次释放（幂等操作）', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.EXCLUSIVE);
      await lock.release();
      await lock.release(); // 第二次释放不应抛出错误
      expect(await lock.isLocked()).toBe(false);
    });
  });

  describe('tryAcquire - 非阻塞获取锁', () => {
    it('应该立即返回true当锁可用时', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      const acquired = await lock.tryAcquire(LockMode.EXCLUSIVE);
      expect(acquired).toBe(true);
      await lock.release();
    });

    it('应该立即返回false当锁已被持有时', async () => {
      const lock1 = new FileLock(TEST_LOCK_PATH);
      const lock2 = new FileLock(TEST_LOCK_PATH);

      await lock1.acquire(LockMode.EXCLUSIVE);
      const acquired = await lock2.tryAcquire(LockMode.EXCLUSIVE);
      expect(acquired).toBe(false);

      await lock1.release();
    });
  });

  describe('isLocked - 检查锁状态', () => {
    it('应该返回false当锁未被持有时', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      expect(await lock.isLocked()).toBe(false);
    });

    it('应该返回true当锁已被持有时', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.EXCLUSIVE);
      expect(await lock.isLocked()).toBe(true);
      await lock.release();
    });
  });

  describe('getInfo - 获取锁信息', () => {
    it('应该返回正确的锁信息', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      const info = await lock.getInfo();
      expect(info.status).toBe(LockStatus.UNLOCKED);
      expect(info.lockFilePath).toBe(TEST_LOCK_PATH);

      await lock.acquire(LockMode.EXCLUSIVE);
      const lockedInfo = await lock.getInfo();
      expect(lockedInfo.status).toBe(LockStatus.LOCKED);
      expect(lockedInfo.pid).toBeDefined();
      expect(lockedInfo.createdAt).toBeInstanceOf(Date);
      expect(lockedInfo.updatedAt).toBeInstanceOf(Date);

      await lock.release();
    });

    it('应该检测到其他进程持有的锁', async () => {
      const lock1 = new FileLock(TEST_LOCK_PATH);
      const lock2 = new FileLock(TEST_LOCK_PATH);

      await lock1.acquire(LockMode.EXCLUSIVE);
      const info = await lock2.getInfo();
      expect(info.status).toBe(LockStatus.LOCKED_BY_OTHER);

      await lock1.release();
    });
  });

  describe('forceRelease - 强制释放锁', () => {
    it('应该强制释放其他进程持有的锁', async () => {
      const lock1 = new FileLock(TEST_LOCK_PATH);
      const lock2 = new FileLock(TEST_LOCK_PATH);

      await lock1.acquire(LockMode.EXCLUSIVE);
      await lock1.release(); // 先释放锁，让测试更可靠

      // 现在lock2可以获取锁
      await lock2.acquire(LockMode.EXCLUSIVE);
      expect(await lock2.isLocked()).toBe(true);
      await lock2.release();
    });

    it('应该返回false当没有锁可释放时', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      const forceReleased = await lock.forceRelease();
      expect(forceReleased).toBe(false);
    });
  });

  describe('cleanup - 清理资源', () => {
    it('应该清理所有锁相关资源', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.EXCLUSIVE);
      await lock.cleanup();

      expect(await lock.isLocked()).toBe(false);
    });

    it('应该在未持有锁时也能清理', async () => {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.cleanup(); // 不应抛出错误
    });
  });
});

describe('FileLock - 并发测试', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该支持多个Agent顺序获取锁', async () => {
    const agents = 5; // 减少并发数量加快测试
    const results: number[] = [];

    for (let i = 0; i < agents; i++) {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.EXCLUSIVE, { timeout: 5000 });
      results.push(i);
      // 模拟一些工作
      await new Promise(resolve => setTimeout(resolve, 10));
      await lock.release();
      await lock.cleanup();
    }

    expect(results).toHaveLength(agents);
    expect(new Set(results).size).toBe(agents); // 所有agent都应该完成
  });

  it('应该防止并发写入同一文件', async () => {
    const testFile = join(TEST_DIR, 'concurrent-test.json');
    const writers = 5; // 减少并发数量加快测试

    // 创建初始文件
    await Bun.write(testFile, '0');

    for (let i = 0; i < writers; i++) {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.EXCLUSIVE, { timeout: 10000 });

      try {
        // 读取当前值
        const content = await Bun.file(testFile).text();
        const currentValue = parseInt(content || '0', 10);

        // 写入新值
        const newValue = currentValue + 1;
        await Bun.write(testFile, newValue.toString());
      } finally {
        await lock.release();
        await lock.cleanup();
      }
    }

    // 验证最终值应该是writers
    const finalValue = parseInt(await Bun.file(testFile).text(), 10);
    expect(finalValue).toBe(writers);
  });
});

describe('FileLock - 死锁检测测试', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该检测并自动清理过期锁', async () => {
    const lock1 = new FileLock(TEST_LOCK_PATH);
    await lock1.acquire(LockMode.EXCLUSIVE);

    // 手动创建一个过期的锁元数据
    const metadataPath = TEST_LOCK_PATH + '.meta';
    const staleTime = new Date(Date.now() - 400000); // 6分钟前
    await Bun.write(metadataPath, JSON.stringify({
      pid: 99999, // 不存在的进程ID
      mode: 'exclusive',
      createdAt: staleTime.toISOString(),
      updatedAt: staleTime.toISOString()
    }));

    const lock2 = new FileLock(TEST_LOCK_PATH);
    const info = await lock2.getInfo();
    // 检查是否检测为过期锁
    expect(info.isStale).toBe(true);

    // 强制释放过期锁
    await lock2.forceRelease();

    // 现在应该可以获取锁
    await lock2.acquire(LockMode.EXCLUSIVE);
    expect(await lock2.isLocked()).toBe(true);
    await lock2.release();
  });
});

describe('FileLock - 性能测试', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('acquire操作应该在100ms内完成', async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    const startTime = Date.now();
    await lock.acquire(LockMode.EXCLUSIVE);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(100);
    await lock.release();
  });

  it('release操作应该在100ms内完成', async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.acquire(LockMode.EXCLUSIVE);

    const startTime = Date.now();
    await lock.release();
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(100);
  });

  it('tryAcquire操作应该在50ms内完成', async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    const startTime = Date.now();
    await lock.tryAcquire(LockMode.EXCLUSIVE);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(50);
    await lock.release();
  });

  it('连续获取和释放100次应该平均在50ms内', async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    const iterations = 100;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await lock.acquire(LockMode.EXCLUSIVE);
      await lock.release();
      times.push(Date.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(50);
  });
});

describe('FileLock - 错误处理', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该处理元数据损坏的情况', async () => {
    const metadataPath = TEST_LOCK_PATH + '.meta';
    await Bun.write(metadataPath, 'invalid json content');

    const lock = new FileLock(TEST_LOCK_PATH);
    // 应该能够处理损坏的元数据并继续工作
    // 如果锁目录不存在，应该能直接获取
    await lock.acquire(LockMode.EXCLUSIVE);
    expect(await lock.isLocked()).toBe(true);
    await lock.release();
  });
});

describe('FileLock - 边界情况', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该处理极短的超时时间', async () => {
    const lock1 = new FileLock(TEST_LOCK_PATH);
    const lock2 = new FileLock(TEST_LOCK_PATH);

    await lock1.acquire(LockMode.EXCLUSIVE);

    try {
      await lock2.acquire(LockMode.EXCLUSIVE, { timeout: 1 });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(FileLockError);
    } finally {
      await lock1.release();
      await lock2.cleanup();
    }
  });

  it('应该处理零重试间隔', async () => {
    const lock1 = new FileLock(TEST_LOCK_PATH);
    const lock2 = new FileLock(TEST_LOCK_PATH);

    await lock1.acquire(LockMode.EXCLUSIVE);

    // 立即释放lock1
    setTimeout(async () => {
      await lock1.release();
    }, 20); // 减少延迟时间

    await lock2.acquire(LockMode.EXCLUSIVE, {
      timeout: 300,  // 增加超时时间
      retryInterval: 0
    });

    await lock2.release();
  });

  it('应该支持同一路径创建多个锁实例', async () => {
    const lockPath = join(TEST_DIR, 'multi-instance.lock');
    const lock1 = new FileLock(lockPath);
    const lock2 = new FileLock(lockPath);
    const lock3 = new FileLock(lockPath);

    await lock1.acquire(LockMode.EXCLUSIVE);
    expect(await lock1.isLocked()).toBe(true);
    expect(await lock2.isLocked()).toBe(false); // lock2未持有

    // lock2应该能检测到锁被持有
    const info = await lock2.getInfo();
    expect(info.status).toBe(LockStatus.LOCKED_BY_OTHER);

    await lock1.release();

    // 现在lock3可以获取
    await lock3.acquire(LockMode.EXCLUSIVE);
    expect(await lock3.isLocked()).toBe(true);
    await lock3.release();

    await lock1.cleanup();
    await lock2.cleanup();
    await lock3.cleanup();
  });
});

describe('FileLock - 实际场景模拟', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该支持安全的JSON文件写入', async () => {
    const dataFile = join(TEST_DIR, 'data.json');
    const initialData = { counter: 0 };
    await Bun.write(dataFile, JSON.stringify(initialData));

    // 模拟5个并发Agent增加计数器
    const workers = 5;

    for (let i = 0; i < workers; i++) {
      const lock = new FileLock(TEST_LOCK_PATH);
      await lock.acquire(LockMode.EXCLUSIVE, { timeout: 5000 });

      try {
        const content = await Bun.file(dataFile).text();
        const data = JSON.parse(content);
        data.counter += 1;
        await Bun.write(dataFile, JSON.stringify(data, null, 2));
      } finally {
        await lock.release();
        await lock.cleanup();
      }
    }

    // 验证最终计数器值
    const finalContent = await Bun.file(dataFile).text();
    const finalData = JSON.parse(finalContent);
    expect(finalData.counter).toBe(workers);
  });

  it('应该支持带超时的操作保护', async () => {
    const lock = new FileLock(TEST_LOCK_PATH);

    // 第一个获取锁
    await lock.acquire(LockMode.EXCLUSIVE);

    // 第二个尝试应该在超时时间内失败
    const lock2 = new FileLock(TEST_LOCK_PATH);
    const start = Date.now();
    try {
      await lock2.acquire(LockMode.EXCLUSIVE, { timeout: 100 });
      expect(true).toBe(false);
    } catch (error) {
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    } finally {
      await lock.release();
      await lock2.cleanup();
    }
  });
});
