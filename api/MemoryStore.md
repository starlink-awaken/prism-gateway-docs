# MemoryStore API Reference

## Overview

MemoryStore is the core storage layer of ReflectGuard, implementing a three-tier MEMORY architecture:

- **Level-1 Hot**: Hot data (principles, patterns), response time <100ms, cached
- **Level-2 Warm**: Warm data (retro records, violations), readable and writable
- **Level-3 Cold**: Cold data (SOPs, checklists, templates), read-only

## Storage Paths

Data is stored in `~/.reflectguard/`:

```
~/.reflectguard/
├── level-1-hot/          # Hot data (<100ms response)
│   ├── principles.json
│   └── patterns/
│       ├── success_patterns.json
│       └── failure_patterns.json
├── level-2-warm/          # Warm data (readable/writable)
│   ├── retros/
│   │   ├── index.jsonl
│   │   └── YYYY-MM/
│   │       └── {type}/{id}.json
│   └── violations.jsonl
└── level-3-cold/          # Cold data (read-only)
    ├── sops/
    ├── checklists/
    └── templates/
```

## Class: MemoryStore

### Constructor

```typescript
constructor()
```

Creates a new MemoryStore instance.

**Example:**
```typescript
import { MemoryStore } from 'reflectguard';

const store = new MemoryStore();
```

---

### Level-1 Hot Data Access (<100ms response)

#### getPrinciples()

```typescript
async getPrinciples(): Promise<Principle[]>
```

Get all principles (hot data).

**Returns:** Array of principles

**Cache:** 1 minute

**Example:**
```typescript
const principles = await store.getPrinciples();
console.log(`Loaded ${principles.length} principles`);
```

---

#### getPrincipleById()

```typescript
async getPrincipleById(id: string): Promise<Principle | undefined>
```

Get a single principle by ID.

**Parameters:**
- `id`: Principle ID (e.g., "P1", "P2")

**Returns:** Principle object or undefined

**Example:**
```typescript
const principle = await store.getPrincipleById('P1');
if (principle) {
  console.log(principle.name);
}
```

---

#### getSuccessPatterns()

```typescript
async getSuccessPatterns(): Promise<SuccessPattern[]>
```

Get all success patterns (hot data).

**Returns:** Array of success patterns

**Cache:** 1 minute

**Example:**
```typescript
const patterns = await store.getSuccessPatterns();
```

---

#### getFailurePatterns()

```typescript
async getFailurePatterns(): Promise<FailurePattern[]>
```

Get all failure patterns (hot data).

**Returns:** Array of failure patterns

**Cache:** 1 minute

**Example:**
```typescript
const patterns = await store.getFailurePatterns();
```

---

#### searchPatterns()

```typescript
async searchPatterns(keyword: string): Promise<{
  success: SuccessPattern[];
  failure: FailurePattern[];
}>
```

Search patterns by keyword.

**Parameters:**
- `keyword`: Search keyword

**Returns:** Object with success and failure pattern arrays

**Example:**
```typescript
const results = await store.searchPatterns('authentication');
console.log(`Found ${results.success.length} success patterns`);
console.log(`Found ${results.failure.length} failure patterns`);
```

---

### Level-2 Warm Data Access (readable/writable)

#### saveRetroRecord()

```typescript
async saveRetroRecord(record: RetroRecord): Promise<void>
```

Save a retrospective record.

**Parameters:**
- `record`: Retro record object

**Storage Path:** `~/.reflectguard/level-2-warm/retros/YYYY-MM/{type}/{id}.json`

**Example:**
```typescript
await store.saveRetroRecord({
  id: 'retro_123',
  timestamp: new Date().toISOString(),
  type: 'quick',
  project: 'my-project',
  duration: 5000,
  summary: 'Completed login feature development',
  lessons: ['Write tests before implementation'],
  improvements: ['Increase unit test coverage']
});
```

---

#### getRetroRecord()

```typescript
async getRetroRecord(id: string): Promise<RetroRecord | null>
```

Get a retro record by ID.

**Parameters:**
- `id`: Retro record ID

**Returns:** Retro record or null

**Example:**
```typescript
const record = await store.getRetroRecord('retro_123');
if (record) {
  console.log(record.summary);
}
```

