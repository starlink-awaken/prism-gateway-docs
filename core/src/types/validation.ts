/**
 * P0-4: Zod 运行时类型验证
 *
 * @description
 * 使用 Zod 库提供运行时类型验证，防止：
 * 1. 无效的 ID 格式
 * 2. 未来时间戳
 * 3. 字段长度超限
 * 4. 原型污染攻击
 *
 * @module types/validation
 */

import { z } from 'zod';

/**
 * Retro ID 正则表达式
 *
 * 格式: retro_YYYYMMDD_HHMMSS_<uuid-suffix>
 * - YYYY: 年份 (4位)
 * - MM: 月份 (01-12)
 * - DD: 日期 (01-31)
 * - HH: 小时 (00-23)
 * - MM: 分钟 (00-59)
 * - SS: 秒 (00-59)
 * - uuid-suffix: UUID 或类似的唯一标识符 (至少6个字符)
 */
const RETRO_ID_REGEX = /^retro_(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])_([01]\d|2[0-3])([0-5]\d)([0-5]\d)_[a-zA-Z0-9_-]{6,}$/;

/**
 * 验证 ID 中的日期时间是否有效
 *
 * @param id - 待验证的 ID
 * @returns 日期时间是否有效
 */
function isValidDateTimeInId(id: string): boolean {
  const match = id.match(RETRO_ID_REGEX);
  if (!match) return false;

  const [, year, month, day, hour, minute, second] = match;

  // 转换为数字验证
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  const hourNum = parseInt(hour, 10);
  const minuteNum = parseInt(minute, 10);
  const secondNum = parseInt(second, 10);

  // 验证日期是否真实存在（例如 2月30日无效）
  const date = new Date(yearNum, monthNum - 1, dayNum);
  return (
    date.getFullYear() === yearNum &&
    date.getMonth() === monthNum - 1 &&
    date.getDate() === dayNum &&
    hourNum >= 0 && hourNum <= 23 &&
    minuteNum >= 0 && minuteNum <= 59 &&
    secondNum >= 0 && secondNum <= 59
  );
}

/**
 * Retro ID Zod schema
 *
 * 验证 ID 格式并检查日期时间的有效性
 */
const RetroIdSchema = z.string()
  .min(1, 'ID 不能为空')
  .refine(id => RETRO_ID_REGEX.test(id), {
    message: 'ID 格式无效，应为 retro_YYYYMMDD_HHMMSS_<uuid> 格式'
  })
  .refine(isValidDateTimeInId, {
    message: 'ID 中包含无效的日期时间'
  })
  .transform(id => id.toLowerCase());

/**
 * 时间戳验证
 *
 * 拒绝未来的时间戳，只接受过去或当前时间
 */
const TimestampSchema = z.string()
  .datetime({ message: '时间戳必须是有效的 ISO 8601 格式' })
  .refine(timestamp => {
    const date = new Date(timestamp);
    const now = new Date();
    return date <= now;
  }, {
    message: '时间戳不能是未来时间'
  });

/**
 * 复盘类型枚举
 */
const RetroTypeSchema = z.enum(['quick', 'standard', 'deep'], {
  errorMap: () => ({ message: 'type 必须是 quick、standard 或 deep 之一' })
});

/**
 * 项目 ID schema
 *
 * 限制长度为 1-100 字符
 */
const ProjectSchema = z.string()
  .min(1, 'project 不能为空')
  .max(100, 'project 最大长度为 100 字符');

/**
 * 持续时间 schema
 *
 * 限制范围：0 到 24 小时（毫秒）
 */
const DurationSchema = z.number()
  .int('duration 必须是整数')
  .min(0, 'duration 不能为负数')
  .max(24 * 60 * 60 * 1000, 'duration 不能超过 24 小时');

/**
 * Summary schema
 *
 * 限制最大长度为 2000 字符
 */
const SummarySchema = z.string()
  .min(1, 'summary 不能为空')
  .max(2000, 'summary 最大长度为 2000 字符');

/**
 * Lessons 数组 schema
 *
 * 限制数组长度和每个元素的最大长度
 */
const LessonsSchema = z.array(
  z.string().max(500, '每个 lesson 最大长度为 500 字符')
)
  .min(1, 'lessons 至少包含一个元素')
  .max(50, 'lessons 最多包含 50 个元素');

/**
 * Improvements 数组 schema
 *
 * 限制数组长度和每个元素的最大长度
 */
const ImprovementsSchema = z.array(
  z.string().max(500, '每个 improvement 最大长度为 500 字符')
)
  .min(1, 'improvements 至少包含一个元素')
  .max(50, 'improvements 最多包含 50 个元素');

/**
 * Violations 数组 schema（可选字段）
 *
 * 限制数组长度和每个元素的最大长度
 */
const ViolationsSchema = z.array(
  z.string().max(50, '每个 violation 最大长度为 50 字符')
)
  .max(20, 'violations 最多包含 20 个元素')
  .optional();

/**
 * RetroRecord 完整 Zod Schema
 *
 * @description
 * 验证复盘记录的完整结构，包括：
 * - ID 格式和日期时间有效性
 * - 时间戳不在未来
 * - 字段长度限制
 * - 枚举值有效性
 *
 * 使用 strict 模式拒绝额外字段
 */
export const RetroRecordSchema = z.object({
  id: RetroIdSchema,
  timestamp: TimestampSchema,
  type: RetroTypeSchema,
  project: ProjectSchema,
  duration: DurationSchema,
  summary: SummarySchema,
  lessons: LessonsSchema,
  improvements: ImprovementsSchema,
  violations: ViolationsSchema
}).strict();

/**
 * RetroRecord 输入类型（可能包含无效数据）
 */
