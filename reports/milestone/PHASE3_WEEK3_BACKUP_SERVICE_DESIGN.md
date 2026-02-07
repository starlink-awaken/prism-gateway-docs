# Phase 3 Week 3: 备份服务设计文档

> **任务编号**: Task 3.1
> **设计时间**: 2026-02-07
> **预计工时**: 10 小时
> **状态**: 📝 设计中

---

## 1. 设计目标

### 1.1 核心目标

为 PRISM-Gateway 系统设计和实现一个轻量级、可靠的备份服务，确保关键数据的安全性和可恢复性。

**关键要求**:
- **轻量级**: 无需外部数据库，基于文件系统
- **自动化**: 定时自动备份，无需人工干预
- **版本管理**: 保留多个历史版本
- **快速恢复**: 支持一键回滚
- **数据完整性**: 校验和验证机制

### 1.2 验收标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| **备份速度** | 全量备份时间 | <30s |
| **恢复速度** | 单个备份恢复时间 | <10s |
| **存储空间** | 增量备份压缩率 | >70% |
| **可靠性** | 备份成功率 | >99.9% |
| **自动化** | 定时任务准时率 | 100% |

---

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    备份服务架构图                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐ │
│  │  调度器      │─────>│  备份引擎    │─────>│  存储管理    │ │
│  │  Scheduler  │      │BackupEngine │      │StorageManager│ │
│  └─────────────┘      └─────────────┘      └─────────────┘ │
│       │                     │                     │         │
│       │                     │                     ▼         │
│       │                     │          ┌─────────────────┐  │
│       │                     │          │  压缩工具        │  │
│       │                     │          │ CompressUtil    │  │
│       │                     │          └─────────────────┘  │
│       │                     ▼                     │         │
│       │          ┌─────────────────┐             │         │
│       │          │  校验工具        │             │         │
│       │          │ ChecksumUtil    │             │         │
│       │          └─────────────────┘             │         │
│       ▼                     │                     ▼         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   数据源 (Data Sources)              │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ • level-1-hot/    (Hot 数据: principles, patterns)  │   │
│  │ • level-2-warm/   (Warm 数据: retros, violations)   │   │
│  │ • level-3-cold/   (Cold 数据: SOPs, checklists)     │   │
│  └──────────────────────────────────────────────────────┘   │
│                               │                             │
│                               ▼                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 备份存储 (Backup Storage)             │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ ~/.prism-gateway/backups/                            │   │
│  │   ├── full/       (全量备份, 保留 7 天)               │   │
│  │   ├── incremental/ (增量备份, 保留 30 天)             │   │
│  │   └── manifest.json (备份元数据索引)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 BackupService (主服务类)

```typescript
/**
 * 备份服务主类
 * 提供备份、恢复、清理等核心功能
 */
export class BackupService {
  private config: BackupConfig;
  private engine: BackupEngine;
  private storage: StorageManager;
  private scheduler: BackupScheduler;

  /**
   * 创建全量备份
   * @returns 备份结果（包含备份ID、路径、大小等）
   */
  async createFullBackup(): Promise<BackupResult> {
    // 1. 验证数据源可访问性
    // 2. 创建临时备份目录
    // 3. 复制所有数据文件
    // 4. 计算校验和
    // 5. 压缩为 .tar.gz
    // 6. 写入 manifest.json
    // 7. 清理临时文件
  }

  /**
   * 创建增量备份
   * @param baseBackupId 基准备份ID
   * @returns 备份结果
   */
  async createIncrementalBackup(baseBackupId: string): Promise<BackupResult> {
    // 1. 加载基准备份元数据
    // 2. 比较文件修改时间
    // 3. 仅复制变更文件
    // 4. 计算增量校验和
    // 5. 压缩为 .tar.gz
    // 6. 更新 manifest.json
  }

  /**
   * 恢复备份
   * @param backupId 备份ID
   * @param options 恢复选项（是否覆盖、恢复哪些层级）
   * @returns 恢复结果
   */
  async restore(backupId: string, options?: RestoreOptions): Promise<RestoreResult> {
    // 1. 验证备份完整性
    // 2. 创建当前数据快照（回滚点）
    // 3. 解压备份文件
    // 4. 验证校验和
    // 5. 覆盖目标文件
    // 6. 验证恢复结果
  }

  /**
   * 列出所有备份
   * @returns 备份列表
   */
  async listBackups(): Promise<BackupMetadata[]> {
    // 从 manifest.json 读取备份列表
  }

  /**
   * 删除备份
   * @param backupId 备份ID
   */
  async deleteBackup(backupId: string): Promise<void> {
    // 删除备份文件和元数据
  }

  /**
   * 验证备份完整性
   * @param backupId 备份ID
   * @returns 验证结果
   */
  async verify(backupId: string): Promise<VerifyResult> {
    // 1. 检查备份文件存在性
    // 2. 验证校验和
    // 3. 尝试解压（不实际恢复）
  }

  /**
   * 清理过期备份
   * @returns 清理结果（删除数量、释放空间）
   */
  async cleanup(): Promise<CleanupResult> {
    // 根据保留策略删除过期备份
  }
}
```

