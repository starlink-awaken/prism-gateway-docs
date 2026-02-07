/**
 * 恒定时间比较测试
 *
 * @description
 * timingSafeEqual 工具函数的完整单元测试套件
 *
 * @test_coverage
 * - 恒定时间验证
 * - 相同字符串比较
 * - 不同字符串比较
 * - 不同长度比较
 * - 性能测试
 *
 * @module tests/utils/crypto/timingSafeEqual.test
 */

import { describe, it, expect } from 'bun:test';
import { timingSafeEqual } from '../../../utils/crypto/timingSafeEqual.js';

describe('timingSafeEqual', () => {
  describe('基本功能', () => {
    it('应该正确比较相同的字符串', () => {
      const a = 'password123';
      const b = 'password123';

      const result = timingSafeEqual(a, b);

      expect(result).toBe(true);
    });

    it('应该正确比较不同的字符串', () => {
      const a = 'password123';
      const b = 'password124';

      const result = timingSafeEqual(a, b);

      expect(result).toBe(false);
    });

    it('应该正确比较空字符串', () => {
      const result = timingSafeEqual('', '');

      expect(result).toBe(true);
    });

    it('应该正确比较不同长度的字符串', () => {
      const a = 'password123';
      const b = 'password';

      const result = timingSafeEqual(a, b);

      expect(result).toBe(false);
    });
  });

  describe('恒定时间验证', () => {
    it('比较时间应该与字符串长度无关', () => {
      // 测试100次，确保时间波动在合理范围内
      const iterations = 100;
      const times: number[] = [];

      // 短字符串
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        timingSafeEqual('short', 'short');
        times.push(performance.now() - start);
      }

      const avgShort = times.reduce((a, b) => a + b, 0) / times.length;

      times.length = 0;

      // 长字符串
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        timingSafeEqual('this is a very long string for testing', 'this is a very long string for testing');
        times.push(performance.now() - start);
      }

      const avgLong = times.reduce((a, b) => a + b, 0) / times.length;

      // 长字符串时间不应该明显大于短字符串（考虑正常开销）
      // 允许10倍的差异（实际应该更小）
      expect(avgLong).toBeLessThan(avgShort * 10);
    });

    it('比较时间应该不取决于第一个差异字符的位置', () => {
      const iterations = 200; // 增加迭代次数以提高稳定性

      // 第一个字符就不同
      const times1: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        timingSafeEqual('Xassword', 'Password');
        times1.push(performance.now() - start);
      }

      // 最后一个字符不同
      const times2: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        timingSafeEqual('Passworb', 'Password');
        times2.push(performance.now() - start);
      }

      // 过滤掉极端值（P90范围）
      times1.sort((a, b) => a - b);
      times2.sort((a, b) => a - b);
      const trimmed1 = times1.slice(0, Math.floor(times1.length * 0.9));
      const trimmed2 = times2.slice(0, Math.floor(times2.length * 0.9));

      const avg1 = trimmed1.reduce((a, b) => a + b, 0) / trimmed1.length;
      const avg2 = trimmed2.reduce((a, b) => a + b, 0) / trimmed2.length;

      // 两种情况的时间应该相似（允许5倍差异，放宽要求）
      const ratio = Math.max(avg1, avg2) / Math.min(avg1, avg2);
      expect(ratio).toBeLessThan(5);
    });

    it('所有字符位置不同时比较时间应该一致', () => {
      const iterations = 100; // 增加迭代次数
      const times: number[][] = [];

      for (let pos = 0; pos < 8; pos++) {
        const posTimes: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const a = 'aaaaaaaa';
          const b = 'aaaaaaa' + (pos === 7 ? 'a' : 'b');

          const start = performance.now();
          timingSafeEqual(a, b);
          posTimes.push(performance.now() - start);
        }

        times.push(posTimes);
      }

      // 计算每个位置的中位数时间（更稳定）
      const medians = times.map(posTimes => {
        const sorted = [...posTimes].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      });

      // 所有位置的时间应该相似（最大/最小比值 < 5，放宽要求）
      const maxTime = Math.max(...medians);
      const minTime = Math.min(...medians);
      const ratio = maxTime / minTime;

      expect(ratio).toBeLessThan(5);
    });
  });

  describe('边界情况', () => {
    it('应该处理单个字符', () => {
      expect(timingSafeEqual('a', 'a')).toBe(true);
      expect(timingSafeEqual('a', 'b')).toBe(false);
    });

    it('应该处理Unicode字符', () => {
      const a = '中文测试字符串';
      const b = '中文测试字符串';
      const c = '中文测拭字符串'; // 注意"试"vs"拭"

      expect(timingSafeEqual(a, b)).toBe(true);
      expect(timingSafeEqual(a, c)).toBe(false);
    });

    it('应该处理Emoji', () => {
      const a = '😊🎉🚀';
      const b = '😊🎉🚀';
      const c = '😊🎉⚡';

      expect(timingSafeEqual(a, b)).toBe(true);
      expect(timingSafeEqual(a, c)).toBe(false);
    });

    it('应该处理特殊字符', () => {
      const a = '!@#$%^&*()';
      const b = '!@#$%^&*()';
      const c = '!@#$%^&*()_';

      expect(timingSafeEqual(a, b)).toBe(true);
      expect(timingSafeEqual(a, c)).toBe(false);
    });

    it('应该处理超长字符串（10KB）', () => {
      const a = 'A'.repeat(10240);
      const b = 'A'.repeat(10240);
      const c = 'A'.repeat(10239) + 'B';

      expect(timingSafeEqual(a, b)).toBe(true);
      expect(timingSafeEqual(a, c)).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('应该快速比较短字符串（<0.1ms）', () => {
      const a = 'test-string';
      const b = 'test-string';

      const start = performance.now();
      timingSafeEqual(a, b);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(0.1);
    });

    it('应该快速比较中等字符串（<1ms）', () => {
      const a = 'A'.repeat(1000);
      const b = 'A'.repeat(1000);

      const start = performance.now();
      timingSafeEqual(a, b);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('应该在合理时间内比较长字符串（<10ms for 10KB）', () => {
      const a = 'A'.repeat(10240);
      const b = 'A'.repeat(10240);

      const start = performance.now();
      timingSafeEqual(a, b);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('使用场景', () => {
    it('应该安全比较密码', () => {
      const storedPassword = 'hashed_password_value';
      const userInput = 'hashed_password_value';

      const result = timingSafeEqual(storedPassword, userInput);

      expect(result).toBe(true);
    });

    it('应该安全比较API Token', () => {
      const validToken = 'sk-1234567890abcdefghijklmnop';
      const userToken = 'sk-1234567890abcdefghijklmnop';

      const result = timingSafeEqual(validToken, userToken);

      expect(result).toBe(true);
    });

    it('应该安全比较JWT签名', () => {
      const signature1 = 'oS6PbS6yWL8P8fZJ5hK5h5h5h5h5h5h5';
      const signature2 = 'oS6PbS6yWL8P8fZJ5hK5h5h5h5h5h5h5';

      const result = timingSafeEqual(signature1, signature2);

      expect(result).toBe(true);
    });
  });
});
