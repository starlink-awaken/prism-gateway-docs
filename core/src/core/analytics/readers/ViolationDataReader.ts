/**
 * ViolationDataReader - 违规数据读取器
 *
 * @description
 * 从 violations.jsonl 文件读取违规记录
 *
 * @remarks
 * 数据源：~/.prism-gateway/level-2-warm/violations.jsonl
 *
 * 数据格式（JSONL）：
 * ```json
 * {"id": "...", "timestamp": "...", "principle_id": "...", ...}
 * {"id": "...", "timestamp": "...", "principle_id": "...", ...}
 * ```
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

import type { IDataReader, DataSourceMetadata } from './IDataReader.js';
import type { ViolationRecord } from '../../types/index.js';

/**
 * ViolationDataReader 配置
 */
export interface ViolationDataReaderConfig {
  /**
   * 数据目录路径
   *
   * @default ~/.prism-gateway/level-2-warm
   */
  dataPath?: string;

  /**
   * violations.jsonl 文件名
   *
   * @default violations.jsonl
   */
  fileName?: string;
}

/**
 * ViolationDataReader 类
 *
 * @description
 * 从 violations.jsonl 读取违规记录
 *
 * @example
 * ```typescript
 * const reader = new ViolationDataReader();
 * const start = new Date('2026-02-01');
 * const end = new Date('2026-02-05');
 * const violations = await reader.read(start, end);
 * console.log(`违规数量: ${violations.length}`);
 * ```
 */
export class ViolationDataReader implements IDataReader<ViolationRecord> {
  private readonly violationsPath: string;

  /**
   * 构造函数
   *
   * @param config - 配置选项
   */
  constructor(config: ViolationDataReaderConfig = {}) {
    const dataPath = config.dataPath || join(homedir(), '.prism-gateway', 'level-2-warm');
    const fileName = config.fileName || 'violations.jsonl';
    this.violationsPath = join(dataPath, fileName);
  }

  /**
   * 读取指定时间范围的违规记录
   *
   * @param startTime - 开始时间
   * @param endTime - 结束时间
   * @returns 违规记录列表
   */
  async read(startTime: Date, endTime: Date): Promise<ViolationRecord[]> {
    const all = await this.readAll();

    return all.filter(v => {
      const timestamp = new Date(v.timestamp);
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  /**
   * 读取所有违规记录
   *
   * @returns 所有违规记录列表
   */
  async readAll(): Promise<ViolationRecord[]> {
    // 检查文件是否存在
    if (!existsSync(this.violationsPath)) {
      return [];
    }

    try {
      // 读取文件内容
      const content = await readFile(this.violationsPath, 'utf-8');

      // 按行分割
      const lines = content.trim().split('\n');

      // 过滤空行并解析 JSON
      const violations: ViolationRecord[] = [];

      for (const line of lines) {
        if (line.length === 0) continue;

        try {
          const record = JSON.parse(line) as ViolationRecord;
          violations.push(record);
        } catch {
          // 忽略解析错误的行
          continue;
        }
      }

      return violations;
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
        type: 'violation',
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
      type: 'violation',
      count: all.length,
      oldestTimestamp: sorted[0].timestamp,
      newestTimestamp: sorted[sorted.length - 1].timestamp
    };
  }

  /**
   * 获取文件路径（用于测试）
   *
   * @returns violations.jsonl 文件路径
   */
  getFilePath(): string {
    return this.violationsPath;
  }
}
