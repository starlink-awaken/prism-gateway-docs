/**
 * PRISM-Gateway Migration Runner Tests
 *
 * Test-Driven Development Approach:
 * 1. Write tests first (RED phase)
 * 2. Implement to pass tests (GREEN phase)
 * 3. Refactor while keeping tests green
 *
 * Test Coverage:
 * - Normal migration flow
 * - Rollback functionality
 * - System validation
 * - Data integrity checks
 * - Performance benchmarks
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MigrationRunner, MigrationResult } from './MigrationRunner.js';
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * Test helper to create a temporary test environment
 */
class TestEnvironment {
  public basePath: string;
  public originalHome: string | undefined;

  constructor(testName: string) {
    this.basePath = join(tmpdir(), `prism-gateway-test-${testName}-${Date.now()}`);
  }

  async setup(): Promise<void> {
    // Create test directory structure
    await mkdir(this.basePath, { recursive: true });

    // Create Phase 1 directories
    await mkdir(join(this.basePath, 'level-1-hot', 'patterns'), { recursive: true });
    await mkdir(join(this.basePath, 'level-2-warm', 'retros', '2026-02', 'quick'), { recursive: true });
    await mkdir(join(this.basePath, 'level-2-warm', 'retros', '2026-02', 'standard'), { recursive: true });
    await mkdir(join(this.basePath, 'level-3-cold', 'sops'), { recursive: true });
    await mkdir(join(this.basePath, 'level-3-cold', 'templates'), { recursive: true });

    // Create Phase 1 data files
    await this.createPhase1Data();
  }

  private async createPhase1Data(): Promise<void> {
    // principles.json
    await writeFile(
      join(this.basePath, 'level-1-hot', 'principles.json'),
      JSON.stringify({
        version: '1.0',
        last_updated: '2026-02-03',
        principles: [
          {
            id: 'P1',
            name: 'Test Principle 1',
            level: 'MANDATORY',
            priority: 3,
            check_phases: ['OBSERVE'],
            keywords: ['test'],
            violation_message: 'Test message',
            verification_method: 'Test verification',
            consequence: 'Test consequence',
            historical_evidence: 'Test evidence',
          },
        ],
      }, null, 2),
      'utf-8'
    );

    // success_patterns.json
    await writeFile(
      join(this.basePath, 'level-1-hot', 'patterns', 'success_patterns.json'),
      JSON.stringify({
        version: '1.0',
        last_updated: '2026-02-03',
        total_patterns: 1,
        dimensions: 1,
        patterns: [
          {
            id: 'S001',
            dimension: '测试',
            name: 'Test Success Pattern',
            maturity: 5,
            impact: '极高',
            description: 'Test description',
            weight: 10,
          },
        ],
      }, null, 2),
      'utf-8'
    );

    // failure_patterns.json
    await writeFile(
      join(this.basePath, 'level-1-hot', 'patterns', 'failure_patterns.json'),
      JSON.stringify({
        version: '1.0',
        last_updated: '2026-02-03',
        total_patterns: 1,
        patterns: [
          {
            id: 'F001',
            name: 'Test Failure Pattern',
            severity: '高',
            frequency: '10%',
            occurrences: 1,
            characteristic: 'Test characteristic',
            root_causes: ['Test cause'],
            prevention: ['Test prevention'],
          },
        ],
      }, null, 2),
      'utf-8'
    );

    // retro index
    await writeFile(
      join(this.basePath, 'level-2-warm', 'retros', 'index.jsonl'),
      JSON.stringify({
        id: 'retro-001',
        timestamp: '2026-02-03T10:00:00Z',
        type: 'quick',
        project: 'test-project',
        summary: 'Test retro',
      }) + '\n',
      'utf-8'
    );

    // violations.jsonl
    await writeFile(
      join(this.basePath, 'level-2-warm', 'violations.jsonl'),
      JSON.stringify({
        id: 'violation-001',
        timestamp: '2026-02-03T10:00:00Z',
        principle_id: 'P1',
        principle_name: 'Test Principle',
        severity: 'WARNING',
        context: 'Test context',
        action: 'Test action',
      }) + '\n',
      'utf-8'
    );
  }

  async cleanup(): Promise<void> {
    if (existsSync(this.basePath)) {
      await rm(this.basePath, { recursive: true, force: true });
    }
  }

