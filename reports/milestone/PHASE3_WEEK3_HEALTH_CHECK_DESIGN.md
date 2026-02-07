# Phase 3 Week 3: 健康检查系统设计文档

> **任务编号**: Task 3.2
> **设计时间**: 2026-02-07
> **预计工时**: 8 小时
> **状态**: 📝 设计中

---

## 1. 设计目标

### 1.1 核心目标

为 PRISM-Gateway 系统设计和实现一个全面的健康检查系统，实时监控系统各组件的运行状态，及时发现和报告异常。

**关键要求**:
- **多维度检查**: 覆盖系统、应用、数据、网络等多个层面
- **实时监控**: 持续检查，快速响应异常
- **轻量级**: 最小化性能开销
- **可扩展**: 易于添加新的检查项
- **自愈能力**: 发现问题自动尝试修复

### 1.2 验收标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| **检查延迟** | 单次检查耗时 | <100ms |
| **检查频率** | 关键组件检查间隔 | 30s |
| **异常检测率** | 问题发现准确率 | >95% |
| **误报率** | 假阳性率 | <5% |
| **性能开销** | CPU 占用 | <2% |
| **内存开销** | 内存占用 | <50MB |

---

## 2. 架构设计

### 2.1 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    健康检查系统架构图                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      │
│  │  调度引擎    │─────>│  检查器      │─────>│  报告生成器  │      │
│  │  Scheduler  │      │  Checkers   │      │  Reporter   │      │
│  └─────────────┘      └─────────────┘      └─────────────┘      │
│       │                     │                     │              │
│       │                     │                     │              │
│       ▼                     ▼                     ▼              │
│  ┌────────────────────────────────────────────────────────┐     │
│  │               健康检查项 (Health Checks)                │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │     │
│  │ │System    │ │ Memory   │ │  Disk    │ │ Network  │  │     │
│  │ │  Check   │ │  Check   │ │  Check   │ │  Check   │  │     │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │     │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │     │
│  │ │  API     │ │WebSocket │ │  Data    │ │ Service  │  │     │
│  │ │  Check   │ │  Check   │ │  Check   │ │  Check   │  │     │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                 健康状态存储 (Health Store)              │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ • 当前状态 (current-health.json)                        │     │
│  │ • 历史记录 (health-history.jsonl)                      │     │
│  │ • 告警历史 (health-alerts.jsonl)                       │     │
│  └────────────────────────────────────────────────────────┘     │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                  告警系统 (Alerting)                     │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │ • 异常检测                                              │     │
│  │ • 告警发送                                              │     │
│  │ • 自愈尝试                                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 HealthCheckService (主服务类)

