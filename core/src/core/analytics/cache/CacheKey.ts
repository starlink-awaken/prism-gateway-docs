/**
 * CacheKey - 缓存键生成工具
 *
 * @description
 * 为 Analytics 查询生成一致的缓存键
 *
 * @remarks
 * 缓存键格式：
 * - analytics:usage:{period}
 * - analytics:quality:{period}
 * - analytics:performance:{period}
 * - analytics:trend:{metric}:{period}
 * - analytics:dashboard:{period}
 */

import { TimePeriod } from '../models/TimePeriod.js';

/**
 * 缓存键生成类
 */
export class CacheKey {
  /**
   * 生成使用指标的缓存键
   *
   * @param period - 时间范围
   * @returns 缓存键
   *
   * @example
   * ```typescript
   * CacheKey.forUsage(TimePeriod.week()); // 'analytics:usage:week'
   * ```
   */
  static forUsage(period: TimePeriod): string {
    return `analytics:usage:${period.toString()}`;
  }

  /**
   * 生成质量指标的缓存键
   *
   * @param period - 时间范围
   * @returns 缓存键
   *
   * @example
   * ```typescript
   * CacheKey.forQuality(TimePeriod.month()); // 'analytics:quality:month'
   * ```
   */
  static forQuality(period: TimePeriod): string {
    return `analytics:quality:${period.toString()}`;
  }

  /**
   * 生成性能指标的缓存键
   *
   * @param period - 时间范围
   * @returns 缓存键
   *
   * @example
   * ```typescript
   * CacheKey.forPerformance(TimePeriod.today()); // 'analytics:performance:today'
   * ```
   */
  static forPerformance(period: TimePeriod): string {
    return `analytics:performance:${period.toString()}`;
  }

  /**
   * 生成趋势分析的缓存键
   *
   * @param metric - 指标名称
   * @param period - 时间范围
   * @returns 缓存键
   *
   * @example
   * ```typescript
   * CacheKey.forTrend('violations', TimePeriod.month()); // 'analytics:trend:violations:month'
   * ```
   */
  static forTrend(metric: string, period: TimePeriod): string {
    return `analytics:trend:${metric}:${period.toString()}`;
  }

  /**
   * 生成异常检测的缓存键
   *
   * @returns 缓存键
   *
   * @example
   * ```typescript
   * CacheKey.forAnomalies(); // 'analytics:anomalies'
   * ```
   */
  static forAnomalies(): string {
    return 'analytics:anomalies';
  }

  /**
   * 生成仪表板的缓存键
   *
   * @param period - 时间范围
   * @returns 缓存键
   *
   * @example
   * ```typescript
   * CacheKey.forDashboard(TimePeriod.week()); // 'analytics:dashboard:week'
   * ```
   */
  static forDashboard(period: TimePeriod): string {
    return `analytics:dashboard:${period.toString()}`;
  }

  /**
   * 生成自定义缓存键
   *
   * @param parts - 缓存键的各个部分
   * @returns 缓存键
   *
   * @example
   * ```typescript
   * CacheKey.custom(['analytics', 'custom', 'key']); // 'analytics:custom:key'
   * ```
   */
  static custom(...parts: string[]): string {
    return parts.join(':');
  }

  /**
   * 解析缓存键的类型
   *
   * @param key - 缓存键
   * @returns 缓存键的类型（usage, quality, performance, trend, anomalies, dashboard 等）
   *
   * @example
   * ```typescript
   * CacheKey.parseType('analytics:usage:week'); // 'usage'
   * CacheKey.parseType('analytics:trend:violations:month'); // 'trend'
   * ```
   */
  static parseType(key: string): string | null {
    const parts = key.split(':');
    if (parts.length < 2 || parts[0] !== 'analytics') {
      return null;
    }
    return parts[1];
  }

  /**
   * 从缓存键中提取时间范围
   *
   * @param key - 缓存键
   * @returns 时间范围字符串，如果不存在则返回 null
   *
   * @example
   * ```typescript
   * CacheKey.extractPeriod('analytics:usage:week'); // 'week'
   * CacheKey.extractPeriod('analytics:trend:violations:month'); // 'month'
   * ```
   */
  static extractPeriod(key: string): string | null {
    const parts = key.split(':');
    const lastPart = parts[parts.length - 1];
    // 检查是否是时间范围（预设范围或自定义范围）
    if (
      ['today', 'yesterday', 'week', 'last_week', 'month', 'last_month', 'year', 'last_year'].includes(lastPart) ||
      lastPart.includes('/')
    ) {
      return lastPart;
    }
    return null;
  }

  /**
   * 验证缓存键是否有效
   *
   * @param key - 缓存键
   * @returns 是否有效
   *
   * @example
   * ```typescript
   * CacheKey.isValid('analytics:usage:week'); // true
   * CacheKey.isValid('invalid:key'); // false
   * ```
   */
  static isValid(key: string): boolean {
    return key.startsWith('analytics:') && key.split(':').length >= 2;
  }

  /**
   * 生成缓存键的模式（用于批量删除）
   *
   * @param type - 缓存键类型（可选）
   * @returns 缓存键模式
   *
   * @example
   * ```typescript
   * CacheKey.pattern('usage'); // 'analytics:usage:*'
   * CacheKey.pattern(); // 'analytics:*'
   * ```
   */
  static pattern(type?: string): string {
    return type ? `analytics:${type}:*` : 'analytics:*';
  }
}
