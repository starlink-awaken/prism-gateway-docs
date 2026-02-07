/**
 * JWT 认证模块类型定义
 *
 * @description
 * 定义 JWT 认证服务的所有类型接口
 *
 * @module api/auth/types
 */

/**
 * JWT Payload 结构
 *
 * @description
 * JWT Token 中存储的用户声明信息
 */
export interface JWTPayload {
  /** 用户唯一标识 */
  sub: string;
  /** 用户名 */
  username: string;
  /** 用户角色 (admin, user, viewer, guest) */
  role?: string;
  /** Token 类型（access | refresh） */
  type: 'access' | 'refresh';
  /** 签发时间（Unix 时间戳） */
  iat: number;
  /** 过期时间（Unix 时间戳） */
  exp: number;
  /** JWT ID（唯一标识，用于吊销） */
  jti: string;
  /** 签发者 */
  iss: string;
  /** 受众 */
  aud: string;
}

/**
 * 登录请求体
 */
export interface LoginRequest {
  /** 用户名或邮箱 */
  username: string;
  /** 密码 */
  password: string;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  /** 访问 Token */
  accessToken: string;
  /** 刷新 Token */
  refreshToken: string;
  /** Token 类型（固定为 Bearer） */
  tokenType: 'Bearer';
  /** 访问 Token 过期时间（秒） */
  expiresIn: number;
}

/**
 * Token 刷新请求
 */
export interface RefreshTokenRequest {
  /** 刷新 Token */
  refreshToken: string;
}

/**
 * Token 刷新响应
 */
export interface RefreshTokenResponse {
  /** 新的访问 Token */
  accessToken: string;
  /** 新的刷新 Token */
  refreshToken: string;
  /** Token 类型 */
  tokenType: 'Bearer';
  /** 访问 Token 过期时间（秒） */
  expiresIn: number;
}

/**
 * 认证配置选项
 */
export interface AuthConfig {
  /** JWT 签名密钥（必须保密） */
  secret: string;
  /** 访问 Token 有效期（秒，默认 3600 = 1 小时） */
  accessTokenTTL: number;
  /** 刷新 Token 有效期（秒，默认 604800 = 7 天） */
  refreshTokenTTL: number;
  /** Token 签发者标识 */
  issuer: string;
  /** Token 受众 */
  audience: string;
}

/**
 * 认证用户信息
 *
 * @description
 * 从 Token 中解析出的用户信息，存储在请求上下文中
 */
export interface AuthUser {
  /** 用户 ID */
  sub: string;
  /** 用户名 */
  username: string;
  /** 用户角色 */
  role?: string;
  /** Token 唯一标识 */
  jti: string;
}

/**
 * 认证错误类型
 */
export enum AuthErrorType {
  /** Token 缺失 */
  MISSING_TOKEN = 'MISSING_TOKEN',
  /** Token 格式无效 */
  INVALID_FORMAT = 'INVALID_FORMAT',
  /** Token 签名验证失败 */
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  /** Token 已过期 */
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  /** Token 类型不匹配 */
  INVALID_TOKEN_TYPE = 'INVALID_TOKEN_TYPE',
  /** 用户不存在 */
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  /** 密码错误 */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  /** 内部错误 */
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * 认证错误类
 */
export class AuthError extends Error {
  /** 错误类型 */
  readonly type: AuthErrorType;
  /** HTTP 状态码 */
  readonly statusCode: number;

  /**
   * 创建认证错误
   *
   * @param message - 错误消息（对外展示的安全消息）
   * @param type - 错误类型
   * @param statusCode - HTTP 状态码
   */
  constructor(
    message: string,
    type: AuthErrorType,
    statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
    this.type = type;
    this.statusCode = statusCode;
  }
}

/**
 * Token 验证结果
 */
export interface TokenValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息（无效时） */
  error?: string;
  /** 解码后的 Payload（有效时） */
  payload?: JWTPayload;
}

/**
 * Hono 上下文中的认证信息类型
 */
export interface AuthContext {
  /** 当前认证用户 */
  user: AuthUser;
  /** Token 原始值 */
  token: string;
}

/**
 * 扩展 Hono 环境变量类型
 */
export interface AuthEnv {
  /** 认证用户信息 */
  user: AuthUser;
}
