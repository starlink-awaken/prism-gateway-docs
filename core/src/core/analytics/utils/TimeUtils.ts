/**
 * TimeUtils - 时间工具类
 *
 * @description
 * 提供时间处理相关的工具函数
 *
 * @remarks
 * 包含常用的时间处理：
 * - 日期格式转换
 * - 时间范围计算
 * - 时间戳比较
 * - 时间戳规范化（统一 ISO 8601 格式）
 */

/**
 * 时间工具类
 */
export class TimeUtils {
  /**
   * 将日期转换为日期键（YYYY-MM-DD 格式）
   *
   * @param date - 日期对象或 ISO 字符串
   * @returns 日期键
   *
   * @example
   * ```typescript
   * TimeUtils.toDateKey('2026-02-05T10:30:00Z'); // '2026-02-05'
   * TimeUtils.toDateKey(new Date('2026-02-05')); // '2026-02-05'
   * ```
   */
  static toDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 将日期转换为小时键（YYYY-MM-DD-HH 格式）
   *
   * @param date - 日期对象或 ISO 字符串
   * @returns 小时键
   *
   * @example
   * ```typescript
   * TimeUtils.toHourKey('2026-02-05T10:30:00Z'); // '2026-02-05-10'
   * ```
   */
  static toHourKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dateKey = this.toDateKey(d);
    const hour = String(d.getHours()).padStart(2, '0');
    return `${dateKey}-${hour}`;
  }

  /**
   * 将日期转换为周键（YYYY-Www 格式）
   *
   * @param date - 日期对象或 ISO 字符串
   * @returns 周键
   *
   * @example
   * ```typescript
   * TimeUtils.toWeekKey('2026-02-05T10:30:00Z'); // '2026-W05'
   * ```
   */
  static toWeekKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const week = this.getWeekNumber(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  /**
   * 将日期转换为月键（YYYY-MM 格式）
   *
   * @param date - 日期对象或 ISO 字符串
   * @returns 月键
   *
   * @example
   * ```typescript
   * TimeUtils.toMonthKey('2026-02-05T10:30:00Z'); // '2026-02'
   * ```
   */
  static toMonthKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * 获取周数（ISO 8601 标准）
   *
   * @param date - 日期对象
   * @returns 周数（1-53）
   *
   * @example
   * ```typescript
   * TimeUtils.getWeekNumber(new Date('2026-02-05')); // 5
   * ```
   */
  static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * 检查日期是否在范围内
   *
   * @param date - 要检查的日期
   * @param start - 开始日期
   * @param end - 结束日期
   * @returns 是否在范围内
   *
   * @example
   * ```typescript
   * TimeUtils.isInRange(
   *   new Date('2026-02-05'),
   *   new Date('2026-02-01'),
   *   new Date('2026-02-10')
   * ); // true
   * ```
   */
  static isInRange(date: Date | string, start: Date | string, end: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    const s = typeof start === 'string' ? new Date(start) : start;
    const e = typeof end === 'string' ? new Date(end) : end;
    return d >= s && d <= e;
  }

  /**
   * 计算两个日期之间的天数差
   *
   * @param date1 - 第一个日期
   * @param date2 - 第二个日期
   * @returns 天数差（绝对值）
   *
   * @example
   * ```typescript
   * TimeUtils.daysDiff('2026-02-01', '2026-02-05'); // 4
   * ```
   */
  static daysDiff(date1: Date | string, date2: Date | string): number {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 计算两个日期之间的小时差
   *
   * @param date1 - 第一个日期
   * @param date2 - 第二个日期
   * @returns 小时差（绝对值）
   *
   * @example
   * ```typescript
   * TimeUtils.hoursDiff('2026-02-05T10:00:00Z', '2026-02-05T15:00:00Z'); // 5
   * ```
   */
  static hoursDiff(date1: Date | string, date2: Date | string): number {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60));
  }

  /**
   * 添加天数到日期
   *
   * @param date - 原始日期
   * @param days - 要添加的天数（可为负数）
   * @returns 新日期
   *
   * @example
   * ```typescript
   * TimeUtils.addDays('2026-02-05', 7); // '2026-02-12T00:00:00.000Z'
   * TimeUtils.addDays('2026-02-05', -7); // '2026-01-29T00:00:00.000Z'
   * ```
   */
  static addDays(date: Date | string, days: number): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * 添加小时到日期
   *
   * @param date - 原始日期
   * @param hours - 要添加的小时数（可为负数）
   * @returns 新日期
   *
   * @example
   * ```typescript
   * TimeUtils.addHours('2026-02-05T10:00:00Z', 5); // '2026-02-05T15:00:00.000Z'
   * ```
   */
  static addHours(date: Date | string, hours: number): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(d);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * 格式化日期为 ISO 字符串（UTC）
   *
   * @param date - 日期对象
   * @returns ISO 字符串
   *
   * @example
   * ```typescript
   * TimeUtils.toISOString(new Date('2026-02-05')); // '2026-02-05T00:00:00.000Z'
   * ```
   */
  static toISOString(date: Date): string {
    return date.toISOString();
  }

  /**
   * 解析 ISO 字符串为 Date 对象
   *
   * @param isoString - ISO 字符串
   * @returns Date 对象
   *
   * @example
   * ```typescript
   * TimeUtils.fromISOString('2026-02-05T10:00:00Z'); // Date object
   * ```
   */
  static fromISOString(isoString: string): Date {
    return new Date(isoString);
  }

  /**
   * 获取一天的开始时间（00:00:00）
   *
   * @param date - 日期
   * @returns 一天的开始时间
   *
   * @example
   * ```typescript
   * TimeUtils.startOfDay('2026-02-05T15:30:00Z'); // '2026-02-05T00:00:00.000Z'
   * ```
   */
  static startOfDay(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(d);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * 获取一天的结束时间（23:59:59.999）
   *
   * @param date - 日期
   * @returns 一天的结束时间
   *
   * @example
   * ```typescript
   * TimeUtils.endOfDay('2026-02-05'); // '2026-02-05T23:59:59.999Z'
   * ```
   */
  static endOfDay(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(d);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * 获取一周的开始时间（周一 00:00:00）
   *
   * @param date - 日期
   * @returns 一周的开始时间
   *
   * @example
   * ```typescript
   * TimeUtils.startOfWeek('2026-02-05'); // Monday of that week
   * ```
   */
  static startOfWeek(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一
    const result = new Date(d);
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * 获取一周的结束时间（周日 23:59:59.999）
   *
   * @param date - 日期
   * @returns 一周的结束时间
   *
   * @example
   * ```typescript
   * TimeUtils.endOfWeek('2026-02-05'); // Sunday of that week
   * ```
   */
  static endOfWeek(date: Date | string): Date {
    const start = this.startOfWeek(date);
    const result = this.addDays(start, 6);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * 获取一月的开始时间（1日 00:00:00）
   *
   * @param date - 日期
   * @returns 一月的开始时间
   *
   * @example
   * ```typescript
   * TimeUtils.startOfMonth('2026-02-15'); // '2026-02-01T00:00:00.000Z'
   * ```
   */
  static startOfMonth(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(d);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * 获取一月的结束时间（最后一天 23:59:59.999）
   *
   * @param date - 日期
   * @returns 一月的结束时间
   *
   * @example
   * ```typescript
   * TimeUtils.endOfMonth('2026-02-15'); // '2026-02-28T23:59:59.999Z'
   * ```
   */
  static endOfMonth(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(d);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * 规范化时间戳为 ISO 8601 格式
   *
   * @param timestamp - 时间戳（字符串或 Date）
   * @returns ISO 8601 格式字符串
   *
   * @example
   * ```typescript
   * TimeUtils.normalizeTimestamp('2026-02-05'); // '2026-02-05T00:00:00.000Z'
   * TimeUtils.normalizeTimestamp(new Date()); // ISO 字符串
   * ```
   */
  static normalizeTimestamp(timestamp: string | Date): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toISOString();
  }

  /**
   * 解析时间戳为 Date 对象（统一 UTC）
   *
   * @param timestamp - 时间戳字符串
   * @returns UTC Date 对象
   *
   * @example
   * ```typescript
   * TimeUtils.parseTimestamp('2026-02-05T10:30:00Z'); // Date 对象
   * ```
   */
  static parseTimestamp(timestamp: string): Date {
    return new Date(timestamp);
  }

  /**
   * 验证时间戳格式是否有效
   *
   * @param timestamp - 时间戳字符串
   * @returns 是否有效
   *
   * @example
   * ```typescript
   * TimeUtils.isValidTimestamp('2026-02-05T10:30:00Z'); // true
   * TimeUtils.isValidTimestamp('invalid'); // false
   * ```
   */
  static isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }

  /**
   * 获取时间戳的开始和结束（用于查询范围）
   *
   * @param timestamp - 时间戳
   * @returns 包含开始和结束时间的对象
   *
   * @example
   * ```typescript
   * TimeUtils.getTimestampBounds('2026-02-05');
   * // { start: '2026-02-05T00:00:00.000Z', end: '2026-02-05T23:59:59.999Z' }
   * ```
   */
  static getTimestampBounds(timestamp: string): { start: string; end: string } {
    const date = new Date(timestamp);
    return {
      start: this.toISOString(this.startOfDay(date)),
      end: this.toISOString(this.endOfDay(date))
    };
  }

  /**
   * 转换为 UTC 时区的日期
   *
   * @param date - 日期
   * @returns UTC Date 对象
   *
   * @example
   * ```typescript
   * TimeUtils.toUTC('2026-02-05T10:30:00+08:00'); // UTC 时间
   * ```
   */
  static toUTC(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  }
}
