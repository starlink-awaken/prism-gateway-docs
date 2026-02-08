/**
 * 消息格式迁移工具
 *
 * @description
 * 提供 ComplexMessage 到 SimpleMessage 的迁移功能，
 * 确保向后兼容和平滑过渡。
 */

import {
  SimpleMessage,
  ExtendedMessage,
  MessageContent,
  MessageType,
  MessagePriority
} from '../types/message';

// 假设的原始 ComplexMessage 类型（用于迁移）
interface ComplexMessage {
  from: string;
  to: string | string[];
  type: string; // 原始的类型枚举
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  body: string;
  attachments?: any[];
  timestamp: string;
  requestId: string;
  contextId?: string;
  metadata?: Record<string, any>;
  expiry?: string;
  requiresAck: boolean;
  relatedTasks?: string[];
}

// 原始 MessageType 枚举映射
const MESSAGE_TYPE_MAPPING: Record<string, MessageType> = {
  'REQUEST': MessageType.REQUEST,
  'RESPONSE': MessageType.RESPONSE,
  'NOTIFICATION': MessageType.NOTIFICATION,
  'BROADCAST': MessageType.BROADCAST,
  'QUERY': MessageType.REQUEST,
  'RESULT': MessageType.RESPONSE,
  'ALERT': MessageType.NOTIFICATION
};

// 优先级映射
const PRIORITY_MAPPING: Record<string, MessagePriority> = {
  'low': MessagePriority.LOW,
  'medium': MessagePriority.NORMAL,
  'high': MessagePriority.HIGH,
  'urgent': MessagePriority.HIGH
};

/**
 * 将 ComplexMessage 转换为 SimpleMessage
 */
export function convertToSimpleMessage(complex: ComplexMessage): SimpleMessage {
  return {
    id: complex.requestId || generateMessageId(),
    from: complex.from,
    to: complex.to,
    type: MESSAGE_TYPE_MAPPING[complex.type] || MessageType.REQUEST,
    content: convertContent(complex)
  };
}

/**
 * 将 ComplexMessage 转换为 ExtendedMessage
 */
export function convertToExtendedMessage(complex: ComplexMessage): ExtendedMessage {
  const simple = convertToSimpleMessage(complex);

  return {
    ...simple,
    priority: PRIORITY_MAPPING[complex.priority] || MessagePriority.NORMAL,
    expiry: complex.expiry,
    requiresAck: complex.requiresAck,
    context: {
      ...(complex.contextId ? { contextId: complex.contextId } : {}),
      ...complex.metadata
    },
    relatedTasks: complex.relatedTasks
  };
}

/**
 * 转换消息内容
 */
function convertContent(complex: ComplexMessage): MessageContent {
  return {
    title: complex.subject,
    body: complex.body,
    data: complex.attachments || {},
    timestamp: complex.timestamp
  };
}

/**
 * 批量转换消息
 */
export function convertMessages(
  messages: ComplexMessage[],
  useExtended: boolean = false
): (SimpleMessage | ExtendedMessage)[] {
  return messages.map(msg =>
    useExtended ? convertToExtendedMessage(msg) : convertToSimpleMessage(msg)
  );
}

/**
 * 生成消息ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 验证消息格式
 */
export function validateMessage(message: SimpleMessage | ExtendedMessage): boolean {
  if (!message.id || !message.from || !message.to || !message.type || !message.content) {
    return false;
  }

  if (!message.content.title || !message.content.body) {
    return false;
  }

  return true;
}

/**
 * 验证批量消息
 */
export function validateBatchMessage(batch: { messages: (SimpleMessage | ExtendedMessage)[] }): boolean {
  if (!batch.messages || !Array.isArray(batch.messages)) {
    return false;
  }

  return batch.messages.every(msg => validateMessage(msg));
}

/**
 * 获取消息统计
 */
export function getMessageStats(messages: (SimpleMessage | ExtendedMessage)[]) {
  const stats = {
    total: messages.length,
    valid: 0,
    invalid: 0,
    byType: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
    averageLength: 0
  };

  let totalLength = 0;

  messages.forEach(msg => {
    if (validateMessage(msg)) {
      stats.valid++;
    } else {
      stats.invalid++;
    }

    // 统计类型
    const typeKey = msg.type;
    stats.byType[typeKey] = (stats.byType[typeKey] || 0) + 1;

    // 统计优先级（仅 ExtendedMessage）
    if ('priority' in msg && msg.priority) {
      const priorityKey = msg.priority;
      stats.byPriority[priorityKey] = (stats.byPriority[priorityKey] || 0) + 1;
    }

    // 计算平均长度
    const contentLength = JSON.stringify(msg).length;
    totalLength += contentLength;
  });

  stats.averageLength = totalLength / messages.length;

  return stats;
}

/**
 * 消息格式兼容性检查
 */
export function checkCompatibility(messages: ComplexMessage[]): {
  compatible: number;
  needsConversion: number;
  errors: string[];
} {
  const result = {
    compatible: 0,
    needsConversion: 0,
    errors: [] as string[]
  };

  messages.forEach((msg, index) => {
    try {
      // 检查必需字段
      if (!msg.requestId) {
        result.needsConversion++;
        result.errors.push(`Message ${index}: Missing requestId`);
      } else {
        result.compatible++;
      }
    } catch (error) {
      result.errors.push(`Message ${index}: ${error}`);
    }
  });

  return result;
}

/**
 * 创建迁移报告
 */
export function createMigrationReport(
  originalMessages: ComplexMessage[],
  convertedMessages: (SimpleMessage | ExtendedMessage)[],
  options: {
    useExtended?: boolean;
    validate?: boolean;
  } = {}
): {
  summary: {
    originalCount: number;
    convertedCount: number;
    success: boolean;
    errors: number;
  };
  statistics: ReturnType<typeof getMessageStats>;
  compatibility: ReturnType<typeof checkCompatibility>;
  sample: {
    original: ComplexMessage;
    converted: SimpleMessage | ExtendedMessage;
  };
} {
  const { useExtended = false, validate = true } = options;

  // 转换消息
  const converted = convertMessages(originalMessages, useExtended);

  // 验证结果
  const validation = validate ? validateBatchMessage({ messages: converted }) : true;

  // 生成统计
  const stats = getMessageStats(converted);

  // 兼容性检查
  const compatibility = checkCompatibility(originalMessages);

  return {
    summary: {
      originalCount: originalMessages.length,
      convertedCount: converted.length,
      success: validation && compatibility.errors.length === 0,
      errors: compatibility.errors.length
    },
    statistics: stats,
    compatibility: compatibility,
    sample: {
      original: originalMessages[0],
      converted: converted[0]
    }
  };
}

/**
 * 导出迁移结果
 */
export function exportMigratedMessages(
  messages: (SimpleMessage | ExtendedMessage)[],
  format: 'json' | 'csv' = 'json'
): string {
  if (format === 'json') {
    return JSON.stringify(messages, null, 2);
  }

  // CSV 格式
  const headers = ['id', 'from', 'to', 'type', 'title', 'body', 'timestamp'];
  const rows = messages.map(msg => [
    msg.id,
    msg.from,
    Array.isArray(msg.to) ? msg.to.join(';') : msg.to,
    msg.type,
    msg.content.title,
    msg.content.body,
    msg.content.timestamp || ''
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}