/**
 * IFileLock Interface
 *
 * @description
 * 文件锁接口定义，提供跨平台的文件锁定机制。
 * 用于防止多个Agent并发写入同一JSON文件导致数据损坏。
 *
 * @remarks
 * 实现要求：
 * - 使用flock或mkdir原子操作实现
 * - 支持跨平台（Windows/Linux/macOS）
 * - 进程崩溃时自动释放锁
 * - 支持死锁检测和自动释放
 *
 * @example
 * ```typescript
 * const lock = new FileLock('/path/to/file.lock');
 * await lock.acquire();
 * try {
 *   // 临界区代码
 *   await fs.writeFile('/path/to/file.json', data);
 * } finally {
 *   await lock.release();
 * }
 * ```
 *
 * @public
 */

/**
 * 锁模式枚举
 *
 * @description
 * 定义文件锁的不同模式
 *
 * @remarks
 * - SHARED: 共享锁，允许多个读者同时访问
 * - EXCLUSIVE: 排他锁，只允许单个写者访问
 */
export enum LockMode {
  /** 共享锁（读锁） */
  SHARED = 'shared',
  /** 排他锁（写锁） */
  EXCLUSIVE = 'exclusive'
}

/**
 * 锁状态枚举
 *
 * @description
 * 表示锁的当前状态
 */
export enum LockStatus {
  /** 锁未被持有 */
  UNLOCKED = 'unlocked',
  /** 锁已被当前实例持有 */
  LOCKED = 'locked',
  /** 锁被其他进程持有 */
  LOCKED_BY_OTHER = 'locked_by_other'
}

/**
 * 锁错误类型
 *
 * @description
 * 文件锁操作可能抛出的错误类型
 */
export class FileLockError extends Error {
  /** 错误代码 */
  readonly code: string;

  /**
   * 创建文件锁错误
   *
   * @param message - 错误消息
   * @param code - 错误代码
   */
  constructor(message: string, code: string = 'LOCK_ERROR') {
    super(message);
    this.name = 'FileLockError';
    this.code = code;
  }
}

/**
 * 锁选项配置
 *
 * @description
 * 配置文件锁行为的选项
 */
export interface LockOptions {
  /**
   * 获取锁的超时时间（毫秒）
   * @default 30000 (30秒)
   */
  timeout?: number;

  /**
   * 重试间隔（毫秒）
   * @default 100
   */
  retryInterval?: number;

  /**
   * 锁文件路径
   * 如果不指定，将在原文件路径后添加'.lock'后缀
   */
  lockFilePath?: string;

  /**
   * 死锁检测时间（毫秒）
   * 如果锁被持有超过此时间，将被视为死锁
   * @default 300000 (5分钟)
   */
  staleTimeout?: number;

  /**
   * 是否自动清理过期锁
   * @default true
   */
  autoCleanup?: boolean;
}

/**
 * 锁信息接口
 *
 * @description
 * 包含锁的详细状态信息
 */
export interface LockInfo {
  /** 锁状态 */
  status: LockStatus;
  /** 锁文件路径 */
  lockFilePath: string;
  /** 持有锁的进程ID */
  pid?: number;
  /** 锁模式 */
  mode?: LockMode;
  /** 共享锁计数（仅 SHARED 锁有效） */
  sharedCount?: number;
  /** 锁的创建时间 */
  createdAt?: Date;
  /** 锁的最后更新时间 */
  updatedAt?: Date;
  /** 是否为过期锁 */
  isStale?: boolean;
}

/**
 * 文件锁接口
 *
 * @description
 * 定义文件锁的核心操作方法
 *
 * @remarks
 * 所有实现必须确保：
 * 1. acquire操作的原子性
 * 2. 进程崩溃时自动释放锁
 * 3. 跨平台兼容性
 *
 * @public
 */
export interface IFileLock {
  /**
   * 获取文件锁
   *
   * @description
   * 尝试获取文件锁，如果锁已被其他进程持有，则等待直到超时
   *
   * @param mode - 锁模式（共享或排他）
   * @param options - 可选的锁配置
   * @returns Promise<void>
   * @throws {FileLockError} 获取锁超时或发生错误时抛出
   *
   * @example
   * ```typescript
   * await lock.acquire(LockMode.EXCLUSIVE);
   * console.log('Lock acquired');
   * ```
   */
  acquire(mode?: LockMode, options?: LockOptions): Promise<void>;

  /**
   * 释放文件锁
   *
   * @description
   * 释放当前持有的文件锁
   *
   * @returns Promise<void>
   * @throws {FileLockError} 释放锁时发生错误抛出
   *
   * @example
   * ```typescript
   * await lock.release();
   * console.log('Lock released');
   * ```
   */
  release(): Promise<void>;

  /**
   * 检查锁状态
   *
   * @description
   * 获取当前锁的状态信息，不修改锁状态
   *
   * @returns Promise<LockInfo> 锁的详细信息
   *
   * @example
   * ```typescript
   * const info = await lock.getInfo();
   * console.log(`Lock status: ${info.status}`);
   * ```
   */
  getInfo(): Promise<LockInfo>;

  /**
   * 检查是否持有锁
   *
   * @description
   * 快速检查当前实例是否持有锁
   *
   * @returns Promise<boolean> 是否持有锁
   *
   * @example
   * ```typescript
   * if (await lock.isLocked()) {
   *   console.log('Lock is held by current instance');
   * }
   * ```
   */
  isLocked(): Promise<boolean>;

  /**
   * 尝试获取锁（非阻塞）
   *
   * @description
   * 尝试获取锁，如果锁已被持有则立即返回false
   *
   * @param mode - 锁模式
   * @returns Promise<boolean> 是否成功获取锁
   *
   * @example
   * ```typescript
   * if (await lock.tryAcquire()) {
   *   console.log('Lock acquired');
   * } else {
   *   console.log('Lock is held by another process');
   * }
   * ```
   */
  tryAcquire(mode?: LockMode): Promise<boolean>;

  /**
   * 强制释放锁
   *
   * @description
   * 强制释放锁，即使锁不是由当前实例持有
   * 谨慎使用此方法，可能导致数据不一致
   *
   * @returns Promise<boolean> 是否成功强制释放
   *
   * @example
   * ```typescript
   * await lock.forceRelease();
   * console.log('Lock forcefully released');
   * ```
   */
  forceRelease(): Promise<boolean>;

  /**
   * 清理资源
   *
   * @description
   * 清理锁相关的所有资源，包括文件描述符和锁文件
   *
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * await lock.cleanup();
   * console.log('Lock resources cleaned up');
   * ```
   */
  cleanup(): Promise<void>;
}
