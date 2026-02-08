/**
 * PRISM-Gateway 核心存储层
 * 实现三层MEMORY架构：Hot（热数据）、Warm（温数据）、Cold（冷数据）
 *
 * @remarks
 * 并发安全：所有读写操作都通过 FileLock 保护
 * - 读取操作使用 SHARED 锁（允许多个并发读）
 * - 写入操作使用 EXCLUSIVE 锁（独占访问）
 */

import { join } from 'path';
import { homedir } from 'os';
import {
  MemoryLevel,
  Principle,
  PrinciplesData,
  SuccessPattern,
  SuccessPatternsData,
  FailurePattern,
  FailurePatternsData,
  RetroRecord,
  ViolationRecord,
  QueryResult,
  CacheItem
} from '../types/index.js';
import {
  readJSON,
  writeJSON,
  appendJSONL,
  readJSONL,
  fileExists,
  listFiles
} from '../utils/file.js';
import { FileLock } from '../infrastructure/lock/FileLock.js';
import { LockMode } from '../infrastructure/lock/IFileLock.js';

/**
 * 锁名称常量
 *
 * @description
 * 为不同的数据文件定义对应的锁文件名
 */
const LOCK_NAMES = {
  PRINCIPLES: 'principles',
  SUCCESS_PATTERNS: 'success-patterns',
  FAILURE_PATTERNS: 'failure-patterns',
  VIOLATIONS: 'violations',
  RETROS_INDEX: 'retros-index',
  RETROS_RECORD: 'retros-record',
  TEMPLATES: 'templates'
} as const;

/**
 * MemoryStore核心类
 *
 * @description
 * PRISM-Gateway的核心存储层，实现三层MEMORY架构：
 * - Level-1 Hot: 热数据（原则、模式），响应时间 <100ms
 * - Level-2 Warm: 温数据（复盘记录、违规记录），可读写
 * - Level-3 Cold: 冷数据（SOP、检查清单、模板），只读
 *
 * @remarks
 * 存储路径（位于用户主目录下）：
 * - ~/.prism-gateway/level-1-hot/ - 热数据目录
 * - ~/.prism-gateway/level-2-warm/ - 温数据目录
 * - ~/.prism-gateway/level-3-cold/ - 冷数据目录
 *
 * 数据缓存策略：
 * - 原则和模式数据缓存1分钟
 * - 违规记录缓存30秒
 * - 支持手动清除缓存
 *
 * @example
 * ```typescript
 * const store = new MemoryStore();
 *
 * // 获取所有原则
 * const principles = await store.getPrinciples();
 *
 * // 保存复盘记录
 * await store.saveRetroRecord({
 *   id: 'retro_1',
 *   timestamp: new Date().toISOString(),
 *   type: 'quick',
 *   project: 'my-project',
 *   duration: 5000,
 *   summary: '复盘总结',
 *   lessons: ['教训1'],
 *   improvements: ['改进1']
 * });
 * ```
 */
export class MemoryStore {
  private basePath: string;
  private hotPath: string;
  private warmPath: string;
  private coldPath: string;
  private cache: Map<string, CacheItem<any>>;
  private locksPath: string;
  private locks: Map<string, FileLock>;

  constructor() {
    this.basePath = join(homedir(), '.prism-gateway');
    this.hotPath = join(this.basePath, 'level-1-hot');
    this.warmPath = join(this.basePath, 'level-2-warm');
    this.coldPath = join(this.basePath, 'level-3-cold');
    this.locksPath = join(this.basePath, 'locks');
    this.cache = new Map();
    this.locks = new Map();
  }

  /**
   * 获取锁实例（每次创建新实例）
   *
   * @description
   * 根据锁名称创建新的锁实例。
   * 注意：不再缓存 FileLock 实例，每次都创建新实例以支持并发操作。
   *
   * @param lockName - 锁名称
   * @returns 新的 FileLock 实例
   */
  private getLock(lockName: string): FileLock {
    // FileLock 会自动添加 .lock 后缀，所以这里传入不带 .lock 的路径
    const lockPath = join(this.locksPath, lockName);
    return new FileLock(lockPath);
  }

