/**
 * MemoryStore 单元测试
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { MemoryStore } from '../core/MemoryStore';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    store.clearCache();
  });

  describe('Level-1: Hot 数据访问', () => {
    it('应该能够读取所有原则', async () => {
      const start = Date.now();
      const principles = await store.getPrinciples();
      const duration = Date.now() - start;

      expect(principles.length).toBe(5);
      expect(principles[0]).toHaveProperty('id');
      expect(principles[0]).toHaveProperty('name');
      expect(duration).toBeLessThan(100); // 性能要求: <100ms
    });

    it('应该能够根据ID获取单个原则', async () => {
      const principle = await store.getPrincipleById('P1');

      expect(principle).toBeDefined();
      expect(principle?.id).toBe('P1');
      expect(principle?.name).toBe('搜索优先原则');
    });

    it('应该能够读取所有成功模式', async () => {
      const patterns = await store.getSuccessPatterns();

      expect(patterns.length).toBe(23);
      expect(patterns[0]).toHaveProperty('id');
      expect(patterns[0]).toHaveProperty('dimension');
    });

    it('应该能够读取所有失败模式', async () => {
      const patterns = await store.getFailurePatterns();

      expect(patterns.length).toBe(9);
      expect(patterns[0]).toHaveProperty('id');
      expect(patterns[0]).toHaveProperty('severity');
    });

    it('应该能够搜索模式', async () => {
      const result = await store.searchPatterns('目标');

      expect(result.success.length).toBeGreaterThan(0);
      expect(result.success[0].name).toContain('目标');
    });

    it('应该使用缓存加速重复访问', async () => {
      await store.getPrinciples();
      await store.getPrinciples();

      // 缓存应该生效（验证缓存项存在）
      const cacheSize = (store as any).cache.size;
      expect(cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Level-2: Warm 数据读写', () => {
    it('应该能够保存复盘记录', async () => {
      const record = {
        id: 'test-retro-001',
        timestamp: new Date().toISOString(),
        type: 'quick' as const,
        project: '测试项目',
        duration: 5,
        summary: '测试复盘',
        lessons: ['测试教训'],
        improvements: ['测试改进']
      };

      await store.saveRetroRecord(record);

      // 验证能够读取
      const retrieved = await store.getRetroRecord('test-retro-001');
      expect(retrieved).toBeDefined();
      expect(retrieved?.summary).toBe('测试复盘');
    });

    it('应该能够记录违规', async () => {
      const violation = {
        id: 'test-violation-001',
        timestamp: new Date().toISOString(),
        principle_id: 'P1',
        principle_name: '搜索优先原则',
        severity: 'WARNING' as const,
        context: '测试上下文',
        action: '测试处理'
      };

      await store.recordViolation(violation);

      const recent = await store.getRecentViolations();
      expect(recent.length).toBeGreaterThan(0);
      expect(recent[recent.length - 1].id).toBe('test-violation-001');
    });
  });

  describe('Level-3: Cold 数据访问', () => {
    it('应该能够列出所有模板', async () => {
      const templates = await store.listTemplates();

      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('缓存管理', () => {
    it('应该能够清除缓存', async () => {
      await store.getPrinciples();
      store.clearCache();

      const cacheSize = (store as any).cache.size;
      expect(cacheSize).toBe(0);
    });
  });

  describe('统计信息', () => {
    it('应该能够获取存储统计', async () => {
      const stats = await store.getStats();

      expect(stats.principles).toBe(5);
      expect(stats.successPatterns).toBe(23);
      expect(stats.failurePatterns).toBe(9);
    });
  });
});
