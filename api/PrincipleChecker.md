# PrincipleChecker API Reference

## Overview

PrincipleChecker checks task intents against 5 MANDATORY behavioral guidelines.

## Five Principles

| ID | Name | Level | Description |
|----|------|-------|-------------|
| P1 | Search First | HARD_BLOCK | Search official resources before coding |
| P2 | Verify Functionally | HARD_BLOCK | Do actual testing, not just syntax checks |
| P3 | No Repeat Failures | HARD_BLOCK | Don't repeat the same failed action |
| P4 | Don't Hide Exceptions | HARD_BLOCK | Don't suppress errors without fixing |
| P5 | Understand Expectations | MANDATORY | Confirm user expectations first |

## Class: PrincipleChecker

### Constructor

```typescript
constructor(memoryStore: MemoryStore)
```

Creates a new PrincipleChecker instance.

**Parameters:**
- `memoryStore`: MemoryStore instance for accessing principles

**Example:**
```typescript
import { PrincipleChecker, MemoryStore } from 'reflectguard';

const store = new MemoryStore();
const checker = new PrincipleChecker(store);
```

---

### Methods

#### check()

```typescript
async check(intent: string, context?: { phase?: string }): Promise<Violation[]>
```

Check if intent violates any principles.

**Parameters:**
- `intent`: Task intent description
- `context` (optional): Check context (phase filtering)

**Returns:** Array of violations (empty if none)

**Example:**
```typescript
const violations = await checker.check('Implement login feature', {
  phase: 'Development'
});

if (violations.length > 0) {
  console.log(`Found ${violations.length} violations:`);
  violations.forEach(v => {
    console.log(`  [${v.severity}] ${v.principle_name}: ${v.message}`);
  });
} else {
  console.log('No violations');
}
```

---

#### checkPrinciple()

```typescript
async checkPrinciple(
  intent: string,
  principleId: string
): Promise<Violation | null>
```

Check a single principle.

**Parameters:**
- `intent`: Task intent description
- `principleId`: Principle ID (e.g., "P1", "P2")

**Returns:** Violation object or null

**Example:**
```typescript
const violation = await checker.checkPrinciple('Implement login', 'P1');

if (violation) {
  console.log(`P1 violated: ${violation.message}`);
} else {
  console.log('P1 not violated');
}
```

---

#### generateSuggestions()

```typescript
generateSuggestions(violations: Violation[]): string[]
```

Generate actionable suggestions for violations.

**Parameters:**
- `violations`: Array of violations

**Returns:** Array of suggestion strings

**Example:**
```typescript
const violations = await checker.check('Task description');
if (violations.length > 0) {
  const suggestions = checker.generateSuggestions(violations);
  suggestions.forEach(s => console.log(s));
}
```

**Generated suggestions:**
- P1: "建议：先使用WebSearch工具搜索官方资源和已知问题"
- P2: "建议：进行实际功能测试，不要只依赖语法验证"
- P3: "警告：重复失败会触发强制阻断，请立即调整策略"
- P4: "建议：调查数据异常的根本原因，不要隐藏异常"
- P5: "建议：明确用户期望（彻底解决 vs 快速修复）"

---

## Types

### Violation

```typescript
interface Violation {
  principle_id: string;
  principle_name: string;
  severity: 'MANDATORY' | 'HARD_BLOCK';
  message: string;
  detected_at: string;
}
```

### Principle

```typescript
interface Principle {
  id: string;                  // e.g., "P1", "P2"
  name: string;
  level: 'MANDATORY' | 'HARD_BLOCK';
  priority: number;
  check_phases: string[];      // Applicable phases
  keywords: string[];          // Trigger keywords
  violation_message: string;
  verification_method: string;
  consequence: string;
  historical_evidence: string;
}
```

---

## Check Process

```
Input Intent
     │
     ▼
┌─────────────────┐
│  Load           │
│  Principles     │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  For each       │
│  principle:     │
│  - Check phase  │
│  - Match keywords│
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  HARD_BLOCK?    │ ──── Yes ──→ Return immediately
└─────────────────┘
     │ No
     ▼
┌─────────────────┐
│  Continue       │
│  checking       │
└─────────────────┘
     │
     ▼
   Return all violations
```

---

## Example: Complete Workflow

```typescript
import { PrincipleChecker, MemoryStore } from 'reflectguard';

const store = new MemoryStore();
const checker = new PrincipleChecker(store);

async function analyzeIntent(intent: string) {
  console.log(`Analyzing: "${intent}"\n`);

  // Check all principles
  const violations = await checker.check(intent, {
    phase: 'Development'
  });

  // Display results
  if (violations.length === 0) {
    console.log('✅ No principle violations');
    return true;
  }

  console.log(`❌ Found ${violations.length} violation(s):\n`);

  for (const v of violations) {
    const icon = v.severity === 'HARD_BLOCK' ? '🚫' : '⚠️';
    console.log(`${icon} [${v.principle_id}] ${v.principle_name}`);
    console.log(`   ${v.message}`);
    console.log(`   Detected at: ${v.detected_at}\n`);
  }

  // Generate suggestions
  console.log('Suggestions:');
  const suggestions = checker.generateSuggestions(violations);
  suggestions.forEach(s => console.log(`  - ${s}`));

  // Check if any HARD_BLOCK
  const hasHardBlock = violations.some(v => v.severity === 'HARD_BLOCK');
  if (hasHardBlock) {
    console.log('\n🚫 Task BLOCKED by HARD_BLOCK violation(s)');
    return false;
  }

  console.log('\n⚠️ Task allowed with warnings');
  return true;
}

// Test cases
await analyzeIntent('Implement user login feature');
await analyzeIntent('Hide the error message');
await analyzeIntent('Try the same approach again');
```

---

## Performance

| Method | Target | Typical |
|--------|--------|---------|
| `check()` | <300ms | ~50ms |
| `checkPrinciple()` | <100ms | ~20ms |

---

## Principle Details

### P1: Search First

**Keywords**: `['推测', '分析', '诊断', '猜测', '推断']`

**Violation Message**: "未搜索官方资源直接分析/编码，可能基于错误假设"

**Verification**: 检查是否有搜索步骤

**Consequence**: "基于错误假设浪费时间，多次触发将升级为HARD_BLOCK"

---

### P2: Verify Functionally

**Keywords**: `['语法', 'lint', '类型检查', '编译', '静态']`

**Violation Message**: "仅进行语法验证，未进行实际功能测试"

**Verification**: 实际运行测试用例

**Consequence**: "运行时错误未被发现，交付质量不达标"

---

### P3: No Repeat Failures

**Keywords**: `['重试', '再次', '重复', '相同', '一样']`

**Violation Message**: "重复相同的失败操作，违反'不重复失败'原则"

**Verification**: 检查历史操作记录

**Consequence**: "立即强制阻断，要求调整策略"

---

### P4: Don't Hide Exceptions

**Keywords**: `['隐藏', '限制', '忽略', '跳过', 'suppress']`

**Violation Message**: "隐藏/限制异常/错误/问题，而非根本解决"

**Verification**: 检查异常处理方式

**Consequence**: "问题被掩盖，后续可能爆发更大故障"

---

### P5: Understand Expectations

**Keywords**: `['假设', '认为', '应该', '估计']`

**Violation Message**: "未明确用户期望（彻底解决 vs 快速修复）"

**Verification**: 确认用户需求

**Consequence**: "解决方案不符合用户期望，浪费时间"
