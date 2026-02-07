/**
 * JWT 认证服务
 *
 * @description
 * 提供完整的 JWT Token 生成、验证和管理功能
 *
 * @features
 * - HS256 签名算法
 * - 访问 Token 和刷新 Token 生成
 * - Token 验证和过期检查
 * - Token 刷新机制
 * - 类型安全的 Payload
 *
 * @module api/auth/JWTService
 */

import * as crypto from 'node:crypto';
import {
  AuthConfig,
  JWTPayload,
  TokenValidationResult,
  LoginResponse,
  RefreshTokenResponse,
  AuthError,
  AuthErrorType
} from './types.js';

/**
 * Token 生成结果
 */
interface GeneratedToken {
  token: string;
  payload: JWTPayload;
}

/**
 * JWT 签名头（Base64URL 编码）
 */
const JWT_HEADER = btoa(
  JSON.stringify({ alg: 'HS256', typ: 'JWT' })
).replace(/=/g, '');

/**
 * JWT 认证服务类
 *
 * @description
 * 轻量级 JWT 实现，使用 HMAC-SHA256 签名
 *
 * @example
 * ```ts
 * const jwtService = new JWTService({
 *   secret: process.env.JWT_SECRET!,
 *   accessTokenTTL: 3600,
 *   refreshTokenTTL: 604800,
 *   issuer: 'prism-gateway',
 *   audience: 'prism-gateway-api'
 * });
 *
 * // 生成 Token
 * const tokens = jwtService.generateTokens({ sub: 'user1', username: 'alice' });
 *
 * // 验证 Token
 * const result = jwtService.verifyToken(tokens.accessToken);
 * if (result.valid) {
 *   console.log('User:', result.payload?.sub);
 * }
 * ```
 */
export class JWTService {
  private readonly config: AuthConfig;

  // 用于生成唯一 JTI 的计数器
  private jtiCounter = 0;

  /**
   * 创建 JWT 服务实例
   *
   * @param config - 认证配置
   */
  constructor(config: AuthConfig) {
    if (!config.secret || config.secret.length < 32) {
      throw new AuthError(
        'JWT secret must be at least 32 characters long',
        AuthErrorType.INTERNAL_ERROR,
        500
      );
    }

    this.config = { ...config };
  }

  /**
   * 生成访问 Token
   *
   * @param payload - 用户信息
   * @returns 访问 Token
   *
   * @example
   * ```ts
   * const token = jwtService.generateAccessToken({
   *   sub: 'user123',
   *   username: 'alice',
   *   role: 'user'
   * });
   * ```
   */
  generateAccessToken(payload: { sub: string; username: string; role?: string }): string {
    return this.generateToken(payload, 'access', this.config.accessTokenTTL);
  }

  /**
   * 生成刷新 Token
   *
   * @param payload - 用户信息
   * @returns 刷新 Token
   */
  generateRefreshToken(payload: { sub: string; username: string; role?: string }): string {
    return this.generateToken(
      payload,
      'refresh',
      this.config.refreshTokenTTL
    );
  }

