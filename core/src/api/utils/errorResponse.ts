/**
 * 统一 API 错误响应工具
 *
 * @description
 * 提供标准化的 API 错误响应格式，确保所有端点返回一致的错误结构
 *
 * @features
 * - 标准错误代码（ERR_XXXX）
 * - 统一的响应格式
 * - 时间戳记录
 * - 可选的详细信息
 *
 * @module api/utils/errorResponse
 */

import * as crypto from 'node:crypto';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * API 错误代码枚举
 *
 * @description
 * 错误代码范围：
 * - 1000-1999: 输入验证错误
 * - 2000-2999: 认证授权错误
 * - 3000-3999: 资源错误
 * - 4000-4999: 业务逻辑错误
 * - 5000-5999: 服务器错误
 */
export enum ApiErrorCode {
  // 输入验证错误 (1000-1999)
  VALIDATION_ERROR = 'ERR_1001',
  INVALID_JSON = 'ERR_1002',
  MISSING_REQUIRED_FIELD = 'ERR_1003',
  INVALID_FORMAT = 'ERR_1004',
  PARAMETER_TOO_LONG = 'ERR_1005',
  PARAMETER_TOO_SHORT = 'ERR_1006',

  // 认证授权错误 (2000-2999)
  AUTHENTICATION_FAILED = 'ERR_2001',
  AUTHORIZATION_FAILED = 'ERR_2002',
  TOKEN_INVALID = 'ERR_2003',
  TOKEN_EXPIRED = 'ERR_2004',
  CREDENTIALS_INVALID = 'ERR_2005',

  // 资源错误 (3000-3999)
  RESOURCE_NOT_FOUND = 'ERR_3001',
  RESOURCE_ALREADY_EXISTS = 'ERR_3002',
  RESOURCE_DELETED = 'ERR_3003',
  RESOURCE_LOCKED = 'ERR_3004',

  // 业务逻辑错误 (4000-4999)
  OPERATION_NOT_ALLOWED = 'ERR_4001',
  CONFLICT_DETECTED = 'ERR_4002',
  QUOTA_EXCEEDED = 'ERR_4003',
  RATE_LIMIT_EXCEEDED = 'ERR_4004',

  // 服务器错误 (5000-5999)
  INTERNAL_ERROR = 'ERR_5000',
  SERVICE_UNAVAILABLE = 'ERR_5001',
  DATABASE_ERROR = 'ERR_5002',
  UPSTREAM_ERROR = 'ERR_5003'
}

/**
 * 标准错误响应接口
 *
 * @description
 * 所有 API 错误响应必须遵循此格式
 *
 * @example
 * ```json
 * {
 *   "success": false,
 *   "error": "ERR_1001",
 *   "message": "输入验证失败",
 *   "details": ["name: 不能为空"],
 *   "meta": {
 *     "timestamp": "2024-01-01T00:00:00.000Z",
 *     "requestId": "req_1234567890_abc123"
 *   }
 * }
 * ```
 */
export interface ApiErrorResponse {
  success: false;
  error: string;              // 错误代码 (ERR_XXXX)
  message: string;            // 用户友好的错误消息
  details?: string[];         // 详细错误信息（可选）
  meta: {
    timestamp: string;        // ISO 8601 时间戳
    requestId?: string;       // 请求 ID（可选）
  };
}

/**
 * 错误响应选项
 */
export interface ErrorResponseOptions {
  /** 详细的错误信息数组 */
  details?: string[];
  /** HTTP 状态码（默认根据错误代码自动确定） */
  status?: number;
  /** 是否包含请求 ID */
  includeRequestId?: boolean;
}

// ============================================================================
// HTTP 状态码映射
// ============================================================================

/**
 * 错误代码到 HTTP 状态码的默认映射
 */
const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  // 输入验证错误 -> 400
  [ApiErrorCode.VALIDATION_ERROR]: 400,
  [ApiErrorCode.INVALID_JSON]: 400,
  [ApiErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ApiErrorCode.INVALID_FORMAT]: 400,
  [ApiErrorCode.PARAMETER_TOO_LONG]: 400,
  [ApiErrorCode.PARAMETER_TOO_SHORT]: 400,

  // 认证授权错误 -> 401/403
  [ApiErrorCode.AUTHENTICATION_FAILED]: 401,
  [ApiErrorCode.AUTHORIZATION_FAILED]: 403,
  [ApiErrorCode.TOKEN_INVALID]: 401,
  [ApiErrorCode.TOKEN_EXPIRED]: 401,
  [ApiErrorCode.CREDENTIALS_INVALID]: 401,

  // 资源错误 -> 404/409/423
  [ApiErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ApiErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ApiErrorCode.RESOURCE_DELETED]: 410,
  [ApiErrorCode.RESOURCE_LOCKED]: 423,

  // 业务逻辑错误 -> 400/403/429
  [ApiErrorCode.OPERATION_NOT_ALLOWED]: 403,
  [ApiErrorCode.CONFLICT_DETECTED]: 409,
  [ApiErrorCode.QUOTA_EXCEEDED]: 429,
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]: 429,

  // 服务器错误 -> 500/503
  [ApiErrorCode.INTERNAL_ERROR]: 500,
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ApiErrorCode.DATABASE_ERROR]: 500,
  [ApiErrorCode.UPSTREAM_ERROR]: 502
};

