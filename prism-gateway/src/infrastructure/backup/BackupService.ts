/**
 * PRISM-Gateway Backup Service
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
  RestoreOptions
} from './types.js';

/**
 * Backup service providing unified API
 */
export class BackupService {
  private engine: BackupEngine;
  private storageManager: StorageManager;
  private scheduler: BackupScheduler;
  private config: BackupConfig;
  private initialized: boolean;

  constructor(config?: Partial<BackupConfig>) {
    const defaultDataRoot = path.join(homedir(), '.prism-gateway');
    const defaultBackupRoot = path.join(defaultDataRoot, 'backups');

    this.config = {
      backupRoot: config?.backupRoot || defaultBackupRoot,
      dataRoot: config?.dataRoot || defaultDataRoot,
      includeLevels: config?.includeLevels || ['level-1-hot', 'level-2-warm', 'level-3-cold'],
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
   * Initialize backup service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.storageManager.initialize();

    if (this.config.schedule) {
      await this.scheduler.start(this.config.schedule);
    }

    this.initialized = true;
    console.log('[BackupService] Backup service initialized');
  }

  /**
   * Create backup
   */
  async createBackup(type: BackupType): Promise<string> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    console.log(`[BackupService] Starting ${type} backup...`);
    const startTime = Date.now();

    try {
      const tempDir = path.join(this.config.backupRoot, 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      const tempBackupDir = path.join(tempDir, `backup-${Date.now()}`);
      await fs.mkdir(tempBackupDir, { recursive: true });

      let baselineId: string | undefined;
      let filesToBackup: string[] = [];

      if (type === 'full') {
        for (const level of this.config.includeLevels) {
          const sourcePath = path.join(this.config.dataRoot, level);
          const destPath = path.join(tempBackupDir, level);
          await this.engine.copyTree(sourcePath, destPath);
        }
        filesToBackup = this.config.includeLevels;
      } else {
        const backups = await this.storageManager.list({ type: 'full' });
        if (backups.length === 0) {
          throw new Error('No full backup found for incremental backup');
        }

        const lastFullBackup = backups[0];
        baselineId = lastFullBackup.id;

        const baselineDir = path.join(tempDir, `baseline-${Date.now()}`);
        await this.engine.decompress(lastFullBackup.archivePath, baselineDir);

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

        await fs.rm(baselineDir, { recursive: true, force: true });
      }

      const archivePath = path.join(tempDir, `${type}-${Date.now()}.tar.gz`);
      const compressResult = await this.engine.compress(tempBackupDir, archivePath);

      const checksum = await this.engine.checksum(archivePath, this.config.checksumAlgorithm);

      const backupId = await this.storageManager.save(type, archivePath, {
        checksum,
        originalSize: compressResult.originalSize,
        compressedSize: compressResult.compressedSize,
        compressionRatio: compressResult.compressionRatio,
        fileCount: compressResult.fileCount,
        levels: filesToBackup,
        ...(baselineId && { baselineId })
      });

      await fs.rm(tempBackupDir, { recursive: true, force: true });

      const duration = Date.now() - startTime;
      console.log(`[BackupService] ${type} backup completed: ${backupId} (${duration}ms)`);

      return backupId;
    } catch (error) {
      console.error(`[BackupService] Backup failed:`, error);
      throw error;
    }
  }

  /**
   * Restore backup
   */
  async restoreBackup(backupId: string, options: RestoreOptions): Promise<void> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    console.log(`[BackupService] Restoring backup: ${backupId}`);
    const startTime = Date.now();

    try {
      const { path: archivePath, metadata } = await this.storageManager.load(backupId);

      if (options.verifyChecksum) {
        const checksum = await this.engine.checksum(archivePath, this.config.checksumAlgorithm);
        if (checksum !== metadata.checksum) {
          throw new Error('Checksum mismatch - backup may be corrupted');
        }
      }

      const tempDir = path.join(this.config.backupRoot, 'temp', `restore-${Date.now()}`);
      await this.engine.decompress(archivePath, tempDir);

      if (metadata.type === 'incremental' && metadata.baselineId) {
        console.log(`[BackupService] Restoring baseline: ${metadata.baselineId}`);
        await this.restoreBackup(metadata.baselineId, {
          ...options,
          verifyChecksum: false
        });
      }

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

      await fs.rm(tempDir, { recursive: true, force: true });

      const duration = Date.now() - startTime;
      console.log(`[BackupService] Restore completed (${duration}ms)`);
    } catch (error) {
      console.error(`[BackupService] Restore failed:`, error);
      throw error;
    }
  }

  /**
   * List backups
   */
  async listBackups(filter?: BackupFilter): Promise<BackupMetadata[]> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    return this.storageManager.list(filter);
  }

  /**
   * Verify backup
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
      const { path: archivePath, metadata } = await this.storageManager.load(backupId);

      if (!(await this.pathExists(archivePath))) {
        errors.push('Backup file not found');
        fileIntegrity = false;
      }

      try {
        const checksum = await this.engine.checksum(archivePath, this.config.checksumAlgorithm);
        if (checksum !== metadata.checksum) {
          errors.push('Checksum mismatch');
          checksumMatch = false;
        }
      } catch (error) {
        errors.push(`Checksum calculation failed: ${error}`);
        checksumMatch = false;
      }

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
   * Get backup statistics
   */
  async getBackupStats(): Promise<BackupStats> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    const storage = await this.storageManager.getStorageStats();
    const backups = await this.storageManager.list();

    const lastFullBackup = backups.find(b => b.type === 'full');
    const lastIncrementalBackup = backups.find(b => b.type === 'incremental');

    const completedBackups = backups.filter(
      b => b.completedAt && b.status === 'completed'
    );
    const avgBackupDuration = completedBackups.length > 0
      ? completedBackups.reduce((sum, b) => {
          const duration = new Date(b.completedAt!).getTime() - new Date(b.createdAt).getTime();
          return sum + duration;
        }, 0) / completedBackups.length / 1000
      : 0;

    const successRate = backups.length > 0
      ? (backups.filter(b => b.status === 'completed').length / backups.length) * 100
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
   * Apply retention policy
   */
  async applyRetentionPolicy(): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('Backup service not initialized');
    }

    return this.storageManager.applyRetentionPolicy();
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.scheduler.stop();
    this.initialized = false;
    console.log('[BackupService] Backup service stopped');
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
