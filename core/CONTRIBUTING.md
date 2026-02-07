# Contributing to PRISM-Gateway

Thank you for your interest in contributing to PRISM-Gateway! This document provides guidelines and instructions for contributing to the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation Standards](#documentation-standards)
- [Getting Help](#getting-help)

---

## Code of Conduct

### Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to a positive environment:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior:
- The use of sexualized language or imagery
- Trolling or insulting/derogatory comments
- Personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission

---

## Getting Started

### Prerequisites

Before contributing, ensure you have the following installed:

- **Bun** >= 1.0.0
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **Node.js** >= 18.0.0 (for compatibility)

- **Git** for version control

### Installation

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/prism-gateway.git
   cd prism-gateway
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run tests to verify setup**
   ```bash
   bun test
   ```

4. **Start the development server**
   ```bash
   bun run dev
   ```

### Project Structure

```
prism-gateway/
├── src/
│   ├── api/                 # REST API and WebSocket server
│   ├── cli/                 # Command-line interface
│   ├── core/                # Core business logic
│   │   ├── analytics/       # Analytics module
│   │   ├── gateway/         # Gateway checking
│   │   └── retrospective/    # Retrospective logic
│   ├── infrastructure/      # Infrastructure services
│   │   ├── cache/           # Caching layer
│   │   ├── logging/         # Logging utilities
│   │   └── monitoring/      # Monitoring utilities
│   └── tests/               # Test files
├── docs/                    # Documentation
├── scripts/                 # Build and utility scripts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development Workflow

### 1. Create a Branch

Create a new branch for your work:

```bash
# Format: <type>/<short-description>
git checkout -b feature/add-real-time-notifications
git checkout -b fix/websocket-port-leak
git checkout -b docs/update-api-guide
```

**Branch Types:**
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test improvements
- `chore/` - Maintenance tasks

### 2. Make Changes

#### Follow TDD (Test-Driven Development)

1. **Write tests first** (RED phase)
2. **Implement code to pass tests** (GREEN phase)
3. **Refactor for clarity** (REFACTOR phase)

```bash
# Run tests continuously
bun test --watch

# Run specific test file
bun test src/tests/api/routes/analytics.test.ts
```

#### Development Commands

```bash
# Run the API server
bun run api

# Run with hot reload
bun run api:dev

# Run type checking
bun run type-check

# Run linting
bun run lint

# Fix lint issues automatically
bun run lint:fix

# Run security scan
bun run security
```

### 3. Commit Changes

Use conventional commit messages:

```bash
# Feature
git commit -m "feat: add real-time event broadcasting"

# Bug fix
git commit -m "fix: prevent WebSocket port leakage"

# Documentation
git commit -m "docs: update API usage examples"

# Refactoring
git commit -m "refactor: simplify AnalyticsService constructor"

# Test
git commit -m "test: add WebSocket integration tests"

# Chore
git commit -m "chore: update dependencies"
```

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Example:**
```
feat(analytics): add trend comparison analysis

- Implement compareTrends() method in TrendAnalyzer
- Add API endpoint for trend comparison
- Include 6 new unit tests

Closes #123
```

### 4. Sync with Upstream

Keep your fork up to date:

```bash
git fetch upstream
git rebase upstream/main
```

---

## Pull Request Process

### Before Submitting

1. **Run all tests**
   ```bash
   bun test
   bun run test:coverage
   ```

2. **Check coverage** (must be >= 85%)
   ```bash
   open coverage/index.html
   ```

3. **Run linting**
   ```bash
   bun run lint
   ```

4. **Type check**
   ```bash
   bun run type-check
   ```

### Creating a Pull Request

1. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR on GitHub**
   - Go to the repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template

3. **PR Title Format**
   ```
   feat: add real-time event broadcasting
   fix: prevent WebSocket port leakage
   docs: update API usage examples
   ```

4. **PR Description Template**

   ```markdown
   ## Summary
   Brief description of changes (1-2 sentences)

   ## Changes
   - [ ] Change 1
   - [ ] Change 2
   - [ ] Change 3

   ## Testing
   - [ ] Unit tests added/updated
   - [ ] Integration tests added/updated
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Tests pass (`bun test`)
   - [ ] Coverage >= 85%
   - [ ] No lint errors (`bun run lint`)
   - [ ] TypeScript compiles (`bun run type-check`)
   - [ ] Documentation updated
   - [ ] Commits follow conventional format

   ## Related Issues
   Closes #123
   Related to #456

   ## Screenshots (if applicable)
   [Attach screenshots for UI changes]
   ```

### Review Process

1. **Automated Checks**
   - All tests must pass
   - Coverage must be >= 85%
   - No lint errors
   - Type checking must succeed

2. **Code Review**
   - At least one maintainer approval required
   - Address all review comments
   - Update tests as needed

3. **Merge**
   - Squash and merge for small PRs
   - Rebase and merge for feature branches
   - Delete branch after merge

---

## Coding Standards

### TypeScript Standards

1. **Strict Mode**
   ```typescript
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "noImplicitOverride": true
     }
   }
   ```

2. **Type Safety**
   - Avoid `any` types
   - Use interfaces for object shapes
   - Provide explicit return types for public functions

3. **Interfaces vs Types**
   ```typescript
   // Use interfaces for objects
   interface User {
     id: string;
     name: string;
   }

   // Use types for unions, intersections, primitives
   type Status = 'pending' | 'active' | 'inactive';
   type ID = string | number;
   ```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `AnalyticsService` |
| Interfaces | PascalCase | `CheckResult` |
| Functions | camelCase | `checkIntent()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Private properties | camelCase with `#` | `#cache` |
| Files | camelCase.ts | `analyticsService.ts` |

