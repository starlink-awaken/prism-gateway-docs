# 编码规范

ReflectGuard 项目的编码规范和最佳实践。

## TypeScript 规范

### 严格模式

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 类型注解

```typescript
// ✅ 函数必须有返回类型
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ 缺少返回类型
function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### 接口 vs 类型

```typescript
// ✅ 使用接口定义对象结构
interface User {
  id: string;
  name: string;
  email: string;
}

// ✅ 使用类型定义联合/交叉
type Status = 'pending' | 'active' | 'inactive';
type ID = string | number;

// ✅ 类型可以用作类型别名
type UserWithStatus = User & { status: Status };
```

### 避免使用 any

```typescript
// ❌ 使用 any
function processData(data: any) {
  return data.value;
}

// ✅ 使用泛型
function processData<T extends { value: unknown }>(data: T): unknown {
  return data.value;
}

// ✅ 或使用具体类型
function processData(data: { value: string }): string {
  return data.value;
}
```

## 命名约定

### 文件命名

```
src/
├── GatewayGuard.ts         # PascalCase - 类文件
├── gatewayUtils.ts         # camelCase - 工具文件
├── types.ts                # camelCase - 类型文件
└── constants.ts            # camelCase - 常量文件
```

### 变量命名

```typescript
// ✅ 类名：PascalCase
class GatewayGuard {}

// ✅ 接口：PascalCase，可省略 I 前缀
interface CheckResult {}
// 或
interface ICheckResult {}  // 也可以

// ✅ 类型：PascalCase
type Status = 'pending' | 'active';

// ✅ 函数：camelCase
function checkIntent() {}
function getData() {}

// ✅ 常量：UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// ✅ 私有成员：_ 前缀
class MyClass {
  private _internalValue: string;
  #privateField: string;  // 或使用 #
}

// ✅ 布尔值：is/has/can 前缀
const isActive = true;
const hasPermission = false;
const canExecute = true;

// ❌ 避免
const active = true;
const permission = false;
```

## 代码组织

### 导入顺序

```typescript
// 1. Node 内置模块
import { promises as fs } from 'fs';
import path from 'path';

// 2. 第三方库
import { z } from 'zod';
import { Hono } from 'hono';

// 3. 内部模块
import { GatewayGuard } from './core/gateway/GatewayGuard.js';
import { CheckResult } from './types/index.js';

// 4. 类型导入（如果需要）
import type { Context } from './types/index.js';
```

### 类组织

```typescript
/**
 * 类描述
 */
export class MyClass {
  // 1. 静态属性
  static readonly DEFAULT_VALUE = 'default';

  // 2. 公共属性
  public value: string;

  // 3. 私有属性
  private _internal: string;

  // 4. 构造函数
  constructor(value: string) {
    this.value = value;
  }

  // 5. 公共方法
  public doSomething(): void {
    // ...
  }

  // 6. 私有方法
  private _internalMethod(): void {
    // ...
  }

  // 7. 静态方法
  static create(): MyClass {
    return new MyClass('default');
  }
}
```

## 注释规范

### JSDoc

所有公共 API 必须有 JSDoc 注释：

```typescript
/**
 * 检查任务意图是否符合行为准则
 *
 * @param intent - 任务描述，不能为空
 * @param context - 可选的上下文信息
 * @param context.project - 项目名称
 * @param context.priority - 优先级
 * @returns 检查结果，包含状态和违规详情
 *
 * @example
 * ```ts
 * const result = await gateway.check("实现用户登录");
 * if (result.status === 'BLOCKED') {
 *   console.log(result.violations);
 * }
 * ```
 *
 * @throws {ValidationError} 当 intent 为空时抛出
 * @throws {TimeoutError} 当检查超时时抛出
 */
async check(
  intent: string,
  context?: CheckContext
): Promise<CheckResult> {
  // 实现
}
```

### 内联注释

```typescript
// ✅ 解释"为什么"
// 使用 mkdir 实现原子操作，因为文件系统保证其原子性
await fs.mkdir(lockPath, { mode: 0o755 });

// ❌ 解释"是什么"（代码已经说明了）
// 创建目录
await fs.mkdir(lockPath);
```

### TODO 注释

```typescript
// TODO: [用户名] 需要添加缓存机制以提升性能
// FIXME: [用户名] 内存泄漏问题，需要在 2026-02-15 前修复
// HACK: [用户名] 临时解决方案，等待上游修复
// NOTE: [用户名] 重要提示
```

## 错误处理

```typescript
// ✅ 使用自定义错误类
export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

// ✅ 抛出具体错误
if (!intent) {
  throw new GatewayError('Intent cannot be empty', 'ERR_0001');
}

// ✅ 捕获特定错误
try {
  await gateway.check(intent);
} catch (error) {
  if (error instanceof GatewayError) {
    console.error(`Gateway error: ${error.code} - ${error.message}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## 异步处理

```typescript
// ✅ 使用 async/await
async function getData(): Promise<Data> {
  const response = await fetch(url);
  return response.json();
}

// ❌ 避免回调（除非必要）
function getData(callback: (data: Data) => void): void {
  fetch(url).then(res => res.json()).then(callback);
}

// ✅ 并行执行独立操作
async function processAll() {
  const [data1, data2, data3] = await Promise.all([
    fetch(url1),
    fetch(url2),
    fetch(url3)
  ]);
}

// ✅ 使用 Promise.race 超时
async function fetchWithTimeout(url: string, timeout: number) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}
```

## 安全规范

```typescript
// ✅ 验证输入
import { z } from 'zod';

const InputSchema = z.object({
  intent: z.string().min(1).max(1000),
  context: z.object({
    project: z.string().optional()
  }).optional()
});

function processInput(input: unknown) {
  const validated = InputSchema.parse(input);
  // 使用 validated
}

// ✅ 避免敏感信息泄露
function logError(error: Error) {
  // 移除路径中的用户信息
  const sanitized = error.message.replace(/\/Users\/[^\/]+/, '/Users/...');
  logger.error(sanitized);
}

// ✅ 使用常量时间比较（防止时序攻击）
import { timingSafeEqual } from 'crypto';

function compareTokens(a: string, b: string): boolean {
  return timingSafeEqual(
    Buffer.from(a),
    Buffer.from(b)
  );
}
```

---

**相关文档：**
- [贡献指南](contributing-guide.md)
- [测试指南](testing-guide.md)
- [架构设计](architecture.md)

---

**最后更新:** 2026-02-07
