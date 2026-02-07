/**
 * QuickReview - 快速复盘功能
 * 作为RetrospectiveCore的简化接口，提供5分钟快速复盘能力
 *
 * 特性：
 * - 一键触发快速复盘
 * - 自动提取7维度数据
 * - 生成Markdown报告
 * - 保存到MEMORY
 * - 命令行友好
 */

import { performance } from 'perf_hooks';
import { RetroMode, RetroTriggerType, RetroTaskInput } from '../types/retrospective.js';
import { RetroRecord } from '../types/index.js';
import { RetrospectiveCore } from './RetrospectiveCore.js';
import { DataExtractor, ConversationHistory, Message } from './DataExtractor.js';
import { MemoryStore } from './MemoryStore.js';

/**
 * QuickReview输入参数
 */
export interface QuickReviewInput {
  /** 项目ID */
  projectId: string;
  /** 上下文描述 */
  context: string;
  /** 预期时长（毫秒），可选 */
  duration?: number;
  /** 标签 */
  tags?: string[];
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/**
 * QuickReview结果
 */
export interface QuickReviewResult {
  /** 结果ID */
  id: string;
  /** 项目ID */
  projectId: string;
  /** 状态 */
  status: 'completed' | 'failed';
  /** 总结 */
  summary: string;
  /** Markdown报告 */
  report: string;
  /** 时间戳 */
  timestamp: string;
  /** 是否保存到MEMORY */
  saved: boolean;
  /** 记录ID */
  recordId?: string;
  /** 学到的教训 */
  lessons: string[];
  /** 置信度 */
  confidence: number;
  /** 7维度数据 */
  dimensions: {
    principles: any;
    patterns: any;
    benchmarks: any;
    traps: any;
    success: any;
    tools: any;
    data: any;
  };
  /** 统计信息 */
  stats: {
    duration: number;
    phaseTimes: Record<string, number>;
  };
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * QuickReview核心类
 *
 * @description
 * 快速复盘功能，作为RetrospectiveCore的简化接口，
 * 提供5分钟快速复盘能力。
 *
 * @remarks
 * 特性：
 * - 一键触发快速复盘
 * - 自动提取7维度数据
 * - 生成Markdown报告
 * - 保存到MEMORY
 * - 命令行友好
 *
 * 使用场景：
 * - 每日快速回顾
 * - 任务完成后小结
 * - 快速决策支持
 *
 * @example
 * ```typescript
 * const qr = new QuickReview();
 *
 * const result = await qr.review({
 *   projectId: 'my-project',
 *   context: '完成用户登录功能开发',
 *   tags: ['开发', '认证'],
 *   metadata: { phase: '开发' }
 * });
 *
 * console.log(qr.toCliOutput(result));
 * ```
 */
export class QuickReview {
  private retrospectiveCore: RetrospectiveCore;
  private dataExtractor: DataExtractor;
  private memoryStore: MemoryStore;
  private readonly MAX_DURATION = 5 * 60 * 1000; // 5分钟

  constructor() {
    this.retrospectiveCore = new RetrospectiveCore({ type: RetroMode.QUICK });
    this.dataExtractor = new DataExtractor();
    this.memoryStore = new MemoryStore();
  }

  /**
   * 获取复盘模式
   */
  getMode(): RetroMode {
    return RetroMode.QUICK;
  }

  /**
   * 获取最大时长
   */
  getMaxDuration(): number {
    return this.MAX_DURATION;
  }

  /**
   * 一键触发快速复盘
   *
   * @param input - 快速复盘输入参数
   * @returns 复盘结果
   *
   * @remarks
   * 执行流程：
   * 1. 准备复盘任务输入
   * 2. 执行7维度数据提取
   * 3. 执行快速复盘（使用RetrospectiveCore的Quick模式）
   * 4. 生成Markdown报告
   * 5. 保存到MEMORY
   *
   * @example
   * ```typescript
   * const result = await qr.review({
   *   projectId: 'my-project',
   *   context: '完成API接口开发',
   *   tags: ['api', 'backend'],
   *   duration: 5 * 60 * 1000 // 5分钟
   * });
   * ```
   */
  async review(input: QuickReviewInput): Promise<QuickReviewResult> {
    const startTime = performance.now();
    const reviewId = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 1. 准备复盘任务输入
      const taskInput = this.prepareTaskInput(input, reviewId);

      // 2. 执行7维度数据提取
      const dimensions = await this.extractDimensions(input);

      // 3. 执行快速复盘（使用RetrospectiveCore的Quick模式）
      const execution = await this.retrospectiveCore.executeRetro(taskInput);

      // 4. 生成Markdown报告
      const report = this.generateMarkdownReport(input, dimensions, execution);

      // 5. 保存到MEMORY
      const { saved, recordId, lessons, summary, confidence } =
        await this.saveToMemory(input, dimensions, execution);

      const duration = Math.round(performance.now() - startTime);

      return {
        id: reviewId,
        projectId: input.projectId,
        status: execution.status === 'completed' ? 'completed' : 'failed',
        summary,
        report,
        timestamp: new Date().toISOString(),
        saved,
        recordId,
        lessons,
        confidence,
        dimensions,
        stats: {
          duration,
          phaseTimes: execution.metrics.phaseTimes
        },
        metadata: input.metadata
      };

    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      return this.createErrorResult(input.projectId, reviewId, error, duration);
    }
  }