  /**
   * 使用共享锁执行读取操作
   *
   * @description
   * 获取共享锁（SHARED），允许多个并发读操作
   *
   * @template T - 返回值类型
   * @param lockName - 锁名称
   * @param fn - 要执行的函数
   * @returns 函数执行结果
   */
  private async withReadLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
    const lock = this.getLock(lockName);
    let acquired = false;
    try {
      await lock.acquire(LockMode.SHARED);
      acquired = true;
      return await fn();
    } finally {
      if (acquired) {
        await lock.release();
      }
    }
  }

  /**
   * 使用排他锁执行写入操作
   *
   * @description
   * 获取排他锁（EXCLUSIVE），独占访问资源
   *
   * @template T - 返回值类型
   * @param lockName - 锁名称
   * @param fn - 要执行的函数
   * @returns 函数执行结果
   */
  private async withWriteLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
    const lock = this.getLock(lockName);
    let acquired = false;
    try {
      await lock.acquire(LockMode.EXCLUSIVE);
      acquired = true;
      return await fn();
    } finally {
      if (acquired) {
        await lock.release();
      }
    }
  }

  // ==================== Level-1: Hot 数据访问 ====================

  /**
   * 获取所有原则（热数据）
   *
   * @returns 原则数组
   *
   * @remarks
   * 响应时间: <100ms
   * 数据缓存: 1分钟
   * 并发安全: 使用 SHARED 锁
   *
   * @example
   * ```typescript
   * const principles = await store.getPrinciples();
   * console.log(`加载了${principles.length}条原则`);
   * ```
   */
  async getPrinciples(): Promise<Principle[]> {
    const cacheKey = 'principles';
    const cached = this.getFromCache<Principle[]>(cacheKey);
    if (cached) return cached;

    return this.withReadLock(LOCK_NAMES.PRINCIPLES, async () => {
      const filePath = join(this.hotPath, 'principles.json');
      const data = await readJSON<PrinciplesData>(filePath);
      this.setCache(cacheKey, data.principles, 60000); // 缓存1分钟
      return data.principles;
    });
  }

  /**
   * 根据ID获取单个原则
   */
  async getPrincipleById(id: string): Promise<Principle | undefined> {
    const principles = await this.getPrinciples();
    return principles.find(p => p.id === id);
  }

  /**
   * 获取所有成功模式（热数据）
   *
   * @remarks
   * 并发安全: 使用 SHARED 锁
   */
  async getSuccessPatterns(): Promise<SuccessPattern[]> {
    const cacheKey = 'success_patterns';
    const cached = this.getFromCache<SuccessPattern[]>(cacheKey);
    if (cached) return cached;

    return this.withReadLock(LOCK_NAMES.SUCCESS_PATTERNS, async () => {
      const filePath = join(this.hotPath, 'patterns', 'success_patterns.json');
      const data = await readJSON<SuccessPatternsData>(filePath);
      this.setCache(cacheKey, data.patterns, 60000);
      return data.patterns;
    });
  }

  /**
   * 获取所有失败模式（热数据）
   *
   * @remarks
   * 并发安全: 使用 SHARED 锁
   */
  async getFailurePatterns(): Promise<FailurePattern[]> {
    const cacheKey = 'failure_patterns';
    const cached = this.getFromCache<FailurePattern[]>(cacheKey);
    if (cached) return cached;

    return this.withReadLock(LOCK_NAMES.FAILURE_PATTERNS, async () => {
      const filePath = join(this.hotPath, 'patterns', 'failure_patterns.json');
      const data = await readJSON<FailurePatternsData>(filePath);
      this.setCache(cacheKey, data.patterns, 60000);
      return data.patterns;
    });
  }

  /**
   * 搜索模式（关键词匹配）
   */
  async searchPatterns(keyword: string): Promise<{
    success: SuccessPattern[];
    failure: FailurePattern[];
  }> {
    const [successPatterns, failurePatterns] = await Promise.all([
      this.getSuccessPatterns(),
      this.getFailurePatterns()
    ]);

    const keywordLower = keyword.toLowerCase();

    return {
      success: successPatterns.filter(p =>
        p.name.toLowerCase().includes(keywordLower) ||
        p.description.toLowerCase().includes(keywordLower)
      ),
      failure: failurePatterns.filter(p =>
        p.name.toLowerCase().includes(keywordLower) ||
        p.characteristic.toLowerCase().includes(keywordLower)
      )
    };
  }

  // ==================== Level-2: Warm 数据读写 ====================

  /**
   * 保存复盘记录
   *
   * @param record - 复盘记录对象
   * @returns Promise<void>
   *
   * @remarks
   * 记录按年月组织，存储路径为：
   * ~/.prism-gateway/level-2-warm/retros/YYYY-MM/{type}/{record.id}.json
   *
   * 同时追加到索引文件 index.jsonl
   * 并发安全: 使用 EXCLUSIVE 锁
   *
   * @example
   * ```typescript
   * await store.saveRetroRecord({
   *   id: 'retro_123',
   *   timestamp: new Date().toISOString(),
   *   type: 'quick',
   *   project: 'my-project',
   *   duration: 5000,
   *   summary: '完成登录功能开发',
   *   lessons: ['先写测试再写实现'],
   *   improvements: ['增加单元测试覆盖率']
   * });
   * ```
   */
  async saveRetroRecord(record: RetroRecord): Promise<void> {
    await this.withWriteLock(LOCK_NAMES.RETROS_RECORD, async () => {
      const date = new Date(record.timestamp);
      const yearMonth = date.toISOString().slice(0, 7); // YYYY-MM
      const type = record.type;

      const filePath = join(
        this.warmPath,
        'retros',
        yearMonth,
        type,
        `${record.id}.json`
      );

      await writeJSON(filePath, record);

      // 同时追加到索引
      await this.appendRetroIndex(record);
    });
  }

  /**
   * 追加复盘索引
   */
  private async appendRetroIndex(record: RetroRecord): Promise<void> {
    const indexPath = join(this.warmPath, 'retros', 'index.jsonl');
    await appendJSONL(indexPath, {
      id: record.id,
      timestamp: record.timestamp,
      type: record.type,
      project: record.project,
      summary: record.summary
    });
  }

  /**
   * 获取复盘记录
   *
   * @remarks
   * 并发安全: 使用 SHARED 锁
   */
  async getRetroRecord(id: string): Promise<RetroRecord | null> {
    return this.withReadLock(LOCK_NAMES.RETROS_RECORD, async () => {
      // 在索引中查找
      const indexPath = join(this.warmPath, 'retros', 'index.jsonl');
      const indexRecords = await readJSONL<{
        id: string;
        timestamp: string;
        type: string;
        project: string;
      }>(indexPath);

      const found = indexRecords.find(r => r.id === id);
      if (!found) return null;

      // 读取完整记录
      const date = new Date(found.timestamp);
      const yearMonth = date.toISOString().slice(0, 7);
      const filePath = join(
        this.warmPath,
        'retros',
        yearMonth,
        found.type,
        `${id}.json`
      );

      return await readJSON<RetroRecord>(filePath);
    });
  }

  /**
   * 记录违规
   *
   * @remarks
   * 并发安全: 使用 EXCLUSIVE 锁
   */
  async recordViolation(violation: ViolationRecord): Promise<void> {
    await this.withWriteLock(LOCK_NAMES.VIOLATIONS, async () => {
      const filePath = join(this.warmPath, 'violations.jsonl');
      await appendJSONL(filePath, violation);

      // 清除相关缓存
      this.cache.delete('recent_violations');
    });
  }

  /**
   * 获取最近的违规记录
   *
   * @remarks
   * 并发安全: 使用 SHARED 锁
   */
  async getRecentViolations(limit: number = 10): Promise<ViolationRecord[]> {
    const cacheKey = 'recent_violations';
    const cached = this.getFromCache<ViolationRecord[]>(cacheKey);
    if (cached) return cached;

    return this.withReadLock(LOCK_NAMES.VIOLATIONS, async () => {
      const filePath = join(this.warmPath, 'violations.jsonl');
      const violations = await readJSONL<ViolationRecord>(filePath);
      const recent = violations.slice(-limit);

      this.setCache(cacheKey, recent, 30000); // 缓存30秒
      return recent;
    });
  }

  /**
   * 获取最近的复盘记录
   */
  async getRecentRetros(projectId: string, limit: number = 10): Promise<RetroRecord[]> {
    const indexPath = join(this.warmPath, 'retros', 'index.jsonl');

    try {
      const indexRecords = await readJSONL<{
        id: string;
        timestamp: string;
        type: string;
        project: string;
        summary: string;
      }>(indexPath);

      const projectRetros = indexRecords
        .filter(r => r.project === projectId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      // 获取完整的复盘记录
      const retros: RetroRecord[] = [];
      for (const record of projectRetros) {
        const fullRecord = await this.getRetroRecord(record.id);
        if (fullRecord) {
          retros.push(fullRecord);
        }
      }

      return retros;
    } catch (error) {
      // 如果文件不存在或读取失败，返回空数组
      console.log(`[WARN] 无法读取复盘索引文件: ${error}`);
      return [];
    }
  }

  // ==================== Level-3: Cold 数据访问 ====================

  /**
   * 读取SOP文档
   */
  async readSOP(name: string): Promise<string> {
    const filePath = join(this.coldPath, 'sops', `${name}.md`);
    const { readFile } = await import('fs/promises');
    return await readFile(filePath, 'utf-8');
  }

  /**
   * 读取检查清单
   */
  async readChecklist(name: string): Promise<string> {
    const filePath = join(this.coldPath, 'checklists', `${name}.md`);
    const { readFile } = await import('fs/promises');
    return await readFile(filePath, 'utf-8');
  }

  /**
   * 读取模板
   */
  async readTemplate(name: string): Promise<string> {
    const filePath = join(this.coldPath, 'templates', `${name}.md`);
    const { readFile } = await import('fs/promises');
    return await readFile(filePath, 'utf-8');
  }

  /**
   * 列出所有可用模板
   *
   * @remarks
   * 并发安全: 使用 SHARED 锁
   */
  async listTemplates(): Promise<string[]> {
    return this.withReadLock(LOCK_NAMES.TEMPLATES, async () => {
      const templatePath = join(this.coldPath, 'templates');
      const files = await listFiles(templatePath);
      return files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
    });
  }

  // ==================== 缓存管理 ====================

  /**
   * 从缓存获取数据
   */
  private getFromCache<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return item.data as T;
  }

  /**
   * 设置缓存
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ==================== 统计信息 ====================

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<{
    principles: number;
    successPatterns: number;
    failurePatterns: number;
    retroRecords: number;
    violations: number;
    templates: number;
  }> {
    const [principles, successPatterns, failurePatterns, templates] =
      await Promise.all([
        this.getPrinciples(),
        this.getSuccessPatterns(),
        this.getFailurePatterns(),
        this.listTemplates()
      ]);

    const indexPath = join(this.warmPath, 'retros', 'index.jsonl');
    const retroIndex = await readJSONL(indexPath);

    const violations = await this.getRecentViolations(9999);

    return {
      principles: principles.length,
      successPatterns: successPatterns.length,
      failurePatterns: failurePatterns.length,
      retroRecords: retroIndex.length,
      violations: violations.length,
      templates: templates.length
    };
  }
}

// 导出单例
export const memoryStore = new MemoryStore();
