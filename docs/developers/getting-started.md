# 开发者快速开始

本指南帮助开发者快速搭建 ReflectGuard 的开发环境。

## 前置条件

- **Bun** >= 1.0.0
- **Git**
- **VS Code**（推荐）或你喜欢的编辑器

## 1. 克隆项目

```bash
# 克隆主项目
git clone https://github.com/your-org/prism-gateway.git ~/.prism-gateway
cd ~/.prism-gateway

# 克隆文档仓库（可选）
git clone https://github.com/your-org/reflectguard-docs.git ~/workspace/reflectguard-docs
```

## 2. 安装依赖

```bash
cd ~/.prism-gateway
bun install
```

## 3. 开发环境配置

### VS Code 推荐

安装扩展：

- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)

### 配置 TypeScript

```bash
# 检查 TypeScript 配置
cat tsconfig.json
```

### 配置 Git Hooks

```bash
# 安装 husky
bun run setup:hooks
```

## 4. 运行测试

```bash
# 运行所有测试
bun test

# 运行特定测试
bun test src/core/gateway/GatewayGuard.test.ts

# 监听模式
bun test --watch

# 覆盖率报告
bun test --coverage
```

## 5. 开发命令

```bash
# 启动开发服务器
bun run dev

# 构建
bun run build

# Lint
bun run lint

# 格式化
bun run format

# 类型检查
bun run type-check
```

## 6. 本地 MCP Server 测试

```bash
# 启动 MCP Server
bun run src/mcp/server.ts

# 测试工具调用
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gateway_check","arguments":{"intent":"test"}}}' | bun run src/mcp/server.ts
```

## 项目结构

```
~/.prism-gateway/
├── src/
│   ├── core/              # 核心模块
│   │   ├── gateway/       # Gateway 检查
│   │   ├── retrospective/ # 复盘引擎
│   │   └── analytics/     # 数据分析
│   ├── integration/       # MCP Server
│   ├── infrastructure/    # 基础设施
│   └── cli/              # 命令行工具
├── tests/                 # 测试文件
├── level-1-hot/          # 热数据
├── level-2-warm/         # 温数据
├── level-3-cold/         # 冷数据
└── package.json
```

## 开发流程

1. **创建分支**: `git checkout -b feature/my-feature`
2. **编写测试**: TDD 先行
3. **实现功能**: 使测试通过
4. **运行测试**: 确保所有测试通过
5. **提交代码**: 遵循提交规范
6. **推送 PR**: 等待代码审查

## 调试技巧

### VS Code 调试配置

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["--inspect-brk", "test"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### 日志调试

```typescript
import { logger } from './infrastructure/logging';

logger.debug('Debug message', { context });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', { error });
```

## 下一步

- 阅读 [架构设计](architecture.md)
- 查看 [API 参考](api-reference.md)
- 了解 [贡献指南](contributing-guide.md)

---

**最后更新:** 2026-02-07