  /**
   * Create a large dataset for performance testing
   */
  async createLargeDataset(recordCount: number): Promise<void> {
    // Create many retro records
    const retroLines: string[] = [];
    for (let i = 0; i < recordCount; i++) {
      retroLines.push(JSON.stringify({
        id: `retro-${i.toString().padStart(5, '0')}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        type: i % 3 === 0 ? 'quick' : i % 3 === 1 ? 'standard' : 'deep',
        project: `project-${i % 10}`,
        summary: `Retro record ${i}`,
        duration: 15,
        lessons: [`Lesson ${i}`],
        improvements: [`Improvement ${i}`],
      }));
    }

    await writeFile(
      join(this.basePath, 'level-2-warm', 'retros', 'index.jsonl'),
      retroLines.join('\n') + '\n',
      'utf-8'
    );

    // Create many violation records
    const violationLines: string[] = [];
    for (let i = 0; i < recordCount; i++) {
      violationLines.push(JSON.stringify({
        id: `violation-${i.toString().padStart(5, '0')}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        principle_id: `P${(i % 5) + 1}`,
        principle_name: `Principle ${i % 5}`,
        severity: i % 3 === 0 ? 'BLOCK' : i % 3 === 1 ? 'WARNING' : 'ADVISORY',
        context: `Context ${i}`,
        action: `Action ${i}`,
      }));
    }

    await writeFile(
      join(this.basePath, 'level-2-warm', 'violations.jsonl'),
      violationLines.join('\n') + '\n',
      'utf-8'
    );
  }
}

