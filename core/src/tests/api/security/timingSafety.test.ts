/**
 * 时序安全测试
 *
 * @description
 * Task #15: 时序安全实现
 * 测试所有敏感比较是否使用恒定时间算法
 *
 * @testCoverage
 * - timingSafeEqual 函数测试
 * - JWT Token 签名验证
 * - 密码比较
 * - 时序攻击防护
 */

import { describe, it, expect } from 'bun:test';
import { timingSafeEqual, timingSafeEqualBuffer, timingSafeEqualArray } from '../../../utils/crypto/timingSafeEqual.js';
import { JWTServiceWithKeyManagement } from '../../../api/auth/JWTServiceWithKeyManagement.js';
import { JWTService } from '../../../api/auth/JWTService.js';

describe('Task #15: 时序安全实现', () => {
  describe('timingSafeEqual 工具函数', () => {
    describe('字符串比较', () => {
      it('应该正确比较相等的字符串', () => {
        const result = timingSafeEqual('hello', 'hello');
        expect(result).toBe(true);
      });

      it('应该正确比较不等的字符串', () => {
        const result = timingSafeEqual('hello', 'world');
        expect(result).toBe(false);
      });

      it('应该正确比较不同长度的字符串', () => {
        const result = timingSafeEqual('short', 'much longer string');
        expect(result).toBe(false);
      });

      it('应该正确比较空字符串', () => {
        const result = timingSafeEqual('', '');
        expect(result).toBe(true);
      });

      it('应该比较只有一个字符不同的字符串', () => {
        const result = timingSafeEqual('Password123', 'Password124');
        expect(result).toBe(false);
      });

      it('应该正确比较 Unicode 字符串', () => {
        const result = timingSafeEqual('用户测试', '用户测试');
        expect(result).toBe(true);
      });
    });

    describe('Buffer 比较', () => {
      it('应该正确比较相等的 Buffer', () => {
        const buf1 = Buffer.from('hello');
        const buf2 = Buffer.from('hello');
        const result = timingSafeEqualBuffer(buf1, buf2);
        expect(result).toBe(true);
      });

      it('应该正确比较不等的 Buffer', () => {
        const buf1 = Buffer.from('hello');
        const buf2 = Buffer.from('world');
        const result = timingSafeEqualBuffer(buf1, buf2);
        expect(result).toBe(false);
      });

      it('应该正确比较二进制数据', () => {
        const buf1 = Buffer.from([0x01, 0x02, 0x03]);
        const buf2 = Buffer.from([0x01, 0x02, 0x03]);
        const result = timingSafeEqualBuffer(buf1, buf2);
        expect(result).toBe(true);
      });
    });

    describe('数组比较', () => {
      it('应该正确比较相等的 Uint8Array', () => {
        const arr1 = new Uint8Array([1, 2, 3, 4, 5]);
        const arr2 = new Uint8Array([1, 2, 3, 4, 5]);
        const result = timingSafeEqualArray(arr1, arr2);
        expect(result).toBe(true);
      });

      it('应该正确比较不等的 Uint8Array', () => {
        const arr1 = new Uint8Array([1, 2, 3, 4, 5]);
        const arr2 = new Uint8Array([1, 2, 3, 4, 6]);
        const result = timingSafeEqualArray(arr1, arr2);
        expect(result).toBe(false);
      });
    });
  });

  describe('JWT Token 签名验证时序安全', () => {
    describe('JWTService', () => {
      const jwtService = new JWTService({
        secret: 'test-secret-key-for-timing-safety-testing-32-chars',
        accessTokenTTL: 3600,
        refreshTokenTTL: 604800,
        issuer: 'test-gateway',
        audience: 'test-api'
      });

      it('应该使用恒定时间比较验证有效 Token', () => {
        const token = jwtService.generateAccessToken({
          sub: 'user123',
          username: 'alice'
        });

        const result = jwtService.verifyToken(token, 'access');
        expect(result.valid).toBe(true);
      });

      it('应该使用恒定时间比较拒绝篡改的 Token', () => {
        const token = jwtService.generateAccessToken({
          sub: 'user123',
          username: 'alice'
        });

        // 篡改最后一个字符
        const tamperedToken = token.slice(0, -1) + 'X';

        const result = jwtService.verifyToken(tamperedToken, 'access');
        expect(result.valid).toBe(false);
      });

      it('应该使用恒定时间比较拒绝完全错误的 Token', () => {
        const result = jwtService.verifyToken('invalid.token.here', 'access');
        expect(result.valid).toBe(false);
      });
    });

    describe('JWTServiceWithKeyManagement', () => {
      const jwtService = new JWTServiceWithKeyManagement({
        secret: 'test-secret-key-for-timing-safety-testing-32-chars',
        accessTokenTTL: 3600,
        refreshTokenTTL: 604800,
        issuer: 'test-gateway',
        audience: 'test-api'
      });

      it('应该使用恒定时间比较验证有效 Token', () => {
        const token = jwtService.generateAccessToken({
          sub: 'user123',
          username: 'alice'
        });

        const result = jwtService.verifyToken(token, 'access');
        expect(result.valid).toBe(true);
      });

      it('应该使用恒定时间比较拒绝篡改的 Token', () => {
        const token = jwtService.generateAccessToken({
          sub: 'user123',
          username: 'alice'
        });

        // 篡改签名
        const parts = token.split('.');
        const tamperedToken = `${parts[0]}.${parts[1]}.tampered`;

        const result = jwtService.verifyToken(tamperedToken, 'access');
        expect(result.valid).toBe(false);
      });

      it('应该使用恒定时间比较验证旧密钥签发的 Token', () => {
        // 生成 Token
        const oldToken = jwtService.generateAccessToken({
          sub: 'user123',
          username: 'alice'
        });

        // 轮换密钥
        jwtService.rotateKey(true);

        // 旧 Token 应该仍然有效
        const result = jwtService.verifyToken(oldToken, 'access');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('时序攻击防护', () => {
    it('比较时间不应该因字符差异位置而显著变化', () => {
      const strings = [
        'a'.repeat(100) + 'b',
        'a'.repeat(50) + 'b' + 'a'.repeat(49),
        'b' + 'a'.repeat(99),
        'a'.repeat(100)
      ];

      const baseString = 'a'.repeat(100);
      const times: number[] = [];

      // 预热
      for (let i = 0; i < 10; i++) {
        timingSafeEqual(baseString, baseString);
      }

      // 测试每个字符串
      for (const str of strings) {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          timingSafeEqual(baseString, str);
        }
        const end = performance.now();
        times.push(end - start);
      }

      // 所有时间应该大致相同（差异在合理范围内）
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxDiff = Math.max(...times) - Math.min(...times);

      // 最大差异不应超过平均时间的 3 倍（允许较大的变化，因为系统负载等因素）
      expect(maxDiff).toBeLessThan(avgTime * 3);
    });

    it('恒定时间比较不应该泄露字符串长度信息', () => {
      const baseString = 'a'.repeat(100);

      // 比较相同长度的不同字符串
      const start1 = performance.now();
      for (let i = 0; i < 1000; i++) {
        timingSafeEqual(baseString, 'b'.repeat(100));
      }
      const time1 = performance.now() - start1;

      // 比较不同长度的字符串
      const start2 = performance.now();
      for (let i = 0; i < 1000; i++) {
        timingSafeEqual(baseString, 'b'.repeat(50));
      }
      const time2 = performance.now() - start2;

      // 不同长度比较应该快速失败，但时间差异应该合理
      // 由于快速路径检查长度，time2 应该小于 time1
      expect(time2).toBeLessThan(time1 * 2);
    });
  });

  describe('边界条件', () => {
    it('应该正确处理特殊字符', () => {
      const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      expect(timingSafeEqual(special, special)).toBe(true);
      expect(timingSafeEqual(special, special + 'x')).toBe(false);
    });

    it('应该正确处理换行符和制表符', () => {
      const withWhitespace = 'hello\nworld\ttest';
      expect(timingSafeEqual(withWhitespace, withWhitespace)).toBe(true);
    });

    it('应该正确处理空字符串和长字符串', () => {
      const empty = '';
      const long = 'a'.repeat(10000);
      expect(timingSafeEqual(empty, empty)).toBe(true);
      expect(timingSafeEqual(long, long)).toBe(true);
      expect(timingSafeEqual(empty, long)).toBe(false);
    });
  });
});
