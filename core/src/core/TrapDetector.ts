/**
 * TrapDetector - 陷阱检测器
 * 基于高频失败模式识别常见陷阱
 */

import { FailurePattern } from '../types/index.js';
import { Trap } from '../types/checks.js';
import { MemoryStore } from './MemoryStore.js';

/**
 * 陷阱检测规则
 */
interface TrapRule {
  name: string;
  severity: '高' | '中' | '低';
  keywords: string[];
  pattern: string;
  message: string;
}

/**
 * 陷阱检测器
 *
 * @description
 * 基于高频失败模式识别常见陷阱。
 *
 * @remarks
 * 检测规则：
 * 1. 表面修复（高）: 隐藏/限制异常而非根本解决
 * 2. 语法验证即功能验证（高）: 只做语法检查不做功能测试
 * 3. 未理解用户期望（中）: 假设用户需求
 * 4. 未搜索官方资源（高）: 直接分析问题
 * 5. 重复相同操作（中）: 违反不重复失败原则
 * 6. 过度依赖自动化工具（中）: 不验证实际结果
 *
 * 同时检测历史高频失败模式（出现2次以上）。
 *
 * @example
 * ```typescript
 * const detector = new TrapDetector(memoryStore);
 *
 * const traps = await detector.detect('我隐藏了错误信息');
 *
 * // 获取高严重性陷阱
 * const highSeverity = detector.getHighSeverityTraps(traps);
 * ```
 */
export class TrapDetector {
  private memoryStore: MemoryStore;
  private rules: TrapRule[];

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
    this.rules = this.initializeRules();
  }

  /**
   * 初始化陷阱检测规则（基于9个失败模式）
   */
  private initializeRules(): TrapRule[] {
    return [
      {
        name: '表面修复',
        severity: '高',
        keywords: ['隐藏', '限制', '忽略', '跳过'],
        pattern: '(隐藏|限制|忽略).+(异常|错误|问题)',
        message: '警惕：表面修复而非根本解决。建议先问"这是根本原因还是症状？"'
      },
      {
        name: '语法验证即功能验证',
        severity: '高',
        keywords: ['语法', 'lint', '类型检查'],
        pattern: '(语法|lint|类型检查).+(通过|正确)',
        message: '警惕：语法验证≠功能验证。建议进行实际功能测试'
      },
      {
        name: '未理解用户期望',
        severity: '中',
        keywords: ['假设', '认为', '应该'],
        pattern: '(用户|应该).+(想要|期望)',
        message: '注意：确认已明确用户期望（彻底 vs 快速）'
      },
      {
        name: '未搜索官方资源',
        severity: '高',
        keywords: ['推测', '分析', '诊断'],
        pattern: '(推测|深度分析).+(问题|错误)',
        message: '警惕：未搜索官方资源直接分析。建议先用WebSearch工具'
      },
      {
        name: '重复相同操作',
        severity: '中',
        keywords: ['重试', '再次', '重复'],
        pattern: '(重试|再次).+(相同|一样)',
        message: '警告：重复相同操作违反"不重复失败"原则'
      },
      {
        name: '过度依赖自动化工具',
        severity: '中',
        keywords: ['工具', '自动', '生成'],
        pattern: '(工具|自动).+(完成|搞定)',
        message: '注意：不要过度依赖工具，要验证实际结果'
      }
    ];
  }

  /**
   * 检测任务中的陷阱
   * @param intent 任务意图描述
   * @returns 陷阱记录数组
   */
  async detect(intent: string): Promise<Trap[]> {
    const startTime = Date.now();
    const traps: Trap[] = [];

    const intentLower = intent.toLowerCase();

    // 应用所有检测规则
    for (const rule of this.rules) {
      // 关键词匹配
      const hasKeyword = rule.keywords.some(keyword =>
        intentLower.includes(keyword.toLowerCase())
      );

      // 正则模式匹配
      const patternMatch = new RegExp(rule.pattern, 'i').test(intent);

      if (hasKeyword || patternMatch) {
        traps.push({
          pattern_id: `TRAP-${rule.name}`,
          pattern_name: rule.name,
          severity: rule.severity,
          message: rule.message
        });
      }
    }

    // 从历史失败模式中查找高频陷阱
    const failurePatterns = await this.memoryStore.getFailurePatterns();
    const highFrequencyFailures = failurePatterns
      .filter(p => p.occurrences >= 2)
      .filter(p => {
        const keywords = [
          p.name,
          ...p.root_causes,
          ...p.prevention
        ].join(' ').toLowerCase();

        return intentLower.split(' ').some(word => keywords.includes(word));
      });

    for (const failure of highFrequencyFailures) {
      traps.push({
        pattern_id: failure.id,
        pattern_name: failure.name,
        severity: failure.severity,
        message: `历史陷阱：${failure.name}（出现${failure.occurrences}次）`
      });
    }

    // 去重
    const uniqueTraps = traps.reduce((acc, trap) => {
      if (!acc.some(t => t.pattern_id === trap.pattern_id)) {
        acc.push(trap);
      }
      return acc;
    }, [] as Trap[]);

    const duration = Date.now() - startTime;
    if (duration > 200) {
      console.warn(`[PERF] TrapDetector took ${duration}ms (target: <200ms)`);
    }

    return uniqueTraps;
  }

  /**
   * 获取高严重性陷阱
   */
  getHighSeverityTraps(traps: Trap[]): Trap[] {
    return traps.filter(t => t.severity === '高');
  }
}
