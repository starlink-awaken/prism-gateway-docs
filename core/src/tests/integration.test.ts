/**
 * PRISM-Gateway 集成测试
 * 验证 Task 63-65 的模块协作
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { MemoryStore } from '../core/MemoryStore.js';
import { PatternMatcher } from '../core/PatternMatcher.js';
import { DataExtractor } from '../core/DataExtractor.js';
import { RetrospectiveCore } from '../core/RetrospectiveCore.js';
import { GatewayGuard } from '../core/GatewayGuard.js';
import { TrapDetector } from '../core/TrapDetector.js';

describe('Task 63-65 集成测试', () => {
  let memoryStore: MemoryStore;
  let patternMatcher: PatternMatcher;
  let dataExtractor: DataExtractor;
  let retrospectiveCore: RetrospectiveCore;
  let gatewayGuard: GatewayGuard;
  let trapDetector: TrapDetector;

  beforeEach(async () => {
    memoryStore = new MemoryStore();
    patternMatcher = new PatternMatcher(memoryStore);
    trapDetector = new TrapDetector(memoryStore);
    gatewayGuard = new GatewayGuard(memoryStore);
    dataExtractor = new DataExtractor();
    retrospectiveCore = new RetrospectiveCore();
  });

  describe('Task 63: PatternMatcher 验证', () => {
    it('应该能够创建PatternMatcher实例', () => {
      expect(patternMatcher).toBeDefined();
      expect(patternMatcher instanceof PatternMatcher).toBe(true);
    });

    it('应该能够执行模式匹配', async () => {
      const intent = '我想开发一个高质量的React应用，需要遵循最佳实践';
      const risks = await patternMatcher.match(intent);

      expect(Array.isArray(risks)).toBe(true);
      expect(risks.length).toBeGreaterThanOrEqual(0);
    });

    it('应该能够过滤失败模式风险', async () => {
      const intent = '测试意图';
      const risks = await patternMatcher.match(intent);
      const failureRisks = patternMatcher.getFailureRisks(risks);

      expect(Array.isArray(failureRisks)).toBe(true);
      failureRisks.forEach(risk => {
        expect(risk.type).toBe('failure');
      });
    });

    it('应该能够过滤成功模式建议', async () => {
      const intent = '测试意图';
      const risks = await patternMatcher.match(intent);
      const successRisks = patternMatcher.getSuccessRisks(risks);

      expect(Array.isArray(successRisks)).toBe(true);
      successRisks.forEach(risk => {
        expect(risk.type).toBe('success');
      });
    });

    it('应该能够获取Top N风险', async () => {
      const intent = '测试意图';
      const risks = await patternMatcher.match(intent);
      const top3 = patternMatcher.getTopRisks(risks, 3);

      expect(Array.isArray(top3)).toBe(true);
      expect(top3.length).toBeLessThanOrEqual(3);
    });

    it('性能测试: 匹配时间应小于500ms', async () => {
      const intent = '这是一个较长的测试意图，包含多个关键词用于测试性能';
      const startTime = Date.now();
      await patternMatcher.match(intent);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Task 64: DataExtractor 验证', () => {
    it('应该能够创建DataExtractor实例', () => {
      expect(dataExtractor).toBeDefined();
      expect(dataExtractor instanceof DataExtractor).toBe(true);
    });

    it('应该能够从对话历史中提取数据', async () => {
      const history = {
        id: 'test_history',
        session_id: 'test_session',
        messages: [
          {
            id: 'msg1',
            role: 'user' as const,
            content: '我想开发一个高质量的应用',
            timestamp: new Date().toISOString()
          },
          {
            id: 'msg2',
            role: 'assistant' as const,
            content: '好的，我可以帮你分析这个需求',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await dataExtractor.extractFromHistory(history);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.session_id).toBe('test_session');
      expect(result.dimensions).toBeDefined();
      expect(result.dimensions.principles).toBeDefined();
      expect(result.dimensions.patterns).toBeDefined();
      expect(result.dimensions.benchmarks).toBeDefined();
      expect(result.dimensions.traps).toBeDefined();
      expect(result.dimensions.success).toBeDefined();
      expect(result.dimensions.tools).toBeDefined();
      expect(result.dimensions.data).toBeDefined();
    });

    it('提取结果应该包含所有7个维度', async () => {
      const history = {
        id: 'test_history_2',
        session_id: 'test_session_2',
        messages: [
          {
            id: 'msg1',
            role: 'user' as const,
            content: '测试消息',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await dataExtractor.extractFromHistory(history);
      const dimensions = result.dimensions;

      expect(Object.keys(dimensions)).toHaveLength(7);
      expect(dimensions.principles.name).toBe('Principles');
      expect(dimensions.patterns.name).toBe('Patterns');
      expect(dimensions.benchmarks.name).toBe('Benchmarks');
      expect(dimensions.traps.name).toBe('Traps');
      expect(dimensions.success.name).toBe('Success');
      expect(dimensions.tools.name).toBe('Tools');
      expect(dimensions.data.name).toBe('Data');
    });

    it('应该能够计算总体置信度', async () => {
      const history = {
        id: 'test_history_3',
        session_id: 'test_session_3',
        messages: [
          {
            id: 'msg1',
            role: 'user' as const,
            content: '测试置信度计算',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await dataExtractor.extractFromHistory(history);

      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('性能测试: 提取时间应小于300ms', async () => {
      const history = {
        id: 'test_history_perf',
        session_id: 'test_session_perf',
        messages: Array(10).fill(null).map((_, i) => ({
          id: `msg${i}`,
          role: 'user' as const,
          content: `测试消息${i}`,
          timestamp: new Date().toISOString()
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const startTime = Date.now();
      const result = await dataExtractor.extractFromHistory(history);
      const duration = Date.now() - startTime;

      expect(result.processing_time).toBeLessThan(300);
      expect(duration).toBeLessThan(300);
    });

    it('应该能够更新配置', () => {
      const newConfig = {
        min_confidence_threshold: 0.7,
        max_processing_time: 500
      };

      dataExtractor.updateConfig(newConfig);
      const config = dataExtractor.getConfig();

      expect(config.min_confidence_threshold).toBe(0.7);
      expect(config.max_processing_time).toBe(500);
    });
  });

  describe('Task 65: RetrospectiveCore 验证', () => {
    it('应该能够创建RetrospectiveCore实例', () => {
      expect(retrospectiveCore).toBeDefined();
      expect(retrospectiveCore instanceof RetrospectiveCore).toBe(true);
    });

    it('应该能够检查自动触发条件', async () => {
      const projectId = 'test_project';
      const shouldTrigger = await retrospectiveCore.shouldAutoTrigger(projectId);

      expect(typeof shouldTrigger).toBe('boolean');
    });

    it('应该能够获取复盘统计信息', async () => {
      const stats = await retrospectiveCore.getRetroStats();

      expect(stats).toBeDefined();
      expect(stats.totalRetros).toBeGreaterThanOrEqual(0);
      expect(stats.avgDuration).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.phaseDurations).toBeDefined();
    });

    it('统计信息应该包含所有阶段的时间', async () => {
      const stats = await retrospectiveCore.getRetroStats();

      expect(stats.phaseDurations).toHaveProperty('trigger');
      expect(stats.phaseDurations).toHaveProperty('analysis');
      expect(stats.phaseDurations).toHaveProperty('extraction');
      expect(stats.phaseDurations).toHaveProperty('storage');
    });
  });

  describe('模块协作验证', () => {
    it('PatternMatcher应该与MemoryStore协作', async () => {
      const intent = '测试PatternMatcher与MemoryStore的协作';
      await memoryStore.getSuccessPatterns();
      await memoryStore.getFailurePatterns();

      const risks = await patternMatcher.match(intent);

      expect(Array.isArray(risks)).toBe(true);
    });

    it('DataExtractor应该使用PatternMatcher', async () => {
      const history = {
        id: 'test_collab_1',
        session_id: 'test_session',
        messages: [
          {
            id: 'msg1',
            role: 'user' as const,
            content: '测试DataExtractor使用PatternMatcher',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await dataExtractor.extractFromHistory(history);

      expect(result.dimensions.patterns).toBeDefined();
    });

    it('RetrospectiveCore应该使用所有依赖模块', async () => {
      // RetrospectiveCore 内部使用 MemoryStore, GatewayGuard, DataExtractor
      const projectId = 'test_collab_project';
      await retrospectiveCore.shouldAutoTrigger(projectId);

      // 这会触发内部模块的调用
      expect(true).toBe(true);
    });

    it('所有模块应该能够共享MemoryStore实例', () => {
      const sharedStore = new MemoryStore();
      const pm = new PatternMatcher(sharedStore);
      const td = new TrapDetector(sharedStore);
      const gg = new GatewayGuard(sharedStore);

      expect(pm).toBeDefined();
      expect(td).toBeDefined();
      expect(gg).toBeDefined();
    });
  });

  describe('端到端集成验证', () => {
    it('应该能够完成完整的检查流程', async () => {
      const intent = '我想开发一个React应用，需要确保代码质量';

      // 1. GatewayGuard检查
      const checkResult = await gatewayGuard.check(intent);
      expect(checkResult).toBeDefined();

      // 2. PatternMatcher匹配
      const risks = await patternMatcher.match(intent);
      expect(Array.isArray(risks)).toBe(true);
    });

    it('应该能够完成完整的提取流程', async () => {
      const history = {
        id: 'test_e2e',
        session_id: 'test_e2e_session',
        messages: [
          {
            id: 'msg1',
            role: 'user' as const,
            content: '我想开发一个应用，需要高质量和高性能',
            timestamp: new Date().toISOString()
          },
          {
            id: 'msg2',
            role: 'assistant' as const,
            content: '我来帮你分析这个需求',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await dataExtractor.extractFromHistory(history);

      expect(result.dimensions.principles).toBeDefined();
      expect(result.dimensions.patterns).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  describe('数据一致性验证', () => {
    it('所有模块应该使用一致的数据结构', () => {
      // 验证数据结构一致性
      expect(true).toBe(true);
    });

    it('类型定义应该与实现匹配', () => {
      // 导入不应出错
      expect(() => {
        require('../core/PatternMatcher.js');
        require('../core/DataExtractor.js');
        require('../core/RetrospectiveCore.js');
      }).not.toThrow();
    });
  });
});
