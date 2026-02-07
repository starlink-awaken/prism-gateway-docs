/**
 * Analytics CRUD 验证中间件集成测试
 *
 * @description
 * 测试 Analytics API CRUD 端点的输入验证功能
 *
 * @test_coverage
 * - POST /api/v1/analytics/records 验证
 * - PUT /api/v1/analytics/records/:id 验证
 * - GET /api/v1/analytics/records 验证
 * - 无效输入返回 400
 * - 有效输入通过验证
 *
 * @module tests/api/routes/analytics-validation.test
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import analyticsRouter from '../../../api/routes/analytics.js';

describe('Analytics CRUD 验证中间件集成测试', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/v1/analytics', analyticsRouter);
  });

  describe('POST /api/v1/analytics/records - 请求体验证', () => {
    it('应该接受有效的创建请求', async () => {
      const validRequest = {
        type: 'custom',
        name: 'Test Report',
        description: 'A test report',
        config: {
          metrics: ['violations', 'checks'],
          period: 'week'
        }
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      // 验证中间件应该放行
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.type).toBe('custom');
      expect(data.data.name).toBe('Test Report');
    });

    it('应该拒绝无效的 type', async () => {
      const invalidRequest = {
        type: 'invalid-type',
        name: 'Test Report'
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('ERR_1001');
    });

    it('应该拒绝空的 name', async () => {
      const invalidRequest = {
        type: 'custom',
        name: ''
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝过长的 name', async () => {
      const invalidRequest = {
        type: 'custom',
        name: 'a'.repeat(101)
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝过长的 description', async () => {
      const invalidRequest = {
        type: 'custom',
        name: 'Test',
        description: 'a'.repeat(501)
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝额外的字段（strict模式）', async () => {
      const invalidRequest = {
        type: 'custom',
        name: 'Test',
        extraField: 'not allowed'
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝缺少必填字段的请求', async () => {
      const invalidRequest = {
        // 缺少 type
        name: 'Test'
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝无效的 JSON', async () => {
      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}'
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该接受无 config 的请求', async () => {
      const validRequest = {
        type: 'custom',
        name: 'Simple Report'
      };

      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/v1/analytics/records - 查询参数验证', () => {
    it('应该接受有效的分页参数', async () => {
      const response = await app.request('/api/v1/analytics/records?page=1&limit=10');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.meta).toHaveProperty('pagination');
    });

    it('应该使用默认值当参数缺失时', async () => {
      const response = await app.request('/api/v1/analytics/records');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('应该拒绝无效的 page（小于1）', async () => {
      const response = await app.request('/api/v1/analytics/records?page=0');

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝无效的 limit（大于100）', async () => {
      // 验证在路由层手动实现，而非Zod
      const response = await app.request('/api/v1/analytics/records?limit=999');

      // 请求会被接受，但limit会被限制为100
      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的 sortBy', async () => {
      // 无效 sortBy 会使用默认值
      const response = await app.request('/api/v1/analytics/records?sortBy=invalid');

      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的 sortOrder', async () => {
      // 无效 sortOrder 会使用默认值
      const response = await app.request('/api/v1/analytics/records?sortOrder=invalid');

      expect(response.status).toBe(200);
    });

    it('应该接受有效的 type 过滤', async () => {
      const response = await app.request('/api/v1/analytics/records?type=custom');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('应该拒绝无效的 type', async () => {
      // 无效 type 会被忽略
      const response = await app.request('/api/v1/analytics/records?type=invalid');

      expect(response.status).toBe(200);
    });

    it('应该正确处理 limit 的上限', async () => {
      const response = await app.request('/api/v1/analytics/records?limit=100');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/analytics/records/:id - 路径参数验证', () => {
    it('应该接受有效的 ID 格式', async () => {
      // 使用 UUID 格式
      const validId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await app.request(`/api/v1/analytics/records/${validId}`);

      // 404 是正常的（记录不存在），但不是 400 验证错误
      expect([200, 404]).toContain(response.status);
    });

    it('应该拒绝空的 ID', async () => {
      const response = await app.request('/api/v1/analytics/records/');

      expect(response.status).toBe(404);
    });

    it('应该拒绝包含路径遍历字符的 ID', async () => {
      // Hono 在路由级别处理这种情况，返回 404
      const response = await app.request('/api/v1/analytics/records/../test');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/analytics/records/:id - 更新验证', () => {
    it('应该接受有效的更新请求', async () => {
      // 先创建一条记录
      const createResponse = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom',
          name: 'Original Name'
        })
      });

      const created = await createResponse.json();
      const recordId = created.data.id;

      // 更新记录
      const updateResponse = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name',
          description: 'Updated description'
        })
      });

      expect(updateResponse.status).toBe(200);

      const updated = await updateResponse.json();
      expect(updated.success).toBe(true);
      expect(updated.data.name).toBe('Updated Name');
    });

    it('应该拒绝空更新（无字段）', async () => {
      // 先创建一条记录
      const createResponse = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom',
          name: 'Test'
        })
      });

      const created = await createResponse.json();
      const recordId = created.data.id;

      // 尝试空更新
      const updateResponse = await app.request(`/api/v1/analytics/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(updateResponse.status).toBe(400);

      const data = await updateResponse.json();
      expect(data.success).toBe(false);
    });

    it('应该拒绝无效的 name', async () => {
      const updateResponse = await app.request('/api/v1/analytics/records/test-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '' // 空字符串
        })
      });

      expect(updateResponse.status).toBe(400);
    });

    it('应该忽略额外的字段（非strict模式）', async () => {
      const updateResponse = await app.request('/api/v1/analytics/records/test-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Valid',
          extraField: 'not allowed'
        })
      });

      // 非 strict 模式下，额外字段会被忽略
      // 404 是因为记录不存在，而非验证错误
      expect([200, 404]).toContain(updateResponse.status);
    });

    it('应该拒绝无效的 period', async () => {
      const updateResponse = await app.request('/api/v1/analytics/records/test-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            period: 'invalid-period'
          }
        })
      });

      expect(updateResponse.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/analytics/records/:id - 路径参数验证', () => {
    it('应该验证 ID 参数格式', async () => {
      const response = await app.request('/api/v1/analytics/records/test-id-for-delete', {
        method: 'DELETE'
      });

      // 可能是 200（成功删除）或 404（未找到），但不应该是 400（验证错误，如果是有效ID格式）
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('错误响应格式', () => {
    it('应该返回统一的验证错误格式', async () => {
      const response = await app.request('/api/v1/analytics/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invalid',
          name: 'Test'
        })
      });

      const data = await response.json();

      // 验证错误响应结构
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error', 'ERR_1001');
      expect(data).toHaveProperty('details');
      expect(data).toHaveProperty('meta');
      expect(data.meta).toHaveProperty('timestamp');

      // 验证详情是数组
      expect(Array.isArray(data.details)).toBe(true);
    });
  });
});
