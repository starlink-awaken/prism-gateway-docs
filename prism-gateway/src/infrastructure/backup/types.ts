/**
 * PRISM-Gateway Backup Service Types
 *
 * @module infrastructure/backup/types
 */

/**
 * Backup type
 */
export enum BackupType {
  Full = 'full',
  Incremental = 'incremental'
}

/**
 * Backup status
 */
export enum BackupStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Corrupted = 'corrupted'
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  backupRoot: string;
  dataRoot: string;
  includeLevels: ('level-1-hot' | 'level-2-warm' | 'level-3-cold')[];
  compression: 'gzip' | 'brotli' | 'none';
  compressionLevel: number;
  checksumAlgorithm: 'sha256' | 'md5';
  retention: RetentionPolicy;
  schedule?: ScheduleConfig;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  id: string;
  type: BackupType;
  status: BackupStatus;
  createdAt: string;
  completedAt?: string;
  baselineId?: string;
  archivePath: string;
  checksum: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  fileCount: number;
  error?: string;
  levels: string[];
}

/**
 * Retention policy
 */
export interface RetentionPolicy {
  keepLastFullBackups: number;
  keepIncrementalDays: number;
  keepMonthlyBackups: number;
  maxAgeDays: number;
}

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  fullBackup: string;
  incrementalBackup: string;
  cleanup: string;
}

/**
 * File difference
 */
export interface FileDiff {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  size: number;
  mtime: Date;
  checksum?: string;
}

/**
 * Compression result
 */
export interface CompressResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  fileCount: number;
  duration: number;
}

/**
 * Backup filter
 */
export interface BackupFilter {
  type?: BackupType;
  status?: BackupStatus;
  startDate?: string;
  endDate?: string;
  level?: string;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalBackups: number;
  fullBackups: number;
  incrementalBackups: number;
  totalSize: number;
  oldestBackup?: string;
  latestBackup?: string;
  avgCompressionRatio: number;
}

/**
 * Backup manifest
 */
export interface BackupManifest {
  version: string;
  lastUpdated: string;
  backups: BackupMetadata[];
  retention: RetentionPolicy;
}

/**
 * Verification result
 */
export interface VerifyResult {
  backupId: string;
  valid: boolean;
  fileIntegrity: boolean;
  checksumMatch: boolean;
  canDecompress: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Restore options
 */
export interface RestoreOptions {
  targetPath: string;
  overwrite: boolean;
  verifyChecksum: boolean;
  includeLevels?: string[];
}

/**
 * Backup statistics
 */
export interface BackupStats {
  storage: StorageStats;
  lastFullBackup?: BackupMetadata;
  lastIncrementalBackup?: BackupMetadata;
  avgBackupDuration: number;
  successRate: number;
}
