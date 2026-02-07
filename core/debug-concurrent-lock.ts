#!/usr/bin/env bun
/**
 * FileLock 并发调试脚本 - 模拟混合读写场景
 */

import { FileLock } from './src/infrastructure/lock/FileLock.js';
import { LockMode } from './src/infrastructure/lock/IFileLock.js';

const lock = new FileLock('/tmp/test-concurrent-lock');

console.log('🧪 并发测试：3个读操作 + 1个写操作\n');

const startTime = Date.now();

try {
  // 同时启动 3 个读操作和 1 个写操作
  const results = await Promise.allSettled([
    // 读操作 1
    (async () => {
      console.log('  [读1] 尝试获取 SHARED 锁...');
      await lock.acquire(LockMode.SHARED);
      console.log('  [读1] ✅ 获取成功');
      await sleep(100); // 模拟读取耗时
      console.log('  [读1] 释放锁...');
      await lock.release();
      console.log('  [读1] ✅ 释放成功');
      return 'read1';
    })(),

    // 读操作 2
    (async () => {
      console.log('  [读2] 尝试获取 SHARED 锁...');
      await lock.acquire(LockMode.SHARED);
      console.log('  [读2] ✅ 获取成功');
      await sleep(100); // 模拟读取耗时
      console.log('  [读2] 释放锁...');
      await lock.release();
      console.log('  [读2] ✅ 释放成功');
      return 'read2';
    })(),

    // 读操作 3
    (async () => {
      console.log('  [读3] 尝试获取 SHARED 锁...');
      await lock.acquire(LockMode.SHARED);
      console.log('  [读3] ✅ 获取成功');
      await sleep(100); // 模拟读取耗时
      console.log('  [读3] 释放锁...');
      await lock.release();
      console.log('  [读3] ✅ 释放成功');
      return 'read3';
    })(),

    // 写操作
    (async () => {
      await sleep(50); // 稍微延迟，让读操作先获取锁
      console.log('  [写] 尝试获取 EXCLUSIVE 锁...');
      await lock.acquire(LockMode.EXCLUSIVE);
      console.log('  [写] ✅ 获取成功');
      await sleep(50); // 模拟写入耗时
      console.log('  [写] 释放锁...');
      await lock.release();
      console.log('  [写] ✅ 释放成功');
      return 'write';
    })()
  ]);

  const elapsed = Date.now() - startTime;

  console.log('\n📊 结果:');
  console.log('  总耗时:', elapsed, 'ms');
  console.log('  成功:', results.filter(r => r.status === 'fulfilled').length);
  console.log('  失败:', results.filter(r => r.status === 'rejected').length);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.log(`  ❌ 操作${index + 1} 失败:`, result.reason.message);
    }
  });

  // 检查最终锁状态
  const finalInfo = await lock.getInfo();
  console.log('\n🔒 最终锁状态:', finalInfo);

} catch (error) {
  console.error('❌ 测试失败:', error);
}

// 清理
await lock.cleanup();
console.log('\n✅ 调试完成');

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