#### 2.2.2 BackupEngine (备份引擎)

```typescript
/**
 * 备份引擎
 * 负责实际的文件复制、差异计算、压缩等底层操作
 */
export class BackupEngine {
  /**
   * 复制文件树
   * @param source 源目录
   * @param dest 目标目录
   * @param filter 文件过滤器
   * @returns 复制的文件列表
   */
  async copyTree(source: string, dest: string, filter?: FileFilter): Promise<string[]> {
    // 递归复制目录树
  }

  /**
   * 计算目录差异
   * @param source 源目录
   * @param baseline 基准目录
   * @returns 差异文件列表
   */
  async diff(source: string, baseline: string): Promise<FileDiff[]> {
    // 1. 遍历源目录所有文件
    // 2. 与基准目录对比（mtime, size, checksum）
    // 3. 返回新增、修改、删除的文件
  }

  /**
   * 压缩目录
   * @param source 源目录
   * @param output 输出文件路径
   * @returns 压缩结果（压缩前后大小、压缩率）
   */
  async compress(source: string, output: string): Promise<CompressResult> {
    // 使用 tar + gzip 压缩
  }

  /**
   * 解压文件
   * @param archive 压缩文件路径
   * @param dest 解压目标目录
   */
  async decompress(archive: string, dest: string): Promise<void> {
    // 使用 tar 解压
  }

  /**
   * 计算文件校验和
   * @param filePath 文件路径
   * @param algorithm 算法（sha256, md5）
   * @returns 校验和字符串
   */
  async checksum(filePath: string, algorithm: 'sha256' | 'md5' = 'sha256'): Promise<string> {
    // 使用 Node.js crypto 模块计算哈希
  }
}
```

#### 2.2.3 StorageManager (存储管理器)

```typescript
/**
 * 存储管理器
 * 负责备份文件的组织、索引、清理
 */
export class StorageManager {
  private backupRoot: string; // ~/.prism-gateway/backups/
  private manifest: BackupManifest;

  /**
   * 保存备份
   * @param type 备份类型（full, incremental）
   * @param archivePath 压缩文件路径
   * @param metadata 元数据
   * @returns 备份ID
   */
  async save(type: BackupType, archivePath: string, metadata: BackupMetadata): Promise<string> {
    // 1. 生成备份ID（timestamp_type_uuid）
    // 2. 移动压缩文件到 backups/{type}/
    // 3. 更新 manifest.json
    // 4. 返回备份ID
  }

  /**
   * 加载备份
   * @param backupId 备份ID
   * @returns 备份文件路径和元数据
   */
  async load(backupId: string): Promise<{ path: string; metadata: BackupMetadata }> {
    // 从 manifest 查找备份
  }

  /**
   * 列出备份
   * @param filter 过滤条件
   * @returns 备份列表
   */
  async list(filter?: BackupFilter): Promise<BackupMetadata[]> {
    // 从 manifest 读取并过滤
  }

  /**
   * 删除备份
   * @param backupId 备份ID
   */
  async delete(backupId: string): Promise<void> {
    // 删除文件和元数据
  }

  /**
   * 应用保留策略
   * @param policy 保留策略
   * @returns 删除的备份ID列表
   */
  async applyRetentionPolicy(policy: RetentionPolicy): Promise<string[]> {
    // 1. 获取所有备份
    // 2. 按策略排序
    // 3. 删除过期备份
  }

  /**
   * 计算存储统计
   * @returns 存储使用情况
   */
  async getStorageStats(): Promise<StorageStats> {
    // 返回备份总数、总大小、按类型分组等
  }
}
```

#### 2.2.4 BackupScheduler (调度器)

```typescript
/**
 * 备份调度器
 * 负责定时任务管理
 */
export class BackupScheduler {
  private service: BackupService;
  private jobs: Map<string, ScheduledJob>;

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    // 1. 读取调度配置
    // 2. 注册 CRON 任务
    // 3. 启动任务队列
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    // 取消所有任务
  }

  /**
   * 添加定时任务
   * @param name 任务名称
   * @param schedule CRON 表达式
   * @param job 任务函数
   */
  addJob(name: string, schedule: string, job: () => Promise<void>): void {
    // 使用 node-cron 或类似库注册任务
  }

  /**
   * 移除定时任务
   * @param name 任务名称
   */
  removeJob(name: string): void {
    // 移除任务
  }
}
```

