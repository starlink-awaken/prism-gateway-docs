# ReflectGuard Phase 2 系统架构设计文档

**文档版本：** 2.0.0
**创建时间：** 2026-02-04
**架构师：** Architect Agent
**项目状态：** Phase 1 MVP 完成，Phase 2 设计中

---

## 📋 文档目录

1. [架构概述](#1-架构概述)
2. [设计原则](#2-设计原则)
3. [功能模块](#3-功能模块)
4. [技术方案](#4-技术方案)
5. [接口设计](#5-接口设计)
6. [性能优化](#6-性能优化)
7. [扩展性设计](#7-扩展性设计)
8. [安全方案](#8-安全方案)
9. [实施路线图](#9-实施路线图)
10. [风险评估](#10-风险评估)

---

## 1. 架构概述

### 1.1 设计理念

ReflectGuard Phase 2 基于 Phase 1 MVP 的成功经验，在保持**轻量级设计原则**的前提下，向**生产就绪系统**演进。

**核心理念：**
1. **渐进式增强** - 在Phase 1基础上逐步增加能力，而非重构
2. **最小化依赖** - 优先使用内置能力，避免引入重量级依赖
3. **体验优先** - 用户体验优于技术炫酷
4. **可观测性** - 让系统状态透明可见
5. **可扩展性** - 为未来需求预留扩展点

### 1.2 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ReflectGuard Phase 2 架构                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐ │
│  │   用户交互层         │    │    集成层           │    │    数据层        │ │
│  ├─────────────────────┤    ├─────────────────────┤    ├─────────────────┤ │
│  │ • CLI (v2.0)        │    │ • MCP Server        │    │ • Hot Store      │ │
│  │ • Web UI (NEW)      │◄───┤ • Skill Framework   │◄───┤ • Warm Archive   │ │
│  │ • REST API (NEW)    │    │ • Hook System v2    │    │ • Cold Knowledge │ │
│  │ • WebSocket (NEW)   │    │ • Event Bus (NEW)   │    │ • Index Engine   │ │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘ │
│           │                            │                           ▲        │
│           ▼                            ▼                           │        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        核心服务层 (Core Services)                    │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │ │GatewayGuard │ │ DataExtract │ │Retrospective│ │PatternMatch │    │   │
│  │ │    v2.0     │ │    v2.0     │ │    v2.0     │ │    v2.0     │    │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │ │Analytics    │ │Scheduler    │ │Notifier     │ │Validator    │    │   │
│  │ │  (NEW)      │ │  (NEW)      │ │  (NEW)      │ │  (NEW)      │    │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     新增：基础设施层 (Infrastructure)                │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │ │Metrics      │ │Logger       │ │Cache        │ │Queue        │    │   │
│  │ │Collector    │ │Structured   │ │In-Memory    │ │In-Memory    │    │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 架构分层说明

| 层级 | 职责 | Phase 2 新增 |
|------|------|-------------|
| **用户交互层** | 提供多种交互方式 | Web UI、REST API、WebSocket |
| **集成层** | 与外部系统集成 | MCP Server、Event Bus |
| **核心服务层** | 业务逻辑处理 | Analytics、Scheduler、Notifier |
| **基础设施层** | 通用能力支撑 | Metrics、Logger、Cache、Queue |
| **数据层** | 数据持久化和存储 | Index Engine |

### 1.4 数据流架构

```
                    ┌─────────────────┐
                    │   用户请求       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   鉴权/验证      │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│ Gateway Check  │  │  Data Extract  │  │  Retrospective │
│  (实时检查)     │  │  (数据提取)     │  │  (复盘分析)     │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Event Bus     │
                    │  (事件分发)      │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│  Notifier      │  │   Analytics    │  │   Storage      │
│ (通知/告警)     │  │  (指标收集)     │  │  (数据持久化)   │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## 2. 设计原则

### 2.1 宪法性原则（不可违反）

1. **轻量级优先** - 不引入重量级数据库、消息队列、容器编排等
2. **文件系统存储** - 保持三层MEMORY架构，使用JSON格式
3. **类型安全** - TypeScript严格模式，100%类型覆盖
4. **向后兼容** - Phase 2必须兼容Phase 1数据格式
5. **测试驱动** - 所有新功能必须有测试，覆盖率>85%

### 2.2 设计权衡

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 数据库 | 文件系统（JSON） | 轻量级、易备份、零运维 |
| 实时通信 | WebSocket | 原生支持、轻量级 |
| 缓存 | 内存Map | 简单高效、满足需求 |
| 任务调度 | CRON风格 | 可预测、易调试 |
| 日志 | 结构化文件 | 易解析、易检索 |

### 2.3 CAP定理应用

ReflectGuard作为本地工具，其分布式约束较少：

- **一致性（Consistency）** - 高优先级
  - 单机部署，无一致性问题
  - 文件原子写入保证数据完整性

- **可用性（Availability）** - 最高优先级
  - 离线可用是核心需求
  - 所有功能需支持无网络环境

- **分区容错（Partition Tolerance）** - 低优先级
  - 单机系统，无网络分区问题

**结论：** 采用CA架构（一致性和可用性）

---

## 3. 功能模块

### 3.1 功能优先级矩阵

```
紧急程度
    │
高  │  [P0] MCP Server      [P1] Web UI
    │  [P0] Analytics       [P1] REST API
    │  [P1] Scheduler       [P2] WebSocket
    │  [P1] Notifier        [P2] Export
    │
    │
    └──────────────────────────────────────► 影响范围
         低           中           高
```

### 3.2 P0级功能（必须实现）

#### 3.2.1 MCP Server集成

**目标：** 让ReflectGuard作为MCP服务对外暴露能力

**接口定义：**
```typescript
// MCP Tools
interface MCPTools {
  // Gateway检查
  "gateway_check": {
    description: "检查任务意图是否符合Gateway原则"
    inputSchema: {
      type: "object"
      properties: {
        intent: { type: "string", description: "任务描述" }
        context: { type: "object", description: "上下文信息" }
      }
    }
  }

  // 数据提取
  "extract_data": {
    description: "从对话历史中提取7维度数据"
    inputSchema: {
      type: "object"
      properties: {
        conversation: { type: "array", description: "对话历史" }
        dimensions: { type: "array", description: "要提取的维度" }
      }
    }
  }

  // 复盘触发
  "trigger_retro": {
    description: "触发复盘分析"
    inputSchema: {
      type: "object"
      properties: {
        mode: { type: "string", enum: ["quick", "standard", "deep"] }
        project: { type: "string", description: "项目标识" }
        timeframe: { type: "string", description: "时间范围" }
      }
    }
  }

  // 模式查询
  "query_patterns": {
    description: "查询成功/失败模式"
    inputSchema: {
      type: "object"
      properties: {
        keyword: { type: "string", description: "搜索关键词" }
        category: { type: "string", description: "类别筛选" }
      }
    }
  }

  // 原则查询
  "query_principles": {
    description: "查询Gateway原则"
    inputSchema: {
      type: "object"
      properties: {
        category: { type: "string", description: "原则类别" }
      }
    }
  }

  // 统计查询
  "get_stats": {
    description: "获取系统统计信息"
    inputSchema: {
      type: "object"
      properties: {
        period: { type: "string", description: "统计周期" }
      }
    }
  }
}
```

**实施要点：**
1. 使用`@modelcontextprotocol/sdk-server`包
2. 支持stdio和SSE两种传输方式
3. 实现工具调用和资源查询
4. 提供Prompt模板

#### 3.2.2 Analytics模块

**目标：** 收集和分析系统使用数据

**核心指标：**
```typescript
interface AnalyticsMetrics {
  // 使用指标
  usage: {
    totalChecks: number;           // 总检查次数
    totalRetrospectives: number;   // 总复盘次数
    dailyActiveUsers: number;      // 日活用户
    avgSessionDuration: number;    // 平均会话时长
  };

  // 质量指标
  quality: {
    violationRate: number;         // 违规率
    falsePositiveRate: number;     // 误报率
    patternMatchAccuracy: number;  // 模式匹配准确率
  };

  // 性能指标
  performance: {
    avgCheckTime: number;          // 平均检查时间
    avgExtractTime: number;        // 平均提取时间
    p95CheckTime: number;          // P95检查时间
    p99CheckTime: number;          // P99检查时间
  };

  // 趋势指标
  trends: {
    violationTrend: 'up' | 'down' | 'stable';
    improvementRate: number;       // 改进率
    topViolations: string[];       // 最常见违规
  };
}
```

**实施方案：**
1. 轻量级指标收集（基于文件）
2. 每日自动聚合
3. 可视化趋势报告
4. 异常检测和告警

### 3.3 P1级功能（重要）

#### 3.3.1 Web UI

**技术栈：**
- 框架：原生HTML/CSS/JS（无构建依赖）
- 图表：Chart.js（轻量级）
- 样式：CSS Grid + 自定义主题

**页面结构：**
```
/web-ui
├── index.html          # 仪表板首页
├── pages/
│   ├── dashboard.html  # 概览仪表板
│   ├── gateway.html    # Gateway检查页
│   ├── retro.html      # 复盘页面
│   ├── patterns.html   # 模式浏览页
│   ├── stats.html      # 统计分析页
│   └── settings.html   # 设置页面
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       └── charts.js
└── api/
    └── bridge.js       # 与本地服务的桥接
```

**核心功能：**
1. 仪表板：系统概览、快速操作
2. Gateway检查：实时检查、历史记录
3. 复盘管理：创建复盘、查看历史
4. 模式浏览：搜索、筛选、详情
5. 统计图表：趋势分析、指标可视化

#### 3.3.2 REST API

**路由设计：**
```typescript
// RESTful API Routes
GET    /api/v1/status              # 系统状态
GET    /api/v1/health              # 健康检查

// Gateway
POST   /api/v1/gateway/check       # 执行检查
GET    /api/v1/gateway/history     # 检查历史
GET    /api/v1/gateway/stats       # 检查统计

// 复盘
POST   /api/v1/retrospective       # 创建复盘
GET    /api/v1/retrospective/:id   # 获取复盘
GET    /api/v1/retrospective       # 复盘列表
DELETE /api/v1/retrospective/:id   # 删除复盘

// 模式
GET    /api/v1/patterns            # 模式列表
GET    /api/v1/patterns/:id        # 模式详情
GET    /api/v1/patterns/search     # 搜索模式

// 原则
GET    /api/v1/principles          # 原则列表
GET    /api/v1/principles/:id      # 原则详情

// 分析
GET    /api/v1/analytics/usage     # 使用分析
GET    /api/v1/analytics/trends    # 趋势分析
GET    /api/v1/analytics/violations # 违规分析
```

#### 3.3.3 Scheduler调度器

**功能：**
1. 定期数据聚合（每日/每周）
2. 自动复盘触发（基于规则）
3. 数据清理（过期数据归档）
4. 报告生成（定期报告）

**调度配置：**
```typescript
interface ScheduleConfig {
  // 每日聚合
  dailyAggregation: {
    time: '02:00';              // 凌晨2点执行
    enabled: true;
  };

  // 每周复盘
  weeklyRetrospective: {
    day: 'friday';              // 每周五
    time: '17:00';              // 下午5点
    autoTrigger: true;
  };

  // 数据归档
  dataArchive: {
    frequency: 'monthly';       // 每月归档
    retentionDays: 90;          // 保留90天
  };

  // 指标收集
  metricsCollection: {
    interval: '5m';             // 每5分钟收集一次
  };
}
```

#### 3.3.4 Notifier通知系统

**通知渠道：**
1. 系统通知（原生Notification API）
2. 日志文件记录
3. Web UI消息中心
4. CLI输出提示

**通知类型：**
```typescript
interface NotificationType {
  // 违规通知
  violation: {
    severity: 'error' | 'warning' | 'info';
    message: string;
    principle: string;
    action?: string;
  };

  // 复盘提醒
  reminder: {
    type: 'retrospective_due';
    project: string;
    overdue?: boolean;
  };

  // 系统通知
  system: {
    type: 'update' | 'maintenance' | 'alert';
    message: string;
  };
}
```

### 3.4 P2级功能（可选）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| WebSocket | 实时事件推送 | P2 |
| Export | 数据导出（CSV/PDF） | P2 |
| Backup | 自动备份恢复 | P2 |
| Plugins | 插件系统 | P2 |
| Multi-user | 多用户支持 | P2 |

---

## 4. 技术方案

### 4.1 技术栈总览

| 类别 | 技术选择 | 版本要求 | 理由 |
|------|----------|----------|------|
| **运行时** | Bun | >=1.0 | 最快的JS运行时，原生TypeScript |
| **语言** | TypeScript | 5.3+ | 类型安全，IDE支持好 |
| **MCP SDK** | @modelcontextprotocol/sdk-server | latest | 官方SDK |
| **HTTP服务** | Hono | latest | 轻量级、高性能、TypeScript原生 |
| **WebSocket** | ws / Hono WS | latest | 原生支持 |
| **图表** | Chart.js | 4.x | 轻量级图表库 |
| **测试** | Bun Test | built-in | 零配置、快速 |
| **日志** | pino | latest | 结构化日志、高性能 |
| **CLI** | Commander | 14.x | 成熟、易用 |

### 4.2 目录结构（Phase 2）

```
~/.reflectguard/
├── level-1-hot/                    # [保持] Hot数据
├── level-2-warm/                   # [保持] Warm数据
├── level-3-cold/                   # [保持] Cold知识
├── src/
│   ├── cli/                        # [保持] CLI工具
│   ├── core/                       # [增强] 核心服务
│   │   ├── GatewayGuard.ts         # v2.0：增加缓存、批量检查
│   │   ├── DataExtractor.ts        # v2.0：增加增量提取
│   │   ├── RetrospectiveCore.ts    # v2.0：增加模板系统
│   │   ├── PatternMatcher.ts       # v2.0：增加模糊匹配
│   │   ├── Analytics.ts            # [NEW] 分析引擎
│   │   ├── Scheduler.ts            # [NEW] 任务调度
│   │   ├── Notifier.ts             # [NEW] 通知系统
│   │   └── Validator.ts            # [NEW] 数据验证
│   ├── api/                        # [NEW] REST API
│   │   ├── server.ts               # Hono服务器
│   │   ├── routes/
│   │   │   ├── gateway.ts
│   │   │   ├── retrospective.ts
│   │   │   ├── patterns.ts
│   │   │   ├── principles.ts
│   │   │   └── analytics.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       ├── cors.ts
│   │       └── rateLimit.ts
│   ├── mcp/                        # [NEW] MCP Server
│   │   ├── server.ts               # MCP服务器
│   │   ├── tools/                  # 工具实现
│   │   ├── resources/              # 资源定义
│   │   └── prompts/                # Prompt模板
│   ├── web-ui/                     # [NEW] Web界面
│   │   ├── index.html
│   │   ├── assets/
│   │   │   ├── css/
│   │   │   └── js/
│   │   └── pages/
│   ├── integration/                # [增强] 集成层
│   │   ├── hooks.ts                # v2.0：更多Hook点
│   │   ├── eventBus.ts             # [NEW] 事件总线
│   │   └── cache.ts                # [NEW] 缓存层
│   ├── infrastructure/             # [NEW] 基础设施
│   │   ├── metrics/
│   │   │   ├── collector.ts        # 指标收集
│   │   │   └── aggregator.ts       # 指标聚合
│   │   ├── logger/
│   │   │   └── structured.ts       # 结构化日志
│   │   ├── queue/
│   │   │   └── inMemory.ts         # 内存队列
│   │   └── storage/
│   │       └── index.ts            # 存储抽象
│   ├── types/                      # [保持] 类型定义
│   ├── utils/                      # [保持] 工具函数
│   └── tests/                      # [增强] 测试套件
├── web-ui/                         # [NEW] Web静态资源
├── config/                         # [NEW] 配置文件
│   ├── default.json
│   └── user.json.local
├── logs/                           # [NEW] 日志目录
├── cache/                          # [NEW] 缓存目录
├── package.json
├── tsconfig.json
└── README.md
```

### 4.3 核心组件设计

#### 4.3.1 事件总线（Event Bus）

```typescript
// 事件驱动架构
interface EventBus {
  // 订阅事件
  on<T>(event: string, handler: (data: T) => void): void;

  // 取消订阅
  off(event: string, handler: Function): void;

  // 发布事件
  emit<T>(event: string, data: T): void;

  // 一次性订阅
  once<T>(event: string, handler: (data: T) => void): void;
}

// 定义事件类型
type PRISMEvents =
  | { type: 'gateway:check:start'; data: { intent: string } }
  | { type: 'gateway:check:complete'; data: { result: CheckResult } }
  | { type: 'violation:detected'; data: { violation: Violation } }
  | { type: 'retrospective:created'; data: { retro: Retrospective } }
  | { type: 'retrospective:triggered'; data: { reason: string } }
  | { type: 'metrics:collected'; data: { metrics: Metrics } }
  | { type: 'user:notification'; data: { notification: Notification } };
```

#### 4.3.2 缓存层

```typescript
// 多级缓存策略
interface CacheLayer {
  // L1: 内存缓存（最快）
  l1: {
    ttl: number;        // 5分钟
    maxSize: number;    // 1000条
  };

  // L2: 文件缓存（持久化）
  l2: {
    path: string;       // ~/.reflectguard/cache/
    ttl: number;        // 1小时
  };
}

// 缓存接口
interface Cache<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}
```

#### 4.3.3 指标系统

```typescript
// 指标收集器
class MetricsCollector {
  // 计数器
  increment(name: string, value?: number, tags?: Record<string, string>): void;

  // 计时器
  timing(name: string, value: number, tags?: Record<string, string>): void;

  // 仪表
  gauge(name: string, value: number, tags?: Record<string, string>): void;

  // 直方图
  histogram(name: string, value: number, tags?: Record<string, string>): void;
}

// 预定义指标
const PRISM_METRICS = {
  // Gateway指标
  GATEWAY_CHECK_TOTAL: 'gateway.check.total',
  GATEWAY_CHECK_DURATION: 'gateway.check.duration',
  GATEWAY_VIOLATION_TOTAL: 'gateway.violation.total',

  // 复盘指标
  RETRO_CREATED_TOTAL: 'retro.created.total',
  RETRO_DURATION: 'retro.duration',

  // 性能指标
  MEMORY_USAGE: 'system.memory.usage',
  CPU_USAGE: 'system.cpu.usage',
  CACHE_HIT_RATE: 'cache.hit.rate',
} as const;
```

---

## 5. 接口设计

### 5.1 REST API规范

#### 5.1.1 通用响应格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

// 分页响应
interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
```

#### 5.1.2 状态码规范

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | 成功获取资源 |
| 201 | Created | 成功创建资源 |
| 204 | No Content | 成功删除资源 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未授权 |
| 403 | Forbidden | 禁止访问 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 422 | Unprocessable Entity | 验证失败 |
| 429 | Too Many Requests | 限流 |
| 500 | Internal Server Error | 服务器错误 |

### 5.2 MCP接口规范

#### 5.2.1 工具调用

```typescript
// 工具定义
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

// 工具响应
interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    uri?: string;
  }>;
  isError?: boolean;
}
```

#### 5.2.2 资源查询

```typescript
// 资源定义
interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

// 资源内容
interface MCPResourceContent {
  uri: string;
  contents: string;
}
```

### 5.3 内部接口

#### 5.3.1 服务接口

```typescript
// Gateway服务
interface IGatewayService {
  check(intent: string, context?: Context): Promise<CheckResult>;
  checkBatch(intents: string[]): Promise<CheckResult[]>;
  getHistory(filters: FilterOptions): Promise<CheckResult[]>;
  getStats(period: TimePeriod): Promise<GatewayStats>;
}

// 复盘服务
interface IRetrospectiveService {
  create(config: RetroConfig): Promise<Retrospective>;
  getById(id: string): Promise<Retrospective | null>;
  list(filters: FilterOptions): Promise<Retrospective[]>;
  update(id: string, updates: Partial<Retrospective>): Promise<Retrospective>;
  delete(id: string): Promise<void>;
  trigger(reason: string): Promise<Retrospective>;
}

// 分析服务
interface IAnalyticsService {
  getUsageMetrics(period: TimePeriod): Promise<UsageMetrics>;
  getQualityMetrics(period: TimePeriod): Promise<QualityMetrics>;
  getTrendAnalysis(metric: string, period: TimePeriod): Promise<TrendData>;
  detectAnomalies(): Promise<Anomaly[]>;
}
```

---

## 6. 性能优化

### 6.1 性能目标

| 指标 | Phase 1 | Phase 2目标 | 提升方案 |
|------|---------|-------------|----------|
| Gateway检查 | <100ms | <50ms | 缓存预热、并行检查 |
| 数据提取 | <50ms | <30ms | 增量提取、结果缓存 |
| 复盘生成 | <1ms | <500us | 模板预编译 |
| API响应 | - | <100ms | 连接池、响应压缩 |
| UI加载 | - | <1s | 静态资源缓存、懒加载 |
| 内存占用 | ~50MB | <100MB | 对象池、LRU缓存 |

### 6.2 优化策略

#### 6.2.1 缓存策略

```typescript
// 分级缓存
const cacheStrategy = {
  // 热数据缓存（原则、模式）
  hot: {
    ttl: 3600 * 1000,    // 1小时
    refresh: 300 * 1000,  // 5分钟后台刷新
  },

  // 温数据缓存（检查历史）
  warm: {
    ttl: 600 * 1000,     // 10分钟
    maxSize: 1000,
  },

  // 计算结果缓存
  computed: {
    ttl: 300 * 1000,     // 5分钟
    key: (args) => hash(args),
  },
};
```

#### 6.2.2 并行处理

```typescript
// 批量并行检查
async function checkBatch(intents: string[]): Promise<CheckResult[]> {
  // 分批并行，每批10个
  const batches = chunk(intents, 10);
  const results = [];

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(intent => gateway.check(intent))
    );
    results.push(...batchResults);
  }

  return results;
}
```

#### 6.2.3 懒加载

```typescript
// 按需加载模块
class LazyLoader {
  private modules = new Map<string, any>();

  async load<T>(name: string, loader: () => Promise<T>): Promise<T> {
    if (this.modules.has(name)) {
      return this.modules.get(name);
    }

    const module = await loader();
    this.modules.set(name, module);
    return module;
  }
}
```

### 6.3 监控指标

```typescript
// 性能监控
interface PerformanceMonitor {
  // 检查时间分布
  checkDuration: Histogram;

  // 缓存命中率
  cacheHitRate: Gauge;

  // 内存使用
  memoryUsage: Gauge;

  // CPU使用
  cpuUsage: Gauge;

  // 并发数
  concurrentRequests: Gauge;
}
```

---

## 7. 扩展性设计

### 7.1 插件系统（Phase 3准备）

```typescript
// 插件接口
interface PRISMPlugin {
  name: string;
  version: string;

  // 生命周期钩子
  onLoad?(): void;
  onUnload?(): void;

  // Gateway扩展
  gatewayCheckers?: GatewayChecker[];
  patternMatchers?: PatternMatcher[];

  // 复盘扩展
  retroTemplates?: RetroTemplate[];
  dataExtractors?: DataExtractor[];

  // UI扩展
  uiComponents?: UIComponent[];
  apiRoutes?: APIRoute[];
}

// 插件加载器
class PluginLoader {
  private plugins = new Map<string, PRISMPlugin>();

  load(plugin: PRISMPlugin): void {
    plugin.onLoad?.();
    this.plugins.set(plugin.name, plugin);
  }

  unload(name: string): void {
    const plugin = this.plugins.get(name);
    plugin?.onUnload?.();
    this.plugins.delete(name);
  }
}
```

### 7.2 配置系统

```typescript
// 分层配置
interface Config {
  // 默认配置（不可变）
  default: Readonly<DefaultConfig>;

  // 用户配置
  user: UserConfig;

  // 运行时配置
  runtime: RuntimeConfig;

  // 合并后的配置
  get<K extends keyof DefaultConfig>(key: K): DefaultConfig[K];
  set<K extends keyof UserConfig>(key: K, value: UserConfig[K]): void;
  reload(): void;
}
```

### 7.3 数据迁移

```typescript
// 数据版本控制
interface DataMigration {
  version: string;
  description: string;
  up(data: any): Promise<any>;
  down(data: any): Promise<any>;
}

// 迁移执行器
class MigrationRunner {
  async migrate(targetVersion: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const migrations = this.getMigrationsAfter(currentVersion);

    for (const migration of migrations) {
      await migration.up(/* ... */);
    }
  }
}
```

---

## 8. 安全方案

### 8.1 安全原则

1. **最小权限** - 只请求必要的权限
2. **数据保护** - 敏感数据加密存储
3. **输入验证** - 所有输入严格验证
4. **审计日志** - 关键操作记录日志

### 8.2 安全措施

#### 8.2.1 输入验证

```typescript
// 输入验证器
class InputValidator {
  // 字符串验证
  validateString(input: unknown, options: {
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    sanitize?: boolean;
  }): string;

  // 对象验证
  validateObject(input: unknown, schema: JSONSchema): object;

  // SQL注入防护（虽然不用SQL）
  sanitize(input: string): string;
}
```

#### 8.2.2 敏感数据处理

```typescript
// 敏感数据标记
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
];

// 脱敏处理
function sanitizeSensitive(data: any): any {
  // 递归处理对象
  // 敏感字段替换为 ***
}
```

#### 8.2.3 审计日志

```typescript
// 审计事件
interface AuditEvent {
  timestamp: string;
  action: string;
  actor: string;
  resource: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
}

// 审计日志
class AuditLogger {
  log(event: AuditEvent): void;
  query(filters: AuditFilters): AuditEvent[];
}
```

---

## 9. 实施路线图

### 9.1 阶段划分

```
Phase 2.0: MCP集成 (2周)
├── Week 1: MCP Server基础
│   ├── SDK集成
│   ├── 核心工具实现
│   └── 单元测试
└── Week 2: MCP完善
    ├── 资源查询
    ├── Prompt模板
    └── 集成测试

Phase 2.1: Analytics (1周)
├── 指标收集器
├── 聚合引擎
└── 可视化报告

Phase 2.2: REST API (1周)
├── Hono服务器
├── 路由实现
├── 中间件
└── API文档

Phase 2.3: Web UI (2周)
├── Week 1: 基础框架
│   ├── 静态资源
│   ├── API桥接
│   └── 基础组件
└── Week 2: 完善功能
    ├── 仪表板
    ├── 图表
    └── 设置页面

Phase 2.4: 调度和通知 (1周)
├── Scheduler实现
├── Notifier实现
└── 集成测试

Phase 2.5: 生产就绪 (1周)
├── CI/CD
├── 监控告警
├── 文档完善
└── 性能优化
```

### 9.2 里程碑

| 里程碑 | 交付物 | 预计时间 |
|--------|--------|----------|
| M1: MCP可用 | MCP Server + 6个工具 | Week 2 |
| M2: Analytics完成 | 指标收集 + 可视化 | Week 3 |
| M3: API可用 | REST API + 文档 | Week 4 |
| M4: UI可用 | Web UI基础功能 | Week 6 |
| M5: 生产就绪 | 完整功能 + 监控 | Week 8 |

### 9.3 依赖关系

```
MCP Server ──────┐
                 ├──► Analytics ──┐
REST API ───────┘                │
                                  ├──► Web UI
Scheduler ───────────────────────┘
Notifier ─────────────────────────┘
```

---

## 10. 风险评估

### 10.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| MCP SDK不稳定 | 高 | 中 | 版本锁定、兼容性测试 |
| 性能退化 | 中 | 低 | 性能基准测试、持续监控 |
| 数据迁移问题 | 中 | 低 | 完整测试、回滚方案 |
| 浏览器兼容性 | 低 | 低 | 使用标准API、降级方案 |

### 10.2 项目风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 范围蔓延 | 高 | 中 | 严格优先级管理 |
| 时间延期 | 中 | 中 | 缓冲时间、MVP优先 |
| 资源不足 | 中 | 低 | 外部支持、降低期望 |

### 10.3 运维风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 数据丢失 | 高 | 低 | 定期备份、版本控制 |
| 配置错误 | 中 | 中 | 配置验证、默认值 |
| 依赖冲突 | 低 | 低 | lock文件、定期更新 |

---

## 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| MEMORY | 三层数据存储架构（Hot/Warm/Cold） |
| Gateway | 行为准则检查系统 |
| Retrospective | 复盘系统 |
| MCP | Model Context Protocol |
| PRISM | 7维度体系（原则/模式/基准/陷阱/成功/工具/数据） |

### B. 参考资料

1. ReflectGuard Phase 1 MVP完成报告
2. PAI架构文档
3. MCP协议规范
4. REST API设计最佳实践

### C. 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 2.0.0 | 2026-02-04 | Phase 2架构设计 | Architect Agent |
| 1.0.0 | 2026-02-03 | Phase 1 MVP | Project Team |

---

**文档结束**

*本架构设计文档遵循ReflectGuard的轻量级设计原则，所有技术选择均以简单、可靠、可维护为优先考虑。*
