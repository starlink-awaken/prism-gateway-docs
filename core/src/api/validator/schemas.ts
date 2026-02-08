/**
 * API 验证 Schema 定义
 *
 * @description
 * 为所有 API 端点定义 Zod Schema，提供运行时类型验证
 *
 * @features
 * - 基础类型 schemas（字符串、整数等）
 * - 查询参数 schemas（period、limit、offset）
 * - 路径参数 schemas（metric、id）
 * - 请求体 schemas（login、refresh）
 * - 安全性验证（注入攻击、路径遍历、原型污染）
 *
 * @security
 * - 所有字符串自动 trim
 * - 防止路径遍历攻击
 * - 防止原型污染
 * - 防止注入攻击
 *
 * @module api/validator/schemas
 */

import { z } from 'zod';

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  /** 输入验证失败 */
  VALIDATION_ERROR = 'ERR_1001',
  /** 认证失败 */
  AUTH_ERROR = 'ERR_2001',
  /** 授权失败 */
  AUTHORIZATION_ERROR = 'ERR_2002',
  /** 资源未找到 */
  NOT_FOUND = 'ERR_3001',
  /** 服务器错误 */
  INTERNAL_ERROR = 'ERR_5000'
}

/**
 * 有效的 period 值
 */
const VALID_PERIODS = ['today', 'week', 'month', 'year', 'all'] as const;

/**
 * 有效的 metric 名称
 */
const VALID_METRICS = [
  'violations',
  'checks',
  'retros',
  'patterns',
  'traps',
  'quality',
  'usage',
  'performance'
] as const;

/**
 * 字段长度限制
 */
const LIMITS = {
  /** 字符串最大长度 */
  MAX_STRING_LENGTH: 1000,
  /** 用户名最小长度 */
  USERNAME_MIN_LENGTH: 3,
  /** 用户名最大长度 */
  USERNAME_MAX_LENGTH: 50,
  /** 密码最小长度 */
  PASSWORD_MIN_LENGTH: 8,
  /** 密码最大长度 */
  PASSWORD_MAX_LENGTH: 100,
  /** Token 最小长度 */
  TOKEN_MIN_LENGTH: 20,
  /** 项目 ID 最大长度 */
  PROJECT_ID_MAX_LENGTH: 100,
  /** 分页默认 limit */
  DEFAULT_LIMIT: 20,
  /** 分页最大 limit */
  MAX_LIMIT: 100
} as const;

// ============================================================================
// 基础 Schemas
// ============================================================================

/**
 * 非空字符串 Schema
 *
 * @description
 * - 自动 trim 前后空格
 * - 拒绝空字符串
 * - 拒绝只有空格的字符串
 * - 限制最大长度
 */
export const NonEmptyStringSchema = z.string({
  required_error: '此字段为必填项',
  invalid_type_error: '必须是字符串类型'
})
  .trim()
  .min(1, '不能为空')
  .max(LIMITS.MAX_STRING_LENGTH, `最大长度为 ${LIMITS.MAX_STRING_LENGTH} 字符`);

/**
 * 正整数 Schema
 *
 * @description
 * - 拒绝零和负数
 * - 拒绝小数
 */
export const PositiveIntegerSchema = z.number({
  required_error: '此字段为必填项',
  invalid_type_error: '必须是数字类型'
})
  .int('必须是整数')
  .positive('必须是正数');

/**
 * 非负整数 Schema
 *
 * @description
 * - 接受零
 * - 拒绝负数
 * - 拒绝小数
 */
export const NonNegativeIntegerSchema = z.number({
  required_error: '此字段为必填项',
  invalid_type_error: '必须是数字类型'
})
  .int('必须是整数')
  .nonnegative('不能为负数');

/**
 * 有界整数 Schema 工厂函数
 *
 * @param min - 最小值（包含）
 * @param max - 最大值（包含）
 * @returns Zod Schema
 *
 * @example
 * ```ts
 * const AgeSchema = BoundedIntegerSchema(0, 150);
 * const PercentageSchema = BoundedIntegerSchema(0, 100);
 * ```
 */
