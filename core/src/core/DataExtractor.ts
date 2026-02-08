/**
 * PRISM-Gateway DataExtractor
 * 从对话和任务上下文中提取7维度数据
 */

import { homedir } from 'os';
import { join } from 'path';
import {
  Message,
  ConversationHistory,
  ExtractionResult,
  PrinciplesDimension,
  PatternsDimension,
  BenchmarksDimension,
  TrapsDimension,
  SuccessDimension,
  ToolsDimension,
  DataDimension,
  DataExtractorConfig
} from '../types/index.js';
import { MemoryStore } from './MemoryStore.js';
import { GatewayGuard } from './GatewayGuard.js';
import { PrincipleChecker } from './PrincipleChecker.js';
import { PatternMatcher } from './PatternMatcher.js';
import { TrapDetector } from './TrapDetector.js';

/**
 * 7维度数据提取器
 *
 * @description
 * 从对话和任务上下文中提取7维度数据：
 * - 原则维度: 违反的原则和违规情况
 * - 模式维度: 成功/失败模式匹配
 * - 基准维度: 性能、质量等基准评估
 * - 陷阱维度: 常见陷阱识别
 * - 成功维度: 成功要素和影响
 * - 工具维度: 使用的技术和工具
 * - 数据维度: 关键数据点和指标
 *
 * @remarks
 * 提取流程：
 * 1. 预处理对话历史（过滤空消息、应用上下文窗口）
 * 2. 并行提取所有7维度数据
 * 3. 计算总体置信度
 * 4. 生成总结
 *
 * 配置选项：
 * - min_confidence_threshold: 最低置信度阈值（默认0.6）
 * - max_processing_time: 最大处理时间（默认300ms）
 * - context_window_size: 上下文窗口大小（默认10）
 *
 * @example
 * ```typescript
 * const extractor = new DataExtractor();
 *
 * const result = await extractor.extractDimensions(
 *   'session_123',
 *   [
 *     { role: 'user', content: '实现登录功能', timestamp: '...' },
 *     { role: 'assistant', content: '好的，我来实现', timestamp: '...' }
 *   ],
 *   { project: 'my-project' }
 * );
 *
 * console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`);
 * console.log(`总结: ${result.summary}`);
 * ```
 */
export class DataExtractor {
  private memoryStore: MemoryStore;
  private gatewayGuard: GatewayGuard;
  private principleChecker: PrincipleChecker;
  private patternMatcher: PatternMatcher;
  private trapDetector: TrapDetector;
  private config: DataExtractorConfig;

  constructor(config?: Partial<DataExtractorConfig>) {
    this.memoryStore = new MemoryStore();
    this.gatewayGuard = new GatewayGuard(this.memoryStore);
    this.principleChecker = new PrincipleChecker(this.memoryStore);
    this.patternMatcher = new PatternMatcher(this.memoryStore);
    this.trapDetector = new TrapDetector(this.memoryStore);

    // 默认配置
    this.config = {
      min_confidence_threshold: 0.6,
      max_processing_time: 300,
      enable_dimension_weighting: true,
      context_window_size: 10,
      keyword_boost_factor: 1.2,
      ...config
    };
  }

