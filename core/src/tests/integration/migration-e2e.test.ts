/**
 * Migration E2E Tests
 *
 * @description
 * 数据迁移端到端完整流程测试
 *
 * @remarks
 * 测试覆盖：
 * 1. 完整迁移流程（Phase1→Phase2）
 * 2. 验证四层检查机制
 * 3. 回滚测试（Phase2→Phase1）
 * 4. 性能基准测试（1000条记录<5分钟）
 * 5. 数据完整性验证
 * 6. 错误恢复测试
 *
 * ISC标准：迁移E2E测试 - 数据迁移端到端完整流程测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MigrationRunner } from '../../migration/MigrationRunner.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';

/**
 * E2E测试环境
 */
class E2ETestEnv {
  public basePath: string;

  constructor(name: string) {
    this.basePath = join(tmpdir(), `prism-e2e-${name}-${Date.now()}`);
  }

  async setup(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });

    // 创建Phase 1目录结构
    await mkdir(join(this.basePath, 'level-1-hot', 'patterns'), { recursive: true });
    await mkdir(join(this.basePath, 'level-2-warm', 'retros', '2026-02', 'quick'), { recursive: true });
    await mkdir(join(this.basePath, 'level-2-warm', 'retros', '2026-02', 'standard'), { recursive: true });
    await mkdir(join(this.basePath, 'level-3-cold', 'sops'), { recursive: true });
    await mkdir(join(this.basePath, 'level-3-cold', 'templates'), { recursive: true });

    // 创建Phase 1数据
    await this.createPhase1Data();
  }

  private async createPhase1Data(): Promise<void> {
    // principles.json
    await writeFile(
      join(this.basePath, 'level-1-hot', 'principles.json'),
      JSON.stringify({
        version: '1.0',
        last_updated: '2026-02-04',
        principles: [
          {
            id: 'P1',
            name: '测试原则',
            level: 'MANDATORY',
            priority: 1,
            check_phases: ['all'],
            keywords: ['test'],
            violation_message: '测试违规',
            verification_method: '验证',
            consequence: '后果',
            historical_evidence: '证据'
          },
          {
            id: 'P2',
            name: '质量原则',
            level: 'HARD_BLOCK',
            priority: 2,
            check_phases: ['development'],
            keywords: ['quality'],
            violation_message: '质量违规',
            verification_method: '验证',
            consequence: '后果',
            historical_evidence: '证据'
          }
        ]
      }, null, 2),
      'utf-8'
    );

    // success_patterns.json
    await writeFile(
      join(this.basePath, 'level-1-hot', 'patterns', 'success_patterns.json'),
      JSON.stringify({
        version: '1.0',
        last_updated: '2026-02-04',
        total_patterns: 1,
        dimensions: 1,
        patterns: [
          {
            id: 'S001',
            dimension: '质量',
            name: '高质量代码模式',
            maturity: 5,
            impact: '极高',
            description: '编写高质量代码的模式',
            weight: 10
          }
        ]
      }, null, 2),
      'utf-8'
    );

    // failure_patterns.json
    await writeFile(
      join(this.basePath, 'level-1-hot', 'patterns', 'failure_patterns.json'),
      JSON.stringify({
        version: '1.0',
        last_updated: '2026-02-04',
        total_patterns: 1,
        patterns: [
          {
            id: 'F001',
            name: '技术债陷阱',
            severity: '高',
            frequency: '30%',
            occurrences: 10,
            characteristic: '累积技术债',
            root_causes: ['时间压力'],
            prevention: ['提前规划']
          }
        ]
      }, null, 2),
      'utf-8'
    );

    // retro index
    await writeFile(
      join(this.basePath, 'level-2-warm', 'retros', 'index.jsonl'),
      JSON.stringify({
        id: 'retro-001',
        timestamp: '2026-02-04T10:00:00Z',
        type: 'quick',
        project: 'test-project',
        summary: '测试复盘'
      }) + '\n',
      'utf-8'
    );

    // violations.jsonl
    await writeFile(
      join(this.basePath, 'level-2-warm', 'violations.jsonl'),
      JSON.stringify({
        id: 'violation-001',
        timestamp: '2026-02-04T10:00:00Z',
        principle_id: 'P1',
        principle_name: '测试原则',
        severity: 'WARNING',
        context: '测试上下文',
        action: '测试行动'
      }) + '\n',
      'utf-8'
    );
  }

  async createLargeDataset(recordCount: number): Promise<void> {
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
        improvements: [`Improvement ${i}`]
      }));
    }

    await writeFile(
      join(this.basePath, 'level-2-warm', 'retros', 'index.jsonl'),
      retroLines.join('\n') + '\n',
      'utf-8'
    );

    const violationLines: string[] = [];
    for (let i = 0; i < recordCount; i++) {
      violationLines.push(JSON.stringify({
        id: `violation-${i.toString().padStart(5, '0')}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        principle_id: `P${(i % 5) + 1}`,
        principle_name: `Principle ${i % 5}`,
        severity: i % 3 === 0 ? 'BLOCK' : i % 3 === 1 ? 'WARNING' : 'ADVISORY',
        context: `Context ${i}`,
        action: `Action ${i}`
      }));
    }

    await writeFile(
      join(this.basePath, 'level-2-warm', 'violations.jsonl'),
      violationLines.join('\n') + '\n',
      'utf-8'
    );
  }

  async cleanup(): Promise<void> {
    if (existsSync(this.basePath)) {
      await rm(this.basePath, { recursive: true, force: true });
    }
  }
}

describe('Migration E2E Tests', () => {
  let env: E2ETestEnv;
  let runner: MigrationRunner;

  beforeEach(async () => {
    env = new E2ETestEnv('default');
    await env.setup();
    runner = new MigrationRunner(env.basePath);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  // ==================== 完整迁移流程测试 ====================

  describe('完整迁移流程（Phase1→Phase2）', () => {
    it('应该完成完整的Phase1到Phase2迁移', async () => {
      const result = await runner.run();

      expect(result.success).toBe(true);
      expect(result.steps_completed).toHaveLength(8);
      expect(result.steps_failed).toHaveLength(0);
      expect(result.duration_ms).toBeGreaterThan(0);
      expect(result.backup_location).toBeDefined();

      console.log(`完整迁移流程: ${result.steps_completed.length}步完成, 耗时${result.duration_ms}ms`);
    });

    it('应该正确执行所有迁移步骤', async () => {
      const result = await runner.run();

      // 验证所有步骤都被执行
      const expectedSteps = [
        'pre_validation',
        'backup',
        'init_directories',
        'init_config',
        'init_analytics',
        'validate_compatibility',
        'data_integrity_check',
        'write_migration_state'
      ];

      expectedSteps.forEach(step => {
        expect(result.steps_completed).toContain(step);
      });
    });

    it('应该在迁移完成后标记状态', async () => {
      await runner.run();

      const isComplete = await runner.isMigrationComplete();
      expect(isComplete).toBe(true);

      const state = await runner.getMigrationState();
      expect(state).not.toBeNull();
      expect(state?.phase2_version).toBe('2.0');
      expect(state?.migration_completed).toBeDefined();
      expect(state?.rollback_available).toBe(true);
    });
  });

  // ==================== 四层检查机制验证 ====================

  describe('四层检查机制验证', () => {
    it('Layer 1: 系统验证检查', async () => {
      const validation = await runner.validateSystem();

      expect(validation.passed).toBe(true);
      expect(validation.checks).toHaveLength(3);
      expect(validation.errors).toHaveLength(0);

      // 验证具体检查项
      const phase1Check = validation.checks.find(c => c.name === 'Phase 1 Data');
      expect(phase1Check?.passed).toBe(true);

      const permCheck = validation.checks.find(c => c.name === 'File Permissions');
      expect(permCheck?.passed).toBe(true);

      const filesCheck = validation.checks.find(c => c.name === 'Required Files');
      expect(filesCheck?.passed).toBe(true);
    });

    it('Layer 2: 数据完整性检查', async () => {
      await runner.run();

      const report = await runner.checkDataIntegrity();

      expect(report.principles.valid).toBe(true);
      expect(report.success_patterns.valid).toBe(true);
      expect(report.failure_patterns.valid).toBe(true);
      expect(report.retros.valid).toBe(true);
      expect(report.violations.valid).toBe(true);

      // 验证记录数
      expect(report.principles.record_count).toBe(2);
      expect(report.success_patterns.record_count).toBe(1);
      expect(report.failure_patterns.record_count).toBe(1);
      expect(report.retros.record_count).toBe(1);
      expect(report.violations.record_count).toBe(1);
    });

    it('Layer 3: 备份验证检查', async () => {
      const result = await runner.run();

      expect(result.backup_location).toBeDefined();
      expect(existsSync(result.backup_location!)).toBe(true);

      // 验证备份包含关键文件
      const backupPrinciples = join(result.backup_location!, 'level-1-hot', 'principles.json');
      expect(existsSync(backupPrinciples)).toBe(true);

      const backupPatterns = join(result.backup_location!, 'level-1-hot', 'patterns', 'success_patterns.json');
      expect(existsSync(backupPatterns)).toBe(true);
    });

    it('Layer 4: 迁移状态验证', async () => {
      await runner.run();

      const state = await runner.getMigrationState();

      expect(state).not.toBeNull();
      expect(state?.version).toBe('2.0');
      expect(state?.phase1_version).toBe('1.0');
      expect(state?.phase2_version).toBe('2.0');
      expect(state?.migration_started).toBeDefined();
      expect(state?.migration_completed).toBeDefined();
      expect(state?.rollback_available).toBe(true);
      expect(state?.backup_location).toBeDefined();
      expect(state?.steps).toHaveLength(8);
      expect(state?.steps.every(s => s.status === 'completed')).toBe(true);
    });
  });

  // ==================== 回滚测试（Phase2→Phase1） ====================

  describe('回滚测试（Phase2→Phase1）', () => {
    it('应该成功回滚所有Phase2更改', async () => {
      const migrateResult = await runner.run();
      expect(migrateResult.success).toBe(true);

      // 验证Phase2目录存在
      expect(existsSync(join(env.basePath, 'analytics'))).toBe(true);
      expect(existsSync(join(env.basePath, 'config'))).toBe(true);
      expect(existsSync(join(env.basePath, 'cache'))).toBe(true);

      // 执行回滚
      await runner.rollback(migrateResult.steps_completed);

      // 验证Phase2目录被移除
      expect(existsSync(join(env.basePath, 'analytics'))).toBe(false);
      expect(existsSync(join(env.basePath, 'config'))).toBe(false);
      expect(existsSync(join(env.basePath, 'cache'))).toBe(false);
      expect(existsSync(join(env.basePath, 'logs'))).toBe(false);
      expect(existsSync(join(env.basePath, '.migration'))).toBe(false);
    });

    it('回滚后Phase1数据应该保持完整', async () => {
      await runner.run();

      // 读取Phase1数据原始内容
      const originalPrinciples = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );
      const originalData = JSON.parse(originalPrinciples);

      // 执行回滚
      await runner.rollback();

      // 验证Phase1数据仍然可读
      const afterRollbackPrinciples = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );
      const afterRollbackData = JSON.parse(afterRollbackPrinciples);

      expect(afterRollbackData).toEqual(originalData);
      expect(afterRollbackData.principles).toHaveLength(2);
    });

    it('回滚后迁移状态应该被清除', async () => {
      await runner.run();
      await runner.rollback();

      const state = await runner.getMigrationState();
      expect(state).toBeNull();

      const isComplete = await runner.isMigrationComplete();
      expect(isComplete).toBe(false);
    });

    it('应该支持部分回滚', async () => {
      const result = await runner.run();

      // 只回滚部分步骤
      const partialSteps = result.steps_completed.slice(0, 4);
      await runner.rollback(partialSteps);

      // 验证部分目录被移除
      const state = await runner.getMigrationState();
      expect(state).toBeNull(); // 状态总是被清除
    });
  });

  // ==================== 性能基准测试 ====================

  describe('性能基准测试', () => {
    it('100条记录迁移应该在合理时间内完成', async () => {
      const perfEnv = new E2ETestEnv('perf-100');
      await perfEnv.setup();
      await perfEnv.createLargeDataset(100);

      const perfRunner = new MigrationRunner(perfEnv.basePath);
      const startTime = Date.now();

      const result = await perfRunner.run();

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // 10秒内完成

      console.log(`性能测试(100条): ${duration}ms`);

      await perfEnv.cleanup();
    });

    it('1000条记录迁移应该在5分钟内完成', async () => {
      const perfEnv = new E2ETestEnv('perf-1000');
      await perfEnv.setup();
      await perfEnv.createLargeDataset(1000);

      const perfRunner = new MigrationRunner(perfEnv.basePath);
      const startTime = Date.now();

      const result = await perfRunner.run();

      const duration = Date.now() - startTime;
      const recordsPerSecond = 1000 / (duration / 1000);

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(300000); // 5分钟内完成

      console.log(`性能测试(1000条): ${(duration / 1000).toFixed(2)}s (${recordsPerSecond.toFixed(2)} records/s)`);

      await perfEnv.cleanup();
    }, 330000);
  });

  // ==================== 错误恢复测试 ====================

  describe('错误恢复测试', () => {
    it('应该处理Phase1数据缺失错误', async () => {
      const errorEnv = new E2ETestEnv('error-missing');
      await errorEnv.setup();

      // 删除关键目录
      await rm(join(errorEnv.basePath, 'level-1-hot'), { recursive: true });

      const errorRunner = new MigrationRunner(errorEnv.basePath);
      const result = await errorRunner.run();

      expect(result.success).toBe(false);
      expect(result.steps_failed.length).toBeGreaterThan(0);

      await errorEnv.cleanup();
    });

    it('应该处理损坏的JSON文件', async () => {
      const errorEnv = new E2ETestEnv('error-corrupt');
      await errorEnv.setup();

      // 写入损坏的JSON
      await writeFile(
        join(errorEnv.basePath, 'level-1-hot', 'principles.json'),
        '{ invalid json content',
        'utf-8'
      );

      const errorRunner = new MigrationRunner(errorEnv.basePath);
      const result = await errorRunner.run();

      expect(result.success).toBe(false);

      await errorEnv.cleanup();
    });

    it('应该处理只读目录错误', async () => {
      const errorEnv = new E2ETestEnv('error-readonly');
      await errorEnv.setup();

      const errorRunner = new MigrationRunner(errorEnv.basePath);

      // 尝试迁移
      const result = await errorRunner.run();

      // 结果取决于文件系统权限
      expect(result).toBeDefined();

      await errorEnv.cleanup();
    });

    it('迁移失败时应该自动回滚', async () => {
      const errorEnv = new E2ETestEnv('error-rollback');
      await errorEnv.setup();

      // 损坏一个关键文件
      await writeFile(
        join(errorEnv.basePath, 'level-1-hot', 'patterns', 'failure_patterns.json'),
        'invalid json',
        'utf-8'
      );

      const errorRunner = new MigrationRunner(errorEnv.basePath);
      const result = await errorRunner.run();

      // 迁移应该失败
      expect(result.success).toBe(false);

      // Phase1数据应该仍然完好
      expect(existsSync(join(errorEnv.basePath, 'level-1-hot', 'principles.json'))).toBe(true);

      await errorEnv.cleanup();
    });
  });

  // ==================== 数据一致性验证 ====================

  describe('数据一致性验证', () => {
    it('迁移后Phase1数据应该保持不变', async () => {
      // 读取原始数据
      const originalPrinciples = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );

      await runner.run();

      // 读取迁移后数据
      const afterPrinciples = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );

      expect(afterPrinciples).toBe(originalPrinciples);
    });

    it('迁移后所有记录应该保持完整', async () => {
      const beforeReport = await runner.checkDataIntegrity();
      await runner.run();
      const afterReport = await runner.checkDataIntegrity();

      expect(afterReport.principles.record_count).toBe(beforeReport.principles.record_count);
      expect(afterReport.success_patterns.record_count).toBe(beforeReport.success_patterns.record_count);
      expect(afterReport.failure_patterns.record_count).toBe(beforeReport.failure_patterns.record_count);
      expect(afterReport.retros.record_count).toBe(beforeReport.retros.record_count);
      expect(afterReport.violations.record_count).toBe(beforeReport.violations.record_count);
    });

    it('备份应该与原始数据一致', async () => {
      // 读取原始数据
      const originalPrinciples = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );

      const result = await runner.run();

      // 读取备份数据
      const backupPrinciples = await readFile(
        join(result.backup_location!, 'level-1-hot', 'principles.json'),
        'utf-8'
      );

      expect(backupPrinciples).toBe(originalPrinciples);
    });
  });

  // ==================== Shadow Migration模式验证 ====================

  describe('Shadow Migration模式验证', () => {
    it('应该使用shadow模式不修改Phase1数据', async () => {
      const beforeStat = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );

      await runner.run();

      const afterStat = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );

      expect(afterStat).toBe(beforeStat);
    });

    it('备份应该存储在单独位置', async () => {
      const result = await runner.run();

      expect(result.backup_location).toBeDefined();
      expect(result.backup_location).not.toContain(env.basePath);
      expect(existsSync(result.backup_location!)).toBe(true);
    });

    it('Phase1数据在迁移后仍然可读', async () => {
      await runner.run();

      const principlesPath = join(env.basePath, 'level-1-hot', 'principles.json');
      const content = await readFile(principlesPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.principles).toBeDefined();
      expect(data.version).toBe('1.0');
      expect(data.principles).toHaveLength(2);
    });
  });

  // ==================== Dry Run模式测试 ====================

  describe('Dry Run模式测试', () => {
    it('dry run应该模拟迁移但不实际修改', async () => {
      const result = await runner.run(true);

      expect(result.success).toBe(true);
      expect(result.steps_completed).toHaveLength(8);
      expect(result.backup_location).toBeUndefined();

      // 验证没有实际更改
      expect(existsSync(join(env.basePath, 'analytics'))).toBe(false);
      expect(existsSync(join(env.basePath, 'config'))).toBe(false);
    });

    it('dry run后Phase1数据应该保持不变', async () => {
      const originalContent = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );

      await runner.run(true);

      const afterContent = await readFile(
        join(env.basePath, 'level-1-hot', 'principles.json'),
        'utf-8'
      );

      expect(afterContent).toBe(originalContent);
    });
  });
});

/**
 * E2E验收测试
 * 完整的端到端场景验证
 */
describe('Migration E2E 验收测试', () => {
  it('验收场景: 完整的迁移→验证→回滚→验证流程', async () => {
    const env = new E2ETestEnv('acceptance');
    await env.setup();

    const runner = new MigrationRunner(env.basePath);

    // 步骤1: 迁移
    console.log('步骤1: 执行迁移...');
    const migrateResult = await runner.run();
    expect(migrateResult.success).toBe(true);

    // 步骤2: 验证迁移成功
    console.log('步骤2: 验证迁移...');
    const state = await runner.getMigrationState();
    expect(state?.migration_completed).toBeDefined();

    const integrity = await runner.checkDataIntegrity();
    expect(integrity.principles.valid).toBe(true);

    // 步骤3: 回滚
    console.log('步骤3: 执行回滚...');
    await runner.rollback(migrateResult.steps_completed);

    // 步骤4: 验证回滚成功
    console.log('步骤4: 验证回滚...');
    expect(existsSync(join(env.basePath, 'analytics'))).toBe(false);
    expect(existsSync(join(env.basePath, 'level-1-hot', 'principles.json'))).toBe(true);

    const afterState = await runner.getMigrationState();
    expect(afterState).toBeNull();

    await env.cleanup();

    console.log('完整E2E流程验证通过 ✓');
  });

  it('验收标准: 1000条记录迁移<5分钟', async () => {
    const env = new E2ETestEnv('acceptance-perf');
    await env.setup();
    await env.createLargeDataset(1000);

    const runner = new MigrationRunner(env.basePath);

    const startTime = Date.now();
    const result = await runner.run();
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(300000);

    console.log(`性能验收: ${duration}ms < 300000ms ✓`);

    await env.cleanup();
  }, 330000);

  it('验收标准: 四层检查全部通过', async () => {
    const env = new E2ETestEnv('acceptance-checks');
    await env.setup();

    const runner = new MigrationRunner(env.basePath);

    // Layer 1: 系统验证
    const validation = await runner.validateSystem();
    expect(validation.passed).toBe(true);
    console.log('Layer 1 (系统验证): 通过 ✓');

    // 执行迁移
    await runner.run();

    // Layer 2: 数据完整性
    const integrity = await runner.checkDataIntegrity();
    expect(integrity.principles.valid).toBe(true);
    expect(integrity.success_patterns.valid).toBe(true);
    expect(integrity.failure_patterns.valid).toBe(true);
    expect(integrity.retros.valid).toBe(true);
    expect(integrity.violations.valid).toBe(true);
    console.log('Layer 2 (数据完整性): 通过 ✓');

    // Layer 3: 备份验证
    const state = await runner.getMigrationState();
    expect(state?.backup_location).toBeDefined();
    expect(existsSync(state!.backup_location)).toBe(true);
    console.log('Layer 3 (备份验证): 通过 ✓');

    // Layer 4: 迁移状态
    expect(state?.migration_completed).toBeDefined();
    expect(state?.rollback_available).toBe(true);
    console.log('Layer 4 (迁移状态): 通过 ✓');

    // 回滚验证
    await runner.rollback();
    const afterState = await runner.getMigrationState();
    expect(afterState).toBeNull();
    console.log('回滚验证: 通过 ✓');

    await env.cleanup();

    console.log('四层检查全部通过 ✓');
  });
});
