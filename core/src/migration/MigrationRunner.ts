/**
 * PRISM-Gateway Phase 1 to Phase 2 Migration Runner
 *
 * Fundamental Principles:
 * 1. Data Integrity First - No data loss, ever
 * 2. Atomic Operations - Each step is all-or-nothing
 * 3. Rollback Ready - Can revert at any point
 * 4. Zero Downtime - Phase 2 can read Phase 1 data
 */

import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';

/**
 * Migration step definition
 */
interface MigrationStep {
  name: string;
  description: string;
  execute: () => Promise<void>;
  verify: () => Promise<boolean>;
  rollback?: () => Promise<void>;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  steps_completed: string[];
  steps_failed: Array<{ step: string; error: string }>;
  duration_ms: number;
  backup_location?: string;
}

/**
 * Migration state (persisted)
 */
interface MigrationState {
  version: string;
  phase1_version: string;
  phase2_version: string;
  migration_started: string;
  migration_completed?: string;
  steps: Array<{
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
    started_at?: string;
    completed_at?: string;
    error?: string;
  }>;
  rollback_available: boolean;
  backup_location: string;
}

/**
 * Validation check result
 */
interface ValidationCheck {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

/**
 * Pre-migration validation result
 */
interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  errors: string[];
}

/**
 * Data integrity check result
 */
interface DataCheckResult {
  valid: boolean;
  record_count?: number;
  error?: string;
  details?: string;
}

/**
 * Integrity report
 */
interface IntegrityReport {
  principles: DataCheckResult;
  success_patterns: DataCheckResult;
  failure_patterns: DataCheckResult;
  retros: DataCheckResult;
  violations: DataCheckResult;
}

/**
 * Default Phase 2 configuration
 */
const DEFAULT_CONFIG = {
  version: '2.0',
  created_at: new Date().toISOString(),
  gateway: {
    check_timeout: 5000,
    parallel_checks: 10,
    cache_ttl: 60000,
  },
  retrospective: {
    auto_trigger: true,
    trigger_conditions: [
      {
        type: 'violation_count',
        threshold: 5,
        window: '1h',
      },
      {
        type: 'time_since_last',
        threshold: 7,
        unit: 'days',
      },
    ],
  },
  analytics: {
    enabled: true,
    aggregation_interval: 'daily',
    retention_days: 90,
  },
  api: {
    enabled: false,
    port: 3000,
    cors_origins: ['http://localhost:3000'],
  },
  mcp: {
    enabled: false,
    transport: 'stdio',
  },
  migration: {
    phase1_version: '1.0',
    phase2_version: '2.0',
    completed: false,
  },
};

/**
 * Migration Runner Class
 *
 * Orchestrates the complete migration process from Phase 1 to Phase 2.
 * Uses shadow migration pattern - Phase 1 data remains unchanged.
 */
export class MigrationRunner {
  private basePath: string;
  private backupPath: string;
  private statePath: string;
  private steps: MigrationStep[] = [];
  private startTime: number = 0;

  constructor(customBasePath?: string) {
    this.basePath = customBasePath || join(homedir(), '.prism-gateway');
    this.backupPath = join(homedir(), `.prism-gateway-backup-${Date.now()}`);
    this.statePath = join(this.basePath, '.migration', 'state.json');

    this.registerSteps();
  }

