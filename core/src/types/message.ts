/**
 * 简化消息格式定义
 *
 * @description
 * PRISM-Gateway 角色间通信的简化消息格式，将原本14个字段压缩为5个核心字段，
 * 提升易用性和理解速度，同时保持核心功能完整性。
 *
 * @design-principles
 * 1. **最小化字段**：只保留5个最核心的字段
 * 2. **语义清晰**：字段名称直观易懂
 * 3. **向后兼容**：通过可选字段保持扩展性
 * 4. **类型安全**：完整的 TypeScript 类型定义
 */

/**
 * 消息类型枚举
 *
 * @description
 * 定义消息的基本分类，简化了原有的 MessageType 枚举
 */
export enum MessageType {
  /** 请求消息 - 需要响应 */
  REQUEST = 'request',
  /** 响应消息 - 回应请求 */
  RESPONSE = 'response',
  /** 通知消息 - 单向通知 */
  NOTIFICATION = 'notification',
  /** 广播消息 - 发送给所有接收者 */
  BROADCAST = 'broadcast'
}

/**
 * 优先级枚举
 *
 * @description
 * 简化的优先级定义，只有3个级别，更容易理解和处理
 */
export enum MessagePriority {
  /** 低优先级 - 可延迟处理 */
  LOW = 'low',
  /** 普通优先级 - 正常处理顺序 */
  NORMAL = 'normal',
  /** 高优先级 - 优先处理 */
  HIGH = 'high'
}

/**
 * 简化消息接口
 *
 * @description
 * 核心消息格式，仅包含5个必要字段
 *
 * @remarks
 * 字段设计说明：
 * - id: 消息唯一标识（替代原有的 requestId 和 timestamp）
 * - from: 发送者标识（简化 from 字段，仅保留标识）
 * - to: 接收者标识（简化 to 字段，支持单个或多个）
 * - type: 消息类型（合并了原有的 type 和相关概念）
 * - content: 消息内容（合并了 subject 和 body，保持结构化）
 */
export interface SimpleMessage {
  /** 消息唯一标识符 */
  id: string;

  /** 发送者标识符（角色ID、用户ID等） */
  from: string;

  /** 接收者标识符（支持单个或多个） */
  to: string | string[];

  /** 消息类型 */
  type: MessageType;

  /** 消息内容（结构化数据） */
  content: MessageContent;
}

/**
 * 消息内容结构
 *
 * @description
 * 将原有的 subject 和 content 合并为结构化的内容对象
 */
export interface MessageContent {
  /** 标题/主题（简化的 subject） */
  title: string;

  /** 正文内容（简化的 body） */
  body: string;

  /** 数据载荷（简化的 attachments） */
  data?: any;

  /** 时间戳（简化的 timestamp） */
  timestamp?: string;
}

/**
 * 扩展消息接口（可选）
 *
 * @description
 * 在核心5个字段基础上，提供可选的扩展字段
 * 保持向后兼容性和扩展性
 */
export interface ExtendedMessage extends SimpleMessage {
  /** 优先级（新增的简化字段） */
  priority?: MessagePriority;

  /** 过期时间（可选的 expiry） */
  expiry?: string;

  /** 是否需要确认（简化的 requiresAck） */
  requiresAck?: boolean;

  /** 上下文信息（简化的 contextId 和 metadata） */
  context?: Record<string, any>;

  /** 关联任务（简化的 relatedTasks） */
  relatedTasks?: string[];
}

/**
 * 消息创建选项
 *
 * @description
 * 创建消息时的配置选项
 */
export interface MessageOptions {
  /** 是否使用扩展格式 */
  extended?: boolean;

  /** 默认优先级 */
  defaultPriority?: MessagePriority;

  /** 自动生成时间戳 */
  autoTimestamp?: boolean;
}

/**
 * 消息响应接口
 *
 * @description
 * 标准化的消息响应格式
 */
export interface MessageResponse {
  /** 原始消息ID */
  originalId: string;

  /** 响应状态 */
  status: 'success' | 'error' | 'pending';

  /** 响应内容 */
  content: MessageContent;

  /** 错误信息（如果失败） */
  error?: string;

  /** 响应时间戳 */
  timestamp: string;
}

/**
 * 批量消息接口
 *
 * @description
 * 支持批量处理多个消息
 */
export interface BatchMessage {
  /** 批量消息ID */
  batchId: string;

  /** 消息列表 */
  messages: SimpleMessage[];

  /** 批量处理选项 */
  options?: MessageOptions;
}

/**
 * 消息统计信息
 *
 * @description
 * 消息处理的统计和监控数据
 */
export interface MessageStats {
  /** 总消息数 */
  total: number;

  /** 成功处理数 */
  success: number;

  /** 失败处理数 */
  failed: number;

  /** 平均处理时间（毫秒） */
  averageProcessingTime: number;

  /** 按类型统计 */
  byType: Record<MessageType, number>;

  /** 按优先级统计 */
  byPriority: Record<MessagePriority, number>;
}