# TrapDetector API Reference

## Overview

TrapDetector identifies common pitfalls based on high-frequency failure patterns.

## Detection Rules

| Rule | Severity | Keywords | Description |
|------|----------|----------|-------------|
| 表面修复 | 高 | 隐藏, 限制, 忽略 | Hiding issues instead of root cause fix |
| 语法验证即功能验证 | 高 | 语法, lint, 类型检查 | Syntax check ≠ functional verification |
| 未理解用户期望 | 中 | 假设, 认为, 应该 | Assuming user needs |
| 未搜索官方资源 | 高 | 推测, 分析, 诊断 | Analyzing without official resources |
| 重复相同操作 | 中 | 重试, 再次, 重复 | Repeating same action |
| 过度依赖自动化工具 | 中 | 工具, 自动, 生成 | Over-reliance on tools |

Also detects high-frequency historical failure patterns (2+ occurrences).

## Class: TrapDetector

### Constructor

```typescript
constructor(memoryStore: MemoryStore)
```

Creates a new TrapDetector instance.

**Parameters:**
- `memoryStore`: MemoryStore instance for accessing failure patterns

**Example:**
```typescript
import { TrapDetector, MemoryStore } from 'reflectguard';

const store = new MemoryStore();
const detector = new TrapDetector(store);
```

---

### Methods

#### detect()

```typescript
async detect(intent: string): Promise<Trap[]>
```

Detect traps in the task intent.

**Parameters:**
- `intent`: Task intent description

**Returns:** Array of detected traps

**Example:**
```typescript
const traps = await detector.detect('I will hide the error message');

traps.forEach(trap => {
  console.log(`[${trap.severity}] ${trap.pattern_name}`);
  console.log(`  ${trap.message}`);
});
```

---

#### getHighSeverityTraps()

```typescript
getHighSeverityTraps(traps: Trap[]): Trap[]
```

Filter high-severity traps.

**Parameters:**
- `traps`: Array of traps

**Returns:** High-severity traps only

**Example:**
```typescript
const traps = await detector.detect('Task description');
const critical = detector.getHighSeverityTraps(traps);

console.log(`Found ${critical.length} critical traps`);
```

---

## Types

### Trap

```typescript
interface Trap {
  pattern_id: string;
  pattern_name: string;
  severity: '高' | '中' | '低';
  message: string;
}
```

---

## Trap Rules

### 表面修复 (Surface Fix)

**Severity**: 高

**Keywords**: `['隐藏', '限制', '忽略', '跳过']`

**Pattern**: `(隐藏|限制|忽略).+(异常|错误|问题)`

**Message**: "警惕：表面修复而非根本解决。建议先问'这是根本原因还是症状？'"

---

### 语法验证即功能验证 (Syntax as Functional)

**Severity**: 高

**Keywords**: `['语法', 'lint', '类型检查']`

**Pattern**: `(语法|lint|类型检查).+(通过|正确)`

**Message**: "警惕：语法验证≠功能验证。建议进行实际功能测试"

---

### 未理解用户期望 (Ununderstood Expectations)

**Severity**: 中

**Keywords**: `['假设', '认为', '应该']`

**Pattern**: `(用户|应该).+(想要|期望)`

**Message**: "注意：确认已明确用户期望（彻底 vs 快速）"

---

### 未搜索官方资源 (No Official Search)

**Severity**: 高

**Keywords**: `['推测', '分析', '诊断']`

**Pattern**: `(推测|深度分析).+(问题|错误)`

**Message**: "警惕：未搜索官方资源直接分析。建议先用WebSearch工具"

---

### 重复相同操作 (Repeat Same Action)

**Severity**: 中

**Keywords**: `['重试', '再次', '重复']`

**Pattern**: `(重试|再次).+(相同|一样)`

**Message**: "警告：重复相同操作违反'不重复失败'原则"

---

### 过度依赖自动化工具 (Over-reliance on Tools)

