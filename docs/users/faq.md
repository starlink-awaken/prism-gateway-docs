# 常见问题 (FAQ)

以下是 ReflectGuard 用户最常问的问题和解答。

## 安装和配置

### Q: 如何安装 ReflectGuard？

**A:** 请参阅 [安装指南](installation.md)，主要有三种方式：
- 从源码安装（推荐）
- 使用 npm 全局安装
- 使用 Docker

### Q: 支持哪些操作系统？

**A:** 完全支持 macOS、Linux 和 Windows（WSL2 推荐）。

### Q: 最低系统要求是什么？

**A:**
- Bun >= 1.0.0 或 Node.js >= 20.0.0
- 至少 100MB 磁盘空间

### Q: 如何升级到最新版本？

**A:**
```bash
cd ~/.prism-gateway
git pull origin main
bun install
```

## 使用问题

### Q: Gateway 检查返回警告但我想继续执行，怎么办？

**A:** 警告级别的检查不会阻止执行，你可以安全地继续。如果是强制级别（MANDATORY）的违规，你需要先解决违规项。

### Q: 如何添加自定义原则？

**A:** 编辑 `~/.prism-gateway/level-1-hot/principles.json`，添加新的原则对象。详见 [配置说明](configuration.md)。

### Q: 复盘数据保存在哪里？

**A:** 保存在 `~/.prism-gateway/level-2-warm/retros/` 目录下。

### Q: 如何导出我的数据？

**A:**
```bash
prism export --format json > backup.json
```

### Q: 检查响应时间很长怎么办？

**A:** 可能原因和解决方案：
1. 数据量大，缓存未预热 → 多查询几次
2. 磁盘 IO 慢 → 检查磁盘健康
3. 配置的 timeout 太长 → 调整 config.json

## MCP 集成

### Q: 如何在 Claude Desktop 中启用 MCP Server？

**A:** 编辑 Claude Desktop 配置文件，添加 ReflectGuard server 配置。详见 [用户指南](user-guide.md#mcp-集成)。

### Q: MCP Server 没有响应？

**A:**
1. 检查服务是否运行：`ps aux | grep prism`
2. 查看 Claude Desktop 日志
3. 尝试手动启动：`bun run src/mcp/server.ts`

### Q: MCP Server 支持哪些工具？

**A:** 目前支持 6 个工具：
- gateway_check
- extract_data
- trigger_retro
- query_patterns
- query_principles
- get_stats

## 数据管理

### Q: 如何备份数据？

**A:**
```bash
prism backup create
```

### Q: 如何恢复备份？

**A:**
```bash
prism backup restore <backup-id>
```

### Q: 如何清理旧数据？

**A:**
```bash
# 清理 30 天前的数据
prism cleanup --older-than 30days
```

### Q: 数据会同步到云端吗？

**A:** 默认不会，所有数据保存在本地。你可以自行配置云同步。

## 性能和限制

### Q: 系统性能如何？

**A:**
- Gateway 检查: <100ms
- 快速复盘: <5 分钟
- MCP 响应: <20ms

### Q: 支持多少条历史记录？

**A:** 默认保留 90 天，可以在配置中调整 `retentionDays`。

### Q: 可以在多台机器上使用吗？

**A:** 可以，但需要手动同步数据目录。建议使用 Git 或云存储进行同步。

## 故障排查

### Q: 如何查看详细日志？

**A:**
```bash
# 设置日志级别为 debug
export PRISM_LOG_LEVEL=debug

# 或在配置文件中设置
prism config set logging.level debug
```

### Q: 测试失败了怎么办？

**A:**
```bash
# 清理缓存重试
rm -rf node_modules bun.lockb
bun install
bun test
```

### Q: 找不到 prism 命令？

**A:** 确保已正确安装并添加到 PATH：
```bash
export PATH="$(bun pm bin -g):$PATH"
```

## 社区和支持

### Q: 如何报告 Bug？

**A:** 请在 GitHub 上创建 Issue：[创建 Bug Report](https://github.com/your-repo/issues/new?template=bug_report.md)

### Q: 如何请求新功能？

**A:** 请在 GitHub 上创建 Feature Request：[创建功能请求](https://github.com/your-repo/issues/new?template=feature_request.md)

### Q: 有邮件列表或论坛吗？

**A:** 请访问我们的 [GitHub Discussions](https://github.com/your-repo/discussions)

### Q: 如何贡献代码？

**A:** 请参阅 [贡献者指南](../contributors/workflow.md)

---

**没有找到答案？** 查看 [故障排查指南](troubleshooting.md) 或在 [GitHub Discussions](https://github.com/your-repo/discussions) 提问。

---

**最后更新:** 2026-02-07
