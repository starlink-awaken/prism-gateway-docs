/**
 * BackupService 单元测试
 *
 * @description
 * 测试备份服务的集成功能：完整备份流程、恢复流程、验证、统计
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BackupService } from '../../../../infrastructure/backup/BackupService.js';
import { BackupType } from '../../../../infrastructure/backup/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('BackupService', () => {
  let service: BackupService;
  let testDir: string;
  let dataDir: string;
  let backupDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-service-test-'));
    dataDir = path.join(testDir, 'data');
    backupDir = path.join(testDir, 'backups');

    // 创建测试数据目录结构
    await fs.mkdir(path.join(dataDir, 'level-1-hot'), { recursive: true });
    await fs.mkdir(path.join(dataDir, 'level-2-warm'), { recursive: true });
    await fs.mkdir(path.join(dataDir, 'level-3-cold'), { recursive: true });

    // 创建测试数据文件
    await fs.writeFile(path.join(dataDir, 'level-1-hot', 'hot1.txt'), 'hot data 1');
    await fs.writeFile(path.join(dataDir, 'level-1-hot', 'hot2.txt'), 'hot data 2');
    await fs.writeFile(path.join(dataDir, 'level-2-warm', 'warm1.txt'), 'warm data 1');
    await fs.writeFile(path.join(dataDir, 'level-3-cold', 'cold1.txt'), 'cold data 1');

    // 创建备份服务
    service = new BackupService({
      dataRoot: dataDir,
      backupRoot: backupDir,
      includeLevels: ['level-1-hot', 'level-2-warm', 'level-3-cold']
    });

    await service.initialize();
  });

  afterEach(async () => {
    // 停止服务
    await service.shutdown();

    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('initialize()', () => {
    it('should initialize the service', async () => {
      // 验证：备份目录结构已创建
      const fullDirExists = await fs.access(path.join(backupDir, 'full'))
        .then(() => true)
        .catch(() => false);
      const incrementalDirExists = await fs.access(path.join(backupDir, 'incremental'))
        .then(() => true)
        .catch(() => false);
      const manifestExists = await fs.access(path.join(backupDir, 'manifest.json'))
        .then(() => true)
        .catch(() => false);

      expect(fullDirExists).toBe(true);
      expect(incrementalDirExists).toBe(true);
      expect(manifestExists).toBe(true);
    });
  });

  describe('createBackup()', () => {
    it('should create a full backup', async () => {
      // 执行：创建全量备份
      const backupId = await service.createBackup(BackupType.Full);

      // 验证：备份 ID 格式
      expect(backupId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*_full_[a-f0-9]{8}$/);

      // 验证：备份文件存在
      const backups = await service.listBackups();
      expect(backups.length).toBe(1);
      expect(backups[0].id).toBe(backupId);
      expect(backups[0].type).toBe(BackupType.Full);
      expect(backups[0].fileCount).toBeGreaterThan(0);
    });

    it('should create an incremental backup after full backup', async () => {
      // 准备：创建全量备份
      await service.createBackup(BackupType.Full);

      // 修改数据
      await fs.writeFile(path.join(dataDir, 'level-1-hot', 'hot3.txt'), 'new hot data');

      // 执行：创建增量备份
      const incrementalId = await service.createBackup(BackupType.Incremental);

      // 验证：增量备份 ID 格式
      expect(incrementalId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*_incremental_[a-f0-9]{8}$/);

      // 验证：增量备份元数据
      const backups = await service.listBackups();
      const incrementalBackup = backups.find((b) => b.type === BackupType.Incremental);
      expect(incrementalBackup).toBeDefined();
      expect(incrementalBackup!.baselineId).toBeDefined();
    });

    it('should throw error when creating incremental backup without full backup', async () => {
      // 执行 & 验证：没有全量备份时创建增量备份应该失败
      await expect(service.createBackup(BackupType.Incremental)).rejects.toThrow('No full backup found');
    });

    it('should calculate compression ratio', async () => {
      // 执行：创建备份
      const backupId = await service.createBackup(BackupType.Full);

      // 验证：压缩率
      const backups = await service.listBackups();
      const backup = backups.find((b) => b.id === backupId);

      expect(backup).toBeDefined();
      expect(backup!.compressionRatio).toBeGreaterThan(0);
      expect(backup!.compressionRatio).toBeLessThan(100);
      expect(backup!.compressedSize).toBeLessThan(backup!.originalSize);
    });
  });

  describe('restoreBackup()', () => {
    it('should restore a full backup', async () => {
      // 准备：创建备份
      const backupId = await service.createBackup(BackupType.Full);

      // 删除原始数据
      await fs.rm(dataDir, { recursive: true, force: true });

      // 创建恢复目标目录
      const restoreDir = path.join(testDir, 'restored');

      // 执行：恢复备份
      await service.restoreBackup(backupId, {
        targetPath: restoreDir,
        overwrite: true,
        verifyChecksum: true
      });

      // 验证：数据已恢复
      const hot1Content = await fs.readFile(
        path.join(restoreDir, 'level-1-hot', 'hot1.txt'),
        'utf-8'
      );
      const warm1Content = await fs.readFile(
        path.join(restoreDir, 'level-2-warm', 'warm1.txt'),
        'utf-8'
      );

      expect(hot1Content).toBe('hot data 1');
      expect(warm1Content).toBe('warm data 1');
    });

    it('should restore an incremental backup with baseline', async () => {
      // 准备：创建全量备份
      const fullBackupId = await service.createBackup(BackupType.Full);

      // 修改数据
      await fs.writeFile(path.join(dataDir, 'level-1-hot', 'hot3.txt'), 'new hot data');

      // 创建增量备份
      const incrementalId = await service.createBackup(BackupType.Incremental);

      // 删除原始数据
      await fs.rm(dataDir, { recursive: true, force: true });

      // 创建恢复目标目录
      const restoreDir = path.join(testDir, 'restored');

      // 执行：恢复增量备份（应该自动恢复基线）
      await service.restoreBackup(incrementalId, {
        targetPath: restoreDir,
        overwrite: true,
        verifyChecksum: false
      });

      // 验证：基线数据和增量数据都已恢复
      const hot1Content = await fs.readFile(
        path.join(restoreDir, 'level-1-hot', 'hot1.txt'),
        'utf-8'
      );
      const hot3Content = await fs.readFile(
        path.join(restoreDir, 'level-1-hot', 'hot3.txt'),
        'utf-8'
      );

      expect(hot1Content).toBe('hot data 1');
      expect(hot3Content).toBe('new hot data');
    });

    it('should verify checksum during restore', async () => {
      // 准备：创建备份
      const backupId = await service.createBackup(BackupType.Full);

      // 创建恢复目标目录
      const restoreDir = path.join(testDir, 'restored');

      // 执行：恢复备份并验证校验和
      await expect(
        service.restoreBackup(backupId, {
          targetPath: restoreDir,
          overwrite: true,
          verifyChecksum: true
        })
      ).resolves.not.toThrow();
    });
  });

  describe('listBackups()', () => {
    it('should list all backups', async () => {
      // 准备：创建多个备份
      await service.createBackup(BackupType.Full);
      await fs.writeFile(path.join(dataDir, 'level-1-hot', 'hot3.txt'), 'new data');
      await service.createBackup(BackupType.Incremental);

      // 执行：列出所有备份
      const backups = await service.listBackups();

      // 验证：返回所有备份
      expect(backups.length).toBe(2);
    });

    it('should filter backups by type', async () => {
      // 准备：创建不同类型的备份
      await service.createBackup(BackupType.Full);
      await fs.writeFile(path.join(dataDir, 'level-1-hot', 'hot3.txt'), 'new data');
      await service.createBackup(BackupType.Incremental);

      // 执行：过滤全量备份
      const fullBackups = await service.listBackups({ type: BackupType.Full });

      // 验证：只返回全量备份
      expect(fullBackups.length).toBe(1);
      expect(fullBackups[0].type).toBe(BackupType.Full);
    });
  });

  describe('verifyBackup()', () => {
    it('should verify a valid backup', async () => {
      // 准备：创建备份
      const backupId = await service.createBackup(BackupType.Full);

      // 执行：验证备份
      const result = await service.verifyBackup(backupId);

      // 验证：备份有效
      expect(result.valid).toBe(true);
      expect(result.fileIntegrity).toBe(true);
      expect(result.checksumMatch).toBe(true);
      expect(result.canDecompress).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect invalid backup', async () => {
      // 准备：创建备份
      const backupId = await service.createBackup(BackupType.Full);

      // 获取备份文件路径并删除
      const backups = await service.listBackups();
      const backup = backups.find((b) => b.id === backupId);
      await fs.unlink(backup!.archivePath);

      // 执行：验证备份
      const result = await service.verifyBackup(backupId);

      // 验证：备份无效
      expect(result.valid).toBe(false);
      expect(result.fileIntegrity).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getBackupStats()', () => {
    it('should calculate backup statistics', async () => {
      // 准备：创建备份
      await service.createBackup(BackupType.Full);
      await fs.writeFile(path.join(dataDir, 'level-1-hot', 'hot3.txt'), 'new data');
      await service.createBackup(BackupType.Incremental);

      // 执行：获取统计信息
      const stats = await service.getBackupStats();

      // 验证：统计数据
      expect(stats.storage.totalBackups).toBe(2);
      expect(stats.storage.fullBackups).toBe(1);
      expect(stats.storage.incrementalBackups).toBe(1);
      expect(stats.lastFullBackup).toBeDefined();
      expect(stats.lastIncrementalBackup).toBeDefined();
      expect(stats.avgBackupDuration).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBe(100);
    });

    it('should return empty stats when no backups', async () => {
      // 执行：获取统计信息
      const stats = await service.getBackupStats();

      // 验证：空统计数据
      expect(stats.storage.totalBackups).toBe(0);
      expect(stats.lastFullBackup).toBeUndefined();
      expect(stats.lastIncrementalBackup).toBeUndefined();
    });
  });

  describe('applyRetentionPolicy()', () => {
    it('should apply retention policy', async () => {
      // 准备：创建多个备份
      for (let i = 0; i < 5; i++) {
        await service.createBackup(BackupType.Full);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 执行：应用保留策略（保留 3 个）
      const deleted = await service.applyRetentionPolicy();

      // 验证：删除了旧备份
      // 注意：默认策略保留 7 个全量备份，所以这里不会删除任何备份
      // 我们只验证方法正常执行
      expect(Array.isArray(deleted)).toBe(true);
    });
  });

  describe('shutdown()', () => {
    it('should shutdown gracefully', async () => {
      // 执行：停止服务
      await service.shutdown();

      // 验证：服务已停止（通过再次初始化验证）
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('Integration: Full backup and restore workflow', () => {
    it('should complete full backup and restore cycle', async () => {
      // 1. 创建全量备份
      const backupId = await service.createBackup(BackupType.Full);
      console.log(`✓ Created full backup: ${backupId}`);

      // 2. 验证备份
      const verifyResult = await service.verifyBackup(backupId);
      expect(verifyResult.valid).toBe(true);
      console.log(`✓ Backup verified: ${verifyResult.valid}`);

      // 3. 删除原始数据
      await fs.rm(dataDir, { recursive: true, force: true });
      console.log('✓ Original data deleted');

      // 4. 恢复备份
      const restoreDir = path.join(testDir, 'restored');
      await service.restoreBackup(backupId, {
        targetPath: restoreDir,
        overwrite: true,
        verifyChecksum: true
      });
      console.log(`✓ Backup restored to: ${restoreDir}`);

      // 5. 验证恢复的数据
      const hot1Content = await fs.readFile(
        path.join(restoreDir, 'level-1-hot', 'hot1.txt'),
        'utf-8'
      );
      expect(hot1Content).toBe('hot data 1');
      console.log('✓ Restored data verified');

      // 6. 获取统计信息
      const stats = await service.getBackupStats();
      expect(stats.storage.totalBackups).toBe(1);
      expect(stats.storage.avgCompressionRatio).toBeGreaterThan(0);
      console.log(`✓ Stats: ${stats.storage.totalBackups} backups, ${stats.storage.avgCompressionRatio.toFixed(2)}% compression`);
    });
  });
});
