/**
 * PRISM-Gateway Backup Service
 *
 * @description
 * 备份服务主入口，提供统一的备份和恢复接口
 *
 * @module infrastructure/backup/BackupService
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { BackupEngine } from './BackupEngine.js';
import { StorageManager } from './StorageManager.js';
import { BackupScheduler } from './BackupScheduler.js';
import type {
  BackupType,
  BackupConfig,
  BackupMetadata,
  BackupFilter,
  BackupStats,
  VerifyResult,
  RestoreOptions,
  StorageStats
} from './types.js';

/**
 * 备份服务
 *
 * @description
 * 提供完整的备份和恢复功能：
 * - 创建全量/增量备份
 * - 恢复备份
 * - 验证备份完整性
 * - 列出和管理备份
 * - 获取备份统计信息
 * - 自动调度备份任务
 *
 * @example
 * ```typescript
 * const service = new BackupService();
 * await service.initialize();
 *
 * // 创建全量备份
 * const backupId = await service.createBackup('full');
 *
 * // 列出所有备份
 * const backups = await service.listBackups();
 *
 * // 恢复备份
 * await service.restoreBackup(backupId, { targetPath: '/restore', overwrite: true });
 * ```
 */
export class BackupService {
  /** 备份引擎 */
  private engine: BackupEngine;

  /** 存储管理器 */
  private storageManager: StorageManager;

  /** 调度器 */
  private scheduler: BackupScheduler;

  /** 备份配置 */
  private config: BackupConfig;

  /** 是否已初始化 */
  private initialized: boolean;

  /**
   * 构造函数
   *
   * @param config - 备份配置（可选）
   */
  constructor(config?: Partial<BackupConfig>) {
    const defaultDataRoot = path.join(homedir(), '.prism-gateway');
    const defaultBackupRoot = path.join(defaultDataRoot, 'backups');

    this.config = {
      backupRoot: config?.backupRoot || defaultBackupRoot,
      dataRoot: config?.dataRoot || defaultDataRoot,
      includeLevels: config?.includeLevels || [
        'level-1-hot',
        'level-2-warm',
        'level-3-cold'
      ],
      compression: config?.compression || 'gzip',
      compressionLevel: config?.compressionLevel || 6,
      checksumAlgorithm: config?.checksumAlgorithm || 'sha256',
      retention: config?.retention || {
        keepLastFullBackups: 7,
        keepIncrementalDays: 30,
        keepMonthlyBackups: 12,
        maxAgeDays: 365
      },
      schedule: config?.schedule
    };

    this.engine = new BackupEngine();
    this.storageManager = new StorageManager(this.config.backupRoot);
    this.scheduler = new BackupScheduler(this);
    this.initialized = false;
  }

  /**
   * 初始化备份服务
   *
   * @description
   * 创建必要的目录结构，初始化存储管理器
   *
   * @example
   * ```typescript
   * const service = new BackupService();
   * await service.initialize();
   * ```
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 初始化存储管理器
    await this.storageManager.initialize();

    // 如果配置了调度，启动调度器
    if (this.config.schedule) {
      await this.scheduler.start(this.config.schedule);
    }

    this.initialized = true;
    console.log('[BackupService] Backup service initialized');
  }

  /**
   * 创建备份
   *
   * @param type - 备份类型（full 或 incremental）
   * @returns 备份ID
   *
   * @remarks
   * 全量备份：备份所有指定的数据层级
   * 增量备份：仅备份自上次全量备份以来的变更
   *
   * @example
   * ```typescript
   * // 创建全量备份
   * const fullBackupId = await service.createBackup('full');
   *
   * // 创建增量备份
   * const incrementalBackupId = await service.createBackup('incremental');
   * ```
   */
  async createBackup(type: BackupType): Promise<string> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    console.log(`[BackupService] Starting ${type} backup...`);
    const startTime = Date.now();

