/**
 * PatternMatcher - 模式匹配器
 * 基于32个成功/失败模式进行匹配和风险识别
 */

import { SuccessPattern, FailurePattern } from '../types/index.js';
import { Risk } from '../types/checks.js';
import { MemoryStore } from './MemoryStore.js';

/**
 * 模式匹配器
 *
 * @description
 * 基于32个成功/失败模式进行匹配和风险识别。
 *
 * @remarks
 * 匹配策略：
 * 1. 从MemoryStore加载成功和失败模式
 * 2. 对每个模式计算匹配分数
 * 3. 成功模式阈值: 0.5
 * 4. 失败模式阈值: 0.6
 * 5. 按置信度排序返回结果
 *
 * 匹配算法：
 * - 当前使用简单的关键词匹配
 * - TODO: 未来可升级为向量相似度匹配
 *
 * @example
 * ```typescript
 * const matcher = new PatternMatcher(memoryStore);
 *
 * const risks = await matcher.match('实现高并发用户登录系统');
 *
 * // 过滤失败模式风险
 * const failures = matcher.getFailureRisks(risks);
 *
 * // 获取Top 3风险
 * const top3 = matcher.getTopRisks(risks, 3);
 * ```
 */
export class PatternMatcher {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * 匹配成功和失败模式
   * @param intent 任务意图描述
   * @returns 风险记录数组
   */
  async match(intent: string): Promise<Risk[]> {
    const startTime = Date.now();
    const risks: Risk[] = [];

    // 并行获取成功和失败模式
    const [successPatterns, failurePatterns] = await Promise.all([
      this.memoryStore.getSuccessPatterns(),
      this.memoryStore.getFailurePatterns()
    ]);

    const intentLower = intent.toLowerCase();

    // 匹配成功模式（正向建议）
    for (const pattern of successPatterns) {
      const score = this.calculateMatchScore(intentLower, pattern);
      if (score > 0.5) {
        risks.push({
          pattern_id: pattern.id,
          pattern_name: pattern.name,
          type: 'success',
          confidence: score,
          message: `检测到成功模式"${pattern.name}"（${pattern.dimension}），可以参考：${pattern.description}`
        });
      }
    }

    // 匹配失败模式（风险警告）
    for (const pattern of failurePatterns) {
      const score = this.calculateMatchScore(intentLower, pattern);
      if (score > 0.6) {
        risks.push({
          pattern_id: pattern.id,
          pattern_name: pattern.name,
          type: 'failure',
          confidence: score,
          message: `警告：可能触发失败模式"${pattern.name}"，特征：${pattern.characteristic}`
        });
      }
    }

    // 按置信度排序
    risks.sort((a, b) => b.confidence - a.confidence);

    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.warn(`[PERF] PatternMatcher took ${duration}ms (target: <500ms)`);
    }

    return risks;
  }

  /**
   * 计算匹配分数（简单的关键词匹配算法）
   * TODO: 未来可以升级为向量相似度匹配
   */
  private calculateMatchScore(
    intent: string,
    pattern: SuccessPattern | FailurePattern
  ): number {
    let score = 0;
    const keywords: string[] = [];

    // 从模式中提取关键词
    if ('dimension' in pattern) {
      // 成功模式
      keywords.push(pattern.dimension);
      if (pattern.features) keywords.push(...pattern.features);
      if (pattern.benefits) keywords.push(...pattern.benefits);
    } else {
      // 失败模式
      keywords.push(pattern.name);
      if (pattern.root_causes) keywords.push(...pattern.root_causes);
      if (pattern.prevention) keywords.push(...pattern.prevention);
    }

    // 计算匹配度
    let matchedCount = 0;
    for (const keyword of keywords) {
      if (intent.includes(keyword.toLowerCase())) {
        matchedCount++;
      }
    }

    // 简单的匹配算法：匹配关键词数量 / 总关键词数量
    score = keywords.length > 0 ? matchedCount / keywords.length : 0;

    return score;
  }

  /**
   * 获取Top N风险
   */
  getTopRisks(risks: Risk[], n: number = 3): Risk[] {
    return risks.slice(0, n);
  }

  /**
   * 过滤失败模式风险
   */
  getFailureRisks(risks: Risk[]): Risk[] {
    return risks.filter(r => r.type === 'failure');
  }

  /**
   * 过滤成功模式建议
   */
  getSuccessRisks(risks: Risk[]): Risk[] {
    return risks.filter(r => r.type === 'success');
  }
}