---

## 3. 数据模型

### 3.1 核心类型定义

```typescript
/**
 * 备份类型
 */
export enum BackupType {
  Full = 'full',          // 全量备份
  Incremental = 'incremental' // 增量备份
}

/**
 * 备份状态
 */
export enum BackupStatus {
  Pending = 'pending',     // 等待中
  InProgress = 'in_progress', // 进行中
  Completed = 'completed', // 已完成
  Failed = 'failed',       // 失败
  Corrupted = 'corrupted'  // 损坏
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

  /** 校验和算法 */
  checksumAlgorithm: 'sha256' | 'md5';

  /** 保留策略 */
  retention: RetentionPolicy;

  /** 调度配置 */
  schedule: ScheduleConfig;
}

/**
 * 保留策略
 */
export interface RetentionPolicy {
  /** 全量备份保留天数 */
  fullBackupDays: number; // 默认 7

  /** 增量备份保留天数 */
  incrementalBackupDays: number; // 默认 30

  /** 最大备份数量 */
  maxBackups: number; // 默认 50

  /** 最大存储空间 (bytes) */
  maxStorageBytes: number; // 默认 5GB
}

/**
 * 调度配置
 */
export interface ScheduleConfig {
  /** 全量备份 CRON 表达式 */
  fullBackupCron: string; // 默认 "0 2 * * 0" (每周日凌晨2点)

  /** 增量备份 CRON 表达式 */
  incrementalBackupCron: string; // 默认 "0 3 * * 1-6" (工作日凌晨3点)

  /** 清理 CRON 表达式 */
  cleanupCron: string; // 默认 "0 4 * * 0" (每周日凌晨4点)
}

/**
 * 备份元数据
 */
export interface BackupMetadata {
  /** 备份ID (格式: 20260207T150000_full_abc123) */
  id: string;

  /** 备份类型 */
  type: BackupType;

  /** 备份状态 */
  status: BackupStatus;

  /** 创建时间 */
  createdAt: Date;

  /** 完成时间 */
  completedAt?: Date;

  /** 文件路径 */
  path: string;

  /** 文件大小 (bytes) */
  size: number;

  /** 压缩前大小 (bytes) */
  originalSize: number;

  /** 压缩率 (0-1) */
  compressionRatio: number;

  /** 校验和 */
  checksum: string;

  /** 包含的层级 */
  includedLevels: string[];

  /** 文件数量 */
  fileCount: number;

  /** 基准备份ID (仅增量备份) */
  baseBackupId?: string;

  /** 备份耗时 (ms) */
  duration: number;

  /** 错误信息 (如果失败) */
  error?: string;
}

/**
 * 备份结果
 */
export interface BackupResult {
  /** 是否成功 */
  success: boolean;

  /** 备份ID */
  backupId?: string;

  /** 元数据 */
  metadata?: BackupMetadata;

  /** 错误信息 */
  error?: string;
}

/**
 * 恢复选项
 */
export interface RestoreOptions {
  /** 是否覆盖现有文件 */
  overwrite: boolean; // 默认 false

  /** 恢复哪些层级 */
  levels?: string[]; // 默认全部

  /** 恢复前是否创建快照 */
  createSnapshot: boolean; // 默认 true

  /** 是否验证校验和 */
  verifyChecksum: boolean; // 默认 true
}

/**
 * 恢复结果
 */
export interface RestoreResult {
  /** 是否成功 */
  success: boolean;

  /** 恢复的文件数量 */
  filesRestored: number;

  /** 恢复耗时 (ms) */
  duration: number;

  /** 快照ID (用于回滚) */
  snapshotId?: string;

  /** 错误信息 */
  error?: string;
}

/**
 * 验证结果
 */
export interface VerifyResult {
  /** 是否有效 */
  valid: boolean;

  /** 文件存在 */
  fileExists: boolean;

  /** 校验和匹配 */
  checksumMatch: boolean;

  /** 可以解压 */
  canDecompress: boolean;

  /** 错误信息 */
  error?: string;
}

/**
 * 清理结果
 */
export interface CleanupResult {
  /** 删除的备份数量 */
  deletedCount: number;

  /** 删除的备份ID列表 */
  deletedBackupIds: string[];

  /** 释放的空间 (bytes) */
  freedSpace: number;

  /** 耗时 (ms) */
  duration: number;
}

/**
 * 存储统计
 */
export interface StorageStats {
  /** 总备份数量 */
  totalBackups: number;

  /** 全量备份数量 */
  fullBackups: number;

  /** 增量备份数量 */
  incrementalBackups: number;

  /** 总存储空间 (bytes) */
  totalSize: number;

  /** 最旧备份日期 */
  oldestBackup?: Date;

  /** 最新备份日期 */
  newestBackup?: Date;

  /** 平均备份大小 (bytes) */
  avgBackupSize: number;
}

/**
 * 备份清单 (manifest.json)
 */
export interface BackupManifest {
  /** 格式版本 */
  version: string; // "1.0.0"

  /** 最后更新时间 */
  lastUpdated: Date;

  /** 备份列表 */
  backups: BackupMetadata[];

  /** 统计信息 */
  stats: StorageStats;
}

/**
 * 文件差异
 */
export interface FileDiff {
  /** 文件路径 */
  path: string;

  /** 差异类型 */
  type: 'added' | 'modified' | 'deleted';

  /** 修改时间 */
  mtime: Date;

  /** 文件大小 */
  size: number;
}
```

