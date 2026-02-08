/**
 * API 验证中间件
 *
 * @description
 * 为 Hono 框架提供 Zod Schema 验证中间件
 *
 * @features
 * - 支持 query、param、body 验证
 * - 统一错误格式（ERR_1001）
 * - 类型安全的验证结果
 * - 自动错误处理
 *
 * @usage
 * ```ts
 * import { zValidator, queryValidator, bodyValidator } from './middleware.js';
 * import { PeriodSchema, LoginRequestSchema } from './schemas.js';
 *
 * // 使用 zValidator
 * app.get('/analytics', zValidator('query', PeriodSchema), handler);
 *
 * // 使用便捷函数
 * app.get('/analytics', queryValidator({ period: PeriodSchema }), handler);
 * app.post('/login', bodyValidator(LoginRequestSchema), handler);
 * ```
 *
 * @module api/validator/middleware
 */

import type { Context, Next } from 'hono';
import type { ZodSchema, ZodError } from 'zod';
import { z } from 'zod';
import {
  ErrorCode,
  formatZodError,
  createValidationError
} from './schemas.js';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 验证目标类型
 */
type ValidationTarget = 'query' | 'param' | 'body' | 'header' | 'cookie';

/**
 * 验证后的数据存储键
 */
type ValidatedDataKey =
  | 'validatedQuery'
  | 'validatedParams'
  | 'validatedBody'
  | 'validatedHeaders'
  | 'validatedCookies';

/**
 * Hono 上下文扩展
 */
interface ValidatedContext {
  get(key: ValidatedDataKey): any;
  set(key: ValidatedDataKey, value: any): void;
}

// ============================================================================
// 核心验证中间件
// ============================================================================

/**
 * Zod 验证中间件
 *
 * @description
 * 通用的 Zod 验证中间件，支持验证 query、param、body 等
 *
 * @param target - 验证目标（query、param、body、header、cookie）
 * @param schema - Zod Schema
 * @param options - 可选配置
 *
 * @example
 * ```ts
 * // 验证查询参数（使用对象 schema）
 * app.get('/api', zValidator('query', z.object({ period: PeriodSchema })), handler);
 *
 * // 验证路径参数
 * app.get('/api/:id', zValidator('param', z.object({ id: IdSchema })), handler);
 *
 * // 验证请求体
 * app.post('/api', zValidator('body', CreateSchema), handler);
 *
 * // 自定义状态码
 * app.post('/api', zValidator('body', Schema, { statusCode: 422 }), handler);
 * ```
 */
export function zValidator<
  T extends ZodSchema,
  Target extends ValidationTarget
>(
  target: Target,
  schema: T,
  options: {
    /** 自定义状态码（默认 400） */
    statusCode?: number;
    /** 自定义错误消息 */
    errorMessage?: string;
    /** 是否将参数作为单个值验证（而非对象） */
    paramKey?: string;
  } = {}
) {
  const { statusCode = 400, errorMessage, paramKey } = options;

  return async (c: Context, next: Next) => {
    try {
      // 获取要验证的数据
      let data: unknown;

      switch (target) {
        case 'query':
          data = getQueryData(c);
          break;
        case 'param':
          data = getParamData(c);
          break;
        case 'body':
          data = await getBodyData(c);
          break;
        case 'header':
          data = getHeaderData(c);
          break;
        case 'cookie':
          data = getCookieData(c);
          break;
        default:
          return c.json(
            {
              success: false,
              error: ErrorCode.VALIDATION_ERROR,
              message: `不支持的验证目标: ${target}`,
              meta: { timestamp: new Date().toISOString() }
            },
            400
          );
      }

      // 如果指定了 paramKey，只验证单个值
      if (paramKey && typeof data === 'object' && data !== null) {
        data = (data as Record<string, unknown>)[paramKey];
      }

      // 执行验证
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = formatZodError(result.error);
        return c.json(
          {
            ...createValidationError(errors),
            message: errorMessage || '输入验证失败'
          },
          statusCode
        );
      }

      // 存储验证后的数据
      const dataKey = getDataKey(target);
      c.set(dataKey, result.data);

      await next();
    } catch (error) {
      // 处理非 Zod 错误（如 JSON 解析错误）
      if (error instanceof Error && error.message.includes('JSON')) {
        return c.json(
          {
            success: false,
            error: ErrorCode.VALIDATION_ERROR,
            message: '无效的 JSON 格式',
            details: [error.message],
            meta: { timestamp: new Date().toISOString() }
          },
          400
        );
      }

      throw error;
    }
  };
}

// ============================================================================
// 便捷验证函数
// ============================================================================

/**
 * 查询参数验证中间件
 *
 * @description
 * 专门用于验证 URL 查询参数
 *
 * @param schemas - 参数名到 Zod Schema 的映射
 *
 * @example
 * ```ts
 * app.get('/analytics',
 *   queryValidator({
 *     period: PeriodSchema,
 *     limit: LimitSchema
 *   }),
 *   handler
 * );
 * ```
 */
export function queryValidator<T extends Record<string, ZodSchema>>(
  schemas: T
) {
  const schema = z.object(schemas).partial();
  return zValidator('query', schema);
}

