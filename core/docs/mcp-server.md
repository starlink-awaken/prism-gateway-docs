# PRISM-Gateway MCP Server

## 概述

PRISM-Gateway MCP Server将Gateway违规检查能力暴露为MCP（Model Context Protocol）工具，供AI Agent调用。

## 安装

```bash
bun install
```

## 配置

在MCP客户端配置中添加PRISM-Gateway服务器：

```json
{
  "mcpServers": {
    "prism-gateway": {
      "command": "bun",
      "args": ["/path/to/prism-gateway/src/integration/mcp/index.ts"]
    }
  }
}
```

## 可用工具

### 1. gateway_check

执行PRISM Gateway违规检查。

**参数：**
- `intent` (string, 必需): 任务意图描述
- `context` (object, 可选): 检查上下文
  - `phase` (string): 当前阶段
  - `history` (array): 历史检查记录
  - `user_preferences` (object): 用户偏好设置

**返回：**
```typescript
{
  status: 'PASS' | 'WARNING' | 'BLOCKED',
  violations: Violation[],
  risks: Risk[],
  traps: Trap[],
  suggestions: Suggestion[],
  check_time: number,
  timestamp: string
}
```

**示例：**
```typescript
const result = await callTool('gateway_check', {
  intent: '实现用户登录功能'
});

// 检查结果
if (result.status === 'BLOCKED') {
  console.log('任务被阻止:', result.violations);
} else if (result.status === 'WARNING') {
  console.log('需要注意:', result.risks);
} else {
  console.log('检查通过');
}
```

### 2. query_principles

查询PRISM原则列表。

**参数：**
- `id` (string, 可选): 原则ID，如"P1"
- `keyword` (string, 可选): 关键词搜索

**返回：**
```typescript
{
  principles: Principle[],
  total: number,
  query_time: number
}
```

**示例：**
```typescript
// 获取所有原则
const all = await callTool('query_principles', {});

// 按ID查询
const p1 = await callTool('query_principles', { id: 'P1' });

// 关键词搜索
const search = await callTool('query_principles', { keyword: '测试' });
```

### 3. query_patterns

查询成功/失败模式。

**参数：**
- `type` ('success' | 'failure' | 'all', 可选): 模式类型，默认'all'
- `keyword` (string, 可选): 关键词搜索

**返回：**
```typescript
{
  success_patterns: SuccessPattern[],
  failure_patterns: FailurePattern[],
  total_success: number,
  total_failure: number,
  query_time: number
}
```

**示例：**
```typescript
// 获取所有模式
const all = await callTool('query_patterns', {});

// 只获取成功模式
const success = await callTool('query_patterns', { type: 'success' });

// 关键词搜索
const search = await callTool('query_patterns', { keyword: '成功' });
```

### 4. query_traps

查询常见陷阱（高风险失败模式）。

**参数：**
- `severity` ('高' | '中' | '低', 可选): 严重性过滤
- `keyword` (string, 可选): 关键词搜索

**返回：**
```typescript
{
  traps: FailurePattern[],
  total: number,
  query_time: number
}
```

**示例：**
```typescript
// 获取所有陷阱
const all = await callTool('query_traps', {});

// 按严重性过滤
const high = await callTool('query_traps', { severity: '高' });

// 关键词搜索
const search = await callTool('query_traps', { keyword: '失败' });
```

## 错误处理

所有工具可能返回以下错误：

- `VALIDATION_ERROR`: 参数验证失败
- `EXECUTION_ERROR`: 工具执行失败

错误响应格式：
```json
{
  "error": "错误消息",
  "code": "VALIDATION_ERROR | EXECUTION_ERROR"
}
```

## 性能指标

- `gateway_check`: < 1000ms
- `query_principles`: < 500ms
- `query_patterns`: < 500ms
- `query_traps`: < 500ms

## 开发

### 运行测试

```bash
bun test src/integration/mcp/MCPServer.test.ts
```

### 测试覆盖率

```bash
bun test --coverage src/integration/mcp/MCPServer.test.ts
```

### 运行Server

```bash
bun run src/integration/mcp/index.ts
```

## 编程方式使用

```typescript
import { MCPServer } from './src/integration/mcp/MCPServer.js';

// 创建server实例
const server = new MCPServer({
  serverConfig: {
    name: 'my-gateway',
    version: '1.0.0'
  }
});

// 启动
await server.start();

// 调用工具
const result = await server.callTool('gateway_check', {
  intent: '实现用户登录功能'
});

// 停止
await server.stop();
```

## 集成示例

### Claude Desktop配置

在`~/Library/Application Support/Claude/claude_desktop_config.json`中添加：

```json
{
  "mcpServers": {
    "prism-gateway": {
      "command": "bun",
      "args": [
        "/Users/xiamingxing/.prism-gateway/src/integration/mcp/index.ts"
      ]
    }
  }
}
```

### Cline (VSCode)配置

在VSCode设置中添加MCP服务器配置：

```json
{
  "cline.mcpServers": {
    "prism-gateway": {
      "command": "bun",
      "args": [
        "/Users/xiamingxing/.prism-gateway/src/integration/mcp/index.ts"
      ]
    }
  }
}
```

## 工作流示例

### 完整的Gateway检查工作流

```typescript
// 1. 检查任务意图
const checkResult = await callTool('gateway_check', {
  intent: '实现用户登录功能',
  context: {
    phase: 'development'
  }
});

// 2. 如果有违规，查询相关原则
if (checkResult.violations.length > 0) {
  const principleIds = checkResult.violations.map(v => v.principle_id);
  for (const id of principleIds) {
    const principle = await callTool('query_principles', { id });
    console.log(`违规原则: ${principle.principles[0].name}`);
  }
}

// 3. 查询相关失败模式
const patterns = await callTool('query_patterns', {
  type: 'failure',
  keyword: '登录'
});

// 4. 查询高风险陷阱
const traps = await callTool('query_traps', {
  severity: '高'
});
```

## 类型定义

### CheckStatus

```typescript
enum CheckStatus {
  PASS = 'PASS',
  WARNING = 'WARNING',
  BLOCKED = 'BLOCKED'
}
```

### Violation

```typescript
interface Violation {
  principle_id: string;
  principle_name: string;
  severity: 'MANDATORY' | 'HARD_BLOCK';
  message: string;
  detected_at: string;
}
```

### Risk

```typescript
interface Risk {
  pattern_id: string;
  pattern_name: string;
  type: 'success' | 'failure';
  confidence: number;
  message: string;
}
```

### Trap

```typescript
interface Trap {
  pattern_id: string;
  pattern_name: string;
  severity: '高' | '中' | '低';
  message: string;
}
```

## 故障排查

### Server无法启动

1. 检查Bun是否正确安装
2. 确认依赖已安装：`bun install`
3. 检查stdio通信是否正常

### 工具调用失败

1. 验证参数格式是否正确
2. 查看错误消息了解详情
3. 检查MemoryStore数据是否已初始化

### 性能问题

1. 检查数据文件大小
2. 考虑清除缓存：`server.memoryStore.clearCache()`
3. 查看query_time指标

## 许可证

MIT
