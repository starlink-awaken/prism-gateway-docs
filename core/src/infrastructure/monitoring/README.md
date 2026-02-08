# 日志和监控系统使用指南

> 轻量级可观测性解决方案 - 无需外部依赖

## 目录

- [概述](#概述)
- [日志系统 (Logger)](#日志系统-logger)
- [指标收集 (Metrics)](#指标收集-metrics)
- [告警管理 (AlertManager)](#告警管理-alertmanager)
- [监控仪表板 (Dashboard)](#监控仪表板-dashboard)
- [与 API 集成](#与-api-集成)
- [最佳实践](#最佳实践)

---

## 概述

PRISM-Gateway 的日志和监控系统是一个**零外部依赖**的轻量级可观测性解决方案，提供：

- **结构化日志** - 基于 Pino 的高性能日志
- **指标收集** - Counter、Histogram、Gauge 三种指标类型
- **智能告警** - 可配置的告警规则和阈值
- **监控仪表板** - ASCII/HTML 两种格式的实时监控

### 设计原则

1. **轻量级** - 无需 Prometheus、Grafana 等外部系统
2. **生产就绪** - 结构化日志、指标聚合、告警节流
3. **易于集成** - Hono 中间件、简单 API

---

## 日志系统 (Logger)

### 基本使用

```typescript
import { Logger, LogLevel } from './infrastructure/index.js';

// 创建日志器
const logger = new Logger({
  name: 'auth-service',
  level: LogLevel.INFO,
  environment: 'production'
});

// 记录日志
logger.debug('Debug message');          // 低于 INFO 级别，不会输出
logger.info('User logged in', { userId: '123' });
logger.warn('High memory usage');
logger.error('Database connection failed', error);
```

### 请求追踪

```typescript
// 创建带请求 ID 的日志器
const requestLogger = logger.withRequest('req-abc-123');

// 所有日志都会自动包含 requestId
requestLogger.info('Processing request');
requestLogger.error('Request failed');

// 输出: { requestId: 'req-abc-123', msg: 'Processing request', ... }
```

### 上下文绑定

```typescript
// 创建带上下文的子日志器
const authLogger = logger.withContext({ module: 'auth' });
const loginLogger = authLogger.withContext({ action: 'login' });

// loginLogger 包含 { module: 'auth', action: 'login' }
loginLogger.info('Login successful', { userId: '123' });
```

### Hono 中间件

```typescript
import { Logger } from './infrastructure/index.js';
import { Hono } from 'hono';

const app = new Hono();
const logger = new Logger({ name: 'api' });

// 添加日志中间件
app.use('*', logger.honoMiddleware());

app.get('/api/test', (c) => {
  // 可以通过上下文获取日志器
  const requestLogger = c.get('logger');
  requestLogger.info('Handler executing');
  return c.json({ message: 'OK' });
});
```

### 敏感信息脱敏

日志系统会自动脱敏以下字段：

- `password`, `passwd`, `secret`
- `token`, `accessToken`, `refreshToken`
- `apiKey`, `authorization`
- `creditCard`, `cardNumber`, `cvv`

```typescript
logger.info('User login', {
  username: 'test',
  password: 'secret123'  // 输出为: se***23
});
```

---

## 指标收集 (Metrics)

### 基本使用

```typescript
import { Metrics } from './infrastructure/index.js';

const metrics = new Metrics({ prefix: 'myapp' });

// HTTP 请求指标
metrics.recordHttpRequest({
  method: 'GET',
  path: '/api/users',
  status: 200,
  duration: 45
});

// 缓存指标
metrics.recordCacheHit('users');
metrics.recordCacheMiss('sessions');

// 速率限制
metrics.recordRateLimitExceeded('auth', '127.0.0.1');
```

### 创建自定义指标

```typescript
// Counter - 单调递增计数器
const counter = metrics.createCounter('custom_events', 'Custom events');
counter.inc();
counter.inc(5, { type: 'click' });

// Histogram - 数值分布统计
const histogram = metrics.createHistogram('processing_time', 'Processing time (ms)');
histogram.observe(100);
histogram.observe(200);
histogram.observe(150);

console.log(histogram.percentile(95));  // 200
console.log(histogram.average);         // 150

// Gauge - 可增减的仪表
const gauge = metrics.createGauge('active_connections', 'Active connections');
gauge.set(10);
gauge.inc();   // 11
gauge.dec(2);  // 9
```

### 获取指标

```typescript
// 获取指标摘要
const summary = metrics.getSummary();
console.log(summary);
// {
//   totalRequests: 1000,
//   errorRate: 0.02,
//   avgResponseTime: 65.5,
//   p95ResponseTime: 120,
//   p99ResponseTime: 180,
//   cacheHitRate: 0.85,
//   rateLimitCount: 5
// }

// 导出 Prometheus 格式
const prometheus = metrics.toPrometheus();
console.log(prometheus);
// # HELP myapp_http_requests_total Total HTTP requests
// # TYPE myapp_http_requests_total counter
// myapp_http_requests_total 1000
// ...

// 导出 JSON 格式
const json = metrics.toJSON();
```

---

## 告警管理 (AlertManager)

### 基本使用

```typescript
import { AlertManager, AlertSeverity, AlertCondition } from './infrastructure/index.js';

const alertManager = new AlertManager({
  metrics,
  cooldown: 60000,  // 1 分钟冷却
  onAlert: (alert) => {
    console.log(`[ALERT] ${alert.ruleName}: ${alert.message}`);
    // 发送到通知系统（邮件、Slack 等）
  }
});
```

### 预定义的默认规则

AlertManager 默认初始化以下规则：

| 规则 ID | 触发条件 | 阈值 | 级别 |
|---------|----------|------|------|
| `default-error-rate` | 错误率过高 | 5% | WARNING |
| `default-response-time` | P95 响应时间慢 | 100ms | CRITICAL |
| `default-rate-limit` | 速率限制触发 | 10 次 | WARNING |
| `default-cache-hit-rate` | 缓存命中率低 | 80% | INFO |

### 自定义告警规则

```typescript
// 禁用默认规则
const alertManager = new AlertManager({
  metrics,
  initializeDefaultRules: false
});

// 添加自定义规则
alertManager.addRule({
  id: 'high-error-rate',
  name: 'High Error Rate',
  description: '错误率超过 10% 时触发',
  condition: AlertCondition.ERROR_RATE_HIGH,
  threshold: 0.10,
  severity: AlertSeverity.CRITICAL
});

alertManager.addRule({
  id: 'slow-p99',
  name: 'Slow P99 Response',
  condition: AlertCondition.RESPONSE_TIME_SLOW,
  threshold: 200,
  severity: AlertSeverity.WARNING,
  percentile: 99  // 使用 P99 而非默认的 P95
});

// 删除规则
alertManager.removeRule('default-cache-hit-rate');

// 更新规则
alertManager.updateRule('default-error-rate', { threshold: 0.03 });
```

### 规则评估

```typescript
// 手动评估所有规则
alertManager.evaluateRules();

// 获取规则状态
const status = alertManager.getAlertStatus('high-error-rate');
console.log(status);  // 'ok' | 'firing' | 'resolved'

// 获取告警摘要
const summary = alertManager.getSummary();
console.log(summary);
// {
//   totalRules: 4,
//   firingAlerts: 1,
//   okAlerts: 3,
//   criticalAlerts: 1,
//   warningAlerts: 0,
//   infoAlerts: 0
// }

// 获取告警历史
const history = alertManager.getAlertHistory('high-error-rate');
```

---

## 监控仪表板 (Dashboard)

### 基本使用

```typescript
import { Dashboard } from './infrastructure/index.js';

const dashboard = new Dashboard({
  metrics,
  alerts: alertManager,
  serviceName: 'prism-gateway',
  serviceVersion: '2.0.0'
});

// 获取健康状态
const health = dashboard.getHealth();
console.log(health);
// {
//   service: 'prism-gateway',
//   version: '2.0.0',
//   status: 'healthy',  // 'healthy' | 'degraded' | 'unhealthy'
//   uptime: 3600,
//   checks: { ... }
// }

// 获取指标摘要
const metricsSummary = dashboard.getMetricsSummary();

// 获取告警摘要
const alertsSummary = dashboard.getAlertsSummary();

// 获取完整仪表板数据
const fullData = dashboard.getDashboard();
```

### ASCII 控制台输出

```typescript
// 渲染 ASCII 仪表板（适合 CLI）
console.log(dashboard.renderASCII());
```

输出示例：

```
╔════════════════════════════════════════════════════════════╗
║          PRISM-GATEWAY MONITORING DASHBOARD                 ║
╠════════════════════════════════════════════════════════════╣
║  Version:     2.0.0              Uptime: 3600s              ║
║  Status:      HEALTHY            Time:   14:30:25           ║
╠════════════════════════════════════════════════════════════╣
║  REQUEST METRICS                                                ║
├────────────────────────────────────────────────────────────────┤
║  Total Requests:          1,234                              ║
║  Error Rate:              2.50%                              ║
║  Avg Response Time:       65.40ms                            ║
║  P95 Response Time:       120.00ms                           ║
║  P99 Response Time:       180.00ms                           ║
...
╚════════════════════════════════════════════════════════════╝
```

### HTML 网页输出

```typescript
// 渲染 HTML 仪表板（适合 Web）
const html = dashboard.renderHTML();

// 在 Hono 中使用
app.get('/dashboard', (c) => {
  return c.html(html);
});
```

### Prometheus 格式导出

```typescript
// Prometheus 格式
const prometheus = dashboard.getPrometheusMetrics();

// 在 Hono 中使用
app.get('/metrics', (c) => {
  c.header('Content-Type', 'text/plain');
  return c.text(prometheus);
});
```

---

## 与 API 集成

### 完整示例

```typescript
import { Hono } from 'hono';
import { Logger, Metrics, AlertManager, Dashboard } from './infrastructure/index.js';

const app = new Hono();

// 1. 初始化日志
const logger = new Logger({ name: 'api' });

// 2. 初始化指标
const metrics = new Metrics({ prefix: 'prism' });

// 3. 初始化告警
const alertManager = new AlertManager({
  metrics,
  onAlert: (alert) => {
    logger.error('Alert fired', { alert });
  }
});

// 4. 初始化仪表板
const dashboard = new Dashboard({
  metrics,
  alerts: alertManager,
  serviceName: 'prism-gateway'
});

// 5. 添加中间件
app.use('*', logger.honoMiddleware());

// 6. 添加监控端点
app.get('/health', (c) => c.json(dashboard.getHealth()));
app.get('/metrics', (c) => {
  c.header('Content-Type', 'text/plain');
  return c.text(dashboard.getPrometheusMetrics());
});
app.get('/dashboard', (c) => c.html(dashboard.renderHTML()));

// 7. 业务路由
app.get('/api/users', async (c) => {
  const requestLogger = c.get('logger');
  const start = Date.now();

  try {
    // 业务逻辑
    const users = await fetchUsers();

    // 记录成功请求
    metrics.recordHttpRequest({
      method: c.req.method,
      path: c.req.path,
      status: 200,
      duration: Date.now() - start
    });

    return c.json(users);
  } catch (error) {
    // 记录失败请求
    metrics.recordHttpRequest({
      method: c.req.method,
      path: c.req.path,
      status: 500,
      duration: Date.now() - start
    });

    requestLogger.error('Request failed', error);
    throw error;
  }
});

// 8. 定期评估告警（可选）
setInterval(() => {
  alertManager.evaluateRules();
}, 30000); // 每 30 秒
```

---

## 最佳实践

### 1. 日志级别选择

| 场景 | 推荐级别 | 示例 |
|------|----------|------|
| 开发环境 | DEBUG | 记录所有详细信息 |
| 生产环境 | INFO | 记录正常业务流程 |
| 敏感操作 | INFO | 用户登录、权限变更 |
| 异常情况 | WARN | 降级服务、重试 |
| 错误情况 | ERROR | 请求失败、异常 |

### 2. 告警阈值配置

| 指标 | 推荐阈值 | 级别 |
|------|----------|------|
| 错误率 | 5% | WARNING |
| 错误率 | 10% | CRITICAL |
| P95 响应时间 | 100ms | WARNING |
| P95 响应时间 | 200ms | CRITICAL |
| P99 响应时间 | 200ms | WARNING |
| P99 响应时间 | 500ms | CRITICAL |
| 缓存命中率 | <80% | INFO |
| 缓存命中率 | <50% | WARNING |

### 3. 性能考虑

- **异步日志** - Pino 默认异步写入，不阻塞请求
- **内存限制** - 直方图默认只保留最近 1000 个值
- **告警节流** - 使用 cooldown 防止告警风暴

### 4. 安全建议

- **敏感信息** - 日志系统会自动脱敏，但需检查自定义字段
- **访问控制** - 监控端点应该需要认证
- **数据保留** - 定期清理旧数据

---

## API 参考

详细的 API 文档请查看各模块的 TSDoc 注释：

- `Logger.ts` - 日志系统
- `Metrics.ts` - 指标收集
- `AlertManager.ts` - 告警管理
- `Dashboard.ts` - 监控仪表板