  /**
   * 命令行友好的接口
   */
  async cliReview(projectId: string, context: string): Promise<QuickReviewResult> {
    return this.review({ projectId, context });
  }

  /**
   * 转换为CLI输出格式
   */
  toCliOutput(result: QuickReviewResult): string {
    const lines = [
      '',
      '========================================',
      '  QuickReview 快速复盘报告',
      '========================================',
      '',
      `项目: ${result.projectId}`,
      `状态: ${result.status === 'completed' ? '✅ 完成' : '❌ 失败'}`,
      `时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}`,
      `耗时: ${Math.round(result.stats.duration / 1000)}秒`,
      `置信度: ${(result.confidence * 100).toFixed(0)}%`,
      '',
      '----------------------------------------',
      '  总结',
      '----------------------------------------',
      result.summary,
      '',
      '----------------------------------------',
      '  学到的教训',
      '----------------------------------------',
      ...result.lessons.map((l, i) => `${i + 1}. ${l}`),
      '',
      '========================================',
      ''
    ];

    return lines.join('\n');
  }

  /**
   * 转换为JSON输出格式
   */
  toJsonOutput(result: QuickReviewResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * 生成Markdown报告
   */
  private generateMarkdownReport(
    input: QuickReviewInput,
    dimensions: any,
    execution: any
  ): string {
    const timestamp = new Date().toISOString();
    const date = new Date().toLocaleDateString('zh-CN');
    const time = new Date().toLocaleTimeString('zh-CN');

    const lines = [
      `# QuickReview 快速复盘报告`,
      '',
      `## 项目信息`,
      `- **项目ID**: ${input.projectId}`,
      `- **复盘时间**: ${date} ${time}`,
      `- **上下文**: ${input.context || '未提供'}`,
      '',
      input.tags ? `**标签**: ${input.tags.join(', ')}` : '',
      '',
      `## 复盘总结`,
      execution.results?.analysis?.summary || '快速复盘完成',
      '',
      `## 7维度分析`,
      '',
      `### 原则维度`,
      this.formatDimension(dimensions.principles),
      '',
      `### 模式维度`,
      this.formatDimension(dimensions.patterns),
      '',
      `### 基准维度`,
      this.formatDimension(dimensions.benchmarks),
      '',
      `### 陷阱维度`,
      this.formatDimension(dimensions.traps),
      '',
      `### 成功维度`,
      this.formatDimension(dimensions.success),
      '',
      `### 工具维度`,
      this.formatDimension(dimensions.tools),
      '',
      `### 数据维度`,
      this.formatDimension(dimensions.data),
      '',
      `## 学到的教训`,
      ...(execution.results?.extraction?.lessonsLearned || ['持续改进', '团队协作']).map((l: string) => `- ${l}`),
      '',
      `## 改进建议`,
      ...(execution.results?.extraction?.improvementAreas || ['流程优化', '质量提升']).map((i: string) => `- ${i}`),
      '',
      `## 下一步行动`,
      ...(execution.results?.extraction?.actionItems || ['定期复盘', '知识分享']).map((a: string) => `- ${a}`),
      '',
      `---`,
      `*报告生成时间: ${timestamp}*`,
      ''
    ];

    return lines.filter(line => line !== '').join('\n');
  }

  /**
   * 格式化维度内容
   */
  private formatDimension(dimension: any): string {
    if (!dimension || !dimension.items) {
      return '- 无数据';
    }

    if (dimension.items.length === 0) {
      return '- 无检测结果';
    }

    return dimension.items
      .slice(0, 5)
      .map((item: any) => {
        const name = item.name || item.principle_name || item.pattern_name ||
                     item.benchmark_name || item.trap_name || item.factor_name ||
                     item.tool_name || item.data_name || '未知';
        const detail = item.message || item.description || item.level ||
                       item.impact || item.purpose || item.importance || '';
        return detail ? `- ${name}: ${detail}` : `- ${name}`;
      })
      .join('\n');
  }

  /**
   * 提取7维度数据
   */
  private async extractDimensions(input: QuickReviewInput): Promise<any> {
    // 构建对话历史
    const history: ConversationHistory = {
      id: `hist_${Date.now()}`,
      session_id: input.projectId,
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: input.context || '',
          timestamp: new Date().toISOString()
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const extractionResult = await this.dataExtractor.extractFromHistory(history, {
        project: input.projectId,
        ...input.metadata
      });

      return extractionResult.dimensions;
    } catch (error) {
      // 如果提取失败，返回空维度
      return {
        principles: { items: [], evidence: [] },
        patterns: { items: [], evidence: [] },
        benchmarks: { items: [], evidence: [] },
        traps: { items: [], evidence: [] },
        success: { items: [], evidence: [] },
        tools: { items: [], evidence: [] },
        data: { items: [], evidence: [] }
      };
    }
  }

  /**
   * 准备复盘任务输入
   */
  private prepareTaskInput(input: QuickReviewInput, reviewId: string): RetroTaskInput {
    return {
      id: reviewId,
      projectId: input.projectId,
      triggerType: RetroTriggerType.MANUAL,
      context: {
        phase: input.metadata?.phase || 'quick-review',
        history: [],
        user_preferences: input.metadata
      },
      metadata: input.metadata
    };
  }

  /**
   * 保存到MEMORY
   */
  private async saveToMemory(
    input: QuickReviewInput,
    dimensions: any,
    execution: any
  ): Promise<{
    saved: boolean;
    recordId?: string;
    lessons: string[];
    summary: string;
    confidence: number;
  }> {
    try {
      const retroRecord: RetroRecord = {
        id: `retro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'quick',
        project: input.projectId,
        duration: execution.totalDuration || 0,
        summary: this.generateSummary(input, dimensions),
        lessons: execution.results?.extraction?.lessonsLearned || ['持续改进', '团队协作'],
        improvements: execution.results?.extraction?.improvementAreas || ['流程优化', '质量提升'],
        violations: execution.results?.analysis?.failureReasons || []
      };

      await this.memoryStore.saveRetroRecord(retroRecord);

      // 计算置信度
      const confidence = this.calculateConfidence(dimensions);

      return {
        saved: true,
        recordId: retroRecord.id,
        lessons: retroRecord.lessons,
        summary: retroRecord.summary,
        confidence
      };
    } catch (error) {
      console.error('保存到MEMORY失败:', error);
      return {
        saved: false,
        lessons: ['持续改进', '团队协作'],
        summary: this.generateSummary(input, dimensions),
        confidence: 0.5
      };
    }
  }

  /**
   * 生成总结
   */
  private generateSummary(input: QuickReviewInput, dimensions: any): string {
    const parts = [
      `项目: ${input.projectId}`,
      `上下文: ${input.context || '未提供'}`
    ];

    // 添加维度统计
    if (dimensions.principles?.items?.length > 0) {
      parts.push(`原则违规: ${dimensions.principles.items.length}个`);
    }
    if (dimensions.success?.items?.length > 0) {
      parts.push(`成功要素: ${dimensions.success.items.length}个`);
    }
    if (dimensions.tools?.items?.length > 0) {
      parts.push(`使用工具: ${dimensions.tools.items.length}个`);
    }

    return parts.join('; ');
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(dimensions: any): number {
    const dims = [
      dimensions.principles,
      dimensions.patterns,
      dimensions.benchmarks,
      dimensions.traps,
      dimensions.success,
      dimensions.tools,
      dimensions.data
    ];

    const totalItems = dims.reduce((sum, d) => sum + (d?.items?.length || 0), 0);
    const totalEvidence = dims.reduce((sum, d) => sum + (d?.evidence?.length || 0), 0);

    // 基于检测到的项目数和证据数计算置信度
    const baseConfidence = Math.min(1.0, totalItems * 0.1);
    const evidenceBonus = Math.min(0.3, totalEvidence * 0.05);

    return Math.min(1.0, baseConfidence + evidenceBonus + 0.3); // 最小0.3
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    projectId: string,
    reviewId: string,
    error: unknown,
    duration: number
  ): QuickReviewResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      id: reviewId,
      projectId,
      status: 'failed',
      summary: `复盘失败: ${errorMessage}`,
      report: this.generateErrorReport(errorMessage),
      timestamp: new Date().toISOString(),
      saved: false,
      lessons: [],
      confidence: 0,
      dimensions: {
        principles: { items: [], evidence: [] },
        patterns: { items: [], evidence: [] },
        benchmarks: { items: [], evidence: [] },
        traps: { items: [], evidence: [] },
        success: { items: [], evidence: [] },
        tools: { items: [], evidence: [] },
        data: { items: [], evidence: [] }
      },
      stats: {
        duration,
        phaseTimes: {}
      }
    };
  }

  /**
   * 生成错误报告
   */
  private generateErrorReport(errorMessage: string): string {
    return `# QuickReview 复盘失败

\`\`\`
${errorMessage}
\`\`\`

请检查输入参数和项目配置。
`;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清理缓存等资源
    if (this.memoryStore && typeof this.memoryStore.clearCache === 'function') {
      this.memoryStore.clearCache();
    }
  }
}

// 导出单例
export const quickReview = new QuickReview();
