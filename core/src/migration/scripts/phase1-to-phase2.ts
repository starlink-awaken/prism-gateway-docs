/**
 * PRISM-Gateway Phase 1 to Phase 2 Migration Script
 *
 * This script orchestrates the complete migration from Phase 1 to Phase 2.
 * It uses the Shadow Migration Pattern - Phase 1 data is never modified.
 *
 * Usage:
 *   bun run src/migration/scripts/phase1-to-phase2.ts [options]
 *
 * Options:
 *   --dry-run    Simulate migration without making changes
 *   --rollback   Rollback a completed migration
 *   --status     Show migration status
 *   --help       Show this help message
 *
 * @fileoverview Phase 1 to Phase 2 data migration orchestrator
 * @author PRISM-Gateway Team
 * @version 2.0.0
 */

import { MigrationRunner } from '../MigrationRunner.js';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Migration configuration options
 */
interface MigrationOptions {
  dryRun: boolean;
  rollback: boolean;
  status: boolean;
  help: boolean;
  basePath?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): MigrationOptions {
  const options: MigrationOptions = {
    dryRun: false,
    rollback: false,
    status: false,
    help: false,
  };

  for (const arg of args) {
    switch (arg) {
      case '--dry-run':
      case '-n':
        options.dryRun = true;
        break;
      case '--rollback':
      case '-r':
        options.rollback = true;
        break;
      case '--status':
      case '-s':
        options.status = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--path':
      case '-p':
        // Next arg is the path
        const idx = args.indexOf(arg);
        if (idx + 1 < args.length) {
          options.basePath = args[idx + 1];
        }
        break;
    }
  }

  return options;
}

/**
 * Display help message
 */
function displayHelp(): void {
  console.log(`
PRISM-Gateway Phase 1 to Phase 2 Migration Script

USAGE:
  bun run src/migration/scripts/phase1-to-phase2.ts [options]

OPTIONS:
  --dry-run, -n       Simulate migration without making changes
  --rollback, -r      Rollback a completed migration
  --status, -s        Show migration status
  --path, -p <path>   Use custom base path (default: ~/.prism-gateway)
  --help, -h          Show this help message

EXAMPLES:
  # Simulate migration (no changes)
  bun run src/migration/scripts/phase1-to-phase2.ts --dry-run

  # Run actual migration
  bun run src/migration/scripts/phase1-to-phase2.ts

  # Check migration status
  bun run src/migration/scripts/phase1-to-phase2.ts --status

  # Rollback migration
  bun run src/migration/scripts/phase1-to-phase2.ts --rollback

MIGRATION PROCESS:
  1. Pre-migration validation
  2. Create backup of Phase 1 data
  3. Initialize Phase 2 directories
  4. Initialize Phase 2 configuration
  5. Initialize analytics storage
  6. Validate Phase 1 data compatibility
  7. Verify data integrity
  8. Write migration state

SHADOW MIGRATION PATTERN:
  - Phase 1 data is NEVER modified
  - Backup is created before any changes
  - Rollback is always possible
  - Phase 2 can read Phase 1 data directly

For more information, see: docs/DATA_MIGRATION_PLAN.md
`);
}

/**
 * Display migration status
 */
