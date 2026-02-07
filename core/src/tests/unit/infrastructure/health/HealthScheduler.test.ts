/**
 * Tests for HealthScheduler
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { HealthScheduler } from '../../../../infrastructure/health/HealthScheduler.js';
import { HealthChecker } from '../../../../infrastructure/health/HealthChecker.js';
import type { HealthCheckConfig, HealthStatus } from '../../../../infrastructure/health/types.js';

// Mock health checker for testing
class MockHealthChecker extends HealthChecker {
  private mockStatus: HealthStatus;

  constructor(config: HealthCheckConfig, mockStatus: HealthStatus = 'healthy') {
    super(config);
    this.mockStatus = mockStatus;
  }

  protected async performCheck() {
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      status: this.mockStatus,
      message: `Mock check: ${this.mockStatus}`
    };
  }

  setMockStatus(status: HealthStatus) {
    this.mockStatus = status;
  }
}

describe('HealthScheduler', () => {
  let scheduler: HealthScheduler;

  beforeEach(() => {
    scheduler = new HealthScheduler({
      criticalInterval: 30,
      importantInterval: 60,
      optionalInterval: 120,
      runOnStartup: false
    });
  });

  afterEach(async () => {
    await scheduler.stop();
  });

  describe('constructor', () => {
    it('should create scheduler with default config', () => {
      const defaultScheduler = new HealthScheduler();
      expect(defaultScheduler).toBeDefined();
    });

    it('should create scheduler with custom config', () => {
      const customScheduler = new HealthScheduler({
        criticalInterval: 10,
        importantInterval: 20,
        optionalInterval: 30,
        runOnStartup: true
      });

      expect(customScheduler).toBeDefined();
    });
  });

  describe('addChecker() and removeChecker()', () => {
    it('should add health checker', () => {
      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker);

      const checkers = scheduler.getCheckers();
      expect(checkers).toHaveLength(1);
      expect(checkers[0].name).toBe('test-checker');
    });

    it('should throw error when adding duplicate checker', () => {
      const checker1 = new MockHealthChecker({
        name: 'duplicate',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      const checker2 = new MockHealthChecker({
        name: 'duplicate',
        severity: 'important',
        interval: 120,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker1);

      expect(() => scheduler.addChecker(checker2)).toThrow(
        'Health checker already exists: duplicate'
      );
    });

    it('should remove health checker', () => {
      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker);
      expect(scheduler.getCheckers()).toHaveLength(1);

      scheduler.removeChecker('test-checker');
      expect(scheduler.getCheckers()).toHaveLength(0);
    });

    it('should not throw when removing non-existent checker', () => {
      expect(() => scheduler.removeChecker('non-existent')).not.toThrow();
    });
  });

  describe('getChecker()', () => {
    it('should get checker by name', () => {
      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker);

      const retrieved = scheduler.getChecker('test-checker');
      expect(retrieved).toBe(checker);
    });

    it('should return undefined for non-existent checker', () => {
      const retrieved = scheduler.getChecker('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getCheckers()', () => {
    it('should return empty array when no checkers', () => {
      const checkers = scheduler.getCheckers();
      expect(checkers).toEqual([]);
    });

    it('should return all registered checkers', () => {
      const checker1 = new MockHealthChecker({
        name: 'checker-1',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      const checker2 = new MockHealthChecker({
        name: 'checker-2',
        severity: 'important',
        interval: 120,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker1);
      scheduler.addChecker(checker2);

      const checkers = scheduler.getCheckers();
      expect(checkers).toHaveLength(2);
    });
  });

  describe('start() and stop()', () => {
    it('should start scheduler', async () => {
      await scheduler.start();
      // No error means success
    });

    it('should stop scheduler', async () => {
      await scheduler.start();
      await scheduler.stop();
      // No error means success
    });

    it('should throw error when starting twice', async () => {
      await scheduler.start();
      await expect(scheduler.start()).rejects.toThrow('already running');
    });

    it('should not throw when stopping twice', async () => {
      await scheduler.start();
      await scheduler.stop();
      await expect(scheduler.stop()).resolves.toBeUndefined();
    });

    it('should run checks on startup when configured', async () => {
      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      const schedulerWithStartup = new HealthScheduler({
        runOnStartup: true
      });

      schedulerWithStartup.addChecker(checker);
      await schedulerWithStartup.start();

      expect(checker.getCheckCount()).toBe(1);

      await schedulerWithStartup.stop();
    });

    it('should not run checks on startup when disabled', async () => {
      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker);
      await scheduler.start();

      expect(checker.getCheckCount()).toBe(0);
    });
  });

  describe('runCheck()', () => {
    it('should run specific check', async () => {
      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker);

      const result = await scheduler.runCheck('test-checker');

      expect(result.name).toBe('test-checker');
      expect(result.status).toBe('healthy');
    });

    it('should throw error for non-existent checker', async () => {
      await expect(scheduler.runCheck('non-existent')).rejects.toThrow(
        'Health checker not found: non-existent'
      );
    });

    it('should increment check count', async () => {
      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker);

      await scheduler.runCheck('test-checker');
      expect(checker.getCheckCount()).toBe(1);

      await scheduler.runCheck('test-checker');
      expect(checker.getCheckCount()).toBe(2);
    });
  });

  describe('runAllChecks()', () => {
    it('should run all registered checks', async () => {
      const checker1 = new MockHealthChecker({
        name: 'checker-1',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      const checker2 = new MockHealthChecker({
        name: 'checker-2',
        severity: 'important',
        interval: 120,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker1);
      scheduler.addChecker(checker2);

      const results = await scheduler.runAllChecks();

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('checker-1');
      expect(results[1].name).toBe('checker-2');
    });

    it('should return empty array when no checkers', async () => {
      const results = await scheduler.runAllChecks();
      expect(results).toEqual([]);
    });

    it('should run disabled checkers when called manually', async () => {
      const checker = new MockHealthChecker({
        name: 'disabled-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: false
      });

      scheduler.addChecker(checker);

      const results = await scheduler.runAllChecks();

      expect(results).toHaveLength(1);
      // Disabled checks return 'unknown' status
      expect(results[0].status).toBe('unknown');
    });
  });

  describe('onComplete()', () => {
    it('should call callback when check completes', async () => {
      let callbackCalled = false;
      let capturedResult: any = null;

      scheduler.onComplete(result => {
        callbackCalled = true;
        capturedResult = result;
      });

      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker);
      await scheduler.runCheck('test-checker');

      expect(callbackCalled).toBe(true);
      expect(capturedResult.name).toBe('test-checker');
    });
  });

  describe('updateSchedule()', () => {
    it('should update schedule configuration', () => {
      scheduler.updateSchedule({
        criticalInterval: 10,
        importantInterval: 20
      });

      // No error means success
    });

    it('should reschedule checks when running', async () => {
      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      scheduler.addChecker(checker);
      await scheduler.start();

      scheduler.updateSchedule({
        criticalInterval: 120
      });

      // No error means success
    });
  });

  describe('getStats()', () => {
    it('should return scheduler statistics', () => {
      const checker1 = new MockHealthChecker({
        name: 'checker-1',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      const checker2 = new MockHealthChecker({
        name: 'checker-2',
        severity: 'important',
        interval: 120,
        timeout: 5000,
        enabled: false
      });

      scheduler.addChecker(checker1);
      scheduler.addChecker(checker2);

      const stats = scheduler.getStats();

      expect(stats.totalChecks).toBe(2);
      expect(stats.enabledChecks).toBe(1);
      expect(stats.disabledChecks).toBe(1);
      expect(stats.runningChecks).toBe(0);
    });

    it('should return zero stats when no checkers', () => {
      const stats = scheduler.getStats();

      expect(stats.totalChecks).toBe(0);
      expect(stats.enabledChecks).toBe(0);
      expect(stats.disabledChecks).toBe(0);
      expect(stats.runningChecks).toBe(0);
    });
  });

  describe('periodic scheduling', () => {
    it('should schedule checks based on severity', async () => {
      const criticalChecker = new MockHealthChecker({
        name: 'critical',
        severity: 'critical',
        interval: 0, // Use config interval
        timeout: 5000,
        enabled: true
      });

      const fastScheduler = new HealthScheduler({
        criticalInterval: 1, // 1 second for faster testing
        runOnStartup: false
      });

      fastScheduler.addChecker(criticalChecker);
      await fastScheduler.start();

      // Wait for scheduled execution
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(criticalChecker.getCheckCount()).toBeGreaterThanOrEqual(1);

      await fastScheduler.stop();
    }, 3000);

    it('should use checker-specific interval when provided', async () => {
      const checker = new MockHealthChecker({
        name: 'custom-interval',
        severity: 'critical',
        interval: 1, // 1 second
        timeout: 5000,
        enabled: true
      });

      const customScheduler = new HealthScheduler({
        criticalInterval: 30, // Default 30 seconds
        runOnStartup: false
      });

      customScheduler.addChecker(checker);
      await customScheduler.start();

      // Wait for scheduled execution
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(checker.getCheckCount()).toBeGreaterThanOrEqual(1);

      await customScheduler.stop();
    }, 3000);
  });
});
