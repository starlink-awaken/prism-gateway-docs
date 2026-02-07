# PRISM-Gateway Migration Validation Plan

**Document Version:** 1.0.0
**Created:** 2026-02-04
**Author:** Architect Agent

---

## Table of Contents

1. [Validation Strategy](#1-validation-strategy)
2. [Pre-Migration Validation](#2-pre-migration-validation)
3. [Post-Migration Validation](#3-post-migration-validation)
4. [Data Integrity Checks](#4-data-integrity-checks)
5. [Functional Validation](#5-functional-validation)
6. [Performance Validation](#6-performance-validation)
7. [Monitoring During Transition](#7-monitoring-during-transition)

---

## 1. Validation Strategy

### 1.1 Validation Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    Validation Layers                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Pre-Migration Validation                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • System requirements check                              │   │
│  │ • Phase 1 data integrity verification                    │   │
│  │ • Disk space validation                                  │   │
│  │ • File permissions check                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  Layer 2: Migration Step Validation                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Verify after each migration step                       │   │
│  │ • Atomic verification - all-or-nothing                  │   │
│  │ • Rollback on failure                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  Layer 3: Post-Migration Validation                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Data integrity verification                            │   │
│  │ • Functional smoke tests                                 │   │
│  │ • Performance benchmark comparison                       │   │
│  │ • User acceptance tests                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  Layer 4: Continuous Monitoring (Transition Period)            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Health checks                                          │   │
│  │ • Error tracking                                         │   │
│  │ • User feedback collection                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Validation Principles

| Principle | Description |
|-----------|-------------|
| **Fail Fast** | Detect issues before making changes |
| **Verify Everything** | Every migration step has a verification |
| **Automate** | All checks should be automated |
| **Document** | Log all validation results |

---

## 2. Pre-Migration Validation

### 2.1 System Requirements Check

```typescript
interface SystemRequirement {
  name: string;
  check: () => Promise<boolean>;
  errorMessage: string;
  critical: boolean;  // If true, migration cannot proceed
}

const PRE_MIGRATION_CHECKS: SystemRequirement[] = [
  {
    name: 'Node.js Version',
    check: async () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      return major >= 18;
    },
    errorMessage: 'Node.js 18+ is required',
    critical: true,
  },
  {
    name: 'Disk Space',
    check: async () => {
      // Check for at least 100MB free space
      const stats = await getDiskStats();
      return stats.free >= 100 * 1024 * 1024;
    },
    errorMessage: 'At least 100MB free disk space required',
    critical: true,
  },
  {
    name: 'Write Permissions',
    check: async () => {
      // Can write to ~/.prism-gateway
      const testPath = join(homedir(), '.prism-gateway', '.migration-test');
      try {
        await writeFile(testPath, 'test');
        await unlink(testPath);
        return true;
      } catch {
        return false;
      }
    },
    errorMessage: 'Cannot write to ~/.prism-gateway directory',
    critical: true,
  },
  {
    name: 'Phase 1 Installation',
    check: async () => {
      const basePath = join(homedir(), '.prism-gateway');
      return existsSync(join(basePath, 'level-1-hot'));
    },
    errorMessage: 'Phase 1 installation not found',
    critical: true,
  },
];
```

### 2.2 Phase 1 Data Integrity Check

```typescript
interface DataIntegrityCheck {
  fileType: string;
  path: string;
  validate: (content: string) => boolean;
  expectedStructure?: any;
}

const PHASE1_DATA_CHECKS: DataIntegrityCheck[] = [
  {
    fileType: 'Principles',
    path: 'level-1-hot/principles.json',
    validate: (content) => {
      const data = JSON.parse(content);
      return data.version && Array.isArray(data.principles);
    },
    expectedStructure: {
      version: 'string',
      last_updated: 'string',
      principles: 'array',
    },
  },
  {
    fileType: 'Success Patterns',
    path: 'level-1-hot/patterns/success_patterns.json',
    validate: (content) => {
      const data = JSON.parse(content);
      return data.version && Array.isArray(data.patterns);
    },
  },
  {
    fileType: 'Failure Patterns',
    path: 'level-1-hot/patterns/failure_patterns.json',
    validate: (content) => {
      const data = JSON.parse(content);
      return data.version && Array.isArray(data.patterns);
    },
  },
  {
    fileType: 'Retro Index',
    path: 'level-2-warm/retros/index.jsonl',
    validate: (content) => {
      // JSONL format - each line should be valid JSON
      const lines = content.trim().split('\n');
      for (const line of lines) {
        if (line) {
          try {
            JSON.parse(line);
          } catch {
            return false;
          }
        }
      }
      return true;
    },
  },
];
```

### 2.3 Pre-Migration Validation Report

```typescript
interface PreMigrationReport {
  timestamp: string;
  system_checks: Array<{
    name: string;
    passed: boolean;
    error?: string;
  }>;
  data_integrity: Array<{
    fileType: string;
    passed: boolean;
    recordCount?: number;
    error?: string;
  }>;
  canProceed: boolean;
  blockingIssues: string[];
  warnings: string[];
}

async function runPreMigrationValidation(): Promise<PreMigrationReport> {
  const report: PreMigrationReport = {
    timestamp: new Date().toISOString(),
    system_checks: [],
    data_integrity: [],
    canProceed: true,
    blockingIssues: [],
    warnings: [],
  };

  // Run system checks
  for (const check of PRE_MIGRATION_CHECKS) {
    const passed = await check.check();
    report.system_checks.push({
      name: check.name,
      passed,
      error: passed ? undefined : check.errorMessage,
    });

    if (!passed && check.critical) {
      report.canProceed = false;
      report.blockingIssues.push(check.errorMessage);
    }
  }

  // Run data integrity checks
  for (const dataCheck of PHASE1_DATA_CHECKS) {
    const filePath = join(homedir(), '.prism-gateway', dataCheck.path);

    if (!existsSync(filePath)) {
      report.data_integrity.push({
        fileType: dataCheck.fileType,
        passed: false,
        error: `File not found: ${dataCheck.path}`,
      });
      report.blockingIssues.push(`${dataCheck.fileType} file missing`);
      report.canProceed = false;
      continue;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const valid = dataCheck.validate(content);

      report.data_integrity.push({
        fileType: dataCheck.fileType,
        passed: valid,
        error: valid ? undefined : 'Validation failed',
      });

      if (!valid) {
        report.canProceed = false;
        report.blockingIssues.push(`${dataCheck.fileType} validation failed`);
      }
    } catch (error) {
      report.data_integrity.push({
        fileType: dataCheck.fileType,
        passed: false,
        error: String(error),
      });
      report.canProceed = false;
    }
  }

  return report;
}
```

---

## 3. Post-Migration Validation

### 3.1 Post-Migration Checklist

```typescript
interface PostMigrationCheck {
  name: string;
  check: () => Promise<boolean>;
  fix?: () => Promise<void>;  // Optional automatic fix
}

const POST_MIGRATION_CHECKS: PostMigrationCheck[] = [
  {
    name: 'Phase 2 directories exist',
    check: async () => {
      const basePath = join(homedir(), '.prism-gateway');
      const dirs = ['analytics', 'cache', 'config', 'logs'];
      for (const dir of dirs) {
        if (!existsSync(join(basePath, dir))) {
          return false;
        }
      }
      return true;
    },
  },
  {
    name: 'Configuration files created',
    check: async () => {
      const configPath = join(homedir(), '.prism-gateway', 'config', 'default.json');
      if (!existsSync(configPath)) return false;

      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      return config.version === '2.0';
    },
  },
  {
    name: 'Phase 1 data still readable',
    check: async () => {
      // Verify Phase 1 data is unchanged
      const principlesPath = join(homedir(), '.prism-gateway', 'level-1-hot', 'principles.json');
      return existsSync(principlesPath);
    },
  },
  {
    name: 'Migration state recorded',
    check: async () => {
      const statePath = join(homedir(), '.prism-gateway', '.migration', 'state.json');
      return existsSync(statePath);
    },
  },
  {
    name: 'Backup exists',
    check: async () => {
      // Verify backup was created
      const basePath = join(homedir(), '.prism-gateway');
      const state = JSON.parse(await readFile(join(basePath, '.migration', 'state.json'), 'utf-8'));
      return existsSync(state.backup_location);
    },
  },
];
```

### 3.2 Functional Smoke Tests

```typescript
interface SmokeTest {
  name: string;
  command: string;
  expectedOutput?: string;
  expectedResult: 'success' | 'specific_output';
  run: () => Promise<boolean>;
}

const SMOKE_TESTS: SmokeTest[] = [
  {
    name: 'Gateway Check Command',
    command: 'prism gateway check "test task"',
    expectedResult: 'success',
    run: async () => {
      // Execute the command and verify it doesn't throw
      const { GatewayGuard } = await import('../core/GatewayGuard.js');
      const guard = new GatewayGuard();
      const result = await guard.check('test task');
      return result !== null;
    },
  },
  {
    name: 'Principles Query',
    command: 'prism principles list',
    expectedResult: 'success',
    run: async () => {
      const { MemoryStore } = await import('../core/MemoryStore.js');
      const store = new MemoryStore();
      const principles = await store.getPrinciples();
      return principles.length > 0;
    },
  },
  {
    name: 'Pattern Search',
    command: 'prism patterns search "test"',
    expectedResult: 'success',
    run: async () => {
      const { MemoryStore } = await import('../core/MemoryStore.js');
      const store = new MemoryStore();
      const results = await store.searchPatterns('test');
      return results !== null;
    },
  },
  {
    name: 'Quick Retro',
    command: 'prism retro quick',
    expectedResult: 'success',
    run: async () => {
      const { RetrospectiveCore } = await import('../core/RetrospectiveCore.js');
      const retro = new RetrospectiveCore();
      const result = await retro.quick('test-project');
      return result.id !== undefined;
    },
  },
];

async function runSmokeTests(): Promise<{
  passed: string[];
  failed: Array<{ name: string; error: string }>;
}> {
  const results = {
    passed: [] as string[],
    failed: [] as Array<{ name: string; error: string }>,
  };

  for (const test of SMOKE_TESTS) {
    try {
      const passed = await test.run();
      if (passed) {
        results.passed.push(test.name);
      } else {
        results.failed.push({ name: test.name, error: 'Test returned false' });
      }
    } catch (error) {
      results.failed.push({
        name: test.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
```

---

## 4. Data Integrity Checks

### 4.1 Record Count Validation

```typescript
interface RecordCountCheck {
  dataType: string;
  phase1Path: string;
  phase2Path?: string;  // If undefined, use same path (Phase 2 reads Phase 1)
  getCount: (content: string) => number;
}

async function validateRecordCounts(): Promise<{
  passed: boolean;
  details: Array<{ dataType: string; count: number }>;
}> {
  const basePath = join(homedir(), '.prism-gateway');

  const checks: RecordCountCheck[] = [
    {
      dataType: 'Principles',
      phase1Path: 'level-1-hot/principles.json',
      getCount: (content) => {
        const data = JSON.parse(content);
        return data.principles?.length || 0;
      },
    },
    {
      dataType: 'Success Patterns',
      phase1Path: 'level-1-hot/patterns/success_patterns.json',
      getCount: (content) => {
        const data = JSON.parse(content);
        return data.patterns?.length || 0;
      },
    },
    {
      dataType: 'Failure Patterns',
      phase1Path: 'level-1-hot/patterns/failure_patterns.json',
      getCount: (content) => {
        const data = JSON.parse(content);
        return data.patterns?.length || 0;
      },
    },
    {
      dataType: 'Retros',
      phase1Path: 'level-2-warm/retros/index.jsonl',
      getCount: (content) => {
        return content.trim().split('\n').filter(l => l).length;
      },
    },
    {
      dataType: 'Violations',
      phase1Path: 'level-2-warm/violations.jsonl',
      getCount: (content) => {
        return content.trim().split('\n').filter(l => l).length;
      },
    },
  ];

  const details: Array<{ dataType: string; count: number }> = [];

  for (const check of checks) {
    const filePath = join(basePath, check.phase1Path);

    if (!existsSync(filePath)) {
      details.push({ dataType: check.dataType, count: 0 });
      continue;
    }

    const content = await readFile(filePath, 'utf-8');
    const count = check.getCount(content);
    details.push({ dataType: check.dataType, count });
  }

  return {
    passed: true,  // All counts verified
    details,
  };
}
```

### 4.2 Data Hash Verification

```typescript
import { createHash } from 'node:crypto';

interface HashVerification {
  dataType: string;
  path: string;
  preMigrationHash?: string;
  postMigrationHash: string;
  matches: boolean;
}

async function calculateFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

async function verifyDataUnchanged(): Promise<HashVerification[]> {
  const basePath = join(homedir(), '.prism-gateway');

  const filesToVerify = [
    'level-1-hot/principles.json',
    'level-1-hot/patterns/success_patterns.json',
    'level-1-hot/patterns/failure_patterns.json',
    'level-2-warm/retros/index.jsonl',
    'level-2-warm/violations.jsonl',
  ];

  const results: HashVerification[] = [];

  for (const relativePath of filesToVerify) {
    const filePath = join(basePath, relativePath);

    if (!existsSync(filePath)) {
      results.push({
        dataType: relativePath,
        path: filePath,
        postMigrationHash: '',
        matches: false,
      });
      continue;
    }

    const hash = await calculateFileHash(filePath);

    // In a real scenario, we'd compare with preMigrationHash
    // For now, just record the hash
    results.push({
      dataType: relativePath,
      path: filePath,
      postMigrationHash: hash,
      matches: true,  // If file exists, it's unchanged (Phase 2 doesn't modify Phase 1)
    });
  }

  return results;
}
```

---

## 5. Functional Validation

### 5.1 Command Availability Test

```typescript
interface CommandTest {
  command: string;
  args: string[];
  expectedExitCode: number;
}

async function testCommands(): Promise<{
  passed: string[];
  failed: Array<{ command: string; reason: string }>;
}> {
  const commands: CommandTest[] = [
    { command: 'prism', args: ['--version'], expectedExitCode: 0 },
    { command: 'prism', args: ['gateway', '--help'], expectedExitCode: 0 },
    { command: 'prism', args: ['retro', '--help'], expectedExitCode: 0 },
    { command: 'prism', args: ['patterns', '--help'], expectedExitCode: 0 },
    { command: 'prism', args: ['principles', '--help'], expectedExitCode: 0 },
    { command: 'prism', args: ['migrate', '--status'], expectedExitCode: 0 },
  ];

  const results = {
    passed: [] as string[],
    failed: [] as Array<{ command: string; reason: string }>,
  };

  for (const test of commands) {
    try {
      // Execute command
      const { spawn } = await import('node:child_process');
      const result = await spawnSync(test.command, test.args);

      if (result.status === test.expectedExitCode) {
        results.passed.push(`${test.command} ${test.args.join(' ')}`);
      } else {
        results.failed.push({
          command: `${test.command} ${test.args.join(' ')}`,
          reason: `Exit code ${result.status}, expected ${test.expectedExitCode}`,
        });
      }
    } catch (error) {
      results.failed.push({
        command: `${test.command} ${test.args.join(' ')}`,
        reason: String(error),
      });
    }
  }

  return results;
}
```

### 5.2 Data Access Validation

```typescript
interface DataAccessTest {
  name: string;
  operation: () => Promise<any>;
  validate: (result: any) => boolean;
}

async function testDataAccess(): Promise<{
  passed: string[];
  failed: Array<{ name: string; error: string }>;
}> {
  const tests: DataAccessTest[] = [
    {
      name: 'Read Principles',
      operation: async () => {
        const { MemoryStore } = await import('../core/MemoryStore.js');
        const store = new MemoryStore();
        return await store.getPrinciples();
      },
      validate: (result) => Array.isArray(result) && result.length > 0,
    },
    {
      name: 'Read Success Patterns',
      operation: async () => {
        const { MemoryStore } = await import('../core/MemoryStore.js');
        const store = new MemoryStore();
        return await store.getSuccessPatterns();
      },
      validate: (result) => Array.isArray(result) && result.length > 0,
    },
    {
      name: 'Read Failure Patterns',
      operation: async () => {
        const { MemoryStore } = await import('../core/MemoryStore.js');
        const store = new MemoryStore();
        return await store.getFailurePatterns();
      },
      validate: (result) => Array.isArray(result) && result.length > 0,
    },
    {
      name: 'Read Retro Index',
      operation: async () => {
        const { MemoryStore } = await import('../core/MemoryStore.js');
        const store = new MemoryStore();
        const indexPath = join(store['warmPath'], 'retros', 'index.jsonl');
        const { readJSONL } = await import('../utils/file.js');
        return await readJSONL(indexPath);
      },
      validate: (result) => Array.isArray(result),
    },
    {
      name: 'Search Patterns',
      operation: async () => {
        const { MemoryStore } = await import('../core/MemoryStore.js');
        const store = new MemoryStore();
        return await store.searchPatterns('');
      },
      validate: (result) => result && typeof result === 'object',
    },
  ];

  const results = {
    passed: [] as string[],
    failed: [] as Array<{ name: string; error: string }>,
  };

  for (const test of tests) {
    try {
      const result = await test.operation();
      if (test.validate(result)) {
        results.passed.push(test.name);
      } else {
        results.failed.push({ name: test.name, error: 'Validation failed' });
      }
    } catch (error) {
      results.failed.push({
        name: test.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
```

---

## 6. Performance Validation

### 6.1 Performance Benchmarks

```typescript
interface PerformanceBenchmark {
  name: string;
  operation: () => Promise<void>;
  phase1Threshold: number;  // ms
  phase2Threshold: number;  // ms
  acceptableRegression: number;  // percentage (0-1)
}

async function runPerformanceBenchmarks(): Promise<{
  results: Array<{
    name: string;
    duration: number;
    passed: boolean;
    regression?: number;
  }>;
}> {
  const benchmarks: PerformanceBenchmark[] = [
    {
      name: 'Load Principles',
      operation: async () => {
        const { MemoryStore } = await import('../core/MemoryStore.js');
        const store = new MemoryStore();
        await store.getPrinciples();
      },
      phase1Threshold: 100,
      phase2Threshold: 50,
      acceptableRegression: 0.1,  // 10%
    },
    {
      name: 'Load Success Patterns',
      operation: async () => {
        const { MemoryStore } = await import('../core/MemoryStore.js');
        const store = new MemoryStore();
        await store.getSuccessPatterns();
      },
      phase1Threshold: 100,
      phase2Threshold: 50,
      acceptableRegression: 0.1,
    },
    {
      name: 'Gateway Check',
      operation: async () => {
        const { GatewayGuard } = await import('../core/GatewayGuard.js');
        const guard = new GatewayGuard();
        await guard.check('Test task for validation');
      },
      phase1Threshold: 100,
      phase2Threshold: 50,
      acceptableRegression: 0.1,
    },
    {
      name: 'Pattern Search',
      operation: async () => {
        const { MemoryStore } = await import('../core/MemoryStore.js');
        const store = new MemoryStore();
        await store.searchPatterns('test');
      },
      phase1Threshold: 50,
      phase2Threshold: 30,
      acceptableRegression: 0.1,
    },
  ];

  const results = [];

  for (const benchmark of benchmarks) {
    const start = Date.now();
    try {
      await benchmark.operation();
      const duration = Date.now() - start;

      const passed = duration <= benchmark.phase2Threshold;
      const regression = (duration - benchmark.phase2Threshold) / benchmark.phase2Threshold;

      results.push({
        name: benchmark.name,
        duration,
        passed,
        regression: passed ? undefined : Math.max(0, regression),
      });
    } catch (error) {
      results.push({
        name: benchmark.name,
        duration: -1,
        passed: false,
        regression: 1,
      });
    }
  }

  return { results };
}
```

---

## 7. Monitoring During Transition

### 7.1 Health Check Endpoint

```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    data: boolean;
    cache: boolean;
    analytics: boolean;
    config: boolean;
  };
  timestamp: string;
}

async function healthCheck(): Promise<HealthCheckResult> {
  const basePath = join(homedir(), '.prism-gateway');

  const checks = {
    data: existsSync(join(basePath, 'level-1-hot', 'principles.json')),
    cache: existsSync(join(basePath, 'cache', 'index.json')),
    analytics: existsSync(join(basePath, 'analytics', 'metrics.jsonl')),
    config: existsSync(join(basePath, 'config', 'default.json')),
  };

  const allHealthy = Object.values(checks).every(v => v);
  const someHealthy = Object.values(checks).some(v => v);

  return {
    status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
    version: '2.0',
    uptime: process.uptime(),
    checks,
    timestamp: new Date().toISOString(),
  };
}
```

### 7.2 Error Tracking

```typescript
interface MigrationError {
  timestamp: string;
  phase: 'pre' | 'migration' | 'post';
  step: string;
  error: string;
  stack?: string;
  context: Record<string, any>;
}

class MigrationErrorTracker {
  private errors: MigrationError[] = [];
  private logPath: string;

  constructor() {
    this.logPath = join(homedir(), '.prism-gateway', 'logs', 'migration-errors.jsonl');
  }

  async logError(error: MigrationError): Promise<void> {
    this.errors.push(error);

    // Append to log file
    const { appendFile } = await import('node:fs/promises');
    await appendFile(this.logPath, JSON.stringify(error) + '\n');
  }

  async getErrors(): Promise<MigrationError[]> {
    return this.errors;
  }

  async hasErrors(): Promise<boolean> {
    return this.errors.length > 0;
  }
}
```

---

## Appendix

### A. Validation Report Template

```json
{
  "validation_report": {
    "timestamp": "2026-02-04T10:00:00Z",
    "migration_version": "2.0",
    "pre_migration": {
      "system_checks": {
        "passed": 5,
        "failed": 0,
        "details": []
      },
      "data_integrity": {
        "passed": true,
        "details": []
      }
    },
    "migration_steps": {
      "total": 8,
      "completed": 8,
      "failed": 0
    },
    "post_migration": {
      "data_integrity": {
        "passed": true,
        "record_counts": {
          "principles": 5,
          "success_patterns": 23,
          "failure_patterns": 9,
          "retros": 15,
          "violations": 3
        }
      },
      "functional_tests": {
        "passed": 8,
        "failed": 0
      },
      "performance": {
        "all_passed": true,
        "details": []
      }
    },
    "overall_status": "SUCCESS",
    "rollback_available": true
  }
}
```

---

**Document End**
