/**
 * PRISM-Gateway Backup Infrastructure Module
 *
 * @module infrastructure/backup
 */

// Core service
export { BackupService } from './BackupService.js';

// Components
export { BackupEngine } from './BackupEngine.js';
export { StorageManager } from './StorageManager.js';
export { BackupScheduler } from './BackupScheduler.js';

// Types
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