---

#### recordViolation()

```typescript
async recordViolation(violation: ViolationRecord): Promise<void>
```

Record a violation.

**Parameters:**
- `violation`: Violation record object

**Storage Path:** `~/.reflectguard/level-2-warm/violations.jsonl`

**Example:**
```typescript
await store.recordViolation({
  id: 'vio_123',
  timestamp: new Date().toISOString(),
  principle_id: 'P1',
  principle_name: 'Search First',
  severity: 'BLOCK',
  context: 'Direct analysis without search',
  action: 'Blocked'
});
```

---

#### getRecentViolations()

```typescript
async getRecentViolations(limit?: number): Promise<ViolationRecord[]>
```

Get recent violation records.

**Parameters:**
- `limit` (optional): Maximum number of records (default: 10)

**Returns:** Array of violation records

**Cache:** 30 seconds

**Example:**
```typescript
const violations = await store.getRecentViolations(5);
```

---

#### getRecentRetros()

```typescript
async getRecentRetros(projectId: string, limit?: number): Promise<RetroRecord[]>
```

Get recent retrospective records for a project.

**Parameters:**
- `projectId`: Project ID
- `limit` (optional): Maximum number of records (default: 10)

**Returns:** Array of retro records

**Example:**
```typescript
const retros = await store.getRecentRetros('my-project', 5);
```

---

### Level-3 Cold Data Access (read-only)

#### readSOP()

```typescript
async readSOP(name: string): Promise<string>
```

Read an SOP document.

**Parameters:**
- `name`: SOP name (without .md extension)

**Returns:** SOP document content

**Storage Path:** `~/.reflectguard/level-3-cold/sops/{name}.md`

**Example:**
```typescript
const sop = await store.readSOP('code-review');
```

---

#### readChecklist()

```typescript
async readChecklist(name: string): Promise<string>
```

Read a checklist document.

**Parameters:**
- `name`: Checklist name (without .md extension)

**Returns:** Checklist document content

**Storage Path:** `~/.reflectguard/level-3-cold/checklists/{name}.md`

**Example:**
```typescript
const checklist = await store.readChecklist('deployment');
```

---

#### readTemplate()

```typescript
async readTemplate(name: string): Promise<string>
```

Read a template document.

**Parameters:**
- `name`: Template name (without .md extension)

**Returns:** Template document content

**Storage Path:** `~/.reflectguard/level-3-cold/templates/{name}.md`

**Example:**
```typescript
const template = await store.readTemplate('retro-report');
```

---

#### listTemplates()

```typescript
async listTemplates(): Promise<string[]>
```

List all available templates.

**Returns:** Array of template names

**Example:**
```typescript
const templates = await store.listTemplates();
console.log('Available templates:', templates);
```

---

### Utilities

#### clearCache()

```typescript
clearCache(): void
```

Clear all in-memory caches.

**Example:**
```typescript
store.clearCache();
```

---

#### getStats()

```typescript
async getStats(): Promise<{
  principles: number;
  successPatterns: number;
  failurePatterns: number;
  retroRecords: number;
  violations: number;
  templates: number;
}>
```

Get storage statistics.

**Returns:** Object with various counts

**Example:**
```typescript
const stats = await store.getStats();
console.log(`Principles: ${stats.principles}`);
console.log(`Retro records: ${stats.retroRecords}`);
```

---

## Types

### Principle

```typescript
interface Principle {
  id: string;                  // e.g., "P1", "P2"
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

### RetroRecord

```typescript
interface RetroRecord {
  id: string;
  timestamp: string;
  type: 'quick' | 'standard' | 'deep';
  project: string;
  duration: number;           // milliseconds
  summary: string;
  lessons: string[];
  improvements: string[];
  violations?: string[];
}
```

### ViolationRecord

```typescript
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

---

## Performance

| Method | Target | Typical |
|--------|--------|---------|
| Hot data access | <100ms | ~20ms |
| Warm data read | <500ms | ~50ms |
| Warm data write | <1000ms | ~100ms |
| Cold data read | <200ms | ~50ms |

---

## Singleton Export

A singleton instance is exported for convenience:

```typescript
import { memoryStore } from 'reflectguard';

const principles = await memoryStore.getPrinciples();
```