    try {
      // 创建临时目录
      const tempDir = path.join(this.config.backupRoot, 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      const tempBackupDir = path.join(tempDir, `backup-${Date.now()}`);
      await fs.mkdir(tempBackupDir, { recursive: true });

      let baselineId: string | undefined;
      let filesToBackup: string[] = [];

      if (type === 'full') {
        // 全量备份：复制所有层级
        for (const level of this.config.includeLevels) {
          const sourcePath = path.join(this.config.dataRoot, level);
          const destPath = path.join(tempBackupDir, level);
          await this.engine.copyTree(sourcePath, destPath);
        }
        filesToBackup = this.config.includeLevels;
      } else {
        // 增量备份：计算差异
        const backups = await this.storageManager.list({ type: 'full' });
        if (backups.length === 0) {
          throw new Error('No full backup found for incremental backup');
        }

        const lastFullBackup = backups[0];
        baselineId = lastFullBackup.id;

        // 解压基线备份到临时目录
        const baselineDir = path.join(tempDir, `baseline-${Date.now()}`);
        await this.engine.decompress(lastFullBackup.archivePath, baselineDir);

        // 计算每个层级的差异并复制变更文件
        for (const level of this.config.includeLevels) {
          const sourcePath = path.join(this.config.dataRoot, level);
          const baselinePath = path.join(baselineDir, level);
          const destPath = path.join(tempBackupDir, level);

          const diffs = await this.engine.diff(sourcePath, baselinePath);

          if (diffs.length > 0) {
            await fs.mkdir(destPath, { recursive: true });

            for (const diff of diffs) {
              if (diff.type !== 'deleted') {
                const sourceFile = path.join(sourcePath, diff.path);
                const destFile = path.join(destPath, diff.path);
                const destFileDir = path.dirname(destFile);

                await fs.mkdir(destFileDir, { recursive: true });
                await fs.copyFile(sourceFile, destFile);
              }
            }

            filesToBackup.push(level);
          }
        }

        // 清理基线目录
        await fs.rm(baselineDir, { recursive: true, force: true });
      }

      // 压缩备份
      const archivePath = path.join(
        tempDir,
        `${type}-${Date.now()}.tar.gz`
      );
      const compressResult = await this.engine.compress(
        tempBackupDir,
        archivePath
      );

      // 计算校验和
      const checksum = await this.engine.checksum(
        archivePath,
        this.config.checksumAlgorithm
      );

      // 保存备份
      const backupId = await this.storageManager.save(type, archivePath, {
        checksum,
        originalSize: compressResult.originalSize,
        compressedSize: compressResult.compressedSize,
        compressionRatio: compressResult.compressionRatio,
        fileCount: compressResult.fileCount,
        levels: filesToBackup,
        ...(baselineId && { baselineId })
      });

      // 清理临时目录
      await fs.rm(tempBackupDir, { recursive: true, force: true });

      const duration = Date.now() - startTime;
      console.log(
        `[BackupService] ${type} backup completed: ${backupId} (${duration}ms)`
      );

      return backupId;
    } catch (error) {
      console.error(`[BackupService] Backup failed:`, error);
      throw error;
    }
  }

  /**
   * 恢复备份
   *
   * @param backupId - 备份ID
   * @param options - 恢复选项
   *
   * @example
   * ```typescript
   * await service.restoreBackup('backup-id-123', {
   *   targetPath: '/restore',
   *   overwrite: true,
   *   verifyChecksum: true
   * });
   * ```
   */
  async restoreBackup(
    backupId: string,
    options: RestoreOptions
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    console.log(`[BackupService] Restoring backup: ${backupId}`);
    const startTime = Date.now();

    try {
      // 加载备份
      const { path: archivePath, metadata } =
        await this.storageManager.load(backupId);

      // 验证校验和（如果需要）
      if (options.verifyChecksum) {
        const checksum = await this.engine.checksum(
          archivePath,
          this.config.checksumAlgorithm
        );
        if (checksum !== metadata.checksum) {
          throw new Error('Checksum mismatch - backup may be corrupted');
        }
      }

      // 解压到目标目录
      const tempDir = path.join(this.config.backupRoot, 'temp', `restore-${Date.now()}`);
      await this.engine.decompress(archivePath, tempDir);

      // 如果是增量备份，需要先恢复基线备份
      if (metadata.type === 'incremental' && metadata.baselineId) {
        console.log(`[BackupService] Restoring baseline: ${metadata.baselineId}`);
        await this.restoreBackup(metadata.baselineId, {
          ...options,
          verifyChecksum: false // 已经验证过增量备份
        });
      }

      // 复制文件到目标位置
      const levels = options.includeLevels || metadata.levels;
      for (const level of levels) {
        const sourcePath = path.join(tempDir, level);
        const destPath = path.join(options.targetPath, level);

        if (await this.pathExists(sourcePath)) {
          if (options.overwrite) {
            await fs.rm(destPath, { recursive: true, force: true });
          }
          await this.engine.copyTree(sourcePath, destPath);
        }
      }

      // 清理临时目录
      await fs.rm(tempDir, { recursive: true, force: true });

      const duration = Date.now() - startTime;
      console.log(`[BackupService] Restore completed (${duration}ms)`);
    } catch (error) {
      console.error(`[BackupService] Restore failed:`, error);
      throw error;
    }
  }

