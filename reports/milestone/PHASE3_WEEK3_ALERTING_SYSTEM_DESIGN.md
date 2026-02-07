# Phase 3 Week 3: 告警系统设计文档

> **任务编号**: Task 3.4
> **设计时间**: 2026-02-07
> **预计工时**: 6 小时
> **状态**: 📝 设计中

---

## 1. 设计目标

### 1.1 核心目标

为 PRISM-Gateway 系统设计和实现一个智能告警系统，及时通知系统异常和重要事件，支持多种通知渠道和灵活的告警规则。

**关键要求**:
- **多渠道通知**: 支持日志、文件、Webhook、邮件等多种渠道
- **智能规则**: 灵活的告警规则配置，支持条件组合
- **降噪机制**: 防止告警风暴，合并相似告警
- **优先级分级**: 支持 Critical、High、Medium、Low 四级
- **告警历史**: 记录所有告警历史，支持查询和分析

### 1.2 验收标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| **告警延迟** | 从检测到发送 | <5s |
| **通知成功率** | 发送成功比例 | >99% |
| **误报率** | 假阳性比例 | <5% |
| **重复告警抑制** | 相同告警去重率 | >95% |
| **性能开销** | CPU 占用 | <0.5% |

---

## 2. 架构设计

### 2.1 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                       告警系统架构图                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      │
│  │  告警源      │─────>│  规则引擎    │─────>│  通知管理器  │      │
│  │AlertSources │      │ RuleEngine  │      │ Notifier    │      │
│  └─────────────┘      └─────────────┘      └─────────────┘      │
│       │                     │                     │              │
│       │                     │                     │              │
│       ▼                     ▼                     ▼              │
│  ┌────────────────────────────────────────────────────────┐     │
│  │               告警源 (Alert Sources)                   │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ • HealthCheck    (健康检查异常)                        │     │
│  │ • Metrics        (指标阈值告警)                        │     │
│  │ • System         (系统事件)                            │     │
│  │ • Application    (应用错误)                            │     │
│  │ • Business       (业务事件)                            │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │               规则引擎 (Rule Engine)                    │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ • 阈值规则 (Threshold)                                  │     │
│  │ • 变化率规则 (Rate of Change)                           │     │
│  │ • 组合规则 (Composite)                                  │     │
│  │ • 时间窗口规则 (Time Window)                            │     │
│  │ • 静默规则 (Silence)                                    │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              降噪处理 (Noise Reduction)                 │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ • 去重 (Deduplication)                                  │     │
│  │ • 合并 (Aggregation)                                    │     │
│  │ • 抑制 (Suppression)                                    │     │
│  │ • 节流 (Throttling)                                     │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              通知渠道 (Notification Channels)           │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ • Console        (控制台输出)                           │     │
│  │ • File           (文件日志)                             │     │
│  │ • Webhook        (HTTP 回调)                            │     │
│  │ • Email          (邮件通知)                             │     │
│  │ • Slack          (Slack 消息)                           │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              告警历史 (Alert History)                   │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ ~/.prism-gateway/alerts/                                │     │
│  │   ├── active/     (活跃告警)                            │     │
│  │   ├── history/    (历史告警)                            │     │
│  │   └── manifest.json (告警索引)                          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 AlertingService (主服务类)