**Severity**: 中

**Keywords**: `['工具', '自动', '生成']`

**Pattern**: `(工具|自动).+(完成|搞定)`

**Message**: "注意：不要过度依赖工具，要验证实际结果"

---

## Detection Process

```
Input Intent
     │
     ▼
┌─────────────────┐
│  Apply Trap      │
│  Rules          │
│  - Keyword match │
│  - Pattern match │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Check Historical│
│  Failure Patterns│
│  (occurrences ≥2)│
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Deduplicate    │
│  Results        │
└─────────────────┘
     │
     ▼
   Return Traps
```

---

## Example: Complete Workflow

```typescript
import { TrapDetector, MemoryStore } from 'reflectguard';

const store = new MemoryStore();
const detector = new TrapDetector(store);

async function analyzeTask(intent: string) {
  console.log(`Analyzing for traps: "${intent}"\n`);

  const traps = await detector.detect(intent);

  if (traps.length === 0) {
    console.log('✅ No traps detected');
    return;
  }

  // Group by severity
  const high = traps.filter(t => t.severity === '高');
  const medium = traps.filter(t => t.severity === '中');
  const low = traps.filter(t => t.severity === '低');

  // Display results
  if (high.length > 0) {
    console.log('🔴 HIGH Severity Traps:');
    high.forEach(t => {
      console.log(`  - ${t.pattern_name}`);
      console.log(`    ${t.message}`);
    });
  }

  if (medium.length > 0) {
    console.log('\n🟡 MEDIUM Severity Traps:');
    medium.forEach(t => {
      console.log(`  - ${t.pattern_name}`);
      console.log(`    ${t.message}`);
    });
  }

  if (low.length > 0) {
    console.log('\n🟢 LOW Severity Traps:');
    low.forEach(t => {
      console.log(`  - ${t.pattern_name}`);
      console.log(`    ${t.message}`);
    });
  }
}

// Test cases
await analyzeTask('I will hide the error message to make it look clean');
await analyzeTask('The code passes lint, so it should work');
await analyzeTask('The user probably wants a quick fix');
await analyzeTask('Let me analyze this error without searching');
await analyzeTask('I will try the same approach again');
```

---

## Performance

| Method | Target | Typical |
|--------|--------|---------|
| `detect()` | <200ms | ~30ms |

---

## Integration Example

```typescript
import { TrapDetector, MemoryStore, GatewayGuard } from 'reflectguard';

const store = new MemoryStore();
const detector = new TrapDetector(store);
const guard = new GatewayGuard(store);

async function comprehensiveCheck(intent: string) {
  // First, run gateway check
  const checkResult = await guard.check(intent);

  // Then, specifically check for traps
  const traps = await detector.detect(intent);

  // Combine results
  const analysis = {
    intent,
    gatewayStatus: checkResult.status,
    violations: checkResult.violations,
    risks: checkResult.risks,
    traps: {
      all: traps,
      highSeverity: detector.getHighSeverityTraps(traps)
    }
  };

  // Generate warnings
  const warnings = [];

  if (analysis.traps.highSeverity.length > 0) {
    warnings.push(`${analysis.traps.highSeverity.length} HIGH severity trap(s) detected`);
  }

  if (analysis.traps.all.length > 0) {
    warnings.push(`${analysis.traps.all.length} trap(s) total detected`);
  }

  return {
    analysis,
    warnings,
    safe: analysis.traps.highSeverity.length === 0
  };
}
```

---

## Historical Pattern Detection

TrapDetector also checks historical failure patterns:

```typescript
// Automatic detection of patterns that occurred 2+ times
const traps = await detector.detect(intent);

// Historical traps are prefixed with the pattern ID
traps.forEach(trap => {
  if (trap.pattern_id.startsWith('FP_')) {
    console.log(`Historical trap: ${trap.pattern_name}`);
    console.log(`Occurred multiple times before`);
  }
});
```
