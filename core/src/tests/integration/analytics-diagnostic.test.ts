/**
 * AnalyticsService 导入诊断测试
 *
 * @description
 * 测试AnalyticsService及其依赖的导入问题
 */

import { describe, it, expect } from 'bun:test';

describe('AnalyticsService导入诊断', () => {
  it('应该能导入CacheManager', async () => {
    const { CacheManager } = await import('../../core/analytics/cache/CacheManager.js');
    expect(CacheManager).toBeDefined();
  });

  it('应该能导入UsageAggregator', async () => {
    const { UsageAggregator } = await import('../../core/analytics/aggregators/UsageAggregator.js');
    expect(UsageAggregator).toBeDefined();
  });

  it('应该能导入AnalyticsService', async () => {
    try {
      const { AnalyticsService } = await import('../../core/analytics/AnalyticsService.js');
      expect(AnalyticsService).toBeDefined();
    } catch (error) {
      console.error('AnalyticsService导入失败:', error);
      throw error;
    }
  });
});
