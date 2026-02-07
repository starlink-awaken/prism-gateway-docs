/**
 * JWT 认证中间件
 *
 * @description
 * Hono 中间件，用于保护需要认证的 API 路由
 *
 * @features
 * - Bearer Token 提取
 * - Token 验证
 * - 用户信息注入上下文
 * - 可选认证模式
 * - 统一错误响应
 *
 * @module api/auth/middleware/jwtMiddleware
 */

import type { Context, Next } from 'hono';
import { JWTService } from '../JWTService.js';
import type { AuthUser, AuthContext } from '../types.js';

/**
 * JWT 中间件配置选项
 */
export interface JWTMiddlewareOptions {
  /** JWT 服务实例 */
  jwtService: JWTService;
  /** 是否可选认证（无 Token 时放行，有 Token 时验证） */
  optional?: boolean;
  /** 自定义 Token 提取器 */
  tokenExtractor?: (c: Context) => string | null | Promise<string | null>;
}

/**
 * 错误响应格式
 */
interface ErrorResponse {
  success: false;
  error: string;
  meta: {
    timestamp: string;
  };
}

/**
 * 创建 JWT 认证中间件
 *
 * @param options - 中间件配置
 * @returns Hono 中间件函数
 *
 * @example
 * ```ts
 * import { jwtMiddleware } from './middleware/jwtMiddleware.js';
 * import { Hono } from 'hono';
 *
 * const app = new Hono();
 *
 * // 保护路由
 * app.use('/api/protected/*', jwtMiddleware({ jwtService }));
 *
 * // 可选认证（无 Token 也放行）
 * app.use('/api/optional/*', jwtMiddleware({ jwtService, optional: true }));
 * ```
 */
export function jwtMiddleware(options: JWTMiddlewareOptions) {
  const { jwtService, optional = false } = options;

  return async (c: Context, next: Next) => {
    // 尝试提取 Token
    const token =
      (await options.tokenExtractor?.(c)) || extractBearerToken(c);

    // 无 Token 处理
    if (!token) {
      if (optional) {
        // 可选认证：无 Token 时放行
        return next();
      }
      return unauthorizedResponse(c, 'Missing authorization token');
    }

    // 验证 Token
    const result = jwtService.verifyToken(token, 'access');

    if (!result.valid) {
      if (optional) {
        // 可选认证：无效 Token 时放行
        return next();
      }
      return unauthorizedResponse(c, 'Invalid or expired token');
    }

    // 注入用户信息到上下文
    if (result.payload) {
      const user: AuthUser = {
        sub: result.payload.sub,
        username: result.payload.username,
        role: result.payload.role,
        jti: result.payload.jti
      };
      c.set('user', user);
      c.set('token', token);
    }

    return next();
  };
}

/**
 * 从 Authorization Header 提取 Bearer Token
 *
 * @param c - Hono 上下文
 * @returns Token 字符串，不存在返回 null
 *
 * @example
 * ```ts
 * // Header: Authorization: Bearer eyJhbGc...
 * const token = extractBearerToken(c);
 * // token = "eyJhbGc..."
 * ```
 */
export function extractBearerToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return null;
  }

  // 检查 Bearer 前缀
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1];

  // 检查 Token 格式（JWT 有 3 部分）
  if (token.split('.').length !== 3) {
    return null;
  }

  return token;
}

/**
 * 从 Cookie 提取 Token
 *
 * @param c - Hono 上下文
 * @param cookieName - Cookie 名称（默认 'token'）
 * @returns Token 字符串，不存在返回 null
 *
 * @example
 * ```ts
 * const token = extractCookieToken(c, 'access_token');
 * ```
 */
export function extractCookieToken(
  c: Context,
  cookieName: string = 'token'
): string | null {
  const cookie = c.req.header('Cookie');

  if (!cookie) {
    return null;
  }

  // 解析 Cookie
  const cookies = cookie.split(';').map((c) => c.trim());
  const targetCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));

  if (!targetCookie) {
    return null;
  }

  const token = targetCookie.split('=')[1];

  // 检查 Token 格式
  if (token.split('.').length !== 3) {
    return null;
  }

  return token;
}

/**
 * 从查询参数提取 Token
 *
 * @param c - Hono 上下文
 * @param paramName - 参数名称（默认 'token'）
 * @returns Token 字符串，不存在返回 null
 *
 * @example
 * ```ts
 * // URL: /api/data?token=eyJhbGc...
 * const token = extractQueryToken(c);
 * ```
 */
export function extractQueryToken(
  c: Context,
  paramName: string = 'token'
): string | null {
  const token = c.req.query(paramName);

  if (!token) {
    return null;
  }

  // 检查 Token 格式
  if (token.split('.').length !== 3) {
    return null;
  }

  return token;
}

/**
 * 从多个来源提取 Token（按优先级）
 *
 * @param c - Hono 上下文
 * @param sources - Token 来源列表（默认 ['header', 'cookie', 'query']）
 * @returns 第一个找到的有效 Token
 *
 * @example
 * ```ts
 * const token = extractToken(c, ['header', 'cookie']);
 * ```
 */
export function extractToken(
  c: Context,
  sources: Array<'header' | 'cookie' | 'query'> = ['header', 'cookie', 'query']
): string | null {
  for (const source of sources) {
    let token: string | null = null;

    switch (source) {
      case 'header':
        token = extractBearerToken(c);
        break;
      case 'cookie':
        token = extractCookieToken(c);
        break;
      case 'query':
        token = extractQueryToken(c);
        break;
    }

    if (token) {
      return token;
    }
  }

  return null;
}

/**
 * 返回 401 未授权响应
 *
 * @param c - Hono 上下文
 * @param message - 错误消息
 * @returns JSON 响应
 *
 * @private
 */
function unauthorizedResponse(c: Context, message: string): Response {
  const errorResponse: ErrorResponse = {
    success: false,
    error: message,
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  // 添加 WWW-Authenticate Header
  c.header('WWW-Authenticate', 'Bearer');

  return c.json(errorResponse, 401);
}

/**
 * 获取当前认证用户（类型安全的辅助函数）
 *
 * @param c - Hono 上下文
 * @returns 认证用户，未认证返回 null
 *
 * @example
 * ```ts
 * app.get('/api/me', (c) => {
 *   const user = getAuthUser(c);
 *   if (!user) {
 *     return c.json({ error: 'Not authenticated' }, 401);
 *   }
 *   return c.json({ userId: user.sub, username: user.username });
 * });
 * ```
 */
export function getAuthUser(c: Context): AuthUser | null {
  return c.get('user') || null;
}

/**
 * 要求认证用户（否则返回 401）
 *
 * @param c - Hono 上下文
 * @returns 认证用户
 * @throws 如果未认证返回 401 响应
 *
 * @example
 * ```ts
 * app.get('/api/protected', (c) => {
 *   const user = requireAuthUser(c);
 *   return c.json({ data: 'protected', user: user.username });
 * });
 * ```
 */
export function requireAuthUser(c: Context): AuthUser | never {
  const user = getAuthUser(c);

  if (!user) {
    throw new Response(
      JSON.stringify({
        success: false,
        error: 'Authentication required',
        meta: { timestamp: new Date().toISOString() }
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return user;
}

/**
 * 导出类型
 */
export type { JWTMiddlewareOptions, ErrorResponse };
