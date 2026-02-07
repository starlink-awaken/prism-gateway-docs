/**
 * Gateway检查相关类型定义
 *
 * @description
 * 包含Gateway违规检查系统使用的所有类型定义
 */

/**
 * 检查状态
 *
 * @description
 * Gateway检查的三种可能结果
 *
 * @remarks
 * - PASS: 检查通过，可以继续
 * - WARNING: 有警告，需要注意但可继续
 * - BLOCKED: 被阻止，必须处理问题后才能继续
 */
export enum CheckStatus {
  PASS = 'PASS',
  WARNING = 'WARNING',
  BLOCKED = 'BLOCKED'
}

/**
 * 违规记录
 *
 * @description
 * 表示一次原则违规记录
 *
 * @remarks
 * - severity: 'MANDATORY'表示必须遵守，'HARD_BLOCK'表示立即阻断
 */
export interface Violation {
  principle_id: string;
  principle_name: string;
  severity: 'MANDATORY' | 'HARD_BLOCK';
  message: string;
  detected_at: string;
}

/**
 * 风险记录
 */
export interface Risk {
  pattern_id: string;
  pattern_name: string;
  type: 'success' | 'failure';
  confidence: number;
  message: string;
}

/**
 * 陷阱记录
 */
export interface Trap {
  pattern_id: string;
  pattern_name: string;
  severity: '高' | '中' | '低';
  message: string;
}

/**
 * 建议记录
 */
export interface Suggestion {
  type: 'action' | 'consideration';
  message: string;
  priority: number;
}

/**
 * 检查结果
 *
 * @description
 * Gateway检查的完整结果
 *
 * @remarks
 * 包含所有检查维度的结果：
 * - violations: 原则违规列表
 * - risks: 模式风险列表
 * - traps: 陷阱列表
 * - suggestions: 建议列表
 * - check_time: 检查耗时（毫秒）
 */
export interface CheckResult {
  status: CheckStatus;
  violations: Violation[];
  risks: Risk[];
  traps: Trap[];
  suggestions: Suggestion[];
  check_time: number;
  timestamp: string;
}

/**
 * 检查上下文
 */
export interface CheckContext {
  phase?: string;
  history?: Violation[];
  user_preferences?: Record<string, any>;
}