  /**
   * 从对话历史中提取7维度数据（便捷方法）
   *
   * @param sessionId - 会话ID
   * @param messages - 消息数组
   * @param context - 可选的上下文信息
   * @returns 提取结果，包含7维度数据和总结
   *
   * @example
   * ```typescript
   * const result = await extractor.extractDimensions(
   *   'session_123',
   *   [
   *     { id: '1', role: 'user', content: '需要实现登录', timestamp: '...' },
   *     { id: '2', role: 'assistant', content: '我来实现', timestamp: '...' }
   *   ]
   * );
   * ```
   */
  async extractDimensions(
    sessionId: string,
    messages: any[],
    context?: Record<string, any>
  ): Promise<ExtractionResult> {
    const history: ConversationHistory = {
      id: `history_${sessionId}`,
      session_id: sessionId,
      messages: messages.map((m, i) => ({
        id: m.id || `msg_${i}`,
        role: m.role || 'user',
        content: m.content || '',
        timestamp: m.timestamp || new Date().toISOString(),
        metadata: m.metadata
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return this.extractFromHistory(history, context);
  }

  /**
   * 从对话历史中提取7维度数据
   */
  async extractFromHistory(
    history: ConversationHistory,
    context?: Record<string, any>
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    // 1. 预处理对话历史
    const processedMessages = this.preprocessMessages(history.messages);

    // 2. 并行提取所有维度
    const [
      principles,
      patterns,
      benchmarks,
      traps,
      success,
      tools,
      data
    ] = await Promise.all([
      this.extractPrinciplesDimension(processedMessages, context),
      this.extractPatternsDimension(processedMessages, context),
      this.extractBenchmarksDimension(processedMessages, context),
      this.extractTrapsDimension(processedMessages, context),
      this.extractSuccessDimension(processedMessages, context),
      this.extractToolsDimension(processedMessages, context),
      this.extractDataDimension(processedMessages, context)
    ]);

    // 3. 计算总体置信度
    const overallConfidence = this.calculateOverallConfidence([
      principles.confidence,
      patterns.confidence,
      benchmarks.confidence,
      traps.confidence,
      success.confidence,
      tools.confidence,
      data.confidence
    ]);

    // 4. 生成总结
    const summary = this.generateSummary({
      principles,
      patterns,
      benchmarks,
      traps,
      success,
      tools,
      data
    });

    // 5. 构建结果
    const result: ExtractionResult = {
      id: `extract_${Date.now()}`,
      session_id: history.session_id,
      timestamp: new Date().toISOString(),
      processing_time: Date.now() - startTime,
      dimensions: {
        principles,
        patterns,
        benchmarks,
        traps,
        success,
        tools,
        data
      },
      summary,
      confidence: overallConfidence
    };

    // 性能监控
    if (result.processing_time > this.config.max_processing_time) {
      console.warn(`[PERF] DataExtractor took ${result.processing_time}ms (target: <${this.config.max_processing_time}ms)`);
    }

    return result;
  }

  /**
   * 预处理消息
   */
  private preprocessMessages(messages: Message[]): Message[] {
    // 1. 过滤空消息
    const filtered = messages.filter(m => m.content && m.content.trim().length > 0);

    // 2. 应用上下文窗口大小限制
    const windowSize = this.config.context_window_size;
    if (filtered.length > windowSize) {
      return filtered.slice(-windowSize);
    }

    return filtered;
  }

  /**
   * 提取原则维度
   */
  private async extractPrinciplesDimension(
    messages: Message[],
    context?: Record<string, any>
  ): Promise<PrinciplesDimension> {
    const startTime = Date.now();

    // 合并所有消息内容
    const fullText = messages.map(m => m.content).join('\n');

    // 使用GatewayGuard进行原则检查
    const checkResult = await this.gatewayGuard.check(fullText, context);

    const violations = checkResult.violations.map(v => ({
      principle_id: v.principle_id,
      principle_name: v.principle_name,
      severity: v.severity,
      message: v.message,
      context: this.extractContext(messages, v.principle_name)
    }));

    // 计算置信度
    const confidence = violations.length > 0 ?
      Math.min(1.0, violations.length * 0.3) : 0.8;

    return {
      name: 'Principles',
      confidence,
      items: violations,
      evidence: violations.map(v => `${v.principle_name}: ${v.message}`)
    };
  }

  /**
   * 提取模式维度
   */
  private async extractPatternsDimension(
    messages: Message[],
    context?: Record<string, any>
  ): Promise<PatternsDimension> {
    const startTime = Date.now();

    const fullText = messages.map(m => m.content).join('\n');

    // 使用PatternMatcher进行模式匹配
    const patternResult = await this.patternMatcher.match(fullText);

    const matches = patternResult.map(r => ({
      pattern_id: r.pattern_id,
      pattern_name: r.pattern_name,
      type: r.type,
      confidence: r.confidence,
      context: this.extractContext(messages, r.pattern_name)
    }));

    // 过滤低置信度匹配
    const highConfidenceMatches = matches.filter(m =>
      m.confidence >= this.config.min_confidence_threshold
    );

    const confidence = highConfidenceMatches.length > 0 ?
      Math.min(1.0, highConfidenceMatches.reduce((sum, m) => sum + m.confidence, 0) / highConfidenceMatches.length) : 0.5;

    return {
      name: 'Patterns',
      confidence,
      items: highConfidenceMatches,
      evidence: highConfidenceMatches.map(m => `${m.pattern_name} (${m.type}, ${(m.confidence * 100).toFixed(0)}%)`)
    };
  }

  /**
   * 提取基准维度
   */
  private async extractBenchmarksDimension(
    messages: Message[],
    context?: Record<string, any>
  ): Promise<BenchmarksDimension> {
    const startTime = Date.now();

    const fullText = messages.map(m => m.content).join('\n');

    // 基于关键词识别基准相关内容
    const benchmarkKeywords = [
      '性能', '效率', '速度', '响应时间', '吞吐量',
      '质量', '准确率', '可靠性', '稳定性',
      '可扩展性', '可维护性', '安全性'
    ];

    const assessments = [];
    const detectedKeywords = benchmarkKeywords.filter(keyword =>
      fullText.toLowerCase().includes(keyword.toLowerCase())
    );

    // 为每个检测到的关键词创建评估
    detectedKeywords.forEach(keyword => {
      const score = this.calculateBenchmarkScore(fullText, keyword);
      const level = this.scoreToLevel(score);

      assessments.push({
        benchmark_id: `benchmark_${keyword}`,
        benchmark_name: `${keyword}评估`,
        score,
        level,
        context: this.extractContext(messages, keyword)
      });
    });

    // 如果没有检测到基准关键词，使用默认评估
    if (assessments.length === 0) {
      assessments.push({
        benchmark_id: 'general_benchmark',
        benchmark_name: '综合评估',
        score: 0.7,
        level: 'good',
        context: '基于对话内容的综合评估'
      });
    }

    const confidence = assessments.length > 0 ? 0.7 : 0.3;

    return {
      name: 'Benchmarks',
      confidence,
      items: assessments,
      evidence: assessments.map(a => `${a.benchmark_name}: ${a.level} (${(a.score * 100).toFixed(0)}%)`)
    };
  }

  /**
   * 提取陷阱维度
   */
  private async extractTrapsDimension(
    messages: Message[],
    context?: Record<string, any>
  ): Promise<TrapsDimension> {
    const startTime = Date.now();

    const fullText = messages.map(m => m.content).join('\n');

    // 使用TrapDetector检测陷阱
    const trapResult = await this.trapDetector.detect(fullText);

    const detections = trapResult.map(t => ({
      trap_id: t.pattern_id,
      trap_name: t.pattern_name,
      severity: t.severity,
      context: this.extractContext(messages, t.pattern_name),
      suggestion: t.message
    }));

    // 计算置信度
    const confidence = detections.length > 0 ?
      Math.min(1.0, detections.length * 0.4) : 0.6;

    return {
      name: 'Traps',
      confidence,
      items: detections,
      evidence: detections.map(d => `${d.trap_name} (${d.severity})`)
    };
  }

  /**
   * 提取成功维度
   */
  private async extractSuccessDimension(
    messages: Message[],
    context?: Record<string, any>
  ): Promise<SuccessDimension> {
    const startTime = Date.now();

    const fullText = messages.map(m => m.content).join('\n');

    // 成功模式关键词
    const successKeywords = [
      '成功', '完成', '达成', '实现', '解决',
      '优化', '改进', '提升', '突破', '创新'
    ];

    const factors = [];
    const detectedKeywords = successKeywords.filter(keyword =>
      fullText.toLowerCase().includes(keyword.toLowerCase())
    );

    detectedKeywords.forEach(keyword => {
      const impact = this.calculateImpact(fullText, keyword);

      factors.push({
        factor_id: `success_${keyword}`,
        factor_name: `${keyword}要素`,
        impact,
        context: this.extractContext(messages, keyword)
      });
    });

    // 如果没有检测到成功关键词，分析整体积极度
    if (factors.length === 0) {
      const positivity = this.calculatePositivity(fullText);
      factors.push({
        factor_id: 'overall_success',
        factor_name: '整体成功度',
        impact: positivity > 0.7 ? 'high' : positivity > 0.4 ? 'medium' : 'low',
        context: '基于文本情感分析的整体成功评估'
      });
    }

    const confidence = factors.length > 0 ? 0.8 : 0.4;

    return {
      name: 'Success',
      confidence,
      items: factors,
      evidence: factors.map(f => `${f.factor_name}: ${f.impact}`)
    };
  }

  /**
   * 提取工具维度
   */
  private async extractToolsDimension(
    messages: Message[],
    context?: Record<string, any>
  ): Promise<ToolsDimension> {
    const startTime = Date.now();

    const fullText = messages.map(m => m.content).join('\n');

    // 工具相关关键词
    const toolKeywords = [
      '工具', '平台', '框架', '库', '系统',
      '软件', '应用', '服务', 'API', 'CLI'
    ];

    const tools = [];
    const detectedKeywords = toolKeywords.filter(keyword =>
      fullText.toLowerCase().includes(keyword.toLowerCase())
    );

    // 尝试识别具体的工具名称
    const toolPatterns = [
      /\b(?:React|Vue|Angular|Svelte)\b/gi,
      /\b(?:Node\.js|Python|Java|Go|Rust)\b/gi,
      /\b(?:Docker|Kubernetes|AWS|Azure|GCP)\b/gi,
      /\b(?:Git|SVN|Mercurial)\b/gi,
      /\b(?:VS Code|IntelliJ|Sublime)\b/gi
    ];

    toolPatterns.forEach((pattern, index) => {
      const matches = fullText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          tools.push({
            tool_id: `tool_${match.toLowerCase()}`,
            tool_name: match,
            purpose: this.inferToolPurpose(match, fullText),
            usage_context: this.extractContext(messages, match)
          });
        });
      }
    });

    const confidence = tools.length > 0 ? 0.9 : 0.5;

    return {
      name: 'Tools',
      confidence,
      items: tools,
      evidence: tools.map(t => `${t.tool_name}: ${t.purpose}`)
    };
  }

  /**
   * 提取数据维度
   */
  private async extractDataDimension(
    messages: Message[],
    context?: Record<string, any>
  ): Promise<DataDimension> {
    const startTime = Date.now();

    const fullText = messages.map(m => m.content).join('\n');

    // 数据相关关键词
    const dataKeywords = [
      '数据', '信息', '指标', '统计', '分析',
      '报表', '图表', '可视化', '监控', '日志'
    ];

    const points = [];
    const detectedKeywords = dataKeywords.filter(keyword =>
      fullText.toLowerCase().includes(keyword.toLowerCase())
    );

    // 提取具体的数值数据
    const numberPattern = /(\d+\.?\d*)\s*(%|万|亿|个|条|次|ms|s|kb|mb|gb)?/gi;
    const matches = fullText.match(numberPattern);

    if (matches) {
      matches.forEach(match => {
        points.push({
          data_id: `data_${match}`,
          data_name: `数值数据: ${match}`,
          category: 'numerical',
          importance: this.assessDataImportance(match, fullText),
          value: match,
          context: this.extractContext(messages, match)
        });
      });
    }

    // 如果没有数值数据，添加基于关键词的数据点
    if (points.length === 0 && detectedKeywords.length > 0) {
      detectedKeywords.forEach(keyword => {
        points.push({
          data_id: `keyword_data_${keyword}`,
          data_name: `${keyword}相关数据`,
          category: 'categorical',
          importance: 'normal',
          value: keyword,
          context: this.extractContext(messages, keyword)
        });
      });
    }

    const confidence = points.length > 0 ? 0.8 : 0.4;

    return {
      name: 'Data',
      confidence,
      items: points,
      evidence: points.map(p => `${p.data_name}: ${p.importance}`)
    };
  }

  /**
   * 从消息中提取上下文
   */
  private extractContext(messages: Message[], keyword: string): string {
    // 查找包含关键词的消息
    const relevantMessages = messages.filter(m =>
      m.content.toLowerCase().includes(keyword.toLowerCase())
    );

    // 返回前3个相关消息的内容片段
    return relevantMessages
      .slice(0, 3)
      .map(m => m.content.substring(0, 100))
      .join('...');
  }

  /**
   * 计算基准分数
   */
  private calculateBenchmarkScore(text: string, keyword: string): number {
    const keywordCount = (text.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    const maxScore = Math.min(1.0, keywordCount * 0.2);
    return maxScore;
  }

  /**
   * 分数转换为等级
   */
  private scoreToLevel(score: number): 'excellent' | 'good' | 'average' | 'poor' {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'average';
    return 'poor';
  }

  /**
   * 计算影响程度
   */
  private calculateImpact(text: string, keyword: string): 'high' | 'medium' | 'low' {
    const keywordCount = (text.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    if (keywordCount >= 3) return 'high';
    if (keywordCount >= 1) return 'medium';
    return 'low';
  }

  /**
   * 计算文本积极度
   */
  private calculatePositivity(text: string): number {
    const positiveWords = ['好', '棒', '优秀', '成功', '完成', '达成', '满意'];
    const positiveCount = positiveWords.reduce((count, word) =>
      count + (text.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0
    );
    return Math.min(1.0, positiveCount * 0.1);
  }

  /**
   * 推断工具用途
   */
  private inferToolPurpose(toolName: string, text: string): string {
    const lowerText = text.toLowerCase();
    const toolLower = toolName.toLowerCase();

    if (lowerText.includes('开发') || lowerText.includes('编程')) {
      return '开发工具';
    } else if (lowerText.includes('部署') || lowerText.includes('运维')) {
      return '运维工具';
    } else if (lowerText.includes('测试') || lowerText.includes('质量')) {
      return '测试工具';
    } else if (lowerText.includes('分析') || lowerText.includes('数据')) {
      return '分析工具';
    } else {
      return '通用工具';
    }
  }

  /**
   * 评估数据重要性
   */
  private assessDataImportance(value: string, text: string): 'critical' | 'important' | 'normal' {
    // 检查是否是性能相关数据
    if (value.includes('%') || value.includes('ms') || value.includes('s')) {
      return 'important';
    }

    // 检查是否是业务关键数据
    const criticalKeywords = ['错误', '失败', '异常', '事故'];
    const hasCritical = criticalKeywords.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasCritical) {
      return 'critical';
    }

    return 'normal';
  }

  /**
   * 计算总体置信度
   */
  private calculateOverallConfidence(confidences: number[]): number {
    if (confidences.length === 0) return 0;

    const average = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

    // 应用维度权重（可选）
    if (this.config.enable_dimension_weighting) {
      const weights = [1.0, 0.9, 0.8, 0.9, 0.8, 0.7, 0.7]; // 原则维度权重最高
      const weightedSum = confidences.reduce((sum, c, i) => sum + c * weights[i], 0);
      return weightedSum / weights.reduce((sum, w) => sum + w, 0);
    }

    return average;
  }

  /**
   * 生成总结
   */
  private generateSummary(dimensions: {
    principles: PrinciplesDimension;
    patterns: PatternsDimension;
    benchmarks: BenchmarksDimension;
    traps: TrapsDimension;
    success: SuccessDimension;
    tools: ToolsDimension;
    data: DataDimension;
  }): string {
    const summaryParts: string[] = [];

    // 原则维度总结
    if (dimensions.principles.items.length > 0) {
      const violationCount = dimensions.principles.items.length;
      summaryParts.push(`发现${violationCount}个原则违规`);
    } else {
      summaryParts.push('原则检查通过');
    }

    // 模式维度总结
    if (dimensions.patterns.items.length > 0) {
      const matchCount = dimensions.patterns.items.length;
      summaryParts.push(`识别${matchCount}个模式`);
    }

    // 基准维度总结
    if (dimensions.benchmarks.items.length > 0) {
      const avgScore = dimensions.benchmarks.items.reduce((sum, b) => sum + b.score, 0) / dimensions.benchmarks.items.length;
      summaryParts.push(`基准评分: ${(avgScore * 100).toFixed(0)}分`);
    }

    // 陷阱维度总结
    if (dimensions.traps.items.length > 0) {
      const trapCount = dimensions.traps.items.length;
      summaryParts.push(`发现${trapCount}个潜在陷阱`);
    }

    // 成功维度总结
    if (dimensions.success.items.length > 0) {
      const highImpactCount = dimensions.success.items.filter(s => s.impact === 'high').length;
      summaryParts.push(`${highImpactCount}个成功要素影响显著`);
    }

    // 工具维度总结
    if (dimensions.tools.items.length > 0) {
      const toolCount = dimensions.tools.items.length;
      summaryParts.push(`使用${toolCount}个工具`);
    }

    // 数据维度总结
    if (dimensions.data.items.length > 0) {
      const criticalCount = dimensions.data.items.filter(d => d.importance === 'critical').length;
      summaryParts.push(`${criticalCount}个关键数据点`);
    }

    return summaryParts.join('；');
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<DataExtractorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取配置
   */
  getConfig(): DataExtractorConfig {
    return { ...this.config };
  }
}

// 导出单例
export const dataExtractor = new DataExtractor();