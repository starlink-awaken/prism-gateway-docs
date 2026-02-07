# DataExtractor API Reference

## Overview

DataExtractor is a 7-dimension data extraction engine that extracts structured data from conversation history and task context.

## Seven Dimensions

1. **Principles Dimension**: Violated principles and violations
2. **Patterns Dimension**: Matched success/failure patterns
3. **Benchmarks Dimension**: Performance, quality, and capability assessments
4. **Traps Dimension**: Identified common pitfalls
5. **Success Dimension**: Success factors and their impact
6. **Tools Dimension**: Used technologies and tools
7. **Data Dimension**: Key data points and metrics

## Class: DataExtractor

### Constructor

```typescript
constructor(config?: Partial<DataExtractorConfig>)
```

Creates a new DataExtractor instance.

**Parameters:**
- `config` (optional): Configuration options

**Example:**
```typescript
import { DataExtractor } from 'reflectguard';

const extractor = new DataExtractor({
  min_confidence_threshold: 0.7,
  max_processing_time: 300,
  context_window_size: 10
});
```

---

### Methods

#### extractDimensions()

```typescript
async extractDimensions(
  sessionId: string,
  messages: Message[],
  context?: Record<string, any>
): Promise<ExtractionResult>
```

Extract 7 dimensions from conversation history (convenience method).

**Parameters:**
- `sessionId`: Session identifier
- `messages`: Array of messages
- `context` (optional): Additional context information

**Returns:** Extraction result with all 7 dimensions

**Example:**
```typescript
const result = await extractor.extractDimensions(
  'session_123',
  [
    { id: '1', role: 'user', content: 'Implement login', timestamp: '...' },
    { id: '2', role: 'assistant', content: 'I will implement', timestamp: '...' }
  ],
  { project: 'my-project' }
);

console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
console.log(`Summary: ${result.summary}`);
```

---

#### extractFromHistory()

```typescript
async extractFromHistory(
  history: ConversationHistory,
  context?: Record<string, any>
): Promise<ExtractionResult>
```

Extract 7 dimensions from a conversation history object.

**Parameters:**
- `history`: Conversation history object
- `context` (optional): Additional context information

**Returns:** Extraction result with all 7 dimensions

**Example:**
```typescript
const history: ConversationHistory = {
  id: 'hist_1',
  session_id: 'session_123',
  messages: [
    { id: '1', role: 'user', content: '...', timestamp: '...' }
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const result = await extractor.extractFromHistory(history);
```

---

#### updateConfig()

```typescript
updateConfig(newConfig: Partial<DataExtractorConfig>): void
```

Update extractor configuration.

**Parameters:**
- `newConfig`: Partial configuration object

**Example:**
```typescript
extractor.updateConfig({
  min_confidence_threshold: 0.8,
  enable_dimension_weighting: false
});
```

---

#### getConfig()

```typescript
getConfig(): DataExtractorConfig
```

Get current configuration.

**Returns:** Current configuration object

**Example:**
```typescript
const config = extractor.getConfig();
console.log('Min confidence:', config.min_confidence_threshold);
```

---

## Types

### ExtractionResult

```typescript
interface ExtractionResult {
  id: string;
  session_id: string;
  timestamp: string;
  processing_time: number;      // milliseconds
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
  confidence: number;           // 0-1
}
```

### Message

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

### ConversationHistory

```typescript
interface ConversationHistory {
  id: string;
  session_id: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}
```

### ExtractedDimension (Base)

```typescript
interface ExtractedDimension {
  name: string;
  confidence: number;           // 0-1
  items: any[];
  evidence: string[];
}
```

### PrinciplesDimension

```typescript
interface PrinciplesDimension extends ExtractedDimension {
  name: 'Principles';
  items: Array<{
    principle_id: string;
    principle_name: string;
    severity: 'MANDATORY' | 'HARD_BLOCK';
    message: string;
    context: string;
  }>;
}
```

### PatternsDimension

```typescript
interface PatternsDimension extends ExtractedDimension {
  name: 'Patterns';
  items: Array<{
    pattern_id: string;
    pattern_name: string;
    type: 'success' | 'failure';
    confidence: number;
    context: string;
  }>;
}
```

### BenchmarksDimension

