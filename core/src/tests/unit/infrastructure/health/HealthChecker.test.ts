/**
 * Tests for HealthChecker base class
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { HealthChecker } from '../../../../infrastructure/health/HealthChecker.js';
import type { HealthCheckConfig, HealthStatus } from '../../../../infrastructure/health/types.js';

// Mock implementation for testing
class MockHealthChecker extends HealthChecker {
  private mockResult: { status: HealthStatus; message: string; metadata?: Record<string, unknown> };
  private shouldThrow: boolean;

  constructor(
    config: HealthCheckConfig,
    mockResult: { status: HealthStatus; message: string; metadata?: Record<string, unknown> },
    shouldThrow: boolean = false
  ) {
    super(config);
    this.mockResult = mockResult;
    this.shouldThrow = shouldThrow;
  }

  protected async performCheck(): Promise<{
    status: HealthStatus;
    message: string;
    metadata?: Record<string, unknown>;
  }> {
    if (this.shouldThrow) {
      throw new Error('Mock check failed');
    }

    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, 10));

    return this.mockResult;
  }
}

describe('HealthChecker', () => {
  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const config: HealthCheckConfig = {
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      };

      const checker = new MockHealthChecker(config, {
        status: 'healthy',
        message: 'OK'
      });

      expect(checker.name).toBe('test-checker');
      expect(checker.severity).toBe('critical');
      expect(checker.interval).toBe(60);
      expect(checker.enabled).toBe(true);
    });
  });

  describe('check()', () => {
    it('should perform check and return result', async () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      };

      const checker = new MockHealthChecker(config, {
        status: 'healthy',
        message: 'All good'
      });

      const result = await checker.check();

      expect(result.name).toBe('test');
      expect(result.status).toBe('healthy');
      expect(result.severity).toBe('critical');
      expect(result.message).toBe('All good');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should include metadata in result', async () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      };

      const metadata = { cpu: 50, memory: 70 };
      const checker = new MockHealthChecker(config, {
        status: 'degraded',
        message: 'High usage',
        metadata
      });

      const result = await checker.check();

      expect(result.metadata).toEqual(metadata);
    });

    it('should return unknown status when disabled', async () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: false
      };

      const checker = new MockHealthChecker(config, {
        status: 'healthy',
        message: 'OK'
      });

      const result = await checker.check();

      expect(result.status).toBe('unknown');
      expect(result.message).toBe('Check is disabled');
    });

    it('should handle check errors', async () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      };

      const checker = new MockHealthChecker(
        config,
        { status: 'healthy', message: 'OK' },
        true
      );

      const result = await checker.check();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Check failed');
      expect(result.error).toBe('Mock check failed');
    });

    it('should timeout long-running checks', async () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 100,
        enabled: true
      };

      // Create a checker that takes longer than timeout
      class SlowChecker extends HealthChecker {
        protected async performCheck() {
          await new Promise(resolve => setTimeout(resolve, 500));
          return { status: 'healthy' as HealthStatus, message: 'OK' };
        }
      }

      const checker = new SlowChecker(config);
      const result = await checker.check();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('timeout');
    });

    it('should increment check count', async () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      };

      const checker = new MockHealthChecker(config, {
        status: 'healthy',
        message: 'OK'
      });

      expect(checker.getCheckCount()).toBe(0);

      await checker.check();
      expect(checker.getCheckCount()).toBe(1);

      await checker.check();
      expect(checker.getCheckCount()).toBe(2);
    });

    it('should store last check result', async () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      };

      const checker = new MockHealthChecker(config, {
        status: 'healthy',
        message: 'OK'
      });

      expect(checker.getLastCheck()).toBeUndefined();

      const result = await checker.check();
      const lastCheck = checker.getLastCheck();

      expect(lastCheck).toEqual(result);
    });
  });

  describe('updateConfig()', () => {
    it('should update checker configuration', () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      };

      const checker = new MockHealthChecker(config, {
        status: 'healthy',
        message: 'OK'
      });

      checker.updateConfig({ enabled: false, interval: 120 });

      expect(checker.enabled).toBe(false);
      expect(checker.interval).toBe(120);
    });
  });

  describe('reset()', () => {
    it('should reset checker state', async () => {
      const config: HealthCheckConfig = {
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      };

      const checker = new MockHealthChecker(config, {
        status: 'healthy',
        message: 'OK'
      });

      await checker.check();
      expect(checker.getCheckCount()).toBe(1);
      expect(checker.getLastCheck()).toBeDefined();

      checker.reset();

      expect(checker.getCheckCount()).toBe(0);
      expect(checker.getLastCheck()).toBeUndefined();
    });
  });
});
