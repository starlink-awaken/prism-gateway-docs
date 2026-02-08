# 快速开始

本指南将帮助你在 5 分钟内体验 ReflectGuard 的核心功能。

## 1 分钟安装

```bash
# 安装依赖（只需首次）
cd ~/.prism-gateway && bun install
```

## 2 分钟配置

```bash
# 初始化数据目录
prism init

# 验证配置
prism health
```

## 2 分钟使用

### 检查任务意图

```bash
prism check "实现用户登录功能"
```

**输出示例：**
```
✓ PASSED
违规项: 0
警告项: 1
建议项: 2

建议：
- 考虑使用双因素认证
- 注意密码强度要求
```

### 执行快速复盘

```bash
prism retro quick
```

**输出示例：**
```
=== 快速复盘报告 ===
时间范围: 今天
任务数: 5
违规数: 0
完成率: 80%

推荐行动：
1. 无需立即行动
2. 继续保持当前节奏
```

### 查看统计

```bash
prism stats --period today
```

**输出示例：**
```
=== 今日统计 ===
检查次数: 12
通过率: 91.7%
平均响应时间: 45ms
违规原则数: 1
```

## 核心 MCP 工具

配置 Claude Desktop 后，可以在对话中使用：

```
你: 请检查我的任务是否符合原则

Claude: 正在检查...

✓ 检查通过，可以继续执行
```

## 下一步

- 阅读 [用户指南](user-guide.md) 了解所有功能
- 查看 [配置文档](configuration.md) 自定义行为
- 浏览 [API 文档](../../api/README.md) 进行开发

---

**需要帮助？** 查看 [FAQ](faq.md) 或 [故障排查](troubleshooting.md)