/**
 * 默认错误消息
 */
const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  [ApiErrorCode.VALIDATION_ERROR]: '输入验证失败',
  [ApiErrorCode.INVALID_JSON]: '无效的 JSON 格式',
  [ApiErrorCode.MISSING_REQUIRED_FIELD]: '缺少必填字段',
  [ApiErrorCode.INVALID_FORMAT]: '格式无效',
  [ApiErrorCode.PARAMETER_TOO_LONG]: '参数过长',
  [ApiErrorCode.PARAMETER_TOO_SHORT]: '参数过短',

  [ApiErrorCode.AUTHENTICATION_FAILED]: '认证失败',
  [ApiErrorCode.AUTHORIZATION_FAILED]: '权限不足',
  [ApiErrorCode.TOKEN_INVALID]: 'Token 无效',
  [ApiErrorCode.TOKEN_EXPIRED]: 'Token 已过期',
  [ApiErrorCode.CREDENTIALS_INVALID]: '用户名或密码错误',

  [ApiErrorCode.RESOURCE_NOT_FOUND]: '资源未找到',
  [ApiErrorCode.RESOURCE_ALREADY_EXISTS]: '资源已存在',
  [ApiErrorCode.RESOURCE_DELETED]: '资源已被删除',
  [ApiErrorCode.RESOURCE_LOCKED]: '资源已被锁定',

  [ApiErrorCode.OPERATION_NOT_ALLOWED]: '不允许执行此操作',
  [ApiErrorCode.CONFLICT_DETECTED]: '检测到冲突',
  [ApiErrorCode.QUOTA_EXCEEDED]: '超过配额限制',
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]: '超过请求频率限制',

  [ApiErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ApiErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',
  [ApiErrorCode.DATABASE_ERROR]: '数据库错误',
  [ApiErrorCode.UPSTREAM_ERROR]: '上游服务错误'
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成请求 ID
 *
 * @returns 格式为 req_<timestamp>_<random> 的 ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * 创建标准错误响应对象
 *
 * @param code - 错误代码
 * @param message - 错误消息（可选，使用默认值）
 * @param options - 额外选项
 * @returns 错误响应对象
 *
 * @example
 * ```ts
 * const response = createErrorResponse(
 *   ApiErrorCode.VALIDATION_ERROR,
 *   'name 字段验证失败',
 *   { details: ['name: 不能为空'] }
 * );
 * ```
 */
export function createErrorResponse(
  code: ApiErrorCode,
  message?: string,
  options: ErrorResponseOptions = {}
): ApiErrorResponse {
  const { details, includeRequestId = true } = options;

  const meta: {
    timestamp: string;
    requestId?: string;
  } = {
    timestamp: new Date().toISOString()
  };

  if (includeRequestId) {
    meta.requestId = generateRequestId();
  }

  return {
    success: false,
    error: code,
    message: message || DEFAULT_MESSAGES[code],
    details,
    meta
  };
}

/**
 * 创建验证错误响应（快捷方式）
 *
 * @param details - 验证错误详情数组
 * @param message - 自定义消息（可选）
 * @returns 错误响应对象
 *
 * @example
 * ```ts
 * const response = createValidationErrorResponse([
 *   'name: 不能为空',
 *   'type: 必须是有效值'
 * ]);
 * ```
 */
export function createValidationErrorResponse(
  details: string[],
  message?: string
): ApiErrorResponse {
  return createErrorResponse(
    ApiErrorCode.VALIDATION_ERROR,
    message || '输入验证失败',
    { details }
  );
}

/**
 * 创建认证错误响应（快捷方式）
 *
 * @param message - 自定义消息（可选）
 * @returns 错误响应对象
 */
export function createAuthErrorResponse(message?: string): ApiErrorResponse {
  return createErrorResponse(
    ApiErrorCode.AUTHENTICATION_FAILED,
    message
  );
}

/**
 * 创建授权错误响应（快捷方式）
 *
 * @param message - 自定义消息（可选）
 * @returns 错误响应对象
 */
export function createAuthorizationErrorResponse(message?: string): ApiErrorResponse {
  return createErrorResponse(
    ApiErrorCode.AUTHORIZATION_FAILED,
    message
  );
}

/**
 * 创建未找到错误响应（快捷方式）
 *
 * @param resource - 资源名称（可选）
 * @returns 错误响应对象
 */
export function createNotFoundErrorResponse(resource?: string): ApiErrorResponse {
  return createErrorResponse(
    ApiErrorCode.RESOURCE_NOT_FOUND,
    resource ? `${resource} 未找到` : undefined
  );
}

/**
 * 创建冲突错误响应（快捷方式）
 *
 * @param message - 自定义消息（可选）
 * @returns 错误响应对象
 */
export function createConflictErrorResponse(message?: string): ApiErrorResponse {
  return createErrorResponse(
    ApiErrorCode.RESOURCE_ALREADY_EXISTS,
    message || '资源已存在'
  );
}

/**
 * 获取错误代码对应的 HTTP 状态码
 *
 * @param code - 错误代码
 * @returns HTTP 状态码
 */
export function getHttpStatusForError(code: ApiErrorCode): number {
  return ERROR_STATUS_MAP[code];
}

/**
 * 创建 Hono JSON 错误响应
 *
 * @description
 * 直接返回适合 Hono 的 Response 对象
 *
 * @param c - Hono Context
 * @param code - 错误代码
 * @param message - 自定义消息（可选）
 * @param options - 额外选项
 * @returns Hono Response
 *
 * @example
 * ```ts
 * return errorResponse(c, ApiErrorCode.VALIDATION_ERROR, '验证失败', {
 *   details: ['name: 不能为空']
 * });
 * ```
 */
export function errorResponse(
  c: any,
  code: ApiErrorCode,
  message?: string,
  options: ErrorResponseOptions = {}
): Response {
  const { status } = options;
  const httpStatus = status || ERROR_STATUS_MAP[code];

  const responseBody = createErrorResponse(code, message, {
    ...options,
    status: undefined // 不在响应体中包含 status
  });

  return c.json(responseBody, httpStatus);
}

// ============================================================================
// 错误响应构建器类
// ============================================================================

/**
 * 错误响应构建器
 *
 * @description
 * 提供链式 API 来构建复杂的错误响应
 *
 * @example
 * ```ts
 * const response = new ErrorResponseBuilder()
 *   .code(ApiErrorCode.VALIDATION_ERROR)
 *   .message('输入验证失败')
 *   .details(['name: 不能为空', 'type: 无效值'])
 *   .includeRequestId(true)
 *   .build();
 * ```
 */
export class ErrorResponseBuilder {
  private _code: ApiErrorCode = ApiErrorCode.INTERNAL_ERROR;
  private _message: string | undefined;
  private _details: string[] | undefined;
  private _includeRequestId: boolean = true;
  private _status: number | undefined;

  /**
   * 设置错误代码
   */
  code(code: ApiErrorCode): this {
    this._code = code;
    return this;
  }

  /**
   * 设置错误消息
   */
  message(message: string): this {
    this._message = message;
    return this;
  }

  /**
   * 设置详细错误信息
   */
  details(details: string[]): this {
    this._details = details;
    return this;
  }

  /**
   * 添加单条详细错误信息
   */
  addDetail(detail: string): this {
    if (!this._details) {
      this._details = [];
    }
    this._details.push(detail);
    return this;
  }

  /**
   * 设置是否包含请求 ID
   */
  includeRequestId(include: boolean): this {
    this._includeRequestId = include;
    return this;
  }

  /**
   * 设置 HTTP 状态码
   */
  status(statusCode: number): this {
    this._status = statusCode;
    return this;
  }

  /**
   * 构建错误响应对象
   */
  build(): ApiErrorResponse {
    return createErrorResponse(
      this._code,
      this._message,
      {
        details: this._details,
        includeRequestId: this._includeRequestId
      }
    );
  }

  /**
   * 构建 Hono Response
   */
  toResponse(c: any): Response {
    return errorResponse(
      c,
      this._code,
      this._message,
      {
        details: this._details,
        includeRequestId: this._includeRequestId,
        status: this._status
      }
    );
  }
}

// ============================================================================
// 导出
// ============================================================================

export default {
  createErrorResponse,
  createValidationErrorResponse,
  createAuthErrorResponse,
  createAuthorizationErrorResponse,
  createNotFoundErrorResponse,
  createConflictErrorResponse,
  getHttpStatusForError,
  errorResponse,
  ErrorResponseBuilder,
  generateRequestId
};
