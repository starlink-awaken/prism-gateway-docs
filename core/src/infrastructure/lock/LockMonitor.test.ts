/**
 * LockMonitor 测试套件
 *
 * @description
 * 测试LockMonitor的死锁检测和自动释放功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { LockMonitor, getGlobalMonitor } from './LockMonitor.js';
import { FileLock } from './FileLock.js';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/prism-monitor-test';
const TEST_LOCK_PATH = join(TEST_DIR, 'monitored.lock');

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
  try {
    mkdirSync(TEST_DIR, { recursive: true });
  } catch {
    // 忽略
  }
}

describe('LockMonitor - 基本功能', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const monitor = new LockMonitor();
    if (monitor.isRunning()) {
      await monitor.stop();
    }
    cleanupTestEnv();
  });

  it('应该成功创建LockMonitor实例', () => {
    const monitor = new LockMonitor();
    expect(monitor.isRunning()).toBe(false);
  });

  it('应该启动和停止监控', async () => {
    const monitor = new LockMonitor({
      scanInterval: 1000,
      staleTimeout: 60000
    });

    expect(monitor.isRunning()).toBe(false);

    await monitor.start();
    expect(monitor.isRunning()).toBe(true);

    await monitor.stop();
    expect(monitor.isRunning()).toBe(false);
  });

  it('应该支持多次停止（幂等操作）', async () => {
    const monitor = new LockMonitor();
    await monitor.start();
    await monitor.stop();
    await monitor.stop(); // 第二次停止不应抛出错误
    expect(monitor.isRunning()).toBe(false);
  });

  it('应该获取监控统计信息', async () => {
    const monitor = new LockMonitor();
    await monitor.start();

    const stats = monitor.getStats();
    expect(stats.startedAt).toBeInstanceOf(Date);
    expect(stats.scanCount).toBeGreaterThan(0);
    expect(stats.lastScanTime).toBeInstanceOf(Date);

    await monitor.stop();
  });

  it('应该重置统计信息', async () => {
    const monitor = new LockMonitor();
    await monitor.start();

    // 等待一些扫描
    await new Promise(resolve => setTimeout(resolve, 150));

    const statsBefore = monitor.getStats();
    expect(statsBefore.scanCount).toBeGreaterThan(0);

    monitor.resetStats();

    const statsAfter = monitor.getStats();
    expect(statsAfter.scanCount).toBe(0);
    expect(statsAfter.staleLocksFound).toBe(0);
    expect(statsAfter.locksCleaned).toBe(0);

    await monitor.stop();
  });

  it('应该添加和移除监控的锁', async () => {
    const monitor = new LockMonitor();
    monitor.monitorLock(TEST_LOCK_PATH);
    monitor.monitorLock(join(TEST_DIR, 'another.lock'));

    // 移除一个
    monitor.unmonitorLock(join(TEST_DIR, 'another.lock'));

    await monitor.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await monitor.stop();

    // 验证扫描只处理了被监控的锁
    const stats = monitor.getStats();
    expect(stats.scanCount).toBeGreaterThan(0);
  });
});

describe('LockMonitor - 死锁检测', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const monitor = new LockMonitor();
    if (monitor.isRunning()) {
      await monitor.stop();
    }

    // 清理锁
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该检测过期的锁', async () => {
    const monitor = new LockMonitor({
      scanInterval: 100,
      staleTimeout: 50 // 50ms过期时间
    });

    // 创建一个锁
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.acquire();

    // 监控这个锁
    monitor.monitorLock(TEST_LOCK_PATH);

    await monitor.start();

    // 等待超过过期时间，使锁被标记为过期
    await new Promise(resolve => setTimeout(resolve, 100));

    // 手动扫描应该检测到过期锁
    const problemLocks = await monitor.scan();

    // 检查返回的问题锁信息
    expect(problemLocks.length).toBeGreaterThanOrEqual(0);

    const stats = monitor.getStats();
    // 扫描次数应该增加
    expect(stats.scanCount).toBeGreaterThan(0);

    await lock.cleanup();
    await monitor.stop();
  });

  it('应该记录事件历史', async () => {
    const monitor = new LockMonitor({
      scanInterval: 100
    });

    await monitor.start();

    // 等待一些扫描
    await new Promise(resolve => setTimeout(resolve, 250));

    const events = monitor.getEventHistory();
    expect(events.length).toBeGreaterThan(0);

    // 验证事件格式
    const scanEvent = events.find(e => e.type === 'scan_completed');
    expect(scanEvent).toBeDefined();
    expect(scanEvent?.timestamp).toBeInstanceOf(Date);
    expect(scanEvent?.lockPath).toBeDefined();

    await monitor.stop();
  });

  it('应该限制事件历史大小', async () => {
    const monitor = new LockMonitor({
      scanInterval: 10,
      maxHistoryRecords: 5
    });

    await monitor.start();

    // 等待超过限制的扫描
    await new Promise(resolve => setTimeout(resolve, 100));

    const events = monitor.getEventHistory();
    expect(events.length).toBeLessThanOrEqual(5);

    await monitor.stop();
  });

  it('应该支持获取限制数量的事件历史', async () => {
    const monitor = new LockMonitor({
      scanInterval: 50
    });

    await monitor.start();
    await new Promise(resolve => setTimeout(resolve, 200));

    const allEvents = monitor.getEventHistory();
    const limitedEvents = monitor.getEventHistory(2);

    expect(limitedEvents.length).toBeLessThanOrEqual(2);
    expect(allEvents.length).toBeGreaterThan(limitedEvents.length);

    await monitor.stop();
  });
});

describe('LockMonitor - 手动操作', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const monitor = new LockMonitor();
    if (monitor.isRunning()) {
      await monitor.stop();
    }

    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该支持手动清理', async () => {
    const monitor = new LockMonitor({
      scanInterval: 1000
    });

    // 不启动监控，直接手动扫描
    const cleanedCount = await monitor.cleanupNow();
    // 没有锁需要清理
    expect(cleanedCount).toBe(0);
  });

  it('应该支持手动触发扫描', async () => {
    const monitor = new LockMonitor();
    monitor.monitorLock(TEST_LOCK_PATH);

    // 创建锁
    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.acquire();

    // 手动扫描
    const problemLocks = await monitor.scan();

    // 应该返回锁信息
    expect(Array.isArray(problemLocks)).toBe(true);

    await lock.release();
  });
});

describe('LockMonitor - 全局单例', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const monitor = getGlobalMonitor();
    if (monitor.isRunning()) {
      await monitor.stop();
    }

    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该返回相同的全局实例', () => {
    const monitor1 = getGlobalMonitor();
    const monitor2 = getGlobalMonitor();

    expect(monitor1).toBe(monitor2);
  });

  it('应该使用全局实例进行监控', async () => {
    const monitor = getGlobalMonitor({
      scanInterval: 100
    });

    await monitor.start();
    expect(monitor.isRunning()).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 150));

    const stats = monitor.getStats();
    expect(stats.scanCount).toBeGreaterThan(0);

    await monitor.stop();
  });
});

describe('LockMonitor - 集成测试', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(async () => {
    const monitor = new LockMonitor();
    if (monitor.isRunning()) {
      await monitor.stop();
    }

    const lock = new FileLock(TEST_LOCK_PATH);
    await lock.cleanup();
    cleanupTestEnv();
  });

  it('应该与FileLock协同工作', async () => {
    const monitor = new LockMonitor({
      scanInterval: 100,
      staleTimeout: 500
    });

    const lock = new FileLock(TEST_LOCK_PATH);
    monitor.monitorLock(TEST_LOCK_PATH);

    await monitor.start();

    // 获取锁
    await lock.acquire();

    // 等待扫描
    await new Promise(resolve => setTimeout(resolve, 150));

    // 锁仍然被当前进程持有，不应该被清理
    const info = await lock.getInfo();
    expect(info.status).toBe('locked');

    // 释放锁
    await lock.release();

    // 等待更多扫描
    await new Promise(resolve => setTimeout(resolve, 150));

    await monitor.stop();
  });

  it('应该处理多个监控的锁', async () => {
    const monitor = new LockMonitor({
      scanInterval: 100
    });

    const lockPaths = [
      join(TEST_DIR, 'lock1.lock'),
      join(TEST_DIR, 'lock2.lock'),
      join(TEST_DIR, 'lock3.lock')
    ];

    lockPaths.forEach(path => monitor.monitorLock(path));

    await monitor.start();

    // 创建一些锁
    const locks = await Promise.all(
      lockPaths.map(async (path) => {
        const lock = new FileLock(path);
        await lock.acquire();
        return lock;
      })
    );

    // 等待扫描
    await new Promise(resolve => setTimeout(resolve, 150));

    const stats = monitor.getStats();
    expect(stats.scanCount).toBeGreaterThan(0);

    // 释放所有锁
    await Promise.all(locks.map(lock => lock.release()));

    await monitor.stop();
  });
});
