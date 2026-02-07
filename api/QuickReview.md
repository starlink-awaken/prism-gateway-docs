# QuickReview API Reference

## Overview

QuickReview is a simplified interface for quick 5-minute retrospectives. It provides:

- One-click quick retrospective trigger
- Automatic 7-dimension data extraction
- Markdown report generation
- Save to MEMORY
- CLI-friendly output

## Class: QuickReview

### Constructor

```typescript
constructor()
```

Creates a new QuickReview instance.

**Example:**
```typescript
import { QuickReview } from 'reflectguard';

const qr = new QuickReview();
```

---

### Methods

#### review()

```typescript
async review(input: QuickReviewInput): Promise<QuickReviewResult>
```

Execute a quick retrospective.

**Parameters:**
- `input`: Quick review input parameters

**Returns:** Quick review result

**Example:**
```typescript
const result = await qr.review({
  projectId: 'my-project',
  context: 'Completed API interface development',
  tags: ['api', 'backend'],
  duration: 5 * 60 * 1000, // 5 minutes
  metadata: { phase: 'Development' }
});

console.log(`Status: ${result.status}`);
console.log(`Summary: ${result.summary}`);
console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
```

---

#### cliReview()

```typescript
async cliReview(projectId: string, context: string): Promise<QuickReviewResult>
```

CLI-friendly interface for quick review.

**Parameters:**
- `projectId`: Project ID
- `context`: Context description

**Returns:** Quick review result

**Example:**
```typescript
const result = await qr.cliReview('my-project', 'Completed login feature');
```

---

#### toCliOutput()

```typescript
toCliOutput(result: QuickReviewResult): string
```

Format result as CLI-friendly output.

**Parameters:**
- `result`: Quick review result

**Returns:** Formatted string

**Example:**
```typescript
const result = await qr.cliReview('my-project', 'Task completed');
console.log(qr.toCliOutput(result));
```

**Output:**
```
========================================
  QuickReview 快速复盘报告
========================================

项目: my-project
状态: ✅ 完成
时间: 2024-02-04 10:30:00
耗时: 5秒
置信度: 75%

----------------------------------------
  总结
----------------------------------------
项目: my-project; 上下文: Task completed

----------------------------------------
  学到的教训
----------------------------------------
1. 持续改进
2. 团队协作

========================================
```

---

#### toJsonOutput()

```typescript
toJsonOutput(result: QuickReviewResult): string
```

Format result as JSON string.

**Parameters:**
- `result`: Quick review result

**Returns:** JSON string

**Example:**
```typescript
const result = await qr.cliReview('my-project', 'Task completed');
const json = qr.toJsonOutput(result);
console.log(json);
```

---

#### cleanup()

```typescript
cleanup(): void
```

Clean up resources (caches, etc.).

**Example:**
```typescript
qr.cleanup();
```

---

## Types

### QuickReviewInput

```typescript
interface QuickReviewInput {
  projectId: string;
  context: string;
  duration?: number;           // milliseconds (optional)
  tags?: string[];
  metadata?: Record<string, any>;
}
```

### QuickReviewResult

```typescript
interface QuickReviewResult {
  id: string;
  projectId: string;
  status: 'completed' | 'failed';
  summary: string;
  report: string;              // Markdown report
  timestamp: string;
  saved: boolean;
  recordId?: string;
  lessons: string[];
  confidence: number;          // 0-1
  dimensions: {
    principles: any;
    patterns: any;
    benchmarks: any;
    traps: any;
    success: any;
    tools: any;
    data: any;
  };
  stats: {
    duration: number;
    phaseTimes: Record<string, number>;
  };
  metadata?: Record<string, any>;
}
```

---

## Report Format

The generated Markdown report includes:

- **Project Information**: ID, timestamp, context, tags
- **Summary**: Brief summary of the retrospective
- **7-Dimension Analysis**:
  - Principles Dimension
  - Patterns Dimension
  - Benchmarks Dimension
  - Traps Dimension
  - Success Dimension
  - Tools Dimension
  - Data Dimension
- **Lessons Learned**: Key takeaways
- **Improvement Suggestions**: Areas for improvement
- **Next Steps**: Actionable items

---

## Execution Flow

```
Input (projectId, context)
     │
     ▼
┌─────────────────┐
│  Prepare Task   │
│  Input          │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Extract 7      │
│  Dimensions     │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Execute Retro  │
│  (Quick Mode)   │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Generate       │
│  Markdown Report│
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Save to        │
│  MEMORY         │
└─────────────────┘
     │
     ▼
   Return Result
```

---

## Example: Complete Workflow

```typescript
import { QuickReview } from 'reflectguard';

const qr = new QuickReview();

// Execute quick review
const result = await qr.review({
  projectId: 'auth-system',
  context: 'Completed OAuth2 integration and user authentication',
  tags: ['authentication', 'oauth2', 'security'],
  metadata: {
    phase: 'Implementation',
    team: 'backend',
    sprint: 'Sprint 12'
  }
});

// Check status
if (result.status === 'completed') {
  console.log('✅ Quick review completed');
  console.log(`Summary: ${result.summary}`);

  // Display lessons
  console.log('\nLessons Learned:');
  result.lessons.forEach((lesson, i) => {
    console.log(`  ${i + 1}. ${lesson}`);
  });

  // Display report
  console.log('\n--- Markdown Report ---\n');
  console.log(result.report);

  // CLI output
  console.log('\n--- CLI Output ---\n');
  console.log(qr.toCliOutput(result));
} else {
  console.error('❌ Quick review failed');
}

// Clean up when done
qr.cleanup();
```

---

## CLI Usage Example

```typescript
import { QuickReview } from 'reflectguard';
import process from 'process';

const qr = new QuickReview();

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: quick-review <projectId> <context>');
    process.exit(1);
  }

  const [projectId, context] = args;

  const result = await qr.cliReview(projectId, context);
  console.log(qr.toCliOutput(result));

  qr.cleanup();
}

main();
```

---

## Singleton Export

A singleton instance is exported for convenience:

```typescript
import { quickReview } from 'reflectguard';

const result = await quickReview.review({
  projectId: 'my-project',
  context: 'Task completed'
});
```