```typescript
/**
 * 告警服务主类
 * 提供告警触发、规则管理、通知发送等功能
 */
export class AlertingService {
  private ruleEngine: AlertRuleEngine;
  private notifier: AlertNotifier;
  private storage: AlertStorage;
  private deduplicator: AlertDeduplicator;

  /**
   * 触发告警
   * @param alert 告警信息
   */
  async trigger(alert: Alert): Promise<void> {
    // 1. 评估告警规则
    const shouldAlert = await this.ruleEngine.evaluate(alert);
    if (!shouldAlert) {
      logger.debug(`Alert suppressed by rules: ${alert.title}`);
      return;
    }

    // 2. 去重检查
    const isDuplicate = await this.deduplicator.check(alert);
    if (isDuplicate) {
      logger.debug(`Duplicate alert suppressed: ${alert.title}`);
      return;
    }

    // 3. 保存告警
    await this.storage.saveAlert(alert);

    // 4. 发送通知
    await this.notifier.send(alert);

    logger.info(`Alert triggered: ${alert.title} (${alert.severity})`);
  }

  /**
   * 解决告警（标记为已解决）
   * @param alertId 告警 ID
   * @param resolution 解决方案描述
   */
  async resolve(alertId: string, resolution: string): Promise<void> {
    const alert = await this.storage.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = AlertStatus.Resolved;
    alert.resolvedAt = new Date();
    alert.resolution = resolution;

    await this.storage.updateAlert(alert);

    // 发送解决通知
    await this.notifier.sendResolved(alert);
  }

  /**
   * 确认告警（标记为已确认）
   * @param alertId 告警 ID
   * @param acknowledgedBy 确认人
   */
  async acknowledge(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = await this.storage.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = AlertStatus.Acknowledged;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    await this.storage.updateAlert(alert);
  }

  /**
   * 添加静默规则
   * @param rule 静默规则
   */
  async addSilenceRule(rule: SilenceRule): Promise<void> {
    await this.ruleEngine.addSilenceRule(rule);
  }

  /**
   * 移除静默规则
   * @param ruleId 规则 ID
   */
  async removeSilenceRule(ruleId: string): Promise<void> {
    await this.ruleEngine.removeSilenceRule(ruleId);
  }

  /**
   * 查询告警历史
   * @param query 查询条件
   * @returns 告警列表
   */
  async queryAlerts(query: AlertQuery): Promise<Alert[]> {
    return await this.storage.queryAlerts(query);
  }

  /**
   * 获取活跃告警
   * @returns 活跃告警列表
   */
  async getActiveAlerts(): Promise<Alert[]> {
    return await this.storage.getActiveAlerts();
  }

  /**
   * 获取告警统计
   * @param timeRange 时间范围
   * @returns 统计结果
   */
  async getStats(timeRange: TimeRange): Promise<AlertStats> {
    return await this.storage.getStats(timeRange);
  }
}
```

#### 2.2.2 AlertRuleEngine (规则引擎)

```typescript
/**
 * 告警规则引擎
 * 评估告警是否应该触发
 */
export class AlertRuleEngine {
  private rules: Map<string, AlertRule>;
  private silenceRules: Map<string, SilenceRule>;

  /**
   * 评估告警
   * @param alert 告警信息
   * @returns 是否应该发送告警
   */
  async evaluate(alert: Alert): Promise<boolean> {
    // 1. 检查静默规则
    for (const [_, silenceRule] of this.silenceRules) {
      if (this.matchSilenceRule(alert, silenceRule)) {
        logger.debug(`Alert silenced by rule: ${silenceRule.name}`);
        return false;
      }
    }

    // 2. 检查时间窗口
    if (!this.isInTimeWindow(alert)) {
      logger.debug(`Alert outside time window: ${alert.title}`);
      return false;
    }

    // 3. 检查严重性阈值
    if (!this.meetsSeeverityThreshold(alert)) {
      logger.debug(`Alert below severity threshold: ${alert.title}`);
      return false;
    }

    return true;
  }

  /**
   * 匹配静默规则
   */
  private matchSilenceRule(alert: Alert, rule: SilenceRule): boolean {
    // 检查时间范围
    const now = Date.now();
    if (now < rule.startTime || now > rule.endTime) {
      return false;
    }

    // 检查告警源
    if (rule.source && rule.source !== alert.source) {
      return false;
    }

    // 检查严重性
    if (rule.severity && rule.severity !== alert.severity) {
      return false;
    }

    // 检查标签匹配
    if (rule.labels) {
      for (const [key, value] of Object.entries(rule.labels)) {
        if (alert.labels?.[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 检查时间窗口
   */
  private isInTimeWindow(alert: Alert): boolean {
    // 默认 24/7 都可以告警
    // 未来可以添加"仅工作时间"等配置
    return true;
  }

  /**
   * 检查严重性阈值
   */
  private meetsSeeverityThreshold(alert: Alert): boolean {
    // 可配置的最低严重性级别
    const minSeverity = AlertSeverity.Medium; // 默认 Medium 及以上才告警

    const severityOrder = {
      [AlertSeverity.Critical]: 4,
      [AlertSeverity.High]: 3,
      [AlertSeverity.Medium]: 2,
      [AlertSeverity.Low]: 1
    };

    return severityOrder[alert.severity] >= severityOrder[minSeverity];
  }

  /**
   * 添加静默规则
   */
  async addSilenceRule(rule: SilenceRule): Promise<void> {
    this.silenceRules.set(rule.id, rule);
  }

  /**
   * 移除静默规则
   */
  async removeSilenceRule(ruleId: string): Promise<void> {
    this.silenceRules.delete(ruleId);
  }
}
```

