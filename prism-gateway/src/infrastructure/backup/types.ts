/**
 * PRISM-Gateway Backup Service 类型定义
 *
 * @module infrastructure/backup/types
 */

/**
 * 备份类型
 */
export enum BackupType {
  /** 全量备份 */
  Full = 'full',
  /** 增量备份 */
  Incremental = 'incremental'
}

/**
 * 备份状态
 */
export enum BackupStatus {
  /** 等待中 */
  Pending = 'pending',
  /** 进行中 */
  InProgress = 'in_progress',
  /** 已完成 */
  Completed = 'completed',
  /** 失败 */
  Failed = 'failed',
  /** 损坏 */
  Corrupted = 'corrupted'
}

/**
 * 备份配置
 */
export interface BackupConfig {
  /** 备份根目录 */
  backupRoot: string;

  /** 数据源根目录 */
  dataRoot: string;

  /** 包含的数据层级 */
  includeLevels: ('level-1-hot' | 'level-2-warm' | 'level-3-cold')[];

  /** 压缩算法 */
  compression: 'gzip' | 'brotli' | 'none';

  /** 压缩级别 (1-9) */
  compressionLevel: number;

  /** 校验算法 */
  checksumAlgorithm: 'sha256' | 'md5';

  /** 保留策略 */
  retention: RetentionPolicy;

  /** 备份调度配置 */
  schedule?: ScheduleConfig;
}

/**
 * 备份元数据
 */
export interface BackupMetadata {
  /** 备份ID */
  id: string;

  /** 备份类型 */
  type: BackupType;

  /** 备份状态 */
  status: BackupStatus;

  /** 创建时间 */
  createdAt: string;

  /** 完成时间 */
  completedAt?: string;

  /** 基线备份ID（增量备份时使用） */
  baselineId?: string;

  /** 备份文件路径 */
  archivePath: string;

  /** 校验和 */
  checksum: string;

  /** 原始大小（字节） */
  originalSize: number;

  /** 压缩后大小（字节） */
  compressedSize: number;

  /** 压缩率（百分比） */
  compressionRatio: number;

  /** 备份文件数量 */
  fileCount: number;

  /** 错误信息（失败时） */
  error?: string;

  /** 备份的数据层级 */
  levels: string[];
}

/**
 * 保留策略
 */
export interface RetentionPolicy {
  /** 保留最近 N 个全量备份 */
  keepLastFullBackups: number;

  /** 保留最近 N 天的增量备份 */
  keepIncrementalDays: number;

  /** 每月保留一个月度备份 */
  keepMonthlyBackups: number;

  /** 保留所有备份的最大天数 */
  maxAgeDays: number;
}

/**
 * 调度配置
 */
export interface ScheduleConfig {
  /** 全量备份调度表达式（CRON格式） */
  fullBackup: string;

  /** 增量备份调度表达式（CRON格式） */
  incrementalBackup: string;

  /** 自动清理调度表达式（CRON格式） */
  cleanup: string;
}

/**
 * 文件差异
 */
export interface FileDiff {
  /** 文件相对路径 */
  path: string;

  /** 差异类型 */
  type: 'added' | 'modified' | 'deleted';

  /** 文件大小（字节） */
  size: number;

  /** 修改时间 */
  mtime: Date;

  /** 校验和（新文件或修改后的文件） */
  checksum?: string;
}

/**
 * 压缩结果
 */
export interface CompressResult {
  /** 压缩前大小（字节） */
  originalSize: number;

  /** 压缩后大小（字节） */
  compressedSize: number;

  /** 压缩率（百分比） */
  compressionRatio: number;

  /** 文件数量 */
  fileCount: number;

  /** 耗时（毫秒） */
  duration: number;
}

/**
 * 备份过滤条件
 */
export interface BackupFilter {
  /** 备份类型 */
  type?: BackupType;

  /** 状态 */
  status?: BackupStatus;

  /** 起始时间 */
  startDate?: string;

  /** 结束时间 */
  endDate?: string;

  /** 数据层级 */
  level?: string;
}

/**
 * 存储统计
 */
export interface StorageStats {
  /** 总备份数 */
  totalBackups: number;

  /** 全量备份数 */
  fullBackups: number;

  /** 增量备份数 */
  incrementalBackups: number;

  /** 总大小（字节） */
  totalSize: number;

  /** 最早备份时间 */
  oldestBackup?: string;

  /** 最新备份时间 */
  latestBackup?: string;

  /** 平均压缩率（百分比） */
  avgCompressionRatio: number;
}

/**
 * 备份清单（manifest.json）
 */
export interface BackupManifest {
  /** 版本号 */
  version: string;

  /** 最后更新时间 */
  lastUpdated: string;

  /** 备份列表 */
  backups: BackupMetadata[];

  /** 保留策略 */
  retention: RetentionPolicy;
}

/**
 * 验证结果
 */
export interface VerifyResult {
  /** 备份ID */
  backupId: string;

  /** 是否有效 */
  valid: boolean;

  /** 文件完整性 */
  fileIntegrity: boolean;

  /** 校验和匹配 */
  checksumMatch: boolean;

  /** 可解压 */
  canDecompress: boolean;

  /** 错误列表 */
  errors: string[];

  /** 警告列表 */
  warnings: string[];
}

/**
 * 恢复选项
 */
export interface RestoreOptions {
  /** 目标目录 */
  targetPath: string;

  /** 是否覆盖现有文件 */
  overwrite: boolean;

  /** 是否验证校验和 */
  verifyChecksum: boolean;

  /** 包含的数据层级（不指定则全部恢复） */
  includeLevels?: string[];
}

/**
 * 备份统计
 */
export interface BackupStats {
  /** 存储统计 */
  storage: StorageStats;

  /** 最近一次全量备份 */
  lastFullBackup?: BackupMetadata;

  /** 最近一次增量备份 */
  lastIncrementalBackup?: BackupMetadata;

  /** 平均备份时间（秒） */
  avgBackupDuration: number;

  /** 成功率（百分比） */
  successRate: number;
}
