/**
 * PrincipleChecker - 原则检查器
 * 基于5大MANDATORY行为准则进行实时检查
 */

import { Principle } from '../types/index.js';
import { Violation, CheckStatus } from '../types/checks.js';
import { MemoryStore } from './MemoryStore.js';

/**
 * 原则检查器
 *
 * @description
 * 基于5大MANDATORY行为准则进行实时检查。
 *
 * @remarks
 * 检查原则：
 * - P1: 未搜索官方资源直接分析/编码
 * - P2: 语法验证即功能验证
 * - P3: 重复相同的失败操作
 * - P4: 隐藏/限制异常/错误/问题
 * - P5: 未理解用户期望就动手
 *
 * 检查策略：
 * 1. 匹配原则关键词
 * 2. 检查阶段是否匹配
 * 3. HARD_BLOCK违规立即返回
 * 4. 违规时提供针对性建议
 *
 * @example
 * ```typescript
 * const checker = new PrincipleChecker(memoryStore);
 *
 * // 检查完整意图
 * const violations = await checker.check('实现登录功能', { phase: '开发' });
 *
 * // 检查单个原则
 * const violation = await checker.checkPrinciple('实现登录功能', 'P1');
 *
 * // 生成建议
 * if (violations.length > 0) {
 *   const suggestions = checker.generateSuggestions(violations);
 *   console.log(suggestions);
 * }
 * ```
 */
export class PrincipleChecker {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * 检查任务意图是否违反原则
   * @param intent 任务意图描述
   * @param context 检查上下文
   * @returns 违规记录数组（空数组表示无违规）
   */
  async check(intent: string, context?: { phase?: string }): Promise<Violation[]> {
    const startTime = Date.now();
    const violations: Violation[] = [];

    // 获取所有原则
    const principles = await this.memoryStore.getPrinciples();

    // 检查每个原则
    for (const principle of principles) {
      // 检查阶段是否匹配
      if (context?.phase && !principle.check_phases.includes(context.phase)) {
        continue;
      }

      // 检查关键词匹配
      const hasKeyword = principle.keywords.some(keyword =>
        intent.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasKeyword) {
        violations.push({
          principle_id: principle.id,
          principle_name: principle.name,
          severity: principle.level,
          message: principle.violation_message,
          detected_at: new Date().toISOString()
        });

        // HARD_BLOCK立即返回（阻断性违规）
        if (principle.level === 'HARD_BLOCK') {
          break;
        }
      }
    }

    const duration = Date.now() - startTime;
    if (duration > 300) {
      console.warn(`[PERF] PrincipleChecker took ${duration}ms (target: <300ms)`);
    }

    return violations;
  }

  /**
   * 检查单个原则
   */
  async checkPrinciple(
    intent: string,
    principleId: string
  ): Promise<Violation | null> {
    const principle = await this.memoryStore.getPrincipleById(principleId);
    if (!principle) return null;

    const hasKeyword = principle.keywords.some(keyword =>
      intent.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasKeyword) {
      return {
        principle_id: principle.id,
        principle_name: principle.name,
        severity: principle.level,
        message: principle.violation_message,
        detected_at: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * 生成建议
   */
  generateSuggestions(violations: Violation[]): string[] {
    return violations.map(v => {
      switch (v.principle_id) {
        case 'P1':
          return '建议：先使用WebSearch工具搜索官方资源和已知问题';
        case 'P2':
          return '建议：进行实际功能测试，不要只依赖语法验证';
        case 'P3':
          return '警告：重复失败会触发强制阻断，请立即调整策略';
        case 'P4':
          return '建议：调查数据异常的根本原因，不要隐藏异常';
        case 'P5':
          return '建议：明确用户期望（彻底解决 vs 快速修复）';
        default:
          return '建议：参考行为准则文档';
      }
    });
  }
}
