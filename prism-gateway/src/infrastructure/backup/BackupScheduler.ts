/**
 * PRISM-Gateway Backup Scheduler
 *
 * @description
 * 备份调度器，负责定时任务管理（CRON风格调度）
 *
 * @module infrastructure/backup/BackupScheduler
 */

import type { ScheduleConfig } from './types.js';
import type { BackupService } from './BackupService.js';

/**
 * 调度任务接口
 */
interface ScheduledJob {
  /** 任务名称 */
  name: string;

  /** CRON表达式 */
  schedule: string;

  /** 任务函数 */
  job: () => Promise<void>;

  /** 定时器ID */
  timerId?: NodeJS.Timeout;

  /** 是否正在运行 */
  running: boolean;
}

/**
 * 备份调度器
 *
 * @description
 * 管理定时备份任务：
 * - 全量备份：每周日凌晨 2:00（CRON: 0 2 * * 0）
 * - 增量备份：工作日凌晨 3:00（CRON: 0 3 * * 1-5）
 * - 自动清理：每周日凌晨 4:00（CRON: 0 4 * * 0）
 *
 * @remarks
 * 注意：这是简化的调度实现。生产环境应使用 node-cron 或类似库。
 * 当前实现使用简单的轮询检查（每分钟检查一次）。
 */
export class BackupScheduler {
  /** 关联的备份服务 */
  private service: BackupService;

  /** 调度任务映射 */
  private jobs: Map<string, ScheduledJob>;

  /** 调度器是否正在运行 */
  private running: boolean;

  /** 主轮询定时器 */
  private pollTimer?: NodeJS.Timeout;

  /**
   * 构造函数
   *
   * @param service - 备份服务实例
   */
  constructor(service: BackupService) {
    this.service = service;
    this.jobs = new Map();
    this.running = false;
  }

  /**
   * 启动调度器
   *
   * @param config - 调度配置（可选）
   *
   * @example
   * ```typescript
   * const scheduler = new BackupScheduler(backupService);
   * await scheduler.start({
   *   fullBackup: '0 2 * * 0',        // 每周日 2:00
   *   incrementalBackup: '0 3 * * 1-5', // 工作日 3:00
   *   cleanup: '0 4 * * 0'             // 每周日 4:00
   * });
   * ```
   */
  async start(config?: ScheduleConfig): Promise<void> {
    if (this.running) {
      throw new Error('Scheduler is already running');
    }

    // 使用默认配置或提供的配置
    const effectiveConfig = config || {
      fullBackup: '0 2 * * 0', // 每周日 2:00
      incrementalBackup: '0 3 * * 1-5', // 工作日 3:00
      cleanup: '0 4 * * 0' // 每周日 4:00
    };

    // 注册任务
    this.addJob('full-backup', effectiveConfig.fullBackup, async () => {
      console.log('[BackupScheduler] Running scheduled full backup...');
      await this.service.createBackup('full');
    });

    this.addJob(
      'incremental-backup',
      effectiveConfig.incrementalBackup,
      async () => {
        console.log('[BackupScheduler] Running scheduled incremental backup...');
        await this.service.createBackup('incremental');
      }
    );

    this.addJob('cleanup', effectiveConfig.cleanup, async () => {
      console.log('[BackupScheduler] Running scheduled cleanup...');
      const storageManager = (this.service as any).storageManager;
      await storageManager.applyRetentionPolicy();
    });

    // 启动轮询（每分钟检查一次）
    this.running = true;
    this.pollTimer = setInterval(() => {
      this.checkSchedules();
    }, 60 * 1000);

    console.log('[BackupScheduler] Scheduler started');
  }

  /**
   * 停止调度器
   *
   * @example
   * ```typescript
   * const scheduler = new BackupScheduler(backupService);
   * await scheduler.start();
   * // ... later
   * await scheduler.stop();
   * ```
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // 停止轮询
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    // 清除所有任务
    this.jobs.clear();

    this.running = false;
    console.log('[BackupScheduler] Scheduler stopped');
  }

  /**
   * 添加定时任务
   *
   * @param name - 任务名称
   * @param schedule - CRON表达式
   * @param job - 任务函数
   *
   * @example
   * ```typescript
   * scheduler.addJob('custom-backup', '0 1 * * *', async () => {
   *   console.log('Running custom backup...');
   * });
   * ```
   */
  addJob(name: string, schedule: string, job: () => Promise<void>): void {
    if (this.jobs.has(name)) {
      throw new Error(`Job already exists: ${name}`);
    }

    this.jobs.set(name, {
      name,
      schedule,
      job,
      running: false
    });

    console.log(`[BackupScheduler] Added job: ${name} (${schedule})`);
  }

  /**
   * 移除定时任务
   *
   * @param name - 任务名称
   *
   * @example
   * ```typescript
   * scheduler.removeJob('custom-backup');
   * ```
   */
  removeJob(name: string): void {
    this.jobs.delete(name);
    console.log(`[BackupScheduler] Removed job: ${name}`);
  }

  /**
   * 获取所有任务
   *
   * @returns 任务列表
   */
  getJobs(): Array<{ name: string; schedule: string; running: boolean }> {
    return Array.from(this.jobs.values()).map((job) => ({
      name: job.name,
      schedule: job.schedule,
      running: job.running
    }));
  }

  /**
   * 检查调度表达式并执行到期任务
   *
   * @internal
   */
  private checkSchedules(): void {
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (job.running) {
        continue; // 跳过正在运行的任务
      }

      if (this.shouldRun(job.schedule, now)) {
        this.runJob(job);
      }
    }
  }

  /**
   * 执行任务
   *
   * @param job - 任务对象
   * @internal
   */
  private async runJob(job: ScheduledJob): Promise<void> {
    job.running = true;

    try {
      await job.job();
      console.log(`[BackupScheduler] Job completed: ${job.name}`);
    } catch (error) {
      console.error(`[BackupScheduler] Job failed: ${job.name}`, error);
    } finally {
      job.running = false;
    }
  }

  /**
   * 判断任务是否应该在给定时间运行
   *
   * @param cron - CRON表达式
   * @param date - 检查时间
   * @returns 是否应该运行
   * @internal
   *
   * @remarks
   * 简化的CRON解析实现，仅支持标准格式：
   * minute hour day month weekday
   *
   * 示例：
   * - "0 2 * * 0" - 每周日 2:00
   * - "0 3 * * 1-5" - 工作日 3:00
   */
  private shouldRun(cron: string, date: Date): boolean {
    const parts = cron.split(' ');
    if (parts.length !== 5) {
      console.warn(`[BackupScheduler] Invalid CRON expression: ${cron}`);
      return false;
    }

    const [minute, hour, day, month, weekday] = parts;

    // 检查分钟
    if (minute !== '*' && parseInt(minute) !== date.getMinutes()) {
      return false;
    }

    // 检查小时
    if (hour !== '*' && parseInt(hour) !== date.getHours()) {
      return false;
    }

    // 检查日期
    if (day !== '*' && parseInt(day) !== date.getDate()) {
      return false;
    }

    // 检查月份
    if (month !== '*' && parseInt(month) !== date.getMonth() + 1) {
      return false;
    }

    // 检查星期
    if (weekday !== '*') {
      if (weekday.includes('-')) {
        // 范围检查（如 1-5）
        const [start, end] = weekday.split('-').map((n) => parseInt(n));
        const currentDay = date.getDay();
        if (currentDay < start || currentDay > end) {
          return false;
        }
      } else if (parseInt(weekday) !== date.getDay()) {
        return false;
      }
    }

    return true;
  }
}
