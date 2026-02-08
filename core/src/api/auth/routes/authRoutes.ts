/**
 * 认证 API 路由
 *
 * @description
 * 提供用户认证相关的 REST API 端点
 *
 * @remarks
 * 所有端点遵循 RESTful 设计原则：
 * - 统一的响应格式
 * - 适当的 HTTP 状态码
 * - 完整的错误处理
 * - 输入验证（ERR_1001）
 *
 * @endpoints
 * - POST /api/v1/auth/login - 用户登录
 * - POST /api/v1/auth/refresh - 刷新 Token
 * - GET /api/v1/auth/me - 获取当前用户信息
 * - POST /api/v1/auth/logout - 用户登出
 *
 * @module api/auth/routes/authRoutes
 */

import { Hono } from 'hono';
import type { JWTService } from '../JWTService.js';
import { bodyValidator } from '../../validator/index.js';
import {
  LoginRequestSchema,
  RefreshTokenRequestSchema
} from '../../validator/schemas.js';
import { jwtMiddleware, getAuthUser } from '../middleware/jwtMiddleware.js';
import {
  errorResponse as apiErrorResponse,
  ApiErrorCode
} from '../../utils/errorResponse.js';

/**
 * 用户服务接口
 *
 * @description
 * 定义用户查找和密码验证的抽象接口
 * 实际项目需要实现此接口
 */
export interface IUserService {
  /** 根据用户名查找用户 */
  findByUsername(username: string): Promise<{ id: string; passwordHash: string } | null>;
  /** 验证密码 */
  verifyPassword(password: string, hash: string): Promise<boolean>;
}

/**
 * 路由配置选项
 */
export interface AuthRoutesOptions {
  /** JWT 服务实例 */
  jwtService: JWTService;
  /** 用户服务实例 */
  userService: IUserService;
}

/**
 * 标准响应格式
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    version?: string;
  };
}

/**
 * 创建认证路由
 *
 * @param options - 路由配置
 * @returns Hono 路由实例
 *
 * @example
 * ```ts
 * import { authRouter } from './routes/authRoutes.js';
 * import { JWTService } from './JWTService.js';
 *
 * const jwtService = new JWTService({ ... });
 * const userService = new MyUserService();
 *
 * app.route('/api/v1/auth', authRouter({ jwtService, userService }));
 * ```
 */
export function authRouter(options: AuthRoutesOptions): Hono {
  const { jwtService, userService } = options;
  const app = new Hono();

  /**
   * POST /api/v1/auth/login
   *
   * 用户登录
   *
   * @description
   * 验证用户凭据并返回访问 Token 和刷新 Token
   *
   * @request { username: string, password: string }
   * @response { accessToken, refreshToken, tokenType, expiresIn }
   *
   * @example
   * ```bash
   * curl -X POST http://localhost:3000/api/v1/auth/login \
   *   -H "Content-Type: application/json" \
   *   -d '{"username":"alice","password":"password123"}'
   * ```
   */
  app.post('/login',
    bodyValidator(LoginRequestSchema),
    async (c) => {
      const body = c.get('validatedBody');

      try {
        // 查找用户
        const user = await userService.findByUsername(body.username);

        if (!user) {
          // 用户不存在，返回通用错误（不泄露用户名是否存在）
          return apiErrorResponse(c, ApiErrorCode.CREDENTIALS_INVALID, 'Invalid credentials');
        }

        // 验证密码
        const passwordValid = await userService.verifyPassword(
          body.password,
          user.passwordHash
        );

        if (!passwordValid) {
          // 密码错误，返回通用错误
          return apiErrorResponse(c, ApiErrorCode.CREDENTIALS_INVALID, 'Invalid credentials');
        }

        // 生成 Token
        const tokens = jwtService.generateTokens({
          sub: user.id,
          username: body.username
        });

        return successResponse(c, tokens);

      } catch (error) {
        console.error('Login error:', error);
        return apiErrorResponse(c, ApiErrorCode.INTERNAL_ERROR, 'Authentication failed');
      }
    }
  );

  /**
   * POST /api/v1/auth/refresh
   *
   * 刷新 Token
   *
   * @description
   * 使用刷新 Token 获取新的访问 Token
   *
   * @request { refreshToken: string }
   * @response { accessToken, refreshToken, tokenType, expiresIn }
   *
   * @example
   * ```bash
   * curl -X POST http://localhost:3000/api/v1/auth/refresh \
   *   -H "Content-Type: application/json" \
   *   -d '{"refreshToken":"eyJhbGc..."}'
   * ```
   */
  app.post('/refresh',
    bodyValidator(RefreshTokenRequestSchema),
    async (c) => {
      const body = c.get('validatedBody');

      try {
        // 刷新 Token
        const tokens = jwtService.refreshAccessToken(body.refreshToken);

        return successResponse(c, tokens);

      } catch (error) {
        const { AuthError } = await import('../types.js');
        if (error instanceof AuthError) {
          return apiErrorResponse(c, ApiErrorCode.TOKEN_INVALID, 'Invalid refresh token');
        }
        console.error('Refresh error:', error);
        return apiErrorResponse(c, ApiErrorCode.INTERNAL_ERROR, 'Token refresh failed');
      }
    }
  );

  /**
   * GET /api/v1/auth/me
   *
   * 获取当前用户信息
   *
   * @description
   * 返回当前认证用户的基本信息
   *
   * @requires Authorization: Bearer {token}
   * @response { sub, username, jti }
   *
   * @example
   * ```bash
   * curl http://localhost:3000/api/v1/auth/me \
   *   -H "Authorization: Bearer eyJhbGc..."
   * ```
   */
  app.get('/me', jwtMiddleware({ jwtService }), (c) => {
    const user = getAuthUser(c);

    if (!user) {
      return apiErrorResponse(c, ApiErrorCode.AUTHENTICATION_FAILED, 'Not authenticated');
    }

    return successResponse(c, {
      sub: user.sub,
      username: user.username,
      jti: user.jti
    });
  });

  /**
   * POST /api/v1/auth/logout
   *
   * 用户登出
   *
   * @description
   * 无状态 JWT 实现，登出主要靠客户端删除 Token
   * 此端点用于确认登出操作（未来可扩展 Token 黑名单）
   *
   * @requires Authorization: Bearer {token}
   * @response { message }
   *
   * @example
   * ```bash
   * curl -X POST http://localhost:3000/api/v1/auth/logout \
   *   -H "Authorization: Bearer eyJhbGc..."
   * ```
   */
  app.post('/logout', jwtMiddleware({ jwtService }), (c) => {
    const user = getAuthUser(c);

    if (!user) {
      return apiErrorResponse(c, ApiErrorCode.AUTHENTICATION_FAILED, 'Not authenticated');
    }

    // 无状态实现：客户端负责删除 Token
    // 有状态实现：将 Token 加入黑名单
    return successResponse(c, {
      message: 'Successfully logged out',
      // 提示客户端删除 Token
      instruction: 'Please discard your tokens'
    });
  });

  return app;
}

/**
 * 返回成功响应
 *
 * @param c - Hono 上下文
 * @param data - 响应数据
 * @param status - HTTP 状态码（默认 200）
 * @returns JSON 响应
 *
 * @private
 */
function successResponse<T>(
  c: any,
  data: T,
  status: number = 200
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    }
  };

  return c.json(response, status);
}

/**
 * 导出类型
 */
export type { IUserService, SuccessResponse };
