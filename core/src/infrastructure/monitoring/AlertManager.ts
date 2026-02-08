/**
 * AlertManager - 告警管理模块
 *
 * @description
 * 轻量级告警系统，提供：
 * - 告警规则配置
 * - 自动规则评估
 * - 告警去重和节流
 * - 告警通知回调
 * - 告警历史记录
 *
 * @features
 * - 多种告警条件（错误率、响应时间、速率限制、缓存命中率）
 * - 可配置的严重级别（INFO/WARNING/CRITICAL）
 * - 冷却时间防止告警风暴
 * - 自动恢复检测
 *
 * @example
 * ```ts
 * import { AlertManager, AlertSeverity } from './AlertManager.js';
 * import { Metrics } from './Metrics.js';
 *
 * const metrics = new Metrics({ prefix: 'prism' });
 * const alertManager = new AlertManager({
 *   metrics,
 *   onAlert: (alert) => console.log('ALERT:', alert)
 * });
 *
 * // 添加告警规则
 * alertManager.addRule({
 *   id: 'error-rate',
 *   name: 'High Error Rate',
 *   condition: AlertCondition.ERROR_RATE_HIGH,
 *   threshold: 0.05,
 *   severity: AlertSeverity.WARNING
 * });
 *
 * // 评估规则
 * alertManager.evaluateRules();
 * ```
 *
 * @module infrastructure/monitoring
 */

import { Metrics } from './Metrics.js';

/**
 * 告警严重级别
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * 告警状态
 */
export enum AlertStatus {
  OK = 'ok',
  FIRING = 'firing',
  RESOLVED = 'resolved'
}

/**
 * 告警条件类型
 */
export enum AlertCondition {
  /** 错误率过高 */
  ERROR_RATE_HIGH = 'error_rate_high',
  /** 响应时间过慢 */
  RESPONSE_TIME_SLOW = 'response_time_slow',
  /** 速率限制频繁触发 */
  RATE_LIMIT_HIGH = 'rate_limit_high',
  /** 缓存命中率过低 */
  CACHE_HIT_RATE_LOW = 'cache_hit_rate_low',
  /** 服务不可用 */
  SERVICE_DOWN = 'service_down'
}

/**
 * 告警规则
 */
export interface AlertRule {
  /** 规则唯一标识 */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description?: string;
  /** 触发条件 */
  condition: AlertCondition;
  /** 阈值 */
  threshold: number;
  /** 严重级别 */
  severity: AlertSeverity;
  /** 百分位数（用于响应时间告警） */
  percentile?: number;
  /** 时间窗口（毫秒） */
  windowMs?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 标签 */
  labels?: Record<string, string>;
}

/**
 * 告警事件
 */
export interface AlertEvent {
  /** 规则 ID */
  ruleId: string;
  /** 规则名称 */
  ruleName: string;
  /** 告警级别 */
  severity: AlertSeverity;
  /** 告警状态 */
  status: AlertStatus;
  /** 触发条件 */
  condition: AlertCondition;
  /** 当前值 */
  value: number;
  /** 阈值 */
  threshold: number;
  /** 告警消息 */
  message: string;
  /** 时间戳 */
  timestamp: Date;
  /** 标签 */
  labels?: Record<string, string>;
}

/**
 * 告警配置选项
 */
export interface AlertManagerOptions {
  /** 指标收集器 */
  metrics: Metrics;
  /** 告警回调 */
  onAlert?: (alert: AlertEvent) => void;
  /** 冷却时间（毫秒） */
  cooldown?: number;
  /** 最大历史记录数 */
  maxHistory?: number;
  /** 评估间隔（毫秒） */
  evaluationInterval?: number;
  /** 是否初始化默认规则 */
  initializeDefaultRules?: boolean;
}

/**
 * 告警历史记录
 */
interface AlertHistoryEntry {
  alert: AlertEvent;
  firedAt: Date;
  resolvedAt?: Date;
}

/**
 * 规则状态跟踪
 */
interface RuleState {
  status: AlertStatus;
  lastFiredAt?: Date;
  lastNotifiedAt?: Date;
}

/**
 * AlertManager - 告警管理器
 *
 * @description
 * 主要的告警管理类，负责规则管理和告警触发
 */
export class AlertManager {
  readonly metrics: Metrics;
  readonly onAlert?: (alert: AlertEvent) => void;
  readonly cooldown: number;
  readonly maxHistory: number;

