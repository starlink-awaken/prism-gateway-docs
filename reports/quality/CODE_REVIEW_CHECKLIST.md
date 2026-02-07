# Code Review 检查清单

> **ReflectGuard 项目 Code Review 三道关卡检查清单**

**版本:** 1.0.0
**创建日期:** 2026-02-06
**所有者:** QATester Agent
**状态:** 活跃

---

## 目录

1. [三道关卡机制](#三道关卡机制)
2. [第一道关卡: CodeReviewer](#第一道关卡-codereviewer)
3. [第二道关卡: Pentester](#第二道关卡-pentester)
4. [第三道关卡: QATester](#第三道关卡-qatester)
5. [快速参考卡](#快速参考卡)
6. [常见问题](#常见问题)

---

## 三道关卡机制

### 流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Code Review 三道关卡流程                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                           │
│  │ 开发者提交 PR │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                  │
│         ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 第一道关卡: CodeReviewer (代码审查)                                   │  │
│  │                                                                       │  │
│  │  检查重点:                                                             │  │
│  │  - 代码风格和格式                                                       │  │
│  │  - 命名规范                                                             │  │
│  │  - 代码复杂度                                                           │  │
│  │  - 类型安全                                                             │  │
│  │  - 最佳实践                                                             │  │
│  │  - 测试覆盖                                                             │  │
│  │                                                                       │  │
│  │  通过条件: 所有代码规范检查项通过                                        │  │
│  └────────────────────────────┬─────────────────────────────────────────┘  │
│                               │ 通过                                         │
│                               ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 第二道关卡: Pentester (安全审查)                                      │  │
│  │                                                                       │  │
│  │  检查重点:                                                             │  │
│  │  - OWASP Top 10 检查                                                  │  │
│  │  - 注入漏洞                                                            │  │
│  │  - 认证授权                                                            │  │
│  │  - 敏感信息泄露                                                        │  │
│  │  - 依赖安全                                                            │  │
│  │                                                                       │  │
│  │  通过条件: 无严重和高危安全问题                                        │  │
│  └────────────────────────────┬─────────────────────────────────────────┘  │
│                               │ 通过                                         │
│                               ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 第三道关卡: QATester (质量审查)                                       │  │
│  │                                                                       │  │
│  │  检查重点:                                                             │  │
│  │  - 测试覆盖率                                                          │  │
│  │  - 测试质量                                                            │  │
│  │  - 功能验证                                                            │  │
│  │  - 文档完整性                                                          │  │
│  │  - 用户体验                                                            │  │
│  │                                                                       │  │
│  │  通过条件: 所有质量检查项通过                                          │  │
│  └────────────────────────────┬─────────────────────────────────────────┘  │
│                               │ 通过                                         │
│                               ▼                                             │
│                    ┌──────────────┐                                        │
│                    │ PR 批准合并  │                                        │
│                    └─────────────┘                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 角色职责

| 角色 | 主要职责 | 审查重点 | 批准权限 |
|------|----------|----------|----------|
| **CodeReviewer** | 代码质量审查 | 代码规范、类型安全、最佳实践 | 代码质量 |
| **Pentester** | 安全审查 | OWASP Top 10、漏洞扫描 | 安全合规 |
| **QATester** | 质量审查 | 测试覆盖、功能验证、文档 | 发布质量 |

---

## 第一道关卡: CodeReviewer

### 1. 代码风格和格式

#### 1.1 TypeScript 规范

- [ ] **严格模式合规**
  ```typescript
  // tsconfig.json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitOverride": true
    }
  }
  ```
  - [ ] 无 `any` 类型（除非有明确注释说明原因）
  - [ ] 无类型断言滥用
  - [ ] 正确使用 `unknown` 替代 `any`

- [ ] **命名约定**
  ```typescript
  // 类名: PascalCase
  class GatewayGuard {}

  // 接口: PascalCase
  interface CheckResult {}

  // 函数: camelCase
  function checkIntent() {}

  // 常量: UPPER_SNAKE_CASE
  const MAX_RETRIES = 3;

  // 私有成员: _prefix
  private _internalState: string;
  ```
  - [ ] 类名使用 PascalCase
  - [ ] 函数和变量使用 camelCase
  - [ ] 常量使用 UPPER_SNAKE_CASE
  - [ ] 私有成员使用 `_` 前缀
  - [ ] 文件名使用 camelCase.ts

- [ ] **代码格式**
  - [ ] 使用 2 空格缩进
  - [ ] 行长度 <= 100 字符
  - [ ] 每个语句一行
  - [ ] 适当使用空行分隔逻辑块

#### 1.2 导入组织

- [ ] **导入顺序**
  ```typescript
  // 1. Node.js 标准库
  import { readFile } from 'fs';

  // 2. 第三方库
  import { z } from 'zod';
  import { Hono } from 'hono';

  // 3. 内部模块（使用别名）
  import { MemoryStore } from '@/core/MemoryStore';
  import { CheckResult } from '@/types';

  // 4. 相对路径导入
  import { helper } from './utils';
  ```
  - [ ] 按标准库、第三方、内部模块、相对路径分组
  - [ ] 组之间空一行
  - [ ] 使用路径别名（`@/`）而非相对路径
  - [ ] 无未使用的导入

### 2. 代码复杂度

#### 2.1 函数复杂度

- [ ] **函数长度**
  ```typescript
  // 好的示例: 简短专注
  async function checkIntent(intent: string): Promise<CheckResult> {
    const normalized = normalizeIntent(intent);
    const violations = await checkViolations(normalized);
    return buildResult(violations);
  }

  // 不好的示例: 过长
  async function checkIntent(intent: string): Promise<CheckResult> {
    // 100+ 行代码...
  }
  ```
  - [ ] 函数长度 < 50 行
  - [ ] 函数只做一件事
  - [ ] 函数名清晰描述其功能

- [ ] **圈复杂度**
  ```typescript
  // 好的示例: 低复杂度
  function calculateLevel(score: number): string {
    if (score >= 90) return 'expert';
    if (score >= 70) return 'advanced';
    if (score >= 50) return 'intermediate';
    return 'beginner';
  }

  // 不好的示例: 高复杂度
  function calculateLevel(score: number, bonus: number, multiplier: number, ...): string {
    // 多层嵌套 if-else...
  }
  ```
  - [ ] 圈复杂度 < 10
  - [ ] 嵌套深度 <= 3
  - [ ] 避免深层 if-else 嵌套

#### 2.2 类复杂度

- [ ] **单一职责**
  ```typescript
  // 好的示例: 职责单一
  class GatewayGuard {
    async check(intent: string): Promise<CheckResult> {
      // 只做意图检查
    }
  }

  class ViolationLogger {
    async log(result: CheckResult): Promise<void> {
      // 只做日志记录
    }
  }

  // 不好的示例: 职责混杂
  class GatewayGuard {
    async check(intent: string): Promise<CheckResult> { ... }
    async log(result: CheckResult): Promise<void> { ... }
    async sendAlert(result: CheckResult): Promise<void> { ... }
    // ...
  }
  ```
  - [ ] 类只有一个改变的理由
  - [ ] 类方法数量合理（< 15 个）
  - [ ] 相关功能组织在一起

### 3. 类型安全

#### 3.1 类型定义

- [ ] **接口优先**
  ```typescript
  // 好的示例: 使用接口
  interface User {
    id: string;
    name: string;
    email: string;
  }

  // 不好的示例: 使用类型别名（简单情况除外）
  type User = {
    id: string;
    name: string;
  };
  ```
  - [ ] 数据结构使用接口
  - [ ] 联合类型使用类型别名
  - [ ] 函数签名明确参数和返回值类型

- [ ] **类型注解**
  ```typescript
  // 好的示例: 明确类型注解
  function calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => sum + item.price, 0);
  }

  // 不好的示例: 缺少返回类型
  function calculateTotal(items: Item[]) {
    return items.reduce((sum, item) => sum + item.price, 0);
  }
  ```
  - [ ] 公共函数必须有返回类型
  - [ ] 复杂参数必须有类型
  - [ ] 避免类型推断依赖

#### 3.2 类型处理

- [ ] **错误处理**
  ```typescript
  // 好的示例: Result 类型
  type Result<T, E = Error> =
    | { success: true; data: T }
    | { success: false; error: E };

  async function fetchData(): Result<Data> {
    try {
      const data = await fetch(url);
      return { success: true, data };
    } catch (error) {
      return { success: false, error };
    }
  }

  // 不好的示例: 抛出异常
  async function fetchData(): Promise<Data> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed');
    }
    return response.json();
  }
  ```
  - [ ] 优先使用 Result 类型而非异常
  - [ ] 错误类型明确定义
  - [ ] 不可变错误对象

### 4. 最佳实践

#### 4.1 不可变性

- [ ] **优先使用不可变数据**
  ```typescript
  // 好的示例: 不可变
  const newState = {
    ...state,
    count: state.count + 1
  };

  // 不好的示例: 可变
  state.count++;
  ```
  - [ ] 使用 `const` 声明变量
  - [ ] 避免直接修改对象/数组
  - [ ] 使用扩展运算符创建副本

#### 4.2 异步处理

- [ ] **async/await 优先**
  ```typescript
  // 好的示例: async/await
  async function fetchUser(id: string): Promise<User> {
    const response = await fetch(`/users/${id}`);
    return response.json();
  }

  // 不好的示例: Promise 链
  function fetchUser(id: string): Promise<User> {
    return fetch(`/users/${id}`)
      .then(response => response.json());
  }
  ```
  - [ ] 优先使用 async/await
  - [ ] 避免嵌套 Promise
  - [ ] 正确处理并发（Promise.all）

#### 4.3 错误处理

- [ ] **完善的错误处理**
  ```typescript
  // 好的示例: 完善的错误处理
  async function checkIntent(intent: string): Promise<CheckResult> {
    if (!intent?.trim()) {
      return {
        status: 'INVALID',
        error: 'Intent cannot be empty'
      };
    }

    try {
      const result = await performCheck(intent);
      return result;
    } catch (error) {
      logger.error('Check failed', { intent, error });
      return {
        status: 'ERROR',
        error: 'Check failed unexpectedly'
      };
    }
  }

  // 不好的示例: 缺少错误处理
  async function checkIntent(intent: string): Promise<CheckResult> {
    return await performCheck(intent);
  }
  ```
  - [ ] 验证输入参数
  - [ ] 捕获并处理异常
  - [ ] 记录错误上下文
  - [ ] 返回用户友好的错误消息

### 5. 测试覆盖

- [ ] **测试存在性**
  - [ ] 每个公共函数有测试
  - [ ] 边界条件有测试
  - [ ] 错误路径有测试
  - [ ] 特殊情况有测试

- [ ] **测试质量**
  - [ ] 测试描述清晰
  - [ ] 测试独立可运行
  - [ ] 测试数据适当清理
  - [ ] Mock 外部依赖

---

## 第二道关卡: Pentester

### 1. OWASP Top 10 检查

#### A01:2021 - 访问控制失效

- [ ] **访问控制检查**
  ```typescript
  // 好的示例: 正确的访问控制
  async function getUserData(userId: string, currentUser: User): Promise<UserData | null> {
    // 验证用户权限
    if (currentUser.id !== userId && !currentUser.isAdmin) {
      throw new ForbiddenError('Access denied');
    }
    return await db.getUser(userId);
  }

  // 不好的示例: 缺少访问控制
  async function getUserData(userId: string): Promise<UserData> {
    return await db.getUser(userId);
  }
  ```
  - [ ] 每个端点验证用户权限
  - [ ] 不依赖客户端的权限检查
  - [ ] 默认拒绝，显式允许
  - [ ] 记录访问拒绝事件

#### A02:2021 - 加密失败

- [ ] **敏感数据加密**
  ```typescript
  // 好的示例: 使用 bcrypt
  import { bcrypt } from 'bcrypt';

  async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12); // salt rounds >= 10
  }

  // 不好的示例: 弱哈希
  function hashPassword(password: string): string {
    return crypto.createHash('md5').update(password).digest('hex');
  }
  ```
  - [ ] 密码使用 bcrypt (salt rounds >= 10)
  - [ ] 不使用 MD5/SHA1
  - [ ] 敏感数据传输使用 HTTPS
  - [ ] 密钥不硬编码在代码中

#### A03:2021 - 注入

- [ ] **输入验证**
  ```typescript
  // 好的示例: Zod 验证
  const intentSchema = z.object({
    action: z.string().max(100),
    target: z.string().max(100),
  });

  async function processIntent(input: unknown) {
    const validated = intentSchema.parse(input);
    // 安全处理 validated
  }

  // 不好的示例: 无验证
  async function processIntent(input: any) {
    // 直接使用 input
  }
  ```
  - [ ] 所有用户输入经过验证
  - [ ] 使用参数化查询
  - [ ] 不使用 eval() 或 Function()
  - [ ] 转义输出

#### A04:2021 - 不安全设计

- [ ] **CORS 配置**
  ```typescript
  // 好的示例: 具体 Origin
  app.use(cors({
    origin: (origin, callback) => {
      const allowedOrigins = ['https://app.example.com'];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed'));
      }
    }
  }));

  // 不好的示例: 通配符
  app.use(cors({ origin: '*' }));
  ```
  - [ ] 不使用 CORS 通配符
  - [ ] 具体配置允许的来源
  - [ ] 验证 Origin 头
  - [ ] 适当的缓存策略

#### A05:2021 - 安全配置错误

- [ ] **环境配置**
  ```typescript
  // 好的示例: 环境变量
  const config = {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiKey: process.env.API_KEY,
  };

  // 不好的示例: 硬编码配置
  const config = {
    port: 3000,
    apiKey: 'sk-1234567890',
  };
  ```
  - [ ] 不在生产环境启用调试
  - [ ] 敏感配置使用环境变量
  - [ ] 不在版本控制中提交 .env
  - [ ] 默认安全配置

#### A07:2021 - 身份认证失效

- [ ] **JWT 配置**
  ```typescript
  // 好的示例: 安全的 JWT
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // 短期过期
  );

  // 不好的示例: 无过期时间
  const token = jwt.sign({ userId: user.id }, 'secret');
  ```
  - [ ] JWT 有过期时间
  - [ ] 使用强密钥签名
  - [ ] 实现 Token 刷新机制
  - [ ] 黑名单机制

### 2. 敏感信息检查

- [ ] **无硬编码敏感信息**
  - [ ] 无 API 密钥
  - [ ] 无密码
  - [ ] 无 Token
  - [ ] 无私钥

- [ ] **日志安全**
  - [ ] 不记录敏感数据
  - [ ] 不记录完整请求体
  - [ ] 不记录认证信息
  - [ ] 日志访问受控

### 3. 依赖安全

- [ ] **依赖扫描**
  ```bash
  bun audit
  ```
  - [ ] 无严重漏洞
  - [ ] 无高危漏洞
  - [ ] 依赖版本最新
  - [ ] 许可证合规

---

## 第三道关卡: QATester

### 1. 测试覆盖率

- [ ] **覆盖率要求**
  ```bash
  bun test --coverage
  ```
  - [ ] 单元测试覆盖率 >= 90%
  - [ ] 集成测试覆盖率 >= 80%
  - [ ] 关键路径覆盖率 100%
  - [ ] 分支覆盖率 >= 85%

### 2. 测试质量

- [ ] **测试结构**
  ```typescript
  // 好的示例: 清晰的测试结构
  describe('GatewayGuard', () => {
    describe('check', () => {
      it('应该阻止违反原则的意图', async () => {
        // Arrange
        const guard = new GatewayGuard();
        const intent = '直接写代码不测试';

        // Act
        const result = await guard.check(intent);

        // Assert
        expect(result.status).toBe('BLOCKED');
      });
    });
  });
  ```
  - [ ] 使用 AAA 模式（Arrange-Act-Assert）
  - [ ] 测试描述清晰
  - [ ] 每个测试只验证一件事
  - [ ] 测试独立运行

- [ ] **测试数据**
  - [ ] 使用工厂函数创建测试数据
  - [ ] 测试后清理
  - [ ] 不依赖测试执行顺序
  - [ ] 可重复运行

### 3. 功能验证

- [ ] **功能完整性**
  - [ ] 需求的所有功能已实现
  - [ ] 边界条件处理正确
  - [ ] 错误场景有处理
  - [ ] 用户友好

- [ ] **集成验证**
  - [ ] API 端点工作正常
  - [ ] 数据持久化正确
  - [ ] 外部服务集成正常
  - [ ] 并发安全

### 4. 文档完整性

- [ ] **TSDoc 注释**
  ```typescript
  /**
   * 检查任务意图是否符合 Gateway 原则
   *
   * @param intent - 任务描述
   * @param context - 上下文信息（可选）
   * @returns 检查结果，包含状态和违规详情
   *
   * @example
   * ```ts
   * const result = await gateway.check("实现用户登录");
   * if (result.status === 'BLOCKED') {
   *   console.log(result.violations);
   * }
   * ```
   */
  async check(intent: string, context?: CheckContext): Promise<CheckResult>
  ```
  - [ ] 所有公共 API 有 TSDoc
  - [ ] 参数和返回值有描述
  - [ ] 复杂逻辑有注释
  - [ ] 有使用示例

- [ ] **README 更新**
  - [ ] 新功能已添加到 README
  - [ ] 配置说明完整
  - [ ] 使用示例清晰
  - [ ] 变更日志更新

### 5. 用户体验

- [ ] **错误消息**
  - [ ] 用户友好的错误消息
  - [ ] 错误消息包含解决建议
  - [ ] 错误代码清晰
  - [ ] 不泄露敏感信息

- [ ] **性能**
  - [ ] 响应时间可接受
  - [ ] 无明显性能退化
  - [ ] 资源使用合理
  - [ ] 并发处理正常

---

## 快速参考卡

### CodeReviewer 快速检查

```
代码规范
- [ ] TypeScript 严格模式
- [ ] 命名约定正确
- [ ] 导入组织规范
- [ ] 格式一致

代码质量
- [ ] 函数 < 50 行
- [ ] 复杂度 < 10
- [ ] 单一职责
- [ ] 无重复代码

类型安全
- [ ] 无 any 类型
- [ ] 类型注解完整
- [ ] 接口优先
- [ ] 错误处理完善

测试
- [ ] 单元测试存在
- [ ] 覆盖率 >= 90%
- [ ] 测试描述清晰
```

### Pentester 快速检查

```
OWASP Top 10
- [ ] A01: 访问控制
- [ ] A02: 加密正确
- [ ] A03: 无注入
- [ ] A04: 安全设计
- [ ] A05: 配置安全
- [ ] A07: 认证正确

敏感信息
- [ ] 无硬编码密钥
- [ ] 日志安全
- [ ] 环境变量使用

依赖安全
- [ ] 无严重漏洞
- [ ] 无高危漏洞
```

### QATester 快速检查

```
测试
- [ ] 覆盖率 >= 90%
- [ ] 测试质量好
- [ ] 边界条件覆盖

功能
- [ ] 功能完整
- [ ] 错误处理完善
- [ ] 集成正常

文档
- [ ] TSDoc 完整
- [ ] README 更新
- [ ] 示例清晰

UX
- [ ] 错误消息友好
- [ ] 性能良好
```

---

## 常见问题

### Q1: 如果检查项不通过怎么办？

**A:** 根据严重程度决定：

| 级别 | 处理方式 |
|------|----------|
| **P0 - 阻塞** | 必须修复才能合并 |
| **P1 - 重要** | 强烈建议修复，可记录技术债 |
| **P2 - 建议** | 可选修复，作为改进方向 |

### Q2: 谁负责执行 Code Review？

**A:** 按三道关卡分配：

1. **CodeReviewer**: 任何有经验的开发者
2. **Pentester**: 安全专家或指定安全审查者
3. **QATester**: QA 团队或指定质量审查者

### Q3: Code Review 需要多长时间？

**A:** 根据变更大小：

| 变更规模 | 预期时间 |
|----------|----------|
| 小型 (< 100 行) | 15-30 分钟 |
| 中型 (100-500 行) | 30-60 分钟 |
| 大型 (> 500 行) | 拆分为多个 PR |

### Q4: 如何处理紧急变更？

**A:** 紧急变更流程：

1. 标记 PR 为 `urgent`
2. 至少完成第一道关卡（CodeReviewer）
3. 安全检查必须通过（Pentester）
4. 事后补全完整审查

### Q5: 如何跟踪技术债务？

**A:** 使用技术债务标签：

```markdown
// TODO: [TECH-DEBT] 重构此函数以降低复杂度
// 当前复杂度: 15, 目标: < 10
// 创建日期: 2026-02-06
// 计划修复: 2026-02-13
```

---

**文档维护者:** QATester Agent
**最后更新:** 2026-02-06
**版本:** 1.0.0
