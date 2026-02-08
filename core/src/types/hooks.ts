/**
 * Hook系统类型定义
 * 用于在Claude Code关键事件中触发Gateway检查和复盘
 */

/**
 * Hook类型枚举
 */
export enum HookType {
  SESSION_START = 'session_start',       // 会话开始时触发
  FORMAT_REMINDER = 'format_reminder',   // 每次响应前触发
  STOP = 'stop'                          // 会话结束时触发
}

/**
 * Hook状态
 */
export enum HookStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  SKIPPED = 'skipped',
  ERROR = 'error'
}

/**
 * Hook执行结果
 */
export interface HookResult {
  hookType: HookType;
  status: HookStatus;
  executed: boolean;
  timestamp: string;
  executionTime: number;
  data?: Record<string, any>;
  error?: string;
}

/**
 * SessionStart Hook上下文
 */
export interface SessionStartContext {
  sessionId: string;
  projectId: string;
  startTime: string;
  agentType?: string;
  metadata?: Record<string, any>;
}

/**
 * SessionStart Hook结果数据
 */
export interface SessionStartData {
  projectStateLoaded: boolean;
  historicalViolations: number;
  recentRetrospectives: number;
  initialCheckResult?: {
    passed: boolean;
    warnings: number;
  };
}

/**
 * FormatReminder Hook上下文
 */
export interface FormatReminderContext {
  sessionId: string;
  responseContent: string;
  taskIntent: string;
  phase?: string;
  metadata?: Record<string, any>;
}

/**
 * FormatReminder Hook结果数据
 */
export interface FormatReminderData {
  checkPerformed: boolean;
  checkResult?: {
    status: string;
    violations: number;
    risks: number;
    traps: number;
  };
  suggestions: string[];
  shouldBlock: boolean;
}

/**
 * Stop Hook上下文
 */
export interface StopContext {
  sessionId: string;
  projectId: string;
  endTime: string;
  duration: number;
  triggerType?: 'manual' | 'auto' | 'timeout';
  metadata?: Record<string, any>;
}

/**
 * Stop Hook结果数据
 */
export interface StopData {
  retrospectiveTriggered: boolean;
  retrospectiveType?: 'quick' | 'standard' | 'deep';
  retroSummary?: string;
  lessonsCaptured: number;
  improvementsIdentified: number;
}

/**
 * Hook配置
 */
export interface HookConfig {
  enabled: boolean;
  hooks: {
    session_start: {
      enabled: boolean;
      loadProjectState: boolean;
      checkHistoricalViolations: boolean;
      maxHistoricalLookback: number; // 天数
    };
    format_reminder: {
      enabled: boolean;
      performIntentCheck: boolean;
      checkTimeout: number; // 毫秒
      blockOnHardViolation: boolean;
      maxSuggestions: number;
    };
    stop: {
      enabled: boolean;
      autoRetrospective: boolean;
      retroType: 'quick' | 'standard' | 'deep';
      minDuration: number; // 最小会话时长（毫秒）才触发复盘
      saveLearnings: boolean;
    };
  };
  performance: {
    maxExecutionTime: number; // 单个Hook最大执行时间（毫秒）
    asyncExecution: boolean;  // 是否异步执行
    retryOnFailure: boolean;
    maxRetries: number;
  };
}

/**
 * Hook执行选项
 */
export interface HookExecuteOptions {
  async?: boolean;
  timeout?: number;
  retry?: boolean;
}

/**
 * Hook统计信息
 */
export interface HookStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  executionsByType: Record<HookType, number>;
  lastExecution?: string;
}

/**
 * Hook事件监听器
 */
export type HookEventListener = (result: HookResult) => void;

/**
 * Hook中间件函数
 */
export type HookMiddleware = (
  context: any,
  next: () => Promise<HookResult>
) => Promise<HookResult>;