  private readonly rules: Map<string, AlertRule> = new Map();
  private readonly ruleStates: Map<string, RuleState> = new Map();
  private readonly alertHistory: Map<string, AlertHistoryEntry[]> = new Map();

  constructor(options: AlertManagerOptions) {
    this.metrics = options.metrics;
    this.onAlert = options.onAlert;
    this.cooldown = options.cooldown ?? 60000; // 默认 1 分钟
    this.maxHistory = options.maxHistory ?? 100;

    // 添加默认规则（除非明确禁用）
    if (options.initializeDefaultRules !== false) {
      this.initializeDefaultRules();
    }
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultRules(): void {
    // 错误率告警
    this.addRule({
      id: 'default-error-rate',
      name: 'High Error Rate',
      description: '错误率超过 5% 时触发',
      condition: AlertCondition.ERROR_RATE_HIGH,
      threshold: 0.05,
      severity: AlertSeverity.WARNING,
      windowMs: 60000
    });

    // 响应时间告警
    this.addRule({
      id: 'default-response-time',
      name: 'Slow Response Time',
      description: 'P95 响应时间超过 100ms 时触发',
      condition: AlertCondition.RESPONSE_TIME_SLOW,
      threshold: 100,
      severity: AlertSeverity.CRITICAL,
      percentile: 95
    });

    // 速率限制告警
    this.addRule({
      id: 'default-rate-limit',
      name: 'Rate Limit Exceeded',
      description: '速率限制触发超过 10 次时告警',
      condition: AlertCondition.RATE_LIMIT_HIGH,
      threshold: 10,
      severity: AlertSeverity.WARNING,
      windowMs: 300000 // 5 分钟窗口
    });

    // 缓存命中率告警
    this.addRule({
      id: 'default-cache-hit-rate',
      name: 'Low Cache Hit Rate',
      description: '缓存命中率低于 80% 时触发',
      condition: AlertCondition.CACHE_HIT_RATE_LOW,
      threshold: 0.8,
      severity: AlertSeverity.INFO
    });
  }

  /**
   * 添加告警规则
   *
   * @param rule - 告警规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    if (!this.ruleStates.has(rule.id)) {
      this.ruleStates.set(rule.id, { status: AlertStatus.OK });
    }
  }

  /**
   * 获取所有规则
   *
   * @returns 规则数组
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取单个规则
   *
   * @param id - 规则 ID
   * @returns 规则或 undefined
   */
  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  /**
   * 更新规则
   *
   * @param id - 规则 ID
   * @param updates - 更新内容
   */
  updateRule(id: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(id);
    if (rule) {
      const updated = { ...rule, ...updates };
      this.rules.set(id, updated);
    }
  }

  /**
   * 删除规则
   *
   * @param id - 规则 ID
   */
  removeRule(id: string): void {
    this.rules.delete(id);
    this.ruleStates.delete(id);
    this.alertHistory.delete(id);
  }

  /**
   * 获取规则状态
   *
   * @param id - 规则 ID
   * @returns 规则状态
   */
  getAlertStatus(id: string): AlertStatus {
    const state = this.ruleStates.get(id);
    return state?.status ?? AlertStatus.OK;
  }

  /**
   * 评估所有规则
   *
   * @returns 触发的告警数量
   */
  evaluateRules(): number {
    let firedCount = 0;

    for (const rule of this.rules.values()) {
      if (rule.enabled !== false) {
        const fired = this.evaluateRule(rule);
        if (fired) {
          firedCount++;
        }
      }
    }

    return firedCount;
  }

  /**
   * 评估单个规则
   *
   * @param rule - 告警规则
   * @returns 是否触发告警
   */
  evaluateRule(rule: AlertRule): boolean {
    const state = this.ruleStates.get(rule.id);
    if (!state) return false;

    const shouldFire = this.checkCondition(rule);
    const now = new Date();

    if (shouldFire) {
      // 检查是否在冷却期
      if (state.lastNotifiedAt) {
        const timeSinceLastNotify = now.getTime() - state.lastNotifiedAt.getTime();
        if (timeSinceLastNotify < this.cooldown) {
          return false; // 在冷却期，不重复告警
        }
      }

      // 触发告警
      state.status = AlertStatus.FIRING;
      state.lastFiredAt = now;
      state.lastNotifiedAt = now;

      const alert = this.createAlertEvent(rule, AlertStatus.FIRING);
      this.recordAlert(alert);
      this.onAlert?.(alert);

      return true;
    } else if (state.status === AlertStatus.FIRING) {
      // 检测到恢复
      state.status = AlertStatus.OK;

      const alert = this.createAlertEvent(rule, AlertStatus.RESOLVED);
      this.recordAlert(alert);
      this.onAlert?.(alert);
    }

    return false;
  }

  /**
   * 检查规则条件
   *
   * @param rule - 告警规则
   * @returns 是否满足触发条件
   */
  private checkCondition(rule: AlertRule): boolean {
    switch (rule.condition) {
      case AlertCondition.ERROR_RATE_HIGH:
        return this.checkErrorRate(rule);

      case AlertCondition.RESPONSE_TIME_SLOW:
        return this.checkResponseTime(rule);

      case AlertCondition.RATE_LIMIT_HIGH:
        return this.checkRateLimit(rule);

      case AlertCondition.CACHE_HIT_RATE_LOW:
        return this.checkCacheHitRate(rule);

      case AlertCondition.SERVICE_DOWN:
        return this.checkServiceDown(rule);

      default:
        return false;
    }
  }

  /**
   * 检查错误率
   */
  private checkErrorRate(rule: AlertRule): boolean {
    const summary = this.metrics.getSummary();
    return summary.errorRate >= rule.threshold;
  }

  /**
   * 检查响应时间
   */
  private checkResponseTime(rule: AlertRule): boolean {
    const percentile = rule.percentile ?? 95;
    const duration = this.metrics.getHistogram('http_request_duration_ms');

    if (!duration || duration.count === 0) return false;

    // 使用带标签的百分位数（计算所有路径的响应时间）
    const value = duration.percentile(percentile);
    return value >= rule.threshold;
  }

  /**
   * 检查速率限制
   */
  private checkRateLimit(rule: AlertRule): boolean {
    const rateLimits = this.metrics.getCounter('rate_limit_exceeded_total');
    return (rateLimits?.value ?? 0) >= rule.threshold;
  }

  /**
   * 检查缓存命中率
   */
  private checkCacheHitRate(rule: AlertRule): boolean {
    const summary = this.metrics.getSummary();
    return summary.cacheHitRate < rule.threshold;
  }

  /**
   * 检查服务是否可用
   */
  private checkServiceDown(rule: AlertRule): boolean {
    // 简化实现：检查是否最近有请求
    const totalRequests = this.metrics.getCounter('http_requests_total');
    return (totalRequests?.value ?? 0) === 0;
  }

  /**
   * 创建告警事件
   */
  private createAlertEvent(rule: AlertRule, status: AlertStatus): AlertEvent {
    let value = 0;
    let currentValue = 0;

    // 根据条件类型获取当前值
    switch (rule.condition) {
      case AlertCondition.ERROR_RATE_HIGH:
        currentValue = this.metrics.getSummary().errorRate;
        value = Math.round(currentValue * 1000) / 1000; // 保留3位小数
        break;

      case AlertCondition.RESPONSE_TIME_SLOW:
        const duration = this.metrics.getHistogram('http_request_duration_ms');
        const p = rule.percentile ?? 95;
        value = duration?.percentile(p) ?? 0;
        break;

      case AlertCondition.RATE_LIMIT_HIGH:
        const rateLimits = this.metrics.getCounter('rate_limit_exceeded_total');
        value = rateLimits?.value ?? 0;
        break;

      case AlertCondition.CACHE_HIT_RATE_LOW:
        currentValue = this.metrics.getSummary().cacheHitRate;
        value = Math.round(currentValue * 1000) / 1000;
        break;

      case AlertCondition.SERVICE_DOWN:
        const requests = this.metrics.getCounter('http_requests_total');
        value = requests?.value ?? 0;
        break;
    }

    // 生成告警消息
    const message = this.generateAlertMessage(rule, value, status);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status,
      condition: rule.condition,
      value,
      threshold: rule.threshold,
      message,
      timestamp: new Date(),
      labels: rule.labels
    };
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(rule: AlertRule, value: number, status: AlertStatus): string {
    const statusText = status === AlertStatus.FIRING ? '触发' : '恢复';

    switch (rule.condition) {
      case AlertCondition.ERROR_RATE_HIGH:
        return `[${statusText}] ${rule.name}: 错误率 ${(value * 100).toFixed(2)}%，阈值 ${(rule.threshold * 100).toFixed(2)}%`;

      case AlertCondition.RESPONSE_TIME_SLOW:
        const p = rule.percentile ?? 95;
        return `[${statusText}] ${rule.name}: P${p} 响应时间 ${value.toFixed(2)}ms，阈值 ${rule.threshold}ms`;

      case AlertCondition.RATE_LIMIT_HIGH:
        return `[${statusText}] ${rule.name}: 速率限制触发 ${value} 次，阈值 ${rule.threshold} 次`;

      case AlertCondition.CACHE_HIT_RATE_LOW:
        return `[${statusText}] ${rule.name}: 缓存命中率 ${(value * 100).toFixed(2)}%，阈值 ${(rule.threshold * 100).toFixed(2)}%`;

      case AlertCondition.SERVICE_DOWN:
        return `[${statusText}] ${rule.name}: 服务可能不可用，当前请求数 ${value}`;

      default:
        return `[${statusText}] ${rule.name}: 当前值 ${value}，阈值 ${rule.threshold}`;
    }
  }

  /**
   * 记录告警历史
   */
  private recordAlert(alert: AlertEvent): void {
    if (!this.alertHistory.has(alert.ruleId)) {
      this.alertHistory.set(alert.ruleId, []);
    }

    const history = this.alertHistory.get(alert.ruleId)!;
    history.push({
      alert,
      firedAt: new Date()
    });

    // 限制历史记录数量
    if (history.length > this.maxHistory) {
      history.shift();
    }
  }

  /**
   * 获取告警历史
   *
   * @param ruleId - 规则 ID（可选，不提供则返回所有）
   * @returns 告警历史
   */
  getAlertHistory(ruleId?: string): AlertHistoryEntry[] {
    if (ruleId) {
      return this.alertHistory.get(ruleId) ?? [];
    }

    const all: AlertHistoryEntry[] = [];
    for (const history of this.alertHistory.values()) {
      all.push(...history);
    }

    // 按时间排序
    return all.sort((a, b) => b.firedAt.getTime() - a.firedAt.getTime());
  }

  /**
   * 获取所有告警历史（带规则信息）
   */
  getAllAlertHistory(): Array<{ rule: AlertRule; history: AlertHistoryEntry[] }> {
    const result: Array<{ rule: AlertRule; history: AlertHistoryEntry[] }> = [];

    for (const [ruleId, history] of this.alertHistory) {
      const rule = this.rules.get(ruleId);
      if (rule) {
        result.push({ rule, history });
      }
    }

    return result;
  }

  /**
   * 重置规则状态
   *
   * @param ruleId - 规则 ID（可选，不提供则重置所有）
   */
  resetStatus(ruleId?: string): void {
    if (ruleId) {
      const state = this.ruleStates.get(ruleId);
      if (state) {
        state.status = AlertStatus.OK;
      }
    } else {
      for (const state of this.ruleStates.values()) {
        state.status = AlertStatus.OK;
      }
    }
  }

  /**
   * 清除所有数据
   */
  clear(): void {
    this.rules.clear();
    this.ruleStates.clear();
    this.alertHistory.clear();
    this.initializeDefaultRules();
  }

  /**
   * 获取告警摘要
   */
  getSummary(): {
    totalRules: number;
    firingAlerts: number;
    okAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
  } {
    let firing = 0;
    let critical = 0;
    let warning = 0;
    let info = 0;

    for (const [ruleId, state] of this.ruleStates) {
      if (state.status === AlertStatus.FIRING) {
        firing++;
        const rule = this.rules.get(ruleId);
        if (rule) {
          switch (rule.severity) {
            case AlertSeverity.CRITICAL:
              critical++;
              break;
            case AlertSeverity.WARNING:
              warning++;
              break;
            case AlertSeverity.INFO:
              info++;
              break;
          }
        }
      }
    }

    return {
      totalRules: this.rules.size,
      firingAlerts: firing,
      okAlerts: this.rules.size - firing,
      criticalAlerts: critical,
      warningAlerts: warning,
      infoAlerts: info
    };
  }
}

/**
 * 创建告警管理器工厂函数
 *
 * @param options - 配置选项
 * @returns AlertManager 实例
 */
export function createAlertManager(options: AlertManagerOptions): AlertManager {
  return new AlertManager(options);
}
