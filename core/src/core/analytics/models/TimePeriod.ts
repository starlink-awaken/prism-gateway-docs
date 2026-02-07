/**
 * TimePeriod - 时间范围类型
 *
 * @description
 * 定义 Analytics 查询的时间范围
 *
 * @remarks
 * 支持两种类型的时间范围：
 * 1. 预设范围：today, yesterday, week, last_week, month, last_month, year, last_year
 * 2. 自定义范围：{ start: ISOString, end: ISOString }
 *
 * @example
 * ```typescript
 * const today = TimePeriod.today();
 * const week = TimePeriod.week();
 * const custom = TimePeriod.custom(new Date('2026-01-01'), new Date('2026-01-31'));
 * const range = today.toDateRange(); // { start: Date, end: Date }
 * ```
 */

/**
 * 时间范围值的联合类型
 */
export type TimePeriodValue =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'last_week'
  | 'month'
  | 'last_month'
  | 'year'
  | 'last_year'
  | { start: string; end: string }; // ISO 8601 格式

/**
 * 时间范围对象
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * TimePeriod 类
 *
 * @description
 * 表示一个 Analytics 查询的时间范围
 */
export class TimePeriod {
  constructor(private readonly value: TimePeriodValue) {}

  /**
   * 创建今天的时间范围
   */
  static today(): TimePeriod {
    return new TimePeriod('today');
  }

  /**
   * 创建昨天的时间范围
   */
  static yesterday(): TimePeriod {
    return new TimePeriod('yesterday');
  }

  /**
   *创建本周的时间范围（最近7天）
   */
  static week(): TimePeriod {
    return new TimePeriod('week');
  }

  /**
   * 创建上周的时间范围（7-14天前）
   */
  static lastWeek(): TimePeriod {
    return new TimePeriod('last_week');
  }

  /**
   * 创建本月的时间范围（最近30天）
   */
  static month(): TimePeriod {
    return new TimePeriod('month');
  }

  /**
   * 创建上月的时间范围（30-60天前）
   */
  static lastMonth(): TimePeriod {
    return new TimePeriod('last_month');
  }

  /**
   * 创建本年的时间范围（最近365天）
   */
  static year(): TimePeriod {
    return new TimePeriod('year');
  }

  /**
   * 创建去年的时间范围（365-730天前）
   */
  static lastYear(): TimePeriod {
    return new TimePeriod('last_year');
  }

  /**
   * 创建自定义时间范围
   *
   * @param start - 开始日期
   * @param end - 结束日期
   */
  static custom(start: Date, end: Date): TimePeriod {
    return new TimePeriod({
      start: start.toISOString(),
      end: end.toISOString()
    });
  }

  /**
   * 从字符串创建 TimePeriod
   *
   * @param s - 时间范围字符串或 JSON 对象字符串
   */
  static fromString(s: string): TimePeriod {
    try {
      // 尝试解析为 JSON 对象
      const parsed = JSON.parse(s);
      if (typeof parsed === 'object' && 'start' in parsed && 'end' in parsed) {
        return new TimePeriod(parsed as { start: string; end: string });
      }
    } catch {
      // 不是 JSON，当作预设范围处理
    }
    return new TimePeriod(s as TimePeriodValue);
  }

  /**
   * 转换为 DateRange 对象
   *
   * @returns 包含 start 和 end 的 Date 对象
   */
  toDateRange(): DateRange {
    const now = new Date();

    switch (this.value) {
      case 'today': {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { start, end: new Date() };
      }

      case 'yesterday': {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setHours(23, 59, 59, 999);

        return { start, end };
      }

      case 'week': {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        return { start, end: new Date() };
      }

      case 'last_week': {
        const end = new Date(now);
        end.setDate(end.getDate() - 7);

        const start = new Date(end);
        start.setDate(start.getDate() - 7);

        return { start, end };
      }

      case 'month': {
        const start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        return { start, end: new Date() };
      }

      case 'last_month': {
        const end = new Date(now);
        end.setMonth(end.getMonth() - 1);

        const start = new Date(end);
        start.setMonth(start.getMonth() - 1);

        return { start, end };
      }

      case 'year': {
        const start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        return { start, end: new Date() };
      }

      case 'last_year': {
        const end = new Date(now);
        end.setFullYear(end.getFullYear() - 1);

        const start = new Date(end);
        start.setFullYear(start.getFullYear() - 1);

        return { start, end };
      }

      default: {
        // 自定义时间范围
        if (typeof this.value === 'object' && 'start' in this.value && 'end' in this.value) {
          return {
            start: new Date(this.value.start),
            end: new Date(this.value.end)
          };
        }
        throw new Error(`Invalid TimePeriod value: ${this.value}`);
      }
    }
  }

  /**
   * 转换为字符串表示
   *
   * @returns 时间范围的字符串表示
   */
  toString(): string {
    if (typeof this.value === 'object') {
      return `${this.value.start}/${this.value.end}`;
    }
    return this.value;
  }

  /**
   * 获取原始值
   *
   * @returns TimePeriodValue
   */
  getValue(): TimePeriodValue {
    return this.value;
  }

  /**
   * 检查是否是预设范围
   *
   * @returns 是否是预设范围
   */
  isPreset(): boolean {
    return typeof this.value === 'string';
  }

  /**
   * 检查是否是自定义范围
   *
   * @returns 是否是自定义范围
   */
  isCustom(): boolean {
    return typeof this.value === 'object';
  }
}
