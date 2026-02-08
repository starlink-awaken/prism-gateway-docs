/**
 * JWT 认证模块
 *
 * @description
 * 完整的 JWT 认证解决方案，包括：
 * - JWT 服务（Token 生成/验证）
 * - 认证中间件（路由保护）
 * - 认证路由（登录/刷新/登出）
 *
 * @features
 * - HS256 签名算法
 * - 访问 Token + 刷新 Token
 * - 类型安全
 * - 轻量级实现（无外部依赖）
 *
 * @example
 * ```ts
 * import { JWTService } from './auth/JWTService.js';
 * import { jwtMiddleware } from './auth/middleware/jwtMiddleware.js';
 * import { authRouter } from './auth/routes/authRoutes.js';
 *
 * // 配置
 * const jwtService = new JWTService({
 *   secret: process.env.JWT_SECRET!,
 *   accessTokenTTL: 3600,
 *   refreshTokenTTL: 604800,
 *   issuer: 'prism-gateway',
 *   audience: 'prism-gateway-api'
 * });
 *
 * // 使用中间件保护路由
 * app.use('/api/protected/*', jwtMiddleware({ jwtService }));
 *
 * // 注册认证路由
 * app.route('/api/v1/auth', authRouter({ jwtService, userService }));
 * ```
 *
 * @module api/auth
 */

// 导出类型
export type {
  JWTPayload,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  AuthConfig,
  AuthUser,
  AuthContext,
  AuthEnv,
  TokenValidationResult
} from './types.js';

// 导出错误类和枚举
export { AuthError, AuthErrorType } from './types.js';

// 导出 JWT 服务
export { JWTService } from './JWTService.js';

// 导出集成密钥管理的 JWT 服务（Task #14: 密钥管理服务集成）
export { JWTServiceWithKeyManagement } from './JWTServiceWithKeyManagement.js';

// 导出中间件
export {
  jwtMiddleware,
  extractBearerToken,
  extractCookieToken,
  extractQueryToken,
  extractToken,
  getAuthUser,
  requireAuthUser
} from './middleware/jwtMiddleware.js';

export type { JWTMiddlewareOptions } from './middleware/jwtMiddleware.js';

// 导出路由
export { authRouter } from './routes/authRoutes.js';

export type { IUserService } from './routes/authRoutes.js';
