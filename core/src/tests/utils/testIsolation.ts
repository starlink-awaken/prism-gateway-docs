/**
 * 测试隔离工具函数
 *
 * @description
 * 提供测试隔离所需的工具函数，确保测试之间完全独立
 *
 * @module tests/utils/testIsolation
 */

/**
 * 获取随机可用端口
 *
 * @param min - 最小端口（默认10000）
 * @param max - 最大端口（默认11000）
 * @returns 随机端口号
 *
 * @example
 * ```ts
 * const port = getRandomPort();
 * ```
 */
export function getRandomPort(min: number = 10000, max: number = 11000): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * 检查端口是否可用
 *
 * @param port - 端口号
 * @param host - 主机地址（默认127.0.0.1）
 * @returns Promise<boolean> - 端口是否可用
 *
 * @example
 * ```ts
 * const available = await isPortAvailable(3000);
 * ```
 */
export async function isPortAvailable(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/health`, {
      signal: AbortSignal.timeout(500)
    });
    // 如果有响应，说明端口被占用
    return false;
  } catch (error) {
    // 端口可能可用，但需要进一步验证
    const name = (error as Error).name;
    return name === 'AbortError' || name === 'TypeError' || name === 'FetchError';
  }
}

/**
 * 获取可用端口（带检查）
 *
 * @param maxAttempts - 最大尝试次数（默认10次）
 * @param min - 最小端口（默认10000）
 * @param max - 最大端口（默认11000）
 * @returns Promise<number> - 可用端口号
 *
 * @example
 * ```ts
 * const port = await getAvailablePort();
 * ```
 */
export async function getAvailablePort(
  maxAttempts: number = 10,
  min: number = 10000,
  max: number = 11000
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = getRandomPort(min, max);
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`无法在${maxAttempts}次尝试内找到可用端口`);
}

/**
 * 等待端口释放
 *
 * @param port - 端口号
 * @param maxWait - 最大等待时间（默认2000ms）
 * @returns Promise<void>
 *
 * @example
 * ```ts
 * await waitForPortRelease(3000);
 * ```
 */
export async function waitForPortRelease(port: number, maxWait: number = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await isPortAvailable(port)) {
      return;
    }
    await sleep(50);
  }
  console.warn(`端口${port}在${maxWait}ms内未确认释放`);
}

/**
 * 睡眠函数
 *
 * @param ms - 睡眠时间（毫秒）
 * @returns Promise<void>
 *
 * @example
 * ```ts
 * await sleep(100);
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试服务器管理器
 *
 * @description
 * 管理测试服务器的生命周期，确保正确启动和关闭
 */
export class TestServerManager {
  private servers: Map<string, any> = new Map();
  private ports: Set<number> = new Set();

  /**
   * 注册服务器
   *
   * @param name - 服务器名称
   * @param server - 服务器实例
   * @param port - 端口号
   */
  register(name: string, server: any, port: number): void {
    this.servers.set(name, server);
    this.ports.add(port);
  }

  /**
   * 停止所有服务器
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const [name, server] of this.servers.entries()) {
      if (server && typeof server.stop === 'function') {
        stopPromises.push(
          Promise.resolve().then(async () => {
            try {
              server.stop();
              await sleep(50);
            } catch (error) {
              console.warn(`停止服务器${name}失败:`, error);
            }
          })
        );
      }
    }

    await Promise.all(stopPromises);

    // 等待所有端口释放
    const portReleasePromises = Array.from(this.ports).map(port =>
      waitForPortRelease(port).catch(err => {
        console.warn(`端口${port}释放检查失败:`, err);
      })
    );
    await Promise.all(portReleasePromises);

    this.servers.clear();
    this.ports.clear();
  }

  /**
   * 停止指定服务器
   *
   * @param name - 服务器名称
   */
  async stop(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server && typeof server.stop === 'function') {
      try {
        server.stop();
        await sleep(100);
      } catch (error) {
        console.warn(`停止服务器${name}失败:`, error);
      }
      this.servers.delete(name);
    }
  }

  /**
   * 获取服务器
   *
   * @param name - 服务器名称
   * @returns 服务器实例
   */
  get(name: string): any {
    return this.servers.get(name);
  }

  /**
   * 检查服务器是否存在
   *
   * @param name - 服务器名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.servers.has(name);
  }
}

/**
 * 全局测试服务器管理器实例
 */
export const testServerManager = new TestServerManager();

/**
 * 清理所有测试状态
 *
 * @description
 * 清理可能被污染的全局状态
 */
export function cleanupGlobalState(): void {
  // 清理任何全局缓存
  if (typeof globalThis !== 'undefined') {
    // 移除测试相关的全局属性
    const keysToRemove = Object.keys(globalThis).filter(key =>
      key.startsWith('__test_') ||
      key.startsWith('__bun_') ||
      key.includes('prism') ||
      key.includes('PRISM')
    );
    for (const key of keysToRemove) {
      delete (globalThis as any)[key];
    }
  }
}

/**
 * 测试隔离配置
 */
export interface TestIsolationConfig {
  /** 使用随机端口 */
  useRandomPort?: boolean;
  /** 端口范围 */
  portRange?: { min: number; max: number };
  /** 清理全局状态 */
  cleanupGlobals?: boolean;
  /** 等待端口释放 */
  waitForPortRelease?: boolean;
}

/**
 * 创建隔离的测试环境
 *
 * @param config - 配置选项
 * @returns 测试环境信息
 *
 * @example
 * ```ts
 * const env = await createIsolatedTestEnv({
 *   useRandomPort: true,
 *   portRange: { min: 10000, max: 11000 }
 * });
 *
 * // 使用 env.port 启动服务器
 *
 * // 测试结束后清理
 * await cleanupIsolatedTestEnv(env);
 * ```
 */
export async function createIsolatedTestEnv(
  config: TestIsolationConfig = {}
): Promise<{
  port: number;
  cleanup: () => Promise<void>;
}> {
  const {
    useRandomPort = true,
    portRange = { min: 10000, max: 11000 },
    cleanupGlobals = true,
    waitForPort: waitForPortReleaseOption = true
  } = config;

  // 清理全局状态
  if (cleanupGlobals) {
    cleanupGlobalState();
  }

  // 获取端口
  let port: number;
  if (useRandomPort) {
    port = await getAvailablePort(10, portRange.min, portRange.max);
  } else {
    port = portRange.min;
  }

  // 创建清理函数
  const cleanup = async () => {
    if (waitForPortReleaseOption) {
      await waitForPortRelease(port);
    }
    if (cleanupGlobals) {
      cleanupGlobalState();
    }
  };

  return { port, cleanup };
}
