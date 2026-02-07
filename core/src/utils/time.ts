/**
 * P0-5: UTC 时间戳统一处理
 *
 * @description
 * 提供统一的 UTC 时间戳处理功能，确保所有时间都以 UTC 格式存储和处理。
 * 避免时区混淆和本地时间导致的错误。
 *
 * 主要功能:
 * - normalizeTimestamp: 将各种时间格式统一为 UTC ISO 8601 字符串
 * - getYearMonthUTC: 返回 UTC 年月字符串
 * - getCurrentTimestampUTC: 获取当前 UTC 时间戳
 * - isValidTimestamp: 验证时间戳有效性
 * - parseTimestampUTC: 解析时间戳为 Date 对象
 * - formatTimestampUTC: 格式化时间戳
 *
 * @module utils/time
 */

/**
 * 支持的时间戳格式
 */
export type TimestampFormat =
  | 'ISO_8601'      // 2026-01-15T12:30:45.123Z
  | 'DATE'          // 2026-01-15
  | 'TIME'          // 12:30:45
  | 'DATETIME'      // 2026-01-15 12:30:45
  | 'YEAR_MONTH';   // 2026-01

/**
 * 时间戳输入类型
 */
type TimestampInput =
  | Date
  | string
  | number;

/**
 * 验证时间是否在有效范围内
 *
 * @param date - 待验证的 Date 对象
 * @returns 是否在有效范围内
 *
 * @description
 * 有效范围：1970-01-01 到当前时间 + 1 年
 * - 拒绝 Unix 纪元之前的时间（Date 支持的最早时间）
 * - 拒绝超过 1 年的未来时间（可能是错误输入）
 */
function isDateInValidRange(date: Date): boolean {
  if (isNaN(date.getTime())) {
    return false;
  }

  const unixEpoch = new Date('1970-01-01T00:00:00.000Z').getTime();
  const now = Date.now();
  const maxFuture = now + (365 * 24 * 60 * 60 * 1000); // 当前时间 + 1 年

  const timestamp = date.getTime();

  return timestamp >= unixEpoch && timestamp <= maxFuture;
}

/**
 * 将各种时间格式统一为 UTC ISO 8601 字符串
 *
 * @param input - 时间戳输入（Date、字符串或数字）
 * @returns UTC ISO 8601 格式的时间戳字符串 (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @throws 如果输入无效或超出有效范围
 *
 * @example
 * ```ts
 * normalizeTimestamp(new Date('2026-01-15T12:30:45Z'))
 * // => "2026-01-15T12:30:45.000Z"
 *
 * normalizeTimestamp('2026-01-15T12:30:45+08:00')
 * // => "2026-01-15T04:30:45.000Z"
 *
 * normalizeTimestamp(1736941845000)
 * // => "2026-01-15T12:30:45.000Z"
 * ```
 */
export function normalizeTimestamp(input: TimestampInput): string {
  let date: Date;

  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string') {
    // 尝试解析字符串
    // 处理 Unix 时间戳字符串
    if (/^\d+$/.test(input.trim())) {
      const timestamp = parseInt(input, 10);
      // 判断是秒还是毫秒
      const isSeconds = timestamp < 10000000000;
      date = new Date(isSeconds ? timestamp * 1000 : timestamp);
    } else {
      // 处理日期时间格式
      const trimmed = input.trim();

      // YYYY-MM-DD 格式
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        date = new Date(trimmed + 'T00:00:00.000Z');
      }
      // YYYY-MM-DD HH:mm:ss 格式
      else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
        date = new Date(trimmed.replace(' ', 'T') + '.000Z');
      }
      // ISO 8601 格式或其他
      else {
        date = new Date(trimmed);
      }
    }
  } else if (typeof input === 'number') {
    // 判断是秒还是毫秒
    const isMilliseconds = input > 10000000000;
    date = new Date(isMilliseconds ? input : input * 1000);
  } else {
    throw new Error(`无效的时间戳输入类型: ${typeof input}`);
  }

  // 验证日期有效性
  if (isNaN(date.getTime())) {
    throw new Error(`无效的时间戳: ${String(input)}`);
  }

  // 验证日期范围
  if (!isDateInValidRange(date)) {
    throw new Error(`时间戳超出有效范围: ${String(input)}`);
  }

  // 返回 UTC ISO 8601 格式
  return date.toISOString();
}

