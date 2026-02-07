/**
 * 依赖注入容器
 *
 * @description
 * 简单的依赖注入容器，管理所有共享服务实例
 *
 * @features
 * - 单例模式管理
 * - 延迟初始化
 * - 类型安全
 * - 生命周期管理
 *
 * @example
 * ```typescript
 * import { DIContainer } from './di.js';
 *
 * // 获取 MemoryStore 实例
 * const memoryStore = DIContainer.getMemoryStore();
 *
 * // 获取 AnalyticsService 实例
 * const analyticsService = DIContainer.getAnalyticsService();
 *
 * // 清理所有资源
 * DIContainer.dispose();
 * ```
 */

import { MemoryStore } from '../core/MemoryStore.js';
import { AnalyticsService } from '../core/analytics/index-full.js';

/**
 * 服务容器接口
 */
interface ServiceContainer {
  memoryStore?: MemoryStore;
  analyticsService?: AnalyticsService;
}

/**
 * 依赖注入容器类
 *
 * @description
 * 单例容器，管理所有共享服务
 */
class DIContainerImpl {
  private container: ServiceContainer = {};
  private initialized = false;

  /**
   * 获取 MemoryStore 实例
   *
   * @returns MemoryStore 实例
   */
  getMemoryStore(): MemoryStore {
    if (!this.container.memoryStore) {
      this.container.memoryStore = new MemoryStore();
    }
    return this.container.memoryStore;
  }

  /**
   * 获取 AnalyticsService 实例
   *
   * @returns AnalyticsService 实例
   */
  getAnalyticsService(): AnalyticsService {
    if (!this.container.analyticsService) {
      const memoryStore = this.getMemoryStore();
      this.container.analyticsService = new AnalyticsService({
        memoryStore,
        cacheSize: 1000,
        defaultTTL: 5 * 60 * 1000 // 5 minutes
      });
    }
    return this.container.analyticsService;
  }

  /**
   * 初始化所有服务
   *
   * @description
   * 预加载所有单例服务（可选）
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    console.log('🔧 初始化依赖注入容器...');

    // 预加载所有服务
    this.getMemoryStore();
    this.getAnalyticsService();

    this.initialized = true;
    console.log('✅ 依赖注入容器初始化完成');
  }

  /**
   * 清理所有资源
   *
   * @description
   * 清理所有服务实例，释放资源
   */
  dispose(): void {
    console.log('🧹 清理依赖注入容器...');

    // 清理 AnalyticsService
    if (this.container.analyticsService) {
      this.container.analyticsService.clearCache().catch(console.error);
      delete this.container.analyticsService;
    }

    // 清理 MemoryStore
    if (this.container.memoryStore) {
      delete this.container.memoryStore;
    }

    this.initialized = false;
    console.log('✅ 依赖注入容器已清理');
  }

  /**
   * 重置容器（主要用于测试）
   *
   * @description
   * 清空所有实例，允许重新初始化
   */
  reset(): void {
    this.dispose();
    this.container = {};
  }

  /**
   * 获取容器状态
   *
   * @returns 容器状态信息
   */
  getStatus(): {
    initialized: boolean;
    services: {
      memoryStore: boolean;
      analyticsService: boolean;
    };
  } {
    return {
      initialized: this.initialized,
      services: {
        memoryStore: !!this.container.memoryStore,
        analyticsService: !!this.container.analyticsService
      }
    };
  }
}

/**
 * 导出单例实例
 */
export const DIContainer = new DIContainerImpl();

/**
 * 导出类型
 */
export type { ServiceContainer };
