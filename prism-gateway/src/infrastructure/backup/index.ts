/**
 * PRISM-Gateway Backup Infrastructure Module
 *
 * @module infrastructure/backup
 */

export { BackupService } from './BackupService.js';
export { BackupEngine } from './BackupEngine.js';
export { StorageManager } from './StorageManager.js';
export { BackupScheduler } from './BackupScheduler.js';

export type {
  BackupConfig,
  BackupMetadata,
  BackupFilter,
  BackupStats,
  VerifyResult,
  RestoreOptions,
  StorageStats,
  FileDiff,
  CompressResult,
  BackupManifest,
  RetentionPolicy,
  ScheduleConfig
} from './types.js';

export { BackupType, BackupStatus } from './types.js';
