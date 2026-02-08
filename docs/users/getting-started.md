# ReflectGuard 快速入门

欢迎来到 ReflectGuard！本指南将帮助你在 5 分钟内完成系统安装和首次使用。

## 前置条件

- **运行时环境**: Bun >= 1.0.0 或 Node.js >= 20.0.0
- **操作系统**: macOS、Linux 或 Windows
- **磁盘空间**: 至少 100MB 可用空间

## 安装步骤

### 1. 克隆项目

```bash
# 克隆主项目
cd ~/.prism-gateway

# 或克隆文档仓库
cd ~/workspace/agent/reflectguard-docs
```

### 2. 安装依赖

```bash
# 使用 Bun（推荐）
bun install

# 或使用 npm
npm install
```

### 3. 验证安装

```bash
# 运行测试
bun test

# 检查版本
prism --version
```

## 首次使用

### 基本命令

```bash
# 检查任务意图
prism check "实现用户登录功能"

# 执行快速复盘
prism retro quick

# 查看统计信息
prism stats

# 查看帮助
prism --help
```

### MCP Server 集成

在 Claude Desktop 中配置 MCP Server：

```json
{
  "mcpServers": {
    "prism-gateway": {
      "command": "bun",
      "args": ["run", "/path/to/prism-gateway/src/mcp/server.ts"]
    }
  }
}
```

## 下一步

- 阅读 [用户指南](user-guide.md) 了解详细功能
- 查看 [配置说明](configuration.md) 自定义系统行为
- 浏览 [常见问题](faq.md) 解决常见问题

## 获取帮助

如果遇到问题：

1. 查看 [故障排查指南](troubleshooting.md)
2. 在 GitHub 上提 [Issue](https://github.com/your-repo/issues)
3. 查看 [社区论坛](https://github.com/your-repo/discussions)

---

**最后更新:** 2026-02-07
**文档版本:** 1.0.0