### Code Organization

```typescript
// 1. Imports (grouped)
import { external } from 'external-package';
import { internal } from './internal.js';

// 2. Type definitions
interface Options {
  // ...
}

// 3. Constants
const DEFAULT_TIMEOUT = 5000;

// 4. Class definition
export class MyClass {
  // 4a. Static properties
  static instance: MyClass;

  // 4b. Private properties
  #cache: Map<string, any>;

  // 4c. Constructor
  constructor(options: Options) {
    // ...
  }

  // 4d. Public methods
  public async process(): Promise<void> {
    // ...
  }

  // 4e. Private methods
  #validate(): boolean {
    // ...
  }
}
```

### Error Handling

```typescript
// Always handle errors
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[fetchUser] Failed:', error);
    throw new Error(`Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

---

## Testing Requirements

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    // Setup before each test
    service = new AnalyticsService({ memoryStore: new MemoryStore() });
  });

  afterEach(() => {
    // Cleanup after each test
    service.destroy();
  });

  describe('getUsageMetrics', () => {
    it('should return usage metrics for a given period', async () => {
      // Arrange
      const period = TimePeriod.week();

      // Act
      const metrics = await service.getUsageMetrics(period);

      // Assert
      expect(metrics).toBeDefined();
      expect(metrics.totalRetros).toBeGreaterThanOrEqual(0);
    });

    it('should throw on invalid period', async () => {
      await expect(service.getUsageMetrics(null)).rejects.toThrow();
    });
  });
});
```

### Test Categories

1. **Unit Tests** - Test individual functions/classes
2. **Integration Tests** - Test module interactions
3. **E2E Tests** - Test complete workflows

### Coverage Requirements

- **Overall:** >= 85%
- **Critical paths:** 100%
- **New code:** >= 90%

### Running Tests

```bash
# All tests
bun test

# Watch mode
bun test --watch

# Coverage
bun test --coverage

# Specific pattern
bun test "analytics"

# Verbose output
bun test --verbose
```

---

## Documentation Standards

### Code Comments

```typescript
/**
 * Calculates the usage metrics for a given time period
 *
 * @param period - The time period to analyze
 * @returns Promise resolving to usage metrics
 * @throws {ValidationError} If period is invalid
 *
 * @example
 * ```typescript
 * const metrics = await service.getUsageMetrics(TimePeriod.week());
 * console.log(`Active users: ${metrics.activeUsers}`);
 * ```
 */
async getUsageMetrics(period: TimePeriod): Promise<UsageMetrics>
```

### README Updates

Update README.md when:
- Adding new features
- Changing configuration
- Modifying API endpoints
- Updating installation instructions

### API Documentation

Document all public API endpoints in `docs/api/`:
- Endpoint path and method
- Request parameters
- Response format
- Error codes
- Usage examples

---

## Getting Help

### Resources

- **Documentation:** See `/docs` directory
- **API Reference:** See `/api` directory
- **Examples:** See `/examples` directory

### Asking Questions

1. **GitHub Discussions** - For questions and ideas
2. **GitHub Issues** - For bug reports and feature requests
3. **Discord** (if available) - For real-time chat

### Reporting Bugs

When reporting bugs, include:
- OS and version
- Node/Bun version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages/stack traces

### Feature Requests

When suggesting features:
- Describe the use case
- Explain why it's needed
- Suggest a possible implementation
- Consider if it fits the project scope

---

## Development Tips

### Debugging

```bash
# Enable debug logging
DEBUG=* bun test

# Debug specific module
DEBUG=analytics:* bun test

# Use Node.js debugger
bun --inspect-brk test
```

### Performance Profiling

```bash
# Run with CPU profiling
bun --cpu-prof test

# Run with memory profiling
bun --heap-prof test
```

### Common Issues

**Issue:** Tests fail with import errors
```bash
# Solution: Clean and reinstall
rm -rf node_modules bun.lockb
bun install
```

**Issue:** Type errors after pulling changes
```bash
# Solution: Rebuild types
bun run type-check
```

**Issue:** Port already in use
```bash
# Solution: Find and kill process
lsof -ti:3000 | xargs kill -9
```

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes for significant contributions
- Eligible for contributor badges (when implemented)

Thank you for contributing to PRISM-Gateway!

---

**Last Updated:** 2026-02-07
**Maintained by:** PRISM-Gateway Team
**License:** MIT
