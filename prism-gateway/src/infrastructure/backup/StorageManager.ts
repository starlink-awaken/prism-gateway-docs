/**
 * PRISM-Gateway Storage Manager
 *
 * @description
 * 存储管理器，负责备份文件的组织、索引、清理和保留策略管理
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
import { readJSON, writeJSON, fileExists } from '../../utils/file.js';

/**
 * 存储管理器
 *
 * @description
 * 管理备份文件的生命周期：
 * - 保存新备份并更新索引
 * - 加载备份元数据
 * - 列出和过滤备份
 * - 应用保留策略自动清理
 * - 计算存储统计信息
 */
export class StorageManager {
  /** 备份根目录（~/.prism-gateway/backups/） */
  private backupRoot: string;

  /** Manifest文件路径 */
  private manifestPath: string;

  /** 内存缓存的manifest */
  private manifest: BackupManifest | null = null;

  /**
   * 构造函数
   *
   * @param backupRoot - 备份根目录路径
   */
  constructor(backupRoot: string) {
    this.backupRoot = backupRoot;
    this.manifestPath = path.join(backupRoot, 'manifest.json');
  }

  /**
   * 初始化存储管理器
   *
   * @description
   * 创建必要的目录结构并初始化 manifest
   */
  async initialize(): Promise<void> {
    // 创建目录结构
    await fs.mkdir(path.join(this.backupRoot, 'full'), { recursive: true });
    await fs.mkdir(path.join(this.backupRoot, 'incremental'), {
      recursive: true
    });

    // 初始化 manifest
    if (!(await fileExists(this.manifestPath))) {
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
      await writeJSON(this.manifestPath, initialManifest);
      this.manifest = initialManifest;
    }
  }

  /**
   * 保存备份
   *
   * @param type - 备份类型（full, incremental）
   * @param archivePath - 压缩文件路径
   * @param metadata - 元数据
   * @returns 备份ID
   *
   * @example
   * ```typescript
   * const manager = new StorageManager('/backups');
   * const backupId = await manager.save('full', '/tmp/backup.tar.gz', {
   *   ...metadata
   * });
   * ```
   */
  async save(
    type: BackupType,
    archivePath: string,
    metadata: Partial<BackupMetadata>
  ): Promise<string> {
    // 生成备份ID：timestamp_type_uuid
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = this.generateUUID();
    const backupId = `${timestamp}_${type}_${uuid}`;

    // 确定目标路径
    const targetDir = path.join(this.backupRoot, type);
    const targetPath = path.join(targetDir, `${backupId}.tar.gz`);

    // 移动压缩文件
    await fs.rename(archivePath, targetPath);

    // 创建完整的元数据
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

    // 更新 manifest
    await this.updateManifest((manifest) => {
      manifest.backups.push(fullMetadata);
      manifest.lastUpdated = new Date().toISOString();
    });

    return backupId;
  }

  /**
   * 加载备份
   *
   * @param backupId - 备份ID
   * @returns 备份文件路径和元数据
   * @throws 如果备份不存在
   *
   * @example
   * ```typescript
   * const manager = new StorageManager('/backups');
   * const { path, metadata } = await manager.load('backup-id-123');
   * ```
   */
  async load(
    backupId: string
  ): Promise<{ path: string; metadata: BackupMetadata }> {
    const manifest = await this.getManifest();
    const metadata = manifest.backups.find((b) => b.id === backupId);

    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // 验证文件存在
    if (!(await fileExists(metadata.archivePath))) {
      throw new Error(`Backup file not found: ${metadata.archivePath}`);
    }

    return {
      path: metadata.archivePath,
      metadata
    };
  }