export type RetroRecordInput = z.input<typeof RetroRecordSchema>;

/**
 * RetroRecord 输出类型（验证后的数据）
 */
export type RetroRecordValidated = z.output<typeof RetroRecordSchema>;

/**
 * 验证结果类型
 */
export interface ValidationResult {
  success: boolean;
  data?: RetroRecordValidated;
  errors?: string[];
}

/**
 * 危险字段列表（原型污染相关）
 *
 * 这些字段不应该出现在用户输入中
 * 注意：不包含 'constructor'，因为它是合法的属性
 */
const DANGEROUS_KEYS = [
  'prototype',
  'toString',
  'toLocaleString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable'
];

/**
 * 检查对象是否包含原型污染尝试
 *
 * @param obj - 待检查的对象
 * @returns 是否包含危险字段
 *
 * @description
 * 检测两类原型污染：
 * 1. 直接设置的危险属性（如 prototype）
 * 2. 通过 Object.prototype 间接设置的属性
 */
function hasPrototypePollution(obj: any): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  // 检查对象自身的危险键
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.includes(key)) {
      return true;
    }
  }

  // 检查是否尝试污染 Object.prototype
  // 通过检查对象是否有来自原型链的可疑属性
  const testObj = { test: 1 };
  for (const key of Object.keys(obj)) {
    // 检查是否设置了 __proto__ 属性（通过 JSON 解析时可能存在）
    if (key === '__proto__' && obj[key] !== undefined && obj[key] !== null) {
      // 如果 __proto__ 不是默认的 Object.prototype，则拒绝
      try {
        if (obj[key] !== Object.getPrototypeOf({})) {
          return true;
        }
      } catch {
        // 如果访问出错，拒绝
        return true;
      }
    }
  }

  return false;
}

/**
 * 深度冻结对象
 *
 * @param obj - 待冻结的对象
 * @returns 冻结后的对象
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 冻结数组
  if (Array.isArray(obj)) {
    obj.forEach(item => deepFreeze(item));
    return Object.freeze(obj) as T;
  }

  // 冻结对象
  for (const key of Object.keys(obj)) {
    deepFreeze((obj as any)[key]);
  }

  return Object.freeze(obj);
}

/**
 * 验证 RetroRecord
 *
 * @param input - 待验证的输入数据
 * @returns 验证结果
 *
 * @example
 * ```ts
 * const result = validateRetroRecord(input);
 * if (result.success) {
 *   console.log(result.data.id);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateRetroRecord(input: unknown): ValidationResult {
  // 检查原型污染
  if (input && typeof input === 'object' && hasPrototypePollution(input)) {
    return {
      success: false,
      errors: ['输入包含危险字段，可能存在原型污染尝试']
    };
  }

  const result = RetroRecordSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  const errors = result.error.issues.map(issue =>
    `${issue.path.length > 0 ? issue.path.join('.') : 'field'}: ${issue.message}`
  );

  return {
    success: false,
    errors
  };
}

/**
 * 清理并验证 RetroRecord
 *
 * @description
 * 移除未知字段，验证数据，并冻结返回的对象防止修改
 *
 * @param input - 待清理的输入数据
 * @returns 清理并冻结后的 RetroRecord
 *
 * @example
 * ```ts
 * const sanitized = sanitizeRetroRecord(userInput);
 * // sanitized 被冻结，任何修改尝试都会抛出错误
 * ```
 */
export function sanitizeRetroRecord(input: unknown): RetroRecordValidated {
  // 检查原型污染
  if (input && typeof input === 'object' && hasPrototypePollution(input)) {
    throw new Error('输入包含危险字段，可能存在原型污染尝试');
  }

  // 使用 passthrough 模式移除额外字段但保留有效字段
  const looseSchema = RetroRecordSchema.passthrough();
  const result = looseSchema.safeParse(input);

  if (!result.success) {
    const errors = result.error.issues.map(issue =>
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');
    throw new Error(`验证失败: ${errors}`);
  }

  // 只保留 schema 定义的字段
  const sanitized: RetroRecordValidated = {
    id: result.data.id,
    timestamp: result.data.timestamp,
    type: result.data.type,
    project: result.data.project,
    duration: result.data.duration,
    summary: result.data.summary,
    lessons: result.data.lessons,
    improvements: result.data.improvements,
    violations: result.data.violations
  };

  // 深度冻结对象防止修改
  return deepFreeze(sanitized);
}

/**
 * 创建有效的 Retro ID
 *
 * @param timestamp - 可选的时间戳（默认为当前时间）
 * @param suffix - 可选的后缀（默认为随机字符串）
 * @returns 格式正确的 Retro ID
 *
 * @example
 * ```ts
 * const id = createRetroId();
 * // => "retro_20260204_123456_abc123def456"
 * ```
 */
export function createRetroId(
  timestamp?: Date,
  suffix?: string
): string {
  const date = timestamp ?? new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');

  const uniqueSuffix = suffix ?? Math.random().toString(36).substring(2, 14);

  return `retro_${year}${month}${day}_${hour}${minute}${second}_${uniqueSuffix}`;
}

/**
 * 导出所有 schemas 以便在其他模块中使用
 */
export const schemas = {
  retroId: RetroIdSchema,
  timestamp: TimestampSchema,
  retroType: RetroTypeSchema,
  project: ProjectSchema,
  duration: DurationSchema,
  summary: SummarySchema,
  lessons: LessonsSchema,
  improvements: ImprovementsSchema,
  violations: ViolationsSchema,
  retroRecord: RetroRecordSchema
};

/**
 * 导出类型
 */
export type { RetroRecordInput, RetroRecordValidated };
