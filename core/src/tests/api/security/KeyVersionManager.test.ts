/**
 * KeyVersionManager 单元测试
 *
 * @description
 * 测试密钥版本管理器的所有功能
 *
 * @testStrategy
 * - TDD 方法：先写测试，确保失败，然后实现
 * - 覆盖所有关键路径
 * - 边界条件和错误处理
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { KeyVersionManager } from '../../../api/security/KeyVersionManager.js';

describe('KeyVersionManager', () => {
  let manager: KeyVersionManager;

  beforeEach(() => {
    manager = new KeyVersionManager({
      masterKey: 'test-master-key-at-least-32-characters-long',
      rotationDays: 30,
      retentionDays: 90,
      autoRotationCheck: true
    });
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('初始化', () => {
    it('应该在构造时创建初始密钥版本', () => {
      const stats = manager.getStats();

      expect(stats.currentVersion).toBeGreaterThan(0);
      expect(stats.totalVersions).toBe(1);
    });

    it('应该生成有效的密钥', () => {
      const key = manager.getCurrentKey();

      expect(key).toBeDefined();
      expect(key.length).toBeGreaterThan(0);
      expect(typeof key).toBe('string');
    });
  });

  describe('密钥获取', () => {
    it('应该返回当前活跃密钥', () => {
      const currentKey = manager.getCurrentKey();

      expect(currentKey).toBeDefined();
      expect(currentKey.length).toBe(44); // Base64 编码的 32 字节
    });

    it('应该能够获取指定版本的密钥', () => {
      const version = manager.getStats().currentVersion;
      const key = manager.getKey(version);

      expect(key).toBeDefined();
    });

    it('应该为不存在的版本返回 undefined', () => {
      const key = manager.getKey(9999);

      expect(key).toBeUndefined();
    });

    it('应该返回所有密钥版本', () => {
      // 添加几个版本
      manager.addVersion();
      manager.addVersion();

      const allKeys = manager.getAllKeys();

      expect(allKeys.length).toBe(3);
      // 应该按版本号降序排列
      expect(allKeys[0].version).toBeGreaterThan(allKeys[1].version);
    });
  });

  describe('密钥轮换', () => {
    it('应该正确检测是否需要轮换', () => {
      // 新创建的管理器不应该需要轮换
      expect(manager.needsRotation()).toBe(false);
    });

    it('应该能够手动轮换密钥', () => {
      const oldVersion = manager.getStats().currentVersion;
      const oldKey = manager.getCurrentKey();

      const newVersion = manager.rotateKey(true);
      const newKey = manager.getCurrentKey();

      expect(newVersion).toBeGreaterThan(oldVersion);
      expect(newKey).not.toBe(oldKey);
    });

    it('非强制轮换应该尊重轮换周期', () => {
      // 新创建的管理器不应该自动轮换
      const oldVersion = manager.getStats().currentVersion;
      const newVersion = manager.rotateKey(false);

      expect(newVersion).toBe(oldVersion);
    });

    it('强制轮换应该创建新版本', () => {
      const oldVersion = manager.getStats().currentVersion;
      const newVersion = manager.rotateKey(true);

      expect(newVersion).toBe(oldVersion + 1);
    });

    it('旧密钥应该保留用于验证', () => {
      const oldKey = manager.getCurrentKey();
      const oldVersion = manager.getStats().currentVersion;

      // 轮换密钥
      manager.rotateKey(true);

      // 旧密钥应该仍然可以获取
      const retrievedOldKey = manager.getKey(oldVersion);
      expect(retrievedOldKey).toBe(oldKey);

      // 应该有两个版本
      expect(manager.getStats().totalVersions).toBe(2);
    });
  });

  describe('密钥清理', () => {
    it('应该清理过期的历史密钥', () => {
      // 创建多个版本
      manager.addVersion();
      manager.addVersion();

      const beforeStats = manager.getStats();
      expect(beforeStats.totalVersions).toBe(3);

      // 清理（默认保留期 90 天，新密钥不会被清理）
      const cleaned = manager.cleanupExpiredKeys();
      const afterStats = manager.getStats();

      expect(cleaned).toBe(0);
      expect(afterStats.totalVersions).toBe(3);
    });

    it('不应该清理当前活跃密钥', () => {
      const currentKey = manager.getCurrentKey();
      const currentVersion = manager.getStats().currentVersion;

      manager.cleanupExpiredKeys();

      // 当前密钥应该仍然存在
      expect(manager.getKey(currentVersion)).toBe(currentKey);
    });

    it('应该正确报告统计信息', () => {
      manager.addVersion();
      manager.addVersion();

      const stats = manager.getStats();

      expect(stats.currentVersion).toBe(3);
      expect(stats.totalVersions).toBe(3);
      expect(stats.oldestVersion).toBe(1);
      expect(stats.newestVersion).toBe(3);
      expect(stats.needsRotation).toBe(false);
      expect(stats.daysUntilRotation).toBeGreaterThan(0);
    });
  });

  describe('导入/导出', () => {
    it('应该能够导出所有版本', () => {
      manager.addVersion();
      manager.addVersion();

      const exported = manager.exportVersions();

      expect(exported.length).toBe(3);
      expect(exported[0].version).toBeDefined();
      expect(exported[0].key).toBeDefined();
      expect(exported[0].createdAt).toBeDefined();
      expect(exported[0].active).toBeDefined();
    });

    it('应该能够从导入的版本恢复', () => {
      // 创建一些版本
      manager.addVersion();
      manager.addVersion();
      const exported = manager.exportVersions();

      // 创建新管理器并导入
      const newManager = new KeyVersionManager({
        masterKey: 'another-master-key-at-least-32-characters-long',
        rotationDays: 30
      });

      newManager.importVersions(exported);

      // 验证恢复成功
      expect(newManager.getStats().totalVersions).toBe(3);
      expect(newManager.getStats().currentVersion).toBe(3);

      // 清理
      newManager.dispose();
    });
  });

  describe('边界条件', () => {
    it('应该正确处理只有单个版本的情况', () => {
      const singleManager = new KeyVersionManager({
        masterKey: 'test-master-key-at-least-32-characters-long'
      });

      expect(singleManager.getStats().totalVersions).toBe(1);

      singleManager.dispose();
    });

    it('应该能够处理多次轮换', () => {
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        manager.rotateKey(true);
      }

      const stats = manager.getStats();
      expect(stats.currentVersion).toBe(iterations + 1);
      expect(stats.totalVersions).toBe(iterations + 1);
    });
  });

  describe('安全性', () => {
    it('生成的密钥应该具有足够的熵', () => {
      const key1 = manager.generateKey();
      const key2 = manager.generateKey();
      const key3 = manager.generateKey();

      // 所有密钥应该不同
      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);

      // 密钥长度应该正确（Base64 编码的 32 字节 = 44 字符）
      expect(key1.length).toBe(44);
      expect(key2.length).toBe(44);
      expect(key3.length).toBe(44);
    });

    it('添加版本时应该将旧版本标记为非活跃', () => {
      manager.addVersion();

      const allKeys = manager.getAllKeys();
      const activeCount = allKeys.filter(k => k.active).length;

      expect(activeCount).toBe(1);
      // getAllKeys 按降序排列，所以第一个是最新版本
      expect(allKeys[0].active).toBe(true);
    });
  });
});
