/**
 * PRISM-Gateway Backup Scheduler
 *
 * @module infrastructure/backup/BackupScheduler
 */

import type { ScheduleConfig } from './types.js';
import type { BackupService } from './BackupService.js';

interface ScheduledJob {
  name: string;
  schedule: string;
  job: () => Promise<void>;
  timerId?: NodeJS.Timeout;
  running: boolean;
}

/**
 * Backup scheduler for automated backups
 */
export class BackupScheduler {
  private service: BackupService;
  private jobs: Map<string, ScheduledJob>;
  private running: boolean;
  private pollTimer?: NodeJS.Timeout;

  constructor(service: BackupService) {
    this.service = service;
    this.jobs = new Map();
    this.running = false;
  }

  /**
   * Start scheduler
   */
  async start(config?: ScheduleConfig): Promise<void> {
    if (this.running) {
      throw new Error('Scheduler is already running');
    }

    const effectiveConfig = config || {
      fullBackup: '0 2 * * 0',
      incrementalBackup: '0 3 * * 1-5',
      cleanup: '0 4 * * 0'
    };

    this.addJob('full-backup', effectiveConfig.fullBackup, async () => {
      console.log('[BackupScheduler] Running scheduled full backup...');
      await this.service.createBackup('full');
    });

    this.addJob('incremental-backup', effectiveConfig.incrementalBackup, async () => {
      console.log('[BackupScheduler] Running scheduled incremental backup...');
      await this.service.createBackup('incremental');
    });

    this.addJob('cleanup', effectiveConfig.cleanup, async () => {
      console.log('[BackupScheduler] Running scheduled cleanup...');
      const storageManager = (this.service as any).storageManager;
      await storageManager.applyRetentionPolicy();
    });

    this.running = true;
    this.pollTimer = setInterval(() => {
      this.checkSchedules();
    }, 60 * 1000);

    console.log('[BackupScheduler] Scheduler started');
  }

  /**
   * Stop scheduler
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    this.jobs.clear();
    this.running = false;
    console.log('[BackupScheduler] Scheduler stopped');
  }

  /**
   * Add custom job
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
   * Remove job
   */
  removeJob(name: string): void {
    this.jobs.delete(name);
    console.log(`[BackupScheduler] Removed job: ${name}`);
  }

  /**
   * Get all jobs
   */
  getJobs(): Array<{ name: string; schedule: string; running: boolean }> {
    return Array.from(this.jobs.values()).map(job => ({
      name: job.name,
      schedule: job.schedule,
      running: job.running
    }));
  }

  private checkSchedules(): void {
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (job.running) {
        continue;
      }

      if (this.shouldRun(job.schedule, now)) {
        this.runJob(job);
      }
    }
  }

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

  private shouldRun(cron: string, date: Date): boolean {
    const parts = cron.split(' ');
    if (parts.length !== 5) {
      console.warn(`[BackupScheduler] Invalid CRON expression: ${cron}`);
      return false;
    }

    const [minute, hour, day, month, weekday] = parts;

    if (minute !== '*' && parseInt(minute) !== date.getMinutes()) {
      return false;
    }

    if (hour !== '*' && parseInt(hour) !== date.getHours()) {
      return false;
    }

    if (day !== '*' && parseInt(day) !== date.getDate()) {
      return false;
    }

    if (month !== '*' && parseInt(month) !== date.getMonth() + 1) {
      return false;
    }

    if (weekday !== '*') {
      if (weekday.includes('-')) {
        const [start, end] = weekday.split('-').map(n => parseInt(n));
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
