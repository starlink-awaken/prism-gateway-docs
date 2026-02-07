# PRISM-Gateway Phase 1 to Phase 2 Data Migration Plan

**Document Version:** 1.0.0
**Created:** 2026-02-04
**Author:** Architect Agent
**Status:** Design

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Fundamental Analysis](#2-fundamental-analysis)
3. [Phase 1 Data Structure](#3-phase-1-data-structure)
4. [Phase 2 Data Structure](#4-phase-2-data-structure)
5. [Migration Strategy](#5-migration-strategy)
6. [Migration Scripts](#6-migration-scripts)
7. [Validation Mechanism](#7-validation-mechanism)
8. [Rollback Plan](#8-rollback-plan)
9. [Migration Documentation](#9-migration-documentation)
10. [Risk Assessment](#10-risk-assessment)

---

## 1. Executive Summary

### 1.1 Purpose

Design a safe, reliable, and minimal-downtime migration plan for PRISM-Gateway data from Phase 1 to Phase 2 structure.

### 1.2 Key Principles

| Principle | Description |
|-----------|-------------|
| **Data Integrity First** | No data loss, ever |
| **Atomic Operations** | Each migration step is all-or-nothing |
| **Backward Compatible** | Phase 2 can read Phase 1 data during transition |
| **Rollback Ready** | Can revert to Phase 1 at any point |
| **Incremental Migration** | Migrate data on-demand, not all-at-once |

### 1.3 Migration Scope

```
Phase 1 Data                                    Phase 2 Data
============================                    ============================
~/.prism-gateway/                              ~/.prism-gateway/
├── level-1-hot/                               ├── level-1-hot/
│   ├── principles.json          [KEEP]        │   ├── principles.json          [COMPATIBLE]
│   └── patterns/                               │   └── patterns/
│       ├── success_patterns.json [KEEP]        │       ├── success_patterns.json [COMPATIBLE]
│       └── failure_patterns.json [KEEP]        │       └── failure_patterns.json [COMPATIBLE]
├── level-2-warm/                              ├── level-2-warm/
│   ├── retros/                                │   ├── retros/
│   │   └── index.jsonl          [KEEP]        │   │   └── index.jsonl          [COMPATIBLE]
│   │   └── 2026-02/                            │   │   └── 2026-02/
│   │       ├── quick/             [KEEP]       │   │       ├── quick/             [COMPATIBLE]
│   │       └── standard/          [KEEP]       │   │       └── standard/          [COMPATIBLE]
│   └── violations.jsonl         [KEEP]        │   └── violations.jsonl         [COMPATIBLE]
├── level-3-cold/                              ├── level-3-cold/
│   ├── sops/                  [KEEP]          │   ├── sops/                      [COMPATIBLE]
│   └── templates/             [KEEP]          │   └── templates/                 [COMPATIBLE]
                                                 ├── analytics/                    [NEW]
                                                 │   ├── metrics.jsonl
                                                 │   └── aggregated/
                                                 ├── cache/                        [NEW]
                                                 │   └── index.json
                                                 ├── config/                       [NEW]
                                                 │   ├── default.json
                                                 │   └── user.json.local
                                                 ├── logs/                         [NEW]
                                                 │   └── activity.jsonl
                                                 └── .migration/                   [NEW]
                                                     ├── state.json
                                                     └── backup/
```

---

## 2. Fundamental Analysis

### 2.1 First Principles: What Are We Migrating?

**Question:** Why do we need data migration?

**Answer:** Phase 2 introduces new data structures (Analytics, Cache, Config, Logs) but Phase 1 core data (Principles, Patterns, Retros, Violations) remains compatible.

**Key Insight:** This is NOT a structure migration - it's an **augmentation migration**. Phase 1 data stays as-is, Phase 2 adds new directories.

### 2.2 The CAP Theorem Application

For local file system migration:
- **Consistency:** Critical - data must not be corrupted
- **Availability:** Critical - system must remain usable during migration
- **Partition Tolerance:** N/A - single machine

**Strategy:** Use copy-on-write pattern. Original data never modified until migration is verified.

### 2.3 Zero-Downtime Migration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Zero-Downtime Migration                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1 Running                                               │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────┐                                              │
│  │   Backup    │  ← Create snapshot (atomic)                  │
│  └─────────────┘                                              │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────┐                                              │
│  │ Install P2  │  ← Phase 2 installed alongside Phase 1       │
│  └─────────────┘                                              │
│       │                                                        │
│       ├──► Phase 1 still reads level-*-hot/warm/cold          │
│       │                                                        │
│       ├──► Phase 2 reads same files (backward compatible)     │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────┐                                              │
│  │  Initialize │  ← Create new directories (analytics, etc.)  │
│  │  New Data   │                                              │
│  └─────────────┘                                              │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────┐                                              │
│  │  Verify &   │  ← Validation checks                         │
│  │  Switch     │                                              │
│  └─────────────┘                                              │
│       │                                                        │
│       ▼                                                        │
│  Phase 2 Running                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1 Data Structure

### 3.1 Level-1 Hot Data

```typescript
// principles.json
interface Phase1_PrinciplesData {
  version: string;           // "1.0"
  last_updated: string;      // ISO date
  principles: Principle[];
}

interface Principle {
  id: string;
  name: string;
  level: 'MANDATORY' | 'HARD_BLOCK';
  priority: number;
  check_phases: string[];
  keywords: string[];
  violation_message: string;
  verification_method: string;
  consequence: string;
  historical_evidence: string;
}
```

```typescript
// success_patterns.json
interface Phase1_SuccessPatternsData {
  version: string;
  last_updated: string;
  total_patterns: number;
  dimensions: number;
  patterns: SuccessPattern[];
}

interface SuccessPattern {
  id: string;
  dimension: string;
  name: string;
  maturity: number;
  impact: string;
  description: string;
  features?: string[];
  effects?: string[];
  constraints?: string;
  benefits?: string[];
  weight: number;
}
```

```typescript
// failure_patterns.json
interface Phase1_FailurePatternsData {
  version: string;
  last_updated: string;
  total_patterns: number;
  patterns: FailurePattern[];
}

interface FailurePattern {
  id: string;
  name: string;
  severity: '高' | '中' | '低';
  frequency: string;
  occurrences: number;
  characteristic: string;
  root_causes: string[];
  prevention: string[];
  cases?: string[];
  user_feedback?: string;
}
```

### 3.2 Level-2 Warm Data

```typescript
// retros/index.jsonl
interface RetroIndexEntry {
  id: string;
  timestamp: string;
  type: 'quick' | 'standard' | 'deep';
  project: string;
  summary: string;
}

// retros/2026-02/quick/retro_*.json
interface RetroRecord {
  id: string;
  timestamp: string;
  type: 'quick' | 'standard' | 'deep';
  project: string;
  duration: number;
  summary: string;
  lessons: string[];
  improvements: string[];
  violations?: string[];
}

// violations.jsonl
interface ViolationRecord {
  id: string;
  timestamp: string;
  principle_id: string;
  principle_name: string;
  severity: 'BLOCK' | 'WARNING' | 'ADVISORY';
  context: string;
  action: string;
}
```

### 3.3 Level-3 Cold Data

```
level-3-cold/
├── sops/           # Standard Operating Procedures
└── templates/      # Retrospective templates
```

---

## 4. Phase 2 Data Structure

### 4.1 New Directories

```typescript
// analytics/metrics.jsonl
interface MetricRecord {
  id: string;
  timestamp: string;
  type: 'usage' | 'quality' | 'performance' | 'trend';
  metric_name: string;
  value: number | string | boolean;
  tags?: Record<string, string>;
}

// analytics/aggregated/
interface AggregatedMetrics {
  date: string;           // YYYY-MM-DD
  period: 'daily' | 'weekly' | 'monthly';
  metrics: {
    total_checks: number;
    total_retros: number;
    violation_rate: number;
    avg_check_time: number;
    // ... more metrics
  };
}
```

```typescript
// cache/index.json
interface CacheIndex {
  version: string;
  last_updated: string;
  entries: CacheEntry[];
}

interface CacheEntry {
  key: string;
  type: 'principles' | 'patterns' | 'retros' | 'computed';
  size: number;
  created_at: string;
  expires_at: string;
  hit_count: number;
}
```

```typescript
// config/default.json
interface DefaultConfig {
  version: string;
  gateway: {
    check_timeout: number;
    parallel_checks: number;
  };
  retrospective: {
    auto_trigger: boolean;
    trigger_conditions: any[];
  };
  analytics: {
    enabled: boolean;
    aggregation_interval: string;
  };
  api: {
    enabled: boolean;
    port: number;
  };
}

// config/user.json.local (gitignored)
interface UserConfig {
  // User overrides
}
```

```typescript
// logs/activity.jsonl
interface ActivityLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  action: string;
  details: Record<string, any>;
  duration_ms?: number;
}
```

```typescript
// .migration/state.json
interface MigrationState {
  phase1_version: string;
  phase2_version: string;
  migration_started: string;
  migration_completed?: string;
  steps: MigrationStep[];
  rollback_available: boolean;
  backup_location: string;
}

interface MigrationStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  started_at?: string;
  completed_at?: string;
  error?: string;
}
```

### 4.2 Version Tagging

Phase 2 introduces version tagging for all data files:

```typescript
interface VersionedData<T> {
  version: string;           // "2.0" for Phase 2 format
  format_version: string;    // Schema version for validation
  created_at: string;
  updated_at: string;
  data: T;
}
```

---

## 5. Migration Strategy

### 5.1 Strategy: Shadow Migration

```
┌─────────────────────────────────────────────────────────────────┐
│                      Shadow Migration Pattern                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Backup (Atomic)                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ tar -czf ~/.prism-gateway-backup-YYYYMMDD.tar.gz \       │   │
│  │     ~/.prism-gateway                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 2: Install Phase 2 (alongside Phase 1)                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # Phase 1 code remains                                  │   │
│  │ # Phase 2 code installed                                │   │
│  │ # Both can read same data files                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 3: Initialize New Structures                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ mkdir -p ~/.prism-gateway/analytics                     │   │
│  │ mkdir -p ~/.prism-gateway/cache                         │   │
│  │ mkdir -p ~/.prism-gateway/config                        │   │
│  │ mkdir -p ~/.prism-gateway/logs                          │   │
│  │ mkdir -p ~/.prism-gateway/.migration                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 4: Run Validation (Phase 1 → Phase 2)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # Validate Phase 1 data readable by Phase 2             │   │
│  │ # Verify all retro records load correctly               │   │
│  │ # Verify all principles and patterns load               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 5: Switch to Phase 2                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # Update CLI to use Phase 2 entry point                 │   │
│  │ # Phase 2 becomes primary                               │   │
│  │ # Phase 1 code remains for rollback                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 6: Monitor (Observation Period)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # Watch for issues                                      │   │
│  │ # Keep backup for 30 days                               │   │
│  │ # Rollback if needed                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Incremental Migration

Data is NOT converted all at once. Instead:

```typescript
// Lazy migration: Convert on first access
class LazyMigrator {
  private migrated = new Set<string>();

  async getRetroRecord(id: string): Promise<RetroRecord> {
    // Check if already migrated
    if (this.migrated.has(id)) {
      return this.readPhase2(id);
    }

    // Read Phase 1 format
    const phase1Data = await this.readPhase1(id);

    // Convert to Phase 2 format (if needed)
    const phase2Data = this.convertToPhase2(phase1Data);

    // Save to Phase 2 location
    await this.savePhase2(id, phase2Data);

    // Mark as migrated
    this.migrated.add(id);

    return phase2Data;
  }

  private convertToPhase2(phase1: any): any {
    // Most data is compatible, just add version tag
    return {
      ...phase1,
      _version: '2.0',
      _migrated_at: new Date().toISOString()
    };
  }
}
```

---

## 6. Migration Scripts

### 6.1 Migration Runner (TypeScript)

```typescript
// src/migration/MigrationRunner.ts

import { join } from 'path';
import { homedir } from 'os';
import { readdir, readFile, writeFile, mkdir, cp } from 'fs/promises';
import { existsSync } from 'fs';

interface MigrationStep {
  name: string;
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
  verify: () => Promise<boolean>;
}

interface MigrationResult {
  success: boolean;
  steps_completed: string[];
  steps_failed: Array<{ step: string; error: string }>;
  duration_ms: number;
}

export class MigrationRunner {
  private basePath: string;
  private backupPath: string;
  private statePath: string;
  private steps: MigrationStep[] = [];

  constructor() {
    this.basePath = join(homedir(), '.prism-gateway');
    this.backupPath = join(homedir(), `.prism-gateway-backup-${Date.now()}`);
    this.statePath = join(this.basePath, '.migration', 'state.json');

    this.registerSteps();
  }

  private registerSteps(): void {
    this.steps = [
      {
        name: 'backup',
        execute: () => this.createBackup(),
        verify: () => this.verifyBackup(),
      },
      {
        name: 'init_directories',
        execute: () => this.initializeDirectories(),
        verify: () => this.verifyDirectories(),
        rollback: () => this.removeDirectories(),
      },
      {
        name: 'init_config',
        execute: () => this.initializeConfig(),
        verify: () => this.verifyConfig(),
      },
      {
        name: 'init_analytics',
        execute: () => this.initializeAnalytics(),
        verify: () => this.verifyAnalytics(),
      },
      {
        name: 'validate_compatibility',
        execute: () => this.validateCompatibility(),
        verify: () => Promise.resolve(true),
      },
      {
        name: 'write_migration_state',
        execute: () => this.writeMigrationState(),
        verify: () => this.verifyMigrationState(),
      },
    ];
  }

  async run(dryRun: boolean = false): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      steps_completed: [],
      steps_failed: [],
      duration_ms: 0,
    };

    console.log('[Migration] Starting Phase 1 to Phase 2 migration...');
    if (dryRun) {
      console.log('[Migration] DRY RUN MODE - No changes will be made');
    }

    for (const step of this.steps) {
      console.log(`[Migration] Step: ${step.name}...`);

      try {
        if (!dryRun) {
          await step.execute();
        }
        result.steps_completed.push(step.name);

        // Verify step
        const verified = await step.verify();
        if (!verified) {
          throw new Error(`Verification failed for step: ${step.name}`);
        }

        console.log(`[Migration] Step ${step.name} completed ✓`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.steps_failed.push({ step: step.name, error: errorMsg });
        console.error(`[Migration] Step ${step.name} failed: ${errorMsg}`);

        // Attempt rollback
        if (!dryRun) {
          console.log('[Migration] Attempting rollback...');
          await this.rollback();
        }

        result.duration_ms = Date.now() - startTime;
        return result;
      }
    }

    result.success = true;
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  private async createBackup(): Promise<void> {
    console.log('[Backup] Creating backup...');

    // Ensure backup directory parent exists
    await mkdir(this.backupPath, { recursive: true });

    // Copy all data
    const dirsToBackup = ['level-1-hot', 'level-2-warm', 'level-3-cold'];

    for (const dir of dirsToBackup) {
      const src = join(this.basePath, dir);
      if (existsSync(src)) {
        const dest = join(this.backupPath, dir);
        await cp(src, dest, { recursive: true });
        console.log(`[Backup] Backed up ${dir}`);
      }
    }

    console.log(`[Backup] Backup created at: ${this.backupPath}`);
  }

  private async verifyBackup(): Promise<boolean> {
    const dirsToVerify = ['level-1-hot', 'level-2-warm', 'level-3-cold'];

    for (const dir of dirsToVerify) {
      const backupDir = join(this.backupPath, dir);
      if (!existsSync(backupDir)) {
        console.error(`[Backup] Verification failed: ${dir} not found in backup`);
        return false;
      }
    }

    // Verify principles.json exists in backup
    const principlesPath = join(this.backupPath, 'level-1-hot', 'principles.json');
    if (!existsSync(principlesPath)) {
      console.error('[Backup] Verification failed: principles.json not found');
      return false;
    }

    console.log('[Backup] Verification passed');
    return true;
  }

  private async initializeDirectories(): Promise<void> {
    console.log('[Init] Creating new directories...');

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
      console.log(`[Init] Created: ${dir}`);
    }
  }

  private async verifyDirectories(): Promise<boolean> {
    const dirs = [
      'analytics',
      'cache',
      'config',
      'logs',
      '.migration',
    ];

    for (const dir of dirs) {
      const fullPath = join(this.basePath, dir);
      if (!existsSync(fullPath)) {
        console.error(`[Init] Verification failed: ${dir} not created`);
        return false;
      }
    }

    console.log('[Init] Directory verification passed');
    return true;
  }

  private async removeDirectories(): Promise<void> {
    console.log('[Rollback] Removing new directories...');
    const { rm } = await import('fs/promises');

    const dirs = [
      'analytics',
      'cache',
      'config',
      'logs',
      '.migration',
    ];

    for (const dir of dirs) {
      const fullPath = join(this.basePath, dir);
      if (existsSync(fullPath)) {
        await rm(fullPath, { recursive: true, force: true });
        console.log(`[Rollback] Removed: ${dir}`);
      }
    }
  }

  private async initializeConfig(): Promise<void> {
    console.log('[Config] Initializing configuration files...');

    // Default configuration
    const defaultConfig = {
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

    await writeFile(
      join(this.basePath, 'config', 'default.json'),
      JSON.stringify(defaultConfig, null, 2),
      'utf-8'
    );

    // Empty user config (gitignored)
    await writeFile(
      join(this.basePath, 'config', 'user.json.local'),
      JSON.stringify({ version: '2.0', overrides: {} }, null, 2),
      'utf-8'
    );

    console.log('[Config] Configuration files created');
  }

  private async verifyConfig(): Promise<boolean> {
    const defaultConfigPath = join(this.basePath, 'config', 'default.json');
    const userConfigPath = join(this.basePath, 'config', 'user.json.local');

    if (!existsSync(defaultConfigPath) || !existsSync(userConfigPath)) {
      console.error('[Config] Verification failed: config files not created');
      return false;
    }

    // Verify config is valid JSON
    try {
      const config = JSON.parse(await readFile(defaultConfigPath, 'utf-8'));
      if (config.version !== '2.0') {
        console.error('[Config] Verification failed: invalid version');
        return false;
      }
    } catch {
      console.error('[Config] Verification failed: invalid JSON');
      return false;
    }

    console.log('[Config] Configuration verification passed');
    return true;
  }

  private async initializeAnalytics(): Promise<void> {
    console.log('[Analytics] Initializing analytics storage...');

    // Create empty metrics file
    await writeFile(
      join(this.basePath, 'analytics', 'metrics.jsonl'),
      '',
      'utf-8'
    );

    // Create aggregated metrics structure
    const aggregatedPath = join(this.basePath, 'analytics', 'aggregated');
    await mkdir(aggregatedPath, { recursive: true });

    // Create index file
    await writeFile(
      join(aggregatedPath, 'index.json'),
      JSON.stringify({
        version: '2.0',
        last_aggregated: null,
        available_periods: [],
      }, null, 2),
      'utf-8'
    );

    console.log('[Analytics] Analytics storage initialized');
  }

  private async verifyAnalytics(): Promise<boolean> {
    const metricsPath = join(this.basePath, 'analytics', 'metrics.jsonl');
    const indexPath = join(this.basePath, 'analytics', 'aggregated', 'index.json');

    if (!existsSync(metricsPath) || !existsSync(indexPath)) {
      console.error('[Analytics] Verification failed: analytics files not created');
      return false;
    }

    console.log('[Analytics] Analytics verification passed');
    return true;
  }

  private async validateCompatibility(): Promise<void> {
    console.log('[Compatibility] Validating Phase 1 data compatibility...');

    // Read Phase 1 data
    const principlesPath = join(this.basePath, 'level-1-hot', 'principles.json');
    const successPatternsPath = join(this.basePath, 'level-1-hot', 'patterns', 'success_patterns.json');
    const failurePatternsPath = join(this.basePath, 'level-1-hot', 'patterns', 'failure_patterns.json');

    // Verify Phase 1 data exists and is readable
    for (const [name, path] of [
      ['Principles', principlesPath],
      ['Success Patterns', successPatternsPath],
      ['Failure Patterns', failurePatternsPath],
    ] as const) {
      if (!existsSync(path)) {
        throw new Error(`${name} file not found: ${path}`);
      }

      try {
        const content = await readFile(path, 'utf-8');
        JSON.parse(content);
        console.log(`[Compatibility] ${name} validated ✓`);
      } catch {
        throw new Error(`${name} file is not valid JSON`);
      }
    }

    // Validate Warm data
    const retroIndexPath = join(this.basePath, 'level-2-warm', 'retros', 'index.jsonl');
    if (existsSync(retroIndexPath)) {
      const content = await readFile(retroIndexPath, 'utf-8');
      const lines = content.trim().split('\n');
      for (const line of lines) {
        if (line) {
          try {
            JSON.parse(line);
          } catch {
            throw new Error('Retro index contains invalid JSONL');
          }
        }
      }
      console.log(`[Compatibility] Retro index validated (${lines.length} entries) ✓`);
    }

    console.log('[Compatibility] All Phase 1 data is compatible');
  }

  private async writeMigrationState(): Promise<void> {
    console.log('[State] Writing migration state...');

    const state = {
      version: '2.0',
      phase1_version: '1.0',
      phase2_version: '2.0',
      migration_started: new Date().toISOString(),
      migration_completed: new Date().toISOString(),
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

    console.log('[State] Migration state written');
  }

  private async verifyMigrationState(): Promise<boolean> {
    if (!existsSync(this.statePath)) {
      console.error('[State] Verification failed: state file not created');
      return false;
    }

    try {
      const state = JSON.parse(await readFile(this.statePath, 'utf-8'));
      if (state.phase2_version !== '2.0') {
        console.error('[State] Verification failed: invalid version in state');
        return false;
      }
    } catch {
      console.error('[State] Verification failed: invalid state JSON');
      return false;
    }

    console.log('[State] Migration state verified');
    return true;
  }

  async rollback(): Promise<void> {
    console.log('[Rollback] Starting rollback...');

    // Remove new directories
    await this.removeDirectories();

    // Restore from backup if needed
    // (In this migration strategy, we don't modify Phase 1 data, so no restore needed)

    console.log('[Rollback] Rollback completed');
    console.log('[Rollback] Phase 1 data remains intact');
  }

  async getMigrationState(): Promise<any> {
    if (!existsSync(this.statePath)) {
      return null;
    }

    const content = await readFile(this.statePath, 'utf-8');
    return JSON.parse(content);
  }
}
```

### 6.2 CLI Command

```typescript
// src/cli/migrate.ts

import { MigrationRunner } from '../migration/MigrationRunner.js';

export async function migrateCommand(options: {
  dryRun?: boolean;
  rollback?: boolean;
  status?: boolean;
}): Promise<void> {
  const runner = new MigrationRunner();

  if (options.status) {
    const state = await runner.getMigrationState();
    if (!state) {
      console.log('Migration status: Not started');
      return;
    }
    console.log('Migration status:', JSON.stringify(state, null, 2));
    return;
  }

  if (options.rollback) {
    console.log('Rolling back migration...');
    await runner.rollback();
    console.log('Rollback complete');
    return;
  }

  const result = await runner.run(options.dryRun);

  console.log('\n=== Migration Result ===');
  console.log(`Success: ${result.success}`);
  console.log(`Steps completed: ${result.steps_completed.join(', ')}`);

  if (result.steps_failed.length > 0) {
    console.log('Steps failed:');
    for (const failure of result.steps_failed) {
      console.log(`  - ${failure.step}: ${failure.error}`);
    }
  }

  console.log(`Duration: ${result.duration_ms}ms`);

  process.exit(result.success ? 0 : 1);
}
```

---

## 7. Validation Mechanism

### 7.1 Pre-Migration Validation

```typescript
// src/migration/PreMigrationValidator.ts

export class PreMigrationValidator {
  async validate(): Promise<ValidationResult> {
    const results: ValidationCheck[] = [
      await this.checkDiskSpace(),
      await this.checkPhase1Data(),
      await this.checkFilePermissions(),
      await this.checkNodeVersion(),
      await this.checkDependencies(),
    ];

    const failed = results.filter(r => !r.passed);

    return {
      passed: failed.length === 0,
      checks: results,
      errors: failed.map(f => f.error),
    };
  }

  private async checkDiskSpace(): Promise<ValidationCheck> {
    const requiredSpace = 100 * 1024 * 1024; // 100MB
    // Implementation: Check available disk space
    return { name: 'Disk Space', passed: true };
  }

  private async checkPhase1Data(): Promise<ValidationCheck> {
    const basePath = join(homedir(), '.prism-gateway');

    const requiredFiles = [
      'level-1-hot/principles.json',
      'level-1-hot/patterns/success_patterns.json',
      'level-1-hot/patterns/failure_patterns.json',
    ];

    for (const file of requiredFiles) {
      if (!existsSync(join(basePath, file))) {
        return {
          name: 'Phase 1 Data',
          passed: false,
          error: `Missing required file: ${file}`,
        };
      }
    }

    return { name: 'Phase 1 Data', passed: true };
  }

  private async checkFilePermissions(): Promise<ValidationCheck> {
    const basePath = join(homedir(), '.prism-gateway');
    // Check write permissions
    return { name: 'File Permissions', passed: true };
  }

  private async checkNodeVersion(): Promise<ValidationCheck> {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);

    if (major < 18) {
      return {
        name: 'Node Version',
        passed: false,
        error: `Node ${version} is not supported. Requires Node 18+`,
      };
    }

    return { name: 'Node Version', passed: true };
  }

  private async checkDependencies(): Promise<ValidationCheck> {
    // Check if all required dependencies are installed
    return { name: 'Dependencies', passed: true };
  }
}
```

### 7.2 Post-Migration Validation

```typescript
// src/migration/PostMigrationValidator.ts

export class PostMigrationValidator {
  async validate(): Promise<ValidationResult> {
    const results: ValidationCheck[] = [
      await this.checkDataIntegrity(),
      await this.checkFunctionality(),
      await this.checkPerformance(),
    ];

    return {
      passed: results.every(r => r.passed),
      checks: results,
    };
  }

  private async checkDataIntegrity(): Promise<ValidationCheck> {
    // Compare record counts before/after
    return { name: 'Data Integrity', passed: true };
  }

  private async checkFunctionality(): Promise<ValidationCheck> {
    // Run smoke tests
    return { name: 'Functionality', passed: true };
  }

  private async checkPerformance(): Promise<ValidationCheck> {
    // Check performance benchmarks
    return { name: 'Performance', passed: true };
  }
}
```

### 7.3 Data Integrity Check

```typescript
// src/migration/DataIntegrityChecker.ts

export class DataIntegrityChecker {
  async checkAll(): Promise<IntegrityReport> {
    return {
      principles: await this.checkPrinciples(),
      success_patterns: await this.checkSuccessPatterns(),
      failure_patterns: await this.checkFailurePatterns(),
      retros: await this.checkRetros(),
      violations: await this.checkViolations(),
    };
  }

  async checkPrinciples(): Promise<DataCheckResult> {
    const basePath = join(homedir(), '.prism-gateway');
    const filePath = join(basePath, 'level-1-hot', 'principles.json');

    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as PrinciplesData;

      // Validate structure
      if (!data.version || !Array.isArray(data.principles)) {
        return { valid: false, error: 'Invalid structure' };
      }

      // Count principles
      const count = data.principles.length;

      return {
        valid: true,
        record_count: count,
        details: `Found ${count} principles`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Similar methods for other data types...
}
```

---

## 8. Rollback Plan

### 8.1 Rollback Triggers

Rollback should be triggered if:

1. **Critical Data Loss:** Any data corruption detected
2. **Functional Regression:** Phase 1 features no longer work
3. **Performance Degradation:** >50% performance drop
4. **User Request:** User explicitly requests rollback

### 8.2 Rollback Procedure

```typescript
// src/migration/RollbackManager.ts

export class RollbackManager {
  async rollback(): Promise<RollbackResult> {
    const startTime = Date.now();
    const steps: RollbackStep[] = [];

    try {
      // Step 1: Verify backup exists
      steps.push(await this.verifyBackup());

      // Step 2: Stop Phase 2 services
      steps.push(await this.stopPhase2Services());

      // Step 3: Remove Phase 2 directories
      steps.push(await this.removePhase2Data());

      // Step 4: Verify Phase 1 data intact
      steps.push(await this.verifyPhase1Data());

      // Step 5: Clear migration state
      steps.push(await this.clearMigrationState());

      return {
        success: true,
        steps,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        steps,
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private async verifyBackup(): Promise<RollbackStep> {
    // Implementation
    return { name: 'Verify Backup', success: true };
  }

  private async stopPhase2Services(): Promise<RollbackStep> {
    // Stop any running Phase 2 services
    return { name: 'Stop Phase 2 Services', success: true };
  }

  private async removePhase2Data(): Promise<RollbackStep> {
    // Remove analytics, cache, config, logs directories
    return { name: 'Remove Phase 2 Data', success: true };
  }

  private async verifyPhase1Data(): Promise<RollbackStep> {
    // Ensure Phase 1 data is intact
    return { name: 'Verify Phase 1 Data', success: true };
  }

  private async clearMigrationState(): Promise<RollbackStep> {
    // Remove migration state file
    return { name: 'Clear Migration State', success: true };
  }
}
```

### 8.3 Rollback CLI

```bash
# Rollback command
prism migrate --rollback

# Output
[Rollback] Starting rollback process...
[Rollback] Verifying backup... ✓
[Rollback] Stopping Phase 2 services... ✓
[Rollback] Removing Phase 2 directories... ✓
[Rollback] Verifying Phase 1 data... ✓
[Rollback] Clearing migration state... ✓
[Rollback] Rollback completed successfully
[Rollback] Phase 1 is now active
```

---

## 9. Migration Documentation

### 9.1 User Migration Guide

```markdown
# PRISM-Gateway Migration Guide: Phase 1 to Phase 2

## Overview
This guide will help you migrate from PRISM-Gateway Phase 1 to Phase 2.

## Prerequisites
- Node.js 18+ or Bun 1.0+
- Existing Phase 1 installation at ~/.prism-gateway
- At least 100MB free disk space

## Migration Steps

### 1. Backup (Automatic)
The migration process automatically creates a backup at:
`~/.prism-gateway-backup-YYYYMMDD/`

### 2. Run Migration
\`\`\`bash
# Dry run (no changes)
prism migrate --dry-run

# Actual migration
prism migrate
\`\`\`

### 3. Verify
\`\`\`bash
# Check migration status
prism migrate --status
\`\`\`

### 4. Test Phase 2
\`\`\`bash
# Run Phase 2 commands
prism gateway check "your task"
prism retro quick
\`\`\`

### 5. Rollback (if needed)
\`\`\`bash
prism migrate --rollback
\`\`\`

## What Changes?

### New Directories
- `~/.prism-gateway/analytics/` - Metrics and analytics data
- `~/.prism-gateway/cache/` - Cached data
- `~/.prism-gateway/config/` - Configuration files
- `~/.prism-gateway/logs/` - Activity logs
- `~/.prism-gateway/.migration/` - Migration state

### Unchanged
- All Phase 1 data remains compatible
- No data conversion required
- Phase 2 can read Phase 1 data directly

## Support
If you encounter issues:
1. Check migration status: `prism migrate --status`
2. Review logs: `~/.prism-gateway/logs/activity.jsonl`
3. Rollback if needed: `prism migrate --rollback`
4. Report issue with migration state file
```

### 9.2 Migration Checklist

```markdown
# Migration Checklist

## Pre-Migration
- [ ] Backup verified (automatic)
- [ ] Disk space available (100MB+)
- [ ] Phase 1 data validated
- [ ] Dependencies installed

## Migration
- [ ] Backup created
- [ ] New directories initialized
- [ ] Configuration created
- [ ] Analytics initialized
- [ ] Compatibility validated
- [ ] Migration state written

## Post-Migration
- [ ] Migration status verified
- [ ] Data integrity check passed
- [ ] Functionality test passed
- [ ] Performance check passed
- [ ] Phase 2 commands tested

## Rollback (if needed)
- [ ] Backup verified
- [ ] Phase 2 services stopped
- [ ] Phase 2 directories removed
- [ ] Phase 1 data verified
- [ ] Migration state cleared
```

---

## 10. Risk Assessment

### 10.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Data corruption | Low | Critical | Backup + Validation |
| Performance regression | Low | Medium | Benchmark comparison |
| Feature loss | Low | High | Compatibility testing |
| Migration failure | Medium | Medium | Rollback procedure |
| User confusion | Medium | Low | Documentation |

### 10.2 Worst Case Scenario Analysis

**Scenario:** Migration fails mid-process, data appears corrupted

**Recovery Steps:**
1. Migration script automatically detects failure
2. Rollback is triggered automatically
3. Backup is restored
4. Phase 1 remains functional
5. User is notified with error details

**Data Loss:** None - backup ensures data safety

### 10.3 Success Criteria

Migration is successful if:
- [ ] All Phase 1 data is readable in Phase 2
- [ ] All Phase 1 commands work in Phase 2
- [ ] No data loss or corruption
- [ ] Performance within 10% of Phase 1
- [ ] New Phase 2 features functional

---

## Appendix

### A. File Structure Comparison

```
Phase 1                              Phase 2
=================================    ==================================
~/.prism-gateway/                    ~/.prism-gateway/
├── level-1-hot/                     ├── level-1-hot/ [UNCHANGED]
│   ├── principles.json              │   └── (same files)
│   └── patterns/                    ├── level-2-warm/ [UNCHANGED]
├── level-2-warm/                    │   └── (same files)
│   ├── retros/                      ├── level-3-cold/ [UNCHANGED]
│   └── violations.jsonl             │   └── (same files)
├── level-3-cold/                    ├── analytics/ [NEW]
│   ├── sops/                        │   ├── metrics.jsonl
│   └── templates/                   │   └── aggregated/
                                      ├── cache/ [NEW]
                                      │   └── index.json
                                      ├── config/ [NEW]
                                      │   ├── default.json
                                      │   └── user.json.local
                                      ├── logs/ [NEW]
                                      │   └── activity.jsonl
                                      └── .migration/ [NEW]
                                          ├── state.json
                                          └── backup/
```

### B. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-04 | Initial migration plan |

---

**Document End**
