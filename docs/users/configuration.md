# 配置说明

ReflectGuard 配置文件和选项的完整参考。

## 配置文件位置

```
~/.prism-gateway/
├── config/
│   ├── config.json          # 主配置文件
│   ├── principles.json      # 行为准则
│   └── patterns/            # 模式定义
│       ├── success_patterns.json
│       └── failure_patterns.json
└── .env                     # 环境变量
```

## 主配置文件 (config.json)

```json
{
  "$schema": "./config.schema.json",
  "version": "1.0.0",
  "gateway": {
    "timeout": 5000,
    "maxRetries": 3,
    "strictMode": false
  },
  "analytics": {
    "enabled": true,
    "retentionDays": 90,
    "aggregationInterval": "1h"
  },
  "logging": {
    "level": "info",
    "format": "json",
    "outputs": ["console", "file"]
  },
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 1000
  }
}
```

### Gateway 配置

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| timeout | number | 5000 | 检查超时时间（毫秒） |
| maxRetries | number | 3 | 最大重试次数 |
| strictMode | boolean | false | 严格模式（警告视为违规） |

### Analytics 配置

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| enabled | boolean | true | 是否启用分析 |
| retentionDays | number | 90 | 数据保留天数 |
| aggregationInterval | string | "1h" | 聚合间隔 |

### Logging 配置

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| level | string | "info" | 日志级别 |
| format | string | "json" | 日志格式 |
| outputs | array | ["console"] | 输出目标 |

## 环境变量

创建 `.env` 文件：

```bash
# 核心配置
PRISM_GATEWAY_PATH=~/.prism-gateway
PRISM_GATEWAY_PORT=3000
PRISM_GATEWAY_HOST=localhost

# 日志配置
PRISM_LOG_LEVEL=info
PRISM_LOG_FORMAT=json

# 缓存配置
PRISM_CACHE_ENABLED=true
PRISM_CACHE_TTL=3600

# 分析配置
PRISM_ANALYTICS_ENABLED=true
PRISM_ANALYTICS_RETENTION_DAYS=90

# API 配置
PRISM_API_KEY=your-api-key
PRISM_API_RATE_LIMIT=100
```

## 行为准则配置

编辑 `principles.json`：

```json
{
  "version": "1.0.0",
  "principles": [
    {
      "id": "principle-001",
      "category": "security",
      "statement": "不在生产环境使用测试密钥",
      "level": "MANDATORY",
      "enabled": true,
      "keywords": ["密钥", "测试", "生产环境"],
      "exceptions": []
    }
  ]
}
```

### 原则级别

| 级别 | 说明 | 阻止执行 |
|------|------|----------|
| MANDATORY | 强制原则 | 是 |
| WARNING | 警告级别 | 否 |
| ADVISORY | 建议级别 | 否 |

## 模式配置

### 成功模式 (success_patterns.json)

```json
{
  "patterns": [
    {
      "id": "success-001",
      "name": "渐进式开发",
      "description": "从小功能开始，逐步增加",
      "indicators": [
        "先实现核心功能",
        "迭代开发",
        "MVP"
      ],
      "confidence": 0.85
    }
  ]
}
```

### 失败模式 (failure_patterns.json)

```json
{
  "patterns": [
    {
      "id": "failure-001",
      "name": "过早优化",
      "description": "在功能未完成前优化性能",
      "indicators": [
        "优化性能",
        "功能未完成",
        "重构"
      ],
      "confidence": 0.75
    }
  ]
}
```

## CLI 配置

```bash
# ~/.prismrc
export PRISM_DEFAULT_OUTPUT_FORMAT="detailed"
export PRISM_DEFAULT_TIMEFRAME="today"
export PRISM_AUTO_BACKUP=true
export PRISM_BACKUP_INTERVAL="daily"
```

## MCP Server 配置

### Claude Desktop 配置

```json
{
  "mcpServers": {
    "prism-gateway": {
      "command": "bun",
      "args": ["run", "/path/to/prism-gateway/src/mcp/server.ts"],
      "env": {
        "PRISM_GATEWAY_PATH": "~/.prism-gateway",
        "PRISM_LOG_LEVEL": "warn"
      }
    }
  }
}
```

## 验证配置

```bash
# 验证配置文件
prism config validate

# 查看当前配置
prism config show

# 重置配置
prism config reset
```

---

**相关文档：**
- [环境变量参考](environment-variables.md)
- [用户指南](user-guide.md)
- [故障排查](troubleshooting.md)

---

**最后更新:** 2026-02-07
