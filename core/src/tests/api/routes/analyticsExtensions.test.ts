/**
 * Analytics API Extensions Tests
 *
 * @description
 * Comprehensive tests for Task 1.4: Analytics API Extensions
 * - Custom reports endpoint
 * - Export functionality (CSV/JSON/Excel)
 * - Compare analysis
 * - Forecast analysis
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import analyticsRouter, { initAnalytics } from '../../../api/routes/analytics.js';
import { AnalyticsService } from '../../../core/analytics/AnalyticsService.js';
import { TimePeriod } from '../../../core/analytics/models/TimePeriod.js';

// Mock MemoryStore
const mockMemoryStore = {
  getDataPath: () => '/tmp/test-analytics',
  ensureDirectory: () => Promise.resolve(),
  readJSON: () => Promise.resolve([]),
  writeJSON: () => Promise.resolve()
} as any;

// Create analytics service
const analyticsService = new AnalyticsService({ memoryStore: mockMemoryStore });

// Create Hono app with analytics routes
const app = new Hono();
app.route('/api/v1/analytics', analyticsRouter);

// Initialize analytics service
initAnalytics(analyticsService);

describe('Analytics API Extensions', () => {
  describe('GET /api/v1/analytics/reports/custom', () => {
    it('should return custom report with valid dimensions and metrics', async () => {
      const res = await app.request(
        '/api/v1/analytics/reports/custom?dimensions=principle&dimensions=pattern&metrics=violations&metrics=checks&period=week'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.dimensions).toEqual(['principle', 'pattern']);
      expect(data.data.metrics).toEqual(['violations', 'checks']);
      expect(data.data.period).toBe('week');
    });

    it('should support groupBy parameter', async () => {
      const res = await app.request(
        '/api/v1/analytics/reports/custom?dimensions=principle&metrics=violations&groupBy=principle&period=month'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.groupBy).toBe('principle');
    });

    it('should reject request without dimensions', async () => {
      const res = await app.request(
        '/api/v1/analytics/reports/custom?metrics=violations&period=week'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should reject request without metrics', async () => {
      const res = await app.request(
        '/api/v1/analytics/reports/custom?dimensions=principle&period=week'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should default to week period if not specified', async () => {
      const res = await app.request(
        '/api/v1/analytics/reports/custom?dimensions=principle&metrics=violations'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.period).toBe('week');
    });

    it('should include metadata in response', async () => {
      const res = await app.request(
        '/api/v1/analytics/reports/custom?dimensions=principle&metrics=violations&period=week'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.meta).toBeDefined();
      expect(data.data.meta.totalRecords).toBeDefined();
      expect(data.data.meta.generatedAt).toBeDefined();
    });
  });

  describe('GET /api/v1/analytics/export', () => {
    it('should export data in JSON format', async () => {
      const res = await app.request(
        '/api/v1/analytics/export?format=json&period=week'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.period).toBe('week');
      expect(data.data.exportedAt).toBeDefined();
      expect(data.meta.format).toBe('json');
    });

    it('should export data in CSV format', async () => {
      const res = await app.request(
        '/api/v1/analytics/export?format=csv&period=month'
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/csv');
      expect(res.headers.get('content-disposition')).toContain('analytics-month');
      expect(res.headers.get('content-disposition')).toContain('.csv');

      const text = await res.text();
      expect(text).toContain('Metric,Value,Category');
    });

    it('should export data in Excel format', async () => {
      const res = await app.request(
        '/api/v1/analytics/export?format=excel&period=year'
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/vnd.ms-excel');
      expect(res.headers.get('content-disposition')).toContain('analytics-year');
      expect(res.headers.get('content-disposition')).toContain('.xls');
    });

    it('should reject invalid format', async () => {
      const res = await app.request(
        '/api/v1/analytics/export?format=pdf&period=week'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should default to week period if not specified', async () => {
      const res = await app.request(
        '/api/v1/analytics/export?format=json'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.period).toBe('week');
    });

    it('should support metrics filtering', async () => {
      const res = await app.request(
        '/api/v1/analytics/export?format=json&period=week&metrics=violations&metrics=checks'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/compare', () => {
    it('should compare metrics between two periods', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=month&currentPeriod=week&metrics=violations&metrics=checks'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.period).toBeDefined();
      expect(data.data.period.baseline).toBe('month');
      expect(data.data.period.current).toBe('week');
    });

    it('should include usage metrics comparison', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=month&currentPeriod=week&metrics=violations'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.metrics).toBeDefined();
      expect(data.data.metrics.usage).toBeDefined();
    });

    it('should include quality metrics comparison', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=month&currentPeriod=week&metrics=violations'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.metrics.quality).toBeDefined();
    });

    it('should include performance metrics comparison', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=month&currentPeriod=week&metrics=violations'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.metrics.performance).toBeDefined();
    });

    it('should include summary with improvements and degradations', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=month&currentPeriod=week&metrics=violations'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.summary).toBeDefined();
      expect(data.data.summary.totalChanges).toBeDefined();
      expect(data.data.summary.improvements).toBeDefined();
      expect(data.data.summary.degradations).toBeDefined();
    });

    it('should reject request without baselinePeriod', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?currentPeriod=week&metrics=violations'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should reject request without currentPeriod', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=month&metrics=violations'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should reject request without metrics', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=month&currentPeriod=week'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should reject invalid period values', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=invalid&currentPeriod=week&metrics=violations'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });
  });

  describe('GET /api/v1/analytics/forecast', () => {
    it('should forecast metrics with linear method', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=7'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.metric).toBe('violations');
      expect(data.data.method).toBe('linear');
      expect(data.data.forecast).toBeDefined();
      expect(Array.isArray(data.data.forecast)).toBe(true);
      expect(data.data.forecast.length).toBe(7);
    });

    it('should default to linear method if not specified', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=checks&periods=5'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.method).toBe('linear');
    });

    it('should default to 7 periods if not specified', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.meta.periods).toBe(7);
      expect(data.data.forecast.length).toBe(7);
    });

    it('should default to month historical period if not specified', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=7'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.historicalPeriod).toBe('month');
    });

    it('should include trend information', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=7'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.trend).toBeDefined();
      expect(data.data.trend.direction).toBeDefined();
      expect(data.data.trend.slope).toBeDefined();
      expect(data.data.trend.confidence).toBeDefined();
    });

    it('should include confidence scores for each prediction', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=5'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.forecast).toBeDefined();
      data.data.forecast.forEach((prediction: any) => {
        expect(prediction.period).toBeDefined();
        expect(prediction.value).toBeDefined();
        expect(prediction.confidence).toBeDefined();
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should reject invalid metric', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=invalid&method=linear&periods=7'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should reject invalid method', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=invalid&periods=7'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should reject periods less than 1', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=0'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should reject periods greater than 30', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=31'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should support ARIMA method (falls back to linear)', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=arima&periods=7'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // Currently falls back to linear
      expect(data.data.forecast).toBeDefined();
    });

    it('should include metadata with forecast timestamp', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=7'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.meta).toBeDefined();
      expect(data.data.meta.forecastedAt).toBeDefined();
      expect(data.data.meta.periods).toBe(7);
    });
  });

  describe('Helper Functions', () => {
    it('should convert dashboard data to CSV format', async () => {
      const res = await app.request(
        '/api/v1/analytics/export?format=csv&period=week'
      );

      expect(res.status).toBe(200);
      const csvText = await res.text();

      // Check CSV headers
      expect(csvText).toContain('"Metric","Value","Category"');

      // Check CSV format (quoted fields, comma-separated)
      const lines = csvText.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    it('should compare metrics with correct calculation', async () => {
      const res = await app.request(
        '/api/v1/analytics/compare?baselinePeriod=month&currentPeriod=week&metrics=violations'
      );

      expect(res.status).toBe(200);
      const data = await res.json();

      // Check metric structure
      const usageMetrics = data.data.metrics.usage;
      Object.values(usageMetrics).forEach((metric: any) => {
        expect(metric.baseline).toBeDefined();
        expect(metric.current).toBeDefined();
        expect(metric.change).toBeDefined();
        expect(metric.changePercent).toBeDefined();
        expect(metric.trend).toBeDefined();
        expect(['up', 'down', 'stable']).toContain(metric.trend);
      });
    });

    it('should perform linear forecast with decreasing confidence', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=10'
      );

      expect(res.status).toBe(200);
      const data = await res.json();

      // Check that confidence decreases over time
      const forecasts = data.data.forecast;
      for (let i = 1; i < forecasts.length; i++) {
        expect(forecasts[i].confidence).toBeLessThanOrEqual(forecasts[i - 1].confidence);
      }
    });

    it('should ensure non-negative forecasted values', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=linear&periods=7'
      );

      expect(res.status).toBe(200);
      const data = await res.json();

      // Check all forecasted values are non-negative
      data.data.forecast.forEach((prediction: any) => {
        expect(prediction.value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for malformed query parameters', async () => {
      const res = await app.request(
        '/api/v1/analytics/reports/custom?dimensions=&metrics=violations'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should handle missing required parameters gracefully', async () => {
      const res = await app.request(
        '/api/v1/analytics/export'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('should validate enum values strictly', async () => {
      const res = await app.request(
        '/api/v1/analytics/forecast?metric=violations&method=random&periods=7'
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });
  });
});
