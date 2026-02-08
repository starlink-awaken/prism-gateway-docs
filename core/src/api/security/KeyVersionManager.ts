/**
 * 密钥版本管理器
 *
 * @description
 * 支持多版本密钥管理，用于密钥轮换场景。
 * 新密钥用于签名，旧密钥保留用于验证历史签发的 Token。
 *
 * @features
 * - 密钥版本管理（当前版本、历史版本）
 * - 密钥轮换支持
 * - 自动清理过期密钥
 * - 密钥获取策略（签名用当前，验证用所有）
 *
 * @module api/security/KeyVersionManager
 */

import * as crypto from 'node:crypto';

/**
 * 密钥版本信息
 */
interface KeyVersion {
  /** 版本号（递增） */
  version: number;
  /** 密钥值（Base64 编码） */
  key: string;
  /** 创建时间（Unix 时间戳，秒） */
  createdAt: number;
  /** 是否为当前活跃密钥 */
  active: boolean;
}

/**
 * 密钥版本管理器配置
 */
export interface KeyVersionManagerConfig {
  /** 主密钥（用于加密存储的密钥） */
  masterKey: string;
  /** 密钥轮换周期（天，默认 30 天） */
  rotationDays?: number;
  /** 历史密钥保留期（天，默认 90 天） */
  retentionDays?: number;
  /** 是否启用自动轮换检查 */
  autoRotationCheck?: boolean;
}

/**
 * 密钥版本管理器类
 *
 * @description
 * 管理密钥的多个版本，支持平滑轮换：
 * 1. 新 Token 使用最新版本密钥签名
 * 2. 旧 Token 可以用历史密钥验证
 * 3. 过期密钥自动清理
 */
export class KeyVersionManager {
  private config: Required<KeyVersionManagerConfig>;
  private versions: Map<number, KeyVersion> = new Map();
  private currentVersion = 0;
  private readonly keyLength = 32; // 256 bits

  /**
   * 构造函数
   *
   * @param config - 配置选项
   */
  constructor(config: KeyVersionManagerConfig) {
    this.config = {
      rotationDays: 30,
      retentionDays: 90,
      autoRotationCheck: true,
      ...config
    };

    // 初始化时创建第一个密钥版本
    this.initializeFirstVersion();
  }

  /**
   * 初始化第一个密钥版本
   *
   * @private
   */
  private initializeFirstVersion(): void {
    if (this.currentVersion === 0) {
      const initialKey = this.generateKey();
      this.addVersion(initialKey);
    }
  }

  /**
   * 生成新的密钥
   *
   * @returns Base64 编码的密钥
   */
  generateKey(): string {
    return crypto.randomBytes(this.keyLength).toString('base64');
  }

  /**
   * 添加新版本的密钥
   *
   * @param key - 密钥值（可选，不提供则自动生成）
   * @returns 新版本号
   */
  addVersion(key?: string): number {
    const newVersion = this.currentVersion + 1;
    const keyVersion: KeyVersion = {
      version: newVersion,
      key: key || this.generateKey(),
      createdAt: Math.floor(Date.now() / 1000),
      active: true
    };

    // 将旧版本标记为非活跃
    for (const v of this.versions.values()) {
      v.active = false;
    }

    this.versions.set(newVersion, keyVersion);
    this.currentVersion = newVersion;

    return newVersion;
  }

  /**
   * 获取当前活跃密钥（用于签名）
   *
   * @returns 当前密钥
   * @throws {Error} 如果没有活跃密钥
   */
  getCurrentKey(): string {
    const current = this.versions.get(this.currentVersion);
    if (!current || !current.active) {
      throw new Error('No active key available');
    }
    return current.key;
  }

  /**
   * 获取指定版本的密钥
   *
   * @param version - 版本号
   * @returns 密钥值，版本不存在返回 undefined
   */
  getKey(version: number): string | undefined {
    const keyVersion = this.versions.get(version);
    return keyVersion?.key;
  }

  /**
   * 获取所有密钥（用于验证）
   *
   * @returns 所有版本的密钥数组
   */
  getAllKeys(): KeyVersion[] {
    return Array.from(this.versions.values()).sort((a, b) => b.version - a.version);
  }

  /**
   * 检查是否需要轮换密钥
   *
   * @returns 是否需要轮换
   */
  needsRotation(): boolean {
    const current = this.versions.get(this.currentVersion);
    if (!current) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const ageSeconds = now - current.createdAt;
    const rotationPeriodSeconds = this.config.rotationDays * 24 * 60 * 60;

    return ageSeconds >= rotationPeriodSeconds;
  }

  /**
   * 轮换密钥（创建新版本）
   *
   * @param force - 是否强制轮换（忽略时间检查）
   * @returns 新版本号
   */
  rotateKey(force = false): number {
    if (!force && !this.needsRotation()) {
      return this.currentVersion;
    }

    return this.addVersion();
  }

  /**
   * 清理过期的历史密钥
   *
   * @returns 清理的版本数量
   */
  cleanupExpiredKeys(): number {
    const now = Math.floor(Date.now() / 1000);
    const retentionPeriodSeconds = this.config.retentionDays * 24 * 60 * 60;
    let cleaned = 0;

    for (const [version, keyVersion] of this.versions) {
      // 保留当前版本
      if (version === this.currentVersion) {
        continue;
      }

      // 检查是否过期
      const ageSeconds = now - keyVersion.createdAt;
      if (ageSeconds > retentionPeriodSeconds) {
        this.versions.delete(version);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 获取密钥统计信息
   *
   * @returns 统计信息
   */
  getStats(): {
    currentVersion: number;
    totalVersions: number;
    oldestVersion: number;
    newestVersion: number;
    needsRotation: boolean;
    daysUntilRotation: number;
  } {
    const current = this.versions.get(this.currentVersion);
    const now = Math.floor(Date.now() / 1000);
    const rotationPeriodSeconds = this.config.rotationDays * 24 * 60 * 60;

    let daysUntilRotation = 0;
    if (current) {
      const ageSeconds = now - current.createdAt;
      const remainingSeconds = rotationPeriodSeconds - ageSeconds;
      daysUntilRotation = Math.max(0, Math.floor(remainingSeconds / (24 * 60 * 60)));
    }

    return {
      currentVersion: this.currentVersion,
      totalVersions: this.versions.size,
      oldestVersion: Math.min(...this.versions.keys()),
      newestVersion: Math.max(...this.versions.keys()),
      needsRotation: this.needsRotation(),
      daysUntilRotation
    };
  }

  /**
   * 导出所有版本（用于持久化）
   *
   * @returns 密钥版本数组
   */
  exportVersions(): KeyVersion[] {
    return Array.from(this.versions.values());
  }

  /**
   * 从导入的版本恢复
   *
   * @param versions - 密钥版本数组
   */
  importVersions(versions: KeyVersion[]): void {
    this.versions.clear();

    for (const v of versions) {
      this.versions.set(v.version, v);
      if (v.active) {
        this.currentVersion = v.version;
      }
    }

    // 确保有当前版本
    if (this.currentVersion === 0 && this.versions.size > 0) {
      this.currentVersion = Math.max(...this.versions.keys());
    }
  }

  /**
   * 清理所有密钥（用于测试）
   */
  dispose(): void {
    this.versions.clear();
    this.currentVersion = 0;
  }
}

/**
 * 导出类型
 */
export type { KeyVersion, KeyVersionManagerConfig };
