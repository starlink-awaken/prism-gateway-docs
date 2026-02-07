# 用户指南

ReflectGuard 用户指南详细说明所有功能和用法。

## 目录

- [Gateway 检查](#gateway-检查)
- [复盘功能](#复盘功能)
- [分析功能](#分析功能)
- [MCP 集成](#mcp-集成)
- [数据管理](#数据管理)

---

## Gateway 检查

### 基本用法

```bash
prism check "任务描述"
```

### 带上下文检查

```bash
prism check "实现用户登录" \
  --context project=myapp \
  --context priority=high
```

### 检查级别

| 级别 | 说明 | 阻止执行 |
|------|------|----------|
| MANDATORY | 强制原则 | 是 |
| WARNING | 警告模式 | 否 |
| ADVISORY | 建议事项 | 否 |

### 输出格式

```bash
# JSON 格式
prism check "..." --output json

# 简洁格式
prism check "..." --output short

# 详细格式（默认）
prism check "..." --output detailed
```

---

## 复盘功能

### 快速复盘

```bash
prism retro quick
```

### 标准复盘

```bash
prism retro standard \
  --timeframe today \
  --project myapp
```

### 深度复盘

```bash
prism retro deep \
  --timeframe week \
  --dimensions all
```

### 7 个维度

| 维度 | 说明 |
|------|------|
| 原则 | 违反的行为准则 |
| 模式 | 匹配的成功/失败模式 |
| 基准 | 能力评估指标 |
| 陷阱 | 识别的常见陷阱 |
| 成功 | 成功因素提取 |
| 工具 | 使用的工具和技术 |
| 数据 | 关键数据点 |

---

## 分析功能

### 使用统计

```bash
prism analytics usage --period week
```

### 质量分析

```bash
prism analytics quality --period month
```

### 性能分析

```bash
prism analytics performance --period today
```

### 趋势分析

```bash
prism analytics trend violations --period week
```

### 异常检测

```bash
prism analytics detect-anomalies
```

---

## MCP 集成

### 配置

编辑 Claude Desktop 配置文件：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "prism-gateway": {
      "command": "bun",
      "args": ["run", "/path/to/prism-gateway/src/mcp/server.ts"],
      "env": {
        "PRISM_GATEWAY_PATH": "~/.prism-gateway"
      }
    }
  }
}
```

### 可用工具

| 工具 | 功能 |
|------|------|
| gateway_check | 检查任务意图 |
| extract_data | 提取 7 维度数据 |
| trigger_retro | 触发复盘 |
| query_patterns | 查询模式 |
| query_principles | 查询原则 |
| get_stats | 获取统计 |

---

## 数据管理

### 数据备份

```bash
prism backup create
```

### 数据恢复

```bash
prism backup restore <backup-id>
```

### 数据导出

```bash
# 导出为 JSON
prism export --format json > backup.json

# 导出为 CSV
prism export --format csv > backup.csv
```

### 数据清理

```bash
# 清理过期数据
prism cleanup --older-than 30days

# 清理缓存
prism cleanup --cache
```

---

## 高级功能

### 自定义原则

编辑 `~/.prism-gateway/level-1-hot/principles.json`：

```json
{
  "principles": [
    {
      "id": "custom-001",
      "category": "security",
      "statement": "不在生产环境使用测试密钥",
      "level": "MANDATORY"
    }
  ]
}
```

### 自定义模式

编辑成功/失败模式文件：

```bash
# 成功模式
~/.prism-gateway/level-1-hot/patterns/success_patterns.json

# 失败模式
~/.prism-gateway/level-1-hot/patterns/failure_patterns.json
```

---

## 最佳实践

### 1. 定期复盘

建议每日执行快速复盘：

```bash
# 添加到 crontab
0 18 * * * prism retro quick
```

### 2. 监控趋势

定期查看趋势变化：

```bash
prism analytics trend all --period week
```

### 3. 备份数据

每周备份一次：

```bash
prism backup create
```

---

**相关文档：**
- [配置说明](configuration.md)
- [常见问题](faq.md)
- [故障排查](troubleshooting.md)

---

**最后更新:** 2026-02-07