  /**
   * 同时生成访问 Token 和刷新 Token
   *
   * @param payload - 用户信息
   * @returns Token 对（访问 Token + 刷新 Token）
   *
   * @example
   * ```ts
   * const tokens = jwtService.generateTokens({
   *   sub: 'user123',
   *   username: 'alice',
   *   role: 'user'
   * });
   * console.log(tokens.accessToken);
   * console.log(tokens.refreshToken);
   * ```
   */
  generateTokens(payload: {
    sub: string;
    username: string;
    role?: string;
  }): LoginResponse {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenTTL
    };
  }

  /**
   * 使用刷新 Token 获取新的访问 Token
   *
   * @param refreshToken - 刷新 Token
   * @returns 新的 Token 对
   * @throws {AuthError} 如果刷新 Token 无效
   *
   * @example
   * ```ts
   * const newTokens = jwtService.refreshAccessToken(oldRefreshToken);
   * ```
   */
  refreshAccessToken(refreshToken: string): RefreshTokenResponse {
    const result = this.verifyToken(refreshToken, 'refresh');

    if (!result.valid || !result.payload) {
      throw new AuthError(
        'Invalid refresh token',
        AuthErrorType.INVALID_TOKEN_TYPE,
        401
      );
    }

    const { sub, username, role } = result.payload;

    // 生成新的 Token 对
    const accessToken = this.generateAccessToken({ sub, username, role });
    const newRefreshToken = this.generateRefreshToken({ sub, username, role });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenTTL
    };
  }

  /**
   * 验证 Token
   *
   * @param token - JWT Token
   * @param expectedType - 期望的 Token 类型（可选）
   * @returns 验证结果
   *
   * @example
   * ```ts
   * const result = jwtService.verifyToken(token, 'access');
   * if (result.valid) {
   *   console.log('User ID:', result.payload?.sub);
   * } else {
   *   console.log('Error:', result.error);
   * }
   * ```
   */
  verifyToken(
    token: string,
    expectedType?: 'access' | 'refresh'
  ): TokenValidationResult {
    try {
      // 解码 Token
      const payload = this.decodeAndVerify(token);

      if (!payload) {
        return {
          valid: false,
          error: 'Invalid token format'
        };
      }

      // 检查 Token 类型
      if (expectedType && payload.type !== expectedType) {
        return {
          valid: false,
          error: `Expected ${expectedType} token, got ${payload.type}`
        };
      }

      // 检查过期
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return {
          valid: false,
          error: 'Token has expired'
        };
      }

      // 检查签发者
      if (payload.iss !== this.config.issuer) {
        return {
          valid: false,
          error: 'Invalid token issuer'
        };
      }

      // 检查受众
      if (payload.aud !== this.config.audience) {
        return {
          valid: false,
          error: 'Invalid token audience'
        };
      }

      return {
        valid: true,
        payload
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Token verification failed'
      };
    }
  }

  /**
   * 解码 Token（不验证签名，仅用于调试）
   *
   * @param token - JWT Token
   * @returns 解码后的 Payload，失败返回 null
   *
   * @remarks
   * 此方法不验证签名，仅用于调试目的。不要用于认证决策。
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Base64URL 解码
      const payload = parts[1];
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));

      return JSON.parse(decoded) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * 获取服务配置（只读副本）
   *
   * @returns 配置副本
   */
  getConfig(): Readonly<AuthConfig> {
    return { ...this.config };
  }

  /**
   * 清理资源
   *
   * @description
   * 当前实现无需清理，但为了一致性保留此方法
   */
  dispose(): void {
    // 无状态服务，无需清理
  }

  /**
   * 生成 Token（内部方法）
   *
   * @param payload - 用户信息
   * @param type - Token 类型
   * @param ttl - 过期时间（秒）
   * @returns JWT Token
   */
  private generateToken(
    payload: { sub: string; username: string; role?: string },
    type: 'access' | 'refresh',
    ttl: number
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const jti = this.generateJTI();

    const jwtPayload: JWTPayload = {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      type,
      iat: now,
      exp: now + ttl,
      jti,
      iss: this.config.issuer,
      aud: this.config.audience
    };

    // 编码 Payload
    const encodedPayload = this.base64UrlEncode(JSON.stringify(jwtPayload));

    // 生成签名
    const signatureInput = `${JWT_HEADER}.${encodedPayload}`;
    const signature = this.sign(signatureInput);

    return `${signatureInput}.${signature}`;
  }

  /**
   * 解码并验证 Token（内部方法）
   *
   * @param token - JWT Token
   * @returns 解码后的 Payload，失败返回 null
   */
  private decodeAndVerify(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [, payloadBase64, signature] = parts;

      // 验证签名
      const signatureInput = `${parts[0]}.${parts[1]}`;
      const expectedSignature = this.sign(signatureInput);

      // 使用恒定时间比较防止时序攻击
      if (!this.constantTimeCompare(signature, expectedSignature)) {
        return null;
      }

      // 解码 Payload
      const padded =
        payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
      const decoded = atob(
        padded.replace(/-/g, '+').replace(/_/g, '/')
      );

      return JSON.parse(decoded) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * HMAC-SHA256 签名
   *
   * @param data - 待签名数据
   * @returns Base64URL 编码的签名
   */
  private sign(data: string): string {
    // 使用 Node.js crypto 模块进行 HMAC-SHA256
    const hmac = crypto.createHmac('sha256', this.config.secret);
    hmac.update(data);
    const signature = hmac.digest('base64');

    // 转换为 Base64URL
    return signature
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * 生成唯一的 JWT ID
   *
   * @returns JTI 字符串
   */
  private generateJTI(): string {
    this.jtiCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `jti_${timestamp}_${this.jtiCounter}_${random}`;
  }

  /**
   * Base64URL 编码
   *
   * @param data - 待编码字符串
   * @returns Base64URL 编码结果
   */
  private base64UrlEncode(data: string): string {
    const base64 = btoa(data);
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * 恒定时间字符串比较（防止时序攻击）
   *
   * @param a - 字符串 A
   * @param b - 字符串 B
   * @returns 是否相等
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

/**
 * 导出类型
 */
export type { AuthConfig, JWTPayload, TokenValidationResult };
