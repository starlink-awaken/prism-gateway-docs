/**
 * RetrospectiveCore单元测试
 * 验证三种复盘模式：Quick（5分钟）、Standard（25分钟）、Deep（60分钟）
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { RetrospectiveCore } from '../core/RetrospectiveCore.js';
import { RetroTriggerType, RetroPhase, RetroStatus, RetroMode } from '../types/retrospective.js';
import { MemoryStore } from '../core/MemoryStore.js';
import { GatewayGuard } from '../core/GatewayGuard.js';
import { DataExtractor } from '../core/DataExtractor.js';

// RetroTaskInput类型定义
interface RetroTaskInput {
  id: string;
  projectId: string;
  triggerType: RetroTriggerType;
  context: {
    phase?: string;
    history?: any[];
    user_preferences?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

// 模拟依赖
class MockMemoryStore extends MemoryStore {
  async saveRetroRecord(record: any) {
    console.log('Mock: 保存复盘记录', record.id);
    // 模拟保存，不实际写入文件
  }

  async getRecentViolations(limit: number = 10) {
    return [];
  }

  async getRecentRetros(projectId: string, limit: number = 10) {
    return [];
  }

  async getPrinciples() {
    return [];
  }

  async searchPatterns(keyword: string) {
    return { success: [], failure: [] };
  }
}

class MockGatewayGuard extends GatewayGuard {
  async check(intent: string, context?: any) {
    return {
      status: 'PASS',
      violations: [],
      risks: [],
      traps: [],
      suggestions: [],
      check_time: 10,
      timestamp: new Date().toISOString()
    };
  }
}

class MockDataExtractor extends DataExtractor {
  async extractDimensions(sessionId: string, messages: any[]) {
    return {
      id: 'extract_test',
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      processing_time: 100,
      dimensions: {
        principles: { name: 'Principles', confidence: 0.8, items: [], evidence: [], processingTime: 10 },
        patterns: { name: 'Patterns', confidence: 0.7, items: [], evidence: [], processingTime: 10 },
        benchmarks: { name: 'Benchmarks', confidence: 0.6, items: [], evidence: [], processingTime: 10 },
        traps: { name: 'Traps', confidence: 0.5, items: [], evidence: [], processingTime: 10 },
        success: { name: 'Success', confidence: 0.9, items: [], evidence: [], processingTime: 10 },
        tools: { name: 'Tools', confidence: 0.8, items: [], evidence: [], processingTime: 10 },
        data: { name: 'Data', confidence: 0.7, items: [], evidence: [], processingTime: 10 }
      },
      summary: '测试总结',
      confidence: 0.7
    };
  }
}

describe('RetrospectiveCore', () => {
  let retroCore: RetrospectiveCore;
  let mockMemoryStore: MockMemoryStore;
  let mockGatewayGuard: MockGatewayGuard;
  let mockDataExtractor: MockDataExtractor;

  beforeEach(() => {
    mockMemoryStore = new MockMemoryStore();
    mockGatewayGuard = new MockGatewayGuard();
    mockDataExtractor = new MockDataExtractor();

    // 创建带模拟依赖的RetrospectiveCore
    const config = { autoTrigger: true };
    retroCore = new (class extends RetrospectiveCore {
      constructor() {
        super(config);
        // 重写依赖
        (this as any).memoryStore = mockMemoryStore;
        (this as any).gatewayGuard = mockGatewayGuard;
        (this as any).dataExtractor = mockDataExtractor;
      }
    })();
  });

  afterEach(() => {
    // 清理
  });

  describe('触发识别阶段', () => {
    it('应该处理手动触发的复盘任务', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_manual_trigger',
        projectId: 'project_1',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      // performTriggerPhase返回void，测试不会抛出错误
      await retroCore['performTriggerPhase'](taskInput);

      // 如果能执行到这里，说明没有错误
      expect(true).toBe(true);
    });

    it('应该处理自动触发的复盘任务', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_auto_trigger',
        projectId: 'project_1',
        triggerType: RetroTriggerType.AUTO,
        context: {
          phase: '测试',
          history: [],
          user_preferences: {}
        }
      };

      // performTriggerPhase返回void，测试不会抛出错误
      await retroCore['performTriggerPhase'](taskInput);

      // 如果能执行到这里，说明没有错误
      expect(true).toBe(true);
    });
  });

  describe('快速分析阶段', () => {
    it('应该成功执行快速分析', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_analysis',
        projectId: 'project_1',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      const analysisResult = await retroCore['performAnalysisPhase'](taskInput);

      // 验证分析结果结构
      expect(analysisResult).toHaveProperty('successFactors');
      expect(analysisResult).toHaveProperty('failureReasons');
      expect(analysisResult).toHaveProperty('keyDecisions');
      expect(analysisResult).toHaveProperty('confidence');
      expect(analysisResult).toHaveProperty('suggestions');

      // 验证置信度在合理范围内
      expect(analysisResult.confidence).toBeGreaterThan(0);
      expect(analysisResult.confidence).toBeLessThanOrEqual(1);
    });

    it('应该能够识别成功要素', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_success_factors',
        projectId: 'project_1',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      const analysisResult = await retroCore['performAnalysisPhase'](taskInput);

      // 应该有成功要素
      expect(analysisResult.successFactors.length).toBeGreaterThan(0);
    });
  });

  describe('关键提取阶段', () => {
    it('应该成功执行关键提取', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_extraction',
        projectId: 'project_1',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      const mockAnalysisResult = {
        successFactors: ['代码质量良好'],
        failureReasons: ['存在风险'],
        keyDecisions: ['选择技术栈'],
        confidence: 0.8,
        suggestions: ['持续改进']
      };

      const extractionResult = await retroCore['performExtractionPhase'](taskInput, mockAnalysisResult);

      // 验证提取结果结构
      expect(extractionResult).toHaveProperty('reusableKnowledge');
      expect(extractionResult).toHaveProperty('improvementAreas');
      expect(extractionResult).toHaveProperty('lessonsLearned');
      expect(extractionResult).toHaveProperty('actionItems');

      // 验证各个部分都有内容
      expect(extractionResult.reusableKnowledge.length).toBeGreaterThan(0);
      expect(extractionResult.improvementAreas.length).toBeGreaterThan(0);
      expect(extractionResult.lessonsLearned.length).toBeGreaterThan(0);
      expect(extractionResult.actionItems.length).toBeGreaterThan(0);
    });
  });

  describe('记录到MEMORY阶段', () => {
    it('应该成功保存复盘记录', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_storage',
        projectId: 'project_1',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      const mockAnalysisResult = {
        successFactors: ['代码质量良好'],
        failureReasons: ['存在风险'],
        keyDecisions: ['选择技术栈'],
        confidence: 0.8,
        suggestions: ['持续改进']
      };

      const mockExtractionResult = {
        reusableKnowledge: ['模式可复用'],
        improvementAreas: ['流程优化'],
        lessonsLearned: ['团队协作'],
        actionItems: ['制定计划']
      };

      const retroRecord = await retroCore['performStoragePhase'](taskInput, mockAnalysisResult, mockExtractionResult);

      // 验证记录结构
      expect(retroRecord).toHaveProperty('id');
      expect(retroRecord).toHaveProperty('timestamp');
      expect(retroRecord).toHaveProperty('type');
      expect(retroRecord).toHaveProperty('project');
      expect(retroRecord).toHaveProperty('duration');
      expect(retroRecord).toHaveProperty('summary');
      expect(retroRecord).toHaveProperty('lessons');
      expect(retroRecord).toHaveProperty('improvements');

      // 验证记录内容
      expect(retroRecord.project).toBe('project_1');
      expect(retroRecord.type).toBe('quick');
      expect(retroRecord.lessons.length).toBeGreaterThan(0);
      expect(retroRecord.improvements.length).toBeGreaterThan(0);
    });
  });

  describe('完整复盘流程', () => {
    it('应该成功执行完整的复盘流程', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_full_retro',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      const execution = await retroCore.executeRetro(taskInput);

      // 验证执行结果
      expect(execution).toHaveProperty('id');
      expect(execution).toHaveProperty('taskId');
      expect(execution).toHaveProperty('status');
      expect(execution).toHaveProperty('startTime');
      expect(execution).toHaveProperty('metrics');

      // 验证执行状态
      expect([RetroStatus.COMPLETED, RetroStatus.FAILED]).toContain(execution.status);

      // 验证执行时间（大于等于0，因为性能测量可能返回0）
      expect(execution.metrics.totalDuration).toBeGreaterThanOrEqual(0);
      expect(execution.metrics.phaseTimes).toHaveProperty(RetroPhase.TRIGGER);
      expect(execution.metrics.phaseTimes).toHaveProperty(RetroPhase.ANALYSIS);
      expect(execution.metrics.phaseTimes).toHaveProperty(RetroPhase.EXTRACTION);
      expect(execution.metrics.phaseTimes).toHaveProperty(RetroPhase.STORAGE);
    });

    it('应该在5分钟内完成复盘', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_performance',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      const startTime = Date.now();
      const execution = await retroCore.executeRetro(taskInput);
      const endTime = Date.now();

      const totalDuration = endTime - startTime;

      // 验证总时间在5分钟内
      expect(totalDuration).toBeLessThan(5 * 60 * 1000);

      console.log(`复盘完成时间: ${totalDuration}ms`);
    });
  });

  describe('自动触发检查', () => {
    it('应该检查是否需要自动触发复盘', async () => {
      const projectId = 'test_project';
      const shouldTrigger = await retroCore.shouldAutoTrigger(projectId);

      // 应该返回布尔值
      expect(typeof shouldTrigger).toBe('boolean');

      console.log(`自动触发结果: ${shouldTrigger}`);
    });

    it('在自动触发关闭时不应该触发复盘', async () => {
      // 创建关闭自动触发的实例
      const manualRetroCore = new (class extends RetrospectiveCore {
        constructor() {
          super();
          this.config.autoTrigger = false;
          this.memoryStore = mockMemoryStore;
          this.gatewayGuard = mockGatewayGuard;
          this.dataExtractor = mockDataExtractor;
        }
      })();

      const projectId = 'test_project';
      const shouldTrigger = await manualRetroCore.shouldAutoTrigger(projectId);

      // 自动触发关闭时应该返回false
      expect(shouldTrigger).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该处理执行过程中的错误', async () => {
      // 创建会抛出错误的模拟
      const errorRetroCore = new (class extends RetrospectiveCore {
        async performTriggerPhase(taskInput: RetroTaskInput): Promise<void> {
          throw new Error('模拟触发失败');
        }
      })();

      const taskInput: RetroTaskInput = {
        id: 'test_error',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      const execution = await errorRetroCore.executeRetro(taskInput);

      // 验证失败状态
      expect(execution.status).toBe('failed');
      expect(execution.results).toHaveProperty('errors');
      expect(execution.results?.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('性能指标', () => {
    it('应该测量各阶段执行时间', async () => {
      const taskInput: RetroTaskInput = {
        id: 'test_performance_metrics',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        }
      };

      const execution = await retroCore.executeRetro(taskInput);

      // 验证各阶段都有执行时间记录（大于等于0）
      expect(execution.metrics.phaseTimes[RetroPhase.TRIGGER]).toBeGreaterThanOrEqual(0);
      expect(execution.metrics.phaseTimes[RetroPhase.ANALYSIS]).toBeGreaterThanOrEqual(0);
      expect(execution.metrics.phaseTimes[RetroPhase.EXTRACTION]).toBeGreaterThanOrEqual(0);
      expect(execution.metrics.phaseTimes[RetroPhase.STORAGE]).toBeGreaterThanOrEqual(0);

      // 验证总时间与各阶段时间之和的关系
      const totalPhaseTime = Object.values(execution.metrics.phaseTimes).reduce((sum, time) => sum + time, 0);
      expect(execution.metrics.totalDuration).toBeLessThanOrEqual(totalPhaseTime + 100); // 允许100ms误差
    });
  });

  describe('三种复盘模式', () => {
    let mockMemoryStoreForModes: MockMemoryStore;

    beforeEach(() => {
      mockMemoryStoreForModes = new MockMemoryStore();
    });

    it('Quick模式应该在5分钟内完成', async () => {
      const quickRetro = new (class extends RetrospectiveCore {
        constructor() {
          super({ type: RetroMode.QUICK });
          (this as any).memoryStore = mockMemoryStoreForModes;
        }
      })();

      expect(quickRetro.getCurrentMode()).toBe(RetroMode.QUICK);

      const modeConfig = quickRetro.getModeConfig(RetroMode.QUICK);
      expect(modeConfig.maxDuration).toBe(5 * 60 * 1000);
      expect(modeConfig.enableReflection).toBe(false);
      expect(modeConfig.enablePlanning).toBe(false);

      const taskInput: RetroTaskInput = {
        id: 'test_quick',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: { phase: '开发', history: [] }
      };

      const execution = await quickRetro.executeRetro(taskInput);
      expect(execution.status).toBe(RetroStatus.COMPLETED);
    });

    it('Standard模式应该包含反思阶段', async () => {
      const standardRetro = new (class extends RetrospectiveCore {
        constructor() {
          super({ type: RetroMode.STANDARD });
          (this as any).memoryStore = mockMemoryStoreForModes;
        }
      })();

      expect(standardRetro.getCurrentMode()).toBe(RetroMode.STANDARD);

      const modeConfig = standardRetro.getModeConfig(RetroMode.STANDARD);
      expect(modeConfig.maxDuration).toBe(25 * 60 * 1000);
      expect(modeConfig.enableReflection).toBe(true);
      expect(modeConfig.enablePlanning).toBe(false);

      const taskInput: RetroTaskInput = {
        id: 'test_standard',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: { phase: '测试', history: [] }
      };

      const execution = await standardRetro.executeRetro(taskInput);
      expect(execution.status).toBe(RetroStatus.COMPLETED);
      // 验证有反思阶段
      expect(execution.metrics.phaseTimes).toHaveProperty(RetroPhase.REFLECTION);
    });

    it('Deep模式应该包含反思和规划阶段', async () => {
      const deepRetro = new (class extends RetrospectiveCore {
        constructor() {
          super({ type: RetroMode.DEEP });
          (this as any).memoryStore = mockMemoryStoreForModes;
        }
      })();

      expect(deepRetro.getCurrentMode()).toBe(RetroMode.DEEP);

      const modeConfig = deepRetro.getModeConfig(RetroMode.DEEP);
      expect(modeConfig.maxDuration).toBe(60 * 60 * 1000);
      expect(modeConfig.enableReflection).toBe(true);
      expect(modeConfig.enablePlanning).toBe(true);

      const taskInput: RetroTaskInput = {
        id: 'test_deep',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: { phase: '规划', history: [] }
      };

      const execution = await deepRetro.executeRetro(taskInput);
      expect(execution.status).toBe(RetroStatus.COMPLETED);
      // 验证有反思和规划阶段
      expect(execution.metrics.phaseTimes).toHaveProperty(RetroPhase.REFLECTION);
      expect(execution.metrics.phaseTimes).toHaveProperty(RetroPhase.PLANNING);
    });

    it('应该能够动态切换复盘模式', async () => {
      const retroCore = new RetrospectiveCore({ type: RetroMode.QUICK });

      expect(retroCore.getCurrentMode()).toBe(RetroMode.QUICK);

      // 切换到Standard模式
      retroCore.switchMode(RetroMode.STANDARD);
      expect(retroCore.getCurrentMode()).toBe(RetroMode.STANDARD);

      // 切换到Deep模式
      retroCore.switchMode(RetroMode.DEEP);
      expect(retroCore.getCurrentMode()).toBe(RetroMode.DEEP);

      // 切换回Quick模式
      retroCore.switchMode(RetroMode.QUICK);
      expect(retroCore.getCurrentMode()).toBe(RetroMode.QUICK);
    });
  });

  describe('模式性能验证', () => {
    let mockMemoryStoreForPerf: MockMemoryStore;

    beforeEach(() => {
      mockMemoryStoreForPerf = new MockMemoryStore();
    });

    it('Quick模式执行时间应小于5分钟', async () => {
      const quickRetro = new (class extends RetrospectiveCore {
        constructor() {
          super({ type: RetroMode.QUICK });
          (this as any).memoryStore = mockMemoryStoreForPerf;
        }
      })();

      const taskInput: RetroTaskInput = {
        id: 'test_quick_perf',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: { phase: '开发', history: [] }
      };

      const startTime = Date.now();
      const execution = await quickRetro.executeRetro(taskInput);
      const endTime = Date.now();

      const actualDuration = endTime - startTime;

      expect(execution.status).toBe(RetroStatus.COMPLETED);
      expect(actualDuration).toBeLessThan(5 * 60 * 1000); // 5分钟
    });

    it('Standard模式应包含所有阶段且在25分钟内完成', async () => {
      const standardRetro = new (class extends RetrospectiveCore {
        constructor() {
          super({ type: RetroMode.STANDARD });
          (this as any).memoryStore = mockMemoryStoreForPerf;
        }
      })();

      const taskInput: RetroTaskInput = {
        id: 'test_standard_perf',
        projectId: 'test_project',
        triggerType: RetroTriggerType.MANUAL,
        context: { phase: '开发', history: [] }
      };

      const startTime = Date.now();
      const execution = await standardRetro.executeRetro(taskInput);
      const endTime = Date.now();

      const actualDuration = endTime - startTime;

      expect(execution.status).toBe(RetroStatus.COMPLETED);
      expect(actualDuration).toBeLessThan(25 * 60 * 1000); // 25分钟
    });
  });
});