```typescript
/**
 * 健康检查服务主类
 * 提供注册检查项、执行检查、获取状态等功能
 */
export class HealthCheckService {
  private checkers: Map<string, HealthChecker>;
  private scheduler: HealthScheduler;
  private store: HealthStore;
  private alerting: AlertingService;

  /**
   * 注册健康检查项
   * @param checker 检查器实例
   */
  registerChecker(checker: HealthChecker): void {
    this.checkers.set(checker.name, checker);
  }

  /**
   * 执行所有健康检查
   * @returns 健康检查结果
   */
  async checkAll(): Promise<HealthReport> {
    const results: HealthCheckResult[] = [];

    for (const [name, checker] of this.checkers) {
      try {
        const result = await checker.check();
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: HealthStatus.Error,
          message: `Check failed: ${error.message}`,
          timestamp: new Date(),
          duration: 0
        });
      }
    }

    const report = this.generateReport(results);
    await this.store.saveReport(report);

    // 检测异常并告警
    if (report.status !== HealthStatus.Healthy) {
      await this.alerting.handleUnhealthy(report);
    }

    return report;
  }

  /**
   * 执行单个健康检查
   * @param checkerName 检查器名称
   * @returns 检查结果
   */
  async checkOne(checkerName: string): Promise<HealthCheckResult> {
    const checker = this.checkers.get(checkerName);
    if (!checker) {
      throw new Error(`Checker not found: ${checkerName}`);
    }

    return await checker.check();
  }

  /**
   * 获取当前健康状态
   * @returns 健康报告
   */
  async getCurrentHealth(): Promise<HealthReport> {
    return await this.store.getCurrentHealth();
  }

  /**
   * 获取健康历史
   * @param options 查询选项（时间范围、分页）
   * @returns 历史记录
   */
  async getHistory(options: HistoryOptions): Promise<HealthReport[]> {
    return await this.store.getHistory(options);
  }

  /**
   * 启动健康检查调度
   */
  async start(): Promise<void> {
    // 立即执行一次检查
    await this.checkAll();

    // 启动定时调度
    await this.scheduler.start();
  }

  /**
   * 停止健康检查调度
   */
  async stop(): Promise<void> {
    await this.scheduler.stop();
  }

  /**
   * 生成健康报告
   * @param results 检查结果列表
   * @returns 健康报告
   */
  private generateReport(results: HealthCheckResult[]): HealthReport {
    // 计算整体状态（最差状态）
    const overallStatus = this.calculateOverallStatus(results);

    // 统计各状态数量
    const stats = this.calculateStats(results);

    return {
      timestamp: new Date(),
      status: overallStatus,
      checks: results,
      stats,
      metadata: {
        checkerCount: this.checkers.size,
        duration: results.reduce((sum, r) => sum + r.duration, 0)
      }
    };
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallStatus(results: HealthCheckResult[]): HealthStatus {
    // 优先级: Error > Degraded > Healthy
    if (results.some(r => r.status === HealthStatus.Error)) {
      return HealthStatus.Error;
    }
    if (results.some(r => r.status === HealthStatus.Degraded)) {
      return HealthStatus.Degraded;
    }
    return HealthStatus.Healthy;
  }
}
```

#### 2.2.2 HealthChecker (检查器基类)

```typescript
/**
 * 健康检查器基类
 * 所有检查器必须继承此类
 */
export abstract class HealthChecker {
  abstract name: string;
  abstract description: string;
  abstract interval: number; // 检查间隔（毫秒）

  /**
   * 执行健康检查
   * @returns 检查结果
   */
  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const result = await this.performCheck();
      const duration = Date.now() - startTime;

      return {
        name: this.name,
        status: result.status,
        message: result.message,
        details: result.details,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      return {
        name: this.name,
        status: HealthStatus.Error,
        message: `Check failed: ${error.message}`,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 实际检查逻辑（子类实现）
   */
  protected abstract performCheck(): Promise<CheckResult>;

  /**
   * 自愈尝试（可选，子类可覆盖）
   */
  async attemptSelfHeal(): Promise<boolean> {
    // 默认不实现自愈
    return false;
  }
}
```

#### 2.2.3 内置检查器

##### SystemHealthChecker (系统健康检查)

