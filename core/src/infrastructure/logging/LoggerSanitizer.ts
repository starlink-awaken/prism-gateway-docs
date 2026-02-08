/**
 * 日志脱敏工具
 *
 * @description
 * 防止日志注入攻击，过滤敏感信息，解决SEC-007威胁
 *
 * @features
 * - 日志注入防护（过滤换行符和控制字符）
 * - 敏感信息自动过滤
 * - 结构化日志格式化
 * - 高性能（<1ms for 短文本）
 *
 * @module infrastructure/logging/LoggerSanitizer
 */

import * as crypto from 'node:crypto';

/**
 * 脱敏配置接口
 */
export interface SanitizerConfig {
  /**
   * 是否过滤邮箱地址
   * @default false
   */
  redactEmails?: boolean;

  /**
   * 是否过滤IP地址
   * @default false
   */
  redactIPs?: boolean;

  /**
   * 自定义敏感字段列表
   */
  sensitiveFields?: string[];
}

/**
 * 默认敏感字段
 */
const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'credit_card',
  'ssn',
  'pin'
];

/**
 * 敏感信息正则表达式
 */
const SENSITIVE_PATTERNS = [
  // 密码
  { pattern: /password["\s:=]+["']?([^"'\s]+)/gi, replacement: 'password=[REDACTED]' },
  // API Key (sk-...) - 调整为15-50个字符
  { pattern: /sk-[a-zA-Z0-9]{15,50}/g, replacement: '[REDACTED]' },
  // JWT Token
  { pattern: /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED]' },
  // JWT (eyJ...)
  { pattern: /eyJ[a-zA-Z0-9\-_.]+\.[a-zA-Z0-9\-_.]+\.[a-zA-Z0-9\-_.]+/g, replacement: '[REDACTED]' },
  // 数据库连接字符串 - 移除协议部分
  { pattern: /(postgresql|mysql|mongodb|mssql):\/\/[^@\s]+/gi, replacement: '[REDACTED]' },
  // 信用卡号 (Luhn算法格式)
  { pattern: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, replacement: '[REDACTED]' },
  // 邮箱（可选）
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED]' },
  // IP地址（可选）
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[REDACTED]' }
];

/**
 * ANSI转义序列
 */
const ANSI_ESCAPE = /[\x1b\x9b][[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * 危险控制字符（除Tab外的所有控制字符）
 */
const CONTROL_CHARS = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g;

/**
 * 日志脱敏工具类
 */
export class LoggerSanitizer {
  private config: Required<SanitizerConfig>;
  private sensitiveFields: Set<string>;

  /**
   * 构造函数
   *
   * @param config - 脱敏配置
   */
  constructor(config: SanitizerConfig = {}) {
    this.config = {
      redactEmails: config.redactEmails || false,
      redactIPs: config.redactIPs || false,
      sensitiveFields: config.sensitiveFields || [...DEFAULT_SENSITIVE_FIELDS]
    };

    this.sensitiveFields = new Set(this.config.sensitiveFields);
  }

  /**
   * 脱敏日志消息
   *
   * @param input - 原始日志消息
   * @returns 脱敏后的消息
   */
  sanitize(input: string): string {
    if (!input) return '';

    let sanitized = input;

    // 1. 过滤ANSI转义序列
    sanitized = sanitized.replace(ANSI_ESCAPE, '');

    // 2. 过滤危险控制字符（除Tab外）
    sanitized = sanitized.replace(CONTROL_CHARS, '');

    // 3. 防止日志注入：替换换行符为空格
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');

    // 4. 规范化多个连续空格为单个空格
    sanitized = sanitized.replace(/ +/g, ' ');

    // 5. 过滤敏感信息
    sanitized = this.redactSensitiveInfo(sanitized);

    return sanitized;
  }

  /**
   * 格式化结构化日志
   *
   * @param data - 日志数据
   * @returns JSON格式的日志字符串
   */
  formatStructured(data: Record<string, any>): string {
    const sanitized: Record<string, any> = {
      timestamp: new Date().toISOString()
    };

    // 脱敏每个字段
    for (const [key, value] of Object.entries(data)) {
      if (this.shouldRedact(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitize(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return JSON.stringify(sanitized);
  }

  /**
   * 判断字段是否需要脱敏
   *
   * @param fieldName - 字段名
   * @returns 是否需要脱敏
   */
  private shouldRedact(fieldName: string): boolean {
    const lowerName = fieldName.toLowerCase();

    // 检查是否在敏感字段列表中
    if (this.sensitiveFields.has(lowerName)) {
      return true;
    }

    // 检查邮箱脱敏
    if (this.config.redactEmails && lowerName.includes('email')) {
      return true;
    }

    // 检查IP脱敏
    if (this.config.redactIPs && (lowerName.includes('ip') || lowerName.includes('address'))) {
      return true;
    }

    return false;
  }

  /**
   * 过滤敏感信息
   *
   * @param text - 原始文本
   * @returns 过滤后的文本
   */
  private redactSensitiveInfo(text: string): string {
    let redacted = text;

    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      // 跳过邮箱和IP（如果未启用）
      if (!this.config.redactEmails && pattern.source.includes('A-Za-z0-9._%+-')) {
        continue;
      }
      if (!this.config.redactIPs && pattern.source.includes('\\d{1,3}\\.\\d{1,3}')) {
        continue;
      }

      redacted = redacted.replace(pattern, replacement);
    }

    return redacted;
  }

  /**
   * 递归脱敏对象
   *
   * @param obj - 原始对象
   * @returns 脱敏后的对象
   */
  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item =>
        typeof item === 'string' ? this.sanitize(item) :
        typeof item === 'object' && item !== null ? this.sanitizeObject(item) :
        item
      );
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.shouldRedact(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitize(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * 默认导出
 */
export default LoggerSanitizer;
