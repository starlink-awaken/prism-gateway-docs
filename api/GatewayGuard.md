# GatewayGuard API Reference

## Overview

GatewayGuard is the violation checking engine of ReflectGuard. It implements a three-layer checking mechanism:

1. **Layer 1: Principle Checking** (MANDATORY) - Based on 5 behavioral guidelines
2. **Layer 2: Pattern Matching** (WARNING) - Identify success/failure patterns
3. **Layer 3: Trap Detection** (ADVISORY) - Detect common pitfalls

## Class: GatewayGuard

### Constructor

```typescript
constructor(memoryStore?: MemoryStore)
```

Creates a new GatewayGuard instance.

**Parameters:**
- `memoryStore` (optional): MemoryStore instance for accessing principles and patterns

**Example:**
```typescript
import { GatewayGuard, MemoryStore } from 'reflectguard';

const store = new MemoryStore();
const guard = new GatewayGuard(store);

// Or use default
const guard = new GatewayGuard();
```

---

### Methods

#### check()

```typescript
async check(intent: string, context?: CheckContext): Promise<CheckResult>
```

Perform a full three-layer check on the task intent.

**Parameters:**
- `intent`: Task intent description, e.g., "Implement user login feature"
- `context` (optional): Check context including phase, history, user preferences

**Returns:** Complete check result with status, violations, risks, traps, and suggestions

**Example:**
```typescript
const result = await guard.check('Implement user login feature', {
  phase: 'Development',
  history: [],
  user_preferences: { strict: true }
});

if (result.status === CheckStatus.BLOCKED) {
  console.log('Task blocked:', result.violations);
} else if (result.status === CheckStatus.WARNING) {
  console.log('Warnings:', result.risks);
} else {
  console.log('Check passed');
}
```

---

#### quickCheck()

```typescript
async quickCheck(intent: string): Promise<boolean>
```

Quick check with principle checking only, for performance-sensitive scenarios.

**Parameters:**
- `intent`: Task intent description

**Returns:** `true` if no HARD_BLOCK violations, `false` otherwise

**Example:**
```typescript
if (await guard.quickCheck('Simple task')) {
  // Continue execution
}
```

---

#### formatResult()

```typescript
formatResult(result: CheckResult): string
```

Format check result as human-readable Markdown text.

**Parameters:**
- `result`: Check result object

**Returns:** Formatted Markdown string

**Example:**
```typescript
const result = await guard.check('Task description');
console.log(guard.formatResult(result));
```

---

## Types

### CheckStatus

```typescript
enum CheckStatus {
  PASS = 'PASS',
  WARNING = 'WARNING',
  BLOCKED = 'BLOCKED'
}
```

### CheckResult

```typescript
interface CheckResult {
  status: CheckStatus;        // Overall check status
  violations: Violation[];    // Principle violations
  risks: Risk[];              // Pattern risks
  traps: Trap[];              // Detected traps
  suggestions: Suggestion[];  // Actionable suggestions
  check_time: number;         // Check duration in milliseconds
  timestamp: string;          // ISO 8601 timestamp
}
```

### CheckContext

```typescript
interface CheckContext {
  phase?: string;                      // Current phase
  history?: Violation[];               // Historical violations
  user_preferences?: Record<string, any>;
}
```

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

### Risk

```typescript
interface Risk {
  pattern_id: string;
  pattern_name: string;
  type: 'success' | 'failure';
  confidence: number;         // 0-1
  message: string;
}
```

### Trap

```typescript
interface Trap {
  pattern_id: string;
  pattern_name: string;
  severity: '高' | '中' | '低';
  message: string;
}
```

### Suggestion

```typescript
interface Suggestion {
  type: 'action' | 'consideration';
  message: string;
  priority: number;          // Lower = higher priority
}
```

---

## Checking Flow

```
Input Intent
     │
     ▼
┌─────────────────┐
│  Layer 1:       │
│  Principles     │ ──── HARD_BLOCK? ──→ Return BLOCKED
│  (MANDATORY)    │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Layer 2:       │
│  Patterns       │ ──── High confidence failure? ──→ Return WARNING
│  (WARNING)      │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Layer 3:       │
│  Traps          │ ──── High severity traps? ──→ Return WARNING
│  (ADVISORY)     │
└─────────────────┘
     │
     ▼
   Return PASS
```

---

## Performance

| Method | Target | Typical |
|--------|--------|---------|
| `check()` | <1000ms | ~200ms |
| `quickCheck()` | <300ms | ~50ms |

---

## Principles

The system checks against 5 MANDATORY principles:

| ID | Name | Level |
|----|------|-------|
| P1 | Search official resources first | HARD_BLOCK |
| P2 | Functional verification required | HARD_BLOCK |
| P3 | Do not repeat failures | HARD_BLOCK |
| P4 | Do not hide exceptions | HARD_BLOCK |
| P5 | Understand user expectations | MANDATORY |

---

## Singleton Export

A singleton instance is exported for convenience:

```typescript
import { gatewayGuard } from 'reflectguard';

const result = await gatewayGuard.check('Task description');
```
