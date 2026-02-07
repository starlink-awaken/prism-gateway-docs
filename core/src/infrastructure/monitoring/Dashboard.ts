/**
 * Monitoring Dashboard - 监控仪表板
 *
 * @description
 * 提供 HTTP 接口访问的监控仪表板：
 * - 实时指标展示
 * - 健康状态监控
 * - 告警历史查看
 * - Prometheus 格式导出
 *
 * @features
 * - JSON API 响应
 * - ASCII 艺术表格（CLI）
 * - HTML 可视化（可选）
 *
 * @module infrastructure/monitoring
 */

import { Metrics } from './Metrics.js';
import { AlertManager, AlertSeverity, AlertStatus } from './AlertManager.js';

/**
 * 仪表板配置
 */
export interface DashboardOptions {
  /** 指标收集器 */
  metrics: Metrics;
  /** 告警管理器 */
  alerts?: AlertManager;
  /** 服务名称 */
  serviceName?: string;
  /** 服务版本 */
  serviceVersion?: string;
}

/**
 * 健康状态
 */
export interface HealthStatus {
  /** 服务名称 */
  service: string;
  /** 版本 */
  version: string;
  /** 状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 运行时间（秒） */
  uptime: number;
  /** 时间戳 */
  timestamp: string;
  /** 检查项 */
  checks: Record<string, { status: string; message?: string }>;
}

/**
 * Dashboard - 监控仪表板
 */
export class Dashboard {
  readonly metrics: Metrics;
  readonly alerts?: AlertManager;
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly startTime: number = Date.now();

  constructor(options: DashboardOptions) {
    this.metrics = options.metrics;
    this.alerts = options.alerts;
    this.serviceName = options.serviceName ?? 'prism-gateway';
    this.serviceVersion = options.serviceVersion ?? '2.0.0';
  }

  /**
   * 获取健康状态
   */
  getHealth(): HealthStatus {
    const summary = this.metrics.getSummary();
    const alertSummary = this.alerts?.getSummary();

    // 确定整体健康状态
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (alertSummary) {
      if (alertSummary.criticalAlerts > 0) {
        status = 'unhealthy';
      } else if (alertSummary.warningAlerts > 0 || summary.errorRate > 0.01) {
        status = 'degraded';
      }
    }

    return {
      service: this.serviceName,
      version: this.serviceVersion,
      status,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks: {
        metrics: { status: 'ok' },
        errorRate: {
          status: summary.errorRate > 0.05 ? 'critical' : summary.errorRate > 0.01 ? 'warning' : 'ok',
          message: `${(summary.errorRate * 100).toFixed(2)}%`
        },
        responseTime: {
          status: summary.p95ResponseTime > 200 ? 'critical' : summary.p95ResponseTime > 100 ? 'warning' : 'ok',
          message: `P95: ${summary.p95ResponseTime.toFixed(2)}ms`
        },
        cache: {
          status: summary.cacheHitRate < 0.5 ? 'warning' : 'ok',
          message: `${(summary.cacheHitRate * 100).toFixed(1)}% hit rate`
        }
      }
    };
  }

  /**
   * 获取指标摘要
   */
  getMetricsSummary() {
    const summary = this.metrics.getSummary();

    return {
      service: this.serviceName,
      version: this.serviceVersion,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      metrics: {
        requests: {
          total: summary.totalRequests,
          errors: Math.round(summary.totalRequests * summary.errorRate),
          errorRate: summary.errorRate
        },
        responseTime: {
          average: summary.avgResponseTime,
          p50: this.metrics.getHistogram('http_request_duration_ms')?.percentile(50) ?? 0,
          p95: summary.p95ResponseTime,
          p99: summary.p99ResponseTime
        },
        cache: {
          hitRate: summary.cacheHitRate,
          hits: 0,
          misses: 0
        },
        rateLimit: {
          exceeded: summary.rateLimitCount
        }
      },
      memory: process.memoryUsage(),
      cpu: {
        usage: process.cpuUsage()
      }
    };
  }

  /**
   * 获取告警摘要
   */
  getAlertsSummary() {
    if (!this.alerts) {
      return { enabled: false };
    }

    const summary = this.alerts.getSummary();
    const history = this.alerts.getAllAlertHistory();

    return {
      enabled: true,
      summary,
      rules: this.alerts.getRules().map((rule) => ({
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        status: this.alerts!.getAlertStatus(rule.id),
        condition: rule.condition,
        threshold: rule.threshold
      })),
      recentAlerts: history
        .flatMap(({ rule, history }) =>
          history.slice(-5).map((entry) => ({
            ruleId: rule.id,
            ruleName: rule.name,
            ...entry.alert
          }))
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20)
    };
  }

