/**
 * RetrospectiveCore - 复盘编排引擎
 * 支持三种复盘模式：Quick（5分钟）、Standard（25分钟）、Deep（60分钟）
 */

import { join } from 'path';
import { homedir } from 'os';
import { performance } from 'perf_hooks';
import {
  RetroConfig,
  RetroTriggerType,
  RetroPhase,
  RetroStatus,
  RetroTaskInput,
  AnalysisResult,
  ExtractionResult,
  RetroExecution,
  RetroReport,
  RetroMode,
  RetroModeConfig
} from '../types/retrospective.js';
import {
  RetroRecord,
  ViolationRecord
} from '../types/index.js';
import { MemoryStore } from './MemoryStore.js';
import { GatewayGuard } from './GatewayGuard.js';
import { DataExtractor } from './DataExtractor.js';

/**
 * 预定义的模式配置
 */
const MODE_CONFIGS: Record<RetroMode, RetroModeConfig> = {
  [RetroMode.QUICK]: {
    type: RetroMode.QUICK,
    maxDuration: 5 * 60 * 1000, // 5分钟
    phases: {
      trigger: { maxTime: 30 * 1000, description: '触发识别' },
      analysis: { maxTime: 2 * 60 * 1000, description: '快速分析' },
      extraction: { maxTime: 1 * 60 * 1000, description: '关键提取' },
      storage: { maxTime: 2 * 60 * 1000, description: '记录到MEMORY' }
    },
    analysisDepth: 'shallow',
    enableReflection: false,
    enablePlanning: false
  },
  [RetroMode.STANDARD]: {
    type: RetroMode.STANDARD,
    maxDuration: 25 * 60 * 1000, // 25分钟
    phases: {
      trigger: { maxTime: 1 * 60 * 1000, description: '触发识别' },
      analysis: { maxTime: 10 * 60 * 1000, description: '全面分析' },
      extraction: { maxTime: 5 * 60 * 1000, description: '深度提取' },
      reflection: { maxTime: 5 * 60 * 1000, description: '反思总结' },
      storage: { maxTime: 4 * 60 * 1000, description: '记录到MEMORY' }
    },
    analysisDepth: 'medium',
    enableReflection: true,
    enablePlanning: false
  },
  [RetroMode.DEEP]: {
    type: RetroMode.DEEP,
    maxDuration: 60 * 60 * 1000, // 60分钟
    phases: {
      trigger: { maxTime: 2 * 60 * 1000, description: '触发识别' },
      analysis: { maxTime: 20 * 60 * 1000, description: '深入分析' },
      extraction: { maxTime: 10 * 60 * 1000, description: '全面提取' },
      reflection: { maxTime: 15 * 60 * 1000, description: '深度反思' },
      planning: { maxTime: 8 * 60 * 1000, description: '改进规划' },
      storage: { maxTime: 5 * 60 * 1000, description: '记录到MEMORY' }
    },
    analysisDepth: 'deep',
    enableReflection: true,
    enablePlanning: true
  }
};

/**
 * RetrospectiveCore核心类
 *
 * @description
 * 复盘编排引擎，支持三种复盘模式：
 * - Quick（快速）: 5分钟，包含触发、分析、提取、存储4个阶段
 * - Standard（标准）: 25分钟，增加反思阶段
 * - Deep（深度）: 60分钟，增加规划阶段
 *
 * @remarks
 * 复盘阶段：
 * 1. 触发识别（Trigger）: 检查是否需要复盘
 * 2. 分析阶段（Analysis）: 识别成功要素和失败原因
 * 3. 提取阶段（Extraction）: 提取可复用知识和改进领域
 * 4. 反思阶段（Reflection）: 深度分析根本原因（Standard/Deep模式）
 * 5. 规划阶段（Planning）: 制定改进计划（Deep模式）
 * 6. 存储阶段（Storage）: 保存到MEMORY
 *
 * @example
 * ```typescript
 * // 使用快速模式
 * const retro = new RetrospectiveCore({ type: RetroMode.QUICK });
 *
 * const execution = await retro.executeRetro({
 *   id: 'retro_123',
 *   projectId: 'my-project',
 *   triggerType: RetroTriggerType.MANUAL,
 *   context: { phase: '开发', history: [] }
 * });
 *
 * console.log(`复盘完成，耗时: ${execution.totalDuration}ms`);
 * ```
 */
