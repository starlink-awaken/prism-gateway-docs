/**
 * 日志脱敏工具测试
 *
 * @description
 * LoggerSanitizer 的完整单元测试套件
 *
 * @test_coverage
 * - 日志注入防护
 * - 敏感信息过滤
 * - 结构化日志格式
 * - ANSI控制字符清理
 *
 * @module tests/infrastructure/logging/LoggerSanitizer.test
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { LoggerSanitizer } from '../../../infrastructure/logging/LoggerSanitizer.js';

describe('LoggerSanitizer', () => {
  let sanitizer: LoggerSanitizer;

  beforeEach(() => {
    sanitizer = new LoggerSanitizer();
  });

  describe('日志注入防护', () => {
    it('应该过滤换行符', () => {
      const input = 'User input\nmalicious command';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('\n');
      expect(sanitized).toContain(' ');
    });

    it('应该过滤回车符', () => {
      const input = 'User input\r\nmalicious command';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('\r');
      expect(sanitized).not.toContain('\n');
    });

    it('应该过滤ANSI转义序列', () => {
      const input = 'Normal text\x1b[31mRed text\x1b[0mNormal text';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('\x1b');
      expect(sanitized).not.toContain('[31m');
    });

    it('应该过滤控制字符（除Tab外）', () => {
      const input = 'Text\x00with\x01control\x02chars';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x01');
      expect(sanitized).not.toContain('\x02');
    });

    it('应该保留Tab字符', () => {
      const input = 'Column1\tColumn2\tColumn3';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).toContain('\t');
    });
  });

  describe('敏感信息过滤', () => {
    it('应该过滤密码', () => {
      const input = 'Database connection: password=secret123';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('应该过滤JWT Token', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('应该过滤API Key', () => {
      const input = 'API key: sk-1234567890abcdef';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('sk-1234567890abcdef');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('应该过滤数据库连接字符串', () => {
      const input = 'Connect to: postgresql://user:pass@host/db';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('postgresql://');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('应该过滤信用卡号', () => {
      const input = 'Card number: 4532-1234-5678-9010';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('4532-1234-5678-9010');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('应该过滤邮箱地址（可选）', () => {
      sanitizer = new LoggerSanitizer({ redactEmails: true });
      const input = 'User email: user@example.com';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('user@example.com');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('应该过滤IP地址（可选）', () => {
      sanitizer = new LoggerSanitizer({ redactIPs: true });
      const input = 'Request from 192.168.1.1';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).not.toContain('192.168.1.1');
      expect(sanitized).toContain('[REDACTED]');
    });
  });

  describe('结构化日志格式', () => {
    it('应该格式化为JSON', () => {
      const logData = {
        level: 'info',
        message: 'User logged in',
        userId: '123'
      };

      const formatted = sanitizer.formatStructured(logData);

      expect(formatted).toMatch(/^\{/);
      expect(formatted).toMatch(/\}$/);
      expect(() => JSON.parse(formatted)).not.toThrow();
    });

    it('应该包含时间戳', () => {
      const logData = {
        level: 'info',
        message: 'Test'
      };

      const formatted = sanitizer.formatStructured(logData);
      const parsed = JSON.parse(formatted);

      expect(parsed.timestamp).toBeDefined();
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('应该自动脱敏敏感字段', () => {
      const logData = {
        level: 'info',
        message: 'Login attempt',
        password: 'secret123',
        token: 'abc123'
      };

      const formatted = sanitizer.formatStructured(logData);
      const parsed = JSON.parse(formatted);

      expect(parsed.password).toBe('[REDACTED]');
      expect(parsed.token).toBe('[REDACTED]');
    });
  });

  describe('性能测试', () => {
    it('应该在1ms内完成短文本脱敏', () => {
      const input = 'User input with normal text';
      const start = performance.now();

      sanitizer.sanitize(input);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('应该在10ms内完成长文本脱敏', () => {
      const input = 'A'.repeat(10000) + '\n' + 'B'.repeat(10000);
      const start = performance.now();

      sanitizer.sanitize(input);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('边界情况', () => {
    it('应该处理空字符串', () => {
      const input = '';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).toBe('');
    });

    it('应该处理纯控制字符', () => {
      const input = '\n\r\t\x00\x01\x02';
      const sanitized = sanitizer.sanitize(input);

      // \n\r变成空格，\t保留，\x00\x01\x02被移除
      expect(sanitized).toBe(' \t');
    });

    it('应该处理Unicode字符', () => {
      const input = '中文 العربية 한글 Emoji 😊🎉';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).toContain('中文');
      expect(sanitized).toContain('😊');
    });

    it('应该处理超大字符串（1MB）', () => {
      const input = 'A'.repeat(1024 * 1024);

      expect(() => sanitizer.sanitize(input)).not.toThrow();
    });
  });
});
