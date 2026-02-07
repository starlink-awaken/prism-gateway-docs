/**
 * Hook系统单元测试和集成测试
 * 测试覆盖SessionStart、FormatReminder、Stop三个Hook
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { HookManager } from '../integration/hooks';
import { HookType, HookStatus, HookConfig } from '../types/hooks';
import { MemoryStore } from '../core/MemoryStore';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

// 测试用的配置文件路径
const TEST_CONFIG_PATH = join(process.env.HOME || '', '.prism-gateway', 'hooks.test.config.json');

describe('Hook系统 - 基础功能', () => {
  let hookManager: HookManager;
  let memoryStore: MemoryStore;

  beforeEach(() => {
    memoryStore = new MemoryStore();

    // 创建测试配置
    const testConfig: HookConfig = {
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

    hookManager = new HookManager(memoryStore, testConfig);
  });

  afterEach(() => {
    // 清理测试配置文件
    if (existsSync(TEST_CONFIG_PATH)) {
      unlinkSync(TEST_CONFIG_PATH);
    }
  });

  describe('HookManager初始化', () => {
    it('应该正确初始化HookManager', () => {
      expect(hookManager).toBeDefined();
      expect(hookManager.isEnabled()).toBe(true);
    });

    it('应该能够获取所有Hook类型', () => {
      const hookTypes = hookManager.getRegisteredHooks();
      expect(hookTypes).toHaveLength(3);
      expect(hookTypes).toContain(HookType.SESSION_START);
      expect(hookTypes).toContain(HookType.FORMAT_REMINDER);
      expect(hookTypes).toContain(HookType.STOP);
    });

    it('应该能够获取配置', () => {
      const config = hookManager.getConfig();
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.hooks.session_start.enabled).toBe(true);
    });

    it('应该在禁用状态下跳过Hook执行', async () => {
      const disabledConfig: HookConfig = {
        enabled: false,
        hooks: {
          session_start: { enabled: true, loadProjectState: true, checkHistoricalViolations: true, maxHistoricalLookback: 7 },
          format_reminder: { enabled: true, performIntentCheck: true, checkTimeout: 500, blockOnHardViolation: false, maxSuggestions: 5 },
          stop: { enabled: true, autoRetrospective: true, retroType: 'quick', minDuration: 60000, saveLearnings: true }
        },
        performance: { maxExecutionTime: 1000, asyncExecution: false, retryOnFailure: false, maxRetries: 1 }
      };

      const disabledManager = new HookManager(memoryStore, disabledConfig);
      const result = await disabledManager.executeSessionStart({
        sessionId: 'test-123',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      });

      expect(result.status).toBe(HookStatus.SKIPPED);
      expect(result.executed).toBe(false);
    });
  });

  describe('SessionStart Hook', () => {
    it('应该成功执行SessionStart Hook', async () => {
      const context = {
        sessionId: 'session-001',
        projectId: 'my-project',
        startTime: new Date().toISOString(),
        agentType: 'engineer'
      };

      const result = await hookManager.executeSessionStart(context);

      expect(result).toBeDefined();
      expect(result.hookType).toBe(HookType.SESSION_START);
      expect(result.executed).toBe(true);
      expect(result.status).toBe(HookStatus.ENABLED);
      expect(result.data).toBeDefined();
    });

    it('应该加载项目状态', async () => {
      const context = {
        sessionId: 'session-002',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      };

      const result = await hookManager.executeSessionStart(context);

      expect(result.data?.projectStateLoaded).toBe(true);
    });

    it('应该检查历史违规记录', async () => {
      const context = {
        sessionId: 'session-003',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      };

      const result = await hookManager.executeSessionStart(context);

      expect(result.data?.historicalViolations).toBeDefined();
      expect(typeof result.data?.historicalViolations).toBe('number');
    });

    it('应该在配置禁用时跳过SessionStart', async () => {
      const disabledConfig: HookConfig = {
        enabled: true,
        hooks: {
          session_start: { enabled: false, loadProjectState: true, checkHistoricalViolations: true, maxHistoricalLookback: 7 },
          format_reminder: { enabled: true, performIntentCheck: true, checkTimeout: 500, blockOnHardViolation: false, maxSuggestions: 5 },
          stop: { enabled: true, autoRetrospective: true, retroType: 'quick', minDuration: 60000, saveLearnings: true }
        },
        performance: { maxExecutionTime: 1000, asyncExecution: false, retryOnFailure: false, maxRetries: 1 }
      };

      const manager = new HookManager(memoryStore, disabledConfig);
      const result = await manager.executeSessionStart({
        sessionId: 'session-004',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      });

      expect(result.executed).toBe(false);
      expect(result.status).toBe(HookStatus.SKIPPED);
    });

    it('执行时间应该小于100ms', async () => {
      const start = Date.now();
      await hookManager.executeSessionStart({
        sessionId: 'session-005',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('FormatReminder Hook', () => {
    it('应该成功执行FormatReminder Hook', async () => {
      const context = {
        sessionId: 'session-001',
        responseContent: '我将创建一个TODO应用',
        taskIntent: '创建TODO应用',
        phase: 'implementation'
      };

      const result = await hookManager.executeFormatReminder(context);

      expect(result).toBeDefined();
      expect(result.hookType).toBe(HookType.FORMAT_REMINDER);
      expect(result.executed).toBe(true);
      expect(result.status).toBe(HookStatus.ENABLED);
      expect(result.data).toBeDefined();
    });

    it('应该执行任务意图检查', async () => {
      const context = {
        sessionId: 'session-002',
        responseContent: '我将深度分析这个问题',
        taskIntent: '深度分析问题，我推测是配置错误',
        phase: 'analysis'
      };

      const result = await hookManager.executeFormatReminder(context);

      expect(result.data?.checkPerformed).toBe(true);
      expect(result.data?.checkResult).toBeDefined();
    });

    it('应该检测到违规并返回建议', async () => {
      const context = {
        sessionId: 'session-003',
        responseContent: '让我深度分析这个问题',
        taskIntent: '深度分析问题，我推测这是配置错误',
        phase: 'debugging'
      };

      const result = await hookManager.executeFormatReminder(context);

      expect(result.data?.checkResult).toBeDefined();
      expect(result.data?.suggestions).toBeInstanceOf(Array);
    });

    it('应该限制建议数量', async () => {
      const context = {
        sessionId: 'session-004',
        responseContent: '测试响应',
        taskIntent: '这是一个测试任务，可能会产生很多建议',
        phase: 'testing'
      };

      const result = await hookManager.executeFormatReminder(context);

      expect(result.data?.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('应该在配置禁用时跳过FormatReminder', async () => {
      const disabledConfig: HookConfig = {
        enabled: true,
        hooks: {
          session_start: { enabled: true, loadProjectState: true, checkHistoricalViolations: true, maxHistoricalLookback: 7 },
          format_reminder: { enabled: false, performIntentCheck: true, checkTimeout: 500, blockOnHardViolation: false, maxSuggestions: 5 },
          stop: { enabled: true, autoRetrospective: true, retroType: 'quick', minDuration: 60000, saveLearnings: true }
        },
        performance: { maxExecutionTime: 1000, asyncExecution: false, retryOnFailure: false, maxRetries: 1 }
      };

      const manager = new HookManager(memoryStore, disabledConfig);
      const result = await manager.executeFormatReminder({
        sessionId: 'session-005',
        responseContent: '测试',
        taskIntent: '测试任务'
      });

      expect(result.executed).toBe(false);
      expect(result.status).toBe(HookStatus.SKIPPED);
    });

    it('执行时间应该小于配置的超时时间', async () => {
      const context = {
        sessionId: 'session-006',
        responseContent: '测试响应',
        taskIntent: '测试任务'
      };

      const start = Date.now();
      const result = await hookManager.executeFormatReminder(context);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(result.executionTime).toBeLessThan(500);
    });
  });

  describe('Stop Hook', () => {
    it('应该成功执行Stop Hook', async () => {
      const context = {
        sessionId: 'session-001',
        projectId: 'test-project',
        endTime: new Date().toISOString(),
        duration: 120000, // 2分钟
        triggerType: 'manual' as const
      };

      const result = await hookManager.executeStop(context);

      expect(result).toBeDefined();
      expect(result.hookType).toBe(HookType.STOP);
      expect(result.executed).toBe(true);
      expect(result.status).toBe(HookStatus.ENABLED);
      expect(result.data).toBeDefined();
    });

    it('应该在会话时长超过阈值时触发复盘', async () => {
      const context = {
        sessionId: 'session-002',
        projectId: 'test-project',
        endTime: new Date().toISOString(),
        duration: 120000, // 2分钟，大于60秒阈值
        triggerType: 'manual' as const
      };

      const result = await hookManager.executeStop(context);

      expect(result.data?.retrospectiveTriggered).toBe(true);
      expect(result.data?.retrospectiveType).toBeDefined();
    });

    it('应该在会话时长不足时跳过复盘', async () => {
      const context = {
        sessionId: 'session-003',
        projectId: 'test-project',
        endTime: new Date().toISOString(),
        duration: 30000, // 30秒，小于60秒阈值
        triggerType: 'manual' as const
      };

      const result = await hookManager.executeStop(context);

      expect(result.data?.retrospectiveTriggered).toBe(false);
    });

    it('应该捕获学习要点', async () => {
      const context = {
        sessionId: 'session-004',
        projectId: 'test-project',
        endTime: new Date().toISOString(),
        duration: 120000,
        triggerType: 'auto' as const
      };

      const result = await hookManager.executeStop(context);

      if (result.data?.retrospectiveTriggered) {
        expect(result.data?.lessonsCaptured).toBeDefined();
        expect(typeof result.data?.lessonsCaptured).toBe('number');
      }
    });

    it('应该识别改进领域', async () => {
      const context = {
        sessionId: 'session-005',
        projectId: 'test-project',
        endTime: new Date().toISOString(),
        duration: 120000,
        triggerType: 'manual' as const
      };

      const result = await hookManager.executeStop(context);

      if (result.data?.retrospectiveTriggered) {
        expect(result.data?.improvementsIdentified).toBeDefined();
        expect(typeof result.data?.improvementsIdentified).toBe('number');
      }
    });

    it('应该在配置禁用时跳过Stop', async () => {
      const disabledConfig: HookConfig = {
        enabled: true,
        hooks: {
          session_start: { enabled: true, loadProjectState: true, checkHistoricalViolations: true, maxHistoricalLookback: 7 },
          format_reminder: { enabled: true, performIntentCheck: true, checkTimeout: 500, blockOnHardViolation: false, maxSuggestions: 5 },
          stop: { enabled: false, autoRetrospective: true, retroType: 'quick', minDuration: 60000, saveLearnings: true }
        },
        performance: { maxExecutionTime: 1000, asyncExecution: false, retryOnFailure: false, maxRetries: 1 }
      };

      const manager = new HookManager(memoryStore, disabledConfig);
      const result = await manager.executeStop({
        sessionId: 'session-006',
        projectId: 'test-project',
        endTime: new Date().toISOString(),
        duration: 120000
      });

      expect(result.executed).toBe(false);
      expect(result.status).toBe(HookStatus.SKIPPED);
    });
  });

  describe('Hook统计功能', () => {
    it('应该正确记录执行统计', async () => {
      // 执行几个Hook
      await hookManager.executeSessionStart({
        sessionId: 'session-stats-1',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      });

      await hookManager.executeFormatReminder({
        sessionId: 'session-stats-1',
        responseContent: '测试',
        taskIntent: '测试任务'
      });

      const stats = hookManager.getStats();

      expect(stats.totalExecutions).toBeGreaterThanOrEqual(2);
      expect(stats.successfulExecutions).toBeGreaterThanOrEqual(2);
      expect(stats.executionsByType[HookType.SESSION_START]).toBeGreaterThanOrEqual(1);
      expect(stats.executionsByType[HookType.FORMAT_REMINDER]).toBeGreaterThanOrEqual(1);
    });

    it('应该计算平均执行时间', async () => {
      const start = Date.now();
      await hookManager.executeSessionStart({
        sessionId: 'session-stats-2',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      });

      const stats = hookManager.getStats();

      // 平均执行时间应该 >= 0（快速执行可能为0ms）
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageExecutionTime).toBeLessThan(1000);
    });
  });

  describe('Hook事件监听', () => {
    it('应该支持事件监听器', async () => {
      let listenerCalled = false;
      let lastResult: any = null;

      const listener = (result: any) => {
        listenerCalled = true;
        lastResult = result;
      };

      hookManager.on('hook:executed', listener);

      await hookManager.executeSessionStart({
        sessionId: 'session-listener-1',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      });

      expect(listenerCalled).toBe(true);
      expect(lastResult).toBeDefined();
      expect(lastResult.hookType).toBe(HookType.SESSION_START);

      // 清理
      hookManager.off('hook:executed', listener);
    });

    it('应该支持移除事件监听器', async () => {
      let callCount = 0;

      const listener = () => {
        callCount++;
      };

      hookManager.on('hook:executed', listener);
      hookManager.off('hook:executed', listener);

      await hookManager.executeSessionStart({
        sessionId: 'session-listener-2',
        projectId: 'test-project',
        startTime: new Date().toISOString()
      });

      expect(callCount).toBe(0);
    });
  });

  describe('配置管理', () => {
    it('应该能够更新配置', () => {
      const newConfig: Partial<HookConfig> = {
        hooks: {
          session_start: {
            enabled: false,
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

      hookManager.updateConfig(newConfig);
      const config = hookManager.getConfig();

      expect(config.hooks.session_start.enabled).toBe(false);
    });

    it('应该能够启用/禁用单个Hook', () => {
      hookManager.setHookEnabled(HookType.FORMAT_REMINDER, false);
      expect(hookManager.isHookEnabled(HookType.FORMAT_REMINDER)).toBe(false);

      hookManager.setHookEnabled(HookType.FORMAT_REMINDER, true);
      expect(hookManager.isHookEnabled(HookType.FORMAT_REMINDER)).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理无效上下文', async () => {
      const result = await hookManager.executeSessionStart({
        sessionId: '',
        projectId: '',
        startTime: ''
      });

      expect(result.status).toBe(HookStatus.ERROR);
      expect(result.error).toBeDefined();
    });

    it('应该记录失败的执行', async () => {
      // 使用无效上下文触发错误
      await hookManager.executeSessionStart({
        sessionId: '',
        projectId: '',
        startTime: ''
      });

      const stats = hookManager.getStats();
      expect(stats.failedExecutions).toBeGreaterThan(0);
    });
  });

  describe('性能要求', () => {
    it('所有Hook执行时间应该小于1秒', async () => {
      const start = Date.now();

      await Promise.all([
        hookManager.executeSessionStart({
          sessionId: 'perf-1',
          projectId: 'test',
          startTime: new Date().toISOString()
        }),
        hookManager.executeFormatReminder({
          sessionId: 'perf-1',
          responseContent: '测试',
          taskIntent: '测试任务'
        })
      ]);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('应该支持并发Hook执行', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          hookManager.executeFormatReminder({
            sessionId: `concurrent-${i}`,
            responseContent: '测试',
            taskIntent: '测试任务'
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(r => expect(r.executed).toBe(true));
    });
  });

  describe('集成测试 - 完整流程', () => {
    it('应该支持完整的会话生命周期', async () => {
      const sessionId = 'full-lifecycle-1';
      const projectId = 'test-project';

      // 1. SessionStart
      const startResult = await hookManager.executeSessionStart({
        sessionId,
        projectId,
        startTime: new Date().toISOString()
      });
      expect(startResult.executed).toBe(true);

      // 2. FormatReminder (模拟多次)
      for (let i = 0; i < 3; i++) {
        const formatResult = await hookManager.executeFormatReminder({
          sessionId,
          responseContent: `响应 ${i + 1}`,
          taskIntent: `任务 ${i + 1}`
        });
        expect(formatResult.executed).toBe(true);
      }

      // 3. Stop
      const stopResult = await hookManager.executeStop({
        sessionId,
        projectId,
        endTime: new Date().toISOString(),
        duration: 120000
      });
      expect(stopResult.executed).toBe(true);

      // 验证统计
      const stats = hookManager.getStats();
      expect(stats.successfulExecutions).toBeGreaterThanOrEqual(5);
    });
  });
});