---

## 4. 功能规格

### 4.1 全量备份流程

```typescript
/**
 * 全量备份步骤:
 * 1. 验证数据源可访问性
 * 2. 创建临时目录 /tmp/prism-backup-{uuid}/
 * 3. 复制 level-1-hot/ 所有文件
 * 4. 复制 level-2-warm/ 所有文件
 * 5. 复制 level-3-cold/ 所有文件
 * 6. 计算每个文件的 SHA256 校验和
 * 7. 压缩为 full_{timestamp}.tar.gz
 * 8. 计算压缩文件的 SHA256 校验和
 * 9. 创建备份元数据
 * 10. 保存到 ~/.prism-gateway/backups/full/
 * 11. 更新 manifest.json
 * 12. 清理临时目录
 */
async function performFullBackup(): Promise<BackupResult> {
  const startTime = Date.now();
  const backupId = generateBackupId('full');
  const tempDir = `/tmp/prism-backup-${uuid()}`;

  try {
    // Step 1: 验证数据源
    await verifyDataSource();

    // Step 2-5: 复制文件
    const files = await copyDataToTemp(tempDir);

    // Step 6: 计算文件校验和
    const checksums = await calculateChecksums(files);

    // Step 7: 压缩
    const archivePath = await compressBackup(tempDir, backupId);

    // Step 8: 计算压缩文件校验和
    const archiveChecksum = await checksum(archivePath);

    // Step 9-10: 保存备份
    const metadata = await storageManager.save('full', archivePath, {
      id: backupId,
      type: BackupType.Full,
      status: BackupStatus.Completed,
      createdAt: new Date(),
      completedAt: new Date(),
      checksum: archiveChecksum,
      // ... 其他元数据
    });

    // Step 11: 更新 manifest
    await updateManifest();

    return {
      success: true,
      backupId,
      metadata
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Step 12: 清理
    await fs.rm(tempDir, { recursive: true });
  }
}
```

### 4.2 增量备份流程

```typescript
/**
 * 增量备份步骤:
 * 1. 加载最新的全量备份作为基准
 * 2. 比较当前数据与基准的差异
 * 3. 仅复制变更文件到临时目录
 * 4. 计算校验和
 * 5. 压缩为 incremental_{timestamp}.tar.gz
 * 6. 保存元数据（记录 baseBackupId）
 */
async function performIncrementalBackup(): Promise<BackupResult> {
  // 1. 找到最新的全量备份
  const baseBackup = await findLatestFullBackup();
  if (!baseBackup) {
    throw new Error('No base full backup found');
  }

  // 2. 计算差异
  const diffs = await calculateDiff(baseBackup.id);

  // 3. 仅复制变更文件
  const changedFiles = diffs.filter(d => d.type !== 'deleted');
  await copyChangedFiles(changedFiles, tempDir);

  // 4-6: 类似全量备份流程
  // ...
}
```

### 4.3 恢复流程

```typescript
/**
 * 恢复步骤:
 * 1. 验证备份完整性
 * 2. 创建当前数据快照（回滚点）
 * 3. 解压备份到临时目录
 * 4. 验证解压文件的校验和
 * 5. 覆盖目标文件（按选项）
 * 6. 验证恢复结果
 * 7. 清理临时文件
 */
async function performRestore(backupId: string, options: RestoreOptions): Promise<RestoreResult> {
  // 1. 验证备份
  const verifyResult = await verify(backupId);
  if (!verifyResult.valid) {
    throw new Error('Backup is corrupted');
  }

  // 2. 创建快照（如果启用）
  let snapshotId: string | undefined;
  if (options.createSnapshot) {
    snapshotId = await createSnapshot();
  }

  // 3. 解压
  const tempDir = `/tmp/prism-restore-${uuid()}`;
  await decompress(backupPath, tempDir);

  // 4. 验证校验和（如果启用）
  if (options.verifyChecksum) {
    await verifyChecksums(tempDir);
  }

  // 5. 覆盖目标文件
  const filesRestored = await copyFilesToTarget(tempDir, options);

  // 6-7: 验证和清理
  // ...

  return {
    success: true,
    filesRestored,
    snapshotId,
    duration: Date.now() - startTime
  };
}
```

