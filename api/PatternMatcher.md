# PatternMatcher API Reference

## Overview

PatternMatcher matches task intents against 32 success/failure patterns to identify risks and opportunities.

## Matching Strategy

1. Load success and failure patterns from MemoryStore
2. Calculate match score for each pattern
3. Success pattern threshold: 0.5
4. Failure pattern threshold: 0.6
5. Return results sorted by confidence

**Note:** Currently uses simple keyword matching. Future versions may use vector similarity.

## Class: PatternMatcher

### Constructor

```typescript
constructor(memoryStore: MemoryStore)
```

Creates a new PatternMatcher instance.

**Parameters:**
- `memoryStore`: MemoryStore instance for accessing patterns

**Example:**
```typescript
import { PatternMatcher, MemoryStore } from 'reflectguard';

const store = new MemoryStore();
const matcher = new PatternMatcher(store);
```

---

### Methods

#### match()

```typescript
async match(intent: string): Promise<Risk[]>
```

Match patterns against the task intent.

**Parameters:**
- `intent`: Task intent description

**Returns:** Array of risks (success/failure patterns)

**Example:**
```typescript
const risks = await matcher.match('Implement high-concurrency user login system');

risks.forEach(risk => {
  console.log(`[${risk.type}] ${risk.pattern_name}: ${(risk.confidence * 100).toFixed(0)}%`);
  console.log(`  ${risk.message}`);
});
```

---

#### getTopRisks()

```typescript
getTopRisks(risks: Risk[], n?: number): Risk[]
```

Get top N risks by confidence.

**Parameters:**
- `risks`: Array of risks
- `n` (optional): Number of risks to return (default: 3)

**Returns:** Top N risks

**Example:**
```typescript
const risks = await matcher.match('Task description');
const top3 = matcher.getTopRisks(risks, 3);

top3.forEach(risk => {
  console.log(`- ${risk.pattern_name} (${risk.confidence})`);
});
```

---

#### getFailureRisks()

```typescript
getFailureRisks(risks: Risk[]): Risk[]
```

Filter failure pattern risks.

**Parameters:**
- `risks`: Array of risks

**Returns:** Failure risks only

**Example:**
```typescript
const risks = await matcher.match('Task description');
const failures = matcher.getFailureRisks(risks);

console.log(`Found ${failures.length} failure risks`);
```

---

#### getSuccessRisks()

```typescript
getSuccessRisks(risks: Risk[]): Risk[]
```

Filter success pattern suggestions.

**Parameters:**
- `risks`: Array of risks

**Returns:** Success risks only

**Example:**
```typescript
const risks = await matcher.match('Task description');
const successes = matcher.getSuccessRisks(risks);

console.log(`Found ${successes.length} success patterns`);
```

---

## Types

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

### SuccessPattern

```typescript
interface SuccessPattern {
  id: string;
  dimension: string;
  name: string;
  maturity: number;           // 1-5
  impact: string;
  description: string;
  features?: string[];
  effects?: string[];
  constraints?: string;
  benefits?: string[];
  weight: number;
}
```

### FailurePattern

```typescript
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

---

## Example: Complete Workflow

```typescript
import { PatternMatcher, MemoryStore } from 'reflectguard';

const store = new MemoryStore();
const matcher = new PatternMatcher(store);

// Match patterns
const intent = 'Implement high-concurrency distributed cache system';
const risks = await matcher.match(intent);

// Analyze results
console.log('=== Pattern Matching Results ===');
console.log(`Total matches: ${risks.length}\n`);

// Success patterns (opportunities)
const successes = matcher.getSuccessRisks(risks);
if (successes.length > 0) {
  console.log('Success Patterns (opportunities):');
  successes.forEach(risk => {
    console.log(`  ✓ ${risk.pattern_name} (${(risk.confidence * 100).toFixed(0)}%)`);
    console.log(`    ${risk.message}`);
  });
}

// Failure patterns (risks)
const failures = matcher.getFailureRisks(risks);
if (failures.length > 0) {
  console.log('\nFailure Patterns (risks):');
  failures.forEach(risk => {
    console.log(`  ⚠ ${risk.pattern_name} (${(risk.confidence * 100).toFixed(0)}%)`);
    console.log(`    ${risk.message}`);
  });
}

// Top 3 overall
console.log('\nTop 3 Matches:');
matcher.getTopRisks(risks, 3).forEach((risk, i) => {
  const icon = risk.type === 'success' ? '✓' : '⚠';
  console.log(`  ${i + 1}. ${icon} ${risk.pattern_name}: ${(risk.confidence * 100).toFixed(0)}%`);
});
```

---

## Match Score Calculation

```typescript
// Simplified keyword matching algorithm
function calculateMatchScore(intent: string, pattern: SuccessPattern | FailurePattern): number {
  const keywords = extractKeywords(pattern);
  let matchedCount = 0;

  for (const keyword of keywords) {
    if (intent.toLowerCase().includes(keyword.toLowerCase())) {
      matchedCount++;
    }
  }

  return keywords.length > 0 ? matchedCount / keywords.length : 0;
}
```

---

## Performance

| Method | Target | Typical |
|--------|--------|---------|
| `match()` | <500ms | ~100ms |

---

## Pattern Categories

### Success Patterns (16 patterns)

Organized by dimensions:
- **Technical Architecture**: Design patterns, system design
- **Process Management**: Agile, planning, estimation
- **Quality Assurance**: Testing, code review, documentation
- **Team Collaboration**: Communication, knowledge sharing

### Failure Patterns (16 patterns)

Categorized by severity:
- **High severity**: Critical issues that cause project failure
- **Medium severity**: Significant issues that impact quality
- **Low severity**: Minor issues that cause inconvenience

---

## Integration Example

```typescript
import { PatternMatcher, MemoryStore, GatewayGuard } from 'reflectguard';

const store = new MemoryStore();
const matcher = new PatternMatcher(store);
const guard = new GatewayGuard(store);

async function analyzeTask(intent: string) {
  // First, check principles
  const checkResult = await guard.check(intent);

  // Then, match patterns
  const risks = await matcher.match(intent);

  // Combine results
  const report = {
    intent,
    status: checkResult.status,
    violations: checkResult.violations,
    successPatterns: matcher.getSuccessRisks(risks),
    failurePatterns: matcher.getFailureRisks(risks),
    recommendations: checkResult.suggestions
  };

  return report;
}
```
