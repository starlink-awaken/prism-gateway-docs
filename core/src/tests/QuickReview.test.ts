/**
 * QuickReview 快速复盘功能测试
 * TDD: 测试先于实现
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { QuickReview, QuickReviewInput, QuickReviewResult } from '../core/QuickReview.js';
import { RetroMode } from '../types/retrospective.js';

describe('QuickReview', () => {
  let quickReview: QuickReview;

  beforeEach(() => {
    quickReview = new QuickReview();
  });

  afterEach(() => {
    quickReview.cleanup();
  });

  describe('基础功能', () => {
    it('应该创建QuickReview实例', () => {
      expect(quickReview).toBeDefined();
      expect(quickReview).toBeInstanceOf(QuickReview);
    });

    it('应该返回quick模式', () => {
      expect(quickReview.getMode()).toBe(RetroMode.QUICK);
    });

    it('应该有正确的最大时长配置（5分钟）', () => {
      const maxDuration = quickReview.getMaxDuration();
      expect(maxDuration).toBe(5 * 60 * 1000); // 5分钟
    });
  });

  describe('一键触发快速复盘', () => {
    it('应该能够通过minimal input触发快速复盘', async () => {
      const input: QuickReviewInput = {
        projectId: 'test-project',
        context: '完成用户认证功能开发'
      };

      const result = await quickReview.review(input);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.projectId).toBe('test-project');
      expect(result.status).toBe('completed');
      expect(result.summary).toBeDefined();
      expect(result.report).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('应该支持完整的QuickReviewInput', async () => {
      const input: QuickReviewInput = {
        projectId: 'test-project-full',
        context: '实现API接口优化',
        duration: 120000,
        tags: ['performance', 'api'],
        metadata: {
          phase: 'optimization',
          team: 'backend'
        }
      };

      const result = await quickReview.review(input);

      expect(result.projectId).toBe('test-project-full');
      expect(result.metadata?.phase).toBe('optimization');
    });

    it('应该在5分钟内完成快速复盘', async () => {
      const input: QuickReviewInput = {
        projectId: 'perf-test',
        context: '性能测试'
      };

      const startTime = Date.now();
      const result = await quickReview.review(input);
      const duration = Date.now() - startTime;

      expect(result.status).toBe('completed');
      expect(duration).toBeLessThan(5 * 60 * 1000); // 5分钟
    });
  });

  describe('7维度数据提取', () => {
    it('应该自动提取7维度数据', async () => {
      const input: QuickReviewInput = {
        projectId: 'dimension-test',
        context: '项目开发过程中发现3个原则违规，使用了React和Node.js工具，性能提升30%'
      };

      const result = await quickReview.review(input);

      expect(result.dimensions).toBeDefined();
      expect(result.dimensions.principles).toBeDefined();
      expect(result.dimensions.patterns).toBeDefined();
      expect(result.dimensions.benchmarks).toBeDefined();
      expect(result.dimensions.traps).toBeDefined();
      expect(result.dimensions.success).toBeDefined();
      expect(result.dimensions.tools).toBeDefined();
      expect(result.dimensions.data).toBeDefined();
    });

    it('应该检测到原则违规', async () => {
      const input: QuickReviewInput = {
        projectId: 'violation-test',
        context: '测试过程中违反了TDD原则，没有先写测试'
      };

      const result = await quickReview.review(input);

      // 原则维度应该检测到违规
      expect(result.dimensions.principles).toBeDefined();
    });

    it('应该识别成功要素', async () => {
      const input: QuickReviewInput = {
        projectId: 'success-test',
        context: '成功完成功能交付，团队协作良好，代码质量高'
      };

      const result = await quickReview.review(input);

      // 成功维度应该有内容
      expect(result.dimensions.success).toBeDefined();
    });

    it('应该识别使用的工具', async () => {
      const input: QuickReviewInput = {
        projectId: 'tools-test',
        context: '项目使用React框架，Docker部署，Git版本控制'
      };

      const result = await quickReview.review(input);

      // 工具维度应该识别出工具
      expect(result.dimensions.tools).toBeDefined();
    });
  });

  describe('Markdown报告生成', () => {
    it('应该生成Markdown格式的报告', async () => {
      const input: QuickReviewInput = {
        projectId: 'report-test',
        context: '生成测试报告'
      };

      const result = await quickReview.review(input);

      expect(result.report).toBeDefined();
      expect(result.report).toContain('#');
      expect(result.report).toContain('##');
    });

    it('报告应该包含关键信息', async () => {
      const input: QuickReviewInput = {
        projectId: 'report-content-test',
        context: '测试报告内容完整性'
      };

      const result = await quickReview.review(input);

      // 报告应该包含项目信息
      expect(result.report).toContain('report-content-test');
      // 报告应该包含总结
      expect(result.report).toContain('总结');
      // 报告应该包含时间戳
      expect(result.report).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('报告应该包含7维度摘要', async () => {
      const input: QuickReviewInput = {
        projectId: 'dimension-report-test',
        context: '测试7维度报告'
      };

      const result = await quickReview.review(input);

      // 报告应该包含各维度标题
      expect(result.report).toMatch(/原则|模式|基准|陷阱|成功|工具|数据/);
    });
  });

  describe('保存到MEMORY', () => {
    it('应该保存复盘记录到MemoryStore', async () => {
      const input: QuickReviewInput = {
        projectId: 'storage-test',
        context: '测试存储功能'
      };

      const result = await quickReview.review(input);

      expect(result.saved).toBe(true);
      expect(result.recordId).toBeDefined();
    });

    it('保存的记录应该包含必要字段', async () => {
      const input: QuickReviewInput = {
        projectId: 'record-fields-test',
        context: '测试记录字段完整性'
      };

      const result = await quickReview.review(input);

      expect(result.recordId).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.lessons).toBeDefined();
      expect(Array.isArray(result.lessons)).toBe(true);
    });
  });

  describe('命令行友好接口', () => {
    it('应该支持简洁的命令行调用方式', async () => {
      // 模拟命令行调用
      const projectId = process.argv[2] || 'cli-test';
      const context = process.argv[3] || 'CLI测试';

      const result = await quickReview.cliReview(projectId, context);

      expect(result).toBeDefined();
      expect(result.projectId).toBe(projectId);
    });

    it('应该提供简洁的输出格式', async () => {
      const input: QuickReviewInput = {
        projectId: 'cli-output-test',
        context: 'CLI输出测试'
      };

      const result = await quickReview.review(input);
      const cliOutput = quickReview.toCliOutput(result);

      expect(cliOutput).toBeDefined();
      expect(cliOutput).toContain('✅');
      expect(cliOutput).toContain(result.projectId);
    });

    it('应该支持JSON输出格式', async () => {
      const input: QuickReviewInput = {
        projectId: 'json-test',
        context: 'JSON输出测试'
      };

      const result = await quickReview.review(input);
      const jsonOutput = quickReview.toJsonOutput(result);

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.projectId).toBe('json-test');
      expect(parsed.status).toBe('completed');
    });
  });

  describe('性能要求', () => {
    it('快速复盘应该在合理时间内完成', async () => {
      const input: QuickReviewInput = {
        projectId: 'perf-test-2',
        context: '性能测试'
      };

      const startTime = Date.now();
      await quickReview.review(input);
      const duration = Date.now() - startTime;

      // 快速复盘应该在合理时间内完成（测试环境放宽）
      expect(duration).toBeLessThan(10000); // 10秒
    });

    it('应该提供性能统计', async () => {
      const input: QuickReviewInput = {
        projectId: 'stats-test',
        context: '统计测试'
      };

      const result = await quickReview.review(input);

      expect(result.stats).toBeDefined();
      expect(result.stats.duration).toBeDefined();
      expect(result.stats.phaseTimes).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该处理空context', async () => {
      const input: QuickReviewInput = {
        projectId: 'empty-context-test',
        context: ''
      };

      const result = await quickReview.review(input);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('应该处理特殊字符', async () => {
      const input: QuickReviewInput = {
        projectId: 'special-chars-test',
        context: '测试特殊字符: @#$%^&*()_+-={}[]|\\:";\'<>?,./中文'
      };

      const result = await quickReview.review(input);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  describe('置信度评估', () => {
    it('应该提供置信度评分', async () => {
      const input: QuickReviewInput = {
        projectId: 'confidence-test',
        context: '详细的项目上下文信息，包含成功要素、失败原因、关键决策等内容'
      };

      const result = await quickReview.review(input);

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('丰富上下文应该有更高置信度', async () => {
      const richInput: QuickReviewInput = {
        projectId: 'rich-context-test',
        context: '项目完成用户认证功能开发，采用TDD方法，使用React和Node.js，性能提升30%，团队协作良好'
      };

      const poorInput: QuickReviewInput = {
        projectId: 'poor-context-test',
        context: '测试'
      };

      const richResult = await quickReview.review(richInput);
      const poorResult = await quickReview.review(poorInput);

      expect(richResult.confidence).toBeGreaterThanOrEqual(poorResult.confidence);
    });
  });
});
