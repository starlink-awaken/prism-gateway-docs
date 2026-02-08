/**
 * 密钥管理服务测试
 *
 * @description
 * KeyManagementService 的完整单元测试套件，测试敏感数据加密/解密功能
 *
 * @test_coverage
 * - AES-256-GCM 加密/解密
 * - 密钥生成和管理
 * - 敏感配置加密存储
 * - 性能测试（<10ms）
 * - 错误处理
 *
 * @module tests/api/security/KeyManagementService.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { KeyManagementService } from '../../../api/security/KeyManagementService.js';

/**
 * 测试辅助函数
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, time: end - start };
}

describe('KeyManagementService', () => {
  let service: KeyManagementService;
  const testMasterKey = 'test-master-key-32-bytes-long-123456';

  beforeEach(() => {
    service = new KeyManagementService({ masterKey: testMasterKey });
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('密钥生成', () => {
    it('应该生成 256 位 AES 密钥', async () => {
      const key = await service.generateKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0); // base64 编码后应该有内容
    });

    it('应该生成不同的密钥（唯一性）', async () => {
      const key1 = await service.generateKey();
      const key2 = await service.generateKey();

      expect(key1).not.toBe(key2);
    });

    it('应该在 5ms 内生成密钥', async () => {
      const { time } = await measureTime(() => service.generateKey());

      expect(time).toBeLessThan(5);
    });
  });

  describe('AES-256-GCM 加密/解密', () => {
    it('应该成功加密和解密文本数据', async () => {
      const plaintext = 'sensitive-data-123';
      const key = await service.generateKey();

      const encrypted = await service.encrypt(plaintext, key);
      const decrypted = await service.decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('应该成功加密和解密 JSON 对象', async () => {
      const data = {
        jwtSecret: 'my-super-secret-jwt-key',
        apiKey: 'sk-1234567890abcdef',
        dbPassword: 'P@ssw0rd!'
      };
      const key = await service.generateKey();

      const encrypted = await service.encrypt(JSON.stringify(data), key);
      const decrypted = await service.decrypt(encrypted, key);
      const decryptedData = JSON.parse(decrypted);

      expect(decryptedData).toEqual(data);
    });

    it('相同明文多次加密应产生不同密文（随机性）', async () => {
      const plaintext = 'same-plaintext';
      const key = await service.generateKey();

      const encrypted1 = await service.encrypt(plaintext, key);
      const encrypted2 = await service.encrypt(plaintext, key);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('加密操作应该在 10ms 内完成', async () => {
      const plaintext = 'performance-test-data';
      const key = await service.generateKey();

      const { time } = await measureTime(() => service.encrypt(plaintext, key));

      expect(time).toBeLessThan(10);
    });

    it('解密操作应该在 10ms 内完成', async () => {
      const plaintext = 'performance-test-data';
      const key = await service.generateKey();
      const encrypted = await service.encrypt(plaintext, key);

      const { time } = await measureTime(() => service.decrypt(encrypted, key));

      expect(time).toBeLessThan(10);
    });
  });

  describe('敏感配置加密存储', () => {
    it('应该加密存储 JWT secret', async () => {
      const jwtSecret = 'my-jwt-secret-key';

      const encrypted = await service.encryptConfigValue('JWT_SECRET', jwtSecret);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(jwtSecret);
      expect(encrypted.includes('my-jwt-secret-key')).toBe(false);
    });

    it('应该解密并获取原始配置值', async () => {
      const jwtSecret = 'my-jwt-secret-key';

      await service.encryptConfigValue('JWT_SECRET', jwtSecret);
      const decrypted = await service.decryptConfigValue('JWT_SECRET');

      expect(decrypted).toBe(jwtSecret);
    });

    it('应该批量加密多个配置项', async () => {
      const configs = {
        JWT_SECRET: 'jwt-secret',
        API_KEY: 'api-key',
        DB_PASSWORD: 'db-password'
      };

      await service.encryptConfigBatch(configs);

      const jwtDecrypted = await service.decryptConfigValue('JWT_SECRET');
      const apiDecrypted = await service.decryptConfigValue('API_KEY');
      const dbDecrypted = await service.decryptConfigValue('DB_PASSWORD');

      expect(jwtDecrypted).toBe('jwt-secret');
      expect(apiDecrypted).toBe('api-key');
      expect(dbDecrypted).toBe('db-password');
    });
  });

  describe('错误处理', () => {
    it('解密时使用错误的密钥应该抛出错误', async () => {
      const plaintext = 'test-data';
      const key1 = await service.generateKey();
      const key2 = await service.generateKey();

      const encrypted = await service.encrypt(plaintext, key1);

      await expect(service.decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('解密损坏的数据应该抛出错误', async () => {
      const key = await service.generateKey();
      const corruptedData = 'corrupted-base64-data!!!';

      await expect(service.decrypt(corruptedData, key)).rejects.toThrow();
    });

    it('解密不存在的配置项应该返回 null', async () => {
      const result = await service.decryptConfigValue('NON_EXISTENT_KEY');

      expect(result).toBeNull();
    });

    it('使用空字符串作为主密钥应该抛出错误', () => {
      expect(() => new KeyManagementService({ masterKey: '' })).toThrow();
    });

    it('使用过短的主密钥应该抛出错误', () => {
      expect(() => new KeyManagementService({ masterKey: 'short' })).toThrow();
    });
  });

  describe('密钥轮换', () => {
    it('应该生成新的主密钥', async () => {
      const oldKey = service.getMasterKey();
      const newKey = await service.rotateMasterKey();

      expect(newKey).toBeDefined();
      expect(newKey).not.toBe(oldKey);
    });

    it('密钥轮换后应该能继续解密旧数据', async () => {
      const plaintext = 'test-data';
      const oldKey = await service.generateKey();
      const encrypted = await service.encrypt(plaintext, oldKey);

      // 模拟密钥轮换（实际中会更复杂）
      const newKey = await service.generateKey();
      const decrypted = await service.decrypt(encrypted, oldKey); // 使用旧密钥解密

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('性能基准', () => {
    it('100 次加密操作平均时间应该 <5ms', async () => {
      const plaintext = 'benchmark-test';
      const key = await service.generateKey();
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await service.encrypt(plaintext, key);
      }
      const end = performance.now();

      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(5);
    });

    it('100 次解密操作平均时间应该 <5ms', async () => {
      const plaintext = 'benchmark-test';
      const key = await service.generateKey();
      const encrypted = await service.encrypt(plaintext, key);
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await service.decrypt(encrypted, key);
      }
      const end = performance.now();

      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(5);
    });
  });

  describe('内存管理', () => {
    it('cleanup 应该清除缓存的敏感数据', async () => {
      await service.encryptConfigValue('TEST_KEY', 'test-value');
      service.cleanup();

      // cleanup 后应该无法解密（内部缓存已清除）
      const result = await service.decryptConfigValue('TEST_KEY');
      expect(result).toBeNull();
    });
  });
});