  /**
   * 获取完整仪表板数据
   */
  getDashboard() {
    return {
      health: this.getHealth(),
      metrics: this.getMetricsSummary(),
      alerts: this.getAlertsSummary()
    };
  }

  /**
   * 渲染 ASCII 仪表板
   */
  renderASCII(): string {
    const health = this.getHealth();
    const summary = this.metrics.getSummary();
    const alertSummary = this.alerts?.getSummary();

    const lines: string[] = [];

    // 标题
    lines.push('');
    lines.push('╔════════════════════════════════════════════════════════════╗');
    lines.push(`║          ${this.serviceName.toUpperCase()} MONITORING DASHBOARD${' '.repeat(Math.max(0, 24 - this.serviceName.length))}║`);
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push(`║  Version:     ${this.serviceVersion.padEnd(20)}  Uptime: ${Math.floor((Date.now() - this.startTime) / 1000)}s${' '.repeat(15)}║`);
    lines.push(`║  Status:      ${health.status.toUpperCase().padEnd(20)}  Time:   ${new Date().toLocaleTimeString()}${' '.repeat(15)}║`);
    lines.push('╠════════════════════════════════════════════════════════════╣');

    // 请求指标
    lines.push('║  REQUEST METRICS                                                ║');
    lines.push('├────────────────────────────────────────────────────────────────┤');
    lines.push(`║  Total Requests:     ${summary.totalRequests.toString().padStart(10)}                                      ║`);
    lines.push(`║  Error Rate:         ${(summary.errorRate * 100).toFixed(2)}%${' '.repeat(14 - (summary.errorRate * 100).toFixed(2).length)}                                      ║`);
    lines.push(`║  Avg Response Time:  ${summary.avgResponseTime.toFixed(2)}ms${' '.repeat(12 - summary.avgResponseTime.toFixed(2).length)}                                      ║`);
    lines.push(`║  P95 Response Time:  ${summary.p95ResponseTime.toFixed(2)}ms${' '.repeat(12 - summary.p95ResponseTime.toFixed(2).length)}                                      ║`);
    lines.push(`║  P99 Response Time:  ${summary.p99ResponseTime.toFixed(2)}ms${' '.repeat(12 - summary.p99ResponseTime.toFixed(2).length)}                                      ║`);

    // 缓存指标
    lines.push('║                                                                ║');
    lines.push('║  CACHE METRICS                                                 ║');
    lines.push('├────────────────────────────────────────────────────────────────┤');
    lines.push(`║  Hit Rate:           ${(summary.cacheHitRate * 100).toFixed(1)}%${' '.repeat(14 - (summary.cacheHitRate * 100).toFixed(1).length)}                                      ║`);
    lines.push(`║  Rate Limit Count:   ${summary.rateLimitCount.toString().padStart(10)}                                      ║`);

    // 告警状态
    if (alertSummary) {
      lines.push('║                                                                ║');
      lines.push('║  ALERTS                                                        ║');
      lines.push('├────────────────────────────────────────────────────────────────┤');
      lines.push(`║  Total Rules:       ${alertSummary.totalRules.toString().padStart(10)}                                      ║`);
      lines.push(`║  Firing:            ${alertSummary.firingAlerts.toString().padStart(10)}                                      ║`);
      lines.push(`║  Critical:          ${alertSummary.criticalAlerts.toString().padStart(10)}                                      ║`);
      lines.push(`║  Warning:           ${alertSummary.warningAlerts.toString().padStart(10)}                                      ║`);
    }

    // 内存使用
    const mem = process.memoryUsage();
    lines.push('║                                                                ║');
    lines.push('║  MEMORY USAGE                                                   ║');
    lines.push('├────────────────────────────────────────────────────────────────┤');
    lines.push(`║  Heap Used:          ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB${' '.repeat(10 - (mem.heapUsed / 1024 / 1024).toFixed(2).length)}                                     ║`);
    lines.push(`║  Heap Total:         ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB${' '.repeat(10 - (mem.heapTotal / 1024 / 1024).toFixed(2).length)}                                     ║`);
    lines.push(`║  RSS:                ${(mem.rss / 1024 / 1024).toFixed(2)} MB${' '.repeat(10 - (mem.rss / 1024 / 1024).toFixed(2).length)}                                     ║`);

    lines.push('╚════════════════════════════════════════════════════════════╝');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 渲染 HTML 仪表板
   */
  renderHTML(): string {
    const data = this.getDashboard();
    const health = data.health;
    const metrics = data.metrics;
    const alerts = data.alerts;

    const statusColor = health.status === 'healthy' ? 'green' : health.status === 'degraded' ? 'orange' : 'red';

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.serviceName} Monitoring</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .status-${health.status} { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${statusColor}; margin-right: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h3 { margin-bottom: 15px; font-size: 16px; color: #333; }
    .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .metric:last-child { border-bottom: none; }
    .metric-label { color: #666; }
    .metric-value { font-weight: 600; }
    .alert-item { padding: 10px; margin-bottom: 8px; border-radius: 4px; background: #f9f9f9; }
    .alert-critical { background: #fee; border-left: 4px solid #e33; }
    .alert-warning { background: #ffc; border-left: 4px solid #fc0; }
    .alert-info { background: #eef; border-left: 4px solid #39c; }
    .refresh { text-align: center; padding: 20px 0; }
    .btn { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1><span class="status-${health.status}"></span>${this.serviceName} Monitoring Dashboard</h1>
      <p style="color: #666; margin-top: 10px;">
        Version: ${this.serviceVersion} |
        Uptime: ${health.uptime}s |
        Status: <strong style="color: ${statusColor}">${health.status.toUpperCase()}</strong>
      </p>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Request Metrics</h3>
        <div class="metric">
          <span class="metric-label">Total Requests</span>
          <span class="metric-value">${metrics.metrics.requests.total.toLocaleString()}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Error Rate</span>
          <span class="metric-value">${(metrics.metrics.requests.errorRate * 100).toFixed(2)}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Avg Response Time</span>
          <span class="metric-value">${metrics.metrics.responseTime.average.toFixed(2)}ms</span>
        </div>
        <div class="metric">
          <span class="metric-label">P95 Response Time</span>
          <span class="metric-value">${metrics.metrics.responseTime.p95.toFixed(2)}ms</span>
        </div>
        <div class="metric">
          <span class="metric-label">P99 Response Time</span>
          <span class="metric-value">${metrics.metrics.responseTime.p99.toFixed(2)}ms</span>
        </div>
      </div>

      <div class="card">
        <h3>Cache & Rate Limit</h3>
        <div class="metric">
          <span class="metric-label">Cache Hit Rate</span>
          <span class="metric-value">${(metrics.metrics.cache.hitRate * 100).toFixed(1)}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Rate Limit Exceeded</span>
          <span class="metric-value">${metrics.metrics.rateLimit.exceeded}</span>
        </div>
      </div>

      <div class="card">
        <h3>Memory Usage</h3>
        <div class="metric">
          <span class="metric-label">Heap Used</span>
          <span class="metric-value">${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div class="metric">
          <span class="metric-label">Heap Total</span>
          <span class="metric-value">${(metrics.memory.heapTotal / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div class="metric">
          <span class="metric-label">RSS</span>
          <span class="metric-value">${(metrics.memory.rss / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>
    </div>

    ${alerts.enabled ? `
    <div class="card">
      <h3>Alerts Summary</h3>
      <div class="metric">
        <span class="metric-label">Total Rules</span>
        <span class="metric-value">${alerts.summary.totalRules}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Firing</span>
        <span class="metric-value">${alerts.summary.firingAlerts}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Critical</span>
        <span class="metric-value">${alerts.summary.criticalAlerts}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Warning</span>
        <span class="metric-value">${alerts.summary.warningAlerts}</span>
      </div>
    </div>

    ${alerts.recentAlerts.length > 0 ? `
    <div class="card" style="margin-top: 20px;">
      <h3>Recent Alerts</h3>
      ${alerts.recentAlerts.map((alert: any) => `
        <div class="alert-item alert-${alert.severity}">
          <strong>${alert.ruleName}</strong> - ${alert.message}<br>
          <small>${new Date(alert.timestamp).toLocaleString()}</small>
        </div>
      `).join('')}
    </div>
    ` : ''}
    ` : ''}

    <div class="refresh">
      <button class="btn" onclick="location.reload()">Refresh</button>
      <span style="margin-left: 20px; color: #999;">Last updated: ${new Date().toLocaleString()}</span>
    </div>
  </div>

  <script>
    setTimeout(() => location.reload(), 30000); // Auto-refresh every 30s
  </script>
</body>
</html>
    `.trim();
  }

  /**
   * 获取 Prometheus 格式的指标
   */
  getPrometheusMetrics(): string {
    return this.metrics.toPrometheus();
  }
}