### 4.4 清理过期备份

```typescript
/**
 * 清理策略:
 * 1. 全量备份: 保留最近 7 天
 * 2. 增量备份: 保留最近 30 天
 * 3. 总备份数: 最多 50 个
 * 4. 存储空间: 最大 5GB
 */
async function performCleanup(): Promise<CleanupResult> {
  const policy = config.retention;
  const now = Date.now();
  const deletedIds: string[] = [];
  let freedSpace = 0;

  const backups = await storageManager.list();

  for (const backup of backups) {
    const age = now - backup.createdAt.getTime();
    const ageDays = age / (1000 * 60 * 60 * 24);

    let shouldDelete = false;

    // 策略1: 全量备份过期
    if (backup.type === BackupType.Full && ageDays > policy.fullBackupDays) {
      shouldDelete = true;
    }

    // 策略2: 增量备份过期
    if (backup.type === BackupType.Incremental && ageDays > policy.incrementalBackupDays) {
      shouldDelete = true;
    }

    if (shouldDelete) {
      await storageManager.delete(backup.id);
      deletedIds.push(backup.id);
      freedSpace += backup.size;
    }
  }

  // 策略3: 超出最大备份数
  if (backups.length > policy.maxBackups) {
    const sortedBackups = backups.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const excessBackups = sortedBackups.slice(0, backups.length - policy.maxBackups);
    for (const backup of excessBackups) {
      await storageManager.delete(backup.id);
      deletedIds.push(backup.id);
      freedSpace += backup.size;
    }
  }

  // 策略4: 超出存储空间
  // ... 类似逻辑

  return {
    deletedCount: deletedIds.length,
    deletedBackupIds: deletedIds,
    freedSpace,
    duration: Date.now() - startTime
  };
}
```

---

## 5. 调度策略

### 5.1 默认调度配置

```typescript
const defaultSchedule: ScheduleConfig = {
  // 每周日凌晨 2:00 执行全量备份
  fullBackupCron: '0 2 * * 0',

  // 每周一到周六凌晨 3:00 执行增量备份
  incrementalBackupCron: '0 3 * * 1-6',

  // 每周日凌晨 4:00 清理过期备份
  cleanupCron: '0 4 * * 0',
};
```

### 5.2 调度时间线示例

```
周日 (Sunday):
  02:00 - 全量备份执行
  04:00 - 清理过期备份

周一 (Monday):
  03:00 - 增量备份执行

周二 (Tuesday):
  03:00 - 增量备份执行

周三 (Wednesday):
  03:00 - 增量备份执行

周四 (Thursday):
  03:00 - 增量备份执行

周五 (Friday):
  03:00 - 增量备份执行

周六 (Saturday):
  03:00 - 增量备份执行
```

### 5.3 手动备份

除了自动调度，用户可以通过 CLI 或 API 手动触发备份：

```bash
# CLI 命令
prism backup create --type full
prism backup create --type incremental
prism backup restore <backup-id>
prism backup list
prism backup verify <backup-id>
prism backup cleanup
```

---

## 6. 错误处理

### 6.1 备份错误处理

| 错误类型 | 处理策略 | 示例 |
|---------|---------|------|
| **数据源不可访问** | 重试 3 次，失败则告警 | `level-1-hot/` 权限错误 |
| **磁盘空间不足** | 清理临时文件，执行清理任务 | `/tmp` 空间不足 |
| **压缩失败** | 记录错误，删除部分文件 | `tar` 命令失败 |
| **校验和不匹配** | 标记备份为损坏，删除文件 | 数据传输错误 |
| **网络错误（远程备份）** | 重试 5 次，指数退避 | S3 上传失败 |

### 6.2 恢复错误处理

| 错误类型 | 处理策略 | 示例 |
|---------|---------|------|
| **备份损坏** | 拒绝恢复，提示选择其他备份 | 校验和不匹配 |
| **目标路径不存在** | 自动创建目录 | `level-2-warm/` 不存在 |
| **文件冲突** | 根据 `overwrite` 选项决定 | 文件已存在 |
| **权限错误** | 提示用户使用 sudo | 无写权限 |
| **部分文件恢复失败** | 记录失败文件，继续恢复其他 | 单个文件损坏 |

### 6.3 告警机制

