#!/usr/bin/env bun
/**
 * MCP Server CLI入口
 *
 * @description
 * 启动PRISM-Gateway MCP Server，通过stdio与MCP客户端通信
 *
 * @example
 * ```bash
 * # 直接运行
 * bun run src/integration/mcp/index.ts
 *
 * # 或者作为MCP服务器配置
 * {
 *   "mcpServers": {
 *     "prism-gateway": {
 *       "command": "bun",
 *       "args": ["/path/to/prism-gateway/src/integration/mcp/index.ts"]
 *     }
 *   }
 * }
 * ```
 */

import { MCPServer } from './MCPServer.js';

/**
 * 主函数
 */
async function main() {
  const server = new MCPServer({
    serverConfig: {
      name: 'prism-gateway',
      version: '1.0.0'
    }
  });

  // 启动server（会阻塞在stdio通信）
  await server.start();

  // 处理优雅退出
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

// 启动server
main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
