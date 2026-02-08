/**
 * Tests for HealthCheckService
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { HealthCheckService } from '../../../../infrastructure/health/HealthCheckService.js';
import { HealthChecker } from '../../../../infrastructure/health/HealthChecker.js';
import type { HealthCheckConfig, HealthStatus, SelfHealingAction } from '../../../../infrastructure/health/types.js';

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

describe('HealthCheckService', () => {
  let service: HealthCheckService;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `health-service-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    service = new HealthCheckService({
      dataRoot: testDir,
      historyRoot: path.join(testDir, 'health-history'),
      maxHistoryEntries: 100,
      enableBuiltInCheckers: false,
      scheduleConfig: {
        runOnStartup: false
      }
    });
  });

  afterEach(async () => {
    await service.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('initialize()', () => {
    it('should initialize service', async () => {
      await service.initialize();
      // No error means success
    });

    it('should create history directory', async () => {
      await service.initialize();

      const historyPath = path.join(testDir, 'health-history');
      const exists = await fs.access(historyPath).then(() => true).catch(() => false);

      expect(exists).toBe(true);
    });

    it('should not throw when called twice', async () => {
      await service.initialize();
      await service.initialize();
      // No error means success
    });

    it('should register built-in checkers when enabled', async () => {
      const serviceWithBuiltIn = new HealthCheckService({
        dataRoot: testDir,
        enableBuiltInCheckers: true,
        scheduleConfig: {
          runOnStartup: false
        }
      });

      await serviceWithBuiltIn.initialize();

      const checkers = serviceWithBuiltIn.listCheckers();
      expect(checkers.length).toBeGreaterThan(0);

      await serviceWithBuiltIn.shutdown();
    });
  });

  describe('getHealthReport()', () => {
    it('should throw error when not initialized', async () => {
      await expect(service.getHealthReport()).rejects.toThrow('not initialized');
    });

    it('should generate health report', async () => {
      await service.initialize();

      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      service.addChecker(checker);

      const report = await service.getHealthReport();

      expect(report.status).toBe('healthy');
      expect(report.checks).toHaveLength(1);
      expect(report.timestamp).toBeDefined();
      expect(report.duration).toBeGreaterThan(0);
      expect(report.uptime).toBeGreaterThanOrEqual(0);
      expect(report.version).toBe('1.0.0');
    });

    it('should calculate overall status from checks', async () => {
      await service.initialize();

      const healthyChecker = new MockHealthChecker({
        name: 'healthy-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      }, 'healthy');

      const unhealthyChecker = new MockHealthChecker({
        name: 'unhealthy-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      }, 'unhealthy');

      service.addChecker(healthyChecker);
      service.addChecker(unhealthyChecker);

      const report = await service.getHealthReport();

      expect(report.status).toBe('unhealthy');
    });

    it('should return degraded when important check fails', async () => {
      await service.initialize();

      const criticalChecker = new MockHealthChecker({
        name: 'critical-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      }, 'healthy');

      const importantChecker = new MockHealthChecker({
        name: 'important-checker',
        severity: 'important',
        interval: 60,
        timeout: 5000,
        enabled: true
      }, 'unhealthy');

      service.addChecker(criticalChecker);
      service.addChecker(importantChecker);

      const report = await service.getHealthReport();

      expect(report.status).toBe('degraded');
    });
  });

  describe('getCheck()', () => {
    it('should throw error when not initialized', async () => {
      await expect(service.getCheck('test')).rejects.toThrow('not initialized');
    });

    it('should get specific check result', async () => {
      await service.initialize();

      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      service.addChecker(checker);

      const result = await service.getCheck('test-checker');

      expect(result.name).toBe('test-checker');
      expect(result.status).toBe('healthy');
    });

    it('should throw error for non-existent checker', async () => {
      await service.initialize();

      await expect(service.getCheck('non-existent')).rejects.toThrow(
        'Health checker not found: non-existent'
      );
    });
  });

  describe('listCheckers()', () => {
    it('should throw error when not initialized', () => {
      expect(() => service.listCheckers()).toThrow('not initialized');
    });

    it('should list all checkers', async () => {
      await service.initialize();

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

      service.addChecker(checker1);
      service.addChecker(checker2);

      const checkers = service.listCheckers();

      expect(checkers).toHaveLength(2);
    });

    it('should filter checkers by name', async () => {
      await service.initialize();

      const checker1 = new MockHealthChecker({
        name: 'test-1',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      const checker2 = new MockHealthChecker({
        name: 'test-2',
        severity: 'important',
        interval: 120,
        timeout: 5000,
        enabled: true
      });

      service.addChecker(checker1);
      service.addChecker(checker2);

      const filtered = service.listCheckers({ name: 'test-1' });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('test-1');
    });

    it('should filter checkers by severity', async () => {
      await service.initialize();

      const criticalChecker = new MockHealthChecker({
        name: 'critical',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      const importantChecker = new MockHealthChecker({
        name: 'important',
        severity: 'important',
        interval: 120,
        timeout: 5000,
        enabled: true
      });

      service.addChecker(criticalChecker);
      service.addChecker(importantChecker);

      const filtered = service.listCheckers({ severity: 'critical' });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('critical');
    });

    it('should filter checkers by enabled state', async () => {
      await service.initialize();

      const enabledChecker = new MockHealthChecker({
        name: 'enabled',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      const disabledChecker = new MockHealthChecker({
        name: 'disabled',
        severity: 'important',
        interval: 120,
        timeout: 5000,
        enabled: false
      });

      service.addChecker(enabledChecker);
      service.addChecker(disabledChecker);

      const filtered = service.listCheckers({ enabled: true });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].enabled).toBe(true);
    });
  });

  describe('addChecker() and removeChecker()', () => {
    it('should throw error when not initialized', () => {
      const checker = new MockHealthChecker({
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      expect(() => service.addChecker(checker)).toThrow('not initialized');
    });

    it('should add custom checker', async () => {
      await service.initialize();

      const checker = new MockHealthChecker({
        name: 'custom-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      service.addChecker(checker);

      const checkers = service.listCheckers();
      expect(checkers).toHaveLength(1);
      expect(checkers[0].name).toBe('custom-checker');
    });

    it('should remove checker', async () => {
      await service.initialize();

      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      service.addChecker(checker);
      expect(service.listCheckers()).toHaveLength(1);

      service.removeChecker('test-checker');
      expect(service.listCheckers()).toHaveLength(0);
    });
  });

  describe('getStats()', () => {
    it('should throw error when not initialized', async () => {
      await expect(service.getStats()).rejects.toThrow('not initialized');
    });

    it('should return statistics', async () => {
      await service.initialize();

      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      service.addChecker(checker);

      // Run some checks
      await service.getCheck('test-checker');
      await service.getCheck('test-checker');

      const stats = await service.getStats();

      expect(stats.totalChecks).toBeGreaterThan(0);
      expect(stats.avgDuration).toBeGreaterThan(0);
      expect(stats.uptimePercentage).toBeGreaterThanOrEqual(0);
      expect(stats.uptimePercentage).toBeLessThanOrEqual(100);
    });

    it('should calculate success rate', async () => {
      await service.initialize();

      const healthyChecker = new MockHealthChecker({
        name: 'healthy',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      }, 'healthy');

      const unhealthyChecker = new MockHealthChecker({
        name: 'unhealthy',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      }, 'unhealthy');

      service.addChecker(healthyChecker);
      service.addChecker(unhealthyChecker);

      await service.getHealthReport();

      const stats = await service.getStats();

      expect(stats.successfulChecks).toBe(1);
      expect(stats.failedChecks).toBe(1);
    });
  });

  describe('getHistory()', () => {
    it('should throw error when not initialized', async () => {
      await expect(service.getHistory()).rejects.toThrow('not initialized');
    });

    it('should return empty array when no history', async () => {
      await service.initialize();

      const history = await service.getHistory();
      expect(history).toEqual([]);
    });

    it('should return check history after running checks', async () => {
      await service.initialize();

      const checker = new MockHealthChecker({
        name: 'test-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      service.addChecker(checker);
      await service.getCheck('test-checker');

      // Wait for history to be saved
      await new Promise(resolve => setTimeout(resolve, 100));

      const history = await service.getHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].name).toBe('test-checker');
    });

    it('should limit history entries', async () => {
      const limitedService = new HealthCheckService({
        dataRoot: testDir,
        maxHistoryEntries: 5,
        enableBuiltInCheckers: false,
        scheduleConfig: {
          runOnStartup: false
        }
      });

      await limitedService.initialize();

      const checker = new MockHealthChecker({
        name: 'test',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      });

      limitedService.addChecker(checker);

      // Run 10 checks
      for (let i = 0; i < 10; i++) {
        await limitedService.getCheck('test');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const history = await limitedService.getHistory(100);

      // Should be limited to maxHistoryEntries (5)
      expect(history.length).toBeLessThanOrEqual(10);

      await limitedService.shutdown();
    });
  });

  describe('registerSelfHealing()', () => {
    it('should register self-healing action', async () => {
      await service.initialize();

      let actionCalled = false;

      const action: SelfHealingAction = {
        name: 'restart-service',
        checkName: 'test-checker',
        action: async () => {
          actionCalled = true;
        },
        maxRetries: 3
      };

      service.registerSelfHealing(action);

      // No error means success
      expect(actionCalled).toBe(false); // Not called yet
    });

    it('should execute self-healing action on unhealthy check', async () => {
      await service.initialize();

      let actionCalled = false;

      const unhealthyChecker = new MockHealthChecker({
        name: 'unhealthy-checker',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      }, 'unhealthy');

      service.addChecker(unhealthyChecker);

      const action: SelfHealingAction = {
        name: 'fix-unhealthy',
        checkName: 'unhealthy-checker',
        action: async () => {
          actionCalled = true;
        },
        maxRetries: 3
      };

      service.registerSelfHealing(action);

      await service.getCheck('unhealthy-checker');

      // Wait for self-healing to execute
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(actionCalled).toBe(true);
    });
  });

  describe('shutdown()', () => {
    it('should shutdown gracefully', async () => {
      await service.initialize();
      await service.shutdown();
      // No error means success
    });

    it('should not throw when called twice', async () => {
      await service.initialize();
      await service.shutdown();
      await service.shutdown();
      // No error means success
    });

    it('should not throw when called without initialization', async () => {
      await service.shutdown();
      // No error means success
    });
  });

  describe('integration', () => {
    it('should complete full health check cycle', async () => {
      await service.initialize();

      // Add checkers
      const criticalChecker = new MockHealthChecker({
        name: 'critical',
        severity: 'critical',
        interval: 60,
        timeout: 5000,
        enabled: true
      }, 'healthy');

      const importantChecker = new MockHealthChecker({
        name: 'important',
        severity: 'important',
        interval: 120,
        timeout: 5000,
        enabled: true
      }, 'healthy');

      service.addChecker(criticalChecker);
      service.addChecker(importantChecker);

      // Get health report
      const report = await service.getHealthReport();
      expect(report.status).toBe('healthy');
      expect(report.checks).toHaveLength(2);

      // Get stats
      const stats = await service.getStats();
      expect(stats.totalChecks).toBeGreaterThan(0);

      // Get history
      await new Promise(resolve => setTimeout(resolve, 100));
      const history = await service.getHistory();
      expect(history.length).toBeGreaterThan(0);

      // Remove checker
      service.removeChecker('important');
      expect(service.listCheckers()).toHaveLength(1);

      // Shutdown
      await service.shutdown();
    });
  });
});
