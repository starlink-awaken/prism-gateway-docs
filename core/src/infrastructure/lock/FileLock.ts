/**
 * FileLock - 文件锁核心实现
 *
 * @description
 * 基于目录原子操作的跨平台文件锁实现。
 * 使用mkdir的原子性实现锁机制，确保跨平台兼容性。
 *
 * @remarks
 * 实现原理：
 * 1. 使用mkdir作为原子操作创建锁目录（而非文件）
 * 2. 锁元数据存储在.meta文件中
 * 3. 进程崩溃时，操作系统会自动清理未关闭的资源
 * 4. 支持死锁检测（stale lock检测）
 *
 * 跨平台兼容性：
 * - Windows: 使用mkdir原子操作
 * - Linux: 使用mkdir原子操作
 * - macOS: 使用mkdir原子操作
 *
 * @public
 */

import { IFileLock, LockMode, LockStatus, FileLockError, LockOptions, LockInfo } from './IFileLock.js';
import { mkdir, readFile, writeFile, unlink, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * 锁元数据接口
 *
 * @description
 * 存储锁的状态信息
 */
interface LockMetadata {
  /** 进程ID */
  pid: number;
  /** 锁模式 */
  mode: LockMode;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

/**
 * 文件锁实现类
 *
 * @description
 * 使用目录原子操作实现的跨平台文件锁，支持 SHARED 和 EXCLUSIVE 两种模式
 *
 * @example
 * ```typescript
 * const lock = new FileLock('/path/to/file.lock');
 * await lock.acquire(LockMode.EXCLUSIVE);
 * try {
 *   // 临界区代码
 * } finally {
 *   await lock.release();
 * }
 * ```
 *
 * @public
 */
export class FileLock implements IFileLock {
  /** 锁文件路径 */
  private readonly _lockFilePath: string;
  /** 锁目录路径（用于原子操作） */
  private readonly _lockDirPath: string;
  /** 元数据文件路径 */
  private readonly _metaPath: string;
  /** 共享锁标记文件前缀路径 */
  private readonly _sharedCounterPath: string;
  /** 当前实例的共享锁标记文件路径（包含唯一ID） */
  private readonly _sharedLockFilePath: string;
  /** 当前是否持有锁 */
  private _isLocked: boolean = false;
  /** 锁的创建时间 */
  private _lockCreatedAt: Date | null = null;
  /** 当前持有的锁模式 */
  private _currentLockMode: LockMode | null = null;
  /** 默认配置 */
  private readonly _defaultOptions: Required<LockOptions>;

  /**
   * 创建文件锁实例
   *
   * @param lockFilePath - 锁文件路径
   * @param defaultOptions - 默认锁配置
   *
   * @example
   * ```typescript
   * const lock = new FileLock('/path/to/file.lock', {
   *   timeout: 30000,
   *   retryInterval: 100,
   *   staleTimeout: 300000
   * });
   * ```
   */
  constructor(lockFilePath: string, defaultOptions: LockOptions = {}) {
    this._lockFilePath = lockFilePath;
    // 使用.lock目录作为原子锁载体
    this._lockDirPath = lockFilePath + '.lock';
    this._metaPath = lockFilePath + '.meta';
    // 共享锁标记文件前缀
    this._sharedCounterPath = lockFilePath + '.shared';
    // 为当前实例生成唯一的共享锁文件路径
    const instanceId = `${process.pid}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this._sharedLockFilePath = this._sharedCounterPath + '.' + instanceId;

    this._defaultOptions = {
      timeout: defaultOptions.timeout ?? 30000,
      retryInterval: defaultOptions.retryInterval ?? 100,
      lockFilePath: defaultOptions.lockFilePath ?? lockFilePath,
      staleTimeout: defaultOptions.staleTimeout ?? 300000, // 5分钟
      autoCleanup: defaultOptions.autoCleanup ?? true
    };
  }

  /**
   * 获取文件锁
   *
   * @description
   * 尝试获取文件锁，如果锁已被持有则等待重试
   *
   * @param mode - 锁模式
   * @param options - 可选配置
   * @returns Promise<void>
   * @throws {FileLockError} 获取锁超时或发生错误
   */
  async acquire(mode: LockMode = LockMode.EXCLUSIVE, options?: LockOptions): Promise<void> {
    const opts = { ...this._defaultOptions, ...options };
    const startTime = Date.now();
    let lastError: Error | null = null;

    // 如果已经持有锁，直接返回（不允许重入）
    if (this._isLocked) {
      return;
    }

    while (Date.now() - startTime < opts.timeout!) {
      // 检查是否有过期锁需要清理
      if (opts.autoCleanup) {
        await this.tryCleanupStaleLock(opts.staleTimeout!);
      }

      // 尝试通过tryAcquire获取锁
      if (await this.tryAcquire(mode)) {
        this._isLocked = true;
        this._currentLockMode = mode;
        this._lockCreatedAt = new Date();
        return;
      }

      // 等待重试间隔（最小1ms，避免忙等待消耗CPU）
      const waitTime = opts.retryInterval! > 0 ? opts.retryInterval! : 1;
      await this.sleep(waitTime);
    }

    throw new FileLockError(
      `Failed to acquire lock after ${opts.timeout}ms`,
      'ACQUIRE_TIMEOUT'
    );
  }

  /**
   * 释放文件锁
   *
   * @description
   * 释放当前持有的文件锁
   *
   * @returns Promise<void>
   */
  async release(): Promise<void> {
    if (!this._isLocked) {
      return; // 幂等操作
    }

    try {
      // SHARED 锁：删除当前实例的共享锁标记文件
      if (this._currentLockMode === LockMode.SHARED) {
        if (existsSync(this._sharedLockFilePath)) {
          await unlink(this._sharedLockFilePath).catch(() => {});
        }
      }

      // EXCLUSIVE 锁：删除元数据文件和锁目录
      if (this._currentLockMode === LockMode.EXCLUSIVE) {
        // 删除元数据文件
        if (existsSync(this._metaPath)) {
          await unlink(this._metaPath).catch(() => {});
        }

        // 删除锁目录
        if (existsSync(this._lockDirPath)) {
          await rm(this._lockDirPath, { recursive: true, force: true }).catch(() => {});
        }
      }

      this._isLocked = false;
      this._currentLockMode = null;
      this._lockCreatedAt = null;
    } catch (error) {
      this._isLocked = false;
      this._currentLockMode = null;
      this._lockCreatedAt = null;
      // 不抛出错误，因为锁可能已经被其他进程清理
    }
  }

  /**
   * 获取锁信息
   *
   * @description
   * 获取当前锁的详细状态信息，包括 SHARED 和 EXCLUSIVE 锁的状态
   *
   * @returns Promise<LockInfo>
   */
  async getInfo(): Promise<LockInfo> {
    const lockDirExists = existsSync(this._lockDirPath);
    const metadata = await this.readMetadata();

    // 检查是否有任何锁
    if (!lockDirExists && !this._sharedLockFilePath) {
      return {
        status: LockStatus.UNLOCKED,
        lockFilePath: this._lockFilePath
      };
    }

    // 当前实例持有锁
    if (this._isLocked) {
      return {
        status: LockStatus.LOCKED,
        lockFilePath: this._lockFilePath,
        pid: metadata?.pid,
        mode: this._currentLockMode || undefined,
        sharedCount: this._currentLockMode === LockMode.SHARED ? this._sharedLockCount : undefined,
        createdAt: metadata ? new Date(metadata.createdAt) : undefined,
        updatedAt: metadata ? new Date(metadata.updatedAt) : undefined,
        isStale: metadata ? this.isStale(metadata, this._defaultOptions.staleTimeout!) : false
      };
    }

    // 其他进程持有锁
    if (lockDirExists) {
      // EXCLUSIVE 锁
      return {
        status: LockStatus.LOCKED_BY_OTHER,
        lockFilePath: this._lockFilePath,
        pid: metadata?.pid,
        mode: LockMode.EXCLUSIVE,
        createdAt: metadata ? new Date(metadata.createdAt) : undefined,
        updatedAt: metadata ? new Date(metadata.updatedAt) : undefined,
        isStale: metadata ? this.isStale(metadata, this._defaultOptions.staleTimeout!) : false
      };
    }

    // SHARED 锁（统计共享锁标记文件数量）
    const sharedCount = await this.countSharedLocks();
    if (sharedCount > 0) {
      return {
        status: LockStatus.LOCKED_BY_OTHER,
        lockFilePath: this._lockFilePath,
        mode: LockMode.SHARED,
        sharedCount,
        createdAt: undefined, // SHARED 锁没有统一的元数据
        updatedAt: undefined
      };
    }

    // 默认返回解锁状态
    return {
      status: LockStatus.UNLOCKED,
      lockFilePath: this._lockFilePath
    };
  }

  /**
   * 统计当前活跃的共享锁数量
   *
   * @description
   * 通过扫描共享锁标记文件来统计活跃的共享锁数量
   *
   * @returns Promise<number> 共享锁数量
   */
  private async countSharedLocks(): Promise<number> {
    try {
      const { readdir } = await import('fs/promises');
      const parentDir = dirname(this._sharedCounterPath);
      const prefix = this._sharedCounterPath.split('/').pop() + '.';

      const files = await readdir(parentDir);
      const sharedLockFiles = files.filter(file => file.startsWith(prefix));

      // 验证每个文件的有效性
      let validCount = 0;
      for (const file of sharedLockFiles) {
        const filePath = join(parentDir, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (data.mode === LockMode.SHARED) {
            // 检查进程是否还在运行
            const pid = data.pid;
            if (await this.checkProcessExists(pid)) {
              validCount++;
            } else {
              // 进程已终止，清理锁文件
              await unlink(filePath).catch(() => {});
            }
          }
        } catch {
          // 文件损坏或无法读取，忽略
        }
      }

      return validCount;
    } catch {
      return 0;
    }
  }

  /**
   * 检查是否持有锁
   *
   * @returns Promise<boolean>
   */
  async isLocked(): Promise<boolean> {
    return this._isLocked;
  }

  /**
   * 尝试获取锁（非阻塞）
   *
   * @param mode - 锁模式
   * @returns Promise<boolean> 是否成功获取锁
   */
  async tryAcquire(mode: LockMode = LockMode.EXCLUSIVE): Promise<boolean> {
    // 注意：这里不再检查 _isLocked
    // 原因：同一个 FileLock 实例可能被多个并发操作复用
    // 每次调用都应该尝试获取锁

    // SHARED 锁逻辑
    if (mode === LockMode.SHARED) {
      return this.tryAcquireShared();
    }

    // EXCLUSIVE 锁逻辑
    if (mode === LockMode.EXCLUSIVE) {
      return this.tryAcquireExclusive();
    }

    return false;
  }

  /**
   * 尝试获取 SHARED 锁
   *
   * @description
   * SHARED 锁允许多个读取者并发访问。实现逻辑：
   * 1. 检查是否有 EXCLUSIVE 锁（锁目录存在）
   * 2. 如果没有，创建当前实例的共享锁标记文件
   * 3. 每个实例使用唯一的文件名（基于 PID + 时间戳 + 随机数）
   *
   * @returns Promise<boolean> 是否成功获取锁
   */
  private async tryAcquireShared(): Promise<boolean> {
    // 检查是否有 EXCLUSIVE 锁
    if (existsSync(this._lockDirPath)) {
      return false;
    }

    try {
      // 确保父目录存在
      const parentDir = dirname(this._sharedLockFilePath);
      if (!existsSync(parentDir)) {
        await mkdir(parentDir, { recursive: true });
      }

      // 创建共享锁标记文件（原子操作）
      const metadata = {
        pid: process.pid,
        mode: LockMode.SHARED,
        createdAt: new Date().toISOString()
      };
      await writeFile(this._sharedLockFilePath, JSON.stringify(metadata), { flag: 'wx' });

      // 再次检查是否有 EXCLUSIVE 锁（防止 TOCTOU 竞态）
      if (existsSync(this._lockDirPath)) {
        // 如果有 EXCLUSIVE 锁，清理刚创建的共享锁文件
        await unlink(this._sharedLockFilePath).catch(() => {});
        return false;
      }

      return true;
    } catch (error) {
      // 创建失败（文件已存在或其他错误）
      return false;
    }
  }

  /**
   * 尝试获取 EXCLUSIVE 锁
   *
   * @description
   * EXCLUSIVE 锁确保独占访问。实现逻辑：
   * 1. 检查锁目录是否存在
   * 2. 检查是否有共享锁标记文件
   * 3. 如果都没有，创建锁目录
   *
   * @returns Promise<boolean> 是否成功获取锁
   */
  private async tryAcquireExclusive(): Promise<boolean> {
    // 检查锁目录是否已存在
    if (existsSync(this._lockDirPath)) {
      return false;
    }

    // 检查是否有共享锁持有者
    const sharedCount = await this.countSharedLocks();
    if (sharedCount > 0) {
      return false; // 有共享锁持有者，无法获取 EXCLUSIVE 锁
    }

    try {
      // 确保父目录存在
      const parentDir = dirname(this._lockDirPath);
      if (!existsSync(parentDir)) {
        await mkdir(parentDir, { recursive: true });
      }

      // 使用mkdir的原子性创建锁目录（不递归，以保持原子性）
      await mkdir(this._lockDirPath);

      try {
        // 写入元数据
        const metadata: LockMetadata = {
          pid: process.pid,
          mode: LockMode.EXCLUSIVE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await writeFile(this._metaPath, JSON.stringify(metadata, null, 2));

        this._isLocked = true;
        this._currentLockMode = LockMode.EXCLUSIVE;
        this._lockCreatedAt = new Date();
        return true;
      } catch (metaError) {
        // 如果写入元数据失败，清理已创建的锁目录
        try {
          await rm(this._lockDirPath, { recursive: false, force: true });
        } catch {
          // 忽略清理错误
        }
        throw metaError;
      }
    } catch (error) {
      // mkdir失败说明锁已被其他进程持有
      this._isLocked = false;
      this._currentLockMode = null;
      this._lockCreatedAt = null;
      return false;
    }
  }

  /**
   * 删除共享锁标记文件
   *
   * @description
   * 删除当前实例的共享锁标记文件
   *
   * @returns Promise<void>
   */
  private async decrementSharedCounter(): Promise<void> {
    if (!this._sharedLockFilePath) {
      return;
    }

    try {
      await unlink(this._sharedLockFilePath);
    } catch {
      // 忽略删除失败
    } finally {
      this._sharedLockFilePath = null;
    }
  }

  /**
   * 强制释放锁
   *
   * @description
   * 强制释放锁，即使不是由当前实例持有。会清理所有锁相关文件。
   *
   * @returns Promise<boolean>
   */
  async forceRelease(): Promise<boolean> {
    let released = false;

    try {
      // 删除元数据文件
      if (existsSync(this._metaPath)) {
        await unlink(this._metaPath);
        released = true;
      }

      // 删除锁目录
      if (existsSync(this._lockDirPath)) {
        await rm(this._lockDirPath, { recursive: true, force: true });
        released = true;
      }

      // 删除所有共享锁标记文件
      await this.cleanupAllSharedLocks();

      // 重置内部状态
      this._isLocked = false;
      this._currentLockMode = null;
      this._lockCreatedAt = null;
      this._sharedLockCount = 0;
      this._sharedLockFilePath = null;

      return released;
    } catch {
      return false;
    }
  }

  /**
   * 清理资源
   *
   * @description
   * 清理锁相关的所有资源，包括文件描述符和锁文件
   * 即使当前实例没有持有锁，也会尝试清理锁目录
   *
   * @returns Promise<void>
   */
  async cleanup(): Promise<void> {
    // 重置内部状态
    this._isLocked = false;
    this._currentLockMode = null;
    this._lockCreatedAt = null;
    this._sharedLockCount = 0;
    this._sharedLockFilePath = null;

    // 尝试清理所有锁相关文件
    try {
      if (existsSync(this._metaPath)) {
        await unlink(this._metaPath).catch(() => {});
      }

      if (existsSync(this._lockDirPath)) {
        await rm(this._lockDirPath, { recursive: true, force: true }).catch(() => {});
      }

      await this.cleanupAllSharedLocks();
    } catch {
      // 忽略清理错误
    }
  }

  /**
   * 清理所有共享锁标记文件
   *
   * @description
   * 删除所有共享锁标记文件（用于强制释放或清理）
   *
   * @returns Promise<void>
   */
  private async cleanupAllSharedLocks(): Promise<void> {
    try {
      const { readdir } = await import('fs/promises');
      const parentDir = dirname(this._sharedCounterPath);
      const prefix = this._sharedCounterPath.split('/').pop() + '.';

      const files = await readdir(parentDir);
      const sharedLockFiles = files.filter(file => file.startsWith(prefix));

      for (const file of sharedLockFiles) {
        const filePath = join(parentDir, file);
        await unlink(filePath).catch(() => {});
      }
    } catch {
      // 忽略清理错误
    }
  }

  /**
   * 读取锁元数据
   *
   * @returns Promise<LockMetadata | null>
   */
  private async readMetadata(): Promise<LockMetadata | null> {
    try {
      if (!existsSync(this._metaPath)) {
        return null;
      }

      const content = await readFile(this._metaPath, 'utf-8');
      const data = JSON.parse(content);
      return data as LockMetadata;
    } catch {
      return null;
    }
  }

  /**
   * 检查锁是否过期
   *
   * @param metadata - 锁元数据
   * @param staleTimeout - 过期时间阈值
   * @returns 是否过期
   */
  private isStale(metadata: LockMetadata, staleTimeout: number): boolean {
    const updatedTime = new Date(metadata.updatedAt).getTime();
    const now = Date.now();
    return (now - updatedTime) > staleTimeout;
  }

  /**
   * 尝试清理过期锁
   *
   * @param staleTimeout - 过期时间阈值
   */
  private async tryCleanupStaleLock(staleTimeout: number): Promise<void> {
    try {
      const metadata = await this.readMetadata();
      if (!metadata) {
        return;
      }

      if (this.isStale(metadata, staleTimeout)) {
        // 检查进程是否还存在
        const processExists = await this.checkProcessExists(metadata.pid);
        if (!processExists) {
          // 进程已不存在，可以安全清理
          await this.forceRelease();
        }
      }
    } catch {
      // 忽略清理错误
    }
  }

  /**
   * 检查进程是否存在
   *
   * @param pid - 进程ID
   * @returns Promise<boolean>
   */
  private async checkProcessExists(pid: number): Promise<boolean> {
    try {
      // 在Unix系统上，我们可以向进程发送0信号来检查进程是否存在
      if (process.platform !== 'win32') {
        // 使用Bun的spawn发送信号
        const proc = Bun.spawn(['kill', '-0', pid.toString()], {
          stdout: 'pipe',
          stderr: 'pipe'
        });
        await proc.exited;
        return proc.exitCode === 0;
      } else {
        // Windows上使用tasklist
        const proc = Bun.spawn([
          'tasklist',
          '/FI',
          `PID eq ${pid}`
        ], {
          stdout: 'pipe',
          stderr: 'pipe'
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        return output.includes(pid.toString());
      }
    } catch {
      return false;
    }
  }

  /**
   * 睡眠指定毫秒数
   *
   * @param ms - 毫秒数
   * @returns Promise<void>
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 导出工厂函数
 *
 * @description
 * 创建文件锁实例的便捷方法
 *
 * @param lockFilePath - 锁文件路径
 * @param options - 可选配置
 * @returns FileLock实例
 *
 * @example
 * ```typescript
 * const lock = createFileLock('/path/to/file.lock');
 * await lock.acquire();
 * ```
 */
export function createFileLock(lockFilePath: string, options?: LockOptions): FileLock {
  return new FileLock(lockFilePath, options);
}

/**
 * 导出withLock辅助函数
 *
 * @description
 * 自动获取和释放锁的辅助函数
 *
 * @param lockFilePath - 锁文件路径
 * @param fn - 在锁保护下执行的函数
 * @param options - 可选配置
 * @returns 函数执行结果
 *
 * @example
 * ```typescript
 * const result = await withLock('/path/to/file.lock', async () => {
 *   await fs.writeFile('/path/to/file.json', data);
 *   return 'success';
 * });
 * ```
 */
export async function withLock<T>(
  lockFilePath: string,
  fn: () => Promise<T>,
  options?: LockOptions
): Promise<T> {
  const lock = new FileLock(lockFilePath, options);
  await lock.acquire(LockMode.EXCLUSIVE, options);

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
