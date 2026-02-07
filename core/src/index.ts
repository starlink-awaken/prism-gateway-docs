/**
 * PRISM-Gateway 主入口文件
 * 统一的7维度复盘和Gateway系统
 *
 * @description
 * PRISM-Gateway是一个综合的AI项目复盘和Gateway检查系统。
 *
 * @remarks
 * 核心功能：
 * - Gateway违规检查：三层检查机制（原则、模式、陷阱）
 * - 7维度数据提取：从对话历史中提取结构化数据
 * - 多模式复盘：支持快速、标准、深度三种复盘模式
 * - MEMORY存储：三层架构存储热、温、冷数据
 *
 * @example
 * ```typescript
 * import { prismGateway } from 'prism-gateway';
 *
 * // 执行快速复盘
 * const retroResult = await prismGateway.quickRetro('my-project');
 *
 * // 检查任务意图
 * const checkResult = await prismGateway.checkIntent('实现用户登录');
 * ```
 */

import { retrospectiveCore } from './core/RetrospectiveCore.js';
import { gatewayGuard } from './core/GatewayGuard.js';
import { memoryStore } from './core/MemoryStore.js';
import { dataExtractor } from './core/DataExtractor.js';
import { hookManager, executeSessionStart, executeFormatReminder, executeStop } from './integration/hooks.js';
import { MCPServer, mcpServer } from './integration/mcp/MCPServer.js';

/**
 * 主应用类
 *
 * @description
 * PRISM-Gateway的主应用类，提供统一的API接口
 *
 * @example
 * ```typescript
 * const gateway = new PrismGateway();
 * await gateway.quickRetro('my-project', { phase: '开发' });
 * ```
 */
class PrismGateway {
  constructor() {
    console.log('🚀 PRISM-Gateway 初始化中...');
    console.log('🔗 整合 MemoryStore、GatewayGuard、DataExtractor');
    console.log('⚡ 支持5分钟快速复盘流程');
  }

  /**
   * 执行快速复盘
   *
   * @param projectId - 项目ID
   * @param context - 可选的上下文信息
   * @returns 复盘执行结果
   *
   * @example
   * ```typescript
   * const result = await prismGateway.quickRetro('my-project', {
   *   phase: '开发',
   *   history: []
   * });
   * ```
   */
  async quickRetro(projectId: string, context?: Record<string, any>) {
    const taskInput = {
      id: `quick_retro_${Date.now()}`,
      projectId,
      triggerType: 'manual' as const,
      context: {
        phase: context?.phase || '执行',
        history: context?.history || [],
        user_preferences: context?.user_preferences || {}
      },
      metadata: {
        mode: 'quick',
        startTime: new Date().toISOString()
      }
    };

    console.log(`🔄 开始快速复盘 - 项目: ${projectId}`);
    const execution = await retrospectiveCore.executeRetro(taskInput);

    console.log(`✅ 复盘完成 - 状态: ${execution.status}, 耗时: ${execution.totalDuration}ms`);

    return execution;
  }

  /**
   * 检查任务意图
   *
   * @param intent - 任务意图描述
   * @param context - 可选的上下文信息
   * @returns 检查结果
   *
   * @example
   * ```typescript
   * const result = await prismGateway.checkIntent('实现用户登录功能');
   * console.log(result.status); // PASS | WARNING | BLOCKED
   * ```
   */
  async checkIntent(intent: string, context?: Record<string, any>) {
    console.log(`🔍 检查任务意图: ${intent}`);
    const result = await gatewayGuard.check(intent, context);
    console.log(`✅ 检查完成 - 状态: ${result.status}`);
    return result;
  }

  /**
   * 从对话历史提取数据
   *
   * @param history - 对话历史数组
   * @param sessionId - 会话ID
   * @returns 数据提取结果
   *
   * @example
   * ```typescript
   * const result = await prismGateway.extractFromHistory(
   *   [
   *     { role: 'user', content: '实现登录', timestamp: '...' },
   *     { role: 'assistant', content: '好的', timestamp: '...' }
   *   ],
   *   'session_123'
   * );
   * console.log(result.summary);
   * ```
   */
  async extractFromHistory(history: any[], sessionId: string) {
    console.log(`📊 开始数据提取 - 会话: ${sessionId}`);
    const result = await dataExtractor.extractDimensions(sessionId, history);
    console.log(`✅ 数据提取完成 - 置信度: ${(result.confidence * 100).toFixed(1)}%`);
    return result;
  }

  /**
   * 自动触发复盘检查
   */
  async checkAutoTrigger(projectId: string) {
    console.log(`🤖 检查自动触发 - 项目: ${projectId}`);
    const shouldTrigger = await retrospectiveCore.shouldAutoTrigger(projectId);
    console.log(`自动触发结果: ${shouldTrigger ? '需要触发' : '无需触发'}`);
    return shouldTrigger;
  }

  /**
   * 获取系统统计信息
   */
  async getStats() {
    console.log('📊 获取系统统计信息...');
    const [retroStats, memoryStats] = await Promise.all([
      retrospectiveCore.getRetroStats(),
      memoryStore.getStats()
    ]);

    return {
      retrospective: retroStats,
      memory: memoryStats,
      timestamp: new Date().toISOString()
    };
  }
}

// 创建全局实例
const prismGateway = new PrismGateway();

// 导出实例
export {
  prismGateway,
  retrospectiveCore,
  gatewayGuard,
  memoryStore,
  dataExtractor,
  hookManager,
  executeSessionStart,
  executeFormatReminder,
  executeStop,
  MCPServer,
  mcpServer
};

// 如果直接运行此文件，执行示例
if (import.meta.main) {
  console.log('🎯 PRISM-Gateway 示例运行');

  // 示例1: 快速复盘
  const demoProject = 'demo_project';
  console.log(`\n🔄 示例1: 快速复盘 ${demoProject}`);
  const retroResult = await prismGateway.quickRetro(demoProject, {
    phase: '开发',
    history: [],
    user_preferences: { mode: 'quick' }
  });
  console.log(`复盘结果:`, retroResult.status);

  // 示例2: 意图检查
  console.log(`\n🔍 示例2: 意图检查`);
  const checkResult = await prismGateway.checkIntent('实现用户登录功能');
  console.log(`检查结果:`, checkResult.status);

  // 示例3: 数据提取
  console.log(`\n📊 示例3: 数据提取`);
  const demoHistory = [
    { id: '1', role: 'user', content: '我们需要实现一个用户登录系统', timestamp: new Date().toISOString() },
    { id: '2', role: 'assistant', content: '我将帮您设计一个安全的登录系统', timestamp: new Date().toISOString() }
  ];
  const extractResult = await prismGateway.extractFromHistory(demoHistory, 'demo_session');
  console.log(`提取结果:`, extractResult.summary);

  // 示例4: 自动触发检查
  console.log(`\n🤖 示例4: 自动触发检查`);
  const autoTrigger = await prismGateway.checkAutoTrigger(demoProject);
  console.log(`自动触发:`, autoTrigger);

  // 示例5: 统计信息
  console.log(`\n📊 示例5: 系统统计`);
  const stats = await prismGateway.getStats();
  console.log(`统计信息:`, JSON.stringify(stats, null, 2));

  console.log('\n🎯 所有示例执行完成');
}