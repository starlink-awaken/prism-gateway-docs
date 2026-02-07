/**
 * Analytics API CRUD 操作测试
 *
 * @description
 * 测试 POST/PUT/DELETE 操作的完整功能
 *
 * @test_coverage
 * - POST 创建分析记录
 * - PUT 更新分析记录
 * - DELETE 删除分析记录
 * - 输入验证
 * - 错误处理
 * - 权限检查
 *
 * @module tests/api/routes/analytics-crud.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { buildApp, resetTestRecordsStore } from '../helper.js';

describe('Analytics API CRUD Operations', () => {
  let app: any;
  let authToken: string;

  beforeEach(async () => {
    // 清空记录存储以确保测试隔离
    await resetTestRecordsStore();

    app = await buildApp();

    // 获取认证Token（假设有认证端点）
    const response = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    const data = await response.json();
    authToken = data.data.accessToken;
  });

  afterEach(async () => {
    // 清理测试数据
    await resetTestRecordsStore();
  });

  describe('POST /api/v1/analytics/records', () => {
    it('应该成功创建分析记录', async () => {
      const newRecord = {
        type: 'custom',
        name: 'Weekly Performance Report',
        description: 'Custom weekly analysis',
        config: {
          metrics: ['violations', 'checks'],
          period: 'week'
        }
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(newRecord)
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.type).toBe('custom');
    });

    it('应该拒绝无效的输入', async () => {
      const invalidRecord = {
        type: 'invalid-type',
        name: '',  // 空名称
        config: 'not-an-object'  // 错误的类型
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(invalidRecord)
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      // 检查错误代码格式 (ERR_XXXX)
      expect(data.error).toMatch(/^ERR_\d+$/);
      expect(data.message).toBeDefined();
    });

    it('应该拒绝未认证的请求', async () => {
      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'custom', name: 'Test' })
      });

      expect(response.status).toBe(401);
    });

    it('应该拒绝重复的记录名称', async () => {
      const record = {
        type: 'custom',
        name: 'Duplicate Report',
        config: { period: 'week' }
      };

      // 第一次创建
      await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(record)
      });

      // 第二次创建同名
      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(record)
      });

      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.success).toBe(false);
      // 检查错误代码是资源已存在错误
      expect(data.error).toBe('ERR_3002');
      expect(data.message).toBeDefined();
    });
  });

  describe('PUT /api/v1/analytics/records/:id', () => {
    let recordId: string;

    beforeEach(async () => {
      // 确保authToken存在
      expect(authToken).toBeDefined();

      // 先创建一个记录
      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          type: 'custom',
          name: 'Update Test',
          config: { period: 'week' }
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      recordId = data.data.id;
    });

    it('应该成功更新分析记录', async () => {
      const updates = {
        name: 'Updated Report Name',
        description: 'Updated description',
        config: {
          metrics: ['violations', 'checks', 'retros'],
          period: 'month'
        }
      };

      const response = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updates)
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Report Name');
    });

    it('应该拒绝不存在的记录ID', async () => {
      const response = await app.request('/api/v1/analytics/records/non-existent-id', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ name: 'Updated' })
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      // 检查错误代码是资源未找到错误
      expect(data.error).toBe('ERR_3001');
      expect(data.message).toBeDefined();
    });

    it('应该拒绝无效的更新数据', async () => {
      const response = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          type: 'invalid-type',
          config: 'not-an-object'
        })
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      // 检查错误代码格式 (ERR_XXXX)
      expect(data.error).toMatch(/^ERR_\d+$/);
      expect(data.message).toBeDefined();
    });

    it('应该防止部分更新保留敏感字段', async () => {
      const response = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          id: 'malicious-id-attempt',  // 尝试修改ID
          type: 'custom',
          name: 'Test'
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.id).not.toBe('malicious-id-attempt');
    });
  });

  describe('DELETE /api/v1/analytics/records/:id', () => {
    let recordId: string;

    beforeEach(async () => {
      // 确保authToken存在
      expect(authToken).toBeDefined();

      // 先创建一个记录
      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          type: 'custom',
          name: 'Delete Test',
          config: { period: 'week' }
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      recordId = data.data.id;
    });

    it('应该成功删除分析记录', async () => {
      const response = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });

    it('删除后再次查询应该返回404', async () => {
      // 第一次删除
      await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      // 再次查询
      const response = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(404);
    });

    it('应该拒绝删除不存在的记录', async () => {
      const response = await app.request('/api/v1/analytics/records/non-existent-id', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      // 检查错误代码是资源未找到错误
      expect(data.error).toBe('ERR_3001');
      expect(data.message).toBeDefined();
    });

    it('应该拒绝未认证的删除请求', async () => {
      const response = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/analytics/records/:id', () => {
    let recordId: string;

    beforeEach(async () => {
      // 确保authToken存在
      expect(authToken).toBeDefined();

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          type: 'custom',
          name: 'Get Test',
          description: 'Test record',
          config: { period: 'week' }
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      recordId = data.data.id;
    });

    it('应该成功获取单个记录', async () => {
      const response = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(recordId);
      expect(data.data.name).toBe('Get Test');
    });

    it('应该返回404对于不存在的记录', async () => {
      const response = await app.request('/api/v1/analytics/records/non-existent', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/analytics/records', () => {
    beforeEach(async () => {
      // 创建多个测试记录
      const records = [
        { type: 'custom', name: 'Report 1', config: { period: 'week' } },
        { type: 'custom', name: 'Report 2', config: { period: 'month' } },
        { type: 'custom', name: 'Report 3', config: { period: 'year' } }
      ];

      for (const record of records) {
        await app.request('/api/v1/analytics/records', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(record)
        });
      }
    });

    it('应该返回所有记录列表', async () => {
      const response = await app.request('/api/v1/analytics/records', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(3);
    });

    it('应该支持分页', async () => {
      const response = await app.request('/api/v1/analytics/records?page=1&limit=2', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(2);
      expect(data.meta).toHaveProperty('pagination');
    });

    it('应该支持按类型过滤', async () => {
      const response = await app.request('/api/v1/analytics/records?type=custom', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      data.data.forEach((record: any) => {
        expect(record.type).toBe('custom');
      });
    });
  });
});
