# PRISM-Gateway API Documentation

Version: 1.0.0

## Overview

PRISM-Gateway is a unified 7-dimension retrospective and gateway checking system for AI projects. It provides:

- **Gateway Guard**: Three-layer violation checking mechanism (principles, patterns, traps)
- **7-Dimension Data Extraction**: Extract structured data from conversation history
- **Multi-mode Retrospective**: Support for quick, standard, and deep retrospective modes
- **MEMORY Storage**: Three-tier architecture for hot, warm, and cold data

## Installation

```bash
bun add prism-gateway
```

## Quick Start

```typescript
import { prismGateway } from 'prism-gateway';

// Execute a quick retrospective
const retroResult = await prismGateway.quickRetro('my-project', {
  phase: 'Development',
  history: []
});

// Check task intent
const checkResult = await prismGateway.checkIntent('Implement user login');
console.log(checkResult.status); // PASS | WARNING | BLOCKED
```

## Core Modules

### GatewayGuard

The core violation checking engine with three layers:

1. **Layer 1**: Principle checking (MANDATORY) - Based on 5 behavioral guidelines
2. **Layer 2**: Pattern matching (WARNING) - Identify success/failure patterns
3. **Layer 3**: Trap detection (ADVISORY) - Detect common pitfalls

#### Usage

```typescript
import { gatewayGuard } from 'prism-gateway';

const result = await gatewayGuard.check('Implement user login feature', {
  phase: 'Development'
});

if (result.status === 'BLOCKED') {
  console.log('Task blocked:', result.violations);
} else if (result.status === 'WARNING') {
  console.log('Warnings:', result.risks);
} else {
  console.log('Check passed');
}

// Quick check for performance-sensitive scenarios
const isAllowed = await gatewayGuard.quickCheck('Simple task');
```

#### API

- `check(intent: string, context?: CheckContext): Promise<CheckResult>` - Full check with all three layers
- `quickCheck(intent: string): Promise<boolean>` - Quick principle-only check
- `formatResult(result: CheckResult): string` - Format result as human-readable text

### MemoryStore

Three-tier MEMORY storage architecture:

- **Level-1 Hot**: Hot data (principles, patterns), response time <100ms
- **Level-2 Warm**: Warm data (retro records, violations), readable and writable
- **Level-3 Cold**: Cold data (SOPs, checklists, templates), read-only

#### Usage

```typescript
import { memoryStore } from 'prism-gateway';

// Get all principles
const principles = await memoryStore.getPrinciples();

// Save retro record
await memoryStore.saveRetroRecord({
  id: 'retro_1',
  timestamp: new Date().toISOString(),
  type: 'quick',
  project: 'my-project',
  duration: 5000,
  summary: 'Completed login feature development',
  lessons: ['Write tests before implementation'],
  improvements: ['Increase unit test coverage']
});

// Get recent violations
const violations = await memoryStore.getRecentViolations(10);

// Get storage statistics
const stats = await memoryStore.getStats();
```

#### API

##### Hot Data Access (<100ms response)

- `getPrinciples(): Promise<Principle[]>` - Get all principles (cached 1min)
- `getPrincipleById(id: string): Promise<Principle | undefined>` - Get single principle
- `getSuccessPatterns(): Promise<SuccessPattern[]>` - Get success patterns
- `getFailurePatterns(): Promise<FailurePattern[]>` - Get failure patterns
- `searchPatterns(keyword: string): Promise<{success, failure}>` - Search patterns

##### Warm Data Access (readable/writable)

- `saveRetroRecord(record: RetroRecord): Promise<void>` - Save retro record
- `getRetroRecord(id: string): Promise<RetroRecord | null>` - Get retro record
- `recordViolation(violation: ViolationRecord): Promise<void>` - Record violation
- `getRecentViolations(limit?: number): Promise<ViolationRecord[]>` - Get recent violations
- `getRecentRetros(projectId: string, limit?: number): Promise<RetroRecord[]>` - Get retrospectives

##### Cold Data Access (read-only)

- `readSOP(name: string): Promise<string>` - Read SOP document
- `readChecklist(name: string): Promise<string>` - Read checklist
- `readTemplate(name: string): Promise<string>` - Read template
- `listTemplates(): Promise<string[]>` - List available templates