export const BoundedIntegerSchema = (min: number, max: number) => {
  return z.number({
    required_error: '此字段为必填项',
    invalid_type_error: '必须是数字类型'
  })
    .int('必须是整数')
    .min(min, `最小值为 ${min}`)
    .max(max, `最大值为 ${max}`);
};

/**
 * 安全字符串 Schema
 *
 * @description
 * 防止注入攻击，只允许安全字符
 * - 字母（a-z, A-Z）
 * - 数字（0-9）
 * - 连字符（-）
 * - 下划线（_）
 * - 点（.）
 */
export const SafeStringSchema = z.string({
  required_error: '此字段为必填项',
  invalid_type_error: '必须是字符串类型'
})
  .trim()
  .min(1, '不能为空')
  .max(LIMITS.MAX_STRING_LENGTH, `最大长度为 ${LIMITS.MAX_STRING_LENGTH} 字符`)
  .regex(/^[\w.-]+$/, '只能包含字母、数字、连字符、下划线和点');

/**
 * 用户名 Schema
 *
 * @description
 * - 3-50 字符
 * - 只允许字母、数字、连字符、下划线
 * - 防止注入攻击
 */
export const UsernameSchema = z.string({
  required_error: '用户名为必填项',
  invalid_type_error: '用户名必须是字符串'
})
  .trim()
  .min(LIMITS.USERNAME_MIN_LENGTH, `用户名至少 ${LIMITS.USERNAME_MIN_LENGTH} 字符`)
  .max(LIMITS.USERNAME_MAX_LENGTH, `用户名最多 ${LIMITS.USERNAME_MAX_LENGTH} 字符`)
  .regex(/^[\w-]+$/, '用户名只能包含字母、数字、连字符和下划线');

/**
 * 密码 Schema
 *
 * @description
 * - 8-100 字符
 * - 不直接验证复杂度（由应用层处理）
 * - 防止空格
 */
export const PasswordSchema = z.string({
  required_error: '密码为必填项',
  invalid_type_error: '密码必须是字符串'
})
  .min(LIMITS.PASSWORD_MIN_LENGTH, `密码至少 ${LIMITS.PASSWORD_MIN_LENGTH} 字符`)
  .max(LIMITS.PASSWORD_MAX_LENGTH, `密码最多 ${LIMITS.PASSWORD_MAX_LENGTH} 字符`)
  .refine(
    (val) => !val.includes(' '),
    '密码不能包含空格'
  );

// ============================================================================
// 查询参数 Schemas
// ============================================================================

/**
 * Period（时间范围）Schema
 *
 * @description
 * 验证时间范围查询参数
 *
 * @example
 * ```ts
 * // Valid: 'today', 'week', 'month', 'year', 'all'
 * PeriodSchema.parse('today'); // OK
 * PeriodSchema.parse('daily'); // Error
 * ```
 */
export const PeriodSchema = z.string({
  required_error: 'period 为必填项',
  invalid_type_error: 'period 必须是字符串'
})
  .trim()
  .toLowerCase()
  .refine((val): val is typeof VALID_PERIODS[number] => VALID_PERIODS.includes(val as any), {
    message: `period 必须是以下之一: ${VALID_PERIODS.join(', ')}`
  });

/**
 * Limit（分页大小）Schema
 *
 * @description
 * - 1-100
 * - 默认值 20
 */
export const LimitSchema = BoundedIntegerSchema(1, LIMITS.MAX_LIMIT);

/**
 * 为 LimitSchema 添加默认值的辅助方法
 */
LimitSchema.withDefault = () => LimitSchema.default(LIMITS.DEFAULT_LIMIT);

/**
 * Offset（分页偏移）Schema
 *
 * @description
 * - 0 或正整数
 * - 默认值 0
 */
export const OffsetSchema = NonNegativeIntegerSchema.default(0);

/**
 * Metric（指标名称）Schema
 *
 * @description
 * 验证 Analytics API 的指标名称参数
 *
 * @security
 * - 防止路径遍历攻击
 * - 只允许预定义的指标名称
 *
 * @example
 * ```ts
 * // Valid metrics
 * MetricSchema.parse('violations'); // OK
 * MetricSchema.parse('checks'); // OK
 * MetricSchema.parse('../../../etc/passwd'); // Error
 * ```
 */
