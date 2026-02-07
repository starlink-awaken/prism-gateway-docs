/**
 * PRISM-Gateway Storage Manager
 *
 * @module infrastructure/backup/StorageManager
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  BackupType,
  BackupStatus,
  BackupMetadata,
  BackupFilter,
  BackupManifest,
  RetentionPolicy,
  StorageStats
} from './types.js';

/**
 * Storage manager for backup organization and retention
 */
export class StorageManager {
  private backupRoot: string;
  private manifestPath: string;
  private manifest: BackupManifest | null = null;

  constructor(backupRoot: string) {
    this.backupRoot = backupRoot;
    this.manifestPath = path.join(backupRoot, 'manifest.json');
  }

  /**
   * Initialize storage structure
   */
  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.backupRoot, 'full'), { recursive: true });
    await fs.mkdir(path.join(this.backupRoot, 'incremental'), { recursive: true });

    const exists = await fs.access(this.manifestPath).then(() => true).catch(() => false);
    if (!exists) {
      const initialManifest: BackupManifest = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        backups: [],
        retention: {
          keepLastFullBackups: 7,
          keepIncrementalDays: 30,
          keepMonthlyBackups: 12,
          maxAgeDays: 365
        }
      };
      await fs.writeFile(this.manifestPath, JSON.stringify(initialManifest, null, 2));
      this.manifest = initialManifest;
    }
  }

  /**
   * Save backup metadata
   */
  async save(
    type: BackupType,
    archivePath: string,
    metadata: Partial<BackupMetadata>
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = this.generateUUID();
    const backupId = `${timestamp}_${type}_${uuid}`;

    const targetDir = path.join(this.backupRoot, type);
    const targetPath = path.join(targetDir, `${backupId}.tar.gz`);

    await fs.rename(archivePath, targetPath);

    const fullMetadata: BackupMetadata = {
      id: backupId,
      type,
      status: 'completed' as BackupStatus,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      archivePath: targetPath,
      checksum: metadata.checksum || '',
      originalSize: metadata.originalSize || 0,
      compressedSize: metadata.compressedSize || 0,
      compressionRatio: metadata.compressionRatio || 0,
      fileCount: metadata.fileCount || 0,
      levels: metadata.levels || [],
      ...(metadata.baselineId && { baselineId: metadata.baselineId }),
      ...(metadata.error && { error: metadata.error })
    };

    await this.updateManifest(manifest => {
      manifest.backups.push(fullMetadata);
      manifest.lastUpdated = new Date().toISOString();
    });

    return backupId;
  }

  /**
   * Load backup metadata
   */
  async load(backupId: string): Promise<{ path: string; metadata: BackupMetadata }> {
    const manifest = await this.getManifest();
    const metadata = manifest.backups.find(b => b.id === backupId);

    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const exists = await fs.access(metadata.archivePath).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`Backup file not found: ${metadata.archivePath}`);
    }

    return { path: metadata.archivePath, metadata };
  }

  /**
   * List backups with optional filtering
   */
  async list(filter?: BackupFilter): Promise<BackupMetadata[]> {
    const manifest = await this.getManifest();
    let backups = manifest.backups;

    if (filter) {
      if (filter.type) {
        backups = backups.filter(b => b.type === filter.type);
      }
      if (filter.status) {
        backups = backups.filter(b => b.status === filter.status);
      }
      if (filter.startDate) {
        backups = backups.filter(b => b.createdAt >= filter.startDate!);
      }
      if (filter.endDate) {
        backups = backups.filter(b => b.createdAt <= filter.endDate!);
      }
      if (filter.level) {
        backups = backups.filter(b => b.levels.includes(filter.level!));
      }
    }

    return backups.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Delete backup
   */
  async delete(backupId: string): Promise<void> {
    const manifest = await this.getManifest();
    const backup = manifest.backups.find(b => b.id === backupId);

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    try {
      await fs.unlink(backup.archivePath);
    } catch (error) {
      console.warn(`Failed to delete backup file: ${backup.archivePath}`);
    }

    await this.updateManifest(manifest => {
      manifest.backups = manifest.backups.filter(b => b.id !== backupId);
      manifest.lastUpdated = new Date().toISOString();
    });
  }

  /**
   * Apply retention policy
   */
  async applyRetentionPolicy(policy?: RetentionPolicy): Promise<string[]> {
    const manifest = await this.getManifest();
    const effectivePolicy = policy || manifest.retention;
    const deletedIds: string[] = [];

    const now = Date.now();
    const fullBackups = manifest.backups
      .filter(b => b.type === 'full')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const incrementalBackups = manifest.backups
      .filter(b => b.type === 'incremental')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const fullToDelete = fullBackups.slice(effectivePolicy.keepLastFullBackups);

    const incrementalCutoff = now - effectivePolicy.keepIncrementalDays * 24 * 60 * 60 * 1000;
    const incrementalToDelete = incrementalBackups.filter(
      b => new Date(b.createdAt).getTime() < incrementalCutoff
    );

    const maxAgeCutoff = now - effectivePolicy.maxAgeDays * 24 * 60 * 60 * 1000;
    const tooOld = manifest.backups.filter(
      b => new Date(b.createdAt).getTime() < maxAgeCutoff
    );

    const toDelete = new Set([
      ...fullToDelete.map(b => b.id),
      ...incrementalToDelete.map(b => b.id),
      ...tooOld.map(b => b.id)
    ]);

    for (const backupId of toDelete) {
      try {
        await this.delete(backupId);
        deletedIds.push(backupId);
      } catch (error) {
        console.error(`Failed to delete backup ${backupId}:`, error);
      }
    }

    return deletedIds;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const manifest = await this.getManifest();
    const backups = manifest.backups;

    const fullBackups = backups.filter(b => b.type === 'full');
    const incrementalBackups = backups.filter(b => b.type === 'incremental');

    const totalSize = backups.reduce((sum, b) => sum + b.compressedSize, 0);
    const avgCompressionRatio = backups.length > 0
      ? backups.reduce((sum, b) => sum + b.compressionRatio, 0) / backups.length
      : 0;

    const sortedByDate = backups.slice().sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      totalBackups: backups.length,
      fullBackups: fullBackups.length,
      incrementalBackups: incrementalBackups.length,
      totalSize,
      oldestBackup: sortedByDate[0]?.createdAt,
      latestBackup: sortedByDate[sortedByDate.length - 1]?.createdAt,
      avgCompressionRatio
    };
  }

  private async getManifest(): Promise<BackupManifest> {
    if (!this.manifest) {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(content);
    }
    return this.manifest!;
  }

  private async updateManifest(updater: (manifest: BackupManifest) => void): Promise<void> {
    const manifest = await this.getManifest();
    updater(manifest);
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
    this.manifest = manifest;
  }

  private generateUUID(): string {
    return 'xxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  }
}
