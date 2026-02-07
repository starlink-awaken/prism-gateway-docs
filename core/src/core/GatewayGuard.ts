/**
 * GatewayGuard - Gateway违规检查引擎
 * 整合三层检查：原则 → 模式 → 陷阱
 */

import { CheckStatus, CheckResult, CheckContext, Suggestion } from '../types/checks.js';
import { MemoryStore } from './MemoryStore.js';
import { PrincipleChecker } from './PrincipleChecker.js';
import { PatternMatcher } from './PatternMatcher.js';
import { TrapDetector } from './TrapDetector.js';

/**
 * GatewayGuard核心类
 *
 * @description
 * GatewayGuard是PRISM-Gateway的违规检查引擎，整合三层检查机制：
 * - 第1层：原则检查（MANDATORY）- 基于5大行为准则进行强制检查
 * - 第2层：模式匹配（WARNING）- 识别成功/失败模式
 * - 第3层：陷阱识别（ADVISORY）- 检测常见陷阱
 *
 * @remarks
 * 检查流程：
 * 1. 首先执行原则检查，发现HARD_BLOCK违规立即返回
 * 2. 如果没有HARD_BLOCK，执行模式匹配检查
 * 3. 如果有高置信度失败模式（>0.7），返回WARNING
 * 4. 最后执行陷阱检测，提供ADVISORY级别建议
 *
 * @example
 * ```typescript
 * const guard = new GatewayGuard();
 * const result = await guard.check('实现用户登录功能');
 *
 * if (result.status === CheckStatus.BLOCKED) {
 *   console.log('任务被阻止:', result.violations);
 * } else if (result.status === CheckStatus.WARNING) {
 *   console.log('需要注意:', result.risks);
 * } else {
 *   console.log('检查通过');
 * }
 * ```
 */
export class GatewayGuard {
  private memoryStore: MemoryStore;
  private principleChecker: PrincipleChecker;
  private patternMatcher: PatternMatcher;
  private trapDetector: TrapDetector;

  constructor(memoryStore?: MemoryStore) {
    this.memoryStore = memoryStore || new MemoryStore();
    this.principleChecker = new PrincipleChecker(this.memoryStore);
    this.patternMatcher = new PatternMatcher(this.memoryStore);
    this.trapDetector = new TrapDetector(this.memoryStore);
  }

