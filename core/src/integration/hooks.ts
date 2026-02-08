/**
 * PRISM-Gateway Hook系统集成
 * 在Claude Code关键事件中触发Gateway检查和复盘
 *
 * 三种Hook类型：
 * 1. SessionStart - 会话开始时加载项目状态，检查历史违规
 * 2. FormatReminder - 每次响应前检查任务意图
 * 3. Stop - 会话结束时触发复盘，保存学习
 */

import {
  HookType,
  HookStatus,
  HookResult,
  HookConfig,
  SessionStartContext,
  SessionStartData,
  FormatReminderContext,
  FormatReminderData,
  StopContext,
  StopData,
  HookStats,
  HookEventListener
} from '../types/hooks.js';
import { MemoryStore } from '../core/MemoryStore.js';
import { GatewayGuard } from '../core/GatewayGuard.js';
import { RetrospectiveCore } from '../core/RetrospectiveCore.js';
import { RetroMode, RetroTriggerType } from '../types/retrospective.js';

/**
 * HookManager - Hook系统核心类
 */
export class HookManager {
  private memoryStore: MemoryStore;
  private gatewayGuard: GatewayGuard;
  private retrospectiveCore: RetrospectiveCore;
  private config: HookConfig;
  private stats: HookStats;
  private listeners: Map<string, Set<HookEventListener>>;

  constructor(memoryStore?: MemoryStore, config?: Partial<HookConfig>) {
    this.memoryStore = memoryStore || new MemoryStore();
    this.gatewayGuard = new GatewayGuard(this.memoryStore);
    this.retrospectiveCore = new RetrospectiveCore();

    // 默认配置
    this.config = this.mergeWithDefaultConfig(config);

    // 初始化统计
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionsByType: {
        [HookType.SESSION_START]: 0,
        [HookType.FORMAT_REMINDER]: 0,
        [HookType.STOP]: 0
      }
    };

