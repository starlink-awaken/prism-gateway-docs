#!/usr/bin/env bun
/**
 * FileLock 调试脚本 - 测试 SHARED 锁的基本功能
 */

import { FileLock } from './src/infrastructure/lock/FileLock.js';
import { LockMode } from './src/infrastructure/lock/IFileLock.js';

const lock = new FileLock('/tmp/test-shared-lock');

console.log('1. 尝试获取 SHARED 锁...');
try {
  await lock.acquire(LockMode.SHARED);
  console.log('✅ SHARED 锁获取成功');

  const info = await lock.getInfo();
  console.log('锁信息:', info);

  console.log('\n2. 释放 SHARED 锁...');
  await lock.release();
  console.log('✅ SHARED 锁释放成功');

  const info2 = await lock.getInfo();
  console.log('释放后锁信息:', info2);

} catch (error) {
  console.error('❌ 错误:', error);
}

console.log('\n3. 尝试获取 EXCLUSIVE 锁...');
try {
  await lock.acquire(LockMode.EXCLUSIVE);
  console.log('✅ EXCLUSIVE 锁获取成功');

  const info3 = await lock.getInfo();
  console.log('锁信息:', info3);

  console.log('\n4. 释放 EXCLUSIVE 锁...');
  await lock.release();
  console.log('✅ EXCLUSIVE 锁释放成功');

} catch (error) {
  console.error('❌ 错误:', error);
}

// 清理
await lock.cleanup();
console.log('\n✅ 调试完成');
