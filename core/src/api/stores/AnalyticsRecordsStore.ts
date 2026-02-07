/**
 * Analytics Records Store
 *
 * @description
 * 内存存储服务，用于Analytics记录的CRUD操作
 *
 * @features
 * - 内存存储（重启后丢失，可后续改为文件持久化）
 * - CRUD操作
 * - 去重检查
 * - 分页支持
 *
 * @module api/stores/AnalyticsRecordsStore
 */

import { randomUUID } from 'node:crypto';

/**
 * 分析记录接口
 */
export interface AnalyticsRecord {
  id: string;
  type: 'custom' | 'scheduled' | 'adhoc';
  name: string;
  description?: string;
  config?: {
    metrics?: string[];
    period?: string;
    filters?: Record<string, any>;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * 分页结果接口
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 存储服务类
 */
export class AnalyticsRecordsStore {
  private records: Map<string, AnalyticsRecord>;

  constructor() {
    this.records = new Map();
  }

  /**
   * 创建记录
   */
  create(record: Omit<AnalyticsRecord, 'id' | 'createdAt' | 'updatedAt'>): AnalyticsRecord {
    // 检查名称唯一性
    const existing = this.findByName(record.name);
    if (existing) {
      throw new Error(`Record with name "${record.name}" already exists`);
    }

    const newRecord: AnalyticsRecord = {
      ...record,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.records.set(newRecord.id, newRecord);
    return newRecord;
  }

  /**
   * 获取单个记录
   */
  getById(id: string): AnalyticsRecord | null {
    return this.records.get(id) || null;
  }

  /**
   * 按名称查找记录
   */
  findByName(name: string): AnalyticsRecord | null {
    for (const record of this.records.values()) {
      if (record.name === name) {
        return record;
      }
    }
    return null;
  }

  /**
   * 获取所有记录
   */
  getAll(options?: {
    type?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): AnalyticsRecord[] {
    let records = Array.from(this.records.values());

    // 过滤
    if (options?.type) {
      records = records.filter(r => r.type === options.type);
    }

    // 排序
    if (options?.sortBy) {
      records.sort((a, b) => {
        const aValue = a[options.sortBy as keyof AnalyticsRecord];
        const bValue = b[options.sortBy as keyof AnalyticsRecord];

        if (options.sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    }

    return records;
  }

  /**
   * 分页获取记录
   */
  getPaginated(options: {
    page: number;
    limit: number;
    type?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): PaginatedResult<AnalyticsRecord> {
    const allRecords = this.getAll({
      type: options.type,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder
    });

    const total = allRecords.length;
    const totalPages = Math.ceil(total / options.limit);
    const start = (options.page - 1) * options.limit;
    const end = start + options.limit;

    const data = allRecords.slice(start, end);

    return {
      data,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages
      }
    };
  }

  /**
   * 更新记录
   */
  update(id: string, updates: Partial<Omit<AnalyticsRecord, 'id' | 'createdAt' | 'updatedAt'>>): AnalyticsRecord {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error(`Record with id "${id}" not found`);
    }

    // 如果更新name，检查唯一性
    if (updates.name && updates.name !== existing.name) {
      const nameExists = this.findByName(updates.name);
      if (nameExists) {
        throw new Error(`Record with name "${updates.name}" already exists`);
      }
    }

    const updated: AnalyticsRecord = {
      ...existing,
      ...updates,
      id,  // 防止ID被修改
      createdAt: existing.createdAt,  // 防止创建时间被修改
      updatedAt: new Date().toISOString()
    };

    this.records.set(id, updated);
    return updated;
  }

  /**
   * 删除记录
   */
  delete(id: string): void {
    if (!this.records.has(id)) {
      throw new Error(`Record with id "${id}" not found`);
    }

    this.records.delete(id);
  }

  /**
   * 检查记录是否存在
   */
  exists(id: string): boolean {
    return this.records.has(id);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
  } {
    const records = Array.from(this.records.values());

    const byType: Record<string, number> = {};
    for (const record of records) {
      byType[record.type] = (byType[record.type] || 0) + 1;
    }

    return {
      total: records.length,
      byType
    };
  }
}

/**
 * 默认导出
 */
export default AnalyticsRecordsStore;
