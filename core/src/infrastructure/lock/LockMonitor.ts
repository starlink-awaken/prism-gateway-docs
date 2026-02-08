/**
 * LockMonitor - 死锁检测和自动释放守护进程
 *
 * @description
 * 后台守护进程，定期检测和清理死锁/过期锁
 *
 * @remarks
 * 功能：
 * 1. 定期扫描锁文件
 * 2. 检测过期锁（基于时间戳）
 * 3. 检测孤儿锁（原进程已不存在）
 * 4. 自动清理问题锁
 * 5. 生成监控报告
 *
 * @public
 */

import { FileLock } from './FileLock.js';
import { LockInfo } from './IFileLock.js';
import { readdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';

/**
 * 监控统计信息接口
 *
 * @description
 * 包含监控活动的统计数据
 */
export interface MonitorStats {
  /** 监控启动时间 */
  startedAt: Date;
  /** 扫描次数 */
  scanCount: number;
  /** 发现的过期锁数量 */
  staleLocksFound: number;
  /** 清理的锁数量 */
  locksCleaned: number;
  /** 最后扫描时间 */
  lastScanTime?: Date;
  /** 最后扫描发现的锁数量 */
  lastScanLockCount?: number;
}

/**
 * 监控配置接口
 *
 * @description
 * 配置LockMonitor的行为
 */
export interface MonitorOptions {
  /** 扫描间隔（毫秒） @default 60000 (1分钟) */
  scanInterval?: number;
  /** 过期锁阈值（毫秒） @default 300000 (5分钟) */
  staleTimeout?: number;
  /** 监控的目录路径 */
  monitorDir?: string;
  /** 是否自动清理过期锁 @default true */
  autoCleanup?: boolean;
  /** 锁文件扩展名模式 @default '.lock' */
  lockFilePattern?: string;
  /** 最大保留的监控记录数 @default 1000 */
  maxHistoryRecords?: number;
}

/**
 * 锁事件接口
 *
 * @description
 * 记录锁相关的历史事件
 */
export interface LockEvent {
  /** 事件时间 */
  timestamp: Date;
  /** 事件类型 */
  type: 'stale_detected' | 'orphan_detected' | 'cleaned' | 'scan_completed';
  /** 锁文件路径 */
  lockPath: string;
  /** 事件详情 */
  details: string;
}

/**
 * LockMonitor类
 *
 * @description
 * 后台守护进程，监控和清理死锁
 *
 * @example
 * ```typescript
 * const monitor = new LockMonitor({
 *   scanInterval: 60000,
 *   staleTimeout: 300000,
 *   monitorDir: '/tmp/locks'
 * });
 *
 * await monitor.start();
 *
 * // ... 应用运行
 *
 * await monitor.stop();
 * const stats = monitor.getStats();
 * console.log(`Cleaned ${stats.locksCleaned} locks`);
 * ```
 *
 * @public
 */
export class LockMonitor {
  /** 监控选项 */
  private readonly _options: Required<MonitorOptions>;
  /** 监控定时器 */
  private _timer: Timer | null = null;
  /** 是否正在运行 */
  private _isRunning: boolean = false;
  /** 统计信息 */
  private readonly _stats: MonitorStats;
  /** 事件历史记录 */
  private readonly _eventHistory: LockEvent[] = [];
  /** 所有被监控的锁实例 */
  private readonly _monitoredLocks: Set<string> = new Set();

  /**
   * 创建LockMonitor实例
   *
   * @param options - 监控配置选项
   */
  constructor(options: MonitorOptions = {}) {
    this._options = {
      scanInterval: options.scanInterval ?? 60000,
      staleTimeout: options.staleTimeout ?? 300000,
      monitorDir: options.monitorDir ?? '/tmp/prism-locks',
      autoCleanup: options.autoCleanup ?? true,
      lockFilePattern: options.lockFilePattern ?? '.lock',
      maxHistoryRecords: options.maxHistoryRecords ?? 1000
    };

    this._stats = {
      startedAt: new Date(),
      scanCount: 0,
      staleLocksFound: 0,
      locksCleaned: 0
    };
  }

  /**
   * 启动监控
   *
   * @description
   * 启动后台守护进程，定期扫描和清理死锁
   *
   * @returns Promise<void>
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;
    this._stats.startedAt = new Date();

    // 立即执行一次扫描
    await this.scan();

    // 设置定期扫描
    this._timer = setInterval(() => {
      this.scan().catch(error => {
        console.error('[LockMonitor] Scan error:', error);
      });
    }, this._options.scanInterval);

    this.recordEvent({
      timestamp: new Date(),
      type: 'scan_completed',
      lockPath: this._options.monitorDir,
      details: 'Monitor started'
    });
  }

  /**
   * 停止监控
   *
   * @description
   * 停止后台守护进程
   *
   * @returns Promise<void>
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;

    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }

    // 执行最后一次扫描
    await this.scan();
  }

  /**
   * 获取统计信息
   *
   * @returns MonitorStats
   */
  getStats(): MonitorStats {
    return { ...this._stats };
  }

  /**
   * 获取事件历史
   *
   * @param limit - 返回的最大事件数
   * @returns LockEvent[]
   */
  getEventHistory(limit?: number): LockEvent[] {
    const history = [...this._eventHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * 添加要监控的锁
   *
   * @param lockPath - 锁文件路径
   */
  monitorLock(lockPath: string): void {
    this._monitoredLocks.add(lockPath);
  }

  /**
   * 移除监控的锁
   *
   * @param lockPath - 锁文件路径
   */
  unmonitorLock(lockPath: string): void {
    this._monitoredLocks.delete(lockPath);
  }

  /**
   * 扫描和清理死锁
   *
   * @description
   * 扫描所有监控的锁文件，检测并清理过期锁
   *
   * @returns Promise<LockInfo[]> 发现的问题锁列表
   */
  async scan(): Promise<LockInfo[]> {
    this._stats.scanCount++;
    this._stats.lastScanTime = new Date();

    const problemLocks: LockInfo[] = [];

    try {
      // 扫描所有被监控的锁
      for (const lockPath of this._monitoredLocks) {
        const lock = new FileLock(lockPath);
        const info = await lock.getInfo();

        // 检查是否是问题锁
        if (info.status === 'locked_by_other' || info.isStale) {
          problemLocks.push(info);

          if (info.isStale) {
            this._stats.staleLocksFound++;
            this.recordEvent({
              timestamp: new Date(),
              type: 'stale_detected',
              lockPath,
              details: `Stale lock detected, PID: ${info.pid}, Age: ${Date.now() - (info.updatedAt?.getTime() ?? 0)}ms`
            });

            // 检查是否是孤儿锁
            if (info.pid && !(await this.processExists(info.pid))) {
              this.recordEvent({
                timestamp: new Date(),
                type: 'orphan_detected',
                lockPath,
                details: `Orphan lock detected, PID ${info.pid} no longer exists`
              });

              // 自动清理孤儿锁
              if (this._options.autoCleanup) {
                const cleaned = await lock.forceRelease();
                if (cleaned) {
                  this._stats.locksCleaned++;
                  this.recordEvent({
                    timestamp: new Date(),
                    type: 'cleaned',
                    lockPath,
                    details: `Cleaned orphan lock from PID ${info.pid}`
                  });
                }
              }
            }
          }
        }
      }

      this._stats.lastScanLockCount = problemLocks.length;

      this.recordEvent({
        timestamp: new Date(),
        type: 'scan_completed',
        lockPath: this._options.monitorDir,
        details: `Scan completed, found ${problemLocks.length} problem locks`
      });

      return problemLocks;
    } catch (error) {
      console.error('[LockMonitor] Scan failed:', error);
      return problemLocks;
    }
  }

  /**
   * 手动触发清理
   *
   * @description
   * 立即执行一次扫描并清理
   *
   * @returns Promise<number> 清理的锁数量
   */
  async cleanupNow(): Promise<number> {
    const beforeCleaned = this._stats.locksCleaned;
    await this.scan();
    return this._stats.locksCleaned - beforeCleaned;
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this._stats.scanCount = 0;
    this._stats.staleLocksFound = 0;
    this._stats.locksCleaned = 0;
    this._stats.lastScanTime = undefined;
    this._stats.lastScanLockCount = undefined;
    this._stats.startedAt = new Date();
    this._eventHistory.length = 0;
  }

  /**
   * 检查进程是否存在
   *
   * @param pid - 进程ID
   * @returns Promise<boolean>
   */
  private async processExists(pid: number): Promise<boolean> {
    try {
      if (process.platform !== 'win32') {
        const proc = Bun.spawn(['kill', '-0', pid.toString()], {
          stdout: 'pipe',
          stderr: 'pipe'
        });
        await proc.exited;
        return proc.exitCode === 0;
      } else {
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
   * 记录事件
   *
   * @param event - 锁事件
   */
  private recordEvent(event: LockEvent): void {
    this._eventHistory.push(event);

    // 限制历史记录大小
    if (this._eventHistory.length > this._options.maxHistoryRecords) {
      this._eventHistory.shift();
    }
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this._isRunning;
  }
}

/**
 * 创建并启动LockMonitor的便捷函数
 *
 * @param options - 监控配置选项
 * @returns LockMonitor实例
 *
 * @example
 * ```typescript
 * const monitor = startLockMonitor({
 *   scanInterval: 60000,
 *   staleTimeout: 300000
 * });
 * ```
 */
export async function startLockMonitor(options?: MonitorOptions): Promise<LockMonitor> {
  const monitor = new LockMonitor(options);
  await monitor.start();
  return monitor;
}

/**
 * 全局单例LockMonitor实例
 *
 * @description
 * 获取或创建全局LockMonitor实例
 *
 * @param options - 监控配置选项（仅在首次调用时生效）
 * @returns LockMonitor实例
 */
let globalMonitor: LockMonitor | null = null;

export function getGlobalMonitor(options?: MonitorOptions): LockMonitor {
  if (!globalMonitor) {
    globalMonitor = new LockMonitor(options);
  }
  return globalMonitor;
}