##### Utilities

- `clearCache(): void` - Clear all caches
- `getStats(): Promise<Statistics>` - Get storage statistics

### DataExtractor

7-dimension data extractor from conversation history:

1. **Principles Dimension**: Violated principles
2. **Patterns Dimension**: Matched patterns
3. **Benchmarks Dimension**: Capability assessments
4. **Traps Dimension**: Identified traps
5. **Success Dimension**: Success factors
6. **Tools Dimension**: Used tools and technologies
7. **Data Dimension**: Key data points

#### Usage

```typescript
import { dataExtractor } from 'prism-gateway';

const result = await dataExtractor.extractDimensions(
  'session_123',
  [
    { id: '1', role: 'user', content: 'Implement login', timestamp: '...' },
    { id: '2', role: 'assistant', content: 'I will implement it', timestamp: '...' }
  ],
  { project: 'my-project' }
);

console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
console.log(`Summary: ${result.summary}`);
```

#### API

- `extractDimensions(sessionId: string, messages: Message[], context?: Record<string, any>): Promise<ExtractionResult>` - Extract 7 dimensions
- `updateConfig(newConfig: Partial<DataExtractorConfig>): void` - Update configuration
- `getConfig(): DataExtractorConfig` - Get current configuration

#### Configuration Options

- `min_confidence_threshold`: Minimum confidence threshold (default: 0.6)
- `max_processing_time`: Maximum processing time in ms (default: 300)
- `enable_dimension_weighting`: Enable dimension weighting (default: true)
- `context_window_size`: Context window size (default: 10)
- `keyword_boost_factor`: Keyword boost factor (default: 1.2)

### RetrospectiveCore

Retrospective orchestration engine with three modes:

- **Quick Mode**: 5 minutes, 4 phases (trigger, analysis, extraction, storage)
- **Standard Mode**: 25 minutes, 5 phases (+ reflection)
- **Deep Mode**: 60 minutes, 6 phases (+ planning)

#### Usage

```typescript
import { RetrospectiveCore, RetroMode, RetroTriggerType } from 'prism-gateway';

const retro = new RetrospectiveCore({ type: RetroMode.QUICK });

const execution = await retro.executeRetro({
  id: 'retro_123',
  projectId: 'my-project',
  triggerType: RetroTriggerType.MANUAL,
  context: {
    phase: 'Development',
    history: [],
    user_preferences: {}
  }
});

console.log(`Status: ${execution.status}`);
console.log(`Duration: ${execution.totalDuration}ms`);

// Switch mode
retro.switchMode(RetroMode.STANDARD);
```

#### API

- `executeRetro(taskInput: RetroTaskInput): Promise<RetroExecution>` - Execute retrospective
- `switchMode(mode: RetroMode): void` - Switch retrospective mode
- `getCurrentMode(): RetroMode` - Get current mode
- `getModeConfig(mode: RetroMode): RetroModeConfig` - Get mode configuration
- `shouldAutoTrigger(projectId: string): Promise<boolean>` - Check if auto-trigger needed
- `getRetroStats(): Promise<RetroStats>` - Get retrospective statistics

### QuickReview

Simplified interface for quick 5-minute retrospectives.

#### Usage

```typescript
import { QuickReview } from 'prism-gateway';

const qr = new QuickReview();

const result = await qr.review({
  projectId: 'my-project',
  context: 'Completed API interface development',
  tags: ['api', 'backend'],
  metadata: { phase: 'Development' }
});

console.log(qr.toCliOutput(result));
```

#### API

- `review(input: QuickReviewInput): Promise<QuickReviewResult>` - Execute quick review
- `cliReview(projectId: string, context: string): Promise<QuickReviewResult>` - CLI-friendly interface
- `toCliOutput(result: QuickReviewResult): string` - Format as CLI output
- `toJsonOutput(result: QuickReviewResult): string` - Format as JSON
- `cleanup(): void` - Clean up resources

### PatternMatcher

Pattern matcher based on 32 success/failure patterns.

#### Usage

