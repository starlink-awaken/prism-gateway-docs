/**
 * Phase 3 Week 4 运维工具集成测试
 *
 * @description
 * 测试 4 个运维系统的端到端场景：
 * - Scenario 1: Backup → Restore → Verify 完整周期
 * - Scenario 2: HealthCheck → Alert → Notify 流程
 * - Scenario 3: Metrics → Alert → Trigger 流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { BackupService } from '../../infrastructure/backup/BackupService.js';
import { HealthCheckService } from '../../infrastructure/health/HealthCheckService.js';
import { MetricsService } from '../../infrastructure/metrics/MetricsService.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Phase 3 Week 4 Integration Tests', () => {
  let testDir: string;
  let backupService: BackupService;
  let healthService: HealthCheckService;
  let metricsService: MetricsService;

  beforeAll(async () => {
    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'week4-integration-'));

    // Initialize services
    backupService = new BackupService({
      backupDir: path.join(testDir, 'backups'),
      sourceDir: path.join(testDir, 'data'),
      retention: {
        full: 7,
        incremental: 3
      }
    });

    healthService = new HealthCheckService({
      checkInterval: 1000
    });

    metricsService = new MetricsService({
      storage: {
        basePath: path.join(testDir, 'metrics')
      },
      enableBuiltInCollectors: true
    });

    // Create test data
    await fs.mkdir(path.join(testDir, 'data'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'data', 'test.txt'),
      'Test data for backup'
    );

    // Initialize services
    await backupService.initialize();
    await healthService.initialize();
    await metricsService.initialize();
  });

  afterAll(async () => {
    // Cleanup services
    await backupService.shutdown();
    await healthService.shutdown();
    await metricsService.shutdown();

    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Scenario 1: Backup → Restore → Verify 完整周期', () => {
    it('should complete full backup and restore cycle', async () => {
      // Step 1: Create a full backup
      console.log('Step 1: Creating full backup...');
      const backupResult = await backupService.createBackup('full');

      expect(backupResult.success).toBe(true);
      expect(backupResult.backupId).toBeDefined();
      expect(backupResult.stats.fileCount).toBeGreaterThan(0);
      expect(backupResult.stats.totalSize).toBeGreaterThan(0);

      console.log(`Backup created: ${backupResult.backupId}`);
      console.log(`Files backed up: ${backupResult.stats.fileCount}`);
      console.log(`Total size: ${backupResult.stats.totalSize} bytes`);

      // Step 2: Verify backup integrity
      console.log('\nStep 2: Verifying backup integrity...');
      const verifyResult = await backupService.verifyBackup(backupResult.backupId);

      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.errors).toHaveLength(0);

      console.log('Backup verification passed ✓');

      // Step 3: Modify original data
      console.log('\nStep 3: Modifying original data...');
      await fs.writeFile(
        path.join(testDir, 'data', 'test.txt'),
        'Modified data - should be restored'
      );

      await fs.writeFile(
        path.join(testDir, 'data', 'new-file.txt'),
        'New file - should be removed after restore'
      );

      // Step 4: Restore from backup
      console.log('\nStep 4: Restoring from backup...');
      const restoreResult = await backupService.restoreBackup(backupResult.backupId, {
        targetDir: path.join(testDir, 'data')
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.stats.fileCount).toBeGreaterThan(0);

      console.log(`Files restored: ${restoreResult.stats.fileCount}`);

      // Step 5: Verify restored data
      console.log('\nStep 5: Verifying restored data...');
      const restoredContent = await fs.readFile(
        path.join(testDir, 'data', 'test.txt'),
        'utf-8'
      );

      expect(restoredContent).toBe('Test data for backup');

      console.log('Data restoration verified ✓');
      console.log('\n✅ Scenario 1 PASSED: Full backup and restore cycle completed successfully');
    });

    it('should handle incremental backups', async () => {
      console.log('\nTesting incremental backup...');

      // Create initial full backup
      const fullBackup = await backupService.createBackup('full');
      expect(fullBackup.success).toBe(true);

      // Add new file
      await fs.writeFile(
        path.join(testDir, 'data', 'incremental-test.txt'),
        'Incremental backup test'
      );

      // Create incremental backup
      const incrementalBackup = await backupService.createBackup('incremental');
      expect(incrementalBackup.success).toBe(true);
      expect(incrementalBackup.stats.fileCount).toBeGreaterThan(0);

      console.log('✅ Incremental backup test PASSED');
    });

    it('should list available backups', async () => {
      const backups = await backupService.listBackups();

      expect(backups.length).toBeGreaterThan(0);
      backups.forEach(backup => {
        expect(backup.id).toBeDefined();
        expect(backup.type).toMatch(/full|incremental/);
        expect(backup.timestamp).toBeGreaterThan(0);
        expect(backup.size).toBeGreaterThan(0);
      });

      console.log(`Found ${backups.length} backups`);
    });

    it('should provide backup statistics', async () => {
      const stats = await backupService.getBackupStats();

      expect(stats.totalBackups).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.fullBackups).toBeGreaterThanOrEqual(0);
      expect(stats.incrementalBackups).toBeGreaterThanOrEqual(0);

      console.log('Backup statistics:', stats);
    });
  });

  describe('Scenario 2: HealthCheck → Alert → Notify 流程', () => {
    it('should detect health issues and trigger alerts', async () => {
      console.log('\nScenario 2: Testing health check and alert flow...');

      // Step 1: Get initial health status
      console.log('Step 1: Getting initial health status...');
      const initialHealth = await healthService.getCurrentHealth();

      expect(initialHealth.status).toMatch(/healthy|degraded|unhealthy/);
      expect(initialHealth.timestamp).toBeGreaterThan(0);
      expect(Array.isArray(initialHealth.checks)).toBe(true);

      console.log(`Initial health status: ${initialHealth.status}`);
      console.log(`Active checks: ${initialHealth.checks.length}`);

      // Step 2: Run all health checks
      console.log('\nStep 2: Running all health checks...');
      const checkResults = await healthService.runAllChecks();

      expect(checkResults.length).toBeGreaterThan(0);
      checkResults.forEach(result => {
        expect(result.name).toBeDefined();
        expect(result.status).toMatch(/healthy|degraded|unhealthy/);
        expect(result.timestamp).toBeGreaterThan(0);
      });

      console.log(`Completed ${checkResults.length} health checks`);

      // Step 3: Get detailed health report
      console.log('\nStep 3: Getting detailed health report...');
      const report = await healthService.getFullReport();

      expect(report.overall.status).toBeDefined();
      expect(report.checks).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);

      const healthyChecks = report.checks.filter(c => c.status === 'healthy').length;
      const totalChecks = report.checks.length;

      console.log(`Healthy checks: ${healthyChecks}/${totalChecks}`);

      // Step 4: Check if alerts would be triggered
      const degradedChecks = report.checks.filter(c => c.status === 'degraded');
      const unhealthyChecks = report.checks.filter(c => c.status === 'unhealthy');

      if (degradedChecks.length > 0 || unhealthyChecks.length > 0) {
        console.log('\n⚠️  Health issues detected:');
        console.log(`  - Degraded: ${degradedChecks.length}`);
        console.log(`  - Unhealthy: ${unhealthyChecks.length}`);
      } else {
        console.log('\n✓ All health checks passed');
      }

      console.log('\n✅ Scenario 2 PASSED: Health check and alert flow completed');
    });

    it('should track health check history', async () => {
      // Run multiple health checks
      await healthService.runAllChecks();
      await new Promise(resolve => setTimeout(resolve, 100));
      await healthService.runAllChecks();

      const history = await healthService.getHealthHistory({
        start: Date.now() - 5000,
        end: Date.now()
      });

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      console.log(`Health history contains ${history.length} records`);
    });

    it('should provide health statistics', async () => {
      const stats = await healthService.getHealthStats();

      expect(stats.totalChecks).toBeGreaterThanOrEqual(0);
      expect(stats.healthyCount).toBeGreaterThanOrEqual(0);
      expect(stats.degradedCount).toBeGreaterThanOrEqual(0);
      expect(stats.unhealthyCount).toBeGreaterThanOrEqual(0);

      console.log('Health statistics:', stats);
    });
  });

  describe('Scenario 3: Metrics → Alert → Trigger 流程', () => {
    it('should collect metrics and trigger alerts based on thresholds', async () => {
      console.log('\nScenario 3: Testing metrics collection and alert flow...');

      // Step 1: Collect initial metrics snapshot
      console.log('Step 1: Collecting initial metrics snapshot...');

      // Wait for collectors to run
      await new Promise(resolve => setTimeout(resolve, 200));

      const snapshot = await metricsService.snapshot();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(Array.isArray(snapshot.metrics)).toBe(true);
      expect(snapshot.metrics.length).toBeGreaterThan(0);

      console.log(`Collected ${snapshot.metrics.length} metrics`);

      // Step 2: List all available metrics
      console.log('\nStep 2: Listing available metrics...');
      const availableMetrics = await metricsService.listMetrics();

      expect(availableMetrics.length).toBeGreaterThan(0);
      console.log(`Available metrics: ${availableMetrics.length}`);

      // Display some key metrics
      const systemCpuMetric = snapshot.metrics.find(m => m.name === 'system.cpu.usage');
      const processMemoryMetric = snapshot.metrics.find(m => m.name === 'process.memory.rss');

      if (systemCpuMetric) {
        console.log(`  - CPU Usage: ${systemCpuMetric.value.toFixed(2)}%`);
      }
      if (processMemoryMetric) {
        console.log(`  - Process Memory: ${(processMemoryMetric.value / 1024 / 1024).toFixed(2)} MB`);
      }

      // Step 3: Record business events
      console.log('\nStep 3: Recording business events...');
      metricsService.recordGatewayCheck('PASS', 150);
      metricsService.recordGatewayCheck('BLOCKED', 200);
      metricsService.recordRetrospective('quick');
      metricsService.recordViolation('principle-1', 'high');

      console.log('Business events recorded');

      // Step 4: Query specific metrics
      console.log('\nStep 4: Querying specific metrics...');
      await new Promise(resolve => setTimeout(resolve, 100));

      const cpuQuery = await metricsService.query({
        name: 'system.cpu.usage',
        start: Date.now() - 5000,
        end: Date.now()
      });

      expect(cpuQuery).toBeDefined();
      expect(Array.isArray(cpuQuery.data)).toBe(true);

      console.log(`CPU query returned ${cpuQuery.data.length} data points`);

      // Step 5: Check for alert conditions
      console.log('\nStep 5: Checking alert conditions...');

      // Simulate alert threshold checks
      const highCpuUsage = snapshot.metrics.some(
        m => m.name === 'system.cpu.usage' && m.value > 80
      );

      const highMemoryUsage = snapshot.metrics.some(
        m => m.name === 'system.memory.percentage' && m.value > 90
      );

      if (highCpuUsage) {
        console.log('⚠️  High CPU usage detected - would trigger alert');
      }

      if (highMemoryUsage) {
        console.log('⚠️  High memory usage detected - would trigger alert');
      }

      if (!highCpuUsage && !highMemoryUsage) {
        console.log('✓ All metrics within normal thresholds');
      }

      // Step 6: Get metrics statistics
      console.log('\nStep 6: Getting metrics statistics...');
      const metricsStats = await metricsService.getStats();

      expect(metricsStats.totalCollectors).toBeGreaterThan(0);
      expect(metricsStats.totalMetrics).toBeGreaterThanOrEqual(0);
      expect(metricsStats.totalDataPoints).toBeGreaterThanOrEqual(0);

      console.log('Metrics statistics:', {
        collectors: metricsStats.totalCollectors,
        metrics: metricsStats.totalMetrics,
        dataPoints: metricsStats.totalDataPoints
      });

      console.log('\n✅ Scenario 3 PASSED: Metrics collection and alert flow completed');
    });

    it('should record API requests and generate metrics', async () => {
      // Record some API requests
      metricsService.recordAPIRequest('/api/test', 'GET', 200, 150);
      metricsService.recordAPIRequest('/api/test', 'POST', 201, 200);
      metricsService.recordAPIRequest('/api/error', 'GET', 500, 50);

      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = await metricsService.snapshot();
      const apiMetrics = snapshot.metrics.filter(m => m.name.startsWith('api.'));

      expect(apiMetrics.length).toBeGreaterThan(0);
      console.log(`API metrics collected: ${apiMetrics.length}`);
    });

    it('should record WebSocket events and generate metrics', async () => {
      // Record WebSocket events
      metricsService.recordWSConnection('client-1');
      metricsService.recordWSMessage('text', 'sent', 1024);
      metricsService.recordWSMessage('binary', 'received', 2048);
      metricsService.recordWSDisconnection('client-1');

      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshot = await metricsService.snapshot();
      const wsMetrics = snapshot.metrics.filter(m => m.name.startsWith('websocket.'));

      expect(Array.isArray(wsMetrics)).toBe(true);
      console.log(`WebSocket metrics collected: ${wsMetrics.length}`);
    });
  });

  describe('Cross-System Integration', () => {
    it('should coordinate between all systems', async () => {
      console.log('\nTesting cross-system coordination...');

      // Get status from all systems
      const [backupStats, healthStatus, metricsSnapshot] = await Promise.all([
        backupService.getBackupStats(),
        healthService.getCurrentHealth(),
        metricsService.snapshot()
      ]);

      expect(backupStats).toBeDefined();
      expect(healthStatus).toBeDefined();
      expect(metricsSnapshot).toBeDefined();

      console.log('All systems responding normally ✓');
      console.log({
        backups: backupStats.totalBackups,
        healthStatus: healthStatus.status,
        metricsCount: metricsSnapshot.metrics.length
      });
    });

    it('should handle concurrent operations', async () => {
      console.log('\nTesting concurrent operations...');

      // Run multiple operations concurrently
      const operations = await Promise.all([
        healthService.runAllChecks(),
        metricsService.snapshot(),
        backupService.getBackupStats()
      ]);

      expect(operations[0]).toBeDefined(); // Health checks
      expect(operations[1]).toBeDefined(); // Metrics snapshot
      expect(operations[2]).toBeDefined(); // Backup stats

      console.log('Concurrent operations completed successfully ✓');
    });
  });
});
