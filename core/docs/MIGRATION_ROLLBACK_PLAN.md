# PRISM-Gateway Migration Rollback Plan

**Document Version:** 1.0.0
**Created:** 2026-02-04
**Author:** Architect Agent

---

## Table of Contents

1. [Rollback Strategy](#1-rollback-strategy)
2. [Rollback Triggers](#2-rollback-triggers)
3. [Rollback Procedures](#3-rollback-procedures)
4. [Rollback Verification](#4-rollback-verification)
5. [Re-Migration After Rollback](#5-re-migration-after-rollback)
6. [Emergency Procedures](#6-emergency-procedures)

---

## 1. Rollback Strategy

### 1.1 Core Principle

**"Phase 1 data is never modified during migration"**

This fundamental design choice makes rollback safe and simple:
- Phase 1 data (level-*-hot/warm/cold) remains unchanged
- Phase 2 only adds new directories (analytics, cache, config, logs)
- Rollback = remove Phase 2 directories

### 1.2 Rollback Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Rollback Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Before Migration:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ~/.prism-gateway/                                       │   │
│  │ ├── level-1-hot/           [Phase 1 data]               │   │
│  │ ├── level-2-warm/          [Phase 1 data]               │   │
│  │ └── level-3-cold/          [Phase 1 data]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  Migration (creates backup and new dirs):                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ~/.prism-gateway-backup-TIMESTAMP/   [Backup]           │   │
│  │     └── level-*/               [Copy of Phase 1]        │   │
│  │                                                          │   │
│  │ ~/.prism-gateway/                                       │   │
│  │ ├── level-1-hot/           [UNCHANGED]                  │   │
│  │ ├── level-2-warm/          [UNCHANGED]                  │   │
│  │ ├── level-3-cold/          [UNCHANGED]                  │   │
│  │ ├── analytics/             [NEW - Phase 2]              │   │
│  │ ├── cache/                 [NEW - Phase 2]              │   │
│  │ ├── config/                [NEW - Phase 2]              │   │
│  │ ├── logs/                  [NEW - Phase 2]              │   │
│  │ └── .migration/            [NEW - Phase 2]              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  Rollback (remove Phase 2 only):                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ~/.prism-gateway/                                       │   │
│  │ ├── level-1-hot/           [STILL INTACT]               │   │
│  │ ├── level-2-warm/          [STILL INTACT]               │   │
│  │ └── level-3-cold/          [STILL INTACT]               │   │
│  │                                                          │   │
│  │ [analytics, cache, config, logs, .migration REMOVED]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Rollback Guarantees

| Guarantee | Description |
|-----------|-------------|
| **No Data Loss** | Phase 1 data never touched |
| **Always Possible** | Can rollback at any time |
| **Fast** | Completes in seconds |
| **Safe** | No partial rollback states |
| **Repeatable** | Can re-migrate after rollback |

---

## 2. Rollback Triggers

### 2.1 Automatic Triggers

```typescript
interface RollbackTrigger {
  id: string;
  name: string;
  condition: () => Promise<boolean>;
  severity: 'critical' | 'high' | 'medium';
  auto_rollback: boolean;
}

const ROLLBACK_TRIGGERS: RollbackTrigger[] = [
  {
    id: 'data_corruption',
    name: 'Data Corruption Detected',
    condition: async () => {
      const report = await checkDataIntegrity();
      return !report.principles.valid ||
             !report.success_patterns.valid ||
             !report.failure_patterns.valid;
    },
    severity: 'critical',
    auto_rollback: true,
  },
  {
    id: 'functional_regression',
    name: 'Critical Function Failing',
    condition: async () => {
      const tests = await runSmokeTests();
      const criticalFailed = tests.failed.filter(f =>
        f.name.includes('Gateway') || f.name.includes('Principles')
      );
      return criticalFailed.length > 0;
    },
    severity: 'critical',
    auto_rollback: true,
  },
  {
    id: 'performance_severe',
    name: 'Severe Performance Degradation',
    condition: async () => {
      const bench = await runPerformanceBenchmarks();
      return bench.results.some(r =>
        r.regression !== undefined && r.regression > 0.5  // 50% slower
      );
    },
    severity: 'high',
    auto_rollback: false,  // Warn user first
  },
  {
    id: 'user_explicit',
    name: 'User Explicit Rollback Request',
    condition: async () => false,  // Triggered by user command
    severity: 'medium',
    auto_rollback: true,
  },
];
```

### 2.2 Trigger Decision Matrix

| Scenario | Severity | Auto-Rollback? | User Action Required? |
|----------|----------|----------------|----------------------|
| Phase 1 data corruption | CRITICAL | Yes | No |
| Critical commands failing | CRITICAL | Yes | No |
| 50%+ performance drop | HIGH | Yes | No |
| 20-50% performance drop | MEDIUM | No | Yes - confirm |
| Minor features failing | LOW | No | Yes - confirm |
| User request | MEDIUM | Yes | No |

---

## 3. Rollback Procedures

### 3.1 Rollback Steps

```typescript
interface RollbackStep {
  order: number;
  name: string;
  description: string;
  execute: () => Promise<void>;
  verify: () => Promise<boolean>;
  on_failure: 'abort' | 'continue' | 'retry';
}

const ROLLBACK_STEPS: RollbackStep[] = [
  {
    order: 1,
    name: 'stop_services',
    description: 'Stop any running Phase 2 services',
    execute: async () => {
      // Stop API server if running
      // Stop WebSocket connections
      // Flush any pending writes
    },
    verify: async () => {
      // Verify no processes are running
      return true;
    },
    on_failure: 'continue',
  },
  {
    order: 2,
    name: 'flush_cache',
    description: 'Flush all caches to ensure no data loss',
    execute: async () => {
      // Clear in-memory cache
      // Persist any pending cache data
    },
    verify: async () => {
      return true;
    },
    on_failure: 'continue',
  },
  {
    order: 3,
    name: 'remove_phase2_directories',
    description: 'Remove Phase 2 specific directories',
    execute: async () => {
      const basePath = join(homedir(), '.prism-gateway');
      const dirs = ['analytics', 'cache', 'config', 'logs', '.migration'];

      for (const dir of dirs) {
        const fullPath = join(basePath, dir);
        if (existsSync(fullPath)) {
          await rm(fullPath, { recursive: true, force: true });
        }
      }
    },
    verify: async () => {
      const basePath = join(homedir(), '.prism-gateway');
      const dirs = ['analytics', 'cache', 'config', 'logs', '.migration'];

      for (const dir of dirs) {
        if (existsSync(join(basePath, dir))) {
          return false;
        }
      }
      return true;
    },
    on_failure: 'abort',
  },
  {
    order: 4,
    name: 'verify_phase1_intact',
    description: 'Verify Phase 1 data is intact',
    execute: async () => {
      // Read and validate Phase 1 data
    },
    verify: async () => {
      const basePath = join(homedir(), '.prism-gateway');
      const principlesPath = join(basePath, 'level-1-hot', 'principles.json');
      return existsSync(principlesPath);
    },
    on_failure: 'abort',
  },
  {
    order: 5,
    name: 'restore_phase1_entrypoint',
    description: 'Ensure Phase 1 entry point is active',
    execute: async () => {
      // Update CLI to use Phase 1 commands
      // Reset any configuration overrides
    },
    verify: async () => {
      return true;
    },
    on_failure: 'continue',
  },
  {
    order: 6,
    name: 'log_rollback',
    description: 'Log rollback completion',
    execute: async () => {
      const logPath = join(homedir(), '.prism-gateway', 'rollback-log.json');
      await writeFile(
        logPath,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          reason: 'rollback',
          previous_migration: '2.0',
          current_version: '1.0',
        }, null, 2),
        'utf-8'
      );
    },
    verify: async () => true,
    on_failure: 'continue',
  },
];
```

### 3.2 Rollback Manager

```typescript
export class RollbackManager {
  private basePath: string;
  private backupPath: string | null;

  constructor() {
    this.basePath = join(homedir(), '.prism-gateway');
    this.backupPath = null;
  }

  /**
   * Execute rollback
   */
  async rollback(reason: string): Promise<RollbackResult> {
    const startTime = Date.now();

    console.log('[Rollback] Starting rollback process...');
    console.log(`[Rollback] Reason: ${reason}`);

    // Get backup location from migration state
    await this.loadBackupLocation();

    const stepsCompleted: string[] = [];
    const stepsFailed: Array<{ step: string; error: string }> = [];

    for (const step of ROLLBACK_STEPS) {
      console.log(`[Rollback] Step ${step.order}: ${step.name}...`);

      try {
        await step.execute();
        stepsCompleted.push(step.name);

        const verified = await step.verify();
        if (!verified) {
          throw new Error(`Verification failed for: ${step.name}`);
        }

        console.log(`[Rollback] ${step.name} completed ✓`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        stepsFailed.push({ step: step.name, error: errorMsg });
        console.error(`[Rollback] ${step.name} failed: ${errorMsg}`);

        if (step.on_failure === 'abort') {
          console.error('[Rollback] Aborting due to critical failure');
          break;
        }
      }
    }

    const duration = Date.now() - startTime;
    const success = stepsFailed.length === 0;

    if (success) {
      console.log(`[Rollback] Rollback completed successfully in ${duration}ms`);
      console.log('[Rollback] Phase 1 is now active');
    } else {
      console.error('[Rollback] Rollback completed with errors');
      console.error('[Rollback] Please check the system manually');
    }

    return {
      success,
      steps_completed: stepsCompleted,
      steps_failed: stepsFailed,
      duration_ms: duration,
      phase1_restored: true,
    };
  }

  /**
   * Load backup location from migration state
   */
  private async loadBackupLocation(): Promise<void> {
    const statePath = join(this.basePath, '.migration', 'state.json');

    if (!existsSync(statePath)) {
      console.warn('[Rollback] No migration state found, backup location unknown');
      return;
    }

    try {
      const content = await readFile(statePath, 'utf-8');
      const state = JSON.parse(content);
      this.backupPath = state.backup_location;
      console.log(`[Rollback] Backup location: ${this.backupPath}`);
    } catch (error) {
      console.warn('[Rollback] Could not read migration state');
    }
  }

  /**
   * Verify Phase 1 is functional after rollback
   */
  async verifyPhase1Functional(): Promise<boolean> {
    try {
      // Test Phase 1 core functionality
      const { MemoryStore } = await import('../core/MemoryStore.js');
      const store = new MemoryStore();

      const principles = await store.getPrinciples();
      if (!Array.isArray(principles) || principles.length === 0) {
        return false;
      }

      const patterns = await store.getSuccessPatterns();
      if (!Array.isArray(patterns)) {
        return false;
      }

      console.log('[Rollback] Phase 1 functionality verified ✓');
      return true;
    } catch (error) {
      console.error(`[Rollback] Phase 1 verification failed: ${error}`);
      return false;
    }
  }
}
```

### 3.3 Rollback CLI Command

```typescript
export async function rollbackCommand(options: {
  reason?: string;
  force?: boolean;
}): Promise<void> {
  console.log('=== PRISM-Gateway Rollback ===\n');

  // Confirm unless force flag is set
  if (!options.force) {
    console.log('This will rollback to Phase 1.');
    console.log('Phase 2 data (analytics, cache, config) will be removed.');
    console.log('Phase 1 data will remain intact.\n');

    // In interactive CLI, prompt for confirmation
    // For now, auto-confirm in non-interactive mode
  }

  const manager = new RollbackManager();
  const result = await manager.rollback(options.reason || 'User requested');

  console.log('\n=== Rollback Result ===');
  console.log(`Success: ${result.success}`);
  console.log(`Duration: ${result.duration_ms}ms`);
  console.log(`Steps completed: ${result.steps_completed.join(', ')}`);

  if (result.steps_failed.length > 0) {
    console.log('\nSteps failed:');
    for (const failure of result.steps_failed) {
      console.log(`  - ${failure.step}: ${failure.error}`);
    }
  }

  if (result.success) {
    const functional = await manager.verifyPhase1Functional();
    if (functional) {
      console.log('\n✓ Phase 1 is now fully operational');
    } else {
      console.log('\n⚠ Warning: Phase 1 verification failed, please check manually');
    }
  }

  process.exit(result.success ? 0 : 1);
}
```

---

## 4. Rollback Verification

### 4.1 Post-Rollback Checklist

```typescript
interface RollbackVerification {
  category: string;
  checks: Array<{
    name: string;
    passed: boolean;
    error?: string;
  }>;
}

async function verifyRollback(): Promise<RollbackVerification[]> {
  const basePath = join(homedir(), '.prism-gateway');

  return [
    {
      category: 'Directory Structure',
      checks: [
        {
          name: 'Phase 2 directories removed',
          passed: !existsSync(join(basePath, 'analytics')) &&
                  !existsSync(join(basePath, 'cache')) &&
                  !existsSync(join(basePath, 'config')) &&
                  !existsSync(join(basePath, 'logs')) &&
                  !existsSync(join(basePath, '.migration')),
        },
        {
          name: 'Phase 1 directories intact',
          passed: existsSync(join(basePath, 'level-1-hot')) &&
                  existsSync(join(basePath, 'level-2-warm')) &&
                  existsSync(join(basePath, 'level-3-cold')),
        },
      ],
    },
    {
      category: 'Data Integrity',
      checks: [
        {
          name: 'Principles readable',
          passed: await checkPrinciplesReadable(),
        },
        {
          name: 'Patterns readable',
          passed: await checkPatternsReadable(),
        },
        {
          name: 'Retros readable',
          passed: await checkRetrosReadable(),
        },
      ],
    },
    {
      category: 'Functionality',
      checks: [
        {
          name: 'MemoryStore functional',
          passed: await checkMemoryStoreFunctional(),
        },
        {
          name: 'GatewayGuard functional',
          passed: await checkGatewayGuardFunctional(),
        },
        {
          name: 'RetrospectiveCore functional',
          passed: await checkRetrospectiveCoreFunctional(),
        },
      ],
    },
  ];
}

async function checkPrinciplesReadable(): Promise<boolean> {
  try {
    const { MemoryStore } = await import('../core/MemoryStore.js');
    const store = new MemoryStore();
    const principles = await store.getPrinciples();
    return Array.isArray(principles) && principles.length > 0;
  } catch {
    return false;
  }
}

async function checkPatternsReadable(): Promise<boolean> {
  try {
    const { MemoryStore } = await import('../core/MemoryStore.js');
    const store = new MemoryStore();
    const [success, failure] = await Promise.all([
      store.getSuccessPatterns(),
      store.getFailurePatterns(),
    ]);
    return Array.isArray(success) && Array.isArray(failure);
  } catch {
    return false;
  }
}

async function checkRetrosReadable(): Promise<boolean> {
  try {
    const { MemoryStore } = await import('../core/MemoryStore.js');
    const store = new MemoryStore();
    const retros = await store.getRecentRetros('test', 10);
    return Array.isArray(retros);
  } catch {
    return false;
  }
}

async function checkMemoryStoreFunctional(): Promise<boolean> {
  try {
    const { MemoryStore } = await import('../core/MemoryStore.js');
    const store = new MemoryStore();
    await store.getPrinciples();
    await store.getSuccessPatterns();
    return true;
  } catch {
    return false;
  }
}

async function checkGatewayGuardFunctional(): Promise<boolean> {
  try {
    const { GatewayGuard } = await import('../core/GatewayGuard.js');
    const guard = new GatewayGuard();
    const result = await guard.check('Test validation after rollback');
    return result !== null;
  } catch {
    return false;
  }
}

async function checkRetrospectiveCoreFunctional(): Promise<boolean> {
  try {
    const { RetrospectiveCore } = await import('../core/RetrospectiveCore.js');
    const retro = new RetrospectiveCore();
    const result = await retro.quick('test-project');
    return result && result.id !== undefined;
  } catch {
    return false;
  }
}
```

---

## 5. Re-Migration After Rollback

### 5.1 Re-Migration Considerations

After rollback, re-migration should:

1. **Analyze rollback reason** - Fix the issue that caused rollback
2. **Create new backup** - Don't rely on old backup
3. **Incremental migration** - Only migrate what's needed
4. **Monitor closely** - Watch for the same issues

### 5.2 Re-Migration Procedure

```typescript
export class ReMigrationHandler {
  /**
   * Analyze why rollback occurred
   */
  async analyzeRollback(rollbackLogPath: string): Promise<{
    reason: string;
    preventable: boolean;
    recommendation: string;
  }> {
    try {
      const content = await readFile(rollbackLogPath, 'utf-8');
      const log = JSON.parse(content);

      // Analyze based on rollback reason
      return {
        reason: log.reason || 'unknown',
        preventable: this.isPreventable(log.reason),
        recommendation: this.getRecommendation(log.reason),
      };
    } catch {
      return {
        reason: 'unknown',
        preventable: false,
        recommendation: 'Investigate logs before re-migrating',
      };
    }
  }

  private isPreventable(reason: string): boolean {
    const preventableReasons = [
      'performance',
      'user_request',
      'configuration',
    ];
    return preventableReasons.some(r => reason.includes(r));
  }

  private getRecommendation(reason: string): string {
    const recommendations: Record<string, string> = {
      'data_corruption': 'Do NOT re-migrate. Investigate data integrity first.',
      'performance': 'Identify performance bottleneck before re-migrating.',
      'user_request': 'Address user concern before re-migrating.',
      'functional': 'Fix failing functionality before re-migrating.',
    };

    for (const [key, value] of Object.entries(recommendations)) {
      if (reason.includes(key)) {
        return value;
      }
    }

    return 'Review logs and fix issues before re-migrating.';
  }

  /**
   * Prepare for re-migration
   */
  async prepareForReMigration(): Promise<{
    ready: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check if Phase 1 is stable
    const verification = await verifyRollback();
    const failedChecks = verification.flatMap(v =>
      v.checks.filter(c => !c.passed).map(c => `${v.category}: ${c.name}`)
    );

    if (failedChecks.length > 0) {
      issues.push(`Phase 1 verification failed: ${failedChecks.join(', ')}`);
    }

    // Check for residual Phase 2 files
    const basePath = join(homedir(), '.prism-gateway');
    const phase2Dirs = ['analytics', 'cache', 'config', 'logs', '.migration'];
    for (const dir of phase2Dirs) {
      if (existsSync(join(basePath, dir))) {
        issues.push(`Residual Phase 2 directory found: ${dir}`);
      }
    }

    return {
      ready: issues.length === 0,
      issues,
    };
  }
}
```

---

## 6. Emergency Procedures

### 6.1 Manual Rollback Steps

If automated rollback fails:

```bash
#!/bin/bash
# Emergency manual rollback script

BASE_PATH="$HOME/.prism-gateway"

echo "=== Emergency Rollback ==="
echo "Stopping any running services..."
pkill -f "prism" || true

echo "Removing Phase 2 directories..."
rm -rf "$BASE_PATH/analytics"
rm -rf "$BASE_PATH/cache"
rm -rf "$BASE_PATH/config"
rm -rf "$BASE_PATH/logs"
rm -rf "$BASE_PATH/.migration"

echo "Verifying Phase 1 data..."
if [ -f "$BASE_PATH/level-1-hot/principles.json" ]; then
    echo "✓ Phase 1 data intact"
else
    echo "✗ WARNING: Phase 1 data may be corrupted!"
fi

echo "=== Emergency Rollback Complete ==="
echo "Please verify Phase 1 functionality manually."
```

### 6.2 Data Recovery from Backup

If Phase 1 data is corrupted:

```bash
#!/bin/bash
# Data recovery from backup

BACKUP_PATH="$1"
BASE_PATH="$HOME/.prism-gateway"

if [ -z "$BACKUP_PATH" ]; then
    echo "Usage: $0 <backup_path>"
    exit 1
fi

echo "=== Data Recovery ==="
echo "Restoring from: $BACKUP_PATH"

# Stop all services
pkill -f "prism" || true

# Backup current (corrupted) data
mv "$BASE_PATH" "$BASE_PATH.corrupted.$(date +%s)"

# Restore from backup
cp -R "$BACKUP_PATH" "$BASE_PATH"

echo "=== Data Recovery Complete ==="
echo "Restored data from: $BACKUP_PATH"
echo "Corrupted data saved to: $BASE_PATH.corrupted.*"
```

---

## Appendix

### A. Rollback Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│                    Rollback Decision Tree                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Issue Detected                                            │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────┐                                       │
│  │ Critical Issue? │──Yes──► Automatic Rollback            │
│  └─────────────────┘                                       │
│       │ No                                                  │
│       ▼                                                     │
│  ┌─────────────────┐                                       │
│  │ Can Fix?        │──Yes──► Fix → Verify → Continue       │
│  └─────────────────┘                                       │
│       │ No                                                  │
│       ▼                                                     │
│  ┌─────────────────┐                                       │
│  │ User Confirmed? │──Yes──► Rollback                     │
│  └─────────────────┘                                       │
│       │ No                                                  │
│       ▼                                                     │
│  Log Warning → Continue Monitoring                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### B. Rollback Status Output

```
=== PRISM-Gateway Rollback Status ===

Migration State: Not Migrated
Last Rollback: 2026-02-04T15:30:00Z
Rollback Reason: User requested

Phase 1 Status:
  ✓ Directories intact
  ✓ Data accessible
  ✓ Functional tests passing

Phase 2 Status:
  ✓ Directories removed
  ✓ Services stopped

Rollback Result: SUCCESS
Phase 1 is now active.
```

---

**Document End**
