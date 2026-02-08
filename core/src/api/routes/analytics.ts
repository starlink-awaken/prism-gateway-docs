/**
 * Analytics API 路由
 *
 * @description
 * PRISM-Gateway Analytics 模块的 REST API 端点
 *
 * @remarks
 * 所有端点遵循 RESTful 设计原则：
 * - 统一的响应格式
 * - 适当的 HTTP 状态码
 * - 完整的错误处理
 * - 输入验证（ERR_1001）
 *
 * @security
 * - 所有查询参数都经过 Zod 验证
 * - 防止注入攻击
 * - 防止参数污染
 *
 * @example
 * ```typescript
 * // 获取使用指标
 * GET /api/v1/analytics/usage?period=week
 *
 * // 获取趋势分析
 * GET /api/v1/analytics/trends/violations?period=month
 *
 * // 获取仪表板
 * GET /api/v1/analytics/dashboard?period=week
 * ```
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  AnalyticsService,
  TimePeriod
} from '../../core/analytics/index-full.js';
import {
  queryValidator,
  paramValidator,
  bodyValidator
} from '../validator/index.js';
import { AnalyticsRecordsStore } from '../stores/AnalyticsRecordsStore.js';
import type { WebSocketServer } from '../websocket/WebSocketServer.js';
import {
  errorResponse as apiErrorResponse,
  errorResponse,
  createValidationErrorResponse,
  createNotFoundErrorResponse,
  createConflictErrorResponse,
  ApiErrorCode
} from '../utils/errorResponse.js';

// 创建 Hono 应用
const app = new Hono();

// ============================================================================
// WebSocket 事件推送（Task 74: 实时事件推送集成）
// ============================================================================

/**
 * WebSocket服务器实例
 */
let wsServer: WebSocketServer | null = null;

// ============================================================================
// Schemas
// ============================================================================

/**
 * Period 查询参数 Schema
 *
 * @description
 * 映射到 TimePeriod 的有效值
 */
const PeriodQuerySchema = z.enum(['today', 'week', 'month', 'year', 'all'], {
  errorMap: () => ({ message: 'period 必须是 today、week、month、year 或 all 之一' })
});

/**
 * Metric 路径参数 Schema
 */
const MetricParamSchema = z.enum([
  'violations',
  'checks',
  'retros',
  'patterns',
  'traps',
  'quality',
  'usage',
  'performance'
], {
  errorMap: () => ({ message: 'metric 必须是有效的指标名称' })
});

// ============================================================================
// CRUD Schemas (Task 70: 输入验证中间件完整性)
// ============================================================================

/**
 * 记录类型枚举
 */
const RecordTypeEnum = z.enum(['custom', 'scheduled', 'adhoc'], {
  errorMap: () => ({ message: 'type 必须是 custom、scheduled 或 adhoc 之一' })
});

/**
 * 时间周期枚举
 */
const PeriodEnum = z.enum(['today', 'week', 'month', 'year', 'all'], {
  errorMap: () => ({ message: 'period 必须是 today、week、month、year 或 all 之一' })
});

/**
 * 创建分析记录请求体 Schema
 *
 * @description
 * 验证 POST /api/v1/analytics/records 的请求体
 */
const CreateRecordSchema = z.object({
  type: RecordTypeEnum,
  name: z.string()
    .min(1, 'name 不能为空')
    .max(100, 'name 最大长度为 100 字符')
    .trim(),
  description: z.string()
    .max(500, 'description 最大长度为 500 字符')
    .optional(),
  config: z.object({
    metrics: z.array(z.string()).optional(),
    period: PeriodEnum.optional(),
    filters: z.record(z.any()).optional()
  }).optional()
}).strict();

/**
 * 更新分析记录请求体 Schema
 *
 * @description
 * 验证 PUT /api/v1/analytics/records/:id 的请求体
 * 不使用 strict 模式，只验证提供的字段
 */
const UpdateRecordSchema = z.object({
  name: z.string()
    .min(1, 'name 不能为空')
    .max(100, 'name 最大长度为 100 字符')
    .trim()
    .optional(),
  description: z.string()
    .max(500, 'description 最大长度为 500 字符')
    .optional(),
  config: z.object({
    metrics: z.array(z.string()).optional(),
    period: PeriodEnum.optional(),
    filters: z.record(z.any()).optional()
  }).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '至少需要提供一个要更新的字段' }
);