/**
 * 路径参数验证中间件
 *
 * @description
 * 专门用于验证 URL 路径参数
 *
 * @param schemas - 参数名到 Zod Schema 的映射
 *
 * @example
 * ```ts
 * app.get('/projects/:projectId',
 *   paramValidator({
 *     projectId: ProjectIdSchema
 *   }),
 *   handler
 * );
 * ```
 */
export function paramValidator<T extends Record<string, ZodSchema>>(
  schemas: T
) {
  const schema = z.object(schemas);
  return zValidator('param', schema);
}

/**
 * 请求体验证中间件
 *
 * @description
 * 专门用于验证 JSON 请求体
 *
 * @param schema - Zod Schema
 *
 * @example
 * ```ts
 * app.post('/auth/login',
 *   bodyValidator(LoginRequestSchema),
 *   handler
 * );
 * ```
 */
export function bodyValidator<T extends ZodSchema>(schema: T) {
  return zValidator('body', schema);
}

/**
 * 请求头验证中间件
 *
 * @description
 * 专门用于验证 HTTP 请求头
 *
 * @param schemas - 请求头名到 Zod Schema 的映射
 *
 * @example
 * ```ts
 * app.get('/api',
 *   headerValidator({
 *     authorization: AuthHeaderSchema
 *   }),
 *   handler
 * );
 * ```
 */
export function headerValidator<T extends Record<string, ZodSchema>>(
  schemas: T
) {
  const schema = z.object(schemas).partial();
  return zValidator('header', schema);
}

/**
 * Cookie 验证中间件
 *
 * @description
 * 专门用于验证 Cookie
 *
 * @param schemas - Cookie 名到 Zod Schema 的映射
 *
 * @example
 * ```ts
 * app.get('/api',
 *   cookieValidator({
 *     sessionId: SessionIdSchema
 *   }),
 *   handler
 * );
 * ```
 */
export function cookieValidator<T extends Record<string, ZodSchema>>(
  schemas: T
) {
  const schema = z.object(schemas).partial();
  return zValidator('cookie', schema);
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取验证目标对应的数据键
 */
function getDataKey(target: ValidationTarget): ValidatedDataKey {
  const keyMap: Record<ValidationTarget, ValidatedDataKey> = {
    query: 'validatedQuery',
    param: 'validatedParams',
    body: 'validatedBody',
    header: 'validatedHeaders',
    cookie: 'validatedCookies'
  };
  return keyMap[target];
}

/**
 * 获取查询参数数据
 *
 * @description
 * Hono 的 c.req.queries() 总是返回数组格式
 * 但大多数情况下我们只需要单个值，所以这里做转换
 */
function getQueryData(c: Context): Record<string, string> {
  const query: Record<string, string> = {};

  // 使用 c.req.query() 遍历所有查询参数
  // 这会返回每个参数的第一个值
  const url = new URL(c.req.url);
  const searchParams = url.searchParams;

  for (const [key, value] of searchParams.entries()) {
    // 只保留每个参数的第一个值（忽略重复）
    if (!(key in query)) {
      query[key] = value;
    }
  }

  return query;
}

/**
 * 获取路径参数数据
 */
function getParamData(c: Context): Record<string, string> {
  return c.req.param() as Record<string, string>;
}

/**
 * 获取请求体数据
 */
async function getBodyData(c: Context): Promise<unknown> {
  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await c.req.json();
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return await c.req.parseBody();
  }

  if (contentType.includes('text/')) {
    return await c.req.text();
  }

  // 其他类型，尝试解析为 JSON
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

/**
 * 获取请求头数据
 */
function getHeaderData(c: Context): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  const req = c.req.raw as Request;

  for (const [key, value] of req.headers.entries()) {
    const existing = headers[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        headers[key] = [existing, value];
      }
    } else {
      headers[key] = value;
    }
  }

  return headers;
}

/**
 * 获取 Cookie 数据
 */
function getCookieData(c: Context): Record<string, string> {
  const cookieHeader = c.req.header('cookie') || '';
  const cookies: Record<string, string> = {};

  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }

  return cookies;
}

// ============================================================================
// 类型导出
// ============================================================================

/**
 * 从 Context 中获取验证后的查询参数类型
 */
export type ValidatedQuery<T> = T extends ZodSchema<infer U> ? U : never;

/**
 * 从 Context 中获取验证后的路径参数类型
 */
export type ValidatedParams<T> = T extends ZodSchema<infer U> ? U : never;

/**
 * 从 Context 中获取验证后的请求体类型
 */
export type ValidatedBody<T> = T extends ZodSchema<infer U> ? U : never;

// ============================================================================
// Hono 类型扩展
// ============================================================================

/**
 * 扩展 Hono Context 变量类型
 *
 * @description
 * 使用此类型让 TypeScript 识别验证后的数据
 *
 * @example
 * ```ts
 * import type { ValidatedVariables } from './middleware.js';
 *
 * type Env = {
 *   Variables: ValidatedVariables<{
 *   query: { period: string };
 *   body: { username: string; password: string };
 * }>;
 * };
 *
 * const app = new Hono<Env>();
 * ```
 */
export type ValidatedVariables<T> = {
  Variables: {
    validatedQuery?: T['query'];
    validatedParams?: T['param'];
    validatedBody?: T['body'];
    validatedHeaders?: T['header'];
    validatedCookies?: T['cookie'];
  };
};