export class RetrospectiveCore {
  private memoryStore: MemoryStore;
  private gatewayGuard: GatewayGuard;
  private dataExtractor: DataExtractor;
  private config: RetroConfig;

  constructor(config?: Partial<RetroConfig>) {
    this.memoryStore = new MemoryStore();
    this.gatewayGuard = new GatewayGuard(this.memoryStore);
    this.dataExtractor = new DataExtractor(this.memoryStore);

    // 确定复盘模式
    const mode = config?.type || RetroMode.QUICK;
    const modeConfig = MODE_CONFIGS[mode];

    this.config = {
      type: mode,
      maxDuration: modeConfig.maxDuration,
      phases: {
        trigger: { maxTime: modeConfig.phases.trigger.maxTime },
        analysis: { maxTime: modeConfig.phases.analysis.maxTime },
        extraction: { maxTime: modeConfig.phases.extraction.maxTime },
        storage: { maxTime: modeConfig.phases.storage.maxTime },
        ...(modeConfig.phases.reflection && {
          reflection: { maxTime: modeConfig.phases.reflection.maxTime }
        }),
        ...(modeConfig.phases.planning && {
          planning: { maxTime: modeConfig.phases.planning.maxTime }
        })
      },
      autoTrigger: config?.autoTrigger ?? true,
      triggerConditions: config?.triggerConditions || [
        { type: 'violation', threshold: 1 },
        { type: 'risk', threshold: 0.7 },
        { type: 'manual' }
      ],
      modeConfig
    };
  }

  /**
   * 切换复盘模式
   *
   * @param mode - 目标复盘模式
   *
   * @remarks
   * 切换模式会重新配置时间预算和阶段设置
   *
   * @example
   * ```typescript
   * retro.switchMode(RetroMode.STANDARD); // 切换到标准模式
   * retro.switchMode(RetroMode.DEEP);     // 切换到深度模式
   * ```
   */
  switchMode(mode: RetroMode): void {
    const modeConfig = MODE_CONFIGS[mode];

    this.config = {
      ...this.config,
      type: mode,
      maxDuration: modeConfig.maxDuration,
      phases: {
        trigger: { maxTime: modeConfig.phases.trigger.maxTime },
        analysis: { maxTime: modeConfig.phases.analysis.maxTime },
        extraction: { maxTime: modeConfig.phases.extraction.maxTime },
        storage: { maxTime: modeConfig.phases.storage.maxTime },
        ...(modeConfig.phases.reflection && {
          reflection: { maxTime: modeConfig.phases.reflection.maxTime }
        }),
        ...(modeConfig.phases.planning && {
          planning: { maxTime: modeConfig.phases.planning.maxTime }
        })
      },
      modeConfig
    };

    console.log(`🔄 切换到${mode.toUpperCase()}模式 (最大时长: ${modeConfig.maxDuration / 1000 / 60}分钟)`);
  }

  /**
   * 获取当前模式
   */
  getCurrentMode(): RetroMode {
    return this.config.type;
  }

  /**
   * 获取模式配置
   */
  getModeConfig(mode: RetroMode): RetroModeConfig {
    return MODE_CONFIGS[mode];
  }

  /**
   * 执行复盘流程
   *
   * @param taskInput - 复盘任务输入
   * @returns 复盘执行结果
   *
   * @remarks
   * 执行完整的复盘流程，包括所有阶段。每个阶段都有时间预算，
   * 超时会记录警告但继续执行。
   *
   * @example
   * ```typescript
   * const execution = await retro.executeRetro({
   *   id: 'retro_1',
   *   projectId: 'my-project',
   *   triggerType: RetroTriggerType.MANUAL,
   *   context: { phase: '开发', history: [] }
   * });
   *
   * console.log(`状态: ${execution.status}`);
   * console.log(`耗时: ${execution.totalDuration}ms`);
   * ```
   */
  async executeRetro(taskInput: RetroTaskInput): Promise<RetroExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    let currentPhase = RetroPhase.TRIGGER;
    let errors: string[] = [];

