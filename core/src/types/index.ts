/**
 * PRISM-Gateway 类型定义
 *
 * @description
 * 包含所有核心数据类型定义，涵盖：
 * - MEMORY层级枚举
 * - 原则相关类型
 * - 模式相关类型（成功/失败）
 * - 复盘记录类型
 * - 违规记录类型
 * - 7维度数据提取类型
 * - 简化消息格式类型
 */

/**
 * 三层MEMORY级别
 *
 * @description
 * PRISM-Gateway使用三层MEMORY架构存储不同热度的数据：
 * - HOT: 热数据，高频访问，响应时间 <100ms
 * - WARM: 温数据，中频访问，可读写
 * - COLD: 冷数据，低频访问，只读
 */
export enum MemoryLevel {
  HOT = 'level-1-hot',
  WARM = 'level-2-warm',
  COLD = 'level-3-cold'
}

/**
 * 原则定义
 *
 * @description
 * 定义PRISM-Gateway的行为准则原则
 *
 * @remarks
 * 字段说明：
 * - id: 原则ID，如"P1", "P2"
 * - name: 原则名称
 * - level: 严重性级别（MANDATORY或HARD_BLOCK）
 * - priority: 优先级（数字越大越重要）
 * - check_phases: 适用阶段列表
 * - keywords: 触发关键词列表
 * - violation_message: 违规时的提示信息
 */
export interface Principle {
  id: string;
  name: string;
  level: 'MANDATORY' | 'HARD_BLOCK';
  priority: number;
  check_phases: string[];
  keywords: string[];
  violation_message: string;
  verification_method: string;
  consequence: string;
  historical_evidence: string;
}

export interface PrinciplesData {
  version: string;
  last_updated: string;
  principles: Principle[];
}

/**
 * 成功模式定义
 *
 * @description
 * 定义成功的项目模式和最佳实践
 *
 * @remarks
 * 字段说明：
 * - id: 模式ID
 * - dimension: 所属维度
 * - maturity: 成熟度（1-5分）
 * - impact: 影响程度
 * - features: 特征列表（可选）
 * - weight: 权重分数
 */
export interface SuccessPattern {
  id: string;
  dimension: string;
  name: string;
  maturity: number;
  impact: string;
  description: string;
  features?: string[];
  effects?: string[];
  constraints?: string;
  benefits?: string[];
  weight: number;
}

export interface SuccessPatternsData {
  version: string;
  last_updated: string;
  total_patterns: number;
  dimensions: number;
  patterns: SuccessPattern[];
}

/**
 * 失败模式定义
 *
 * @description
 * 定义常见的失败模式和风险点
 *
 * @remarks
 * 字段说明：
 * - id: 模式ID
 * - name: 模式名称
 * - severity: 严重性（高/中/低）
 * - occurrences: 历史出现次数
 * - characteristic: 特征描述
 * - root_causes: 根本原因列表
 * - prevention: 预防措施列表
 */
export interface FailurePattern {
  id: string;
  name: string;
  severity: '高' | '中' | '低';
  frequency: string;
  occurrences: number;
  characteristic: string;
  root_causes: string[];
  prevention: string[];
  cases?: string[];
  user_feedback?: string;
}

export interface FailurePatternsData {
  version: string;
  last_updated: string;
  total_patterns: number;
  patterns: FailurePattern[];
}

/**
 * 复盘记录
 *
 * @description
 * 存储复盘活动的完整记录
 *
 * @remarks
 * 字段说明：
 * - id: 记录唯一ID
 * - timestamp: 复盘时间戳
 * - type: 复盘类型（quick/standard/deep）
 * - project: 项目ID
 * - duration: 复盘耗时（毫秒）
 * - summary: 复盘总结
 * - lessons: 学到的教训列表
 * - improvements: 改进领域列表
 * - violations: 违规记录列表（可选）
 */
export interface RetroRecord {
  id: string;
  timestamp: string;
  type: 'quick' | 'standard' | 'deep';
  project: string;
  duration: number;
  summary: string;
  lessons: string[];
  improvements: string[];
  violations?: string[];
}

// 违规记录
export interface ViolationRecord {
  id: string;
  timestamp: string;
  principle_id: string;
  principle_name: string;
  severity: 'BLOCK' | 'WARNING' | 'ADVISORY';
  context: string;
  action: string;
  /**
   * 误报标记（可选）
   * @description 标记此违规是否为误报
   */
  isFalsePositive?: boolean;
  /**
   * 模式匹配结果（可选）
   * @description 记录模式匹配的准确度
   */
  patternMatched?: boolean;
}

