# 贡献工作流程

本文档描述 ReflectGuard 项目的标准贡献工作流程。

## 前置准备

### 1. 创建 GitHub 账户

如果你还没有 GitHub 账户，请先创建一个。

### 2. 设置开发环境

```bash
# Fork 仓库
# 点击 GitHub 页面上的 "Fork" 按钮

# 克隆你的 Fork
git clone https://github.com/your-username/prism-gateway.git
cd prism-gateway

# 添加上游远程仓库
git remote add upstream https://github.com/original-owner/prism-gateway.git

# 安装依赖
bun install
```

### 3. 配置 Git

```bash
# 设置用户名和邮箱
git config user.name "Your Name"
git config user.email "your-email@example.com"

# 设置签名密钥（可选）
git config commit.gpgsign true
```

## 工作流程

### 1. 选择任务

查看 [Issues](https://github.com/your-repo/issues)：

- 标记 `good first issue` 的任务适合新手
- 标记 `help wanted` 的任务需要帮助
- 标记 `enhancement` 的是新功能

在开始前，先评论表明你正在处理这个任务。

### 2. 创建分支

```bash
# 确保你的主分支是最新的
git checkout main
git fetch upstream
git rebase upstream/main

# 创建新分支
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/issue-number-description
```

**分支命名规范：**

- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关
- `chore/` - 构建/工具相关

### 3. 开发

遵循 TDD 流程：

```bash
# 1. 编写测试（RED）
# 创建测试文件并编写测试用例

# 2. 运行测试（确认失败）
bun test

# 3. 实现功能（GREEN）
# 编写代码使测试通过

# 4. 运行所有测试
bun test

# 5. 代码检查
bun run lint
bun run format
```

### 4. 提交代码

```bash
# 添加变更
git add .

# 提交（遵循提交规范）
git commit -m "feat: add pattern matching support"
```

### 5. 同步上游

```bash
# 获取上游更新
git fetch upstream

# 变基到最新的上游主分支
git rebase upstream/main

# 推送到你的 Fork
git push origin feature/your-feature-name --force-with-lease
```

### 6. 创建 Pull Request

1. 访问你的 Fork 页面
2. 点击 "Compare & pull request"
3. 填写 PR 描述：
   - 简要描述变更
   - 关联 Issue（如果有的话）
   - 添加截图（如果适用）
   - 确认检查清单

### 7. 代码审查

- 维护者会审查你的代码
- 根据反馈进行修改
- 推送更新到你的分支
- PR 会自动更新

### 8. 合并

- 审查通过后，PR 会被合并
- 你的贡献将成为项目的一部分

## 提交规范

### 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型（type）

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具

### 示例

```
feat(gateway): add pattern matching support

- Add PatternMatcher class
- Integrate with GatewayGuard
- Add unit tests

Closes #123
```

## PR 模板

创建 PR 时，请使用以下模板：

```markdown
## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 代码重构
- [ ] 文档更新
- [ ] 性能优化

## 描述
简要描述这个 PR 的内容

## 相关 Issue
关闭 #(issue 编号)

## 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试完成

## 截图
（如果适用）

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 测试覆盖率 >85%
- [ ] 文档已更新
- [ ] 提交消息格式正确
```

## 代码审查规范

### 审查者

- 在 48 小时内完成审查
- 提供建设性反馈
- 认可好的贡献

### 贡献者

- 响应审查反馈
- 解释复杂的设计决策
- 根据反馈进行修改

## 发布流程

### 版本发布

1. 更新版本号
2. 更新 CHANGELOG.md
3. 创建 Git tag
4. 推送到仓库
5. GitHub 自动创建 Release

### 参与发布

如果你想参与发布过程：

- 加入发布讨论
- 测试候选版本
- 验证发布说明

---

**相关文档：**
- [代码审查规范](code-review.md)
- [测试要求](testing.md)
- [发布流程](release-process.md)

---

**最后更新:** 2026-02-07