/**
 * 获取指定时间戳的 UTC 年月字符串
 *
 * @param input - 时间戳输入
 * @returns YYYY-MM 格式的年月字符串
 * @throws 如果输入无效
 *
 * @example
 * ```ts
 * getYearMonthUTC('2026-01-15T12:30:45Z')
 * // => "2026-01"
 *
 * getYearMonthUTC('2026-12-31T23:59:59Z')
 * // => "2026-12"
 * ```
 */
export function getYearMonthUTC(input: TimestampInput): string {
  const normalized = normalizeTimestamp(input);
  const date = new Date(normalized);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

/**
 * 获取当前 UTC 时间戳
 *
 * @returns 当前时间的 UTC ISO 8601 字符串
 *
 * @example
 * ```ts
 * getCurrentTimestampUTC()
 * // => "2026-01-15T12:30:45.123Z"
 * ```
 */
export function getCurrentTimestampUTC(): string {
  return new Date().toISOString();
}

/**
 * 验证时间戳是否有效
 *
 * @param input - 待验证的时间戳
 * @returns 是否为有效的时间戳
 *
 * @description
 * 有效时间戳需要满足:
 * - 可以解析为有效的 Date 对象
 * - 在有效时间范围内（1970-01-01 到当前时间 + 1 年）
 *
 * @example
 * ```ts
 * isValidTimestamp('2026-01-15T12:30:45Z')  // => true
 * isValidTimestamp('invalid-date')          // => false
 * isValidTimestamp(-1)                       // => false
 * ```
 */
export function isValidTimestamp(input: unknown): boolean {
  if (input === null || input === undefined) {
    return false;
  }

  try {
    if (typeof input === 'number') {
      if (input < 0 || isNaN(input)) {
        return false;
      }
      const date = new Date(input > 10000000000 ? input : input * 1000);
      return isDateInValidRange(date) && !isNaN(date.getTime());
    }

    if (input instanceof Date) {
      return !isNaN(input.getTime()) && isDateInValidRange(input);
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed === '') {
        return false;
      }

      // 尝试解析
      const date = new Date(trimmed);
      return !isNaN(date.getTime()) && isDateInValidRange(date);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 解析时间戳为 Date 对象（UTC）
 *
 * @param input - 时间戳输入
 * @returns Date 对象（时间已转换为 UTC）
 * @throws 如果输入无效
 *
 * @example
 * ```ts
 * parseTimestampUTC('2026-01-15T12:30:45+08:00')
 * // => Date 对象，表示 2026-01-15T04:30:45Z
 * ```
 */
export function parseTimestampUTC(input: TimestampInput): Date {
  const normalized = normalizeTimestamp(input);
  return new Date(normalized);
}

/**
 * 格式化时间戳为指定格式
 *
 * @param input - 时间戳输入
 * @param format - 目标格式
 * @returns 格式化后的字符串
 * @throws 如果输入无效或格式不支持
 *
 * @example
 * ```ts
 * formatTimestampUTC('2026-01-15T12:30:45.123Z', 'DATE')
 * // => "2026-01-15"
 *
 * formatTimestampUTC('2026-01-15T12:30:45.123Z', 'TIME')
 * // => "12:30:45"
 *
 * formatTimestampUTC('2026-01-15T12:30:45.123Z', 'DATETIME')
 * // => "2026-01-15 12:30:45"
 * ```
 */
export function formatTimestampUTC(input: TimestampInput, format: TimestampFormat): string {
  const normalized = normalizeTimestamp(input);
  const date = new Date(normalized);

  switch (format) {
    case 'ISO_8601':
      return normalized;

    case 'DATE': {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    case 'TIME': {
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }

    case 'DATETIME': {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    case 'YEAR_MONTH':
      return getYearMonthUTC(normalized);

    default:
      throw new Error(`不支持的时间格式: ${format}`);
  }
}

/**
 * 计算两个时间戳之间的差值（毫秒）
 *
 * @param a - 第一个时间戳
 * @param b - 第二个时间戳
 * @returns 差值（毫秒），a - b
 *
 * @example
 * ```ts
 * const diff = timestampDiff('2026-01-15T13:00:00Z', '2026-01-15T12:00:00Z');
 * // => 3600000 (1 小时)
 * ```
 */
export function timestampDiff(a: TimestampInput, b: TimestampInput): number {
  const dateA = parseTimestampUTC(a);
  const dateB = parseTimestampUTC(b);
  return dateA.getTime() - dateB.getTime();
}

/**
 * 向时间戳添加指定的时间偏移
 *
 * @param input - 基础时间戳
 * @param offset - 毫秒偏移量（正数向后，负数向前）
 * @returns 新的时间戳（ISO 8601 UTC）
 *
 * @example
 * ```ts
 * addOffset('2026-01-15T12:00:00Z', 3600000)
 * // => "2026-01-15T13:00:00.000Z"
 * ```
 */
export function addOffset(input: TimestampInput, offset: number): string {
  const date = parseTimestampUTC(input);
  const newDate = new Date(date.getTime() + offset);
  return newDate.toISOString();
}

/**
 * 比较两个时间戳
 *
 * @param a - 第一个时间戳
 * @param b - 第二个时间戳
 * @returns 比较结果：-1 (a < b), 0 (a === b), 1 (a > b)
 *
 * @example
 * ```ts
 * compareTimestamps('2026-01-15T11:00:00Z', '2026-01-15T12:00:00Z')
 * // => -1
 * ```
 */
export function compareTimestamps(a: TimestampInput, b: TimestampInput): number {
  const timeA = parseTimestampUTC(a).getTime();
  const timeB = parseTimestampUTC(b).getTime();

  if (timeA < timeB) return -1;
  if (timeA > timeB) return 1;
  return 0;
}

/**
 * 时间工具类
 *
 * @description
 * 提供 OOP 风格的时间操作接口
 */
export class TimeUtils {
  private timestamp: string;

  constructor(input: TimestampInput) {
    this.timestamp = normalizeTimestamp(input);
  }

  /**
   * 获取存储的时间戳
   */
  getISO(): string {
    return this.timestamp;
  }

  /**
   * 格式化时间戳
   */
  format(format: TimestampFormat): string {
    return formatTimestampUTC(this.timestamp, format);
  }

  /**
   * 添加偏移量
   */
  add(milliseconds: number): TimeUtils {
    return new TimeUtils(addOffset(this.timestamp, milliseconds));
  }

  /**
   * 减去偏移量
   */
  subtract(milliseconds: number): TimeUtils {
    return this.add(-milliseconds);
  }

  /**
   * 与另一个时间戳比较
   */
  compare(other: TimestampInput): number {
    return compareTimestamps(this.timestamp, other);
  }

  /**
   * 获取年月
   */
  getYearMonth(): string {
    return getYearMonthUTC(this.timestamp);
  }

  /**
   * 获取 Date 对象
   */
  toDate(): Date {
    return new Date(this.timestamp);
  }

  /**
   * 获取 Unix 时间戳（毫秒）
   */
  toUnix(): number {
    return this.toDate().getTime();
  }
}

/**
 * 工厂函数：创建 TimeUtils 实例
 *
 * @param input - 时间戳输入
 * @returns TimeUtils 实例
 *
 * @example
 * ```ts
 * const time = time('2026-01-15T12:00:00Z');
 * time.format('DATE');        // => "2026-01-15"
 * time.add(3600000).format(); // => "2026-01-15T13:00:00.000Z"
 * ```
 */
export function time(input: TimestampInput): TimeUtils {
  return new TimeUtils(input);
}

/**
 * 导出常量
 */
export const TIME_CONSTANTS = {
  MILLISECOND: 1,
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000, // 近似值
  YEAR: 365 * 24 * 60 * 60 * 1000  // 近似值
} as const;

/**
 * 导出类型
 */
export type { TimestampInput };
