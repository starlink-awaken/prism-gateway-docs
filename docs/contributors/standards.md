# 项目标准

ReflectGuard 项目的代码和文档标准。

## 代码标准

### TypeScript

#### 严格模式

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

#### 类型注解

```typescript
// ✅ 函数必须有返回类型
function add(a: number, b: number): number {
  return a + b;
}

// ❌ 缺少返回类型
function add(a: number, b: number) {
  return a + b;
}
```

#### 避免使用 any

```typescript
// ❌ 使用 any
function process(data: any) {
  return data.value;
}

// ✅ 使用泛型或具体类型
function process<T extends { value: string }>(data: T): string {
  return data.value;
}
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类 | PascalCase | `GatewayGuard` |
| 接口 | PascalCase | `CheckResult` |
| 函数 | camelCase | `checkIntent()` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| 私有成员 | _前缀 | `_internalState` |

### 文件组织

```
src/
├── core/
│   ├── gateway/
│   │   ├── GatewayGuard.ts
│   │   ├── GatewayGuard.test.ts
│   │   └── types.ts
│   └── retrospective/
├── integration/
├── infrastructure/
└── types/
```

## 测试标准

### 测试覆盖率

| 模块 | 最低覆盖率 | 推荐覆盖率 |
|------|-----------|-----------|
| 核心 | 90% | 95% |
| 集成 | 80% | 85% |
| 工具 | 85% | 90% |

### 测试组织

```typescript
describe('GatewayGuard', () => {
  describe('check', () => {
    beforeEach(() => {
      // 设置
    });

    it('should pass for valid intent', async () => {
      // Arrange
      const intent = 'valid intent';

      // Act
      const result = await guard.check(intent);

      // Assert
      expect(result.status).toBe('PASSED');
    });
  });
});
```

## 文档标准

### JSDoc 注释

```typescript
/**
 * 检查任务意图
 *
 * @param intent - 任务描述
 * @param context - 可选上下文
 * @returns 检查结果
 *
 * @example
 * ```ts
 * const result = await gateway.check("test");
 * ```
 */
async check(intent: string, context?: CheckContext): Promise<CheckResult>
```

### README 标准

每个模块目录应包含 README.md：

```markdown
# 模块名称

简要描述模块功能。

## 使用

\`\`\`typescript
// 代码示例
\`\`\`

## API

| 方法 | 说明 |
|------|------|
| method1 | 说明1 |
| method2 | 说明2 |

## 测试

\`\`\`bash
bun test src/module
\`\`\`
```

## 提交标准

### 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具

### 示例

```
feat(gateway): add pattern matching

Implement pattern matching for gateway checks.

- Add PatternMatcher class
- Integrate with GatewayGuard
- Add tests

Closes #123
```

## PR 标准

### PR 标题

```
<type>: <description>
```

示例：
- `feat: add pattern matching support`
- `fix: resolve timeout issue`
- `docs: update API reference`

### PR 描述

```markdown
## 变更类型
- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor

## 描述
简要描述变更内容

## 相关 Issue
关闭 #(issue)

## 测试
- [ ] 单元测试
- [ ] 集成测试
- [ ] 手动测试

## 检查清单
- [ ] 代码规范
- [ ] 测试覆盖
- [ ] 文档更新
```

## 版本控制标准

### 语义化版本

- **主版本（Major）**：不兼容的 API 变更
- **次版本（Minor）**：向后兼容的功能新增
- **修订版（Patch）**：向后兼容的问题修复

### CHANGELOG 格式

```markdown
## [1.2.0] - 2026-02-07

### Added
- Pattern matching support
- Analytics dashboard

### Fixed
- Timeout issue in gateway checks
- Memory leak in cache

### Changed
- Improved error messages

### Deprecated
- Old API method (will remove in 2.0)
```

## 代码质量标准

### 复杂度

| 指标 | 限制 |
|------|------|
| 圈复杂度 | <10 |
| 函数长度 | <50 行 |
| 参数数量 | <5 个 |
| 嵌套层级 | <4 层 |

### Lint 规则

项目使用 ESLint 和 Prettier：

```bash
# 检查
bun run lint

# 修复
bun run lint --fix

# 格式化
bun run format
```

---

**相关文档：**
- [代码审查规范](code-review.md)
- [工作流程](workflow.md)
- [开发指南](../developers/coding-standards.md)

---

**最后更新:** 2026-02-07