export const MetricSchema = z.enum(VALID_METRICS, {
  errorMap: () => ({ message: `metric 必须是以下之一: ${VALID_METRICS.join(', ')}` })
})
  .refine(
    (val) => !val.includes('..') && !val.includes('/') && !val.includes('\\'),
    { message: 'metric 包含非法字符' }
  );

// ============================================================================
// 路径参数 Schemas
// ============================================================================

/**
 * Retro ID 正则表达式
 *
 * @description
 * 格式: retro_YYYYMMDD_HHMMSS_<uuid-suffix>
 * - YYYY: 年份 (4位)
 * - MM: 月份 (01-12)
 * - DD: 日期 (01-31)
 * - HH: 小时 (00-23)
 * - MM: 分钟 (00-59)
 * - SS: 秒 (00-59)
 * - uuid-suffix: UUID 或类似的唯一标识符 (至少6个字符)
 */
const RETRO_ID_REGEX = /^retro_(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])_([0-2]\d)([0-5]\d)([0-5]\d)_[a-zA-Z0-9_-]{6,}$/;

/**
 * 验证 Retro ID 中的日期时间是否有效
 *
 * @param id - 待验证的 ID
 * @returns 日期时间是否有效
 */
function isValidDateTimeInId(id: string): boolean {
  const match = id.match(RETRO_ID_REGEX);
  if (!match) return false;

  const [, year, month, day, hour, minute, second] = match;

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
 * Retro ID Schema
 *
 * @description
 * 验证复盘记录 ID 的格式和有效性
 *
 * @security
 * - 防止路径遍历攻击
 * - 验证日期时间有效性
 */
export const RetroIdSchema = z.string({
  required_error: 'ID 为必填项',
  invalid_type_error: 'ID 必须是字符串'
})
  .min(1, 'ID 不能为空')
  .refine((id) => {
    const lower = id.toLowerCase();
    return !lower.includes('..') && !lower.includes('/') && !lower.includes('\\');
  }, {
    message: 'ID 包含非法字符（路径遍历检测）'
  })
  .refine((id) => RETRO_ID_REGEX.test(id.toLowerCase()), {
    message: 'ID 格式无效，应为 retro_YYYYMMDD_HHMMSS_<uuid> 格式'
  })
  .refine((id) => isValidDateTimeInId(id.toLowerCase()), {
    message: 'ID 中包含无效的日期时间'
  })
  .transform((val) => val.toLowerCase());

/**
 * Project ID Schema
 *
 * @description
 * 验证项目标识符
 *
 * @security
 * - 防止 NoSQL 注入
 * - 防止路径遍历攻击
 */
export const ProjectIdSchema = z.string({
  required_error: '项目 ID 为必填项',
  invalid_type_error: '项目 ID 必须是字符串'
})
  .trim()
  .min(1, '项目 ID 不能为空')
  .max(LIMITS.PROJECT_ID_MAX_LENGTH, `项目 ID 最大长度为 ${LIMITS.PROJECT_ID_MAX_LENGTH} 字符`)
  .regex(/^[\w.-]+$/, {
    message: '项目 ID 只能包含字母、数字、连字符、下划线和点'
  })
  .refine(
    (val) => !val.startsWith('$') && !val.includes('{') && !val.includes('}'),
    { message: '项目 ID 包含非法字符（可能的注入攻击）' }
  );

// ============================================================================
// 请求体 Schemas
// ============================================================================

/**
 * 登录请求 Schema
 *
 * @description
 * 验证用户登录请求体
 *
 * @example
 * ```json
 * {
 *   "username": "testuser",
 *   "password": "password123"
 * }
 * ```
 */
export const LoginRequestSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema
}, {
  required_error: '请求体为空',
  invalid_type_error: '请求体格式错误'
}).strict();

