/**
 * AnalyticsRecordsStore 类型过滤功能测试
 *
 * @description
 * 测试 AnalyticsRecordsStore 的类型过滤功能
 *
 * @test_coverage
 * - getAll() 方法按类型过滤
 * - 多种类型值测试
 * - 无类型参数返回所有
 * - 无效类型返回空
 * - API 路由类型查询参数集成
 *
 * @module tests/api/stores/AnalyticsRecordsStore.test
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { AnalyticsRecordsStore, AnalyticsRecord } from '../../../api/stores/AnalyticsRecordsStore.js';

describe('AnalyticsRecordsStore - 类型过滤功能', () => {
  let store: AnalyticsRecordsStore;

  beforeEach(() => {
    store = new AnalyticsRecordsStore();

    // 创建测试数据
    store.create({
      type: 'custom',
      name: 'Custom Report 1',
      description: 'First custom report',
      config: { period: 'week' }
    });

    store.create({
      type: 'custom',
      name: 'Custom Report 2',
      description: 'Second custom report',
      config: { period: 'month' }
    });

    store.create({
      type: 'scheduled',
      name: 'Scheduled Report 1',
      description: 'Auto-generated report',
      config: { period: 'day' }
    });

    store.create({
      type: 'adhoc',
      name: 'AdHoc Report 1',
      description: 'On-demand report',
      config: { period: 'year' }
    });

    store.create({
      type: 'scheduled',
      name: 'Scheduled Report 2',
      description: 'Weekly scheduled',
      config: { period: 'week' }
    });
  });

  describe('getAll() 类型过滤', () => {
    it('应该返回所有记录当不提供类型参数', () => {
      const result = store.getAll();
      expect(result.length).toBe(5);
    });

    it('应该只返回 custom 类型记录', () => {
      const result = store.getAll({ type: 'custom' });
      expect(result.length).toBe(2);
      expect(result.every(r => r.type === 'custom')).toBe(true);
      expect(result[0].name).toBe('Custom Report 1');
      expect(result[1].name).toBe('Custom Report 2');
    });

    it('应该只返回 scheduled 类型记录', () => {
      const result = store.getAll({ type: 'scheduled' });
      expect(result.length).toBe(2);
      expect(result.every(r => r.type === 'scheduled')).toBe(true);
      expect(result[0].name).toBe('Scheduled Report 1');
      expect(result[1].name).toBe('Scheduled Report 2');
    });

    it('应该只返回 adhoc 类型记录', () => {
      const result = store.getAll({ type: 'adhoc' });
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('adhoc');
      expect(result[0].name).toBe('AdHoc Report 1');
    });

    it('应该返回空数组当类型不存在', () => {
      const result = store.getAll({ type: 'nonexistent' });
      expect(result.length).toBe(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该与排序选项兼容', () => {
      const result = store.getAll({
        type: 'custom',
        sortBy: 'name',
        sortOrder: 'desc'
      });
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Custom Report 2');
      expect(result[1].name).toBe('Custom Report 1');
    });

    it('应该按创建时间排序（默认行为）', () => {
      const result = store.getAll({ type: 'custom' });
      expect(result.length).toBe(2);
      // 第一条应该是最早创建的
      expect(result[0].name).toBe('Custom Report 1');
    });
  });

  describe('getPaginated() 类型过滤', () => {
    it('应该支持分页中的类型过滤', () => {
      const result = store.getPaginated({
        page: 1,
        limit: 10,
        type: 'custom'
      });

      expect(result.data.length).toBe(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.data.every(r => r.type === 'custom')).toBe(true);
    });

    it('应该正确计算分页当使用类型过滤时', () => {
      const result = store.getPaginated({
        page: 1,
        limit: 1,
        type: 'custom'
      });

      expect(result.data.length).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('应该返回空结果当类型不匹配任何记录', () => {
      const result = store.getPaginated({
        page: 1,
        limit: 10,
        type: 'nonexistent'
      });

      expect(result.data.length).toBe(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('应该支持类型过滤与排序组合', () => {
      const result = store.getPaginated({
        page: 1,
        limit: 10,
        type: 'scheduled',
        sortBy: 'name',
        sortOrder: 'desc'
      });

      expect(result.data.length).toBe(2);
      expect(result.data[0].name).toBe('Scheduled Report 2');
      expect(result.data[1].name).toBe('Scheduled Report 1');
    });
  });

  describe('边界情况', () => {
    it('应该处理空存储的过滤', () => {
      const emptyStore = new AnalyticsRecordsStore();
      const result = emptyStore.getAll({ type: 'custom' });
      expect(result.length).toBe(0);
    });

    it('应该处理类型大小写（应该是精确匹配）', () => {
      const result = store.getAll({ type: 'CUSTOM' });
      // 精确匹配，不应该返回结果
      expect(result.length).toBe(0);
    });

    it('应该支持获取所有类型的统计', () => {
      const stats = store.getStats();
      expect(stats.total).toBe(5);
      expect(stats.byType.custom).toBe(2);
      expect(stats.byType.scheduled).toBe(2);
      expect(stats.byType.adhoc).toBe(1);
    });
  });
});

/**
 * API 路由集成测试（模拟）
 *
 * @description
 * 测试 API 路由层如何调用 Store 的过滤功能
 */
describe('API 路由 - 类型查询参数', () => {
  let store: AnalyticsRecordsStore;

  beforeEach(() => {
    store = new AnalyticsRecordsStore();

    // 创建测试数据
    store.create({ type: 'custom', name: 'Report 1' });
    store.create({ type: 'scheduled', name: 'Report 2' });
    store.create({ type: 'adhoc', name: 'Report 3' });
  });

  it('应该正确解析查询参数并调用 getAll', () => {
    // 模拟查询参数解析
    function mockGetRecords(query: { type?: string }) {
      const options = query.type ? { type: query.type } : undefined;
      return store.getAll(options);
    }

    const customRecords = mockGetRecords({ type: 'custom' });
    expect(customRecords.length).toBe(1);
    expect(customRecords[0].type).toBe('custom');

    const allRecords = mockGetRecords({});
    expect(allRecords.length).toBe(3);
  });

  it('应该支持分页与类型过滤组合', () => {
    function mockGetPaginated(query: {
      page?: string;
      limit?: string;
      type?: string;
    }) {
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');
      return store.getPaginated({
        page,
        limit,
        type: query.type
      });
    }

    const result = mockGetPaginated({ type: 'custom', page: '1', limit: '10' });
    expect(result.data.length).toBe(1);
    expect(result.data[0].type).toBe('custom');
  });
});
