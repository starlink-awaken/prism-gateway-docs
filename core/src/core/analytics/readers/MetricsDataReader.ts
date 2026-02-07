/**
 * MetricsDataReader - 指标数据读取器
 *
 * @description
 * 从存储读取性能指标记录
 *
 * @remarks
 * 数据源：可从 violations.jsonl 推算，或从专门的指标存储读取
 * 当前实现：从 ViolationRecord 推算性能指标
 */

import type { IDataReader, DataSourceMetadata } from './IDataReader.js';
import type { MetricsRecord } from '../models/Metrics.js';

/**
 * MetricsDataReader 配置
 */
export interface MetricsDataReaderConfig {
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
 * MetricsDataReader 类
 *
 * @description
 * 读取性能指标数据
 *
 * @example
 * ```typescript
 * const reader = new MetricsDataReader();
 * const start = new Date('2026-02-01');
 * const end = new Date('2026-02-05');
 * const metrics = await reader.read(start, end);
 * console.log(`指标记录数: ${metrics.length}`);
 * ```
 */
export class MetricsDataReader implements IDataReader<MetricsRecord> {
  private readonly dataPath: string;
  private readonly fileName: string;

  /**
   * 构造函数
   *
   * @param config - 配置选项
   */
  constructor(config: MetricsDataReaderConfig = {}) {
    const { homedir } = require('node:os');
    const { join } = require('node:path');

    this.dataPath = config.dataPath || join(homedir(), '.prism-gateway', 'level-2-warm');
    this.fileName = config.fileName || 'violations.jsonl';
  }

  /**
   * 读取指定时间范围的指标记录
   *
   * @param startTime - 开始时间
   * @param endTime - 结束时间
   * @returns 指标记录列表
   */
  async read(startTime: Date, endTime: Date): Promise<MetricsRecord[]> {
    const all = await this.readAll();

    return all.filter(m => {
      const timestamp = m.timestamp ? new Date(m.timestamp) : new Date(m.id);
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  /**
   * 读取所有指标记录
   *
   * @returns 所有指标记录列表
   *
   * @remarks
   * 当前实现：从 violations.jsonl 推算 MetricsRecord
   * 未来：从专门的 metrics 存储读取
   */
  async readAll(): Promise<MetricsRecord[]> {
    const { readFile } = require('node:fs/promises');
    const { join } = require('node:path');
    const { existsSync } = require('node:fs');

    const violationsPath = join(this.dataPath, this.fileName);

    // 检查文件是否存在
    if (!existsSync(violationsPath)) {
      return [];
    }

    try {
      // 读取 violations.jsonl
      const content = await readFile(violationsPath, 'utf-8');
      const lines = content.trim().split('\n');

      const metrics: MetricsRecord[] = [];

      for (const line of lines) {
        if (line.length === 0) continue;

        try {
          const violation = JSON.parse(line);

          // 转换为 MetricsRecord
          metrics.push({
            id: violation.id,
            timestamp: violation.timestamp,
            checkTime: 0, // TODO: 从实际数据源获取
            extractTime: 0, // TODO: 从实际数据源获取
            hasViolation: true,
            retroId: undefined,
            metadata: {
              principle_id: violation.principle_id,
              principle_name: violation.principle_name,
              severity: violation.severity
            }
          });
        } catch {
          // 忽略解析错误的行
          continue;
        }
      }

      return metrics;
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
        type: 'metrics',
        count: 0,
        oldestTimestamp: null,
        newestTimestamp: null
      };
    }

    // 按时间戳排序
    const sorted = [...all].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

    return {
      type: 'metrics',
      count: all.length,
      oldestTimestamp: sorted[0].timestamp || null,
      newestTimestamp: sorted[sorted.length - 1].timestamp || null
    };
  }
}