// 查询结果
export interface QueryResult {
  total: number;
  items: any[];
  query_time: number;
}

// 缓存项
export interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// 数据提取相关类型

/**
 * 对话消息
 *
 * @description
 * 表示单条对话消息
 *
 * @remarks
 * - role: 消息角色（user/assistant/system）
 * - metadata: 可选的元数据
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * 对话历史
 *
 * @description
 * 完整的对话会话历史记录
 *
 * @remarks
 * 包含多条消息和时间戳信息
 */
export interface ConversationHistory {
  id: string;
  session_id: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

/**
 * 提取的数据维度
 */
export interface ExtractedDimension {
  name: string;
  confidence: number;
  items: any[];
  evidence: string[];
}

/**
 * 原则维度 - 违反的原则
 */
export interface PrinciplesDimension extends ExtractedDimension {
  name: 'Principles';
  violations: {
    principle_id: string;
    principle_name: string;
    severity: 'MANDATORY' | 'HARD_BLOCK';
    message: string;
    context: string;
  }[];
}

/**
 * 模式维度 - 匹配的模式
 */
export interface PatternsDimension extends ExtractedDimension {
  name: 'Patterns';
  matches: {
    pattern_id: string;
    pattern_name: string;
    type: 'success' | 'failure';
    confidence: number;
    context: string;
  }[];
}

/**
 * 基准维度 - 能力评估
 */
export interface BenchmarksDimension extends ExtractedDimension {
  name: 'Benchmarks';
  assessments: {
    benchmark_id: string;
    benchmark_name: string;
    score: number;
    level: 'excellent' | 'good' | 'average' | 'poor';
    context: string;
  }[];
}

/**
 * 陷阱维度 - 识别的陷阱
 */
export interface TrapsDimension extends ExtractedDimension {
  name: 'Traps';
  detections: {
    trap_id: string;
    trap_name: string;
    severity: '高' | '中' | '低';
    context: string;
    suggestion: string;
  }[];
}

/**
 * 成功维度 - 成功要素
 */
export interface SuccessDimension extends ExtractedDimension {
  name: 'Success';
  factors: {
    factor_id: string;
    factor_name: string;
    impact: 'high' | 'medium' | 'low';
    context: string;
  }[];
}

/**
 * 工具维度 - 使用的工具
 */
export interface ToolsDimension extends ExtractedDimension {
  name: 'Tools';
  tools: {
    tool_id: string;
    tool_name: string;
    purpose: string;
    usage_context: string;
  }[];
}

/**
 * 数据维度 - 关键数据
 */
export interface DataDimension extends ExtractedDimension {
  name: 'Data';
  points: {
    data_id: string;
    data_name: string;
    category: string;
    importance: 'critical' | 'important' | 'normal';
    value: any;
    context: string;
  }[];
}

/**
 * 7维度数据提取结果
 *
 * @description
 * 数据提取的完整结果，包含所有7维度数据
 *
 * @remarks
 * 维度包括：
 * - principles: 原则维度
 * - patterns: 模式维度
 * - benchmarks: 基准维度
 * - traps: 陷阱维度
 * - success: 成功维度
 * - tools: 工具维度
 * - data: 数据维度
 *
 * 置信度范围: 0-1
 */
export interface ExtractionResult {
  id: string;
  session_id: string;
  timestamp: string;
  processing_time: number;
  dimensions: {
    principles: PrinciplesDimension;
    patterns: PatternsDimension;
    benchmarks: BenchmarksDimension;
    traps: TrapsDimension;
    success: SuccessDimension;
    tools: ToolsDimension;
    data: DataDimension;
  };
  summary: string;
  confidence: number;
}

/**
 * 数据提取器配置
 */
export interface DataExtractorConfig {
  min_confidence_threshold: number;
  max_processing_time: number;
  enable_dimension_weighting: boolean;
  context_window_size: number;
  keyword_boost_factor: number;
}

// 复盘相关类型
export {
  RetroTriggerType,
  RetroPhase,
  RetroConfig,
  RetroTriggerCondition,
  RetroTaskInput,
  AnalysisResult,
  ExtractionResult as AnalysisExtractionResult,
  RetroStatus,
  RetroExecution,
  RetroReport
} from './retrospective.js';

// 简化消息格式类型
export {
  MessageType,
  MessagePriority,
  SimpleMessage,
  MessageContent,
  ExtendedMessage,
  MessageOptions,
  MessageResponse,
  BatchMessage,
  MessageStats
} from './message.js';