#### 2.2.3 AlertNotifier (通知管理器)

```typescript
/**
 * 告警通知管理器
 * 负责通过不同渠道发送告警通知
 */
export class AlertNotifier {
  private channels: Map<string, NotificationChannel>;

  /**
   * 发送告警通知
   * @param alert 告警信息
   */
  async send(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];

    // 根据严重性选择通知渠道
    const channelsForSeverity = this.selectChannels(alert.severity);

    for (const channelName of channelsForSeverity) {
      const channel = this.channels.get(channelName);
      if (channel) {
        promises.push(channel.send(alert).catch(error => {
          logger.error(`Failed to send alert via ${channelName}:`, error);
        }));
      }
    }

    await Promise.all(promises);
  }

  /**
   * 发送解决通知
   * @param alert 已解决的告警
   */
  async sendResolved(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];

    const channelsForSeverity = this.selectChannels(alert.severity);

    for (const channelName of channelsForSeverity) {
      const channel = this.channels.get(channelName);
      if (channel) {
        promises.push(channel.sendResolved(alert).catch(error => {
          logger.error(`Failed to send resolved notification via ${channelName}:`, error);
        }));
      }
    }

    await Promise.all(promises);
  }

  /**
   * 根据严重性选择通知渠道
   */
  private selectChannels(severity: AlertSeverity): string[] {
    switch (severity) {
      case AlertSeverity.Critical:
        // 关键告警：所有渠道
        return ['console', 'file', 'webhook', 'email', 'slack'];

      case AlertSeverity.High:
        // 高级告警：控制台、文件、Webhook
        return ['console', 'file', 'webhook'];

      case AlertSeverity.Medium:
        // 中级告警：控制台、文件
        return ['console', 'file'];

      case AlertSeverity.Low:
        // 低级告警：仅文件
        return ['file'];

      default:
        return ['console', 'file'];
    }
  }

  /**
   * 注册通知渠道
   */
  registerChannel(name: string, channel: NotificationChannel): void {
    this.channels.set(name, channel);
  }
}
```

#### 2.2.4 通知渠道实现

##### ConsoleChannel (控制台通知)