/**
 * 分页查询参数 Schema
 *
 * @description
 * 使用简单的字符串类型，避免 Zod 4.x 的 .optional() 兼容性问题
 */
const PaginationQuerySchema = z.object({
  page: z.string(),
  limit: z.string(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']),
  sortOrder: z.enum(['asc', 'desc']),
  type: z.enum(['custom', 'scheduled', 'adhoc'])
}).partial();

/**
 * 记录ID路径参数 Schema
 */
const RecordIdParamSchema = z.string()
  .min(1, 'id 不能为空')
  .refine(
    (val) => !val.includes('..') && !val.includes('/') && !val.includes('\\'),
    { message: 'id 包含非法字符' }
  );

/**
 * 将字符串 period 转换为 TimePeriod
 */
function parsePeriod(period: string): TimePeriod {
  switch (period) {
    case 'today':
      return TimePeriod.today();
    case 'week':
      return TimePeriod.week();
    case 'month':
      return TimePeriod.month();
    case 'year':
      return TimePeriod.year();
    case 'all':
      return TimePeriod.all();
    default:
      return TimePeriod.week();
  }
}

// ============================================================================
// WebSocket事件推送辅助函数（Task 74）
// ============================================================================

/**
 * 推送Analytics更新事件到所有WebSocket客户端
 *
 * @param eventType - 事件类型
 * @param data - 事件数据
 */
function broadcastAnalyticsEvent(eventType: string, data: any): void {
  if (!wsServer || !wsServer.isRunning()) {
    console.log('[Analytics] WebSocket server not running, skipping event broadcast');
    return;
  }

  try {
    wsServer.broadcast({
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    });
    console.log(`[Analytics] Broadcasted event: ${eventType}`);
  } catch (error) {
    console.error(`[Analytics] Error broadcasting event:`, error);
  }
}

/**
 * 推送异常Alert事件
 *
 * @param anomaly - 异常数据
 */
function broadcastAlertEvent(anomaly: any): void {
  broadcastAnalyticsEvent('alert', {
    message: anomaly.description || '检测到异常',
    severity: anomaly.severity || 'medium',
    metric: anomaly.metric || 'unknown',
    timestamp: new Date().toISOString()
  });
}

// ============================================================================
// 服务初始化
// ============================================================================

// 创建 Analytics 服务实例（占位符）
let analyticsService: AnalyticsService | null = null;

// 创建记录存储实例
const recordsStore = new AnalyticsRecordsStore();

/**
 * 初始化 Analytics 服务
 *
 * @param service - AnalyticsService 实例
 * @param websocketServer - WebSocket服务器实例（Task 74）
 */
export function initAnalytics(
  service: AnalyticsService,
  websocketServer?: WebSocketServer
): void {
  analyticsService = service;

  // 设置WebSocket服务器用于事件推送（Task 74）
  if (websocketServer) {
    wsServer = websocketServer;
    console.log('[Analytics] WebSocket server linked for event broadcasting');
  }
}

/**
 * 导出记录存储（用于测试）
 */
export function getRecordsStore(): AnalyticsRecordsStore {
  return recordsStore;
}

/**
 * 重置记录存储（用于测试）
 *
 * @description
 * 清空所有记录，用于测试隔离
 */
export function resetRecordsStore(): void {
  // 清空Map
  const store = getRecordsStore() as any;
  if (store.records && store.records.clear) {
    store.records.clear();
  }
}

/**
 * 生成请求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 成功响应格式
 */
function successResponse<T>(c: any, data: T, status: number = 200): Response {
  return c.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      version: '2.0.0'
    }
  }, status);
}

// ============================================================================
// 路由定义
// ============================================================================

/**
 * GET /api/v1/analytics/usage
 *
 * 获取使用指标
 *
 * @query period - 时间范围 (today|week|month|year|all)
 * @returns 使用指标
 *
 * @example
 * ```bash
 * curl http://localhost:3000/api/v1/analytics/usage?period=week
 * ```
 */
