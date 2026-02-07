# ReflectGuard REST API 完整指南

> **API 版本：** 1.0.0
> **最后更新：** 2026-02-06
> **状态：** ✅ 完成

---

## 目录

- [API 概览](#api-概览)
  - [基础信息](#基础信息)
  - [认证方式](#认证方式)
  - [速率限制](#速率限制)
  - [错误处理](#错误处理)
- [端点文档](#端点文档)
  - [认证端点](#认证端点)
  - [Analytics 端点](#analytics-端点)
  - [系统端点](#系统端点)
- [请求/响应示例](#请求响应示例)
  - [cURL 示例](#curl-示例)
  - [JavaScript/TypeScript 示例](#javascripttypescript-示例)
  - [错误响应示例](#错误响应示例)
- [使用指南](#使用指南)
  - [快速开始](#快速开始)
  - [认证流程](#认证流程)
  - [常见问题](#常见问题)
  - [最佳实践](#最佳实践)

---

## API 概览

### 基础信息

- **基础 URL：** `https://api.reflectguard.com`
- **API 版本：** `v1`
- **内容类型：** `application/json`
- **字符编码：** `UTF-8`

```typescript
// API 基础配置
const API_BASE_URL = 'https://api.reflectguard.com/api/v1';
```

### 认证方式

ReflectGuard REST API 使用 JWT（JSON Web Token）进行认证。

#### 1. 获取访问令牌

```bash
# 登录获取 JWT
curl -X POST "https://api.reflectguard.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your-username",
    "password": "your-password"
  }'
```

#### 2. 使用访问令牌

```typescript
// 在请求头中添加 JWT
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};
```

#### 3. 令牌刷新

```bash
# 刷新过期的令牌
curl -X POST "https://api.reflectguard.com/api/v1/auth/refresh" \
  -H "Authorization: Bearer ${refreshToken}"
```

### 速率限制

API 实施速率限制以保护系统稳定性：

| 端点类别 | 限制类型 | 限制值 | 窗口 |
|----------|----------|--------|------|
| 认证端点 | 请求次数 | 10 次/分钟 | 1 分钟 |
| Analytics 端点 | 请求次数 | 100 次/分钟 | 1 分钟 |
| Analytics 端点 | 数据查询 | 1000 条/小时 | 1 小时 |
| 系统端点 | 请求次数 | 50 次/分钟 | 1 分钟 |

#### 速率限制响应头

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1672531200
```

#### 超出限制响应

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "retryAfter": 60
  }
}
```

### 错误处理

#### 标准错误响应格式

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Specific field that caused the error",
      "reason": "Detailed reason for the error"
    },
    "timestamp": "2026-02-06T10:30:00Z"
  }
}
```

#### 错误码表

| HTTP 状态码 | 错误码 | 描述 |
|-------------|--------|------|
| 400 | `BAD_REQUEST` | 请求格式错误 |
| 401 | `UNAUTHORIZED` | 未认证或令牌无效 |
| 403 | `FORBIDDEN` | 权限不足 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 429 | `RATE_LIMIT_EXCEEDED` | 超出速率限制 |
| 500 | `INTERNAL_SERVER_ERROR` | 服务器内部错误 |
| 503 | `SERVICE_UNAVAILABLE` | 服务暂时不可用 |

---

## 端点文档

### 认证端点

#### POST /api/v1/auth/login

用户登录获取 JWT 令牌。

**请求体：**

```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**响应：**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**示例：**

```bash
curl -X POST "https://api.reflectguard.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

#### POST /api/v1/auth/refresh

刷新访问令牌。

**请求头：**
```
Authorization: Bearer {refreshToken}
```

**响应：**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**示例：**

```bash
curl -X POST "https://api.reflectguard.com/api/v1/auth/refresh" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### POST /api/v1/auth/logout

用户登出，使令牌失效。

**请求头：**
```
Authorization: Bearer {accessToken}
```

**响应：**

```json
{
  "message": "Successfully logged out"
}
```

**示例：**

```bash
curl -X POST "https://api.reflectguard.com/api/v1/auth/logout" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Analytics 端点

#### GET /api/v1/analytics/dashboard

获取 Analytics 仪表板数据。

**查询参数：**
- `period`: `today` | `week` | `month` | `year` (默认: `week`)
- `projectId`: 项目 ID (可选)

**请求头：**
```
Authorization: Bearer {accessToken}
```

**响应：**

```json
{
  "summary": {
    "totalChecks": 1250,
    "violations": 45,
    "violationRate": 0.036,
    "activeUsers": 15,
    "avgDuration": 200
  },
  "trends": {
    "violationTrend": "down",
    "usageTrend": "up",
    "performanceTrend": "stable"
  },
  "alerts": [
    {
      "id": "alert_001",
      "severity": "high",
      "type": "violation_spike",
      "description": "违规率突然上升",
      "timestamp": "2026-02-06T10:30:00Z"
    }
  ],
  "topViolations": [
    {
      "principle": "P1",
      "name": "安全性原则",
      "count": 12,
      "percentage": 26.7
    }
  ],
  "timeSeries": [
    {
      "timestamp": "2026-02-06T00:00:00Z",
      "checks": 45,
      "violations": 2
    }
  ]
}
```

**示例：**

```bash
curl -X GET "https://api.reflectguard.com/api/v1/analytics/dashboard?period=week&projectId=my-project" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### GET /api/v1/analytics/usage

获取使用指标数据。

**查询参数：**
- `period`: `today` | `week` | `month` | `year` (默认: `week`)
- `projectId`: 项目 ID (可选)
- `limit`: 返回条数限制 (默认: 100)

**响应：**

```json
{
  "metrics": {
    "totalRetrospectives": 342,
    "activeUsers": 15,
    "avgDuration": 185,
    "completionRate": 0.87
  },
  "dailyStats": [
    {
      "date": "2026-02-06",
      "retrospectives": 12,
      "users": 8,
      "avgDuration": 195
    }
  ],
  "projectStats": [
    {
      "projectId": "project-1",
      "name": "Web App",
      "retrospectives": 156,
      "avgDuration": 178
    }
  ]
}
```

#### GET /api/v1/analytics/quality

获取质量指标数据。

**查询参数：**
- `period`: `today` | `week` | `month` | `year` (默认: `week`)
- `principleId`: 原则 ID (可选)

**响应：**

```json
{
  "metrics": {
    "totalViolations": 45,
    "violationRate": 0.036,
    "falsePositiveRate": 0.02,
    "avgResolutionTime": 3600
  },
  "principleStats": [
    {
      "principleId": "P1",
      "name": "安全性原则",
      "violations": 12,
      "rate": 0.267,
      "trend": "down"
    }
  ],
  "violationsByType": [
    {
      "type": "MANDATORY",
      "count": 35,
      "percentage": 77.8
    }
  ],
  "topViolations": [
    {
      "id": "vio_001",
      "principle": "P1",
      "message": "未进行安全测试",
      "count": 8,
      "lastOccurrence": "2026-02-06T09:30:00Z"
    }
  ]
}
```

#### GET /api/v1/analytics/performance

获取性能指标数据。

**查询参数：**
- `period`: `today` | `week` | `month` | `year` (默认: `week`)
- `metricType`: `check_time` | `memory_usage` | `cpu_usage` (默认: `check_time`)

**响应：**

```json
{
  "metrics": {
    "avgCheckTime": 200,
    "p50": 180,
    "p95": 350,
    "p99": 520,
    "slowChecks": 5.2
  },
  "timeSeries": [
    {
      "timestamp": "2026-02-06T00:00:00Z",
      "avg": 195,
      "p95": 320,
      "p99": 480
    }
  ],
  "performanceStats": {
    "checksUnder100ms": 78.5,
    "checksUnder300ms": 92.3,
    "checksOver500ms": 2.1
  }
}
```

#### GET /api/v1/analytics/trends/{metric}

获取趋势分析数据。

**路径参数：**
- `metric`: `violations` | `usage` | `performance` | `quality`

**查询参数：**
- `period`: `week` | `month` | `quarter` | `year` (默认: `week`)

**响应：**

```json
{
  "metric": "violations",
  "period": "week",
  "trend": {
    "direction": "down",
    "slope": -0.15,
    "r2": 0.85,
    "significance": "high"
  },
  "data": [
    {
      "timestamp": "2026-02-06T00:00:00Z",
      "value": 8,
      "predicted": 7.2
    }
  ],
  "changePoints": [
    {
      "timestamp": "2026-02-05T14:30:00Z",
      "type": "drop",
      "magnitude": 40,
      "confidence": 0.92
    }
  ]
}
```

#### POST /api/v1/analytics/detect-anomalies

检测异常情况。

**请求头：**
```
Authorization: Bearer {accessToken}
```

**请求体：**

```json
{
  "period": "week",
  "metrics": ["violations", "usage", "performance"],
  "threshold": 2.0,
  "confidence": 0.9
}
```

**响应：**

```json
{
  "anomalies": [
    {
      "id": "anomaly_001",
      "severity": "high",
      "metric": "violations",
      "description": "违规率异常上升",
      "value": 12.5,
      "expected": 6.2,
      "zscore": 3.2,
      "timestamp": "2026-02-06T10:30:00Z",
      "suggestions": [
        "立即检查违规记录",
        "分析最近的代码变更",
        "考虑调整安全阈值"
      ]
    }
  ],
  "summary": {
    "totalAnomalies": 3,
    "highSeverity": 1,
    "mediumSeverity": 1,
    "lowSeverity": 1
  }
}
```

### 系统端点

#### GET /health

系统健康检查。

**响应：**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-06T10:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "cache": "healthy",
    "storage": "healthy"
  },
  "uptime": 86400
}
```

#### GET /version

获取系统版本信息。

**响应：**

```json
{
  "version": "1.0.0",
  "build": "20260206.001",
  "timestamp": "2026-02-06T10:00:00Z",
  "features": {
    "analytics": true,
    "mcp": true,
    "websocket": true
  }
}
```

#### GET /stats

获取系统统计信息。

**请求头：**
```
Authorization: Bearer {accessToken}
```

**响应：**

```json
{
  "system": {
    "uptime": 86400,
    "memoryUsage": 512,
    "cpuUsage": 15.3
  },
  "api": {
    "totalRequests": 15420,
    "successfulRequests": 15320,
    "errorRate": 0.65
  },
  "storage": {
    "totalSize": 1048576,
    "usedSize": 524288,
    "files": 1250
  }
}
```

---

## 请求/响应示例

### cURL 示例

#### 1. 用户登录

```bash
#!/bin/bash

# 用户登录
LOGIN_RESPONSE=$(curl -s -X POST "https://api.reflectguard.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }')

# 提取访问令牌
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

echo "登录成功，令牌: $ACCESS_TOKEN"
```

#### 2. 获取 Analytics 仪表板

```bash
#!/bin/bash

# 获取仪表板数据
curl -X GET "https://api.reflectguard.com/api/v1/analytics/dashboard?period=week" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

#### 3. 检测异常

```bash
#!/bin/bash

# 检测异常
curl -X POST "https://api.reflectguard.com/api/v1/analytics/detect-anomalies" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "period": "week",
    "metrics": ["violations", "usage"],
    "threshold": 2.0
  }' | jq '.'
```

### JavaScript/TypeScript 示例

#### 1. API 客户端类

```typescript
class PrismGatewayAPIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = 'https://api.reflectguard.com/api/v1') {
    this.baseUrl = baseUrl;
  }

  // 认证
  async login(username: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.token = data.accessToken;
  }

  // 通用请求方法
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    return response.json();
  }

  // 获取仪表板
  async getDashboard(period: 'today' | 'week' | 'month' = 'week') {
    return this.request<DashboardData>('/analytics/dashboard', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 检测异常
  async detectAnomalies(params: {
    period: 'week' | 'month';
    metrics: string[];
    threshold: number;
  }) {
    return this.request<AnomalyResponse>('/analytics/detect-anomalies', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }
}

// 使用示例
const client = new PrismGatewayAPIClient();

// 登录
await client.login('admin', 'password123');

// 获取仪表板
const dashboard = await client.getDashboard('week');
console.log('总检查次数:', dashboard.summary.totalChecks);

// 检测异常
const anomalies = await client.detectAnomalies({
  period: 'week',
  metrics: ['violations', 'usage'],
  threshold: 2.0
});
```

#### 2. React Hook 示例

```typescript
import { useState, useEffect } from 'react';

interface UseAnalyticsReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useAnalytics(period: 'today' | 'week' | 'month' = 'week'): UseAnalyticsReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/dashboard', {
        headers: { 'X-API-Period': period }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  return { data, loading, error, refetch: fetchData };
}

// 使用示例
function AnalyticsDashboard() {
  const { data, loading, error } = useAnalytics('week');

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;
  if (!data) return <div>无数据</div>;

  return (
    <div className="dashboard">
      <h2>Analytics 仪表板</h2>
      <p>总检查次数: {data.summary.totalChecks}</p>
      <p>违规率: {(data.summary.violationRate * 100).toFixed(2)}%</p>

      <div className="alerts">
        <h3>告警</h3>
        {data.alerts.map(alert => (
          <div key={alert.id} className={`alert ${alert.severity}`}>
            {alert.description}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 错误响应示例

#### 1. 认证失败

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials",
    "details": {
      "field": "password",
      "reason": "Password does not match"
    },
    "timestamp": "2026-02-06T10:30:00Z"
  }
}
```

#### 2. 资源不存在

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found",
    "details": {
      "field": "projectId",
      "reason": "Project with ID 'non-existent' does not exist"
    },
    "timestamp": "2026-02-06T10:30:00Z"
  }
}
```

#### 3. 速率限制超出

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "details": {
      "limit": 100,
      "window": "1 minute",
      "retryAfter": 60
    },
    "timestamp": "2026-02-06T10:30:00Z"
  }
}
```

#### 4. 验证错误

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "errors": [
        {
          "field": "period",
          "message": "must be one of: today, week, month, year"
        },
        {
          "field": "projectId",
          "message": "must be a valid UUID"
        }
      ]
    },
    "timestamp": "2026-02-06T10:30:00Z"
  }
}
```

---

## 使用指南

### 快速开始

#### 1. 安装依赖

```bash
# 使用 npm
npm install axios

# 或使用 yarn
yarn add axios

# 或使用 pnpm
pnpm add axios
```

#### 2. 基础配置

```typescript
// src/api/client.ts
import axios from 'axios';

const API_BASE_URL = 'https://api.reflectguard.com/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('prism_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // 令牌过期，跳转到登录页
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

#### 3. 快速使用示例

```typescript
// src/services/analytics.ts
import apiClient from './client';

export class AnalyticsService {
  static async getDashboard(period: 'week' | 'month' = 'week') {
    return apiClient.get('/analytics/dashboard', {
      params: { period }
    });
  }

  static async getUsageMetrics(period: 'week' | 'month' = 'week') {
    return apiClient.get('/analytics/usage', {
      params: { period }
    });
  }

  static async detectAnomalies(params: {
    period: 'week' | 'month';
    metrics: string[];
    threshold: number;
  }) {
    return apiClient.post('/analytics/detect-anomalies', params);
  }
}

// 使用示例
import { AnalyticsService } from '@/services/analytics';

async function loadDashboard() {
  try {
    const dashboard = await AnalyticsService.getDashboard('week');
    console.log('仪表板数据:', dashboard);
  } catch (error) {
    console.error('加载失败:', error);
  }
}
```

### 认证流程

#### 1. 登录流程

```typescript
// src/auth/authService.ts
import apiClient from '../api/client';

export class AuthService {
  static async login(username: string, password: string) {
    const response = await apiClient.post('/auth/login', {
      username,
      password
    });

    // 保存令牌
    localStorage.setItem('prism_token', response.accessToken);
    localStorage.setItem('prism_refresh_token', response.refreshToken);

    return response;
  }

  static async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      // 清除本地令牌
      localStorage.removeItem('prism_token');
      localStorage.removeItem('prism_refresh_token');
    }
  }

  static async refreshToken() {
    const refreshToken = localStorage.getItem('prism_refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post('/auth/refresh', {}, {
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    });

    // 更新访问令牌
    localStorage.setItem('prism_token', response.accessToken);
    return response;
  }
}

// 使用示例
// 登录
await AuthService.login('admin', 'password123');

// 登出
await AuthService.logout();
```

#### 2. 自动令牌刷新

```typescript
// src/auth/tokenManager.ts
export class TokenManager {
  private static refreshPromise: Promise<string> | null = null;

  static async getValidToken(): Promise<string> {
    const token = localStorage.getItem('prism_token');

    if (!token) {
      throw new Error('No authentication token');
    }

    // 检查令牌是否即将过期（提前5分钟）
    const decoded = this.decodeToken(token);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (decoded.exp * 1000 - now < fiveMinutes) {
      return this.refreshToken();
    }

    return token;
  }

  private static refreshToken(): Promise<string> {
    // 防止并发刷新
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = AuthService.refreshToken()
      .then(response => {
        this.refreshPromise = null;
        return response.accessToken;
      })
      .catch(error => {
        this.refreshPromise = null;
        throw error;
      });

    return this.refreshPromise;
  }

  private static decodeToken(token: string) {
    // JWT 简单解码（实际项目中使用 jwt-decode 库）
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  }
}

// 在请求拦截器中使用
apiClient.interceptors.request.use(async (config) => {
  const token = await TokenManager.getValidToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### 常见问题

#### 1. CORS 问题

```typescript
// 如果遇到 CORS 问题，配置代理
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://api.reflectguard.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});
```

#### 2. 大数据请求优化

```typescript
// 分页查询
async function getAnalyticsData(page = 1, limit = 100) {
  return apiClient.get('/analytics/usage', {
    params: {
      page,
      limit,
      period: 'month'
    }
  });
}

// 使用 Web Workers 处理大数据
// analytics.worker.ts
self.onmessage = (e) => {
  const { data } = e;
  const processed = processAnalyticsData(data);
  self.postMessage(processed);
};

// 主线程
const worker = new Worker('./analytics.worker.ts');
worker.postMessage(largeDataSet);
worker.onmessage = (e) => {
  console.log('处理完成:', e.data);
};
```

#### 3. WebSocket 实时更新

```typescript
// src/services/websocket.ts
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket 连接成功');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket 连接关闭');
      this.reconnect();
    };
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(this.url);
      }, 1000 * Math.pow(2, this.reconnectAttempts));
    }
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'ANALYTICS_UPDATE':
        // 更新本地数据
        this.updateAnalyticsData(data.payload);
        break;
      case 'ALERT':
        // 显示告警
        this.showAlert(data.payload);
        break;
    }
  }
}
```

### 最佳实践

#### 1. 错误处理策略

```typescript
// 统一错误处理
class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function handleApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const response = error.response?.data;

      // 根据错误类型处理
      switch (error.response?.status) {
        case 401:
          // 跳转到登录页
          window.location.href = '/login';
          break;
        case 429:
          // 显示速率限制提示
          showRateLimitError(response.error.retryAfter);
          break;
        case 500:
          // 显示服务器错误提示
          showServerError();
          break;
      }

      throw new APIError(
        response.error.code,
        response.error.message,
        error.response.status,
        response.error.details
      );
    }

    throw error;
  }
}

