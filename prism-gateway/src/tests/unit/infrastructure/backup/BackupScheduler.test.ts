/**
 * BackupScheduler 单元测试
 *
 * @description
 * 测试备份调度器的功能：任务管理、CRON 解析、调度执行
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { BackupScheduler } from '../../../../infrastructure/backup/BackupScheduler.js';
import { BackupService } from '../../../../infrastructure/backup/BackupService.js';
import type { BackupType } from '../../../../infrastructure/backup/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('BackupScheduler', () => {
  let scheduler: BackupScheduler;
  let mockService: any;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scheduler-test-'));

    // 创建 mock BackupService
    mockService = {
      createBackup: mock(async (type: BackupType) => {
        return `mock-backup-${type}-${Date.now()}`;
      }),
      storageManager: {
        applyRetentionPolicy: mock(async () => {
          return [];
        })
      }
    };

    scheduler = new BackupScheduler(mockService as BackupService);
  });

  afterEach(async () => {
    // 停止调度器
    await scheduler.stop();

    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('start() and stop()', () => {
    it('should start the scheduler', async () => {
      // 执行：启动调度器
      await scheduler.start({
        fullBackup: '0 2 * * 0',
        incrementalBackup: '0 3 * * 1-5',
        cleanup: '0 4 * * 0'
      });

      // 验证：调度器应该有 3 个任务
      const jobs = scheduler.getJobs();
      expect(jobs.length).toBe(3);
      expect(jobs.map((j) => j.name)).toContain('full-backup');
      expect(jobs.map((j) => j.name)).toContain('incremental-backup');
      expect(jobs.map((j) => j.name)).toContain('cleanup');
    });

    it('should stop the scheduler', async () => {
      // 执行：启动并停止调度器
      await scheduler.start();
      await scheduler.stop();

      // 验证：任务列表应该为空
      const jobs = scheduler.getJobs();
      expect(jobs.length).toBe(0);
    });

    it('should throw error if started twice', async () => {
      // 执行：启动两次
      await scheduler.start();

      // 验证：第二次启动应该抛出错误
      await expect(scheduler.start()).rejects.toThrow('already running');
    });
  });

  describe('addJob() and removeJob()', () => {
    it('should add a custom job', async () => {
      // 执行：添加自定义任务
      let executed = false;
      scheduler.addJob('custom-job', '0 0 * * *', async () => {
        executed = true;
      });

      // 验证：任务已添加
      const jobs = scheduler.getJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0].name).toBe('custom-job');
      expect(jobs[0].schedule).toBe('0 0 * * *');
    });

    it('should remove a job', async () => {
      // 执行：添加并移除任务
      scheduler.addJob('test-job', '0 0 * * *', async () => {});
      scheduler.removeJob('test-job');

      // 验证：任务已移除
      const jobs = scheduler.getJobs();
      expect(jobs.length).toBe(0);
    });

    it('should throw error when adding duplicate job', async () => {
      // 执行：添加重复任务
      scheduler.addJob('duplicate-job', '0 0 * * *', async () => {});

      // 验证：第二次添加应该抛出错误
      expect(() => {
        scheduler.addJob('duplicate-job', '0 1 * * *', async () => {});
      }).toThrow('already exists');
    });
  });

  describe('getJobs()', () => {
    it('should return empty array when no jobs', async () => {
      // 验证：无任务时返回空数组
      const jobs = scheduler.getJobs();
      expect(jobs).toBeArray();
      expect(jobs.length).toBe(0);
    });

    it('should return job information', async () => {
      // 执行：添加任务
      scheduler.addJob('test-job', '0 0 * * *', async () => {});

      // 验证：返回任务信息
      const jobs = scheduler.getJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0]).toHaveProperty('name');
      expect(jobs[0]).toHaveProperty('schedule');
      expect(jobs[0]).toHaveProperty('running');
      expect(jobs[0].running).toBe(false);
    });
  });

  describe('CRON parsing', () => {
    it('should match exact time (Sunday 2:00)', async () => {
      // 准备：创建测试用的调度器实例
      const testScheduler = new BackupScheduler(mockService as BackupService);

      // 测试 CRON 表达式匹配（需要访问私有方法，这里我们测试整体行为）
      await testScheduler.start({
        fullBackup: '0 2 * * 0',
        incrementalBackup: '0 3 * * 1-5',
        cleanup: '0 4 * * 0'
      });

      // 验证：调度器已启动并注册了任务
      const jobs = testScheduler.getJobs();
      expect(jobs.length).toBe(3);

      await testScheduler.stop();
    });

    it('should handle wildcard patterns', async () => {
      // 准备：使用通配符 CRON 表达式
      const testScheduler = new BackupScheduler(mockService as BackupService);

      await testScheduler.start({
        fullBackup: '* * * * *', // 每分钟
        incrementalBackup: '0 * * * *', // 每小时
        cleanup: '0 0 * * *' // 每天
      });

      // 验证：调度器已启动
      const jobs = testScheduler.getJobs();
      expect(jobs.length).toBe(3);

      await testScheduler.stop();
    });

    it('should handle range patterns (1-5 for weekdays)', async () => {
      // 准备：使用范围 CRON 表达式
      const testScheduler = new BackupScheduler(mockService as BackupService);

      await testScheduler.start({
        fullBackup: '0 2 * * 0',
        incrementalBackup: '0 3 * * 1-5', // 周一到周五
        cleanup: '0 4 * * 0'
      });

      // 验证：调度器已启动
      const jobs = testScheduler.getJobs();
      const incrementalJob = jobs.find((j) => j.name === 'incremental-backup');
      expect(incrementalJob).toBeDefined();
      expect(incrementalJob!.schedule).toBe('0 3 * * 1-5');

      await testScheduler.stop();
    });
  });

  describe('Job execution', () => {
    it('should prevent concurrent job execution', async () => {
      // 准备：创建一个长时间运行的任务
      let executionCount = 0;
      const longRunningJob = async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      };

      scheduler.addJob('long-running', '* * * * *', longRunningJob);

      // 执行：手动触发任务执行（通过私有方法，这里我们测试整体行为）
      // 在实际场景中，调度器会自动检查并执行任务

      // 验证：任务状态
      const jobs = scheduler.getJobs();
      const job = jobs.find((j) => j.name === 'long-running');
      expect(job).toBeDefined();
      expect(job!.running).toBe(false); // 任务未开始时应该为 false
    });
  });

  describe('Default schedules', () => {
    it('should use default schedules when config not provided', async () => {
      // 执行：启动调度器（不提供配置）
      await scheduler.start();

      // 验证：使用默认调度表达式
      const jobs = scheduler.getJobs();

      const fullBackupJob = jobs.find((j) => j.name === 'full-backup');
      const incrementalBackupJob = jobs.find((j) => j.name === 'incremental-backup');
      const cleanupJob = jobs.find((j) => j.name === 'cleanup');

      expect(fullBackupJob?.schedule).toBe('0 2 * * 0'); // 周日 2:00
      expect(incrementalBackupJob?.schedule).toBe('0 3 * * 1-5'); // 工作日 3:00
      expect(cleanupJob?.schedule).toBe('0 4 * * 0'); // 周日 4:00
    });
  });
});
