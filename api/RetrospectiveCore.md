# RetrospectiveCore API Reference

## Overview

RetrospectiveCore is the retrospective orchestration engine supporting three retrospective modes:

- **Quick Mode**: 5 minutes, 4 phases (trigger, analysis, extraction, storage)
- **Standard Mode**: 25 minutes, 5 phases (+ reflection)
- **Deep Mode**: 60 minutes, 6 phases (+ planning)

## Class: RetrospectiveCore

### Constructor

```typescript
constructor(config?: Partial<RetroConfig>)
```

Creates a new RetrospectiveCore instance.

**Parameters:**
- `config` (optional): Configuration options

**Example:**
```typescript
import { RetrospectiveCore, RetroMode } from 'reflectguard';

// Quick mode (default)
const retro = new RetrospectiveCore();

// Standard mode
const retro = new RetrospectiveCore({ type: RetroMode.STANDARD });

// Deep mode
const retro = new RetrospectiveCore({ type: RetroMode.DEEP });

// Custom configuration
const retro = new RetrospectiveCore({
  type: RetroMode.QUICK,
  autoTrigger: true,
  triggerConditions: [
    { type: 'violation', threshold: 1 },
    { type: 'risk', threshold: 0.7 }
  ]
});
```

---

### Methods

#### executeRetro()

```typescript
async executeRetro(taskInput: RetroTaskInput): Promise<RetroExecution>
```

Execute the full retrospective flow.

**Parameters:**
- `taskInput`: Retro task input object

**Returns:** Retro execution result with status, metrics, and results

**Example:**
```typescript
const execution = await retro.executeRetro({
  id: 'retro_123',
  projectId: 'my-project',
  triggerType: RetroTriggerType.MANUAL,
  context: {
    phase: 'Development',
    history: [],
    user_preferences: {}
  },
  metadata: { mode: 'quick' }
});

console.log(`Status: ${execution.status}`);
console.log(`Duration: ${execution.totalDuration}ms`);
console.log(`Phase times:`, execution.metrics.phaseTimes);
```

---

#### switchMode()

```typescript
switchMode(mode: RetroMode): void
```

Switch retrospective mode.

**Parameters:**
- `mode`: Target retrospective mode

**Example:**
```typescript
retro.switchMode(RetroMode.STANDARD); // Switch to standard mode
retro.switchMode(RetroMode.DEEP);     // Switch to deep mode
```

---

#### getCurrentMode()

```typescript
getCurrentMode(): RetroMode
```

Get current retrospective mode.

**Returns:** Current mode

**Example:**
```typescript
const mode = retro.getCurrentMode();
console.log(`Current mode: ${mode}`);
```

---

#### getModeConfig()

```typescript
getModeConfig(mode: RetroMode): RetroModeConfig
```

Get configuration for a specific mode.

**Parameters:**
- `mode`: Mode to query

**Returns:** Mode configuration object

**Example:**
```typescript
const config = retro.getModeConfig(RetroMode.DEEP);
console.log(`Max duration: ${config.maxDuration}ms`);
console.log(`Phases:`, Object.keys(config.phases));
```

---

#### shouldAutoTrigger()

```typescript
async shouldAutoTrigger(projectId: string): Promise<boolean>
```

Check if auto-trigger conditions are met.

**Parameters:**
- `projectId`: Project ID to check

**Returns:** Whether auto-trigger should occur

**Example:**
```typescript
const shouldTrigger = await retro.shouldAutoTrigger('my-project');
if (shouldTrigger) {
  console.log('Auto-trigger conditions met');
}
```

---

#### getRetroStats()

```typescript
async getRetroStats(): Promise<{
  totalRetros: number;
  avgDuration: number;
  successRate: number;
  phaseDurations: Record<RetroPhase, number>;
}>
```

Get retrospective statistics.

**Returns:** Statistics object

**Example:**
```typescript
const stats = await retro.getRetroStats();
console.log(`Total retros: ${stats.totalRetros}`);
console.log(`Average duration: ${stats.avgDuration}ms`);
console.log(`Success rate: ${(stats.successRate * 100).toFixed(0)}%`);
```

---

## Retrospective Modes

### Quick Mode (5 minutes)

```
Trigger (30s) → Analysis (2min) → Extraction (1min) → Storage (2min)
```

- Analysis depth: shallow
- Reflection: disabled
- Planning: disabled

### Standard Mode (25 minutes)

```
Trigger (1min) → Analysis (10min) → Extraction (5min) → Reflection (5min) → Storage (4min)
```

- Analysis depth: medium
- Reflection: enabled
- Planning: disabled

### Deep Mode (60 minutes)

