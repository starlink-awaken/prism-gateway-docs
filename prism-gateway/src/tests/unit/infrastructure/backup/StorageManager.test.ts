/**
 * StorageManager 单元测试
 *
 * @description
 * 测试存储管理器的功能：备份保存、加载、列出、删除、保留策略、统计
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { StorageManager } from '../../../../infrastructure/backup/StorageManager.js';
import { BackupType, BackupStatus } from '../../../../infrastructure/backup/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('StorageManager', () => {
  let manager: StorageManager;
  let testDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-manager-test-'));
    manager = new StorageManager(testDir);
    await manager.initialize();
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('initialize()', () => {
    it('should create directory structure', async () => {
      // 验证：目录结构应该存在
      const fullDirExists = await fs.access(path.join(testDir, 'full'))
        .then(() => true)
        .catch(() => false);
      const incrementalDirExists = await fs.access(path.join(testDir, 'incremental'))
        .then(() => true)
        .catch(() => false);

      expect(fullDirExists).toBe(true);
      expect(incrementalDirExists).toBe(true);
    });

    it('should create manifest.json', async () => {
      // 验证：manifest 文件应该存在
      const manifestExists = await fs.access(path.join(testDir, 'manifest.json'))
        .then(() => true)
        .catch(() => false);

      expect(manifestExists).toBe(true);

      // 读取并验证 manifest 内容
      const manifestContent = await fs.readFile(
        path.join(testDir, 'manifest.json'),
        'utf-8'
      );
      const manifest = JSON.parse(manifestContent);

      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('backups');
      expect(manifest).toHaveProperty('retention');
      expect(manifest.backups).toBeArray();
      expect(manifest.backups.length).toBe(0);
    });
  });

  describe('save()', () => {
    it('should save a full backup', async () => {
      // 准备：创建临时备份文件
      const tempArchive = path.join(testDir, 'temp-backup.tar.gz');
      await fs.writeFile(tempArchive, 'test backup content');

      // 执行：保存备份
      const backupId = await manager.save(BackupType.Full, tempArchive, {
        checksum: 'abc123',
        originalSize: 1000,
        compressedSize: 500,
        compressionRatio: 50,
        fileCount: 10,
        levels: ['level-1-hot', 'level-2-warm']
      });

      // 验证：备份 ID 格式
      expect(backupId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*_full_[a-f0-9]{8}$/);

      // 验证：备份文件被移动到正确位置
      const backupPath = path.join(testDir, 'full', `${backupId}.tar.gz`);
      const backupExists = await fs.access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      // 验证：manifest 已更新
      const backups = await manager.list();
      expect(backups.length).toBe(1);
      expect(backups[0].id).toBe(backupId);
      expect(backups[0].type).toBe(BackupType.Full);
    });

    it('should save an incremental backup', async () => {
      // 准备：创建临时备份文件
      const tempArchive = path.join(testDir, 'temp-backup.tar.gz');
      await fs.writeFile(tempArchive, 'test backup content');

      // 执行：保存增量备份
      const backupId = await manager.save(BackupType.Incremental, tempArchive, {
        checksum: 'def456',
        originalSize: 500,
        compressedSize: 250,
        compressionRatio: 50,
        fileCount: 5,
        levels: ['level-2-warm'],
        baselineId: 'baseline-backup-id'
      });

      // 验证：备份 ID 格式
      expect(backupId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*_incremental_[a-f0-9]{8}$/);

      // 验证：备份文件被移动到增量目录
      const backupPath = path.join(testDir, 'incremental', `${backupId}.tar.gz`);
      const backupExists = await fs.access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      // 验证：基线 ID 已保存
      const backups = await manager.list();
      expect(backups[0].baselineId).toBe('baseline-backup-id');
    });

    it('should update manifest after save', async () => {
      // 准备：创建临时备份文件
      const tempArchive = path.join(testDir, 'temp-backup.tar.gz');
      await fs.writeFile(tempArchive, 'test backup content');

      // 执行：保存备份
      await manager.save(BackupType.Full, tempArchive, {
        checksum: 'abc123',
        originalSize: 1000,
        compressedSize: 500,
        compressionRatio: 50,
        fileCount: 10,
        levels: ['level-1-hot']
      });

      // 验证：manifest 包含新备份
      const manifestContent = await fs.readFile(
        path.join(testDir, 'manifest.json'),
        'utf-8'
      );
      const manifest = JSON.parse(manifestContent);

      expect(manifest.backups.length).toBe(1);
      expect(manifest.lastUpdated).toBeDefined();
    });
  });

  describe('load()', () => {
    it('should load a backup by ID', async () => {
      // 准备：保存一个备份
      const tempArchive = path.join(testDir, 'temp-backup.tar.gz');
      await fs.writeFile(tempArchive, 'test backup content');

      const backupId = await manager.save(BackupType.Full, tempArchive, {
        checksum: 'abc123',
        originalSize: 1000,
        compressedSize: 500,
        compressionRatio: 50,
        fileCount: 10,
        levels: ['level-1-hot']
      });

      // 执行：加载备份
      const { path: archivePath, metadata } = await manager.load(backupId);

      // 验证：返回的路径和元数据
      expect(archivePath).toContain(backupId);
      expect(metadata.id).toBe(backupId);
      expect(metadata.checksum).toBe('abc123');
      expect(metadata.fileCount).toBe(10);
    });

    it('should throw error for non-existent backup', async () => {
      // 执行 & 验证：加载不存在的备份应该抛出错误
      await expect(manager.load('non-existent-id')).rejects.toThrow('Backup not found');
    });
  });

  describe('list()', () => {
    it('should list all backups', async () => {
      // 准备：保存多个备份
      for (let i = 0; i < 3; i++) {
        const tempArchive = path.join(testDir, `temp-backup-${i}.tar.gz`);
        await fs.writeFile(tempArchive, `backup ${i}`);
        await manager.save(BackupType.Full, tempArchive, {
          checksum: `checksum-${i}`,
          originalSize: 1000,
          compressedSize: 500,
          compressionRatio: 50,
          fileCount: 10,
          levels: ['level-1-hot']
        });
      }

      // 执行：列出所有备份
      const backups = await manager.list();

      // 验证：返回所有备份
      expect(backups.length).toBe(3);
      expect(backups[0].createdAt).toBeDefined();
    });

    it('should filter backups by type', async () => {
      // 准备：保存不同类型的备份
      const tempFull = path.join(testDir, 'temp-full.tar.gz');
      const tempIncremental = path.join(testDir, 'temp-incremental.tar.gz');

      await fs.writeFile(tempFull, 'full backup');
      await fs.writeFile(tempIncremental, 'incremental backup');

      await manager.save(BackupType.Full, tempFull, {
        checksum: 'full-checksum',
        originalSize: 1000,
        compressedSize: 500,
        compressionRatio: 50,
        fileCount: 10,
        levels: ['level-1-hot']
      });

      await manager.save(BackupType.Incremental, tempIncremental, {
        checksum: 'incremental-checksum',
        originalSize: 500,
        compressedSize: 250,
        compressionRatio: 50,
        fileCount: 5,
        levels: ['level-2-warm']
      });

      // 执行：过滤全量备份
      const fullBackups = await manager.list({ type: BackupType.Full });

      // 验证：只返回全量备份
      expect(fullBackups.length).toBe(1);
      expect(fullBackups[0].type).toBe(BackupType.Full);
    });

    it('should sort backups by creation time descending', async () => {
      // 准备：保存多个备份（有时间间隔）
      const backupIds: string[] = [];

      for (let i = 0; i < 3; i++) {
        const tempArchive = path.join(testDir, `temp-backup-${i}.tar.gz`);
        await fs.writeFile(tempArchive, `backup ${i}`);
        const id = await manager.save(BackupType.Full, tempArchive, {
          checksum: `checksum-${i}`,
          originalSize: 1000,
          compressedSize: 500,
          compressionRatio: 50,
          fileCount: 10,
          levels: ['level-1-hot']
        });
        backupIds.push(id);

        // 等待一小段时间确保时间戳不同
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 执行：列出所有备份
      const backups = await manager.list();

      // 验证：按时间降序排列（最新的在前）
      expect(backups[0].id).toBe(backupIds[2]);
      expect(backups[1].id).toBe(backupIds[1]);
      expect(backups[2].id).toBe(backupIds[0]);
    });
  });

  describe('delete()', () => {
    it('should delete a backup', async () => {
      // 准备：保存一个备份
      const tempArchive = path.join(testDir, 'temp-backup.tar.gz');
      await fs.writeFile(tempArchive, 'test backup content');

      const backupId = await manager.save(BackupType.Full, tempArchive, {
        checksum: 'abc123',
        originalSize: 1000,
        compressedSize: 500,
        compressionRatio: 50,
        fileCount: 10,
        levels: ['level-1-hot']
      });

      // 执行：删除备份
      await manager.delete(backupId);

      // 验证：备份文件已删除
      const backupPath = path.join(testDir, 'full', `${backupId}.tar.gz`);
      const backupExists = await fs.access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(false);

      // 验证：manifest 已更新
      const backups = await manager.list();
      expect(backups.length).toBe(0);
    });

    it('should throw error for non-existent backup', async () => {
      // 执行 & 验证：删除不存在的备份应该抛出错误
      await expect(manager.delete('non-existent-id')).rejects.toThrow('Backup not found');
    });
  });

  describe('applyRetentionPolicy()', () => {
    it('should keep last N full backups', async () => {
      // 准备：创建 10 个全量备份
      const backupIds: string[] = [];

      for (let i = 0; i < 10; i++) {
        const tempArchive = path.join(testDir, `temp-backup-${i}.tar.gz`);
        await fs.writeFile(tempArchive, `backup ${i}`);
        const id = await manager.save(BackupType.Full, tempArchive, {
          checksum: `checksum-${i}`,
          originalSize: 1000,
          compressedSize: 500,
          compressionRatio: 50,
          fileCount: 10,
          levels: ['level-1-hot']
        });
        backupIds.push(id);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 执行：应用保留策略（保留最近 7 个）
      const deleted = await manager.applyRetentionPolicy({
        keepLastFullBackups: 7,
        keepIncrementalDays: 30,
        keepMonthlyBackups: 12,
        maxAgeDays: 365
      });

      // 验证：删除了 3 个旧备份
      expect(deleted.length).toBe(3);

      // 验证：只保留了 7 个备份
      const remaining = await manager.list({ type: BackupType.Full });
      expect(remaining.length).toBe(7);
    });

    it('should delete old incremental backups', async () => {
      // 准备：创建增量备份（模拟旧备份）
      const tempArchive = path.join(testDir, 'temp-backup.tar.gz');
      await fs.writeFile(tempArchive, 'backup');

      // 保存一个备份
      const backupId = await manager.save(BackupType.Incremental, tempArchive, {
        checksum: 'checksum',
        originalSize: 500,
        compressedSize: 250,
        compressionRatio: 50,
        fileCount: 5,
        levels: ['level-2-warm']
      });

      // 修改备份的创建时间为 60 天前
      const manifestPath = path.join(testDir, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      manifest.backups[0].createdAt = oldDate.toISOString();

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // 执行：应用保留策略（保留 30 天）
      const deleted = await manager.applyRetentionPolicy({
        keepLastFullBackups: 7,
        keepIncrementalDays: 30,
        keepMonthlyBackups: 12,
        maxAgeDays: 365
      });

      // 验证：旧增量备份被删除
      expect(deleted.length).toBe(1);
      expect(deleted[0]).toBe(backupId);
    });
  });

  describe('getStorageStats()', () => {
    it('should calculate storage statistics', async () => {
      // 准备：保存多个备份
      for (let i = 0; i < 5; i++) {
        const tempArchive = path.join(testDir, `temp-backup-${i}.tar.gz`);
        await fs.writeFile(tempArchive, `backup ${i}`.repeat(100));

        const type = i < 3 ? BackupType.Full : BackupType.Incremental;

        await manager.save(type, tempArchive, {
          checksum: `checksum-${i}`,
          originalSize: 1000 + i * 100,
          compressedSize: 500 + i * 50,
          compressionRatio: 50,
          fileCount: 10 + i,
          levels: ['level-1-hot']
        });
      }

      // 执行：获取统计信息
      const stats = await manager.getStorageStats();

      // 验证：统计数据
      expect(stats.totalBackups).toBe(5);
      expect(stats.fullBackups).toBe(3);
      expect(stats.incrementalBackups).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.avgCompressionRatio).toBe(50);
      expect(stats.oldestBackup).toBeDefined();
      expect(stats.latestBackup).toBeDefined();
    });

    it('should return zero stats for empty storage', async () => {
      // 执行：获取空存储的统计信息
      const stats = await manager.getStorageStats();

      // 验证：所有统计为 0 或 undefined
      expect(stats.totalBackups).toBe(0);
      expect(stats.fullBackups).toBe(0);
      expect(stats.incrementalBackups).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestBackup).toBeUndefined();
      expect(stats.latestBackup).toBeUndefined();
    });
  });
});
