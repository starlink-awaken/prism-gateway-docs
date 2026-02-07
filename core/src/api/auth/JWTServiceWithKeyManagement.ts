/**
 * JWT 认证服务（集成密钥管理）
 *
 * @description
 * JWT Token 生成、验证和管理，集成 KeyVersionManager 支持密钥轮换
 *
 * @features
 * - HS256 签名算法
 * - 密钥版本管理（支持平滑轮换）
 * - 访问 Token 和刷新 Token 生成
 * - Token 验证（自动尝试所有历史密钥）
 * - Token 刷新机制
 * - 类型安全的 Payload
 *
 * @module api/auth/JWTServiceWithKeyManagement
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
import { KeyVersionManager } from '../security/KeyVersionManager.js';

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
 * JWT 认证服务类（集成密钥管理）
 *
 * @description
 * 使用 KeyVersionManager 管理密钥版本，支持：
 * 1. 新 Token 使用最新密钥签名
 * 2. 旧 Token 可用历史密钥验证
 * 3. 密钥轮换无需中断服务
 *
 * @example
 * ```ts
 * const jwtService = new JWTServiceWithKeyManagement({
 *   secret: process.env.JWT_SECRET!,
 *   accessTokenTTL: 3600,
 *   refreshTokenTTL: 604800,
 *   issuer: 'prism-gateway',
 *   audience: 'prism-gateway-api',
 *   keyRotationDays: 30
 * });
 *
 * // 生成 Token
 * const tokens = jwtService.generateTokens({ sub: 'user1', username: 'alice' });
 *
 * // 验证 Token（自动尝试所有历史密钥）
 * const result = jwtService.verifyToken(tokens.accessToken);
 * ```
 */
export class JWTServiceWithKeyManagement {
  private readonly config: AuthConfig;
  private keyManager: KeyVersionManager;
  private jtiCounter = 0;

  /**
   * 创建 JWT 服务实例
   *
   * @param config - 认证配置
   * @throws {Error} 如果主密钥为空或过短
   */
  constructor(config: AuthConfig & { keyRotationDays?: number }) {
    if (!config.secret || config.secret.length < 32) {
      throw new AuthError(
        'JWT secret must be at least 32 characters long',
        AuthErrorType.INTERNAL_ERROR,
        500
      );
    }

    this.config = {
      accessTokenTTL: 3600,
      refreshTokenTTL: 604800,
      issuer: 'prism-gateway',
      audience: 'prism-gateway-api',
      ...config
    };

    // 初始化密钥管理器
    this.keyManager = new KeyVersionManager({
      masterKey: config.secret,
      rotationDays: config.keyRotationDays || 30,
      retentionDays: 90,
      autoRotationCheck: true
    });

    // 如果配置了密钥版本，可以导入
    //（实际应用中应该从持久化存储加载）
  }

  /**
   * 生成访问 Token
   *
   * @param payload - 用户信息
   * @returns 访问 Token
   */
  generateAccessToken(payload: { sub: string; username: string }): string {
    return this.generateToken(payload, 'access', this.config.accessTokenTTL);
  }

  /**
   * 生成刷新 Token
   *
   * @param payload - 用户信息
   * @returns 刷新 Token
   */
  generateRefreshToken(payload: { sub: string; username: string }): string {
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
   */
  generateTokens(payload: {
    sub: string;
    username: string;
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

    const { sub, username } = result.payload;

    const accessToken = this.generateAccessToken({ sub, username });
    const newRefreshToken = this.generateRefreshToken({ sub, username });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenTTL
    };
  }

  /**
   * 验证 Token（支持多版本密钥）
   *
   * @param token - JWT Token
   * @param expectedType - 期望的 Token 类型（可选）
   * @returns 验证结果
   */
  verifyToken(
    token: string,
    expectedType?: 'access' | 'refresh'
  ): TokenValidationResult {
    try {
      // 尝试使用所有可用密钥验证
      const payload = this.decodeAndVerifyWithMultipleKeys(token);

      if (!payload) {
        return {
          valid: false,
          error: 'Invalid token format or signature'
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
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

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
   */
  getConfig(): Readonly<AuthConfig> {
    return { ...this.config };
  }

  /**
   * 获取密钥管理器统计信息
   */
  getKeyStats(): {
    currentVersion: number;
    totalVersions: number;
    needsRotation: boolean;
    daysUntilRotation: number;
  } {
    const stats = this.keyManager.getStats();
    return {
      currentVersion: stats.currentVersion,
      totalVersions: stats.totalVersions,
      needsRotation: stats.needsRotation,
      daysUntilRotation: stats.daysUntilRotation
    };
  }

  /**
   * 手动轮换密钥
   *
   * @param force - 是否强制轮换
   * @returns 新版本号
   */
  rotateKey(force = false): number {
    return this.keyManager.rotateKey(force);
  }

  /**
   * 清理过期的历史密钥
   */
  cleanupExpiredKeys(): number {
    return this.keyManager.cleanupExpiredKeys();
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.keyManager.dispose();
  }

  /**
   * 生成 Token（内部方法）
   */
  private generateToken(
    payload: { sub: string; username: string },
    type: 'access' | 'refresh',
    ttl: number
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const jti = this.generateJTI();

    // 使用当前活跃密钥签名
    const currentKey = this.keyManager.getCurrentKey();

    const jwtPayload: JWTPayload = {
      sub: payload.sub,
      username: payload.username,
      type,
      iat: now,
      exp: now + ttl,
      jti,
      iss: this.config.issuer,
      aud: this.config.audience
    };

    const encodedPayload = this.base64UrlEncode(JSON.stringify(jwtPayload));
    const signatureInput = `${JWT_HEADER}.${encodedPayload}`;
    const signature = this.sign(signatureInput, currentKey);

    return `${signatureInput}.${signature}`;
  }

  /**
   * 使用多个密钥版本解码并验证 Token
   */
  private decodeAndVerifyWithMultipleKeys(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [, payloadBase64, signature] = parts;

      // 尝试所有密钥版本
      const allKeys = this.keyManager.getAllKeys();

      for (const keyVersion of allKeys) {
        const signatureInput = `${parts[0]}.${parts[1]}`;
        const expectedSignature = this.sign(signatureInput, keyVersion.key);

        if (this.constantTimeCompare(signature, expectedSignature)) {
          // 签名验证成功，解码 Payload
          const padded = payloadBase64 + '='.repeat(
            (4 - (payloadBase64.length % 4)) % 4
          );
          const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
          return JSON.parse(decoded) as JWTPayload;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * HMAC-SHA256 签名
   */
  private sign(data: string, key: string): string {
    const keyBuffer = Buffer.from(key, 'base64');
    const hmac = crypto.createHmac('sha256', keyBuffer);
    hmac.update(data);
    const signature = hmac.digest('base64');

    return signature
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * 生成唯一的 JWT ID
   */
  private generateJTI(): string {
    this.jtiCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `jti_${timestamp}_${this.jtiCounter}_${random}`;
  }

  /**
   * Base64URL 编码
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