```typescript
/**
 * 备份告警事件
 */
export enum BackupAlertType {
  BackupFailed = 'backup_failed',
  BackupCorrupted = 'backup_corrupted',
  RestoreFailed = 'restore_failed',
  StorageAlmostFull = 'storage_almost_full',
  NoRecentBackup = 'no_recent_backup'
}

/**
 * 发送告警
 */
async function sendAlert(type: BackupAlertType, details: any): Promise<void> {
  // 1. 记录日志
  logger.error(`Backup Alert: ${type}`, details);

  // 2. 发送通知（如果配置了）
  if (config.notifications.enabled) {
    await notifier.send({
      title: `Backup Alert: ${type}`,
      message: JSON.stringify(details),
      level: 'error'
    });
  }

  // 3. 写入告警历史
  await appendAlertHistory({
    type,
    timestamp: new Date(),
    details
  });
}
```

---

## 7. 性能优化

### 7.1 压缩优化

```typescript
/**
 * 根据数据类型选择压缩级别
 */
function selectCompressionLevel(dataType: string): number {
  switch (dataType) {
    case 'json': return 9; // JSON 文本高度可压缩
    case 'log': return 9;  // 日志高度可压缩
    case 'image': return 3; // 图片已压缩，低级别
    default: return 6;     // 默认中等级别
  }
}
```

### 7.2 并发优化

```typescript
/**
 * 并发复制文件（限制并发数）
 */
async function copyFilesParallel(files: string[], dest: string): Promise<void> {
  const concurrency = 5; // 同时复制 5 个文件
  const queue = [...files];

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    await Promise.all(batch.map(file => copyFile(file, dest)));
  }
}
```

### 7.3 增量备份优化

```typescript
/**
 * 快速差异检测（仅比较 mtime 和 size）
 */
async function quickDiff(source: string, baseline: string): Promise<FileDiff[]> {
  const diffs: FileDiff[] = [];

  for (const file of sourceFiles) {
    const sourceStat = await fs.stat(file);
    const baselineStat = await fs.stat(path.join(baseline, file));

    // 仅比较修改时间和大小，避免读取文件内容
    if (sourceStat.mtime > baselineStat.mtime || sourceStat.size !== baselineStat.size) {
      diffs.push({
        path: file,
        type: 'modified',
        mtime: sourceStat.mtime,
        size: sourceStat.size
      });
    }
  }

  return diffs;
}
```

---

## 8. 安全性

### 8.1 数据加密

```typescript
/**
 * 备份文件加密（可选）
 */
async function encryptBackup(archivePath: string, password: string): Promise<string> {
  const encryptedPath = `${archivePath}.enc`;

  // 使用 AES-256-GCM 加密
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(password), iv);

  const input = fs.createReadStream(archivePath);
  const output = fs.createWriteStream(encryptedPath);

  await pipeline(input, cipher, output);

  return encryptedPath;
}
```

### 8.2 访问控制

```typescript
/**
 * 备份文件权限设置
 */
async function secureBackupFile(filePath: string): Promise<void> {
  // 设置为仅所有者可读写 (0600)
  await fs.chmod(filePath, 0o600);

  // 设置所有者为当前用户
  const uid = process.getuid();
  const gid = process.getgid();
  await fs.chown(filePath, uid, gid);
}
```

### 8.3 完整性验证

```typescript
/**
 * 多层次完整性验证
 */
async function verifyIntegrity(backupId: string): Promise<VerifyResult> {
  const backup = await storageManager.load(backupId);

  // 1. 文件存在性检查
  const fileExists = await fs.access(backup.path).then(() => true).catch(() => false);
  if (!fileExists) {
    return { valid: false, fileExists: false };
  }

  // 2. 校验和验证
  const actualChecksum = await checksum(backup.path);
  const checksumMatch = actualChecksum === backup.metadata.checksum;
  if (!checksumMatch) {
    return { valid: false, fileExists: true, checksumMatch: false };
  }

  // 3. 解压测试
  const canDecompress = await testDecompress(backup.path);

  return {
    valid: fileExists && checksumMatch && canDecompress,
    fileExists,
    checksumMatch,
    canDecompress
  };
}
```

---

## 9. 测试策略

### 9.1 单元测试

```typescript
describe('BackupService', () => {
  describe('createFullBackup', () => {
    it('should create a full backup successfully', async () => {
      const result = await service.createFullBackup();
      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
    });

    it('should handle disk space error', async () => {
      // Mock disk full error
      jest.spyOn(fs, 'writeFile').mockRejectedValue(new Error('ENOSPC'));

      const result = await service.createFullBackup();
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOSPC');
    });
  });

  describe('restore', () => {
    it('should restore backup correctly', async () => {
      const backupId = 'test-backup-id';
      const result = await service.restore(backupId);
      expect(result.success).toBe(true);
      expect(result.filesRestored).toBeGreaterThan(0);
    });
  });
});
```

### 9.2 集成测试

