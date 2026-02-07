/**
 * RetroDataReader - 复盘数据读取器
 *
 * @description
 * 从 MemoryStore 读取复盘记录
 *
 * @remarks
 * 数据源：~/.prism-gateway/level-2-warm/retros/
 *
 * 数据格式：JSON 文件，每个文件一个复盘记录
 */

import type { IDataReader, DataSourceMetadata } from './IDataReader.js';
import type { RetroRecord } from '../../types/index.js';

/**
 * MemoryStore 接口（最小化定义）
 *
 * @description
 * 定义 MemoryStore 的核心方法，用于类型检查
 */
interface IMemoryStore {
  listAllRetros(): Promise<RetroRecord[]>;
  getRetroRecord(id: string): Promise<RetroRecord | null>;
}

/**
 * RetroDataReader 配置
 */
export interface RetroDataReaderConfig {
  /**
   * MemoryStore 实例
   */
  memoryStore: IMemoryStore;
}

/**
 * RetroDataReader 类
 *
 * @description
 * 从 MemoryStore 读取复盘记录
 *
 * @example
 * ```typescript
 * const reader = new RetroDataReader({ memoryStore });
 * const start = new Date('2026-02-01');
 * const end = new Date('2026-02-05');
 * const retros = await reader.read(start, end);
 * console.log(`复盘数量: ${retros.length}`);
 * ```
 */
export class RetroDataReader implements IDataReader<RetroRecord> {
  private readonly memoryStore: IMemoryStore;

  /**
   * 构造函数
   *
   * @param config - 配置选项
   */
  constructor(config: RetroDataReaderConfig) {
    this.memoryStore = config.memoryStore;
  }

  /**
   * 读取指定时间范围的复盘记录
   *
   * @param startTime - 开始时间
   * @param endTime - 结束时间
   * @returns 复盘记录列表
   */
  async read(startTime: Date, endTime: Date): Promise<RetroRecord[]> {
    const all = await this.readAll();

    return all.filter(r => {
      const timestamp = new Date(r.timestamp);
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  /**
   * 读取所有复盘记录
   *
   * @returns 所有复盘记录列表
   */
  async readAll(): Promise<RetroRecord[]> {
    try {
      return await this.memoryStore.listAllRetros();
    } catch {
      // 读取失败，返回空数组
      return [];
    }
  }

  /**
   * 获取数据源信息
   *
   * @returns 数据源元数据
   */
  async getMetadata(): Promise<DataSourceMetadata> {
    const all = await this.readAll();

    if (all.length === 0) {
      return {
        type: 'retrospective',
        count: 0,
        oldestTimestamp: null,
        newestTimestamp: null
      };
    }

    // 按时间戳排序
    const sorted = [...all].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      type: 'retrospective',
      count: all.length,
      oldestTimestamp: sorted[0].timestamp,
      newestTimestamp: sorted[sorted.length - 1].timestamp
    };
  }
}