  /**
   * Register migration steps in execution order
   */
  private registerSteps(): void {
    this.steps = [
      {
        name: 'pre_validation',
        description: 'Validate system before migration',
        execute: () => this.runPreValidation(),
        verify: () => Promise.resolve(true),
      },
      {
        name: 'backup',
        description: 'Create backup of Phase 1 data',
        execute: () => this.createBackup(),
        verify: () => this.verifyBackup(),
      },
      {
        name: 'init_directories',
        description: 'Create Phase 2 directory structure',
        execute: () => this.initializeDirectories(),
        verify: () => this.verifyDirectories(),
        rollback: () => this.removeDirectories(),
      },
      {
        name: 'init_config',
        description: 'Initialize Phase 2 configuration',
        execute: () => this.initializeConfig(),
        verify: () => this.verifyConfig(),
        rollback: () => this.removeConfig(),
      },
      {
        name: 'init_analytics',
        description: 'Initialize analytics storage',
        execute: () => this.initializeAnalytics(),
        verify: () => this.verifyAnalytics(),
        rollback: () => this.removeAnalytics(),
      },
      {
        name: 'validate_compatibility',
        description: 'Validate Phase 1 data compatibility with Phase 2',
        execute: () => this.validateCompatibility(),
        verify: () => Promise.resolve(true),
      },
      {
        name: 'data_integrity_check',
        description: 'Verify data integrity after migration',
        execute: () => Promise.resolve(),
        verify: () => this.verifyDataIntegrity(),
      },
      {
        name: 'write_migration_state',
        description: 'Write migration completion state',
        execute: () => this.writeMigrationState(true),
        verify: () => this.verifyMigrationState(),
        rollback: () => this.clearMigrationState(),
      },
    ];
  }

  /**
   * Run the complete migration process
   * @param dryRun If true, simulate without making changes
   * @returns Migration result
   */
  async run(dryRun: boolean = false): Promise<MigrationResult> {
    this.startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      steps_completed: [],
      steps_failed: [],
      duration_ms: 0,
    };

    this.log('Starting Phase 1 to Phase 2 migration...');
    if (dryRun) {
      this.log('DRY RUN MODE - No changes will be made');
    }

    for (const step of this.steps) {
      this.log(`Step: ${step.name} - ${step.description}...`);

      try {
        if (!dryRun) {
          await step.execute();
        }
        result.steps_completed.push(step.name);

        // Verify step (skip verification in dry-run mode for steps that modify state)
        if (!dryRun || this.isReadOnlyStep(step.name)) {
          const verified = await step.verify();
          if (!verified) {
            throw new Error(`Verification failed for step: ${step.name}`);
          }
        }

        this.log(`Step ${step.name} completed ✓`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.steps_failed.push({ step: step.name, error: errorMsg });
        this.error(`Step ${step.name} failed: ${errorMsg}`);

        // Attempt rollback
        if (!dryRun) {
          this.log('Attempting rollback...');
          await this.rollback(result.steps_completed);
        }

        result.duration_ms = Date.now() - this.startTime;
        return result;
      }
    }

    result.success = true;
    result.duration_ms = Date.now() - this.startTime;
    if (!dryRun) {
      result.backup_location = this.backupPath;
    }

    this.log(`Migration completed successfully in ${result.duration_ms}ms`);
    return result;
  }

  /**
   * Check if a step is read-only (can be verified in dry-run mode)
   */
  private isReadOnlyStep(stepName: string): boolean {
    return stepName === 'pre_validation' || stepName === 'validate_compatibility';
  }

  /**
   * Rollback migration
   * @param completedSteps Steps that were completed before rollback.
   *                       If empty, attempts to rollback all steps that can be rolled back.
   */
  async rollback(completedSteps: string[] = []): Promise<void> {
    this.log('Starting rollback...');

    // Execute rollbacks in reverse order
    const reversedSteps = [...this.steps].reverse();

    // If no completed steps provided, try to rollback all steps with rollback handlers
    const stepsToRollback = completedSteps.length > 0
      ? completedSteps
      : this.steps.filter(s => s.rollback).map(s => s.name);

    for (const step of reversedSteps) {
      if (stepsToRollback.includes(step.name) && step.rollback) {
        this.log(`Rolling back: ${step.name}...`);
        try {
          await step.rollback();
          this.log(`Rollback ${step.name} completed ✓`);
        } catch (error) {
          this.error(`Rollback ${step.name} failed: ${error}`);
        }
      }
    }

    // Always clear migration state on rollback
    await this.clearMigrationState();

    this.log('Rollback completed');
    this.log('Phase 1 data remains intact');
  }

  /**
   * Get current migration state
   */
  async getMigrationState(): Promise<MigrationState | null> {
    if (!existsSync(this.statePath)) {
      return null;
    }

    try {
      const content = await readFile(this.statePath, 'utf-8');
      return JSON.parse(content) as MigrationState;
    } catch {
      return null;
    }
  }