  /**
   * 列出备份
   *
   * @param filter - 过滤条件（可选）
   * @returns 备份列表
   *
   * @example
   * ```typescript
   * const backups = await service.listBackups();
   * const fullBackups = await service.listBackups({ type: 'full' });
   * ```
   */
  async listBackups(filter?: BackupFilter): Promise<BackupMetadata[]> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    return this.storageManager.list(filter);
  }

  /**
   * 验证备份
   *
   * @param backupId - 备份ID
   * @returns 验证结果
   *
   * @example
   * ```typescript
   * const result = await service.verifyBackup('backup-id-123');
   * console.log(`Backup valid: ${result.valid}`);
   * ```
   */
  async verifyBackup(backupId: string): Promise<VerifyResult> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let fileIntegrity = true;
    let checksumMatch = true;
    let canDecompress = true;

    try {
      // 加载备份
      const { path: archivePath, metadata } =
        await this.storageManager.load(backupId);

      // 检查文件是否存在
      if (!(await this.pathExists(archivePath))) {
        errors.push('Backup file not found');
        fileIntegrity = false;
      }

      // 验证校验和
      try {
        const checksum = await this.engine.checksum(
          archivePath,
          this.config.checksumAlgorithm
        );
        if (checksum !== metadata.checksum) {
          errors.push('Checksum mismatch');
          checksumMatch = false;
        }
      } catch (error) {
        errors.push(`Checksum calculation failed: ${error}`);
        checksumMatch = false;
      }

      // 尝试解压（验证完整性）
      try {
        const tempDir = path.join(this.config.backupRoot, 'temp', `verify-${Date.now()}`);
        await this.engine.decompress(archivePath, tempDir);
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        errors.push(`Decompression failed: ${error}`);
        canDecompress = false;
      }
    } catch (error) {
      errors.push(`Verification failed: ${error}`);
    }

    const valid = errors.length === 0;

    return {
      backupId,
      valid,
      fileIntegrity,
      checksumMatch,
      canDecompress,
      errors,
      warnings
    };
  }

  /**
   * 获取备份统计信息
   *
   * @returns 备份统计
   *
   * @example
   * ```typescript
   * const stats = await service.getBackupStats();
   * console.log(`Total backups: ${stats.storage.totalBackups}`);
   * ```
   */
  async getBackupStats(): Promise<BackupStats> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    const storage = await this.storageManager.getStorageStats();
    const backups = await this.storageManager.list();

    const lastFullBackup = backups.find((b) => b.type === 'full');
    const lastIncrementalBackup = backups.find((b) => b.type === 'incremental');

    // 计算平均备份时间（基于 completedAt - createdAt）
    const completedBackups = backups.filter(
      (b) => b.completedAt && b.status === 'completed'
    );
    const avgBackupDuration =
      completedBackups.length > 0
        ? completedBackups.reduce((sum, b) => {
            const duration =
              new Date(b.completedAt!).getTime() -
              new Date(b.createdAt).getTime();
            return sum + duration;
          }, 0) /
          completedBackups.length /
          1000
        : 0;

    // 计算成功率
    const successRate =
      backups.length > 0
        ? (backups.filter((b) => b.status === 'completed').length /
            backups.length) *
          100
        : 100;

    return {
      storage,
      lastFullBackup,
      lastIncrementalBackup,
      avgBackupDuration,
      successRate
    };
  }

  /**
   * 应用保留策略
   *
   * @returns 删除的备份ID列表
   *
   * @example
   * ```typescript
   * const deleted = await service.applyRetentionPolicy();
   * console.log(`Deleted ${deleted.length} old backups`);
   * ```
   */
  async applyRetentionPolicy(): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    return this.storageManager.applyRetentionPolicy();
  }

  /**
   * 停止备份服务
   *
   * @description
   * 停止调度器并清理资源
   *
   * @example
   * ```typescript
   * await service.shutdown();
   * ```
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.scheduler.stop();
    this.initialized = false;
    console.log('[BackupService] Backup service stopped');
  }

  /**
   * 检查路径是否存在
   *
   * @param path - 路径
   * @returns 是否存在
   * @internal
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