  /**
   * 检查任务意图
   *
   * @param intent - 任务意图描述，如"实现用户登录功能"
   * @param context - 可选的检查上下文，包括阶段、历史记录等
   * @returns 完整的检查结果，包含状态、违规、风险、陷阱和建议
   *
   * @example
   * ```typescript
   * const result = await guard.check('修复登录bug', {
   *   phase: '开发',
   *   history: [],
   *   user_preferences: { strict: true }
   * });
   * ```
   */
  async check(intent: string, context?: CheckContext): Promise<CheckResult> {
    const startTime = Date.now();

    // 空字符串直接返回PASS
    if (!intent || intent.trim().length === 0) {
      return {
        status: CheckStatus.PASS,
        violations: [],
        risks: [],
        traps: [],
        suggestions: [],
        check_time: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }

    // 第1层：原则检查（MANDATORY）
    const violations = await this.principleChecker.check(intent, context);

    // 如果有HARD_BLOCK违规，立即返回
    const hasHardBlock = violations.some(v => v.severity === 'HARD_BLOCK');
    if (hasHardBlock) {
      return {
        status: CheckStatus.BLOCKED,
        violations,
        risks: [],
        traps: [],
        suggestions: this.generateSuggestions(violations, []),
        check_time: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }

    // 第2层：模式匹配（WARNING）
    const risks = await this.patternMatcher.match(intent);

    // 如果有高置信度失败模式，返回WARNING
    const highConfidenceFailures = risks.filter(
      r => r.type === 'failure' && r.confidence > 0.7
    );
    if (highConfidenceFailures.length > 0) {
      return {
        status: CheckStatus.WARNING,
        violations,
        risks: highConfidenceFailures,
        traps: [],
        suggestions: this.generateSuggestions(violations, highConfidenceFailures),
        check_time: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }

    // 第3层：陷阱识别（ADVISORY）
    const traps = await this.trapDetector.detect(intent);

    // 总体检查时间
    const checkTime = Date.now() - startTime;

    // 性能警告
    if (checkTime > 1000) {
      console.error(`[PERF] GatewayGuard took ${checkTime}ms (target: <1000ms)`);
    }

    // 决定最终状态
    let status: CheckStatus;
    if (violations.length > 0) {
      status = CheckStatus.WARNING;
    } else if (traps.some(t => t.severity === '高')) {
      status = CheckStatus.WARNING;
    } else {
      status = CheckStatus.PASS;
    }

    return {
      status,
      violations,
      risks,
      traps,
      suggestions: this.generateSuggestions(violations, risks),
      check_time: checkTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 快速检查（仅原则检查，用于性能敏感场景）
   *
   * @param intent - 任务意图描述
   * @returns 如果没有HARD_BLOCK违规返回true，否则返回false
   *
   * @remarks
   * 此方法仅执行原则检查，不进行模式匹配和陷阱检测，
   * 适用于高频调用的场景。
   *
   * @example
   * ```typescript
   * if (await guard.quickCheck('简单任务')) {
   *   // 继续执行
   * }
   * ```
   */
  async quickCheck(intent: string): Promise<boolean> {
    const violations = await this.principleChecker.check(intent);
    return !violations.some(v => v.severity === 'HARD_BLOCK');
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    violations: any[],
    risks: any[]
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // 基于违规生成建议
    if (violations.length > 0) {
      const principleSuggestions = this.principleChecker.generateSuggestions(violations);
      principleSuggestions.forEach((msg, idx) => {
        suggestions.push({
          type: violations[idx].severity === 'HARD_BLOCK' ? 'action' : 'consideration',
          message: msg,
          priority: violations[idx].severity === 'HARD_BLOCK' ? 1 : 2
        });
      });
    }

    // 基于风险生成建议
    if (risks.length > 0) {
      const failureRisks = risks.filter(r => r.type === 'failure');
      if (failureRisks.length > 0) {
        suggestions.push({
          type: 'consideration',
          message: `检测到${failureRisks.length}个失败模式风险，建议参考历史案例调整策略`,
          priority: 2
        });
      }
    }

    return suggestions;
  }

  /**
   * 格式化检查结果为人类可读文本
   *
   * @param result - 检查结果对象
   * @returns 格式化的Markdown文本
   *
   * @example
   * ```typescript
   * const result = await guard.check('任务描述');
   * console.log(guard.formatResult(result));
   * ```
   */
  formatResult(result: CheckResult): string {
    const lines: string[] = [];

    // 状态
    const statusIcon = {
      [CheckStatus.PASS]: '✅',
      [CheckStatus.WARNING]: '⚠️',
      [CheckStatus.BLOCKED]: '🚫'
    };
    lines.push(`${statusIcon[result.status]} Gateway检查结果：${result.status}`);
    lines.push(`检查耗时：${result.check_time}ms`);
    lines.push('');

    // 违规
    if (result.violations.length > 0) {
      lines.push('**违规：**');
      result.violations.forEach(v => {
        lines.push(`- [${v.principle_id}] ${v.principle_name}`);
        lines.push(`  ${v.message}`);
      });
      lines.push('');
    }

    // 风险
    if (result.risks.length > 0) {
      lines.push('**风险：**');
      result.risks.slice(0, 3).forEach(r => {
        lines.push(`- [${r.pattern_id}] ${r.pattern_name}（置信度：${(r.confidence * 100).toFixed(0)}%）`);
      });
      lines.push('');
    }

    // 陷阱
    if (result.traps.length > 0) {
      lines.push('**陷阱：**');
      result.traps.forEach(t => {
        lines.push(`- [${t.severity}] ${t.pattern_name}`);
        lines.push(`  ${t.message}`);
      });
      lines.push('');
    }

    // 建议
    if (result.suggestions.length > 0) {
      lines.push('**建议：**');
      result.suggestions.forEach(s => {
        lines.push(`- ${s.message}`);
      });
    }

    return lines.join('\n');
  }
}

// 导出单例
export const gatewayGuard = new GatewayGuard();