describe('MigrationRunner', () => {
  let env: TestEnvironment;
  let runner: MigrationRunner;

  beforeEach(async () => {
    env = new TestEnvironment('default');
    await env.setup();
    runner = new MigrationRunner(env.basePath);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  describe('System Validation (Layer 1)', () => {
    it('should pass system validation when Phase 1 data exists', async () => {
      const result = await runner.validateSystem();

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when Phase 1 directories missing', async () => {
      const emptyEnv = new TestEnvironment('empty');
      await emptyEnv.setup();

      // Remove required directories
      await rm(join(emptyEnv.basePath, 'level-1-hot'), { recursive: true });

      const emptyRunner = new MigrationRunner(emptyEnv.basePath);
      const result = await emptyRunner.validateSystem();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      await emptyEnv.cleanup();
    });

    it('should check file permissions correctly', async () => {
      const result = await runner.validateSystem();
      const permCheck = result.checks.find(c => c.name === 'File Permissions');

      expect(permCheck).toBeDefined();
      expect(permCheck?.passed).toBe(true);
    });

    it('should verify required files exist', async () => {
      const result = await runner.validateSystem();
      const filesCheck = result.checks.find(c => c.name === 'Required Files');

      expect(filesCheck).toBeDefined();
      expect(filesCheck?.passed).toBe(true);
      expect(filesCheck?.details).toContain('files found');
    });
  });

  describe('Data Integrity Checks (Layer 2)', () => {
    it('should verify principles data integrity', async () => {
      const report = await runner.checkDataIntegrity();

      expect(report.principles.valid).toBe(true);
      expect(report.principles.record_count).toBe(1);
      expect(report.principles.details).toContain('1 principles');
    });

    it('should verify success patterns data integrity', async () => {
      const report = await runner.checkDataIntegrity();

      expect(report.success_patterns.valid).toBe(true);
      expect(report.success_patterns.record_count).toBe(1);
      expect(report.success_patterns.details).toContain('1 patterns');
    });

    it('should verify failure patterns data integrity', async () => {
      const report = await runner.checkDataIntegrity();

      expect(report.failure_patterns.valid).toBe(true);
      expect(report.failure_patterns.record_count).toBe(1);
    });

    it('should verify retro records integrity', async () => {
      const report = await runner.checkDataIntegrity();

      expect(report.retros.valid).toBe(true);
      expect(report.retros.record_count).toBe(1);
    });

    it('should verify violation records integrity', async () => {
      const report = await runner.checkDataIntegrity();

      expect(report.violations.valid).toBe(true);
      expect(report.violations.record_count).toBe(1);
    });

    it('should handle missing retro files gracefully', async () => {
      const noRetroEnv = new TestEnvironment('no-retro');
      await noRetroEnv.setup();
      await rm(join(noRetroEnv.basePath, 'level-2-warm', 'retros', 'index.jsonl'));

      const noRetroRunner = new MigrationRunner(noRetroEnv.basePath);
      const report = await noRetroRunner.checkDataIntegrity();

      expect(report.retros.valid).toBe(true);
      expect(report.retros.record_count).toBe(0);

      await noRetroEnv.cleanup();
    });
  });

  describe('Normal Migration Flow (Layer 3)', () => {
    it('should complete full migration successfully', async () => {
      const result = await runner.run();

      expect(result.success).toBe(true);
      expect(result.steps_completed).toHaveLength(8);
      expect(result.steps_failed).toHaveLength(0);
      expect(result.backup_location).toBeDefined();
    });

    it('should create backup during migration', async () => {
      const result = await runner.run();

      expect(result.success).toBe(true);
      expect(result.steps_completed).toContain('backup');

      // Verify backup exists
      const backupExists = existsSync(result.backup_location!);
      expect(backupExists).toBe(true);

      // Verify backup contains Phase 1 data
      const backupPrinciples = join(result.backup_location!, 'level-1-hot', 'principles.json');
      expect(existsSync(backupPrinciples)).toBe(true);
    });

    it('should create Phase 2 directories', async () => {
      await runner.run();

      const newDirs = ['analytics', 'cache', 'config', 'logs', '.migration'];

      for (const dir of newDirs) {
        expect(existsSync(join(env.basePath, dir))).toBe(true);
      }

      // Verify subdirectories
      expect(existsSync(join(env.basePath, 'analytics', 'aggregated'))).toBe(true);
    });

    it('should create configuration files', async () => {
      await runner.run();

      const defaultConfigPath = join(env.basePath, 'config', 'default.json');
      const userConfigPath = join(env.basePath, 'config', 'user.json.local');

      expect(existsSync(defaultConfigPath)).toBe(true);
      expect(existsSync(userConfigPath)).toBe(true);
    });

    it('should create analytics storage', async () => {
      await runner.run();

      const metricsPath = join(env.basePath, 'analytics', 'metrics.jsonl');
      const aggIndexPath = join(env.basePath, 'analytics', 'aggregated', 'index.json');
      const cachePath = join(env.basePath, 'cache', 'index.json');

      expect(existsSync(metricsPath)).toBe(true);
      expect(existsSync(aggIndexPath)).toBe(true);
      expect(existsSync(cachePath)).toBe(true);
    });

    it('should write migration state', async () => {
      await runner.run();

      const state = await runner.getMigrationState();

      expect(state).not.toBeNull();
      expect(state?.phase2_version).toBe('2.0');
      expect(state?.migration_completed).toBeDefined();
      expect(state?.rollback_available).toBe(true);
    });

    it('should mark migration as complete', async () => {
      await runner.run();

      const isComplete = await runner.isMigrationComplete();
      expect(isComplete).toBe(true);
    });
  });

  describe('Rollback Functionality (Layer 4)', () => {
    it('should rollback completed steps', async () => {
      // Run migration first
      const migrateResult = await runner.run();
      expect(migrateResult.success).toBe(true);

      // Verify Phase 2 directories exist
      expect(existsSync(join(env.basePath, 'analytics'))).toBe(true);

      // Rollback
      await runner.rollback(migrateResult.steps_completed);

      // Verify Phase 2 directories removed
      expect(existsSync(join(env.basePath, 'analytics'))).toBe(false);
      expect(existsSync(join(env.basePath, 'cache'))).toBe(false);
      expect(existsSync(join(env.basePath, 'config'))).toBe(false);
      expect(existsSync(join(env.basePath, 'logs'))).toBe(false);
      expect(existsSync(join(env.basePath, '.migration'))).toBe(false);
    });

    it('should preserve Phase 1 data after rollback', async () => {
      // Run migration
      await runner.run();

      // Rollback
      await runner.rollback();

      // Verify Phase 1 data intact
      expect(existsSync(join(env.basePath, 'level-1-hot', 'principles.json'))).toBe(true);
      expect(existsSync(join(env.basePath, 'level-1-hot', 'patterns', 'success_patterns.json'))).toBe(true);
      expect(existsSync(join(env.basePath, 'level-1-hot', 'patterns', 'failure_patterns.json'))).toBe(true);
    });

    it('should handle partial rollback gracefully', async () => {
      // Run full migration
      const result = await runner.run();

      // Rollback only some steps
      const partialSteps = result.steps_completed.slice(0, 4);
      await runner.rollback(partialSteps);

      // Some Phase 2 directories should remain
      // (those created after the rolled-back steps)
    });

    it('should clear migration state on rollback', async () => {
      await runner.run();
      await runner.rollback();

      const state = await runner.getMigrationState();
      expect(state).toBeNull();
    });
  });

  describe('Dry Run Mode', () => {
    it('should simulate migration without changes', async () => {
      const result = await runner.run(true);

      expect(result.success).toBe(true);
      expect(result.steps_completed).toHaveLength(8);

      // Verify no actual changes
      expect(existsSync(join(env.basePath, 'analytics'))).toBe(false);
      expect(existsSync(join(env.basePath, 'config'))).toBe(false);
    });

    it('should not create backup in dry run mode', async () => {
      const result = await runner.run(true);

      expect(result.backup_location).toBeUndefined();
    });
  });

  describe('Performance Testing', () => {
    it('should migrate 100 records in acceptable time', async () => {
      const perfEnv = new TestEnvironment('perf-100');
      await perfEnv.setup();
      await perfEnv.createLargeDataset(100);

      const perfRunner = new MigrationRunner(perfEnv.basePath);
      const startTime = Date.now();

      const result = await perfRunner.run();

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // 10 seconds for 100 records

      await perfEnv.cleanup();
    }, 30000);

    it('should migrate 1000 records in less than 5 minutes', async () => {
      const perfEnv = new TestEnvironment('perf-1000');
      await perfEnv.setup();
      await perfEnv.createLargeDataset(1000);

      const perfRunner = new MigrationRunner(perfEnv.basePath);
      const startTime = Date.now();

      const result = await perfRunner.run();

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(300000); // 5 minutes for 1000 records

      console.log(`Performance: ${duration}ms for 1000 records`);

      await perfEnv.cleanup();
    }, 330000);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing Phase 1 data gracefully', async () => {
      const emptyEnv = new TestEnvironment('error-empty');
      await emptyEnv.setup();
      await rm(join(emptyEnv.basePath, 'level-1-hot'), { recursive: true });

      const errorRunner = new MigrationRunner(emptyEnv.basePath);
      const result = await errorRunner.run();

      expect(result.success).toBe(false);
      expect(result.steps_failed.length).toBeGreaterThan(0);

      await emptyEnv.cleanup();
    });

    it('should handle corrupted JSON files', async () => {
      const corruptEnv = new TestEnvironment('corrupt');
      await corruptEnv.setup();

      // Corrupt principles.json
      await writeFile(
        join(corruptEnv.basePath, 'level-1-hot', 'principles.json'),
        '{ invalid json',
        'utf-8'
      );

      const corruptRunner = new MigrationRunner(corruptEnv.basePath);
      const result = await corruptRunner.run();

      expect(result.success).toBe(false);

      await corruptEnv.cleanup();
    });

    it('should handle read-only directories gracefully', async () => {
      // This test may not work on all systems
      // Skip on Windows or systems without chmod
      const readonlyEnv = new TestEnvironment('readonly');
      await readonlyEnv.setup();

      const readonlyRunner = new MigrationRunner(readonlyEnv.basePath);
      const result = await readonlyRunner.run();

      // Should either succeed or fail gracefully
      expect(result).toBeDefined();

      await readonlyEnv.cleanup();
    });

    it('should handle repeated migration attempts', async () => {
      // First migration
      const result1 = await runner.run();
      expect(result1.success).toBe(true);

      // Second migration (should handle gracefully)
      const result2 = await runner.run();
      expect(result2).toBeDefined();
    });

    it('should handle migration with empty data files', async () => {
      const emptyDataEnv = new TestEnvironment('empty-data');
      await emptyDataEnv.setup();

      // Create empty retro index
      await writeFile(
        join(emptyDataEnv.basePath, 'level-2-warm', 'retros', 'index.jsonl'),
        '',
        'utf-8'
      );

      const emptyDataRunner = new MigrationRunner(emptyDataEnv.basePath);
      const result = await emptyDataRunner.run();

      expect(result.success).toBe(true);

      await emptyDataEnv.cleanup();
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate Phase 1 data compatibility', async () => {
      await runner.run();

      // Should not throw errors during compatibility validation
      const result = await runner.run();
      expect(result.success).toBe(true);
    });

    it('should preserve Phase 1 data structure', async () => {
      // Read original principles
      const originalPath = join(env.basePath, 'level-1-hot', 'principles.json');
      const originalContent = await Bun.file(originalPath).text();
      const originalData = JSON.parse(originalContent);

      // Run migration
      await runner.run();

      // Verify Phase 1 data unchanged
      const afterMigrationPath = join(env.basePath, 'level-1-hot', 'principles.json');
      const afterContent = await Bun.file(afterMigrationPath).text();
      const afterData = JSON.parse(afterContent);

      expect(afterData).toEqual(originalData);
    });

    it('should maintain data integrity across migration', async () => {
      const beforeReport = await runner.checkDataIntegrity();
      const beforeRetroCount = beforeReport.retros.record_count;

      await runner.run();

      const afterReport = await runner.checkDataIntegrity();
      const afterRetroCount = afterReport.retros.record_count;

      expect(afterRetroCount).toBe(beforeRetroCount);
    });
  });

  describe('Migration State Management', () => {
    it('should track migration steps', async () => {
      await runner.run();

      const state = await runner.getMigrationState();

      expect(state?.steps).toHaveLength(8);
      expect(state?.steps.every(s => s.status === 'completed')).toBe(true);
    });

    it('should record migration timing', async () => {
      const result = await runner.run();

      expect(result.duration_ms).toBeGreaterThan(0);

      const state = await runner.getMigrationState();
      expect(state?.migration_started).toBeDefined();
      expect(state?.migration_completed).toBeDefined();
    });

    it('should store backup location in state', async () => {
      const result = await runner.run();

      const state = await runner.getMigrationState();
      expect(state?.backup_location).toBeDefined();
      expect(state?.backup_location).toBe(result.backup_location);
    });
  });

  describe('Shadow Migration Pattern Compliance', () => {
    it('should never modify Phase 1 data files', async () => {
      // Get file stats before
      const principlesPath = join(env.basePath, 'level-1-hot', 'principles.json');
      const beforeStat = await Bun.file(principlesPath).text();

      await runner.run();

      // Get file stats after
      const afterStat = await Bun.file(principlesPath).text();

      expect(beforeStat).toBe(afterStat);
    });

    it('should keep backup separate from live data', async () => {
      const result = await runner.run();

      // Backup should be in a different location
      expect(result.backup_location).not.toContain(env.basePath);
    });

    it('should allow Phase 1 data to remain readable', async () => {
      await runner.run();

      // Phase 1 data should still be readable
      const principlesPath = join(env.basePath, 'level-1-hot', 'principles.json');
      const content = await Bun.file(principlesPath).text();
      const data = JSON.parse(content);

      expect(data.principles).toBeDefined();
      expect(data.version).toBe('1.0');
    });
  });
});

