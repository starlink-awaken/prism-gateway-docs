/**
 * CORS 安全中间件
 *
 * @description
 * 提供安全的跨域资源共享（CORS）配置，修复 SEC-003 安全漏洞：
 *
 * **安全问题修复：**
 * - 移除 `origin: '*'` 通配符配置
 * - 实现来源白名单验证
 * - 减少预检缓存时间从 24 小时到 10 分钟
 * - 支持凭证传递的安全配置
 *
 * **功能特性：**
 * - 基于环境变量的来源配置
 * - 开发环境自动允许 localhost
 * - 生产环境严格验证来源
 * - 防止来源混淆攻击
 * - 完整的预检请求支持
 *
 * @module api/middleware/cors
 *
 * @example
 * ```ts
 * import { createCORSMiddleware } from './middleware/cors.js';
 *
 * // 使用环境变量配置
 * // CORS_ALLOWED_ORIGINS=https://example.com,https://app.example.com
 * app.use('*', createCORSMiddleware());
 *
 * // 或直接配置
 * app.use('*', createCORSMiddleware({
 *   allowedOrigins: ['https://example.com'],
 *   environment: 'production'
 * }));
 * ```
 */

import { Context, Env, MiddlewareHandler } from 'hono';

/**
 * CORS 配置选项
 */
export interface CORSConfig {
  /**
   * 允许的来源列表
   *
   * @description
   * 完整的 URL 来源，包括协议（http/https）
   *
   * @example
   * ```ts
   * allowedOrigins: [
   *   'https://example.com',
   *   'https://app.example.com',
   *   'http://localhost:3000'
   * ]
   * ```
   */
  allowedOrigins?: string[];

  /**
   * 运行环境
   *
   * @description
   * - development: 自动允许 localhost 和 127.0.0.1
   * - production: 严格验证配置的来源
   * - test: 类似 development 但有额外测试选项
   *
   * @default 'production'
   */
  environment?: 'development' | 'production' | 'test';

  /**
   * 允许的 HTTP 方法
   *
   * @default ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
   */
  allowMethods?: string[];

  /**
   * 允许的请求头
   *
   * @default ['Content-Type', 'Authorization', 'X-Requested-With']
   */
  allowHeaders?: string[];

  /**
   * 暴露的响应头
   *
   * @default ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
   */
  exposeHeaders?: string[];

  /**
   * 预检请求缓存时间（秒）
   *
   * @description
   * 从不安全的 86400 秒（24 小时）降低到 600 秒（10 分钟）
   *
   * @default 600
   */
  maxAge?: number;

  /**
   * 是否允许凭证（Cookie、Authorization）
   *
   * @description
   * 当设置为 true 时，不能使用通配符来源
   *
   * @default true
   */
  allowCredentials?: boolean;
}

/**
 * 开发环境默认允许的来源
 *
 * @description
 * 包括常见的本地开发端口
 */
const DEV_DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',  // Vite
  'http://localhost:5174',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<CORSConfig, 'allowedOrigins'>> = {
  environment: 'production',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 600, // 10 分钟（从 24 小时降低）
  allowCredentials: true,
};

/**
 * 验证来源是否安全
 *
 * @description
 * 防止来源混淆攻击和无效的来源格式
 *
 * @param origin - 要验证的来源
 * @returns 是否为有效的来源
 *
 * @example
 * ```ts
 * isValidOrigin('https://example.com'); // true
 * isValidOrigin('evil.com'); // false (缺少协议)
 * isValidOrigin('*'); // false (通配符)
 * ```
 */
function isValidOrigin(origin: string): boolean {
  // 拒绝空值
  if (!origin || origin === 'null') {
    return false;
  }

  // 拒绝通配符（安全要求）
  if (origin === '*' || origin.trim() === '*') {
    return false;
  }

  // 验证 URL 格式
  try {
    const url = new URL(origin);

    // 必须是 http 或 https 协议
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    // 拒绝文件协议
    if (url.protocol === 'file:') {
      return false;
    }

    return true;
  } catch {
    // URL 解析失败
    return false;
  }
}