```typescript
interface BenchmarksDimension extends ExtractedDimension {
  name: 'Benchmarks';
  items: Array<{
    benchmark_id: string;
    benchmark_name: string;
    score: number;              // 0-1
    level: 'excellent' | 'good' | 'average' | 'poor';
    context: string;
  }>;
}
```

### TrapsDimension

```typescript
interface TrapsDimension extends ExtractedDimension {
  name: 'Traps';
  items: Array<{
    trap_id: string;
    trap_name: string;
    severity: '高' | '中' | '低';
    context: string;
    suggestion: string;
  }>;
}
```

### SuccessDimension

```typescript
interface SuccessDimension extends ExtractedDimension {
  name: 'Success';
  items: Array<{
    factor_id: string;
    factor_name: string;
    impact: 'high' | 'medium' | 'low';
    context: string;
  }>;
}
```

### ToolsDimension

```typescript
interface ToolsDimension extends ExtractedDimension {
  name: 'Tools';
  items: Array<{
    tool_id: string;
    tool_name: string;
    purpose: string;
    usage_context: string;
  }>;
}
```

### DataDimension

```typescript
interface DataDimension extends ExtractedDimension {
  name: 'Data';
  items: Array<{
    data_id: string;
    data_name: string;
    category: string;
    importance: 'critical' | 'important' | 'normal';
    value: any;
    context: string;
  }>;
}
```

### DataExtractorConfig

```typescript
interface DataExtractorConfig {
  min_confidence_threshold: number;       // Default: 0.6
  max_processing_time: number;            // Default: 300 (ms)
  enable_dimension_weighting: boolean;    // Default: true
  context_window_size: number;            // Default: 10
  keyword_boost_factor: number;           // Default: 1.2
}
```

---

## Extraction Flow

```
Input Messages
     │
     ▼
┌─────────────────┐
│  Preprocess     │
│  - Filter empty  │
│  - Apply window │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Extract 7      │
│  Dimensions     │ (Parallel)
│  ┌───────────┐  │
│  │Principles │  │
│  │Patterns   │  │
│  │Benchmarks │  │
│  │Traps      │  │
│  │Success    │  │
│  │Tools      │  │
│  │Data       │  │
│  └───────────┘  │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Calculate      │
│  Confidence     │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Generate       │
│  Summary        │
└─────────────────┘
     │
     ▼
   Return Result
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `min_confidence_threshold` | number | 0.6 | Minimum confidence for including items |
| `max_processing_time` | number | 300 | Maximum processing time in ms |
| `enable_dimension_weighting` | boolean | true | Enable dimension confidence weighting |
| `context_window_size` | number | 10 | Number of recent messages to consider |
| `keyword_boost_factor` | number | 1.2 | Boost factor for keyword matches |

---

## Performance

| Metric | Target | Typical |
|--------|--------|---------|
| Processing time | <300ms | ~150ms |
| Memory usage | <50MB | ~20MB |

---

## Example: Full Workflow

```typescript
import { DataExtractor } from 'reflectguard';

// Create extractor
const extractor = new DataExtractor({
  min_confidence_threshold: 0.7,
  context_window_size: 15
});

// Prepare messages
const messages = [
  { id: '1', role: 'user', content: 'Implement user login with OAuth', timestamp: '...' },
  { id: '2', role: 'assistant', content: 'I will implement OAuth2 login', timestamp: '...' },
  { id: '3', role: 'user', content: 'Add password reset feature', timestamp: '...' },
  { id: '4', role: 'assistant', content: 'Added reset functionality', timestamp: '...' }
];

// Extract dimensions
const result = await extractor.extractDimensions('session_abc', messages, {
  project: 'auth-system',
  phase: 'Development'
});

// Analyze results
console.log('=== Extraction Summary ===');
console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
console.log(`Processing time: ${result.processing_time}ms`);
console.log(`\nSummary:\n${result.summary}`);

// Check each dimension
for (const [name, dimension] of Object.entries(result.dimensions)) {
  console.log(`\n${name}:`);
  console.log(`  Confidence: ${(dimension.confidence * 100).toFixed(0)}%`);
  console.log(`  Items: ${dimension.items.length}`);
  dimension.evidence.forEach(e => console.log(`  - ${e}`));
}
```

---

## Singleton Export

A singleton instance is exported for convenience:

```typescript
import { dataExtractor } from 'reflectguard';

const result = await dataExtractor.extractDimensions('session_123', messages);
```