    // 初始化事件监听器
    this.listeners = new Map();
  }

  // ==================== 配置管理 ====================

  /**
   * 获取当前配置
   */
  getConfig(): HookConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<HookConfig>): void {
    this.config = this.mergeWithDefaultConfig(updates);
  }

  /**
   * 检查Hook系统是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 检查特定Hook是否启用
   */
  isHookEnabled(hookType: HookType): boolean {
    switch (hookType) {
      case HookType.SESSION_START:
        return this.config.hooks.session_start.enabled;
      case HookType.FORMAT_REMINDER:
        return this.config.hooks.format_reminder.enabled;
      case HookType.STOP:
        return this.config.hooks.stop.enabled;
      default:
        return false;
    }
  }

  /**
   * 设置Hook启用状态
   */
  setHookEnabled(hookType: HookType, enabled: boolean): void {
    switch (hookType) {
      case HookType.SESSION_START:
        this.config.hooks.session_start.enabled = enabled;
        break;
      case HookType.FORMAT_REMINDER:
        this.config.hooks.format_reminder.enabled = enabled;
        break;
      case HookType.STOP:
        this.config.hooks.stop.enabled = enabled;
        break;
    }
  }

  /**
   * 获取已注册的Hook列表
   */
  getRegisteredHooks(): HookType[] {
    return [HookType.SESSION_START, HookType.FORMAT_REMINDER, HookType.STOP];
  }

  // ==================== Hook执行 ====================

  /**
   * 执行SessionStart Hook
   * 在会话开始时加载项目状态并检查历史违规
   */
  async executeSessionStart(context: SessionStartContext): Promise<HookResult> {
    const startTime = Date.now();

    // 检查是否启用
    if (!this.config.enabled || !this.config.hooks.session_start.enabled) {
      return this.createResult(HookType.SESSION_START, HookStatus.SKIPPED, false, startTime, {});
    }

    try {
      // 验证上下文
      if (!context.sessionId || !context.projectId) {
        throw new Error('Invalid SessionStart context: missing sessionId or projectId');
      }

      const data: SessionStartData = {
        projectStateLoaded: false,
        historicalViolations: 0
      };

      // 1. 加载项目状态
      if (this.config.hooks.session_start.loadProjectState) {
        try {
          // 尝试获取项目的复盘记录来验证项目状态
          await this.memoryStore.getRecentRetros(context.projectId, 1);
          data.projectStateLoaded = true;
        } catch (error) {
          // 项目可能没有历史记录，这也是正常的
          data.projectStateLoaded = true;
        }
      }

      // 2. 检查历史违规
      if (this.config.hooks.session_start.checkHistoricalViolations) {
        const violations = await this.memoryStore.getRecentViolations(
          this.config.hooks.session_start.maxHistoricalLookback
        );
        data.historicalViolations = violations.length;
      }

      // 3. 执行初始检查（可选）
      if (context.metadata?.initialIntent) {
        const checkResult = await this.gatewayGuard.check(context.metadata.initialIntent);
        data.initialCheckResult = {
          passed: checkResult.status === 'PASS',
          warnings: checkResult.violations.length + checkResult.risks.length
        };
      }

      const result = this.createResult(HookType.SESSION_START, HookStatus.ENABLED, true, startTime, data);
      this.emit('hook:executed', result);
      return result;

    } catch (error) {
      return this.createResult(
        HookType.SESSION_START,
        HookStatus.ERROR,
        false,
        startTime,
        {},
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 执行FormatReminder Hook
   * 在每次响应前检查任务意图
   */
  async executeFormatReminder(context: FormatReminderContext): Promise<HookResult> {
    const startTime = Date.now();

    // 检查是否启用
    if (!this.config.enabled || !this.config.hooks.format_reminder.enabled) {
      return this.createResult(HookType.FORMAT_REMINDER, HookStatus.SKIPPED, false, startTime, {});
    }

    try {
      // 验证上下文
      if (!context.sessionId || !context.taskIntent) {
        throw new Error('Invalid FormatReminder context: missing sessionId or taskIntent');
      }

      const data: FormatReminderData = {
        checkPerformed: false,
        suggestions: [],
        shouldBlock: false
      };

      // 1. 执行意图检查
      if (this.config.hooks.format_reminder.performIntentCheck) {
        const checkResult = await this.gatewayGuard.check(context.taskIntent, {
          project_id: context.metadata?.projectId,
          phase: context.phase
        });

        data.checkPerformed = true;
        data.checkResult = {
          status: checkResult.status,
          violations: checkResult.violations.length,
          risks: checkResult.risks.length,
          traps: checkResult.traps.length
        };

        // 2. 提取建议
        data.suggestions = checkResult.suggestions
          .slice(0, this.config.hooks.format_reminder.maxSuggestions)
          .map(s => s.message);

        // 3. 检查是否需要阻止
        if (this.config.hooks.format_reminder.blockOnHardViolation) {
          data.shouldBlock = checkResult.violations.some(v => v.severity === 'HARD_BLOCK');
        }
      }

      const result = this.createResult(HookType.FORMAT_REMINDER, HookStatus.ENABLED, true, startTime, data);
      this.emit('hook:executed', result);
      return result;

    } catch (error) {
      return this.createResult(
        HookType.FORMAT_REMINDER,
        HookStatus.ERROR,
        false,
        startTime,
        {},
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 执行Stop Hook
   * 在会话结束时触发复盘并保存学习
   */
  async executeStop(context: StopContext): Promise<HookResult> {
    const startTime = Date.now();

    // 检查是否启用
    if (!this.config.enabled || !this.config.hooks.stop.enabled) {
      return this.createResult(HookType.STOP, HookStatus.SKIPPED, false, startTime, {});
    }

    try {
      // 验证上下文
      if (!context.sessionId || !context.projectId) {
        throw new Error('Invalid Stop context: missing sessionId or projectId');
      }

      const data: StopData = {
        retrospectiveTriggered: false,
        lessonsCaptured: 0,
        improvementsIdentified: 0
      };

      // 1. 检查是否满足复盘条件
      const shouldTriggerRetro =
        this.config.hooks.stop.autoRetrospective &&
        context.duration >= this.config.hooks.stop.minDuration;

      if (shouldTriggerRetro) {
        data.retrospectiveTriggered = true;
        data.retrospectiveType = this.config.hooks.stop.retroType;

        // 2. 执行复盘
        try {
          const retroInput = {
            id: `retro_${context.sessionId}_${Date.now()}`,
            projectId: context.projectId,
            triggerType: context.triggerType === 'manual' ? RetroTriggerType.MANUAL : RetroTriggerType.AUTO,
            context: {
              phase: context.metadata?.phase,
              history: context.metadata?.history,
              duration: context.duration
            },
            metadata: {
              sessionId: context.sessionId,
              triggerType: context.triggerType
            }
          };

          // 根据配置选择复盘模式
          this.retrospectiveCore.switchMode(this.config.hooks.stop.retroType as RetroMode);

          const execution = await this.retrospectiveCore.executeRetro(retroInput);

          if (execution.status === 'completed') {
            data.lessonsCaptured = execution.results?.extraction?.lessonsLearned?.length || 0;
            data.improvementsIdentified = execution.results?.extraction?.improvementAreas?.length || 0;

            if (execution.results?.extraction) {
              data.retroSummary = `${execution.results.extraction.lessonsLearned.length}个教训, ${execution.results.extraction.improvementAreas.length}个改进`;
            }
          }
        } catch (retroError) {
          // 复盘失败不应该导致Hook失败
          console.warn(`[Hook] Retrospective failed: ${retroError}`);
        }
      }

      // 3. 保存学习（如果配置启用）
      if (this.config.hooks.stop.saveLearnings && context.metadata?.learnings) {
        // 这里可以扩展保存学习的逻辑
        // 例如保存到MemoryStore或发送到外部系统
      }

      const result = this.createResult(HookType.STOP, HookStatus.ENABLED, true, startTime, data);
      this.emit('hook:executed', result);
      return result;

    } catch (error) {
      return this.createResult(
        HookType.STOP,
        HookStatus.ERROR,
        false,
        startTime,
        {},
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ==================== 统计和监控 ====================

  /**
   * 获取执行统计
   */
  getStats(): HookStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionsByType: {
        [HookType.SESSION_START]: 0,
        [HookType.FORMAT_REMINDER]: 0,
        [HookType.STOP]: 0
      }
    };
  }

  // ==================== 事件系统 ====================

  /**
   * 注册事件监听器
   */
  on(event: string, listener: HookEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * 移除事件监听器
   */
  off(event: string, listener: HookEventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, result: HookResult): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(result);
        } catch (error) {
          console.error(`[Hook] Listener error: ${error}`);
        }
      });
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 创建Hook结果
   */
  private createResult(
    hookType: HookType,
    status: HookStatus,
    executed: boolean,
    startTime: number,
    data: Record<string, any>,
    error?: string
  ): HookResult {
    const executionTime = Date.now() - startTime;

    // 更新统计
    this.stats.totalExecutions++;
    this.stats.executionsByType[hookType]++;

    if (status === HookStatus.ERROR || (executed && error)) {
      this.stats.failedExecutions++;
    } else if (executed) {
      this.stats.successfulExecutions++;
    }

    // 更新平均执行时间
    if (executed || status === HookStatus.ERROR) {
      this.stats.averageExecutionTime =
        (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime) /
        this.stats.totalExecutions;
    }

    this.stats.lastExecution = new Date().toISOString();

    return {
      hookType,
      status,
      executed,
      timestamp: new Date().toISOString(),
      executionTime,
      data: executed ? data : undefined,
      error
    };
  }

  /**
   * 合并默认配置
   */
  private mergeWithDefaultConfig(partial?: Partial<HookConfig>): HookConfig {
    const defaultConfig: HookConfig = {
      enabled: true,
      hooks: {
        session_start: {
          enabled: true,
          loadProjectState: true,
          checkHistoricalViolations: true,
          maxHistoricalLookback: 7
        },
        format_reminder: {
          enabled: true,
          performIntentCheck: true,
          checkTimeout: 500,
          blockOnHardViolation: false,
          maxSuggestions: 5
        },
        stop: {
          enabled: true,
          autoRetrospective: true,
          retroType: 'quick',
          minDuration: 60000,
          saveLearnings: true
        }
      },
      performance: {
        maxExecutionTime: 1000,
        asyncExecution: false,
        retryOnFailure: false,
        maxRetries: 1
      }
    };

    return this.deepMerge(defaultConfig, partial || {});
  }

  /**
   * 深度合并对象
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(targetValue, sourceValue);
      } else {
        (result as any)[key] = sourceValue;
      }
    }

    return result;
  }
}

// 导出单例
export const hookManager = new HookManager();

// 便捷函数
export async function executeSessionStart(context: SessionStartContext): Promise<HookResult> {
  return hookManager.executeSessionStart(context);
}

export async function executeFormatReminder(context: FormatReminderContext): Promise<HookResult> {
  return hookManager.executeFormatReminder(context);
}

export async function executeStop(context: StopContext): Promise<HookResult> {
  return hookManager.executeStop(context);
}