```typescript
/**
 * 系统级健康检查
 * 检查 CPU、内存、负载等系统指标
 */
export class SystemHealthChecker extends HealthChecker {
  name = 'system';
  description = 'System resource health check';
  interval = 30000; // 30 seconds

  protected async performCheck(): Promise<CheckResult> {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = await this.getMemoryUsage();
    const loadAverage = os.loadavg();

    // CPU 阈值: >90% Error, >70% Degraded
    if (cpuUsage > 90) {
      return {
        status: HealthStatus.Error,
        message: `High CPU usage: ${cpuUsage.toFixed(1)}%`,
        details: { cpuUsage, memoryUsage, loadAverage }
      };
    }

    if (cpuUsage > 70) {
      return {
        status: HealthStatus.Degraded,
        message: `Elevated CPU usage: ${cpuUsage.toFixed(1)}%`,
        details: { cpuUsage, memoryUsage, loadAverage }
      };
    }

    // 内存阈值: >85% Error, >70% Degraded
    if (memoryUsage > 85) {
      return {
        status: HealthStatus.Error,
        message: `High memory usage: ${memoryUsage.toFixed(1)}%`,
        details: { cpuUsage, memoryUsage, loadAverage }
      };
    }

    if (memoryUsage > 70) {
      return {
        status: HealthStatus.Degraded,
        message: `Elevated memory usage: ${memoryUsage.toFixed(1)}%`,
        details: { cpuUsage, memoryUsage, loadAverage }
      };
    }

    return {
      status: HealthStatus.Healthy,
      message: `System resources normal (CPU: ${cpuUsage.toFixed(1)}%, Memory: ${memoryUsage.toFixed(1)}%)`,
      details: { cpuUsage, memoryUsage, loadAverage }
    };
  }

  private async getCPUUsage(): Promise<number> {
    // 计算 CPU 使用率（平均值）
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    return ((totalTick - totalIdle) / totalTick) * 100;
  }

  private async getMemoryUsage(): Promise<number> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    return ((totalMemory - freeMemory) / totalMemory) * 100;
  }
}
```

##### DiskHealthChecker (磁盘健康检查)

```typescript
/**
 * 磁盘健康检查
 * 检查磁盘空间、I/O 性能
 */
export class DiskHealthChecker extends HealthChecker {
  name = 'disk';
  description = 'Disk space and I/O health check';
  interval = 60000; // 60 seconds

  protected async performCheck(): Promise<CheckResult> {
    const dataRoot = '~/.prism-gateway';
    const usage = await this.getDiskUsage(dataRoot);

    // 磁盘空间阈值: >90% Error, >80% Degraded
    if (usage.usagePercent > 90) {
      return {
        status: HealthStatus.Error,
        message: `Disk space critical: ${usage.usagePercent.toFixed(1)}% used`,
        details: usage
      };
    }

    if (usage.usagePercent > 80) {
      return {
        status: HealthStatus.Degraded,
        message: `Disk space low: ${usage.usagePercent.toFixed(1)}% used`,
        details: usage
      };
    }

    return {
      status: HealthStatus.Healthy,
      message: `Disk space normal: ${usage.usagePercent.toFixed(1)}% used`,
      details: usage
    };
  }

  private async getDiskUsage(path: string): Promise<DiskUsage> {
    const stats = await fs.statfs(path);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    const used = total - free;

    return {
      total,
      free,
      used,
      usagePercent: (used / total) * 100
    };
  }

  async attemptSelfHeal(): Promise<boolean> {
    // 尝试清理临时文件
    try {
      await fs.rm('/tmp/prism-*', { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
}
```

##### APIHealthChecker (API 健康检查)

```typescript
/**
 * API 健康检查
 * 检查 REST API 端点的可用性和响应时间
 */
export class APIHealthChecker extends HealthChecker {
  name = 'api';
  description = 'REST API endpoint health check';
  interval = 30000; // 30 seconds

  protected async performCheck(): Promise<CheckResult> {
    const endpoints = [
      { path: '/api/v1/health', timeout: 1000 },
      { path: '/api/v1/analytics/dashboard', timeout: 3000 }
    ];

    const results = await Promise.all(
      endpoints.map(async (endpoint) => {
        const startTime = Date.now();
        try {
          const response = await fetch(`http://localhost:3000${endpoint.path}`, {
            signal: AbortSignal.timeout(endpoint.timeout)
          });

          const duration = Date.now() - startTime;

          return {
            path: endpoint.path,
            status: response.status,
            duration,
            healthy: response.status < 400
          };
        } catch (error) {
          return {
            path: endpoint.path,
            status: 0,
            duration: Date.now() - startTime,
            healthy: false,
            error: error.message
          };
        }
      })
    );

    const failedEndpoints = results.filter(r => !r.healthy);

    if (failedEndpoints.length === results.length) {
      return {
        status: HealthStatus.Error,
        message: 'All API endpoints are down',
        details: { results }
      };
    }

    if (failedEndpoints.length > 0) {
      return {
        status: HealthStatus.Degraded,
        message: `${failedEndpoints.length}/${results.length} API endpoints unhealthy`,
        details: { results }
      };
    }

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    return {
      status: HealthStatus.Healthy,
      message: `All API endpoints healthy (avg ${avgDuration.toFixed(0)}ms)`,
      details: { results }
    };
  }

  async attemptSelfHeal(): Promise<boolean> {
    // 尝试重启 API 服务（通过发送 SIGHUP 信号）
    try {
      // 实际实现需要根据进程管理方式调整
      return false; // 暂不实现
    } catch {
      return false;
    }
  }
}
```

##### WebSocketHealthChecker (WebSocket 健康检查)

```typescript
/**
 * WebSocket 健康检查
 * 检查 WebSocket 连接的可用性和延迟
 */
