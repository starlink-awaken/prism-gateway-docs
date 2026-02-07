/**
 * API 验证模块
 *
 * @description
 * 导出所有验证相关的 schemas 和中间件
 *
 * @module api/validator
 */

// Schemas
export {
  // 基础类型
  NonEmptyStringSchema,
  PositiveIntegerSchema,
  NonNegativeIntegerSchema,
  BoundedIntegerSchema,
  SafeStringSchema,
  UsernameSchema,
  PasswordSchema,

  // 查询参数
  PeriodSchema,
  LimitSchema,
  OffsetSchema,
  MetricSchema,

  // 路径参数
  RetroIdSchema,
  ProjectIdSchema,

  // 请求体
  LoginRequestSchema,
  RefreshTokenRequestSchema,

  // 组合
  AnalyticsQuerySchema,
  PaginationQuerySchema,

  // 导出集合
  schemas,

  // 辅助函数
  formatZodError,
  createValidationError,
  safeParse,

  // 类型
  type LoginRequest,
  type RefreshTokenRequest,
  type AnalyticsQuery,
  type PaginationQuery,
  type RetroId,
  type ProjectId,
  type Period,
  type Metric,

  // 错误代码
  ErrorCode
} from './schemas.js';

// 中间件
export {
  zValidator,
  queryValidator,
  paramValidator,
  bodyValidator,
  headerValidator,
  cookieValidator,

  // 类型
  type ValidatedQuery,
  type ValidatedParams,
  type ValidatedBody,
  type ValidatedVariables
} from './middleware.js';