```
Trigger (2min) → Analysis (20min) → Extraction (10min) → Reflection (15min) → Planning (8min) → Storage (5min)
```

- Analysis depth: deep
- Reflection: enabled
- Planning: enabled

---

## Types

### RetroMode

```typescript
enum RetroMode {
  QUICK = 'quick',
  STANDARD = 'standard',
  DEEP = 'deep'
}
```

### RetroStatus

```typescript
enum RetroStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
```

### RetroPhase

```typescript
enum RetroPhase {
  TRIGGER = 'trigger',
  ANALYSIS = 'analysis',
  EXTRACTION = 'extraction',
  REFLECTION = 'reflection',
  PLANNING = 'planning',
  STORAGE = 'storage'
}
```

### RetroTriggerType

```typescript
enum RetroTriggerType {
  MANUAL = 'manual',
  AUTO = 'auto'
}
```

### RetroConfig

```typescript
interface RetroConfig {
  type: RetroMode;
  maxDuration: number;
  phases: Record<RetroPhase, { maxTime: number }>;
  autoTrigger: boolean;
  triggerConditions: RetroTriggerCondition[];
  modeConfig: RetroModeConfig;
}
```

### RetroTaskInput

```typescript
interface RetroTaskInput {
  id: string;
  projectId: string;
  triggerType: RetroTriggerType;
  context: {
    phase?: string;
    history?: any[];
    user_preferences?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}
```

### RetroExecution

```typescript
interface RetroExecution {
  id: string;
  taskId: string;
  status: RetroStatus;
  startTime: string;
  endTime?: string;
  phase: RetroPhase;
  duration: number;
  totalDuration: number;
  metrics: {
    totalDuration: number;
    phaseTimes: Record<string, number>;
    memoryUsage: number;
    cpuUsage: number;
  };
  results?: {
    analysis?: AnalysisResult;
    extraction?: ExtractionResult;
    reflection?: any;
    planning?: any;
    errors?: string[];
  };
}
```

### RetroModeConfig

```typescript
interface RetroModeConfig {
  type: RetroMode;
  maxDuration: number;
  phases: {
    trigger: { maxTime: number; description: string };
    analysis: { maxTime: number; description: string };
    extraction: { maxTime: number; description: string };
    storage: { maxTime: number; description: string };
    reflection?: { maxTime: number; description: string };
    planning?: { maxTime: number; description: string };
  };
  analysisDepth: 'shallow' | 'medium' | 'deep';
  enableReflection: boolean;
  enablePlanning: boolean;
}
```

### AnalysisResult

```typescript
interface AnalysisResult {
  successFactors: string[];
  failureReasons: string[];
  keyDecisions: string[];
  confidence: number;
  suggestions: string[];
}
```

### ExtractionResult

```typescript
interface ExtractionResult {
  reusableKnowledge: string[];
  improvementAreas: string[];
  lessonsLearned: string[];
  actionItems: string[];
}
```

---

## Example: Complete Workflow

```typescript
import { RetrospectiveCore, RetroMode, RetroTriggerType } from 'reflectguard';

// Initialize with standard mode
const retro = new RetrospectiveCore({ type: RetroMode.STANDARD });

// Execute retrospective
const execution = await retro.executeRetro({
  id: `retro_${Date.now()}`,
  projectId: 'my-project',
  triggerType: RetroTriggerType.MANUAL,
  context: {
    phase: 'Development',
    history: [
      { task: 'Feature A', status: 'success', notes: 'Completed on time' },
      { task: 'Feature B', status: 'warning', notes: 'Minor bugs found' }
    ],
    user_preferences: { focus: 'quality' }
  }
});

// Check results
if (execution.status === 'completed') {
  console.log('Retrospective completed successfully!');
  console.log(`Total duration: ${execution.totalDuration}ms`);

  if (execution.results) {
    console.log('\nSuccess Factors:', execution.results.analysis?.successFactors);
    console.log('Failure Reasons:', execution.results.analysis?.failureReasons);
    console.log('Action Items:', execution.results.extraction?.actionItems);
  }
} else {
  console.error('Retrospective failed:', execution.results?.errors);
}

// Check phase timings
console.log('\nPhase timings:');
for (const [phase, time] of Object.entries(execution.metrics.phaseTimes)) {
  console.log(`  ${phase}: ${time}ms`);
}
```

---

## Performance Targets

| Mode | Max Duration | Phase Budget |
|------|--------------|--------------|
| Quick | 5 min | See above |
| Standard | 25 min | See above |
| Deep | 60 min | See above |

---

## Singleton Export

A singleton instance is exported for convenience:

```typescript
import { retrospectiveCore } from 'reflectguard';

const execution = await retrospectiveCore.executeRetro(taskInput);
```
