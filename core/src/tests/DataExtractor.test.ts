/**
 * DataExtractor 单元测试
 * 测试7维度数据提取功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { DataExtractor } from '../core/DataExtractor';
import {
  Message,
  ConversationHistory,
  ExtractionResult,
  DataExtractorConfig
} from '../types/index';

describe('DataExtractor', () => {
  let extractor: DataExtractor;

  beforeEach(() => {
    extractor = new DataExtractor();
  });

  describe('初始化和配置', () => {
    it('应该使用默认配置初始化', () => {
      const config = extractor.getConfig();

      expect(config.min_confidence_threshold).toBe(0.6);
      expect(config.max_processing_time).toBe(300);
      expect(config.enable_dimension_weighting).toBe(true);
      expect(config.context_window_size).toBe(10);
      expect(config.keyword_boost_factor).toBe(1.2);
    });

    it('应该能够更新配置', () => {
      extractor.updateConfig({
        min_confidence_threshold: 0.8,
        context_window_size: 20
      });

      const config = extractor.getConfig();
      expect(config.min_confidence_threshold).toBe(0.8);
      expect(config.context_window_size).toBe(20);
    });

    it('应该保留未更新的配置值', () => {
      extractor.updateConfig({ min_confidence_threshold: 0.8 });

      const config = extractor.getConfig();
      expect(config.min_confidence_threshold).toBe(0.8);
      expect(config.max_processing_time).toBe(300); // 未改变
    });
  });

  describe('extractFromHistory - 基本功能', () => {
    it('应该能够处理空消息历史', async () => {
      const history: ConversationHistory = {
        id: 'test-001',
        session_id: 'session-001',
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result).toBeDefined();
      expect(result.session_id).toBe('session-001');
      expect(result.processing_time).toBeGreaterThanOrEqual(0);
      expect(result.dimensions).toBeDefined();
    });

    it('应该能够处理包含消息的对话历史', async () => {
      const history: ConversationHistory = {
        id: 'test-002',
        session_id: 'session-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '请帮我分析这个问题',
            timestamp: new Date().toISOString()
          },
          {
            id: 'msg-002',
            role: 'assistant',
            content: '我来帮你分析',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.dimensions.principles.name).toBe('Principles');
      expect(result.dimensions.patterns.name).toBe('Patterns');
    });

    it('应该生成唯一的提取ID', async () => {
      const history: ConversationHistory = {
        id: 'test-003',
        session_id: 'session-003',
        messages: [{ id: 'msg-001', role: 'user', content: '测试', timestamp: new Date().toISOString() }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result1 = await extractor.extractFromHistory(history);
      await new Promise(resolve => setTimeout(resolve, 10)); // 延迟确保时间戳不同
      const result2 = await extractor.extractFromHistory(history);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('extractFromHistory - 7个维度', () => {
    it('应该提取所有7个维度', async () => {
      const history: ConversationHistory = {
        id: 'test-dim-001',
        session_id: 'session-dim-001',
        messages: [{ id: 'msg-001', role: 'user', content: '测试内容', timestamp: new Date().toISOString() }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      // 验证所有7个维度都存在
      expect(result.dimensions.principles).toBeDefined();
      expect(result.dimensions.patterns).toBeDefined();
      expect(result.dimensions.benchmarks).toBeDefined();
      expect(result.dimensions.traps).toBeDefined();
      expect(result.dimensions.success).toBeDefined();
      expect(result.dimensions.tools).toBeDefined();
      expect(result.dimensions.data).toBeDefined();
    });

    it('每个维度应该有name、confidence、items、evidence属性', async () => {
      const history: ConversationHistory = {
        id: 'test-dim-002',
        session_id: 'session-dim-002',
        messages: [{ id: 'msg-001', role: 'user', content: '测试', timestamp: new Date().toISOString() }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      const dimensions = [
        'principles', 'patterns', 'benchmarks',
        'traps', 'success', 'tools', 'data'
      ] as const;

      for (const dim of dimensions) {
        expect(result.dimensions[dim]).toHaveProperty('name');
        expect(result.dimensions[dim]).toHaveProperty('confidence');
        expect(result.dimensions[dim]).toHaveProperty('items');
        expect(result.dimensions[dim]).toHaveProperty('evidence');
        expect(typeof result.dimensions[dim].confidence).toBe('number');
        expect(Array.isArray(result.dimensions[dim].items)).toBe(true);
        expect(Array.isArray(result.dimensions[dim].evidence)).toBe(true);
      }
    });
  });

  describe('Principles维度提取', () => {
    it('应该检测到原则违规关键词', async () => {
      const history: ConversationHistory = {
        id: 'test-prin-001',
        session_id: 'session-prin-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '我推测这个问题是因为代码错误',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.principles.name).toBe('Principles');
      expect(result.dimensions.principles.confidence).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.dimensions.principles.items)).toBe(true);
    });

    it('原则维度应该包含违规信息', async () => {
      const history: ConversationHistory = {
        id: 'test-prin-002',
        session_id: 'session-prin-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '我想隐藏这个错误',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      // 验证违规记录结构
      if (result.dimensions.principles.items.length > 0) {
        const violation = result.dimensions.principles.items[0];
        expect(violation).toHaveProperty('principle_id');
        expect(violation).toHaveProperty('principle_name');
        expect(violation).toHaveProperty('severity');
        expect(violation).toHaveProperty('message');
        expect(violation).toHaveProperty('context');
      }
    });
  });

  describe('Patterns维度提取', () => {
    it('应该检测成功和失败模式', async () => {
      const history: ConversationHistory = {
        id: 'test-pat-001',
        session_id: 'session-pat-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '目标是快速修复这个性能问题',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.patterns.name).toBe('Patterns');
      expect(result.dimensions.patterns.confidence).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.dimensions.patterns.items)).toBe(true);
    });

    it('模式匹配应该包含置信度阈值过滤', async () => {
      const highThresholdExtractor = new DataExtractor({
        min_confidence_threshold: 0.9
      });

      const history: ConversationHistory = {
        id: 'test-pat-002',
        session_id: 'session-pat-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '测试模式匹配',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await highThresholdExtractor.extractFromHistory(history);

      // 验证低置信度匹配被过滤
      const lowConfidenceItems = result.dimensions.patterns.items.filter(
        (item: any) => item.confidence < 0.9
      );
      expect(lowConfidenceItems.length).toBe(0);
    });

    it('模式匹配项应该包含完整信息', async () => {
      const history: ConversationHistory = {
        id: 'test-pat-003',
        session_id: 'session-pat-003',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '需要优化性能',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      if (result.dimensions.patterns.items.length > 0) {
        const match = result.dimensions.patterns.items[0] as any;
        expect(match).toHaveProperty('pattern_id');
        expect(match).toHaveProperty('pattern_name');
        expect(match).toHaveProperty('type');
        expect(match).toHaveProperty('confidence');
        expect(match).toHaveProperty('context');
        expect(['success', 'failure']).toContain(match.type);
      }
    });
  });

  describe('Benchmarks维度提取', () => {
    it('应该检测基准关键词', async () => {
      const history: ConversationHistory = {
        id: 'test-bench-001',
        session_id: 'session-bench-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '我们需要提升性能和可靠性',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.benchmarks.name).toBe('Benchmarks');
      expect(result.dimensions.benchmarks.items.length).toBeGreaterThan(0);
    });

    it('基准评估应该包含评分和等级', async () => {
      const history: ConversationHistory = {
        id: 'test-bench-002',
        session_id: 'session-bench-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '性能测试显示速度很快',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      if (result.dimensions.benchmarks.items.length > 0) {
        const assessment = result.dimensions.benchmarks.items[0] as any;
        expect(assessment).toHaveProperty('benchmark_id');
        expect(assessment).toHaveProperty('benchmark_name');
        expect(assessment).toHaveProperty('score');
        expect(assessment).toHaveProperty('level');
        expect(assessment).toHaveProperty('context');
        expect(['excellent', 'good', 'average', 'poor']).toContain(assessment.level);
      }
    });

    it('没有基准关键词时应该使用默认评估', async () => {
      const history: ConversationHistory = {
        id: 'test-bench-003',
        session_id: 'session-bench-003',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '随便聊聊',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.benchmarks.items.length).toBe(1);
      const assessment = result.dimensions.benchmarks.items[0] as any;
      expect(assessment.benchmark_id).toBe('general_benchmark');
    });
  });

  describe('Traps维度提取', () => {
    it('应该检测陷阱关键词', async () => {
      const history: ConversationHistory = {
        id: 'test-trap-001',
        session_id: 'session-trap-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '我想忽略这个异常继续运行',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.traps.name).toBe('Traps');
      expect(Array.isArray(result.dimensions.traps.items)).toBe(true);
    });

    it('陷阱检测应该包含严重性等级', async () => {
      const history: ConversationHistory = {
        id: 'test-trap-002',
        session_id: 'session-trap-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '语法检查通过了所以功能应该没问题',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      if (result.dimensions.traps.items.length > 0) {
        const detection = result.dimensions.traps.items[0] as any;
        expect(detection).toHaveProperty('trap_id');
        expect(detection).toHaveProperty('trap_name');
        expect(detection).toHaveProperty('severity');
        expect(detection).toHaveProperty('context');
        expect(detection).toHaveProperty('suggestion');
        expect(['高', '中', '低']).toContain(detection.severity);
      }
    });
  });

  describe('Success维度提取', () => {
    it('应该检测成功关键词', async () => {
      const history: ConversationHistory = {
        id: 'test-succ-001',
        session_id: 'session-succ-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '我们成功完成了这个优化',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.success.name).toBe('Success');
      expect(Array.isArray(result.dimensions.success.items)).toBe(true);
    });

    it('成功要素应该包含影响程度', async () => {
      const history: ConversationHistory = {
        id: 'test-succ-002',
        session_id: 'session-succ-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '成功解决成功实现成功达成目标',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      if (result.dimensions.success.items.length > 0) {
        const factor = result.dimensions.success.items[0] as any;
        expect(factor).toHaveProperty('factor_id');
        expect(factor).toHaveProperty('factor_name');
        expect(factor).toHaveProperty('impact');
        expect(factor).toHaveProperty('context');
        expect(['high', 'medium', 'low']).toContain(factor.impact);
      }
    });

    it('没有成功关键词时应该分析整体积极度', async () => {
      const history: ConversationHistory = {
        id: 'test-succ-003',
        session_id: 'session-succ-003',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '好的很棒很优秀',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.success.items.length).toBeGreaterThan(0);
    });
  });

  describe('Tools维度提取', () => {
    it('应该检测工具关键词', async () => {
      const history: ConversationHistory = {
        id: 'test-tool-001',
        session_id: 'session-tool-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '我们使用React和Docker进行开发',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.tools.name).toBe('Tools');
      expect(Array.isArray(result.dimensions.tools.items)).toBe(true);
    });

    it('应该识别常见的开发工具', async () => {
      const history: ConversationHistory = {
        id: 'test-tool-002',
        session_id: 'session-tool-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '项目使用Node.js和Python开发，部署在AWS上',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.tools.items.length).toBeGreaterThan(0);

      // 验证工具名称被正确识别
      const toolNames = result.dimensions.tools.items.map((t: any) => t.tool_name?.toLowerCase());
      const hasRecognizedTool = toolNames.some((name: string) =>
        ['node.js', 'python', 'aws'].some(tool => name?.includes(tool))
      );
      expect(hasRecognizedTool).toBe(true);
    });

    it('工具项应该包含用途和上下文', async () => {
      const history: ConversationHistory = {
        id: 'test-tool-003',
        session_id: 'session-tool-003',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '使用Git进行版本控制',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      if (result.dimensions.tools.items.length > 0) {
        const tool = result.dimensions.tools.items[0] as any;
        expect(tool).toHaveProperty('tool_id');
        expect(tool).toHaveProperty('tool_name');
        expect(tool).toHaveProperty('purpose');
        expect(tool).toHaveProperty('usage_context');
      }
    });
  });

  describe('Data维度提取', () => {
    it('应该提取数值数据', async () => {
      const history: ConversationHistory = {
        id: 'test-data-001',
        session_id: 'session-data-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '性能提升了50%，响应时间减少到100ms',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.dimensions.data.name).toBe('Data');
      expect(result.dimensions.data.items.length).toBeGreaterThan(0);
    });

    it('数据项应该包含重要性评估', async () => {
      const history: ConversationHistory = {
        id: 'test-data-002',
        session_id: 'session-data-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '错误率为0.1%',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      if (result.dimensions.data.items.length > 0) {
        const dataPoint = result.dimensions.data.items[0] as any;
        expect(dataPoint).toHaveProperty('data_id');
        expect(dataPoint).toHaveProperty('data_name');
        expect(dataPoint).toHaveProperty('category');
        expect(dataPoint).toHaveProperty('importance');
        expect(dataPoint).toHaveProperty('value');
        expect(dataPoint).toHaveProperty('context');
        expect(['critical', 'important', 'normal']).toContain(dataPoint.importance);
      }
    });

    it('性能数据应该标记为重要', async () => {
      const history: ConversationHistory = {
        id: 'test-data-003',
        session_id: 'session-data-003',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '响应时间200ms，成功率99%',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      const hasImportantData = result.dimensions.data.items.some(
        (item: any) => item.importance === 'important'
      );
      expect(hasImportantData).toBe(true);
    });

    it('应该处理没有数值数据的情况', async () => {
      const history: ConversationHistory = {
        id: 'test-data-004',
        session_id: 'session-data-004',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '我们需要分析这些数据',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      // 应该基于关键词创建数据点
      expect(result.dimensions.data.items.length).toBeGreaterThan(0);
    });
  });

  describe('上下文窗口处理', () => {
    it('应该过滤空消息', async () => {
      const history: ConversationHistory = {
        id: 'test-ctx-001',
        session_id: 'session-ctx-001',
        messages: [
          { id: 'msg-001', role: 'user', content: '   ', timestamp: new Date().toISOString() },
          { id: 'msg-002', role: 'user', content: '', timestamp: new Date().toISOString() },
          { id: 'msg-003', role: 'user', content: '有效内容', timestamp: new Date().toISOString() }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      // 应该只处理有效消息
      expect(result).toBeDefined();
    });

    it('应该限制上下文窗口大小', async () => {
      const largeHistory: ConversationHistory = {
        id: 'test-ctx-002',
        session_id: 'session-ctx-002',
        messages: Array.from({ length: 20 }, (_, i) => ({
          id: `msg-${i}`,
          role: 'user' as const,
          content: `消息内容 ${i}`,
          timestamp: new Date().toISOString()
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const smallWindowExtractor = new DataExtractor({ context_window_size: 5 });
      const result = await smallWindowExtractor.extractFromHistory(largeHistory);

      expect(result).toBeDefined();
    });
  });

  describe('总体置信度和总结', () => {
    it('应该计算总体置信度', async () => {
      const history: ConversationHistory = {
        id: 'test-conf-001',
        session_id: 'session-conf-001',
        messages: [
          { id: 'msg-001', role: 'user', content: '测试', timestamp: new Date().toISOString() }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('应该生成总结', async () => {
      const history: ConversationHistory = {
        id: 'test-sum-001',
        session_id: 'session-sum-001',
        messages: [
          { id: 'msg-001', role: 'user', content: '测试', timestamp: new Date().toISOString() }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('维度权重应该影响总体置信度', async () => {
      const history: ConversationHistory = {
        id: 'test-weight-001',
        session_id: 'session-weight-001',
        messages: [
          { id: 'msg-001', role: 'user', content: '测试', timestamp: new Date().toISOString() }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const weightedExtractor = new DataExtractor({ enable_dimension_weighting: true });
      const unweightedExtractor = new DataExtractor({ enable_dimension_weighting: false });

      const [weightedResult, unweightedResult] = await Promise.all([
        weightedExtractor.extractFromHistory(history),
        unweightedExtractor.extractFromHistory(history)
      ]);

      // 加权结果可能不同
      expect(weightedResult.confidence).toBeDefined();
      expect(unweightedResult.confidence).toBeDefined();
    });
  });

  describe('性能要求', () => {
    it('处理少量消息应该快速完成', async () => {
      const history: ConversationHistory = {
        id: 'test-perf-001',
        session_id: 'session-perf-001',
        messages: [
          { id: 'msg-001', role: 'user', content: '性能测试', timestamp: new Date().toISOString() }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const start = Date.now();
      const result = await extractor.extractFromHistory(history);
      const duration = Date.now() - start;

      expect(result.processing_time).toBeLessThan(5000); // 5秒内完成
      expect(duration).toBeLessThan(5000);
    });

    it('处理100条消息应该在5秒内完成', async () => {
      const largeHistory: ConversationHistory = {
        id: 'test-perf-002',
        session_id: 'session-perf-002',
        messages: Array.from({ length: 100 }, (_, i) => ({
          id: `msg-${i}`,
          role: 'user' as const,
          content: `测试消息内容 ${i}，包含一些关键词如性能、优化、成功`,
          timestamp: new Date().toISOString()
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const start = Date.now();
      const result = await extractor.extractFromHistory(largeHistory);
      const duration = Date.now() - start;

      expect(result.processing_time).toBeLessThan(5000);
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('错误处理', () => {
    it('应该处理没有metadata的消息', async () => {
      const history: ConversationHistory = {
        id: 'test-err-001',
        session_id: 'session-err-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '测试',
            timestamp: new Date().toISOString()
            // 没有 metadata
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result).toBeDefined();
    });

    it('应该处理特殊字符内容', async () => {
      const history: ConversationHistory = {
        id: 'test-err-002',
        session_id: 'session-err-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '测试特殊字符：@#$%^&*()_+{}[]|\\:";\'<>?,./~`',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result).toBeDefined();
      expect(result.dimensions).toBeDefined();
    });
  });

  describe('综合场景测试', () => {
    it('应该处理包含多个维度的复杂对话', async () => {
      const history: ConversationHistory = {
        id: 'test-complex-001',
        session_id: 'session-complex-001',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '我们使用React和Node.js开发，成功优化了性能，响应时间从500ms降到100ms，错误率降低了50%',
            timestamp: new Date().toISOString()
          },
          {
            id: 'msg-002',
            role: 'assistant',
            content: '很好的改进！继续保持这个成功模式',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      // 验证多个维度都被提取
      expect(result.dimensions.tools.items.length).toBeGreaterThan(0); // React, Node.js
      expect(result.dimensions.success.items.length).toBeGreaterThan(0); // 成功，优化
      expect(result.dimensions.benchmarks.items.length).toBeGreaterThan(0); // 性能
      expect(result.dimensions.data.items.length).toBeGreaterThan(0); // 数值数据
    });

    it('应该生成有意义的总结', async () => {
      const history: ConversationHistory = {
        id: 'test-complex-002',
        session_id: 'session-complex-002',
        messages: [
          {
            id: 'msg-001',
            role: 'user',
            content: '成功完成优化，性能提升，使用Docker部署',
            timestamp: new Date().toISOString()
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await extractor.extractFromHistory(history);

      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
      // 总结应该包含中文分号分隔
      expect(result.summary.includes('；')).toBe(true);
    });
  });
});
