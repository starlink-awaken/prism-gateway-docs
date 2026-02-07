/**
 * IDataReader - 数据读取器接口
 *
 * @description
 * 定义数据读取的通用契约，支持多种数据源
 *
 * @remarks
 * 设计原则：
 * - 依赖倒置：依赖抽象接口而非具体实现
 * - 单一职责：只负责数据读取，不负责数据处理
 * - 开闭原则：易于扩展新的数据源类型
 *
 * @example
 * ```typescript
 * class RetroDataReader implements IDataReader<RetroRecord> {
 *   async read(startTime: Date, endTime: Date): Promise<RetroRecord[]> {
 *     // 读取指定时间范围的数据
 *   }
 * }
 * ```
 */

/**
 * 数据源元信息
 *
 * @description
 * 描述数据源的元数据
 */
export interface DataSourceMetadata {
  /**
   * 数据源类型
   *
   * @example
   * 'retrospective' | 'violation' | 'metrics'
   */
  type: string;

  /**
   * 数据总数
   */
  count: number;

  /**
   * 最早时间戳（ISO 8601）
   *
   * @remarks
   * 如果没有数据则为 null
   */
  oldestTimestamp: string | null;

  /**
   * 最晚时间戳（ISO 8601）
   *
   * @remarks
   * 如果没有数据则为 null
   */
  newestTimestamp: string | null;
}

/**
 * IDataReader - 数据读取器接口
 *
 * @description
 * 定义数据读取的通用操作
 *
 * @typeParam T - 读取的数据类型
 *
 * @remarks
 * 所有数据读取器必须实现此接口
 */
export interface IDataReader<T> {
  /**
   * 读取指定时间范围的数据
   *
   * @param startTime - 开始时间（包含）
   * @param endTime - 结束时间（包含）
   * @returns 符合时间范围的数据列表
   *
   * @example
   * ```typescript
   * const reader = new RetroDataReader(memoryStore);
   * const start = new Date('2026-02-01');
   * const end = new Date('2026-02-05');
   * const retros = await reader.read(start, end);
   * ```
   */
  read(startTime: Date, endTime: Date): Promise<T[]>;

  /**
   * 读取所有数据
   *
   * @returns 所有数据列表
   *
   * @remarks
   * 注意：对于大数据集，此方法可能消耗大量内存
   *
   * @example
   * ```typescript
   * const allRetros = await reader.readAll();
   * console.log(`总复盘数: ${allRetros.length}`);
   * ```
   */
  readAll(): Promise<T[]>;

  /**
   * 获取数据源信息
   *
   * @returns 数据源元数据
   *
   * @example
   * ```typescript
   * const metadata = await reader.getMetadata();
   * console.log(`数据源类型: ${metadata.type}`);
   * console.log(`数据总数: ${metadata.count}`);
   * console.log(`时间范围: ${metadata.oldestTimestamp} - ${metadata.newestTimestamp}`);
   * ```
   */
  getMetadata(): Promise<DataSourceMetadata>;
}
