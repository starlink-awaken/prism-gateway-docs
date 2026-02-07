/**
 * File Lock Module - 文件锁模块
 *
 * @description
 * 导出文件锁相关的所有公共接口和实现
 *
 * @public
 */

// 接口和类型
export type {
  IFileLock,
  LockOptions,
  LockInfo
} from './IFileLock.js';

// 枚举
export {
  LockMode,
  LockStatus
} from './IFileLock.js';

// 错误类
export {
  FileLockError
} from './IFileLock.js';

// FileLock实现
export {
  FileLock,
  createFileLock,
  withLock
} from './FileLock.js';

// LockMonitor实现
export {
  LockMonitor,
  startLockMonitor,
  getGlobalMonitor
} from './LockMonitor.js';

// LockMonitor类型
export type {
  MonitorStats,
  MonitorOptions,
  LockEvent
} from './LockMonitor.js';