async function displayStatus(basePath?: string): Promise<void> {
  const runner = new MigrationRunner(basePath);
  const state = await runner.getMigrationState();

  if (!state) {
    console.log('\n=== Migration Status ===');
    console.log('Status: Not started');
    console.log('Phase 1 data: Present');
    console.log('Phase 2 data: Not initialized');
    return;
  }

  console.log('\n=== Migration Status ===');
  console.log(`Status: ${state.migration_completed ? 'Completed' : 'In Progress'}`);
  console.log(`Phase 1 Version: ${state.phase1_version}`);
  console.log(`Phase 2 Version: ${state.phase2_version}`);
  console.log(`Started: ${new Date(state.migration_started).toLocaleString()}`);
  if (state.migration_completed) {
    console.log(`Completed: ${new Date(state.migration_completed).toLocaleString()}`);
  }
  console.log(`Rollback Available: ${state.rollback_available ? 'Yes' : 'No'}`);
  if (state.backup_location) {
    console.log(`Backup: ${state.backup_location}`);
  }

  // Display step status
  console.log('\n--- Steps ---');
  for (const step of state.steps) {
    const status = step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○';
    console.log(`  ${status} ${step.name}`);
    if (step.error) {
      console.log(`    Error: ${step.error}`);
    }
  }

  // Run integrity check
  console.log('\n--- Data Integrity ---');
  const integrity = await runner.checkDataIntegrity();
  console.log(`  Principles: ${integrity.principles.valid ? '✓' : '✗'} (${integrity.principles.record_count} records)`);
  console.log(`  Success Patterns: ${integrity.success_patterns.valid ? '✓' : '✗'} (${integrity.success_patterns.record_count} records)`);
  console.log(`  Failure Patterns: ${integrity.failure_patterns.valid ? '✓' : '✗'} (${integrity.failure_patterns.record_count} records)`);
  console.log(`  Retros: ${integrity.retros.valid ? '✓' : '✗'} (${integrity.retros.record_count} records)`);
  console.log(`  Violations: ${integrity.violations.valid ? '✓' : '✗'} (${integrity.violations.record_count} records)`);
}

/**
 * Perform rollback
 */
async function performRollback(basePath?: string): Promise<void> {
  console.log('\n=== Rollback Migration ===');
  console.log('This will remove all Phase 2 data and restore Phase 1 state.');
  console.log('Phase 1 data will remain intact.\n');

  const runner = new MigrationRunner(basePath);

  // Get current state first
  const state = await runner.getMigrationState();
  if (!state) {
    console.log('No migration found. Nothing to rollback.');
    return;
  }

  // Get completed steps
  const completedSteps = state.steps
    .filter(s => s.status === 'completed')
    .map(s => s.name);

  console.log(`Rolling back ${completedSteps.length} steps...\n`);

  // Perform rollback
  await runner.rollback(completedSteps);

  console.log('\n✓ Rollback completed successfully');
  console.log('Phase 1 data is intact and ready to use.');
}

/**
 * Run migration
 */
async function runMigration(dryRun: boolean, basePath?: string): Promise<void> {
  console.log('\n=== PRISM-Gateway Phase 1 to Phase 2 Migration ===\n');

  const runner = new MigrationRunner(basePath);

  // Pre-migration validation
  console.log('Running pre-migration checks...');
  const validation = await runner.validateSystem();

  if (!validation.passed) {
    console.error('\n✗ Pre-migration validation failed:\n');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    console.error('\nPlease fix the issues above before running migration.');
    process.exit(1);
  }

  console.log('✓ Pre-migration validation passed\n');

  // Check if migration already completed
  const isComplete = await runner.isMigrationComplete();
  if (isComplete && !dryRun) {
    console.log('⚠ Migration has already been completed.');
    console.log('Use --status to see migration details.');
    console.log('Use --rollback to undo the migration.\n');
    return;
  }

  // Run migration
  const result = await runner.run(dryRun);

  // Display results
  console.log('\n=== Migration Result ===\n');
  console.log(`Status: ${result.success ? '✓ Success' : '✗ Failed'}`);
  console.log(`Duration: ${(result.duration_ms / 1000).toFixed(2)}s`);
  console.log(`Steps completed: ${result.steps_completed.length}`);
  console.log(`Steps failed: ${result.steps_failed.length}`);

  if (result.steps_completed.length > 0) {
    console.log('\nCompleted steps:');
    for (const step of result.steps_completed) {
      console.log(`  ✓ ${step}`);
    }
  }

  if (result.steps_failed.length > 0) {
    console.log('\nFailed steps:');
    for (const failure of result.steps_failed) {
      console.log(`  ✗ ${failure.step}: ${failure.error}`);
    }
  }

  if (result.backup_location) {
    console.log(`\nBackup location: ${result.backup_location}`);
  }

  console.log('');

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    displayHelp();
    process.exit(0);
  }

  try {
    if (options.status) {
      await displayStatus(options.basePath);
    } else if (options.rollback) {
      await performRollback(options.basePath);
    } else {
      await runMigration(options.dryRun, options.basePath);
    }
  } catch (error) {
    console.error('\n✗ Migration failed with error:');
    console.error(`  ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, parseArgs, displayHelp, displayStatus, performRollback, runMigration };
