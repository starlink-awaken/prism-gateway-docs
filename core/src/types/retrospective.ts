/**
 * 复盘相关类型定义
 */

/**
 * 复盘触发方式
 */
export enum RetroTriggerType {
  AUTO = 'auto',
  MANUAL = 'manual',
  SCHEDULED = 'scheduled'
}

/**
 * 复盘模式
 */
export enum RetroMode {
  QUICK = 'quick',       // 5分钟快速复盘
  STANDARD = 'standard', // 25分钟标准复盘
  DEEP = 'deep'         // 60分钟深度复盘
}

/**
 * 复盘阶段
 */
export enum RetroPhase {
  TRIGGER = 'trigger',        // 触发识别
  ANALYSIS = 'analysis',      // 分析阶段
  EXTRACTION = 'extraction',  // 提取阶段
  STORAGE = 'storage',        // 记录到MEMORY
  REFLECTION = 'reflection',  // 反思阶段（Standard/Deep）
  PLANNING = 'planning'       // 规划阶段（Deep）
}

/**
 * 各模式配置
 */
export interface RetroPhaseConfig {
  maxTime: number;        // 最大执行时间（毫秒）
  description: string;    // 阶段描述
}

export interface RetroModeConfig {
  type: RetroMode;
  maxDuration: number;    // 最大执行时间（毫秒）
  phases: {
    trigger: RetroPhaseConfig;
    analysis: RetroPhaseConfig;
    extraction: RetroPhaseConfig;
    storage: RetroPhaseConfig;
    reflection?: RetroPhaseConfig;  // Standard/Deep模式
    planning?: RetroPhaseConfig;    // Deep模式
  };
  analysisDepth: 'shallow' | 'medium' | 'deep';
  enableReflection: boolean;
  enablePlanning: boolean;
}

/**
 * 复盘配置
 */
export interface RetroConfig {
  type: RetroMode;
  maxDuration: number;        // 最大执行时间（毫秒）
  phases: {
    trigger: { maxTime: number };
    analysis: { maxTime: number };
    extraction: { maxTime: number };
    storage: { maxTime: number };
    reflection?: { maxTime: number };
    planning?: { maxTime: number };
  };
  autoTrigger: boolean;
  triggerConditions: RetroTriggerCondition[];
  modeConfig: RetroModeConfig;
}

/**
 * 复盘触发条件
 */
export interface RetroTriggerCondition {
  type: 'violation' | 'risk' | 'milestone' | 'manual';
  threshold?: number;
  patterns?: string[];
}

/**
 * 复盘任务输入
 */
export interface RetroTaskInput {
  id: string;
  projectId: string;
  triggerType: RetroTriggerType;
  context: {
    phase?: string;
    history?: any[];
    user_preferences?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  successFactors: string[];
  failureReasons: string[];
  keyDecisions: string[];
  confidence: number;
  suggestions: string[];
}

/**
 * 关键提取结果
 */
export interface ExtractionResult {
  reusableKnowledge: string[];
  improvementAreas: string[];
  lessonsLearned: string[];
  actionItems: string[];
}

/**
 * 复盘执行状态
 */
export enum RetroStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

/**
 * 复盘执行记录
 */
export interface RetroExecution {
  id: string;
  taskId: string;
  status: RetroStatus;
  startTime: string;
  endTime?: string;
  phase: RetroPhase;
  duration: number;
  results?: {
    analysis?: AnalysisResult;
    extraction?: ExtractionResult;
    errors?: string[];
  };
  metrics: {
    totalDuration: number;
    phaseTimes: Record<RetroPhase, number>;
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * 复盘报告
 */
export interface RetroReport {
  id: string;
  taskId: string;
  projectId: string;
  type: 'quick' | 'standard' | 'deep';
  summary: string;
  insights: {
    achievements: string[];
    challenges: string[];
    learnings: string[];
    nextSteps: string[];
  };
  metrics: {
    duration: number;
    quality: number;
    completeness: number;
  };
  recommendations: string[];
  timestamp: string;
}