app.get('/usage',
  queryValidator({ period: PeriodQuerySchema.optional() }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const query = c.get('validatedQuery');
      const period = parsePeriod(query.period || 'week');

      const metrics = await analyticsService.getUsageMetrics(period);
      return successResponse(c, metrics);
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/quality
 *
 * 获取质量指标
 *
 * @query period - 时间范围 (today|week|month|year|all)
 * @returns 质量指标
 *
 * @example
 * ```bash
 * curl http://localhost:3000/api/v1/analytics/quality?period=month
 * ```
 */
app.get('/quality',
  queryValidator({ period: PeriodQuerySchema.optional() }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const query = c.get('validatedQuery');
      const period = parsePeriod(query.period || 'week');

      const metrics = await analyticsService.getQualityMetrics(period);
      return successResponse(c, metrics);
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/performance
 *
 * 获取性能指标
 *
 * @query period - 时间范围 (today|week|month|year|all)
 * @returns 性能指标
 *
 * @example
 * ```bash
 * curl http://localhost:3000/api/v1/analytics/performance?period=today
 * ```
 */
app.get('/performance',
  queryValidator({ period: PeriodQuerySchema.optional() }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const query = c.get('validatedQuery');
      const period = parsePeriod(query.period || 'week');

      const metrics = await analyticsService.getPerformanceMetrics(period);
      return successResponse(c, metrics);
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/trends/:metric
 *
 * 获取趋势分析
 *
 * @param metric - 指标名称
 * @query period - 时间范围 (today|week|month|year|all)
 * @returns 趋势分析结果
 *
 * @example
 * ```bash
 * curl http://localhost:3000/api/v1/analytics/trends/violations?period=month
 * ```
 */
app.get('/trends/:metric',
  paramValidator({ metric: MetricParamSchema }),
  queryValidator({ period: PeriodQuerySchema.optional() }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const params = c.get('validatedParams');
      const query = c.get('validatedQuery');
      const period = parsePeriod(query.period || 'month');

      const analysis = await analyticsService.getTrendAnalysis(params.metric, period);

      return c.json({
        success: true,
        data: {
          metric: params.metric,
          period: query.period || 'month',
          ...analysis
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: generateRequestId(),
          version: '2.0.0'
        }
      });
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/anomalies
 *
 * 获取异常检测结果
 *
 * @returns 异常列表
 *
 * @example
 * ```bash
 * curl http://localhost:3000/api/v1/analytics/anomalies
 * ```
 */
app.get('/anomalies', async (c) => {
  if (!analyticsService) {
    return errorResponse(c, 'Analytics service not initialized');
  }

  try {
    const anomalies = await analyticsService.detectAnomalies();
    return successResponse(c, anomalies);
  } catch (error) {
    return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
  }
});

/**
 * GET /api/v1/analytics/dashboard
 *
 * 获取仪表板数据（综合）
 *
 * @query period - 时间范围 (today|week|month|year|all)
 * @returns 仪表板数据
 *
 * @example
 * ```bash
 * curl http://localhost:3000/api/v1/analytics/dashboard?period=week
 * ```
 */
app.get('/dashboard',
  queryValidator({ period: PeriodQuerySchema.optional() }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const query = c.get('validatedQuery');
      const period = parsePeriod(query.period || 'week');

      const dashboard = await analyticsService.getDashboard(period);
      return successResponse(c, dashboard);
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/cache/stats
 *
 * 获取缓存统计信息
 *
 * @returns 缓存统计
 *
 * @example
 * ```bash
 * curl http://localhost:3000/api/v1/analytics/cache/stats
 * ```
 */
app.get('/cache/stats', async (c) => {
  if (!analyticsService) {
    return errorResponse(c, 'Analytics service not initialized');
  }

  try {
    const stats = analyticsService.getCacheStats();

    return c.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      }
    });
  } catch (error) {
    return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
  }
});

/**
 * DELETE /api/v1/analytics/cache
 *
 * 清除缓存
 *
 * @returns 操作结果
 *
 * @example
 * ```bash
 * curl -X DELETE http://localhost:3000/api/v1/analytics/cache
 * ```
 */
app.delete('/cache', async (c) => {
  if (!analyticsService) {
    return errorResponse(c, 'Analytics service not initialized');
  }

  try {
    await analyticsService.clearCache();

    return c.json({
      success: true,
      message: 'Cache cleared',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
  }
});

// ============================================================================
// 扩展 Analytics API (Task 1.4: Analytics API Extensions)
// ============================================================================

/**
 * GET /api/v1/analytics/reports/custom
 *
 * 自定义报告 - 支持多维度、多指标的灵活查询
 *
 * @query dimensions - 维度数组 (e.g., ['principle', 'pattern'])
 * @query metrics - 指标数组 (e.g., ['violations', 'checks'])
 * @query filters - 过滤条件 (可选)
 * @query groupBy - 分组字段 (可选)
 * @query period - 时间范围 (today|week|month|year|all)
 * @returns 自定义报告数据
 *
 * @example
 * ```bash
 * curl "http://localhost:3000/api/v1/analytics/reports/custom?dimensions=principle&metrics=violations&period=week"
 * ```
 */
app.get('/reports/custom',
  queryValidator({
    dimensions: z.array(z.string()).min(1),
    metrics: z.array(z.string()).min(1),
    filters: z.record(z.any()).optional(),
    groupBy: z.string().optional(),
    period: PeriodQuerySchema.optional()
  }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const query = c.get('validatedQuery');
      const period = parsePeriod(query.period || 'week');

      // TODO: Implement actual custom report logic in AnalyticsService
      // For now, return a placeholder structure
      const report = {
        dimensions: query.dimensions,
        metrics: query.metrics,
        period: query.period || 'week',
        groupBy: query.groupBy,
        data: [
          // Example data structure
          // Actual implementation would aggregate data from ViolationDataReader
        ],
        meta: {
          totalRecords: 0,
          generatedAt: new Date().toISOString()
        }
      };

      return successResponse(c, report);
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/export
 *
 * 导出分析数据 - 支持 CSV、JSON、Excel 格式
 *
 * @query format - 导出格式 (csv|json|excel)
 * @query period - 时间范围 (today|week|month|year|all)
 * @query metrics - 要导出的指标 (可选，默认全部)
 * @returns 导出的文件数据
 *
 * @example
 * ```bash
 * curl "http://localhost:3000/api/v1/analytics/export?format=csv&period=week"
 * curl "http://localhost:3000/api/v1/analytics/export?format=json&period=month&metrics=violations,checks"
 * ```
 */
app.get('/export',
  queryValidator({
    format: z.enum(['csv', 'json', 'excel']),
    period: PeriodQuerySchema.optional(),
    metrics: z.array(z.string()).optional()
  }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const query = c.get('validatedQuery');
      const period = parsePeriod(query.period || 'week');
      const format = query.format;

      // Get dashboard data (comprehensive data for export)
      const dashboard = await analyticsService.getDashboard(period);

      // Filter metrics if specified
      const metricsToExport = query.metrics || ['all'];

      // Format based on requested format
      switch (format) {
        case 'json':
          return c.json({
            success: true,
            data: {
              period: query.period || 'week',
              exportedAt: new Date().toISOString(),
              metrics: dashboard
            },
            meta: {
              format: 'json',
              timestamp: new Date().toISOString(),
              requestId: generateRequestId()
            }
          });

        case 'csv':
          // Convert to CSV format
          const csvData = convertDashboardToCSV(dashboard);
          return new Response(csvData, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="analytics-${query.period}-${Date.now()}.csv"`
            }
          });

        case 'excel':
          // TODO: Implement Excel export
          // For now, return CSV with Excel MIME type
          const excelData = convertDashboardToCSV(dashboard);
          return new Response(excelData, {
            headers: {
              'Content-Type': 'application/vnd.ms-excel',
              'Content-Disposition': `attachment; filename="analytics-${query.period}-${Date.now()}.xls"`
            }
          });

        default:
          return errorResponse(c, 'Invalid export format');
      }
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/compare
 *
 * 对比分析 - 比较基线期间和当前期间的指标变化
 *
 * @query baselinePeriod - 基线期间 (today|week|month|year)
 * @query currentPeriod - 当前期间 (today|week|month|year)
 * @query metrics - 要对比的指标数组
 * @returns 对比分析结果，包含差异和变化百分比
 *
 * @example
 * ```bash
 * curl "http://localhost:3000/api/v1/analytics/compare?baselinePeriod=month&currentPeriod=week&metrics=violations,checks"
 * ```
 */
app.get('/compare',
  queryValidator({
    baselinePeriod: z.enum(['today', 'week', 'month', 'year']),
    currentPeriod: z.enum(['today', 'week', 'month', 'year']),
    metrics: z.array(z.string()).min(1)
  }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const query = c.get('validatedQuery');
      const baselinePeriod = parsePeriod(query.baselinePeriod);
      const currentPeriod = parsePeriod(query.currentPeriod);

      // Get metrics for both periods
      const [baselineUsage, currentUsage] = await Promise.all([
        analyticsService.getUsageMetrics(baselinePeriod),
        analyticsService.getUsageMetrics(currentPeriod)
      ]);

      const [baselineQuality, currentQuality] = await Promise.all([
        analyticsService.getQualityMetrics(baselinePeriod),
        analyticsService.getQualityMetrics(currentPeriod)
      ]);

      const [baselinePerformance, currentPerformance] = await Promise.all([
        analyticsService.getPerformanceMetrics(baselinePeriod),
        analyticsService.getPerformanceMetrics(currentPeriod)
      ]);

      // Calculate comparisons
      const comparison = {
        period: {
          baseline: query.baselinePeriod,
          current: query.currentPeriod
        },
        metrics: {
          usage: compareMetrics(baselineUsage, currentUsage, ['totalChecks', 'totalRetros', 'activeUsers']),
          quality: compareMetrics(baselineQuality, currentQuality, ['violationRate', 'falsePositiveRate']),
          performance: compareMetrics(baselinePerformance, currentPerformance, ['avgCheckTime', 'slowCheckRate'])
        },
        summary: {
          totalChanges: 0, // Will be calculated
          improvements: 0,
          degradations: 0
        }
      };

      // Calculate summary
      let improvements = 0;
      let degradations = 0;
      Object.values(comparison.metrics).forEach((category: any) => {
        Object.values(category).forEach((metric: any) => {
          if (metric.change > 0) improvements++;
          if (metric.change < 0) degradations++;
        });
      });

      comparison.summary.improvements = improvements;
      comparison.summary.degradations = degradations;
      comparison.summary.totalChanges = improvements + degradations;

      return successResponse(c, comparison);
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/forecast
 *
 * 预测分析 - 基于历史数据预测未来趋势
 *
 * @query metric - 要预测的指标 (violations|checks|avgCheckTime)
 * @query method - 预测方法 (linear|arima)，默认 linear
 * @query periods - 预测周期数 (1-30)，默认 7
 * @query historicalPeriod - 历史数据期间 (week|month|year)，默认 month
 * @returns 预测结果和置信区间
 *
 * @example
 * ```bash
 * curl "http://localhost:3000/api/v1/analytics/forecast?metric=violations&method=linear&periods=7"
 * ```
 */
app.get('/forecast',
  queryValidator({
    metric: z.enum(['violations', 'checks', 'avgCheckTime']),
    method: z.enum(['linear', 'arima']).optional(),
    periods: z.coerce.number().int().min(1).max(30).optional(),
    historicalPeriod: z.enum(['week', 'month', 'year']).optional()
  }),
  async (c) => {
    if (!analyticsService) {
      return errorResponse(c, 'Analytics service not initialized');
    }

    try {
      const query = c.get('validatedQuery');
      const method = query.method || 'linear';
      const periods = query.periods || 7;
      const historicalPeriod = parsePeriod(query.historicalPeriod || 'month');

      // Get trend analysis for the metric
      const trendAnalysis = await analyticsService.getTrendAnalysis(query.metric, historicalPeriod);

      // Perform forecast based on method
      let forecast: any;
      if (method === 'linear') {
        forecast = performLinearForecast(trendAnalysis, periods);
      } else {
        // ARIMA is more complex, placeholder for now
        forecast = performLinearForecast(trendAnalysis, periods);
      }

      return successResponse(c, {
        metric: query.metric,
        method,
        historicalPeriod: query.historicalPeriod || 'month',
        forecast: forecast.predictions,
        confidence: forecast.confidence,
        trend: {
          direction: trendAnalysis.direction,
          slope: trendAnalysis.slope,
          confidence: trendAnalysis.confidence
        },
        meta: {
          forecastedAt: new Date().toISOString(),
          periods
        }
      });
    } catch (error) {
      return errorResponse(c, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

// ============================================================================
// Helper Functions for New Endpoints
// ============================================================================

/**
 * Convert dashboard data to CSV format
 */
function convertDashboardToCSV(dashboard: any): string {
  const headers = ['Metric', 'Value', 'Category'];
  const rows: string[][] = [headers];

  // Add summary metrics
  if (dashboard.summary) {
    Object.entries(dashboard.summary).forEach(([key, value]) => {
      rows.push([key, String(value), 'summary']);
    });
  }

  // Add quality metrics
  if (dashboard.quality) {
    Object.entries(dashboard.quality).forEach(([key, value]) => {
      rows.push([key, String(value), 'quality']);
    });
  }

  // Add performance metrics
  if (dashboard.performance) {
    Object.entries(dashboard.performance).forEach(([key, value]) => {
      rows.push([key, String(value), 'performance']);
    });
  }

  // Convert to CSV string
  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

/**
 * Compare metrics between two periods
 */
function compareMetrics(baseline: any, current: any, metricKeys: string[]): Record<string, any> {
  const result: Record<string, any> = {};

  metricKeys.forEach(key => {
    const baselineValue = baseline[key] || 0;
    const currentValue = current[key] || 0;
    const change = currentValue - baselineValue;
    const changePercent = baselineValue !== 0 ? (change / baselineValue) * 100 : 0;

    result[key] = {
      baseline: baselineValue,
      current: currentValue,
      change,
      changePercent: Math.round(changePercent * 100) / 100,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  });

  return result;
}

/**
 * Perform linear regression forecast
 */
function performLinearForecast(trendAnalysis: any, periods: number): any {
  const predictions: any[] = [];
  const slope = trendAnalysis.slope || 0;
  const lastValue = trendAnalysis.data && trendAnalysis.data.length > 0
    ? trendAnalysis.data[trendAnalysis.data.length - 1].value
    : 0;

  for (let i = 1; i <= periods; i++) {
    const predictedValue = lastValue + (slope * i);
    predictions.push({
      period: i,
      value: Math.max(0, Math.round(predictedValue * 100) / 100), // Ensure non-negative
      confidence: Math.max(0, trendAnalysis.confidence - (i * 0.05)) // Decrease confidence over time
    });
  }

  return {
    predictions,
    confidence: trendAnalysis.confidence,
    method: 'linear'
  };
}

// ============================================================================
// CRUD 路由 (Records) ⭐ NEW (v2.3.0)
// 已集成验证中间件 (Task 70)
// ============================================================================

/**
 * POST /api/v1/analytics/records
 *
 * 创建自定义分析记录
 *
 * @returns 创建的记录
 *
 * @example
 * ```bash
 * curl -X POST http://localhost:3000/api/v1/analytics/records \
 *   -H "Content-Type: application/json" \
 *   -d '{"type":"custom","name":"Weekly Report","config":{"period":"week"}}'
 * ```
 */
app.post('/records',
  bodyValidator(CreateRecordSchema),
  async (c) => {
    try {
      const body = c.get('validatedBody');
      const record = recordsStore.create(body);

      // Task 74: 推送记录创建事件
      broadcastAnalyticsEvent('analytics:record:created', {
        record,
        timestamp: new Date().toISOString()
      });

      return successResponse(c, record, 201);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return apiErrorResponse(c, ApiErrorCode.RESOURCE_ALREADY_EXISTS, error.message);
        }
        return apiErrorResponse(c, ApiErrorCode.VALIDATION_ERROR, error.message);
      }
      return apiErrorResponse(c, ApiErrorCode.INTERNAL_ERROR, 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/records
 *
 * 获取所有分析记录（支持分页）
 *
 * @returns 记录列表
 *
 * @example
 * ```bash
 * curl "http://localhost:3000/api/v1/analytics/records?page=1&limit=10"
 * ```
 */
app.get('/records',
  async (c) => {
    try {
      const rawQuery = c.req.query();

      // 解析并验证数字参数
      const page = rawQuery.page ? parseInt(rawQuery.page, 10) : 1;
      const limit = rawQuery.limit ? Math.min(parseInt(rawQuery.limit, 10), 100) : 20;

      // 验证解析结果
      if (isNaN(page) || page < 1) {
        return apiErrorResponse(c, ApiErrorCode.INVALID_FORMAT, 'page 必须是大于0的整数');
      }
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return apiErrorResponse(c, ApiErrorCode.INVALID_FORMAT, 'limit 必须是1-100之间的整数');
      }

      // 验证 sortBy
      const validSortBy = ['name', 'createdAt', 'updatedAt'];
      const sortBy = rawQuery.sortBy && validSortBy.includes(rawQuery.sortBy)
        ? rawQuery.sortBy
        : 'createdAt';

      // 验证 sortOrder
      const validSortOrder = ['asc', 'desc'];
      const sortOrder = rawQuery.sortOrder && validSortOrder.includes(rawQuery.sortOrder)
        ? rawQuery.sortOrder as 'asc' | 'desc'
        : 'desc';

      // 验证 type
      const validTypes = ['custom', 'scheduled', 'adhoc'];
      const type = rawQuery.type && validTypes.includes(rawQuery.type)
        ? rawQuery.type
        : undefined;

      const result = recordsStore.getPaginated({
        page,
        limit,
        type,
        sortBy,
        sortOrder
      });

      return c.json({
        success: true,
        data: result.data,
        meta: {
          pagination: result.pagination,
          timestamp: new Date().toISOString(),
          requestId: generateRequestId(),
          version: '2.3.0'
        }
      });
    } catch (error) {
      return apiErrorResponse(c, ApiErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * GET /api/v1/analytics/records/:id
 *
 * 获取单个分析记录
 *
 * @returns 记录详情
 */
app.get('/records/:id',
  paramValidator({ id: RecordIdParamSchema }),
  async (c) => {
    try {
      const params = c.get('validatedParams');
      const record = recordsStore.getById(params.id);

      if (!record) {
        return apiErrorResponse(c, ApiErrorCode.RESOURCE_NOT_FOUND, 'Record not found');
      }

      return successResponse(c, record);
    } catch (error) {
      return apiErrorResponse(c, ApiErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * PUT /api/v1/analytics/records/:id
 *
 * 更新分析记录
 *
 * @returns 更新后的记录
 */
app.put('/records/:id',
  paramValidator({ id: RecordIdParamSchema }),
  bodyValidator(UpdateRecordSchema),
  async (c) => {
    try {
      const params = c.get('validatedParams');
      const updates = c.get('validatedBody');

      const record = recordsStore.update(params.id, updates);

      // Task 74: 推送记录更新事件
      broadcastAnalyticsEvent('analytics:record:updated', {
        id: params.id,
        record,
        updates,
        timestamp: new Date().toISOString()
      });

      return successResponse(c, record);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return apiErrorResponse(c, ApiErrorCode.RESOURCE_NOT_FOUND, error.message);
        }
        if (error.message.includes('already exists')) {
          return apiErrorResponse(c, ApiErrorCode.RESOURCE_ALREADY_EXISTS, error.message);
        }
        return apiErrorResponse(c, ApiErrorCode.VALIDATION_ERROR, error.message);
      }
      return apiErrorResponse(c, ApiErrorCode.INTERNAL_ERROR, 'Unknown error');
    }
  }
);

/**
 * DELETE /api/v1/analytics/records/:id
 *
 * 删除分析记录
 *
 * @returns 删除结果
 */
app.delete('/records/:id',
  paramValidator({ id: RecordIdParamSchema }),
  async (c) => {
    try {
      const params = c.get('validatedParams');
      recordsStore.delete(params.id);

      // Task 74: 推送记录删除事件
      broadcastAnalyticsEvent('analytics:record:deleted', {
        id: params.id,
        timestamp: new Date().toISOString()
      });

      return c.json({
        success: true,
        message: `Record ${params.id} deleted successfully`,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: generateRequestId(),
          version: '2.3.0'
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return apiErrorResponse(c, ApiErrorCode.RESOURCE_NOT_FOUND, error.message);
      }
      return apiErrorResponse(c, ApiErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * 导出 Analytics 路由
 */
export default app;