/**
 * 检查来源是否被允许
 *
 * @description
 * 精确匹配来源（不支持子域名通配符）
 *
 * @param origin - 请求的来源
 * @param allowedOrigins - 允许的来源列表
 * @returns 来源是否被允许
 *
 * @example
 * ```ts
 * isOriginAllowed('https://example.com', ['https://example.com']); // true
 * isOriginAllowed('https://app.example.com', ['https://example.com']); // false
 * ```
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (!isValidOrigin(origin)) {
    return false;
  }

  return allowedOrigins.includes(origin);
}

/**
 * 检查是否为本地开发来源
 *
 * @description
 * 匹配 localhost 或 127.0.0.1 的任意端口
 *
 * @param origin - 请求的来源
 * @returns 是否为本地开发来源
 */
function isLocalDevOrigin(origin: string): boolean {
  if (!isValidOrigin(origin)) {
    return false;
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    // 检查 localhost 或 127.0.0.1
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 从环境变量加载配置
 *
 * @description
 * 从 CORS_ALLOWED_ORIGINS 环境变量读取允许的来源
 *
 * @returns 来源列表
 *
 * @example
 * ```bash
 * # .env
 * CORS_ALLOWED_ORIGINS=https://example.com,https://app.example.com
 * ```
 */
function loadOriginsFromEnv(): string[] {
  const envVar = process.env.CORS_ALLOWED_ORIGINS;

  if (!envVar || envVar.trim() === '') {
    return [];
  }

  // 按逗号分割，去除空格
  return envVar
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0 && isValidOrigin(origin));
}

/**
 * 获取当前环境
 *
 * @description
 * 从 NODE_ENV 环境变量读取，默认为 production
 */
function getCurrentEnvironment(): 'development' | 'production' | 'test' {
  const env = process.env.NODE_ENV?.toLowerCase();

  if (env === 'development' || env === 'dev') {
    return 'development';
  }

  if (env === 'test') {
    return 'test';
  }

  return 'production';
}

/**
 * 创建 CORS 中间件
 *
 * @description
 * 创建一个安全的 CORS 中间件实例
 *
 * @param config - 可选的配置（优先于环境变量）
 * @returns Hono 中间件函数
 *
 * @example
 * ```ts
 * // 使用环境变量配置
 * app.use('*', createCORSMiddleware());
 *
 * // 使用直接配置
 * app.use('*', createCORSMiddleware({
 *   allowedOrigins: ['https://example.com'],
 *   environment: 'production'
 * }));
 * ```
 */
export function createCORSMiddleware<E extends Env = any>(
  config: CORSConfig = {}
): MiddlewareHandler<E> {
  // 合并配置
  const finalConfig: Required<CORSConfig> & { allowedOrigins: string[] } = {
    allowedOrigins: config.allowedOrigins ?? loadOriginsFromEnv(),
    environment: config.environment ?? getCurrentEnvironment(),
    allowMethods: config.allowMethods ?? DEFAULT_CONFIG.allowMethods,
    allowHeaders: config.allowHeaders ?? DEFAULT_CONFIG.allowHeaders,
    exposeHeaders: config.exposeHeaders ?? DEFAULT_CONFIG.exposeHeaders,
    maxAge: config.maxAge ?? DEFAULT_CONFIG.maxAge,
    allowCredentials: config.allowCredentials ?? DEFAULT_CONFIG.allowCredentials,
  };

  // 构建允许的来源集合
  const allowedOriginsSet = new Set(finalConfig.allowedOrigins);

  // 开发环境添加默认本地来源
  if (finalConfig.environment === 'development' || finalConfig.environment === 'test') {
    for (const origin of DEV_DEFAULT_ORIGINS) {
      allowedOriginsSet.add(origin);
    }
  }

  const allowedOriginsArray = Array.from(allowedOriginsSet);

  // 记录配置（调试用）
  if (finalConfig.environment === 'development') {
    console.log('[CORS] 配置:', {
      environment: finalConfig.environment,
      allowedOrigins: allowedOriginsArray.length,
      maxAge: finalConfig.maxAge,
      allowCredentials: finalConfig.allowCredentials,
    });
  }

  return async (c: Context<E>, next: () => Promise<void>) => {
    // 获取请求来源
    const origin = c.req.header('Origin');

    // 如果没有 Origin 头（非跨域请求），直接继续
    if (!origin) {
      return next();
    }

    // 检查来源是否被允许
    let isAllowed = isOriginAllowed(origin, allowedOriginsArray);

    // 开发/测试环境额外检查本地来源
    if (!isAllowed && (finalConfig.environment === 'development' || finalConfig.environment === 'test')) {
      if (isLocalDevOrigin(origin)) {
        isAllowed = true;
        // 动态添加到允许列表
        allowedOriginsArray.push(origin);
      }
    }

    // 预检请求（OPTIONS）
    if (c.req.method === 'OPTIONS') {
      const accessControlRequestMethod = c.req.header('Access-Control-Request-Method');

      // 如果是有效的预检请求
      if (accessControlRequestMethod) {
        // 设置响应头
        if (isAllowed) {
          c.header('Access-Control-Allow-Origin', origin);
          c.header('Access-Control-Allow-Methods', finalConfig.allowMethods.join(', '));
          c.header('Access-Control-Allow-Headers', finalConfig.allowHeaders.join(', '));
          c.header('Access-Control-Max-Age', finalConfig.maxAge.toString());

          if (finalConfig.allowCredentials) {
            c.header('Access-Control-Allow-Credentials', 'true');
          }

          if (finalConfig.exposeHeaders.length > 0) {
            c.header('Access-Control-Expose-Headers', finalConfig.exposeHeaders.join(', '));
          }

          return c.text('', 204); // No Content
        }

        // 未授权的预检请求
        return c.text('Unauthorized', 403);
      }
    }

    // 简单请求 / 实际请求
    if (isAllowed) {
      c.header('Access-Control-Allow-Origin', origin);

      if (finalConfig.allowCredentials) {
        c.header('Access-Control-Allow-Credentials', 'true');
      }

      if (finalConfig.exposeHeaders.length > 0) {
        c.header('Access-Control-Expose-Headers', finalConfig.exposeHeaders.join(', '));
      }

      // Vary 告诉代理缓存基于 Origin 变化
      c.header('Vary', 'Origin');
    }

    return next();
  };
}

/**
 * 创建开发环境 CORS 中间件
 *
 * @description
 * 便捷函数，创建宽松的本地开发 CORS 配置
 *
 * @param additionalOrigins - 额外允许的来源
 * @returns Hono 中间件函数
 *
 * @example
 * ```ts
 * if (process.env.NODE_ENV === 'development') {
 *   app.use('*', createDevCORSMiddleware(['http://localhost:4200']));
 * }
 * ```
 */
export function createDevCORSMiddleware<E extends Env = any>(
  additionalOrigins: string[] = []
): MiddlewareHandler<E> {
  return createCORSMiddleware<E>({
    environment: 'development',
    allowedOrigins: [...DEV_DEFAULT_ORIGINS, ...additionalOrigins],
  });
}

/**
 * 创建生产环境 CORS 中间件
 *
 * @description
 * 便捷函数，创建严格的生产 CORS 配置
 *
 * @param allowedOrigins - 必需的允许来源列表
 * @returns Hono 中间件函数
 *
 * @example
 * ```ts
 * if (process.env.NODE_ENV === 'production') {
 *   app.use('*', createProdCORSMiddleware([
 *     'https://example.com',
 *     'https://app.example.com'
 *   ]));
 * }
 * ```
 */
export function createProdCORSMiddleware<E extends Env = any>(
  allowedOrigins: string[]
): MiddlewareHandler<E> {
  if (allowedOrigins.length === 0) {
    throw new Error('生产环境必须配置至少一个允许的来源');
  }

  return createCORSMiddleware<E>({
    environment: 'production',
    allowedOrigins,
  });
}

/**
 * 验证来源（工具函数）
 *
 * @description
 * 独立函数，用于验证来源是否有效
 *
 * @param origin - 要验证的来源
 * @param config - 可选的 CORS 配置
 * @returns 来源是否有效
 *
 * @example
 * ```ts
 * import { validateOrigin } from './middleware/cors.js';
 *
 * if (validateOrigin('https://example.com')) {
 *   // 来源有效
 * }
 * ```
 */
export function validateOrigin(
  origin: string,
  config?: CORSConfig
): boolean {
  const allowedOrigins = config?.allowedOrigins ?? loadOriginsFromEnv();
  const environment = config?.environment ?? getCurrentEnvironment();

  let isAllowed = isOriginAllowed(origin, allowedOrigins);

  if (!isAllowed && (environment === 'development' || environment === 'test')) {
    isAllowed = isLocalDevOrigin(origin);
  }

  return isAllowed;
}

/**
 * 导出类型
 */
export type { CORSConfig };