/**
 * 刷新 Token 请求 Schema
 *
 * @description
 * 验证刷新 Token 请求体
 *
 * @example
 * ```json
 * {
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * ```
 */
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string({
    required_error: 'refreshToken 为必填项',
    invalid_type_error: 'refreshToken 必须是字符串'
  })
    .trim()
    .min(LIMITS.TOKEN_MIN_LENGTH, `refreshToken 最小长度为 ${LIMITS.TOKEN_MIN_LENGTH} 字符`)
}, {
  required_error: '请求体为空',
  invalid_type_error: '请求体格式错误'
}).strict();

// ============================================================================
// 组合 Schemas
// ============================================================================

/**
 * Analytics 查询参数 Schema
 *
 * @description
 * 验证 Analytics API 的查询参数
 *
 * @example
 * ```ts
 * // ?period=week&limit=10&offset=20
 * AnalyticsQuerySchema.parse({
 *   period: 'week',
 *   limit: 10,
 *   offset: 20
 * });
 * ```
 */
export const AnalyticsQuerySchema = z.object({
  period: PeriodSchema.default('week'),
  limit: LimitSchema.withDefault(),
  offset: OffsetSchema
}).partial();

/**
 * 分页查询参数 Schema
 *
 * @description
 * 通用的分页参数验证
 */
export const PaginationQuerySchema = z.object({
  limit: LimitSchema.withDefault(),
  offset: OffsetSchema
});

// ============================================================================
// 类型导出
// ============================================================================

/**
 * 登录请求类型
 */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * 刷新 Token 请求类型
 */
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

/**
 * Analytics 查询参数类型
 */
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

/**
 * 分页查询参数类型
 */
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Retro ID 类型
 */
export type RetroId = z.infer<typeof RetroIdSchema>;

/**
 * Project ID 类型
 */
export type ProjectId = z.infer<typeof ProjectIdSchema>;

/**
 * Period 类型
 */
export type Period = z.infer<typeof PeriodSchema>;

/**
 * Metric 类型
 */
export type Metric = z.infer<typeof MetricSchema>;

// ============================================================================
// Schema 导出集合
// ============================================================================

/**
 * 所有 Schemas 的导出对象
 */
export const schemas = {
  // 基础类型
  nonEmptyString: NonEmptyStringSchema,
  positiveInteger: PositiveIntegerSchema,
  nonNegativeInteger: NonNegativeIntegerSchema,
  boundedInteger: BoundedIntegerSchema,
  safeString: SafeStringSchema,
  username: UsernameSchema,
  password: PasswordSchema,

  // 查询参数
  period: PeriodSchema,
  limit: LimitSchema,
  offset: OffsetSchema,
  metric: MetricSchema,

  // 路径参数
  retroId: RetroIdSchema,
  projectId: ProjectIdSchema,

  // 请求体
  loginRequest: LoginRequestSchema,
  refreshTokenRequest: RefreshTokenRequestSchema,

  // 组合
  analyticsQuery: AnalyticsQuerySchema,
  paginationQuery: PaginationQuerySchema
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 格式化 Zod 错误消息
 *
 * @param error - Zod 错误对象
 * @returns 格式化后的错误消息数组
 *
 * @example
 * ```ts
 * try {
 *   LoginRequestSchema.parse(input);
 * } catch (error) {
 *   const messages = formatZodError(error);
 *   console.error(messages);
 * }
 * ```
 */
export function formatZodError(error: unknown): string[] {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'field';
      return `${path}: ${issue.message}`;
    });
  }
  return ['未知验证错误'];
}

/**
 * 创建验证错误响应
 *
 * @param errors - 错误消息数组
 * @returns 标准错误响应对象
 *
 * @example
 * ```ts
 * try {
 *   LoginRequestSchema.parse(input);
 * } catch (error) {
 *   const errorResponse = createValidationError(formatZodError(error));
 *   return c.json(errorResponse, 400);
 * }
 * ```
 */
export function createValidationError(errors: string[]) {
  return {
    success: false,
    error: ErrorCode.VALIDATION_ERROR,
    message: '输入验证失败',
    details: errors,
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 验证并解析输入
 *
 * @param schema - Zod Schema
 * @param input - 待验证的输入
 * @returns 验证结果
 *
 * @example
 * ```ts
 * const result = safeParse(LoginRequestSchema, userInput);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodError(result.error)
  };
}