// 使用示例
async function loadDashboardData() {
  return handleApiCall(() =>
    AnalyticsService.getDashboard('week')
  );
}
```

#### 2. 数据缓存策略

```typescript
// 简单的内存缓存
class CacheService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 300000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }
}

// 在 API 服务中使用缓存
export class CachedAnalyticsService {
  private static cache = new CacheService();

  static async getDashboard(period: 'week' | 'month' = 'week') {
    const cacheKey = `dashboard_${period}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const data = await AnalyticsService.getDashboard(period);
    this.cache.set(cacheKey, data, 5 * 60 * 1000); // 5分钟缓存

    return data;
  }
}
```

#### 3. 性能监控

```typescript
// API 性能监控
export class PerformanceMonitor {
  private static metrics = {
    requestCount: 0,
    totalTime: 0,
    errorCount: 0,
    averageResponseTime: 0
  };

  static trackRequest(duration: number, success: boolean) {
    this.metrics.requestCount++;
    this.metrics.totalTime += duration;
    this.metrics.averageResponseTime = this.metrics.totalTime / this.metrics.requestCount;

    if (!success) {
      this.metrics.errorCount++;
    }

    // 每100次请求报告一次
    if (this.metrics.requestCount % 100 === 0) {
      this.reportMetrics();
    }
  }

  private static reportMetrics() {
    console.log('API 性能指标:', {
      请求数: this.metrics.requestCount,
      平均响应时间: this.metrics.averageResponseTime.toFixed(2) + 'ms',
      错误率: ((this.metrics.errorCount / this.metrics.requestCount) * 100).toFixed(2) + '%'
    });
  }
}

// 在请求拦截器中监控
apiClient.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata?.startTime || 0;
    PerformanceMonitor.trackRequest(duration, true);
    return response;
  },
  (error) => {
    const duration = Date.now() - error.config?.metadata?.startTime || 0;
    PerformanceMonitor.trackRequest(duration, false);
    return Promise.reject(error);
  }
);

// 在请求开始时记录时间
apiClient.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() };
  return config;
});
```

#### 4. 类型安全

```typescript
// 定义完整的 API 类型
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}

// Analytics 相关类型
interface DashboardData {
  summary: {
    totalChecks: number;
    violations: number;
    violationRate: number;
    activeUsers: number;
    avgDuration: number;
  };
  trends: {
    violationTrend: 'up' | 'down' | 'stable';
    usageTrend: 'up' | 'down' | 'stable';
    performanceTrend: 'up' | 'down' | 'stable';
  };
  alerts: Alert[];
  topViolations: TopViolation[];
  timeSeries: TimeSeriesPoint[];
}

// 使用泛型服务
export class APIService<T> {
  async endpoint(path: string, options?: RequestInit): Promise<APIResponse<T>> {
    const response = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      ...options
    });

    return response.json();
  }
}

// 具体类型服务
export class AnalyticsAPIService extends APIService<DashboardData> {
  async getDashboard(period: 'week' | 'month' = 'week') {
    return this.endpoint(`/api/v1/analytics/dashboard?period=${period}`);
  }
}
```

---

## 总结

ReflectGuard REST API 提供了完整的接口来：

1. **管理用户认证** - JWT 令牌认证、自动刷新
2. **获取 Analytics 数据** - 仪表板、趋势、异常检测
3. **监控系统状态** - 健康检查、统计信息
4. **遵循最佳实践** - 错误处理、性能优化、类型安全

通过使用本指南，您可以快速集成 ReflectGuard API 到您的应用程序中，并构建强大的监控和分析功能。

---

**相关资源：**
- [API 基础文档](README.md)
- [Analytics 模块文档](../reflectguard/src/core/analytics/README.md)
- [JWT 认证指南](./JWT_AUTH.md)
- [CORS 部署指南](./CORS_GUIDE.md)

**维护者：** ReflectGuard Team
**许可证：** MIT License