  /**
   * Check if migration has been completed
   */
  async isMigrationComplete(): Promise<boolean> {
    const state = await this.getMigrationState();
    return state?.migration_completed !== undefined;
  }

  // ==================== Step Implementations ====================

  /**
   * Pre-migration validation
   */
  private async runPreValidation(): Promise<void> {
    this.log('Running pre-migration validation...');

    const validation = await this.validateSystem();
    if (!validation.passed) {
      const errors = validation.errors.join('\n  ');
      throw new Error(`Pre-migration validation failed:\n  ${errors}`);
    }

    this.log('Pre-migration validation passed');
  }

  /**
   * Validate system before migration
   */
  async validateSystem(): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    // Check Phase 1 data exists
    checks.push(await this.checkPhase1Data());

    // Check file permissions
    checks.push(await this.checkFilePermissions());

    // Check required files
    checks.push(await this.checkRequiredFiles());

    const failed = checks.filter(c => !c.passed);
    return {
      passed: failed.length === 0,
      checks,
      errors: failed.map(f => f.error || `${f.name} failed`),
    };
  }

  /**
   * Check Phase 1 data exists
   */
  private async checkPhase1Data(): Promise<ValidationCheck> {
    const requiredDirs = [
      join(this.basePath, 'level-1-hot'),
      join(this.basePath, 'level-2-warm'),
      join(this.basePath, 'level-3-cold'),
    ];

    for (const dir of requiredDirs) {
      if (!existsSync(dir)) {
        return {
          name: 'Phase 1 Data',
          passed: false,
          error: `Required directory not found: ${dir}`,
        };
      }
    }

    return { name: 'Phase 1 Data', passed: true };
  }

  /**
   * Check file permissions
   */
  private async checkFilePermissions(): Promise<ValidationCheck> {
    try {
      // Try to create a test file
      const testPath = join(this.basePath, '.migration-test');
      await mkdir(testPath, { recursive: true });
      await rm(testPath, { recursive: true, force: true });
      return { name: 'File Permissions', passed: true };
    } catch (error) {
      return {
        name: 'File Permissions',
        passed: false,
        error: `Cannot write to ${this.basePath}`,
      };
    }
  }

  /**
   * Check required files exist
   */
  private async checkRequiredFiles(): Promise<ValidationCheck> {
    const requiredFiles = [
      join(this.basePath, 'level-1-hot', 'principles.json'),
      join(this.basePath, 'level-1-hot', 'patterns', 'success_patterns.json'),
      join(this.basePath, 'level-1-hot', 'patterns', 'failure_patterns.json'),
    ];

    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        return {
          name: 'Required Files',
          passed: false,
          error: `Required file not found: ${file}`,
        };
      }
    }

    return { name: 'Required Files', passed: true, details: `${requiredFiles.length} files found` };
  }

  /**
   * Create backup of Phase 1 data
   */
  private async createBackup(): Promise<void> {
    this.log('Creating backup...');

    await mkdir(this.backupPath, { recursive: true });

    const dirsToBackup = ['level-1-hot', 'level-2-warm', 'level-3-cold'];

    for (const dir of dirsToBackup) {
      const src = join(this.basePath, dir);
      if (existsSync(src)) {
        const dest = join(this.backupPath, dir);
        await cp(src, dest, { recursive: true });
        this.log(`Backed up ${dir}`);
      }
    }

    this.log(`Backup created at: ${this.backupPath}`);
  }

  /**
   * Verify backup was created successfully
   */
  private async verifyBackup(): Promise<boolean> {
    const dirsToVerify = ['level-1-hot', 'level-2-warm', 'level-3-cold'];

    for (const dir of dirsToVerify) {
      const backupDir = join(this.backupPath, dir);
      if (!existsSync(backupDir)) {
        this.error(`Backup verification failed: ${dir} not found in backup`);
        return false;
      }
    }

    const principlesPath = join(this.backupPath, 'level-1-hot', 'principles.json');
    if (!existsSync(principlesPath)) {
      this.error('Backup verification failed: principles.json not found');
      return false;
    }

    this.log('Backup verification passed');
    return true;
  }

  /**
   * Initialize Phase 2 directory structure
   */
  private async initializeDirectories(): Promise<void> {
    this.log('Creating Phase 2 directory structure...');

    const dirs = [
      'analytics',
      'analytics/aggregated',
      'cache',
      'config',
      'logs',
      '.migration',
    ];

    for (const dir of dirs) {
      const fullPath = join(this.basePath, dir);
      await mkdir(fullPath, { recursive: true });
      this.log(`Created: ${dir}`);
    }

    this.log('Phase 2 directories created');
  }

  /**
   * Verify directories were created
   */
  private async verifyDirectories(): Promise<boolean> {
    const dirs = ['analytics', 'cache', 'config', 'logs', '.migration'];

    for (const dir of dirs) {
      const fullPath = join(this.basePath, dir);
      if (!existsSync(fullPath)) {
        this.error(`Directory verification failed: ${dir} not created`);
        return false;
      }
    }

    this.log('Directory verification passed');
    return true;
  }

  /**
   * Remove Phase 2 directories (rollback)
   */
  private async removeDirectories(): Promise<void> {
    this.log('Removing Phase 2 directories...');

    const dirs = ['analytics', 'cache', 'config', 'logs', '.migration'];

    for (const dir of dirs) {
      const fullPath = join(this.basePath, dir);
      if (existsSync(fullPath)) {
        await rm(fullPath, { recursive: true, force: true });
        this.log(`Removed: ${dir}`);
      }
    }
  }

  /**
   * Initialize Phase 2 configuration
   */
  private async initializeConfig(): Promise<void> {
    this.log('Initializing Phase 2 configuration...');

    // Write default configuration
    await writeFile(
      join(this.basePath, 'config', 'default.json'),
      JSON.stringify(DEFAULT_CONFIG, null, 2),
      'utf-8'
    );

    // Write empty user config (gitignored)
    await writeFile(
      join(this.basePath, 'config', 'user.json.local'),
      JSON.stringify({ version: '2.0', overrides: {} }, null, 2),
      'utf-8'
    );

    // Write .gitignore for user config
    await writeFile(
      join(this.basePath, 'config', '.gitignore'),
      'user.json.local\n',
      'utf-8'
    );

    this.log('Configuration files created');
  }

  /**
   * Verify configuration was created
   */
  private async verifyConfig(): Promise<boolean> {
    const defaultConfigPath = join(this.basePath, 'config', 'default.json');
    const userConfigPath = join(this.basePath, 'config', 'user.json.local');

    if (!existsSync(defaultConfigPath) || !existsSync(userConfigPath)) {
      this.error('Config verification failed: files not created');
      return false;
    }

    try {
      const config = JSON.parse(await readFile(defaultConfigPath, 'utf-8'));
      if (config.version !== '2.0') {
        this.error('Config verification failed: invalid version');
        return false;
      }
    } catch {
      this.error('Config verification failed: invalid JSON');
      return false;
    }

    this.log('Configuration verification passed');
    return true;
  }

  /**
   * Remove configuration (rollback)
   */
  private async removeConfig(): Promise<void> {
    const configPath = join(this.basePath, 'config');
    if (existsSync(configPath)) {
      await rm(configPath, { recursive: true, force: true });
      this.log('Removed: config');
    }
  }

  /**
   * Initialize analytics storage
   */
  private async initializeAnalytics(): Promise<void> {
    this.log('Initializing analytics storage...');

    // Create empty metrics file
    await writeFile(
      join(this.basePath, 'analytics', 'metrics.jsonl'),
      '',
      'utf-8'
    );

    // Create aggregated analytics index
    await writeFile(
      join(this.basePath, 'analytics', 'aggregated', 'index.json'),
      JSON.stringify({
        version: '2.0',
        last_aggregated: null,
        available_periods: [],
      }, null, 2),
      'utf-8'
    );

    // Create empty cache index
    await writeFile(
      join(this.basePath, 'cache', 'index.json'),
      JSON.stringify({
        version: '2.0',
        last_updated: new Date().toISOString(),
        entries: [],
      }, null, 2),
      'utf-8'
    );

    this.log('Analytics storage initialized');
  }

  /**
   * Verify analytics was created
   */
  private async verifyAnalytics(): Promise<boolean> {
    const metricsPath = join(this.basePath, 'analytics', 'metrics.jsonl');
    const indexPath = join(this.basePath, 'analytics', 'aggregated', 'index.json');
    const cachePath = join(this.basePath, 'cache', 'index.json');

    if (!existsSync(metricsPath) || !existsSync(indexPath) || !existsSync(cachePath)) {
      this.error('Analytics verification failed: files not created');
      return false;
    }

    this.log('Analytics verification passed');
    return true;
  }

  /**
   * Remove analytics (rollback)
   */
  private async removeAnalytics(): Promise<void> {
    const analyticsPath = join(this.basePath, 'analytics');
    const cachePath = join(this.basePath, 'cache');

    if (existsSync(analyticsPath)) {
      await rm(analyticsPath, { recursive: true, force: true });
      this.log('Removed: analytics');
    }

    if (existsSync(cachePath)) {
      await rm(cachePath, { recursive: true, force: true });
      this.log('Removed: cache');
    }
  }

  /**
   * Validate Phase 1 data compatibility with Phase 2
   */
  private async validateCompatibility(): Promise<void> {
    this.log('Validating Phase 1 data compatibility...');

    // Validate principles.json
    const principlesPath = join(this.basePath, 'level-1-hot', 'principles.json');
    await this.validateJSONFile(principlesPath, 'Principles');

    // Validate success_patterns.json
    const successPatternsPath = join(this.basePath, 'level-1-hot', 'patterns', 'success_patterns.json');
    await this.validateJSONFile(successPatternsPath, 'Success Patterns');

    // Validate failure_patterns.json
    const failurePatternsPath = join(this.basePath, 'level-1-hot', 'patterns', 'failure_patterns.json');
    await this.validateJSONFile(failurePatternsPath, 'Failure Patterns');

    // Validate retro index if exists
    const retroIndexPath = join(this.basePath, 'level-2-warm', 'retros', 'index.jsonl');
    if (existsSync(retroIndexPath)) {
      await this.validateJSONLFile(retroIndexPath, 'Retro Index');
    }

    this.log('Phase 1 data compatibility validated');
  }

  /**
   * Validate JSON file
   */
  private async validateJSONFile(filePath: string, name: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`${name} file not found: ${filePath}`);
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      JSON.parse(content);
      this.log(`${name} validated ✓`);
    } catch {
      throw new Error(`${name} file is not valid JSON: ${filePath}`);
    }
  }

  /**
   * Validate JSONL file
   */
  private async validateJSONLFile(filePath: string, name: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (line) {
          JSON.parse(line);
        }
      }

      this.log(`${name} validated ✓ (${lines.length} entries)`);
    } catch {
      throw new Error(`${name} file is not valid JSONL: ${filePath}`);
    }
  }

  /**
   * Verify data integrity after migration
   */
  private async verifyDataIntegrity(): Promise<boolean> {
    this.log('Verifying data integrity...');

    const report = await this.checkDataIntegrity();

    const allValid = [
      report.principles.valid,
      report.success_patterns.valid,
      report.failure_patterns.valid,
      report.retros.valid,
      report.violations.valid,
    ].every(v => v);

    if (allValid) {
      this.log('Data integrity verified ✓');
      this.log(`  - Principles: ${report.principles.record_count || 0} records`);
      this.log(`  - Success Patterns: ${report.success_patterns.record_count || 0} records`);
      this.log(`  - Failure Patterns: ${report.failure_patterns.record_count || 0} records`);
      this.log(`  - Retros: ${report.retros.record_count || 0} records`);
      this.log(`  - Violations: ${report.violations.record_count || 0} records`);
    } else {
      this.error('Data integrity verification failed');
    }

    return allValid;
  }

  /**
   * Check data integrity of all data files
   */
  async checkDataIntegrity(): Promise<IntegrityReport> {
    return {
      principles: await this.checkPrinciples(),
      success_patterns: await this.checkSuccessPatterns(),
      failure_patterns: await this.checkFailurePatterns(),
      retros: await this.checkRetros(),
      violations: await this.checkViolations(),
    };
  }

  /**
   * Check principles data
   */
  private async checkPrinciples(): Promise<DataCheckResult> {
    const filePath = join(this.basePath, 'level-1-hot', 'principles.json');

    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!data.version || !Array.isArray(data.principles)) {
        return { valid: false, error: 'Invalid structure' };
      }

      return {
        valid: true,
        record_count: data.principles.length,
        details: `v${data.version}, ${data.principles.length} principles`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check success patterns data
   */
  private async checkSuccessPatterns(): Promise<DataCheckResult> {
    const filePath = join(this.basePath, 'level-1-hot', 'patterns', 'success_patterns.json');

    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!data.version || !Array.isArray(data.patterns)) {
        return { valid: false, error: 'Invalid structure' };
      }

      return {
        valid: true,
        record_count: data.patterns.length,
        details: `v${data.version}, ${data.patterns.length} patterns`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check failure patterns data
   */
  private async checkFailurePatterns(): Promise<DataCheckResult> {
    const filePath = join(this.basePath, 'level-1-hot', 'patterns', 'failure_patterns.json');

    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!data.version || !Array.isArray(data.patterns)) {
        return { valid: false, error: 'Invalid structure' };
      }

      return {
        valid: true,
        record_count: data.patterns.length,
        details: `v${data.version}, ${data.patterns.length} patterns`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check retro records
   */
  private async checkRetros(): Promise<DataCheckResult> {
    const indexPath = join(this.basePath, 'level-2-warm', 'retros', 'index.jsonl');

    if (!existsSync(indexPath)) {
      return { valid: true, record_count: 0, details: 'No retros yet' };
    }

    try {
      const content = await readFile(indexPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);

      return {
        valid: true,
        record_count: lines.length,
        details: `${lines.length} retro records`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check violation records
   */
  private async checkViolations(): Promise<DataCheckResult> {
    const filePath = join(this.basePath, 'level-2-warm', 'violations.jsonl');

    if (!existsSync(filePath)) {
      return { valid: true, record_count: 0, details: 'No violations yet' };
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);

      return {
        valid: true,
        record_count: lines.length,
        details: `${lines.length} violation records`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Write migration state
   */
  private async writeMigrationState(completed: boolean): Promise<void> {
    this.log('Writing migration state...');

    const state: MigrationState = {
      version: '2.0',
      phase1_version: '1.0',
      phase2_version: '2.0',
      migration_started: new Date(this.startTime).toISOString(),
      migration_completed: completed ? new Date().toISOString() : undefined,
      steps: this.steps.map(s => ({
        name: s.name,
        status: 'completed' as const,
      })),
      rollback_available: true,
      backup_location: this.backupPath,
    };

    await writeFile(
      this.statePath,
      JSON.stringify(state, null, 2),
      'utf-8'
    );

    this.log('Migration state written');
  }

  /**
   * Verify migration state was written
   */
  private async verifyMigrationState(): Promise<boolean> {
    if (!existsSync(this.statePath)) {
      this.error('Migration state verification failed: state file not created');
      return false;
    }

    try {
      const state = JSON.parse(await readFile(this.statePath, 'utf-8')) as MigrationState;
      if (state.phase2_version !== '2.0') {
        this.error('Migration state verification failed: invalid version');
        return false;
      }
    } catch {
      this.error('Migration state verification failed: invalid JSON');
      return false;
    }

    this.log('Migration state verified');
    return true;
  }

  /**
   * Clear migration state (rollback)
   */
  private async clearMigrationState(): Promise<void> {
    if (existsSync(this.statePath)) {
      await rm(this.statePath, { force: true });
      this.log('Cleared migration state');
    }
  }

  // ==================== Utility Methods ====================

  private log(message: string): void {
    console.log(`[Migration] ${message}`);
  }

  private error(message: string): void {
    console.error(`[Migration] ${message}`);
  }
}

/**
 * Singleton instance
 */
export const migrationRunner = new MigrationRunner();
