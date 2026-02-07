# 贡献指南

感谢你对 ReflectGuard 的关注！本文档将引导你完成贡献流程。

## 如何贡献

### 报告问题

如果你发现了 Bug 或有功能建议：

1. 检查 [已有 Issues](https://github.com/your-repo/issues)
2. 如果没有，创建新 Issue
3. 使用对应的模板填写信息

### 提交代码

#### 1. Fork 仓库

点击 GitHub 页面右上角的 Fork 按钮

#### 2. 克隆你的 Fork

```bash
git clone https://github.com/your-username/prism-gateway.git
cd prism-gateway
```

#### 3. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

#### 4. 编写代码

遵循我们的编码规范：
- TypeScript 严格模式
- 测试驱动开发（TDD）
- 添加 JSDoc 注释
- 运行 `bun test` 确保测试通过

#### 5. 提交代码

```bash
git add .
git commit -m "feat: add new feature"
```

**提交消息格式：**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具

**示例：**
```
feat(gateway): add pattern matching support

Add support for matching success/failure patterns
in Gateway checks.

Closes #123
```

#### 6. 推送到你的 Fork

```bash
git push origin feature/your-feature-name
```

#### 7. 创建 Pull Request

1. 访问你的 Fork 页面
2. 点击 "Compare & pull request"
3. 填写 PR 描述
4. 等待代码审查

## 开发规范

### 编码规范

#### TypeScript

```typescript
// ✅ 好的实践
interface User {
  id: string;
  name: string;
  email: string;
}

async function getUser(id: string): Promise<User> {
  const user = await db.findUser(id);
  return user;
}

// ❌ 不好的实践
async function getUser(id) {  // 缺少类型注解
  return db.findUser(id);
}
```

#### 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 类 | PascalCase | `GatewayGuard` |
| 接口 | PascalCase | `CheckResult` |
| 函数 | camelCase | `checkIntent()` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| 文件 | camelCase.ts | `gatewayGuard.ts` |

#### 测试规范

```typescript
describe('GatewayGuard', () => {
  describe('check', () => {
    it('should return PASSED for valid intent', async () => {
      const guard = new GatewayGuard(testConfig);
      const result = await guard.check('valid intent');

      expect(result.status).toBe('PASSED');
    });

    it('should return BLOCKED for mandatory violation', async () => {
      const guard = new GatewayGuard(testConfig);
      const result = await guard.check('use test key in production');

      expect(result.status).toBe('BLOCKED');
      expect(result.violations).toHaveLength(1);
    });
  });
});
```

### 测试要求

- 测试覆盖率必须 >85%
- 新功能必须有测试
- 使用 `describe` 和 `it` 组织测试
- 测试文件与源文件同名：`*.test.ts`

```bash
# 运行测试
bun test

# 覆盖率报告
bun test --coverage

# 监听模式
bun test --watch
```

### 文档要求

- 所有公共方法必须有 JSDoc 注释
- 复杂逻辑需要内联注释
- 更新相关文档

```typescript
/**
 * 检查任务意图是否符合行为准则
 *
 * @param intent - 任务描述
 * @param context - 可选的上下文信息
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

## 代码审查

### 审查检查清单

- [ ] 代码遵循项目规范
- [ ] 测试覆盖率达标
- [ ] 文档已更新
- [ ] 提交消息格式正确
- [ ] 没有引入新的警告
- [ ] 所有测试通过

### 审查流程

1. **自动检查**: CI 自动运行测试和 lint
2. **人工审查**: 维护者审查代码
3. **修改反馈**: 根据反馈修改代码
4. **合并**: 审查通过后合并

## 发布流程

### 版本号

遵循 [语义化版本](https://semver.org/)：

- **主版本号（Major）**：不兼容的 API 变更
- **次版本号（Minor）**：向后兼容的功能新增
- **修订号（Patch）**：向后兼容的问题修复

### 发布步骤

1. 更新版本号
2. 更新 CHANGELOG.md
3. 创建 Git tag
4. 推送到仓库
5. GitHub 自动创建 Release

---

**相关文档：**
- [架构设计](architecture.md)
- [测试指南](testing-guide.md)
- [API 参考](api-reference.md)

---

**最后更新:** 2026-02-07