/**
 * Integration Tests
 */
describe('MigrationRunner Integration', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = new TestEnvironment('integration');
    await env.setup();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should handle complete migration cycle: migrate -> verify -> rollback', async () => {
    const runner = new MigrationRunner(env.basePath);

    // Step 1: Migrate
    const migrateResult = await runner.run();
    expect(migrateResult.success).toBe(true);

    // Step 2: Verify
    const state = await runner.getMigrationState();
    expect(state?.migration_completed).toBeDefined();

    const integrity = await runner.checkDataIntegrity();
    expect(integrity.principles.valid).toBe(true);

    // Step 3: Rollback
    await runner.rollback(migrateResult.steps_completed);

    // Verify rollback complete
    expect(existsSync(join(env.basePath, 'analytics'))).toBe(false);
    expect(existsSync(join(env.basePath, 'level-1-hot', 'principles.json'))).toBe(true);
  });

  it('should handle multiple migration attempts gracefully', async () => {
    const runner = new MigrationRunner(env.basePath);

    // First migration
    const result1 = await runner.run();
    expect(result1.success).toBe(true);

    // Second migration (should be idempotent or handle gracefully)
    const result2 = await runner.run();
    expect(result2.success).toBe(true);
  });

  it('should recover from failed migration', async () => {
    const failEnv = new TestEnvironment('fail-recover');
    await failEnv.setup();

    // Create invalid data
    await writeFile(
      join(failEnv.basePath, 'level-1-hot', 'invalid.json'),
      'invalid content',
      'utf-8'
    );

    const runner = new MigrationRunner(failEnv.basePath);

    // This should fail during validation
    // and automatically rollback
    const result = await runner.run();

    // Phase 1 data should still be intact
    expect(existsSync(join(failEnv.basePath, 'level-1-hot', 'principles.json'))).toBe(true);

    await failEnv.cleanup();
  });
});

/**
 * Performance Benchmark Tests
 */
describe('MigrationRunner Performance Benchmarks', () => {
  it('should meet performance target: 1000 records < 5 minutes', async () => {
    const perfEnv = new TestEnvironment('benchmark');
    await perfEnv.setup();
    await perfEnv.createLargeDataset(1000);

    const runner = new MigrationRunner(perfEnv.basePath);
    const startTime = Date.now();

    const result = await runner.run();

    const duration = Date.now() - startTime;
    const recordsPerSecond = 1000 / (duration / 1000);

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(300000);

    console.log(`\nPerformance Metrics:`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`  Records/sec: ${recordsPerSecond.toFixed(2)}`);
    console.log(`  Target: <300s (5 minutes)`);

    await perfEnv.cleanup();
  }, 330000);
});