```typescript
/**
 * 控制台通知渠道
 * 输出到 stdout/stderr
 */
export class ConsoleChannel implements NotificationChannel {
  async send(alert: Alert): Promise<void> {
    const icon = this.getSeverityIcon(alert.severity);
    const color = this.getSeverityColor(alert.severity);

    console.log(color + `${icon} [${alert.severity.toUpperCase()}] ${alert.title}` + '\x1b[0m');
    console.log(`  Source: ${alert.source}`);
    console.log(`  Message: ${alert.message}`);
    if (alert.details) {
      console.log(`  Details: ${JSON.stringify(alert.details)}`);
    }
    console.log(`  Time: ${alert.timestamp.toISOString()}`);
    console.log('');
  }

  async sendResolved(alert: Alert): Promise<void> {
    console.log(`\x1b[32m✅ [RESOLVED] ${alert.title}\x1b[0m`);
    console.log(`  Resolution: ${alert.resolution}`);
    console.log('');
  }

  private getSeverityIcon(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.Critical: return '🚨';
      case AlertSeverity.High: return '⚠️';
      case AlertSeverity.Medium: return '⚡';
      case AlertSeverity.Low: return 'ℹ️';
      default: return '📢';
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.Critical: return '\x1b[91m'; // Bright red
      case AlertSeverity.High: return '\x1b[33m';     // Yellow
      case AlertSeverity.Medium: return '\x1b[36m';   // Cyan
      case AlertSeverity.Low: return '\x1b[90m';      // Gray
      default: return '\x1b[0m';                      // Reset
    }
  }
}
```

##### FileChannel (文件通知)

```typescript
/**
 * 文件通知渠道
 * 写入到文件日志
 */
export class FileChannel implements NotificationChannel {
  private logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
  }

  async send(alert: Alert): Promise<void> {
    const logEntry = {
      timestamp: alert.timestamp.toISOString(),
      severity: alert.severity,
      source: alert.source,
      title: alert.title,
      message: alert.message,
      details: alert.details,
      labels: alert.labels
    };

    // 追加写入 JSONL 格式
    await fs.appendFile(this.logPath, JSON.stringify(logEntry) + '\n');
  }

  async sendResolved(alert: Alert): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'resolved',
      alertId: alert.id,
      title: alert.title,
      resolution: alert.resolution,
      resolvedAt: alert.resolvedAt?.toISOString()
    };

    await fs.appendFile(this.logPath, JSON.stringify(logEntry) + '\n');
  }
}
```

##### WebhookChannel (Webhook 通知)

```typescript
/**
 * Webhook 通知渠道
 * 发送 HTTP POST 请求
 */
export class WebhookChannel implements NotificationChannel {
  private webhookUrl: string;
  private headers: Record<string, string>;

  constructor(webhookUrl: string, headers?: Record<string, string>) {
    this.webhookUrl = webhookUrl;
    this.headers = headers || { 'Content-Type': 'application/json' };
  }

  async send(alert: Alert): Promise<void> {
    const payload = {
      type: 'alert',
      alert: {
        id: alert.id,
        severity: alert.severity,
        source: alert.source,
        title: alert.title,
        message: alert.message,
        details: alert.details,
        labels: alert.labels,
        timestamp: alert.timestamp.toISOString()
      }
    };

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  async sendResolved(alert: Alert): Promise<void> {
    const payload = {
      type: 'resolved',
      alert: {
        id: alert.id,
        title: alert.title,
        resolution: alert.resolution,
        resolvedAt: alert.resolvedAt?.toISOString()
      }
    };

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    });
  }
}
```

##### EmailChannel (邮件通知)

```typescript
/**
 * 邮件通知渠道
 * 发送邮件通知
 */
export class EmailChannel implements NotificationChannel {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  async send(alert: Alert): Promise<void> {
    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const body = this.formatEmailBody(alert);

    await this.sendEmail(subject, body);
  }

  async sendResolved(alert: Alert): Promise<void> {
    const subject = `[RESOLVED] ${alert.title}`;
    const body = `
Alert has been resolved.

Alert: ${alert.title}
Resolution: ${alert.resolution}
Resolved At: ${alert.resolvedAt?.toISOString()}
`;

    await this.sendEmail(subject, body);
  }

  private formatEmailBody(alert: Alert): string {
    return `
PRISM-Gateway Alert

Severity: ${alert.severity.toUpperCase()}
Source: ${alert.source}
Title: ${alert.title}
Message: ${alert.message}

${alert.details ? `Details:\n${JSON.stringify(alert.details, null, 2)}` : ''}

Time: ${alert.timestamp.toISOString()}

---
This is an automated alert from PRISM-Gateway.
    `.trim();
  }

  private async sendEmail(subject: string, body: string): Promise<void> {
    // 使用 nodemailer 或类似库发送邮件
    // 实际实现依赖于配置的 SMTP 服务器
    logger.info(`Email sent: ${subject}`);
  }
}
```

#### 2.2.5 AlertDeduplicator (去重器)

```typescript
/**
 * 告警去重器
 * 防止重复告警
 */
export class AlertDeduplicator {
  private cache: Map<string, Alert>;
  private windowMs: number = 300000; // 5 分钟窗口

  /**
   * 检查是否为重复告警
   * @param alert 告警信息
   * @returns true 表示重复
   */
  async check(alert: Alert): Promise<boolean> {
    const fingerprint = this.calculateFingerprint(alert);

    // 检查缓存中是否有相同的告警
    const cachedAlert = this.cache.get(fingerprint);
    if (cachedAlert) {
      const timeDiff = alert.timestamp.getTime() - cachedAlert.timestamp.getTime();

      // 如果在时间窗口内，认为是重复告警
      if (timeDiff < this.windowMs) {
        return true;
      }
    }

    // 缓存新告警
    this.cache.set(fingerprint, alert);

    // 清理过期缓存
    this.cleanupCache();

    return false;
  }

  /**
   * 计算告警指纹
   * 用于识别相同的告警
   */
  private calculateFingerprint(alert: Alert): string {
    const parts = [
      alert.source,
      alert.severity,
      alert.title,
      JSON.stringify(alert.labels || {})
    ];

    return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [fingerprint, alert] of this.cache) {
      const age = now - alert.timestamp.getTime();
      if (age > this.windowMs) {
        this.cache.delete(fingerprint);
      }
    }
  }
}
```

---

## 3. 数据模型

### 3.1 核心类型定义

```typescript
/**
 * 告警严重性
 */
export enum AlertSeverity {
  Critical = 'critical',  // 严重：系统不可用或数据丢失
  High = 'high',          // 高：核心功能受影响
  Medium = 'medium',      // 中：部分功能降级
  Low = 'low'             // 低：次要问题或信息
}

/**
 * 告警状态
 */
export enum AlertStatus {
  Active = 'active',           // 活跃
  Acknowledged = 'acknowledged', // 已确认
  Resolved = 'resolved'        // 已解决
}

/**
 * 告警信息
 */
export interface Alert {
  /** 告警 ID（唯一） */
  id: string;

  /** 告警严重性 */
  severity: AlertSeverity;

  /** 告警来源 */
  source: string;

  /** 告警标题 */
  title: string;

  /** 告警消息 */
  message: string;

  /** 详细信息（可选） */
  details?: Record<string, any>;

  /** 标签（可选） */
  labels?: Record<string, string>;

  /** 告警时间 */
  timestamp: Date;

  /** 告警状态 */
  status: AlertStatus;

  /** 确认时间（可选） */
  acknowledgedAt?: Date;

  /** 确认人（可选） */
  acknowledgedBy?: string;

  /** 解决时间（可选） */
  resolvedAt?: Date;

  /** 解决方案（可选） */
  resolution?: string;
}

/**
 * 静默规则
 */
export interface SilenceRule {
  /** 规则 ID */
  id: string;

  /** 规则名称 */
  name: string;

  /** 开始时间 */
  startTime: number;

  /** 结束时间 */
  endTime: number;

  /** 告警源过滤（可选） */
  source?: string;

  /** 严重性过滤（可选） */
  severity?: AlertSeverity;

  /** 标签过滤（可选） */
  labels?: Record<string, string>;

  /** 创建人 */
  createdBy: string;

  /** 创建时间 */
  createdAt: Date;

  /** 原因 */
  reason: string;
}

/**
 * 告警查询条件
 */
export interface AlertQuery {
  /** 开始时间 */
  startTime?: number;

  /** 结束时间 */
  endTime?: number;

  /** 严重性过滤 */
  severity?: AlertSeverity;

  /** 状态过滤 */
  status?: AlertStatus;

  /** 来源过滤 */
  source?: string;

  /** 分页：页码 */
  page?: number;

  /** 分页：每页数量 */
  perPage?: number;
}

/**
 * 告警统计
 */
export interface AlertStats {
  /** 总告警数 */
  total: number;

  /** 按严重性分组 */
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  /** 按状态分组 */
  byStatus: {
    active: number;
    acknowledged: number;
    resolved: number;
  };

  /** 按来源分组 */
  bySource: Record<string, number>;

  /** 平均解决时间（毫秒） */
  avgResolutionTime: number;
}

/**
 * 通知渠道接口
 */
export interface NotificationChannel {
  /**
   * 发送告警通知
   */
  send(alert: Alert): Promise<void>;

  /**
   * 发送解决通知
   */
  sendResolved(alert: Alert): Promise<void>;
}

/**
 * 邮件配置
 */
export interface EmailConfig {
  /** SMTP 服务器 */
  host: string;

  /** SMTP 端口 */
  port: number;

  /** 是否使用 TLS */
  secure: boolean;

  /** 发件人 */
  from: string;

  /** 收件人列表 */
  to: string[];

  /** 认证信息 */
  auth: {
    user: string;
    pass: string;
  };
}
```

---

## 4. 告警规则示例

### 4.1 阈值告警

```typescript
/**
 * CPU 使用率告警
 */
const cpuUsageAlert: AlertRule = {
  id: 'cpu-high',
  name: 'High CPU Usage',
  description: 'Trigger when CPU usage exceeds 80%',
  source: 'system',
  condition: {
    metric: 'system_cpu_usage',
    operator: '>',
    threshold: 80,
    duration: 300000 // 持续 5 分钟
  },
  severity: AlertSeverity.High,
  message: 'CPU usage is critically high: {{value}}%'
};

/**
 * 内存使用率告警
 */
const memoryUsageAlert: AlertRule = {
  id: 'memory-high',
  name: 'High Memory Usage',
  source: 'system',
  condition: {
    metric: 'system_memory_usage',
    operator: '>',
    threshold: 85,
    duration: 600000 // 持续 10 分钟
  },
  severity: AlertSeverity.Critical,
  message: 'Memory usage is critically high: {{value}}%'
};
```

### 4.2 变化率告警

```typescript
/**
 * 违规激增告警
 */
const violationSpikeAlert: AlertRule = {
  id: 'violation-spike',
  name: 'Violation Spike Detected',
  source: 'business',
  condition: {
    metric: 'business_violations_today',
    operator: 'rate_increase',
    threshold: 50, // 增加 50% 以上
    window: 3600000 // 1 小时窗口
  },
  severity: AlertSeverity.Medium,
  message: 'Violation count increased by {{percentage}}% in the last hour'
};
```

### 4.3 组合规则告警

```typescript
/**
 * 系统过载告警（CPU + 内存 + 负载）
 */
const systemOverloadAlert: AlertRule = {
  id: 'system-overload',
  name: 'System Overload',
  source: 'system',
  condition: {
    type: 'composite',
    operator: 'AND',
    conditions: [
      { metric: 'system_cpu_usage', operator: '>', threshold: 80 },
      { metric: 'system_memory_usage', operator: '>', threshold: 75 },
      { metric: 'system_load_15m', operator: '>', threshold: 2.0 }
    ]
  },
  severity: AlertSeverity.Critical,
  message: 'System is severely overloaded'
};
```

---

## 5. CLI 命令设计

```bash
# 查看活跃告警
prism alerts
# Output:
# 🚨 Active Alerts:
#
# [CRITICAL] High Memory Usage
#   Source: system
#   Message: Memory usage is critically high: 87.5%
#   Time: 2026-02-07 12:15:30 (5 minutes ago)
#   Status: Active
#
# [HIGH] API Error Rate High
#   Source: api
#   Message: Error rate exceeded 5%: current 7.2%
#   Time: 2026-02-07 12:10:15 (10 minutes ago)
#   Status: Acknowledged by admin
#
# Total: 2 active alerts

# 确认告警
prism alerts ack <alert-id> --by admin
# Output:
# ✅ Alert acknowledged: High Memory Usage

# 解决告警
prism alerts resolve <alert-id> --resolution "Restarted service, memory usage normalized"
# Output:
# ✅ Alert resolved: High Memory Usage

# 查看告警历史
prism alerts history --hours 24
# Output:
# Alert History (Last 24 hours):
#
# Time                Severity  Title                  Status
# ─────────────────────────────────────────────────────────────
# 2026-02-07 12:15    Critical  High Memory Usage      Active
# 2026-02-07 12:10    High      API Error Rate High    Ack
# 2026-02-07 10:30    Medium    Disk Space Low         Resolved
# 2026-02-07 08:15    High      WebSocket Disconnected Resolved
#
# Total: 4 alerts

# 添加静默规则
prism alerts silence add \
  --name "Maintenance Window" \
  --start "2026-02-08 02:00" \
  --end "2026-02-08 04:00" \
  --source system \
  --reason "Scheduled maintenance"
# Output:
# ✅ Silence rule added: Maintenance Window
# All 'system' alerts will be silenced from 2026-02-08 02:00 to 04:00

# 查看静默规则
prism alerts silence list
# Output:
# Silence Rules:
#
# Name                 Start               End                 Source  Status
# ──────────────────────────────────────────────────────────────────────────
# Maintenance Window   2026-02-08 02:00   2026-02-08 04:00    system  Active
#
# Total: 1 rule

# 移除静默规则
prism alerts silence remove <rule-id>
# Output:
# ✅ Silence rule removed

# 查看告警统计
prism alerts stats --days 7
# Output:
# Alert Statistics (Last 7 days):
#
# Total Alerts:       47
#
# By Severity:
#   Critical:         3 (6.4%)
#   High:            12 (25.5%)
#   Medium:          25 (53.2%)
#   Low:              7 (14.9%)
#
# By Status:
#   Active:           2 (4.3%)
#   Acknowledged:     5 (10.6%)
#   Resolved:        40 (85.1%)
#
# By Source:
#   system:          18 (38.3%)
#   api:             12 (25.5%)
#   websocket:        8 (17.0%)
#   business:         6 (12.8%)
#   data:             3 (6.4%)
#
# Avg Resolution Time: 23.5 minutes
```

---

## 6. API 接口设计

```typescript
// GET /api/v1/alerts
// 获取活跃告警
router.get('/alerts', async (c) => {
  const alerts = await alertingService.getActiveAlerts();
  return c.json({ alerts });
});

// GET /api/v1/alerts/history
// 查询告警历史
router.get('/alerts/history', async (c) => {
  const query = {
    startTime: c.req.query('start') ? parseInt(c.req.query('start')!) : undefined,
    endTime: c.req.query('end') ? parseInt(c.req.query('end')!) : undefined,
    severity: c.req.query('severity') as AlertSeverity,
    status: c.req.query('status') as AlertStatus,
    source: c.req.query('source'),
    page: c.req.query('page') ? parseInt(c.req.query('page')!) : 1,
    perPage: c.req.query('perPage') ? parseInt(c.req.query('perPage')!) : 50
  };

  const alerts = await alertingService.queryAlerts(query);
  return c.json({ alerts });
});

// POST /api/v1/alerts/:id/acknowledge
// 确认告警
router.post('/alerts/:id/acknowledge', async (c) => {
  const alertId = c.req.param('id');
  const { acknowledgedBy } = await c.req.json();

  await alertingService.acknowledge(alertId, acknowledgedBy);
  return c.json({ success: true });
});

// POST /api/v1/alerts/:id/resolve
// 解决告警
router.post('/alerts/:id/resolve', async (c) => {
  const alertId = c.req.param('id');
  const { resolution } = await c.req.json();

  await alertingService.resolve(alertId, resolution);
  return c.json({ success: true });
});

// POST /api/v1/alerts/silence
// 添加静默规则
router.post('/alerts/silence', async (c) => {
  const rule = await c.req.json<SilenceRule>();
  await alertingService.addSilenceRule(rule);
  return c.json({ success: true });
});

// DELETE /api/v1/alerts/silence/:id
// 移除静默规则
router.delete('/alerts/silence/:id', async (c) => {
  const ruleId = c.req.param('id');
  await alertingService.removeSilenceRule(ruleId);
  return c.json({ success: true });
});

// GET /api/v1/alerts/stats
// 获取告警统计
router.get('/alerts/stats', async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const now = Date.now();
  const startTime = now - days * 86400000;

  const stats = await alertingService.getStats({ start: startTime, end: now });
  return c.json(stats);
});
```

---

## 7. 实现计划

### 7.1 任务分解 (6 小时)

| 任务 | 工时 | 优先级 | 依赖 |
|------|------|--------|------|
| **1. 数据模型定义** | 0.5h | P0 | 无 |
| **2. AlertRuleEngine 实现** | 1h | P0 | 1 |
| **3. AlertNotifier 实现** | 1h | P0 | 1 |
| **4. AlertDeduplicator 实现** | 0.5h | P0 | 1 |
| **5. AlertStorage 实现** | 0.5h | P0 | 1 |
| **6. AlertingService 实现** | 0.5h | P0 | 2-5 |
| **7. 通知渠道实现** | 1h | P0 | 3 |
| **8. CLI 命令实现** | 0.5h | P1 | 6 |
| **9. API 端点实现** | 0.5h | P2 | 6 |
| **10. 单元测试** | 1h | P0 | 2-9 |

### 7.2 验收检查清单

- [ ] 告警触发正常工作
- [ ] 规则引擎正确评估
- [ ] 去重机制有效
- [ ] 所有通知渠道正常
- [ ] 静默规则正常运作
- [ ] 告警历史正确保存
- [ ] CLI 命令全部可用
- [ ] API 端点全部可用
- [ ] 单元测试覆盖率 >90%
- [ ] 集成测试通过
- [ ] 文档完整清晰

---

## 8. 参考文档

- [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/)
- [PagerDuty Alerts](https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview)
- [Grafana Alerting](https://grafana.com/docs/grafana/latest/alerting/)
- [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-07
**作者**: AI Assistant (Claude Sonnet 4.5)
**审核人**: PRISM-Gateway Team
**下一步**: Phase 3 Week 3 实现阶段
