/**
 * CacheManager 单元测试
 *
 * @description
 * TDD RED 阶段：先编写测试，验证缓存层功能
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { CacheManager } from '../../../../infrastructure/cache/CacheManager.js';

describe('infrastructure/cache/CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({
      maxSize: 10,
      name: 'test-cache',
      enableStats: true
    });
  });

  describe('基础 CRUD', () => {
    it('应该能够设置和获取缓存', async () => {
      await cache.set('key1', { value: 'test1' });
      const value = await cache.get<{ value: string }>('key1');

      expect(value).toEqual({ value: 'test1' });
    });

    it('应该返回 null 对于不存在的键', async () => {
      const value = await cache.get('nonexistent');

      expect(value).toBeNull();
    });

    it('应该能够删除缓存', async () => {
      await cache.set('key1', { value: 'test1' });
      await cache.delete('key1');

      const value = await cache.get('key1');
      expect(value).toBeNull();
    });

    it('应该能够清空缓存', async () => {
      await cache.set('key1', { value: 'test1' });
      await cache.set('key2', { value: 'test2' });

      await cache.clear();

      expect(cache.size()).toBe(0);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('应该支持同步获取', () => {
      cache.setSync('key1', { value: 'test1' });
      const value = cache.getSync('key1');

      expect(value).toEqual({ value: 'test1' });
    });

    it('应该支持同步设置', () => {
      cache.setSync('key1', { value: 'test1' });
      const value = cache.getSync('key1');

      expect(value).toEqual({ value: 'test1' });
    });
  });

  describe('TTL 过期', () => {
    it('应该过期缓存项', async () => {
      await cache.set('key1', { value: 'test1' }, 100); // 100ms TTL

      // 立即获取应该成功
      let value = await cache.get('key1');
      expect(value).toEqual({ value: 'test1' });

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 过期后应该返回 null
      value = await cache.get('key1');
      expect(value).toBeNull();
    });

    it('应该支持没有 TTL 的缓存', async () => {
      await cache.set('key1', { value: 'test1' }); // 没有 TTL

      await new Promise(resolve => setTimeout(resolve, 100));

      const value = await cache.get('key1');
      expect(value).toEqual({ value: 'test1' });
    });

    it('has() 应该检查过期', async () => {
      await cache.set('key1', { value: 'test1' }, 100);

      expect(await cache.has('key1')).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(await cache.has('key1')).toBe(false);
    });
  });

  describe('LRU 淘汰', () => {
    it('应该在达到容量限制时淘汰最久未使用的项', async () => {
      // 填满缓存
      for (let i = 0; i < 10; i++) {
        await cache.set(`key${i}`, { value: i });
      }

      expect(cache.size()).toBe(10);

      // 添加第 11 项，应该淘汰 key0
      await cache.set('key10', { value: 10 });

      expect(cache.size()).toBe(10);
      expect(await cache.get('key0')).toBeNull();
      expect(await cache.get('key10')).toEqual({ value: 10 });
    });

    it('应该在更新已存在的键时不触发淘汰', async () => {
      // 填满缓存
      for (let i = 0; i < 10; i++) {
        await cache.set(`key${i}`, { value: i });
      }

      // 更新已存在的键
      await cache.set('key5', { value: 55 });

      expect(cache.size()).toBe(10);
      expect(await cache.get('key5')).toEqual({ value: 55 });
      // key0 应该还在
      expect(await cache.get('key0')).toEqual({ value: 0 });
    });
  });

  describe('统计信息', () => {
    it('应该正确统计命中和未命中', async () => {
      await cache.set('key1', { value: 'test1' });

      // 命中
      await cache.get('key1');
      await cache.get('key1');

      // 未命中
      await cache.get('key2');
      await cache.get('key2');

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(50);
    });

    it('应该正确计算命中率', async () => {
      await cache.set('key1', { value: 'test1' });

      // 3 次命中
      await cache.get('key1');
      await cache.get('key1');
      await cache.get('key1');

      // 1 次未命中
      await cache.get('key2');

      const stats = cache.getStats();

      expect(stats.hitRate).toBe(75); // 3/4 = 75%
    });

    it('应该能够重置统计', async () => {
      await cache.set('key1', { value: 'test1' });
      await cache.get('key1');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('应该返回缓存名称', () => {
      expect(cache.getName()).toBe('test-cache');
    });
  });

  describe('批量操作', () => {
    it('应该支持模式删除', async () => {
      await cache.set('analytics:usage:week', { value: 1 });
      await cache.set('analytics:quality:week', { value: 2 });
      await cache.set('other:key', { value: 3 });

      const count = await cache.deletePattern('analytics:usage:*');

      expect(count).toBe(1);
      expect(await cache.get('analytics:usage:week')).toBeNull();
      expect(await cache.get('analytics:quality:week')).toEqual({ value: 2 });
      expect(await cache.get('other:key')).toEqual({ value: 3 });
    });

    it('应该支持通配符删除', async () => {
      await cache.set('analytics:usage:week', { value: 1 });
      await cache.set('analytics:quality:week', { value: 2 });
      await cache.set('other:key', { value: 3 });

      const count = await cache.deletePattern('analytics:*');

      expect(count).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('应该支持批量设置', async () => {
      await cache.setMany([
        ['key1', { value: 1 }],
        ['key2', { value: 2 }],
        ['key3', { value: 3 }]
      ]);

      expect(cache.size()).toBe(3);
      expect(await cache.get('key1')).toEqual({ value: 1 });
    });

    it('应该支持批量获取', async () => {
      await cache.set('key1', { value: 1 });
      await cache.set('key2', { value: 2 });

      const values = await cache.getMany(['key1', 'key2', 'key3']);

      expect(values.size).toBe(2);
      expect(values.get('key1')).toEqual({ value: 1 });
      expect(values.get('key2')).toEqual({ value: 2 });
      expect(values.get('key3')).toBeUndefined();
    });

    it('应该支持批量删除', async () => {
      await cache.set('key1', { value: 1 });
      await cache.set('key2', { value: 2 });
      await cache.set('key3', { value: 3 });

      const count = await cache.deleteMany(['key1', 'key2', 'key4']);

      expect(count).toBe(2);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toEqual({ value: 3 });
    });
  });

  describe('其他功能', () => {
    it('应该检查键是否存在', async () => {
      await cache.set('key1', { value: 'test1' });

      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('key2')).toBe(false);
    });

    it('应该返回所有键', async () => {
      await cache.set('key1', { value: 'test1' });
      await cache.set('key2', { value: 'test2' });

      const keys = cache.keys();

      expect(keys.length).toBe(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('应该清理过期项', async () => {
      cache.setSync('key1', { value: 'test1' }, 100);
      cache.setSync('key2', { value: 'test2' }, 100);
      cache.setSync('key3', { value: 'test3' }, 10000); // 不会过期

      await new Promise(resolve => setTimeout(resolve, 150));

      const count = cache.cleanupExpired();

      expect(count).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('应该获取缓存项信息', async () => {
      await cache.set('key1', { value: 'test1' }, 60000);

      const info = cache.getEntryInfo('key1');

      expect(info).toBeDefined();
      expect(info?.createdAt).toBeInstanceOf(Date);
      expect(info?.lastAccessed).toBeInstanceOf(Date);
      expect(info?.expiresAt).toBeInstanceOf(Date);
      expect(info?.isExpired).toBe(false);
      expect(info?.ttl).toBeGreaterThan(0);
    });

    it('应该调整缓存容量', () => {
      cache.resize(5, true);

      expect(cache.getConfig().maxSize).toBe(5);

      // 填满新容量
      for (let i = 0; i < 5; i++) {
        cache.setSync(`key${i}`, { value: i });
      }

      expect(cache.size()).toBe(5);
    });

    it('应该缩小容量时淘汰多余项', () => {
      // 填满到 10
      for (let i = 0; i < 10; i++) {
        cache.setSync(`key${i}`, { value: i });
      }

      expect(cache.size()).toBe(10);

      // 缩小到 5
      cache.resize(5, true);

      expect(cache.size()).toBe(5);
    });

    it('应该获取配置', () => {
      const config = cache.getConfig();

      expect(config.name).toBe('test-cache');
      expect(config.maxSize).toBe(10);
      expect(config.enableStats).toBe(true);
    });
  });

  describe('类型安全', () => {
    it('应该支持泛型类型', async () => {
      interface User {
        id: string;
        name: string;
      }

      const userCache = new CacheManager<User>();

      await userCache.set('user1', { id: '1', name: 'Alice' });
      const user = await userCache.get('user1');

      if (user) {
        expect(user.name).toBe('Alice');
        // TypeScript 应该知道 user 的类型
        expect(user.id).toBe('1');
      }
    });
  });

  describe('并发安全', () => {
    it('应该支持并发写入', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key${i}`, { value: i }));
      }

      await Promise.all(promises);

      // 由于 LRU 淘汰，最终应该只有 maxSize 项
      expect(cache.size()).toBeLessThanOrEqual(10);
    });

    it('应该支持并发读取', async () => {
      await cache.set('key1', { value: 'test1' });

      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < 100; i++) {
        promises.push(cache.get('key1'));
      }

      const results = await Promise.all(promises);

      // 所有读取应该成功
      expect(results.every(r => r !== null)).toBe(true);

      const stats = cache.getStats();
      expect(stats.hits).toBe(100);
    });
  });
});