export class WebSocketHealthChecker extends HealthChecker {
  name = 'websocket';
  description = 'WebSocket connection health check';
  interval = 30000; // 30 seconds

  protected async performCheck(): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      const ws = new WebSocket('ws://localhost:3000/ws');

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          const latency = Date.now() - startTime;

          // 发送 ping，测试消息延迟
          const pingStart = Date.now();
          ws.send(JSON.stringify({ type: 'ping' }));

          ws.onmessage = (event) => {
            const pongLatency = Date.now() - pingStart;
            ws.close();

            if (pongLatency > 500) {
              resolve();
              return {
                status: HealthStatus.Degraded,
                message: `WebSocket latency high: ${pongLatency}ms`,
                details: { latency, pongLatency }
              };
            }

            resolve();
          };
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });

      return {
        status: HealthStatus.Healthy,
        message: 'WebSocket connection healthy',
        details: { latency: Date.now() - startTime }
      };
    } catch (error) {
      return {
        status: HealthStatus.Error,
        message: `WebSocket connection failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }
}
```

##### DataHealthChecker (数据健康检查)

```typescript
/**
 * 数据健康检查
 * 检查数据文件的完整性和可访问性
 */
export class DataHealthChecker extends HealthChecker {
  name = 'data';
  description = 'Data integrity health check';
  interval = 120000; // 120 seconds

  protected async performCheck(): Promise<CheckResult> {
    const checks = [
      { path: 'level-1-hot/principles.json', required: true },
      { path: 'level-2-warm/violations.jsonl', required: true },
      { path: 'level-3-cold/sops/', required: true }
    ];

    const results = await Promise.all(
      checks.map(async (check) => {
        const fullPath = path.join('~/.prism-gateway', check.path);
        try {
          await fs.access(fullPath, fs.constants.R_OK);
          const stats = await fs.stat(fullPath);
          return {
            path: check.path,
            accessible: true,
            size: stats.isDirectory() ? null : stats.size,
            mtime: stats.mtime
          };
        } catch (error) {
          return {
            path: check.path,
            accessible: false,
            error: error.message,
            required: check.required
          };
        }
      })
    );

    const inaccessible = results.filter(r => !r.accessible);
    const requiredInaccessible = inaccessible.filter(r => r.required);

    if (requiredInaccessible.length > 0) {
      return {
        status: HealthStatus.Error,
        message: `Critical data files inaccessible: ${requiredInaccessible.map(r => r.path).join(', ')}`,
        details: { results }
      };
    }

    if (inaccessible.length > 0) {
      return {
        status: HealthStatus.Degraded,
        message: `Some data files inaccessible: ${inaccessible.map(r => r.path).join(', ')}`,
        details: { results }
      };
    }

    return {
      status: HealthStatus.Healthy,
      message: 'All data files accessible',
      details: { results }
    };
  }

  async attemptSelfHeal(): Promise<boolean> {
    // 尝试从备份恢复数据文件
    try {
      // 调用 BackupService.restore()
      return false; // 暂不实现
    } catch {
      return false;
    }
  }
}
```

##### ServiceHealthChecker (服务依赖检查)

```typescript
/**
 * 服务依赖健康检查
 * 检查外部服务（如 MCP Server）的可用性
 */
export class ServiceHealthChecker extends HealthChecker {
  name = 'services';
  description = 'External services health check';
  interval = 60000; // 60 seconds

  protected async performCheck(): Promise<CheckResult> {
    const services = [
      { name: 'MCP Server', port: 3001 },
      // 未来可添加更多服务
    ];

    const results = await Promise.all(
      services.map(async (service) => {
        try {
          const socket = new net.Socket();
          const timeout = setTimeout(() => {
            socket.destroy();
          }, 2000);

          await new Promise<void>((resolve, reject) => {
            socket.connect(service.port, 'localhost', () => {
              clearTimeout(timeout);
              socket.destroy();
              resolve();
            });

            socket.on('error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });

          return {
            name: service.name,
            port: service.port,
            accessible: true
          };
        } catch (error) {
          return {
            name: service.name,
            port: service.port,
            accessible: false,
            error: error.message
          };
        }
      })
    );

    const down = results.filter(r => !r.accessible);

    if (down.length === results.length) {
      return {
        status: HealthStatus.Error,
        message: 'All external services are down',
        details: { results }
      };
    }

    if (down.length > 0) {
      return {
        status: HealthStatus.Degraded,
        message: `${down.length}/${results.length} external services down`,
        details: { results }
      };
    }

    return {
      status: HealthStatus.Healthy,
      message: 'All external services healthy',
      details: { results }
    };
  }
}
```

---

## 3. 数据模型

### 3.1 核心类型定义

```typescript
/**
 * 健康状态枚举
 */
export enum HealthStatus {
  Healthy = 'healthy',     // 健康
  Degraded = 'degraded',   // 降级（部分功能受影响）
  Error = 'error'          // 错误（严重问题）
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  /** 检查器名称 */
  name: string;

  /** 健康状态 */
  status: HealthStatus;

  /** 状态描述 */
  message: string;

  /** 详细信息 */
  details?: Record<string, any>;

  /** 检查时间 */
  timestamp: Date;

  /** 检查耗时（毫秒） */
  duration: number;
}

/**
 * 健康报告
 */
export interface HealthReport {
  /** 报告时间 */
  timestamp: Date;

  /** 整体健康状态 */
  status: HealthStatus;

  /** 所有检查结果 */
  checks: HealthCheckResult[];

  /** 统计信息 */
  stats: HealthStats;

  /** 元数据 */
  metadata: {
    checkerCount: number;
    duration: number;
  };
}

/**
 * 健康统计
 */
export interface HealthStats {
  /** 健康检查项数量 */
  healthy: number;

  /** 降级检查项数量 */
  degraded: number;

  /** 错误检查项数量 */
  error: number;

  /** 总检查项数量 */
  total: number;
}

/**
 * 检查结果（内部使用）
 */
export interface CheckResult {
  status: HealthStatus;
  message: string;
  details?: Record<string, any>;
}

/**
 * 历史查询选项
 */
export interface HistoryOptions {
  /** 开始时间 */
  startTime?: Date;

  /** 结束时间 */
  endTime?: Date;

  /** 状态过滤 */
  status?: HealthStatus;

  /** 分页：页码 */
  page?: number;

  /** 分页：每页数量 */
  perPage?: number;
}

/**
 * 磁盘使用情况
 */
export interface DiskUsage {
  total: number;        // 总空间（字节）
  free: number;         // 可用空间（字节）
  used: number;         // 已用空间（字节）
  usagePercent: number; // 使用率（百分比）
}
```

---

## 4. 功能规格

### 4.1 健康检查执行流程

```typescript
/**
 * 健康检查执行流程:
 * 1. 调度器触发检查
 * 2. 并发执行所有检查器
 * 3. 收集检查结果
 * 4. 生成健康报告
 * 5. 保存到存储
 * 6. 检测异常并告警
 * 7. 尝试自愈（如果需要）
 */
async function performHealthCheck(): Promise<HealthReport> {
  const startTime = Date.now();

  // Step 1-2: 并发执行所有检查
  const checkPromises = Array.from(this.checkers.values()).map(checker =>
    checker.check().catch(error => ({
      name: checker.name,
      status: HealthStatus.Error,
      message: error.message,
      timestamp: new Date(),
      duration: 0
    }))
  );

  const results = await Promise.all(checkPromises);

  // Step 3-4: 生成报告
  const report = {
    timestamp: new Date(),
    status: calculateOverallStatus(results),
    checks: results,
    stats: calculateStats(results),
    metadata: {
      checkerCount: this.checkers.size,
      duration: Date.now() - startTime
    }
  };

  // Step 5: 保存报告
  await this.store.saveReport(report);

  // Step 6: 检测异常并告警
  if (report.status !== HealthStatus.Healthy) {
    await this.handleUnhealthy(report);
  }

  return report;
}

/**
 * 处理不健康状态
 */
async function handleUnhealthy(report: HealthReport): Promise<void> {
  const unhealthyChecks = report.checks.filter(
    c => c.status !== HealthStatus.Healthy
  );

  for (const check of unhealthyChecks) {
    // Step 6a: 发送告警
    await this.alerting.send({
      level: check.status === HealthStatus.Error ? 'error' : 'warning',
      title: `Health Check Failed: ${check.name}`,
      message: check.message,
      details: check.details
    });

    // Step 7: 尝试自愈
    const checker = this.checkers.get(check.name);
    if (checker) {
      const healed = await checker.attemptSelfHeal();
      if (healed) {
        await this.alerting.send({
          level: 'info',
          title: `Self-Healing Successful: ${check.name}`,
          message: 'System recovered automatically'
        });
      }
    }
  }
}
```

### 4.2 健康状态存储

```typescript
/**
 * 健康状态存储格式:
 *
 * ~/.prism-gateway/health/
 * ├── current-health.json       # 当前健康状态（覆盖写入）
 * ├── health-history.jsonl      # 历史记录（追加写入，JSONL 格式）
 * └── health-alerts.jsonl       # 告警历史（追加写入）
 */

// current-health.json 示例
{
  "timestamp": "2026-02-07T16:30:00.000Z",
  "status": "healthy",
  "checks": [
    {
      "name": "system",
      "status": "healthy",
      "message": "System resources normal (CPU: 23.5%, Memory: 45.2%)",
      "details": {
        "cpuUsage": 23.5,
        "memoryUsage": 45.2,
        "loadAverage": [1.23, 1.45, 1.67]
      },
      "timestamp": "2026-02-07T16:30:00.000Z",
      "duration": 12
    },
    // ... 其他检查结果
  ],
  "stats": {
    "healthy": 7,
    "degraded": 0,
    "error": 0,
    "total": 7
  },
  "metadata": {
    "checkerCount": 7,
    "duration": 87
  }
}

// health-history.jsonl 示例（每行一个 JSON 对象）
{"timestamp":"2026-02-07T16:00:00.000Z","status":"healthy","stats":{"healthy":7,"degraded":0,"error":0,"total":7}}
{"timestamp":"2026-02-07T16:30:00.000Z","status":"healthy","stats":{"healthy":7,"degraded":0,"error":0,"total":7}}
{"timestamp":"2026-02-07T17:00:00.000Z","status":"degraded","stats":{"healthy":6,"degraded":1,"error":0,"total":7}}
```

### 4.3 调度策略

```typescript
/**
 * 健康检查调度配置
 */
const scheduleConfig = {
  // 关键检查项：30 秒
  critical: ['system', 'api', 'websocket'],
  criticalInterval: 30000,

  // 次要检查项：60 秒
  important: ['disk', 'data'],
  importantInterval: 60000,

  // 普通检查项：120 秒
  normal: ['services'],
  normalInterval: 120000,
};

/**
 * 调度器实现
 */
class HealthScheduler {
  async start(): Promise<void> {
    // 关键检查项：每 30 秒执行
    setInterval(() => {
      this.runChecks(scheduleConfig.critical);
    }, scheduleConfig.criticalInterval);

    // 次要检查项：每 60 秒执行
    setInterval(() => {
      this.runChecks(scheduleConfig.important);
    }, scheduleConfig.importantInterval);

    // 普通检查项：每 120 秒执行
    setInterval(() => {
      this.runChecks(scheduleConfig.normal);
    }, scheduleConfig.normalInterval);
  }

  private async runChecks(checkerNames: string[]): Promise<void> {
    for (const name of checkerNames) {
      const checker = this.service.checkers.get(name);
      if (checker) {
        await checker.check();
      }
    }
  }
}
```

---

## 5. CLI 命令设计

```bash
# 查看当前健康状态
prism health
# Output:
# ✅ System Health: Healthy
#
# Checks:
#   ✅ system     - System resources normal (CPU: 23.5%, Memory: 45.2%)
#   ✅ disk       - Disk space normal: 68.3% used
#   ✅ api        - All API endpoints healthy (avg 89ms)
#   ✅ websocket  - WebSocket connection healthy
#   ✅ data       - All data files accessible
#   ✅ services   - All external services healthy
#
# Stats:
#   Healthy: 6 | Degraded: 0 | Error: 0 | Total: 6
#   Last Check: 2026-02-07 16:30:00 (2 minutes ago)

# 执行单个健康检查
prism health check system
# Output:
# ✅ system: System resources normal (CPU: 23.5%, Memory: 45.2%)
# Duration: 12ms

# 查看健康历史
prism health history --hours 24
# Output:
# Health History (Last 24 hours):
#
# Time                Status     Healthy  Degraded  Error
# ──────────────────────────────────────────────────────
# 2026-02-07 16:30    ✅ Healthy    7        0        0
# 2026-02-07 16:00    ✅ Healthy    7        0        0
# 2026-02-07 15:30    ⚠️  Degraded   6        1        0
# 2026-02-07 15:00    ✅ Healthy    7        0        0

# 查看健康趋势
prism health trend --days 7
# Output:
# Health Trend (Last 7 days):
#
# Day         Healthy%  Degraded%  Error%  Avg Duration
# ─────────────────────────────────────────────────────
# 2026-02-07   98.5%      1.5%      0.0%      87ms
# 2026-02-06   97.2%      2.8%      0.0%      92ms
# 2026-02-05  100.0%      0.0%      0.0%      85ms

# 启动健康检查服务
prism health start
# Output:
# ✅ Health check service started
# Checking every 30s (critical), 60s (important), 120s (normal)

# 停止健康检查服务
prism health stop
# Output:
# ✅ Health check service stopped
```

---

## 6. API 接口设计

### 6.1 REST API 端点

```typescript
// GET /api/v1/health
// 获取当前健康状态（简化版）
router.get('/health', async (c) => {
  const health = await healthService.getCurrentHealth();
  return c.json({
    status: health.status,
    timestamp: health.timestamp
  });
});

// GET /api/v1/health/full
// 获取完整健康报告
router.get('/health/full', async (c) => {
  const health = await healthService.getCurrentHealth();
  return c.json(health);
});

// POST /api/v1/health/check
// 触发健康检查
router.post('/health/check', async (c) => {
  const { checker } = await c.req.json();
  if (checker) {
    const result = await healthService.checkOne(checker);
    return c.json(result);
  } else {
    const report = await healthService.checkAll();
    return c.json(report);
  }
});

// GET /api/v1/health/history
// 获取健康历史
router.get('/health/history', async (c) => {
  const query = c.req.query();
  const options = {
    startTime: query.start ? new Date(query.start) : undefined,
    endTime: query.end ? new Date(query.end) : undefined,
    status: query.status as HealthStatus,
    page: query.page ? parseInt(query.page) : 1,
    perPage: query.perPage ? parseInt(query.perPage) : 50
  };

  const history = await healthService.getHistory(options);
  return c.json({ history });
});

// GET /api/v1/health/stats
// 获取健康统计
router.get('/health/stats', async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const stats = await healthService.getStats(days);
  return c.json(stats);
});
```

---

## 7. Web UI 集成

### 7.1 健康状态卡片

```typescript
/**
 * HealthCard 组件
 * 显示当前整体健康状态
 */
export function HealthCard() {
  const { health } = useHealthStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {health.status === 'healthy' && <CheckCircle className="w-5 h-5 text-green-600" />}
          {health.status === 'degraded' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
          {health.status === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {health.status === 'healthy' && '✅ Healthy'}
          {health.status === 'degraded' && '⚠️ Degraded'}
          {health.status === 'error' && '❌ Error'}
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          Last checked: {formatDistanceToNow(health.timestamp)} ago
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-green-600 font-semibold">{health.stats.healthy}</div>
            <div className="text-xs">Healthy</div>
          </div>
          <div>
            <div className="text-yellow-600 font-semibold">{health.stats.degraded}</div>
            <div className="text-xs">Degraded</div>
          </div>
          <div>
            <div className="text-red-600 font-semibold">{health.stats.error}</div>
            <div className="text-xs">Error</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 7.2 健康检查列表

```typescript
/**
 * HealthCheckList 组件
 * 显示所有健康检查项的详细状态
 */
export function HealthCheckList() {
  const { health } = useHealthStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Checks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {health.checks.map((check) => (
            <div key={check.name} className="flex items-start gap-3 p-2 rounded hover:bg-muted">
              <div className="mt-1">
                {check.status === 'healthy' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {check.status === 'degraded' && <AlertCircle className="w-4 h-4 text-yellow-600" />}
                {check.status === 'error' && <XCircle className="w-4 h-4 text-red-600" />}
              </div>
              <div className="flex-1">
                <div className="font-medium">{check.name}</div>
                <div className="text-sm text-muted-foreground">{check.message}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Duration: {check.duration}ms
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 8. 实现计划

### 8.1 任务分解 (8 小时)

| 任务 | 工时 | 优先级 | 依赖 |
|------|------|--------|------|
| **1. 数据模型定义** | 0.5h | P0 | 无 |
| **2. HealthChecker 基类** | 0.5h | P0 | 1 |
| **3. HealthStore 实现** | 1h | P0 | 1 |
| **4. HealthCheckService 实现** | 1h | P0 | 2, 3 |
| **5. 内置检查器实现** | 2h | P0 | 2 |
| **6. HealthScheduler 实现** | 1h | P1 | 4 |
| **7. CLI 命令实现** | 1h | P1 | 4 |
| **8. API 端点实现** | 0.5h | P2 | 4 |
| **9. 单元测试** | 1h | P0 | 2-8 |
| **10. 集成测试** | 0.5h | P1 | 9 |

### 8.2 验收检查清单

- [ ] 所有内置检查器正常工作
- [ ] 健康状态正确计算和报告
- [ ] 调度器按配置执行检查
- [ ] 历史记录正确保存和查询
- [ ] CLI 命令全部可用
- [ ] API 端点全部可用
- [ ] 自愈机制触发正常
- [ ] 单元测试覆盖率 >90%
- [ ] 集成测试通过
- [ ] 文档完整清晰

---

## 9. 参考文档

- [Kubernetes Liveness/Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Spring Boot Actuator Health](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html#actuator.endpoints.health)
- [Node.js OS Module](https://nodejs.org/api/os.html)
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-07
**作者**: AI Assistant (Claude Sonnet 4.5)
**审核人**: PRISM-Gateway Team
**下一步**: Task 3.3 监控指标收集设计
