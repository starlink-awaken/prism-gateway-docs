# 故障排查指南

本指南帮助您诊断和解决 ReflectGuard 的常见问题。

## 诊断步骤

### 1. 健康检查

```bash
prism health
```

这将检查：
- 数据目录完整性
- 配置文件有效性
- 系统资源可用性

### 2. 查看日志

```bash
# 查看最近日志
prism logs --tail 50

# 实时查看日志
prism logs --follow

# 查看特定级别日志
prism logs --level error
```

### 3. 验证配置

```bash
prism config validate
```

---

## 常见问题

### 安装问题

#### 问题: 找不到 prism 命令

**症状:**
```
command not found: prism
```

**解决方案:**

1. 确认安装成功：
```bash
ls ~/.prism-gateway
```

2. 检查 PATH：
```bash
echo $PATH | grep -o "$(bun pm bin -g)"
```

3. 如果没有输出，添加到 shell 配置：
```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
export PATH="$(bun pm bin -g):$PATH"
```

4. 重新加载配置：
```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

#### 问题: 依赖安装失败

**症状:**
```
Error: Cannot find module 'xxx'
```

**解决方案:**

1. 清理并重新安装：
```bash
cd ~/.prism-gateway
rm -rf node_modules bun.lockb
bun install
```

2. 如果使用 npm：
```bash
npm cache clean --force
npm install
```

3. 检查 Bun 版本：
```bash
bun --version  # 需要 >= 1.0.0
```

### 运行时问题

#### 问题: Gateway 检查超时

**症状:**
```
Error: Gateway check timeout after 5000ms
```

**解决方案:**

1. 检查数据文件大小：
```bash
du -sh ~/.prism-gateway/level-*
```

2. 增加超时时间：
```json
// config.json
{
  "gateway": {
    "timeout": 10000
  }
}
```

3. 清理旧数据：
```bash
prism cleanup --older-than 90days
```

#### 问题: 检查结果不正确

**症状:**
- 明显违规但检查通过
- 正常操作但检查失败

**解决方案:**

1. 验证原则配置：
```bash
prism principles validate
```

2. 查看详细检查日志：
```bash
PRISM_LOG_LEVEL=debug prism check "..." --output detailed
```

3. 检查原则是否启用：
```json
// principles.json
{
  "enabled": true  // 确保为 true
}
```

#### 问题: 复盘失败

**症状:**
```
Error: Failed to generate retrospective
```

**解决方案:**

1. 检查数据目录：
```bash
ls -la ~/.prism-gateway/level-2-warm/retros/
```

2. 验证数据格式：
```bash
prism data validate --source level-2-warm
```

3. 查看详细错误：
```bash
prism retro debug --verbose
```

### MCP Server 问题

#### 问题: MCP Server 无法启动

**症状:**
Claude Desktop 中无法调用 prism 工具

**解决方案:**

1. 手动测试 MCP Server：
```bash
bun run ~/.prism-gateway/src/mcp/server.ts
```

2. 检查配置文件路径：
```json
{
  "mcpServers": {
    "prism-gateway": {
      "command": "bun",
      "args": ["run", "/ABSOLUTE/PATH/TO/prism-gateway/src/mcp/server.ts"]
    }
  }
}
```

3. 查看 Claude Desktop 日志：
- macOS: `~/Library/Logs/Claude/`
- Windows: `%APPDATA%\Claude\logs\`

#### 问题: MCP 工具返回错误

**症状:**
```
Error: Tool execution failed
```

**解决方案:**

1. 确认 PRISM_GATEWAY_PATH 环境变量已设置：
```bash
echo $PRISM_GATEWAY_PATH
# 应该输出: /Users/yourname/.prism-gateway
```

2. 测试单个工具：
```bash
prism check "test"
```

3. 查看服务端日志：
```bash
tail -f ~/.prism-gateway/logs/mcp.log
```

### 性能问题

#### 问题: 响应时间过长

**症状:**
- 检查超过 1 秒
- 复盘超过 5 分钟

**解决方案:**

1. 启用缓存：
```json
// config.json
{
  "cache": {
    "enabled": true,
    "ttl": 3600
  }
}
```

2. 检查磁盘性能：
```bash
# macOS
diskutil info /

# Linux
sudo hdparm -tT /dev/sda
```

3. 减少数据量：
```bash
prism cleanup --older-than 30days
prism compact
```

### 数据问题

#### 问题: 数据损坏

**症状:**
```
Error: Invalid data format
```

**解决方案:**

1. 从备份恢复：
```bash
prism backup list
prism backup restore <backup-id>
```

2. 重新初始化（最后手段）：
```bash
prism init --force
```

3. 验证数据完整性：
```bash
prism data validate
```

#### 问题: 数据丢失

**症状:**
- 历史记录消失
- 配置重置

**解决方案:**

1. 检查是否有备份：
```bash
prism backup list
```

2. 检查隐藏备份：
```bash
ls -la ~/.prism-gateway/.backups/
```

3. 检查系统备份：
- macOS Time Machine
- Linux 系统快照

---

## 获取帮助

如果以上方法都无法解决问题：

1. **查看日志**: `prism logs --tail 100`
2. **收集信息**: 运行 `prism doctor`
3. **创建 Issue**: 在 GitHub 上提交详细的错误报告

### 创建 Bug Report 时请包含：

- ReflectGuard 版本：`prism --version`
- 操作系统版本
- 错误信息完整输出
- 复现步骤
- 相关日志片段

---

**相关文档：**
- [常见问题](faq.md)
- [配置说明](configuration.md)
- [用户指南](user-guide.md)

---

**最后更新:** 2026-02-07