```typescript
import { PatternMatcher, MemoryStore } from 'prism-gateway';

const store = new MemoryStore();
const matcher = new PatternMatcher(store);

const risks = await matcher.match('Implement high-concurrency login system');

// Filter failure risks
const failures = matcher.getFailureRisks(risks);

// Get Top 3 risks
const top3 = matcher.getTopRisks(risks, 3);
```

#### API

- `match(intent: string): Promise<Risk[]>` - Match patterns
- `getTopRisks(risks: Risk[], n?: number): Risk[]` - Get top N risks
- `getFailureRisks(risks: Risk[]): Risk[]` - Filter failure risks
- `getSuccessRisks(risks: Risk[]): Risk[]` - Filter success pattern suggestions

### PrincipleChecker

Principle checker based on 5 MANDATORY behavioral guidelines.

#### Usage

```typescript
import { PrincipleChecker, MemoryStore } from 'prism-gateway';

const store = new MemoryStore();
const checker = new PrincipleChecker(store);

// Check full intent
const violations = await checker.check('Implement login', { phase: 'Development' });

// Check single principle
const violation = await checker.checkPrinciple('Implement login', 'P1');

// Generate suggestions
if (violations.length > 0) {
  const suggestions = checker.generateSuggestions(violations);
  console.log(suggestions);
}
```

#### API

- `check(intent: string, context?: { phase?: string }): Promise<Violation[]>` - Check intent
- `checkPrinciple(intent: string, principleId: string): Promise<Violation | null>` - Check single principle
- `generateSuggestions(violations: Violation[]): string[]` - Generate suggestions

### TrapDetector

Trap detector based on high-frequency failure patterns.

#### Usage

```typescript
import { TrapDetector, MemoryStore } from 'prism-gateway';

const store = new MemoryStore();
const detector = new TrapDetector(store);

const traps = await detector.detect('I hid the error message');

// Get high severity traps
const highSeverity = detector.getHighSeverityTraps(traps);
```

#### API

- `detect(intent: string): Promise<Trap[]>` - Detect traps
- `getHighSeverityTraps(traps: Trap[]): Trap[]` - Filter high severity traps

## Type Definitions

### CheckResult

```typescript
interface CheckResult {
  status: CheckStatus;        // PASS | WARNING | BLOCKED
  violations: Violation[];    // Principle violations
  risks: Risk[];              // Pattern risks
  traps: Trap[];              // Detected traps
  suggestions: Suggestion[];  // Actionable suggestions
  check_time: number;         // Check duration (ms)
  timestamp: string;          // ISO timestamp
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

### RetroRecord

```typescript
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
```

### ExtractionResult

```typescript
interface ExtractionResult {
  id: string;
  session_id: string;
  timestamp: string;
  processing_time: number;
  dimensions: {
    principles: PrinciplesDimension;
    patterns: PatternsDimension;
    benchmarks: BenchmarksDimension;
    traps: TrapsDimension;
    success: SuccessDimension;
    tools: ToolsDimension;
    data: DataDimension;
  };
  summary: string;
  confidence: number;         // 0-1
}
```

## CLI Usage

```bash
# Quick review
prism quick-review "my-project" "Completed feature development"

# Check intent
prism check "Implement user login"

# Show statistics
prism stats
```

## Performance Targets

| Component | Target | Actual |
|-----------|--------|--------|
| PrincipleChecker | <300ms | ~50ms |
| PatternMatcher | <500ms | ~100ms |
| TrapDetector | <200ms | ~30ms |
| GatewayGuard (full) | <1000ms | ~200ms |
| MemoryStore (hot) | <100ms | ~20ms |

## Storage Paths

Data is stored in `~/.prism-gateway/`:

```
~/.prism-gateway/
├── level-1-hot/          # Hot data
│   ├── principles.json
│   └── patterns/
│       ├── success_patterns.json
│       └── failure_patterns.json
├── level-2-warm/          # Warm data
│   ├── retros/
│   │   ├── index.jsonl
│   │   └── YYYY-MM/
│   │       └── {type}/{id}.json
│   └── violations.jsonl
└── level-3-cold/          # Cold data
    ├── sops/
    ├── checklists/
    └── templates/
```

## License

MIT

---

Generated by TypeDoc for PRISM-Gateway v1.0.0