  /**
   * 列出备份
   *
   * @param filter - 过滤条件（可选）
   * @returns 备份列表
   *
   * @example
   * ```typescript
   * const manager = new StorageManager('/backups');
   *
   * // 列出所有备份
   * const all = await manager.list();
   *
   * // 列出全量备份
   * const fullBackups = await manager.list({ type: BackupType.Full });
   *
   * // 列出最近7天的备份
   * const recent = await manager.list({
   *   startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
   * });
   * ```
   */
  async list(filter?: BackupFilter): Promise<BackupMetadata[]> {
    const manifest = await this.getManifest();
    let backups = manifest.backups;

    // 应用过滤条件
    if (filter) {
      if (filter.type) {
        backups = backups.filter((b) => b.type === filter.type);
      }

      if (filter.status) {
        backups = backups.filter((b) => b.status === filter.status);
      }

      if (filter.startDate) {
        backups = backups.filter((b) => b.createdAt >= filter.startDate!);
      }

      if (filter.endDate) {
        backups = backups.filter((b) => b.createdAt <= filter.endDate!);
      }

      if (filter.level) {
        backups = backups.filter((b) => b.levels.includes(filter.level!));
      }
    }

    // 按创建时间降序排列
    return backups.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * 删除备份
   *
   * @param backupId - 备份ID
   *
   * @example
   * ```typescript
   * const manager = new StorageManager('/backups');
   * await manager.delete('backup-id-123');
   * ```
   */
  async delete(backupId: string): Promise<void> {
    const manifest = await this.getManifest();
    const backup = manifest.backups.find((b) => b.id === backupId);

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // 删除备份文件
    try {
      await fs.unlink(backup.archivePath);
    } catch (error) {
      // 文件可能已被删除，继续删除元数据
      console.warn(`Failed to delete backup file: ${backup.archivePath}`);
    }

    // 从 manifest 移除
    await this.updateManifest((manifest) => {
      manifest.backups = manifest.backups.filter((b) => b.id !== backupId);
      manifest.lastUpdated = new Date().toISOString();
    });
  }

  /**
   * 应用保留策略
   *
   * @param policy - 保留策略（可选，使用 manifest 中的策略）
   * @returns 删除的备份ID列表
   *
   * @remarks
   * 保留策略优先级：
   * 1. 保留最近N个全量备份
   * 2. 保留最近N天的增量备份
   * 3. 保留每月一个备份
   * 4. 删除超过最大天数的备份
   *
   * @example
   * ```typescript
   * const manager = new StorageManager('/backups');
   * const deleted = await manager.applyRetentionPolicy();
   * console.log(`Deleted ${deleted.length} old backups`);
   * ```
   */
  async applyRetentionPolicy(policy?: RetentionPolicy): Promise<string[]> {
    const manifest = await this.getManifest();
    const effectivePolicy = policy || manifest.retention;
    const deletedIds: string[] = [];

    const now = Date.now();
    const fullBackups = manifest.backups
      .filter((b) => b.type === 'full')
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const incrementalBackups = manifest.backups
      .filter((b) => b.type === 'incremental')
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    // 1. 保留最近N个全量备份
    const fullToDelete = fullBackups.slice(effectivePolicy.keepLastFullBackups);

    // 2. 保留最近N天的增量备份
    const incrementalCutoff =
      now - effectivePolicy.keepIncrementalDays * 24 * 60 * 60 * 1000;
    const incrementalToDelete = incrementalBackups.filter(
      (b) => new Date(b.createdAt).getTime() < incrementalCutoff
    );

    // 3. 应用最大天数限制
    const maxAgeCutoff =
      now - effectivePolicy.maxAgeDays * 24 * 60 * 60 * 1000;
    const tooOld = manifest.backups.filter(
      (b) => new Date(b.createdAt).getTime() < maxAgeCutoff
    );

    // 合并要删除的备份（去重）
    const toDelete = new Set([
      ...fullToDelete.map((b) => b.id),
      ...incrementalToDelete.map((b) => b.id),
      ...tooOld.map((b) => b.id)
    ]);

    // 执行删除
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
   * 计算存储统计
   *
   * @returns 存储使用情况
   *
   * @example
   * ```typescript
   * const manager = new StorageManager('/backups');
   * const stats = await manager.getStorageStats();
   * console.log(`Total backups: ${stats.totalBackups}`);
   * console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
   * ```
   */
  async getStorageStats(): Promise<StorageStats> {
    const manifest = await this.getManifest();
    const backups = manifest.backups;

    const fullBackups = backups.filter((b) => b.type === 'full');
    const incrementalBackups = backups.filter((b) => b.type === 'incremental');

    const totalSize = backups.reduce((sum, b) => sum + b.compressedSize, 0);
    const avgCompressionRatio =
      backups.length > 0
        ? backups.reduce((sum, b) => sum + b.compressionRatio, 0) /
          backups.length
        : 0;

    const sortedByDate = backups
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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

  /**
   * 获取 manifest
   *
   * @returns Backup manifest
   * @internal
   */
  private async getManifest(): Promise<BackupManifest> {
    if (!this.manifest) {
      this.manifest = await readJSON<BackupManifest>(this.manifestPath);
    }
    return this.manifest;
  }

  /**
   * 更新 manifest
   *
   * @param updater - 更新函数
   * @internal
   */
  private async updateManifest(
    updater: (manifest: BackupManifest) => void
  ): Promise<void> {
    const manifest = await this.getManifest();
    updater(manifest);
    await writeJSON(this.manifestPath, manifest);
    this.manifest = manifest; // 更新缓存
  }

  /**
   * 生成简单的UUID（用于备份ID）
   *
   * @returns UUID字符串
   * @internal
   */
  private generateUUID(): string {
    return 'xxxxxxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }
}