    // 根据模式初始化阶段时间
    const modeConfig = this.config.modeConfig;
    const phaseTimes: Record<string, number> = {
      [RetroPhase.TRIGGER]: 0,
      [RetroPhase.ANALYSIS]: 0,
      [RetroPhase.EXTRACTION]: 0,
      [RetroPhase.STORAGE]: 0
    };

    if (modeConfig.enableReflection) {
      phaseTimes[RetroPhase.REFLECTION] = 0;
    }
    if (modeConfig.enablePlanning) {
      phaseTimes[RetroPhase.PLANNING] = 0;
    }

    const execution: RetroExecution = {
      id: executionId,
      taskId: taskInput.id,
      status: RetroStatus.RUNNING,
      startTime: new Date().toISOString(),
      phase: currentPhase,
      duration: 0,
      metrics: {
        totalDuration: 0,
        phaseTimes,
        memoryUsage: process.memoryUsage ? process.memoryUsage().heapUsed : 0,
        cpuUsage: 0
      }
    };

    try {
      // 阶段1: 触发识别
      execution.phase = RetroPhase.TRIGGER;
      const triggerStart = performance.now();

      await this.performTriggerPhase(taskInput);

      const triggerTime = Math.round(performance.now() - triggerStart);
      execution.metrics.phaseTimes[RetroPhase.TRIGGER] = triggerTime;

      if (this.checkPhaseTimeout(triggerTime, RetroPhase.TRIGGER)) {
        throw new Error(`触发识别阶段超时 (${triggerTime}ms)`);
      }

      // 阶段2: 分析阶段
      execution.phase = RetroPhase.ANALYSIS;
      const analysisStart = performance.now();

      const analysisResult = await this.performAnalysisPhase(taskInput);

      const analysisTime = Math.round(performance.now() - analysisStart);
      execution.metrics.phaseTimes[RetroPhase.ANALYSIS] = analysisTime;

      if (this.checkPhaseTimeout(analysisTime, RetroPhase.ANALYSIS)) {
        throw new Error(`分析阶段超时 (${analysisTime}ms)`);
      }

      // 阶段3: 提取阶段
      execution.phase = RetroPhase.EXTRACTION;
      const extractionStart = performance.now();

      const extractionResult = await this.performExtractionPhase(taskInput, analysisResult);

      const extractionTime = Math.round(performance.now() - extractionStart);
      execution.metrics.phaseTimes[RetroPhase.EXTRACTION] = extractionTime;

      if (this.checkPhaseTimeout(extractionTime, RetroPhase.EXTRACTION)) {
        throw new Error(`提取阶段超时 (${extractionTime}ms)`);
      }

      // 阶段4: 反思阶段（仅Standard/Deep模式）
      let reflectionResult: any = null;
      if (modeConfig.enableReflection) {
        execution.phase = RetroPhase.REFLECTION;
        const reflectionStart = performance.now();

        reflectionResult = await this.performReflectionPhase(taskInput, analysisResult, extractionResult);

        const reflectionTime = Math.round(performance.now() - reflectionStart);
        execution.metrics.phaseTimes[RetroPhase.REFLECTION] = reflectionTime;

        if (this.checkPhaseTimeout(reflectionTime, RetroPhase.REFLECTION)) {
          throw new Error(`反思阶段超时 (${reflectionTime}ms)`);
        }
      }

      // 阶段5: 规划阶段（仅Deep模式）
      let planningResult: any = null;
      if (modeConfig.enablePlanning) {
        execution.phase = RetroPhase.PLANNING;
        const planningStart = performance.now();

        planningResult = await this.performPlanningPhase(taskInput, analysisResult, extractionResult, reflectionResult);

        const planningTime = Math.round(performance.now() - planningStart);
        execution.metrics.phaseTimes[RetroPhase.PLANNING] = planningTime;

        if (this.checkPhaseTimeout(planningTime, RetroPhase.PLANNING)) {
          throw new Error(`规划阶段超时 (${planningTime}ms)`);
        }
      }

      // 阶段6: 记录到MEMORY
      execution.phase = RetroPhase.STORAGE;
      const storageStart = performance.now();

      const retroRecord = await this.performStoragePhase(taskInput, analysisResult, extractionResult, reflectionResult, planningResult);

      const storageTime = Math.round(performance.now() - storageStart);
      execution.metrics.phaseTimes[RetroPhase.STORAGE] = storageTime;

      if (this.checkPhaseTimeout(storageTime, RetroPhase.STORAGE)) {
        throw new Error(`记录到MEMORY阶段超时 (${storageTime}ms)`);
      }

      // 生成复盘报告
      const report = await this.generateReport(taskInput, analysisResult, extractionResult, retroRecord, reflectionResult, planningResult);

      // 更新执行记录
      execution.endTime = new Date().toISOString();
      execution.totalDuration = Math.round(performance.now() - startTime);
      execution.duration = execution.totalDuration;
      execution.status = RetroStatus.COMPLETED;
      execution.results = {
        analysis: analysisResult,
        extraction: extractionResult,
        reflection: reflectionResult,
        planning: planningResult,
        errors
      };

      // 保存执行记录
      await this.saveExecutionRecord(execution, report);

      console.log(`✅ 复盘完成 (${this.config.type.toUpperCase()}模式) - 耗时: ${execution.totalDuration}ms`);

      return execution;

    } catch (error) {
      const errorTime = Math.round(performance.now() - startTime);
      errors.push(error instanceof Error ? error.message : String(error));

      execution.endTime = new Date().toISOString();
      execution.totalDuration = errorTime;
      execution.duration = errorTime;
      execution.status = RetroStatus.FAILED;
      execution.metrics.phaseTimes[currentPhase] = execution.metrics.phaseTimes[currentPhase] || errorTime;
      execution.results = { errors };

      console.error(`❌ 复盘失败 - 耗时: ${errorTime}ms, 错误: ${errors.join(', ')}`);

      return execution;
    }
  }

  /**
   * 执行触发识别阶段
   */
  private async performTriggerPhase(taskInput: RetroTaskInput): Promise<void> {
    const phaseStartTime = Date.now();

    console.log(`🔄 开始触发识别阶段...`);

    // 检查触发条件
    let shouldTrigger = false;
    let triggerReason = '';

    if (taskInput.triggerType === RetroTriggerType.MANUAL) {
      shouldTrigger = true;
      triggerReason = '手动触发';
    } else if (taskInput.triggerType === RetroTriggerType.AUTO) {
      // 自动触发检查
      for (const condition of this.config.triggerConditions) {
        if (condition.type === 'violation') {
          // 检查最近的违规记录
          const violations = await this.memoryStore.getRecentViolations(5);
          if (violations.length >= (condition.threshold || 1)) {
            shouldTrigger = true;
            triggerReason = `检测到${violations.length}个违规记录`;
            break;
          }
        } else if (condition.type === 'risk') {
          // 检查风险阈值
          const intent = taskInput.context.phase || '项目执行';
          const checkResult = await this.gatewayGuard.check(intent);
          const highRisks = checkResult.risks.filter(r => r.confidence >= (condition.threshold || 0.7));
          if (highRisks.length > 0) {
            shouldTrigger = true;
            triggerReason = `检测到高风险模式`;
            break;
          }
        }
      }
    }

    if (!shouldTrigger) {
      triggerReason = '未满足触发条件';
      shouldTrigger = true; // 默认继续执行
    }

    console.log(`✅ 触发识别完成 - 原因: ${triggerReason}, 耗时: ${Date.now() - phaseStartTime}ms`);
  }

  /**
   * 执行快速分析阶段
   */
  private async performAnalysisPhase(taskInput: RetroTaskInput): Promise<AnalysisResult> {
    const phaseStartTime = Date.now();

    console.log(`🔄 开始快速分析阶段...`);

    const context = this.prepareAnalysisContext(taskInput);

    // 获取原则和模式数据
    const [principles, patterns] = await Promise.all([
      this.memoryStore.getPrinciples(),
      this.memoryStore.searchPatterns(taskInput.projectId)
    ]);

    // 分析成功要素
    const successFactors = this.identifySuccessFactors(context, patterns.success);

    // 分析失败原因
    const failureReasons = this.identifyFailureReasons(context, patterns.failure);

    // 关键决策分析
    const keyDecisions = this.identifyKeyDecisions(context);

    // 生成建议
    const suggestions = this.generateAnalysisSuggestions(successFactors, failureReasons);

    const analysisResult: AnalysisResult = {
      successFactors,
      failureReasons,
      keyDecisions,
      confidence: this.calculateAnalysisConfidence(successFactors, failureReasons),
      suggestions
    };

    console.log(`✅ 快速分析完成 - 发现${successFactors.length}个成功要素, ${failureReasons.length}个失败原因, 耗时: ${Date.now() - phaseStartTime}ms`);

    return analysisResult;
  }

  /**
   * 执行关键提取阶段
   */
  private async performExtractionPhase(
    taskInput: RetroTaskInput,
    analysisResult: AnalysisResult
  ): Promise<ExtractionResult> {
    const phaseStartTime = Date.now();

    console.log(`🔄 开始关键提取阶段...`);

    // 可复用知识提取
    const reusableKnowledge = this.extractReusableKnowledge(analysisResult);

    // 改进领域识别
    const improvementAreas = this.extractImprovementAreas(analysisResult);

    // 学到教训总结
    const lessonsLearned = this.extractLessonsLearned(analysisResult);

    // 行动项生成
    const actionItems = this.generateActionItems(analysisResult);

    const extractionResult: ExtractionResult = {
      reusableKnowledge,
      improvementAreas,
      lessonsLearned,
      actionItems
    };

    console.log(`✅ 关键提取完成 - 提取${reusableKnowledge.length}个知识, ${improvementAreas.length}个改进领域, 耗时: ${Date.now() - phaseStartTime}ms`);

    return extractionResult;
  }

  /**
   * 执行反思阶段（Standard/Deep模式）
   */
  private async performReflectionPhase(
    taskInput: RetroTaskInput,
    analysisResult: AnalysisResult,
    extractionResult: ExtractionResult
  ): Promise<any> {
    const phaseStartTime = Date.now();

    console.log(`🔄 开始反思阶段...`);

    // 深度反思：审视分析结果
    const reflections = {
      rootCauseAnalysis: this.analyzeRootCauses(analysisResult),
      patternRecognition: this.recognizePatterns(analysisResult, extractionResult),
      impactAssessment: this.assessImpact(analysisResult),
      alternativeSolutions: this.generateAlternatives(analysisResult)
    };

    console.log(`✅ 反思完成 - 分析${reflections.rootCauseAnalysis.length}个根因, 识别${reflections.patternRecognition.length}个模式, 耗时: ${Date.now() - phaseStartTime}ms`);

    return reflections;
  }

  /**
   * 执行规划阶段（Deep模式）
   */
  private async performPlanningPhase(
    taskInput: RetroTaskInput,
    analysisResult: AnalysisResult,
    extractionResult: ExtractionResult,
    reflectionResult: any
  ): Promise<any> {
    const phaseStartTime = Date.now();

    console.log(`🔄 开始规划阶段...`);

    // 改进规划
    const plans = {
      shortTermActions: this.generateShortTermActions(analysisResult, extractionResult),
      mediumTermGoals: this.generateMediumTermGoals(reflectionResult),
      longTermStrategy: this.generateLongTermStrategy(reflectionResult),
      resourceAllocation: this.planResources(analysisResult),
      successMetrics: this.defineSuccessMetrics(extractionResult)
    };

    console.log(`✅ 规划完成 - 短期行动${plans.shortTermActions.length}个, 中期目标${plans.mediumTermGoals.length}个, 耗时: ${Date.now() - phaseStartTime}ms`);

    return plans;
  }

  /**
   * 执行记录到MEMORY阶段
   */
  private async performStoragePhase(
    taskInput: RetroTaskInput,
    analysisResult: AnalysisResult,
    extractionResult: ExtractionResult,
    reflectionResult?: any,
    planningResult?: any
  ): Promise<RetroRecord> {
    const phaseStartTime = Date.now();

    console.log(`🔄 开始记录到MEMORY阶段...`);

    // 创建复盘记录
    const retroRecord: RetroRecord = {
      id: `retro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: this.config.type,
      project: taskInput.projectId,
      duration: Date.now() - phaseStartTime,
      summary: this.generateSummary(analysisResult, extractionResult),
      lessons: extractionResult.lessonsLearned,
      improvements: extractionResult.improvementAreas,
      violations: analysisResult.failureReasons.filter(r => r.includes('违反'))
    };

    // 保存到MemoryStore
    await this.memoryStore.saveRetroRecord(retroRecord);

    console.log(`✅ 记录到MEMORY完成 - 保存记录: ${retroRecord.id}, 耗时: ${Date.now() - phaseStartTime}ms`);

    return retroRecord;
  }

  /**
   * 生成复盘报告
   */
  private async generateReport(
    taskInput: RetroTaskInput,
    analysisResult: AnalysisResult,
    extractionResult: ExtractionResult,
    retroRecord: RetroRecord,
    reflectionResult?: any,
    planningResult?: any
  ): Promise<RetroReport> {
    const nextSteps = [...extractionResult.actionItems];
    if (planningResult) {
      nextSteps.push(...planningResult.shortTermActions);
    }

    const report: RetroReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: taskInput.id,
      projectId: taskInput.projectId,
      type: this.config.type,
      summary: retroRecord.summary,
      insights: {
        achievements: analysisResult.successFactors,
        challenges: analysisResult.failureReasons,
        learnings: extractionResult.lessonsLearned,
        nextSteps
      },
      metrics: {
        duration: retroRecord.duration,
        quality: analysisResult.confidence,
        completeness: this.calculateCompletenessScore(analysisResult, extractionResult)
      },
      recommendations: analysisResult.suggestions,
      timestamp: new Date().toISOString()
    };

    return report;
  }

  /**
   * 保存执行记录
   */
  private async saveExecutionRecord(execution: RetroExecution, report: RetroReport): Promise<void> {
    // 这里可以扩展执行记录的保存逻辑
    console.log(`💾 保存执行记录: ${execution.id}`);
    console.log(`📊 报告摘要: ${report.summary}`);
  }

  /**
   * 检查阶段超时
   */
  private checkPhaseTimeout(actualTime: number, phase: RetroPhase): boolean {
    const maxTime = this.config.phases[phase].maxTime;
    return actualTime > maxTime;
  }

  /**
   * 准备分析上下文
   */
  private prepareAnalysisContext(taskInput: RetroTaskInput): Record<string, any> {
    return {
      project: taskInput.projectId,
      phase: taskInput.context.phase,
      history: taskInput.context.history || [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 识别成功要素
   */
  private identifySuccessFactors(context: Record<string, any>, successPatterns: any[]): string[] {
    const factors = [];

    // 基于项目类型和环境判断
    if (context.phase === '开发') {
      factors.push('代码质量良好');
      factors.push('按时交付');
    }

    if (context.phase === '测试') {
      factors.push('测试覆盖率高');
      factors.push('bug修复及时');
    }

    // 基于模式匹配
    if (successPatterns.length > 0) {
      factors.push('遵循成功模式');
    }

    return factors;
  }

  /**
   * 识别失败原因
   */
  private identifyFailureReasons(context: Record<string, any>, failurePatterns: any[]): string[] {
    const reasons = [];

    // 检查违规记录
    if (context.history) {
      const violations = context.history.filter((h: any) => h.violation);
      if (violations.length > 0) {
        reasons.push(`存在${violations.length}个原则违规`);
      }
    }

    // 基于模式匹配
    if (failurePatterns.length > 0) {
      reasons.push('存在已知失败模式');
    }

    return reasons;
  }

  /**
   * 识别关键决策
   */
  private identifyKeyDecisions(context: Record<string, any>): string[] {
    const decisions = [];

    // 基于上下文分析关键决策点
    if (context.phase) {
      decisions.push(`选择${context.phase}方案`);
    }

    if (context.history) {
      const criticalPoints = context.history.filter((h: any) => h.critical);
      criticalPoints.forEach((point: any) => {
        decisions.push(point.decision || '关键决策');
      });
    }

    return decisions;
  }

  /**
   * 生成分析建议
   */
  private generateAnalysisSuggestions(successFactors: string[], failureReasons: string[]): string[] {
    const suggestions = [];

    if (successFactors.length > 0) {
      suggestions.push('继续发扬成功要素');
    }

    if (failureReasons.length > 0) {
      suggestions.push('针对失败原因制定改进计划');
    }

    return suggestions;
  }

  /**
   * 计算分析置信度
   */
  private calculateAnalysisConfidence(successFactors: string[], failureReasons: string[]): number {
    const totalFactors = successFactors.length + failureReasons.length;
    if (totalFactors === 0) return 0.5;

    const successRatio = successFactors.length / totalFactors;
    return Math.min(1, successRatio * 1.2); // 对成功因素给予更高权重
  }

  /**
   * 提取可复用知识
   */
  private extractReusableKnowledge(analysisResult: AnalysisResult): string[] {
    const knowledge = [];

    if (analysisResult.successFactors.length > 0) {
      knowledge.push('成功模式可复用');
    }

    if (analysisResult.keyDecisions.length > 0) {
      knowledge.push('关键决策经验');
    }

    return knowledge;
  }

  /**
   * 提取改进领域
   */
  private extractImprovementAreas(analysisResult: AnalysisResult): string[] {
    const improvements = [];

    if (analysisResult.failureReasons.length > 0) {
      improvements.push('失败模式避免');
    }

    improvements.push('流程优化');
    improvements.push('质量提升');

    return improvements;
  }

  /**
   * 提取学到教训
   */
  private extractLessonsLearned(analysisResult: AnalysisResult): string[] {
    const lessons = [];

    lessons.push('持续改进');
    lessons.push('团队协作');

    return lessons;
  }

  /**
   * 生成行动项
   */
  private generateActionItems(analysisResult: AnalysisResult): string[] {
    const actions = [];

    if (analysisResult.failureReasons.length > 0) {
      actions.push('制定改进计划');
    }

    actions.push('定期复盘');
    actions.push('知识分享');

    return actions;
  }

  /**
   * 生成总结
   */
  private generateSummary(analysisResult: AnalysisResult, extractionResult: ExtractionResult): string {
    return [
      `成功要素: ${analysisResult.successFactors.length}个`,
      `失败原因: ${analysisResult.failureReasons.length}个`,
      `学到的教训: ${extractionResult.lessonsLearned.length}个`,
      `行动项: ${extractionResult.actionItems.length}个`
    ].join('; ');
  }

  /**
   * 计算完整度评分
   */
  private calculateCompletenessScore(analysisResult: AnalysisResult, extractionResult: ExtractionResult): number {
    const analysisScore = (analysisResult.successFactors.length + analysisResult.failureReasons.length) / 10;
    const extractionScore = (extractionResult.lessonsLearned.length + extractionResult.actionItems.length) / 8;

    return Math.min(1, (analysisScore + extractionScore) / 2);
  }

  // ==================== 反思阶段辅助方法 ====================

  /**
   * 分析根本原因
   */
  private analyzeRootCauses(analysisResult: AnalysisResult): string[] {
    const rootCauses = [];

    if (analysisResult.failureReasons.length > 0) {
      rootCauses.push('流程问题: 需要优化工作流程');
      rootCauses.push('沟通问题: 需要加强团队沟通');
    }

    if (analysisResult.confidence < 0.7) {
      rootCauses.push('数据不足: 需要更多上下文信息');
    }

    return rootCauses;
  }

  /**
   * 识别模式
   */
  private recognizePatterns(analysisResult: AnalysisResult, extractionResult: ExtractionResult): string[] {
    const patterns = [];

    if (analysisResult.successFactors.length > 2) {
      patterns.push('持续成功模式: 团队表现稳定');
    }

    if (extractionResult.improvementAreas.includes('流程优化')) {
      patterns.push('流程改进模式: 持续优化需求');
    }

    return patterns;
  }

  /**
   * 评估影响
   */
  private assessImpact(analysisResult: AnalysisResult): any {
    return {
      technicalImpact: analysisResult.failureReasons.length > 0 ? 'medium' : 'low',
      processImpact: 'medium',
      teamImpact: 'low'
    };
  }

  /**
   * 生成替代方案
   */
  private generateAlternatives(analysisResult: AnalysisResult): string[] {
    const alternatives = [];

    if (analysisResult.failureReasons.length > 0) {
      alternatives.push('考虑敏捷方法替代传统瀑布');
      alternatives.push('引入自动化测试降低人为错误');
    }

    return alternatives;
  }

  // ==================== 规划阶段辅助方法 ====================

  /**
   * 生成短期行动项
   */
  private generateShortTermActions(analysisResult: AnalysisResult, extractionResult: ExtractionResult): string[] {
    const actions = [...extractionResult.actionItems];

    actions.push('本周内完成问题修复');
    actions.push('更新项目文档');

    return actions;
  }

  /**
   * 生成中期目标
   */
  private generateMediumTermGoals(reflectionResult: any): string[] {
    const goals = [];

    goals.push('下季度完成流程优化');
    goals.push('建立知识库系统');

    return goals;
  }

  /**
   * 生成长期策略
   */
  private generateLongTermStrategy(reflectionResult: any): string[] {
    const strategies = [];

    strategies.push('建立持续改进文化');
    strategies.push('构建自动化复盘系统');

    return strategies;
  }

  /**
   * 规划资源分配
   */
  private planResources(analysisResult: AnalysisResult): any {
    return {
     人力资源: '2人/周',
      timeResources: '每周2小时复盘',
      toolResources: '需要项目管理工具'
    };
  }

  /**
   * 定义成功指标
   */
  private defineSuccessMetrics(extractionResult: ExtractionResult): string[] {
    const metrics = [];

    metrics.push('问题解决率 > 90%');
    metrics.push('团队满意度 > 4/5');
    metrics.push('流程效率提升 > 20%');

    return metrics;
  }

  // ==================== 公共API方法 ====================

  /**
   * 检查是否需要自动触发复盘
   */
  async shouldAutoTrigger(projectId: string): Promise<boolean> {
    if (!this.config.autoTrigger) return false;

    // 检查最近的违规记录
    const recentViolations = await this.memoryStore.getRecentViolations(5);
    const hasViolations = recentViolations.length > 0;

    // 检查最近的复盘记录
    const retros = await this.memoryStore.getRecentRetros ?
      await this.memoryStore.getRecentRetros(projectId, 3) : [];

    // 如果有违规或距离上次复盘超过一定时间，则触发
    const shouldTrigger = hasViolations || retros.length === 0;

    console.log(`自动触发检查 - 项目: ${projectId}, 违规: ${hasViolations}, 应触发: ${shouldTrigger}`);

    return shouldTrigger;
  }

  /**
   * 获取复盘统计信息
   */
  async getRetroStats(): Promise<{
    totalRetros: number;
    avgDuration: number;
    successRate: number;
    phaseDurations: Record<RetroPhase, number>;
  }> {
    // 简化的统计实现
    return {
      totalRetros: 0,
      avgDuration: 0,
      successRate: 0,
      phaseDurations: {
        [RetroPhase.TRIGGER]: 0,
        [RetroPhase.ANALYSIS]: 0,
        [RetroPhase.EXTRACTION]: 0,
        [RetroPhase.STORAGE]: 0
      }
    };
  }
}

// 导出单例
export const retrospectiveCore = new RetrospectiveCore();

// 导出类型和枚举
export { RetroMode, RetroStatus, RetroPhase, RetroTriggerType } from '../types/retrospective.js';