```typescript
describe('BackupService Integration', () => {
  it('should perform full backup -> incremental backup -> restore cycle', async () => {
    // 1. 创建全量备份
    const fullBackup = await service.createFullBackup();
    expect(fullBackup.success).toBe(true);

    // 2. 修改数据
    await modifyTestData();

    // 3. 创建增量备份
    const incrementalBackup = await service.createIncrementalBackup(fullBackup.backupId!);
    expect(incrementalBackup.success).toBe(true);

    // 4. 恢复全量备份
    const restore1 = await service.restore(fullBackup.backupId!);
    expect(restore1.success).toBe(true);

    // 5. 恢复增量备份
    const restore2 = await service.restore(incrementalBackup.backupId!);
    expect(restore2.success).toBe(true);

    // 6. 验证数据一致性
    const data = await readTestData();
    expect(data).toMatchSnapshot();
  });
});
```

### 9.3 性能测试

```typescript
describe('BackupService Performance', () => {
  it('should complete full backup in <30s', async () => {
    const start = Date.now();
    const result = await service.createFullBackup();
    const duration = Date.now() - start;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(30000);
  });

  it('should achieve >70% compression ratio', async () => {
    const result = await service.createFullBackup();
    const metadata = result.metadata!;

    const compressionRatio = 1 - (metadata.size / metadata.originalSize);
    expect(compressionRatio).toBeGreaterThan(0.7);
  });
});
```

---

## 10. CLI 命令设计

```bash
# 创建全量备份
prism backup create --type full
# Output:
# ✅ Full backup created successfully
# Backup ID: 20260207T150000_full_abc123
# Size: 15.2 MB (compressed from 52.3 MB, 71% reduction)
# Duration: 8.3s
# Path: ~/.prism-gateway/backups/full/20260207T150000_full_abc123.tar.gz

# 创建增量备份
prism backup create --type incremental
# Output:
# ✅ Incremental backup created successfully
# Backup ID: 20260207T160000_incremental_def456
# Base Backup: 20260207T150000_full_abc123
# Changed Files: 12
# Size: 2.1 MB
# Duration: 1.2s

# 列出所有备份
prism backup list
# Output:
# ID                                Type          Created              Size      Status
# ─────────────────────────────────────────────────────────────────────────────────────
# 20260207T150000_full_abc123       Full          2026-02-07 15:00    15.2 MB   ✅ Valid
# 20260207T160000_incremental_def456 Incremental  2026-02-07 16:00    2.1 MB    ✅ Valid
# 20260206T150000_full_xyz789       Full          2026-02-06 15:00    14.8 MB   ✅ Valid
#
# Total: 3 backups, 32.1 MB

# 恢复备份
prism backup restore 20260207T150000_full_abc123
# Output:
# ⚠️  Warning: This will overwrite existing data. Continue? (y/n): y
# ⏳ Creating snapshot of current data...
# ⏳ Verifying backup integrity...
# ⏳ Extracting backup files...
# ⏳ Restoring 345 files...
# ✅ Backup restored successfully
# Files Restored: 345
# Duration: 5.7s
# Snapshot ID: 20260207T161500_snapshot_ghi789 (use for rollback)

# 验证备份
prism backup verify 20260207T150000_full_abc123
# Output:
# ✅ Backup is valid
# File Exists: ✅
# Checksum Match: ✅
# Can Decompress: ✅

# 清理过期备份
prism backup cleanup
# Output:
# ⏳ Cleaning up expired backups...
# Deleted 5 backups:
#   - 20260130T150000_full_old123 (7.5 MB)
#   - 20260131T030000_incremental_old456 (1.2 MB)
#   - 20260201T030000_incremental_old789 (1.5 MB)
#   - 20260202T030000_incremental_old012 (1.8 MB)
#   - 20260203T030000_incremental_old345 (1.1 MB)
#
# Total Freed Space: 13.1 MB
# Duration: 2.3s

# 查看备份统计
prism backup stats
# Output:
# Backup Statistics
# ─────────────────────────────────
# Total Backups:         18
# Full Backups:          3
# Incremental Backups:   15
# Total Size:            156.4 MB
# Oldest Backup:         2026-01-15 02:00
# Newest Backup:         2026-02-07 16:00
# Avg Backup Size:       8.7 MB
# Storage Used:          156.4 MB / 5 GB (3.1%)
```

---

## 11. API 接口设计

### 11.1 REST API 端点

