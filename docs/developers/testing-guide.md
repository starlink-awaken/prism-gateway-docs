# 测试指南

ReflectGuard 的测试规范和最佳实践。

## 测试策略

### 测试金字塔

```
        /\
       /  \        E2E Tests (5%)
      /____\       - 完整用户场景
     /      \      - 集成测试
    /        \     - 少量关键流程
   /          \
  /____________\
  Unit Tests    Integration Tests (20%)
  (75%)         - 模块间交互
  - 单元测试    - 真实依赖
  - 快速执行    - 数据流验证
  - 覆盖率高
```

## 测试类型

### 1. 单元测试

测试单个函数或类的行为。

```typescript
describe('GatewayGuard', () => {
  it('should load principles from file', async () => {
    const guard = new GatewayGuard(mockConfig);
    const principles = await guard.loadPrinciples();

    expect(principles).toBeDefined();
    expect(principles.length).toBeGreaterThan(0);
  });

  it('should detect security violation', async () => {
    const guard = new GatewayGuard(mockConfig);
    const result = await guard.check('use test key in production');

    expect(result.status).toBe('BLOCKED');
    expect(result.violations[0].category).toBe('security');
  });
});
```

### 2. 集成测试

测试多个模块协作。

```typescript
describe('Gateway Integration', () => {
  it('should check and record violation', async () => {
    const gateway = new GatewayGuard(config);
    const store = new MemoryStore();

    const result = await gateway.check('invalid intent');
    await store.recordViolation(result);

    const violations = await store.getViolations();
    expect(violations).toContainEqual(expect.objectContaining({
      category: 'security'
    }));
  });
});
```

### 3. E2E 测试

测试完整用户场景。

```typescript
describe('CLI E2E', () => {
  it('should complete full check workflow', async () => {
    // 运行 CLI 命令
    const { stdout } = await exec('prism check "test intent"');

    // 验证输出
    expect(stdout).toContain('PASSED');
  });
});
```

## 测试工具

### Bun Test

我们使用 Bun 内置的测试框架。

```bash
# 运行所有测试
bun test

# 运行特定文件
bun test src/core/gateway/GatewayGuard.test.ts

# 监听模式
bun test --watch

# 覆盖率
bun test --coverage
```

### 测试辅助

```typescript
// Mock 数据
const mockPrinciple = {
  id: 'test-001',
  category: 'security',
  statement: 'Test principle',
  level: 'MANDATORY' as const,
  enabled: true
};

// Mock 配置
const mockConfig = {
  principlesPath: '/tmp/test/principles.json',
  timeout: 5000
};

// Spy 函数
const spy = jest.spyOn(console, 'log');
// 或
const spy = vi.spyOn(console, 'log');
```

## 测试组织

### 文件结构

```
src/
├── core/
│   ├── gateway/
│   │   ├── GatewayGuard.ts
│   │   └── GatewayGuard.test.ts    # 同名测试文件
│   └── retrospective/
│       ├── RetrospectiveCore.ts
│       └── RetrospectiveCore.test.ts
└── tests/
    ├── integration/
    │   ├── api.test.ts
    │   └── mcp.test.ts
    └── e2e/
        └── scenarios.test.ts
```

### 测试分组

```typescript
describe('ModuleName', () => {
  describe('methodName', () => {
    beforeEach(() => {
      // 每个测试前执行
    });

    afterEach(() => {
      // 每个测试后执行
    });

    it('should do something expected', () => {
      // 测试正常情况
    });

    it('should handle edge case', () => {
      // 测试边界情况
    });

    it('should throw on invalid input', () => {
      // 测试错误情况
    });
  });
});
```

## 测试最佳实践

### 1. AAA 模式

```typescript
it('should calculate total correctly', () => {
  // Arrange (准备)
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 1 }
  ];

  // Act (执行)
  const total = calculateTotal(items);

  // Assert (断言)
  expect(total).toBe(25);
});
```

### 2. 描述性测试名称

```typescript
// ❌ 不好的命名
it('works', () => {});
it('test-1', () => {});

// ✅ 好的命名
it('should return BLOCKED status when MANDATORY principle is violated', () => {});
it('should cache results for 1 hour by default', () => {});
```

### 3. 测试隔离

```typescript
describe('MyClass', () => {
  let instance: MyClass;

  beforeEach(() => {
    // 每个测试使用新实例
    instance = new MyClass();
  });

  it('test 1', () => {
    // 不依赖其他测试
  });

  it('test 2', () => {
    // 不依赖其他测试
  });
});
```

### 4. Mock 外部依赖

```typescript
import { mock, instance } from 'ts-mockito';

describe('MyClass', () => {
  it('should use dependency', () => {
    const mockDep = mock(Dependency);
    when(mockDep.method()).thenReturn('value');

    const myClass = new MyClass(instance(mockDep));
    myClass.doSomething();

    verify(mockDep.method()).once();
  });
});
```

## 覆盖率目标

| 模块 | 目标覆盖率 | 当前覆盖率 |
|------|-----------|-----------|
| Core | 90% | 95% |
| Integration | 80% | 85% |
| CLI | 85% | 90% |
| Infrastructure | 85% | 88% |

## 性能测试

```typescript
describe('Performance', () => {
  it('should complete check within 100ms', async () => {
    const start = Date.now();
    await gateway.check('test intent');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should handle 1000 checks per second', async () => {
    const checks = Array(1000).fill(null).map((_, i) =>
      gateway.check(`test intent ${i}`)
    );

    const start = Date.now();
    await Promise.all(checks);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // 1秒内完成
  });
});
```

---

**相关文档：**
- [贡献指南](contributing-guide.md)
- [API 参考](api-reference.md)
- [架构设计](architecture.md)

---

**最后更新:** 2026-02-07