```typescript
// GET /api/v1/backup/list
// 列出所有备份
router.get('/backup/list', async (c) => {
  const backups = await backupService.listBackups();
  return c.json({ backups });
});

// POST /api/v1/backup/create
// 创建备份
router.post('/backup/create', async (c) => {
  const { type } = await c.req.json();
  const result = await backupService.createBackup(type);
  return c.json(result);
});

// POST /api/v1/backup/restore
// 恢复备份
router.post('/backup/restore', async (c) => {
  const { backupId, options } = await c.req.json();
  const result = await backupService.restore(backupId, options);
  return c.json(result);
});

// GET /api/v1/backup/verify/:id
// 验证备份
router.get('/backup/verify/:id', async (c) => {
  const backupId = c.req.param('id');
  const result = await backupService.verify(backupId);
  return c.json(result);
});

// DELETE /api/v1/backup/:id
// 删除备份
router.delete('/backup/:id', async (c) => {
  const backupId = c.req.param('id');
  await backupService.deleteBackup(backupId);
  return c.json({ success: true });
});

// POST /api/v1/backup/cleanup
// 清理过期备份
router.post('/backup/cleanup', async (c) => {
  const result = await backupService.cleanup();
  return c.json(result);
});

// GET /api/v1/backup/stats
// 获取统计信息
router.get('/backup/stats', async (c) => {
  const stats = await backupService.getStats();
  return c.json(stats);
});
```

---

## 12. 实现计划

### 12.1 任务分解 (10 小时)

| 任务 | 工时 | 优先级 | 依赖 |
|------|------|--------|------|
| **1. 数据模型定义** | 1h | P0 | 无 |
| **2. BackupEngine 实现** | 2h | P0 | 1 |
| **3. StorageManager 实现** | 1.5h | P0 | 1 |
| **4. BackupService 实现** | 2h | P0 | 2, 3 |
| **5. BackupScheduler 实现** | 1h | P1 | 4 |
| **6. CLI 命令实现** | 1h | P1 | 4 |
| **7. API 端点实现** | 0.5h | P2 | 4 |
| **8. 单元测试** | 1h | P0 | 2-7 |
| **9. 集成测试** | 0.5h | P1 | 8 |
| **10. 文档和示例** | 0.5h | P2 | 全部 |

### 12.2 验收检查清单

- [ ] 全量备份功能正常，耗时 <30s
- [ ] 增量备份功能正常，压缩率 >70%
- [ ] 恢复功能正常，耗时 <10s
- [ ] 备份完整性验证通过
- [ ] 自动调度任务正常运行
- [ ] CLI 命令全部可用
- [ ] API 端点全部可用
- [ ] 单元测试覆盖率 >90%
- [ ] 集成测试通过
- [ ] 文档完整清晰

---

## 13. 未来扩展

### 13.1 远程备份支持

```typescript
/**
 * 将备份上传到远程存储（S3, Azure Blob）
 */
async function uploadToRemote(backupId: string, remoteConfig: RemoteConfig): Promise<void> {
  const backup = await storageManager.load(backupId);

  // 使用 AWS SDK 或 Azure SDK 上传
  await s3.upload({
    Bucket: remoteConfig.bucket,
    Key: `prism-backups/${backupId}.tar.gz`,
    Body: fs.createReadStream(backup.path)
  }).promise();
}
```

### 13.2 差异备份 (Differential Backup)

```typescript
/**
 * 差异备份：基于最近的全量备份，包含所有后续变更
 * 优点：恢复更快（只需全量+差异）
 * 缺点：占用空间比增量大
 */
async function createDifferentialBackup(): Promise<BackupResult> {
  // 找到最近的全量备份
  const baseFullBackup = await findLatestFullBackup();

  // 计算从全量备份以来的所有变更（累积）
  const diffs = await calculateDiffFromFull(baseFullBackup.id);

  // 复制所有变更文件
  // ...
}
```

### 13.3 快照备份 (Snapshot)

```typescript
/**
 * 快照备份：使用文件系统快照（Btrfs, ZFS）
 * 优点：瞬间完成，空间占用小
 * 缺点：依赖文件系统支持
 */
async function createSnapshot(): Promise<BackupResult> {
  // 使用 btrfs subvolume snapshot
  await exec(`btrfs subvolume snapshot ~/.prism-gateway ~/.prism-gateway/.snapshots/${timestamp}`);
}
```

### 13.4 加密备份

```typescript
/**
 * 端到端加密备份
 */
interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
  keyDerivation: 'pbkdf2' | 'argon2';
  password?: string;
  keyFile?: string;
}
```

---

## 14. 参考文档

- [Restic Backup Design](https://restic.readthedocs.io/en/latest/100_references.html)
- [Borg Backup Architecture](https://borgbackup.readthedocs.io/en/stable/internals.html)
- [TAR File Format](https://www.gnu.org/software/tar/manual/html_node/Standard.html)
- [GZIP Compression](https://www.gnu.org/software/gzip/manual/gzip.html)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [Node-cron Documentation](https://github.com/node-cron/node-cron)

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-07
**作者**: AI Assistant (Claude Sonnet 4.5)
**审核人**: PRISM-Gateway Team
**下一步**: Task 3.2 健康检查系统设计
