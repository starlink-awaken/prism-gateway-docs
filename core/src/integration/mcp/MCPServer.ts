/**
 * MCP Server - PRISM-Gateway MCP服务
 *
 * @description
 * 将PRISM-Gateway的Gateway检查能力暴露为MCP工具，提供统一的接口给AI Agent调用。
 *
 * @remarks
 * 实现的MCP工具：
 * - gateway_check: 执行Gateway检查，返回CheckResult
 * - query_principles: 查询原则列表
 * - query_patterns: 查询模式（成功/失败）
 * - query_traps: 查询陷阱（失败模式）
 *
 * 使用MCP SDK的stdio模式进行通信。
 *
 * @example
 * ```typescript
 * const server = new MCPServer({
 *   serverConfig: {
 *     name: 'prism-gateway',
 *     version: '1.0.0'
 *   }
 * });
 *
 * await server.start();
 * // Server运行中，处理MCP请求
 *
 * await server.stop();
 * ```
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { GatewayGuard } from '../../core/GatewayGuard.js';
import { MemoryStore } from '../../core/MemoryStore.js';
import { CheckResult, CheckStatus } from '../../types/checks.js';
import {
  Principle,
  SuccessPattern,
  FailurePattern
} from '../../types/index.js';

/**
 * MCP Server配置选项
 */
export interface MCPServerConfig {
  /**
   * MemoryStore实例，可选
   * 如果不提供，将创建新实例
   */
  memoryStore?: MemoryStore;

  /**
   * GatewayGuard实例，可选
   * 如果不提供，将创建新实例
   */
  gatewayGuard?: GatewayGuard;

  /**
   * MCP服务器配置
   */
  serverConfig?: {
    /**
     * 服务器名称
     * @default 'prism-gateway'
     */
    name?: string;

    /**
     * 服务器版本
     * @default '1.0.0'
     */
    version?: string;
  };
}

/**
 * 工具输入参数验证错误
 */
export class ToolValidationError extends Error {
  constructor(toolName: string, message: string) {
    super(`[${toolName}] Validation error: ${message}`);
    this.name = 'ToolValidationError';
  }
}

/**
 * 工具执行错误
 */
export class ToolExecutionError extends Error {
  constructor(toolName: string, originalError: Error) {
    super(`[${toolName}] Execution error: ${originalError.message}`);
    this.name = 'ToolExecutionError';
    this.cause = originalError;
  }
}

/**
 * MCP Server状态错误
 */
export class ServerStateError extends Error {
  constructor(message: string) {
    super(`Server state error: ${message}`);
    this.name = 'ServerStateError';
  }
}

/**
 * MCP Server核心类
 *
 * @description
 * 实现PRISM-Gateway的MCP服务器，提供以下工具：
 * 1. gateway_check - Gateway检查
 * 2. query_principles - 查询原则
 * 3. query_patterns - 查询模式
 * 4. query_traps - 查询陷阱
 */
export class MCPServer {
  private server: Server | null = null;
  private memoryStore: MemoryStore;
  private gatewayGuard: GatewayGuard;
  private serverName: string;
  private serverVersion: string;
  private isRunningFlag: boolean = false;

  // 工具定义
  private readonly tools: Record<string, Tool> = {
    gateway_check: {
      name: 'gateway_check',
      description: '执行PRISM Gateway违规检查，检查任务意图是否符合原则要求',
      inputSchema: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            description: '任务意图描述，如"实现用户登录功能"'
          },
          context: {
            type: 'object',
            description: '可选的检查上下文，包括阶段、历史记录等',
            properties: {
              phase: {
                type: 'string',
                description: '当前阶段'
              },
              history: {
                type: 'array',
                description: '历史检查记录',
                items: { type: 'object' }
              },
              user_preferences: {
                type: 'object',
                description: '用户偏好设置'
              }
            }
          }
        },
        required: ['intent']
      }
    },
    query_principles: {
      name: 'query_principles',
      description: '查询PRISM原则列表，支持按ID或关键词搜索',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '原则ID，如"P1"，如果提供则只返回该原则'
          },
          keyword: {
            type: 'string',
            description: '关键词搜索，搜索原则名称和描述'
          }
        }
      }
    },
    query_patterns: {
      name: 'query_patterns',
      description: '查询成功/失败模式，支持按类型和关键词过滤',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['success', 'failure', 'all'],
            description: '模式类型：success（成功模式）、failure（失败模式）、all（全部）',
            default: 'all'
          },
          keyword: {
            type: 'string',
            description: '关键词搜索'
          }
        }
      }
    },
    query_traps: {
      name: 'query_traps',
      description: '查询常见陷阱（高风险失败模式），支持按严重性和关键词过滤',
      inputSchema: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['高', '中', '低'],
            description: '严重性过滤'
          },
          keyword: {
            type: 'string',
            description: '关键词搜索'
          }
        }
      }
    }
  };

  /**
   * 创建MCP Server实例
   *
   * @param config - 服务器配置选项
   *
   * @example
   * ```typescript
   * const server = new MCPServer({
   *   memoryStore: myStore,
   *   gatewayGuard: myGuard,
   *   serverConfig: {
   *     name: 'my-gateway',
   *     version: '2.0.0'
   *   }
   * });
   * ```
   */
  constructor(config: MCPServerConfig = {}) {
    // 初始化依赖
    this.memoryStore = config.memoryStore || new MemoryStore();
    this.gatewayGuard = config.gatewayGuard || new GatewayGuard(this.memoryStore);

    // 服务器配置
    this.serverName = config.serverConfig?.name || 'prism-gateway';
    this.serverVersion = config.serverConfig?.version || '1.0.0';
  }

  /**
   * 启动MCP Server
   *
   * @throws {ServerStateError} 如果服务器已在运行
   *
   * @example
   * ```typescript
   * await server.start();
   * console.log('Server running');
   * ```
   */
  async start(): Promise<void> {
    if (this.isRunningFlag) {
      throw new ServerStateError('Server is already running');
    }

    // 创建MCP Server实例
    this.server = new Server(
      {
        name: this.serverName,
        version: this.serverVersion
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // 注册工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.values(this.tools)
    }));

    // 注册工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.handleToolCall(name, args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        if (error instanceof ToolValidationError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error.message,
                  code: 'VALIDATION_ERROR'
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                code: 'EXECUTION_ERROR'
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });

    // 使用stdio传输
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.isRunningFlag = true;
  }

  /**
   * 停止MCP Server
   *
   * @example
   * ```typescript
   * await server.stop();
   * console.log('Server stopped');
   * ```
   */
  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
    this.isRunningFlag = false;
    return Promise.resolve();
  }

  /**
   * 检查服务器是否正在运行
   *
   * @returns 如果服务器正在运行返回true
   */
  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * 获取底层MCP Server实例
   *
   * @returns MCP Server实例，如果未启动则返回null
   */
  getServer(): Server | null {
    return this.server;
  }

  /**
   * 获取服务器名称
   *
   * @returns 服务器名称
   */
  getName(): string {
    return this.serverName;
  }

  /**
   * 获取服务器版本
   *
   * @returns 服务器版本
   */
  getVersion(): string {
    return this.serverVersion;
  }

  /**
   * 获取已注册的工具列表
   *
   * @returns 工具名称数组
   */
  getRegisteredTools(): string[] {
    return Object.keys(this.tools);
  }

  /**
   * 获取工具定义
   *
   * @param toolName - 工具名称
   * @returns 工具定义，如果不存在返回undefined
   */
  getToolDefinition(toolName: string): Tool | undefined {
    return this.tools[toolName];
  }

  /**
   * 获取所有工具定义
   *
   * @returns 工具定义对象
   */
  getAllToolDefinitions(): Record<string, Tool> {
    return { ...this.tools };
  }

  /**
   * 获取服务器信息
   *
   * @returns 服务器信息对象
   */
  getServerInfo(): {
    name: string;
    version: string;
    tools: string[];
    running: boolean;
  } {
    return {
      name: this.serverName,
      version: this.serverVersion,
      tools: this.getRegisteredTools(),
      running: this.isRunningFlag
    };
  }

  /**
   * 直接调用工具（用于测试）
   *
   * @param toolName - 工具名称
   * @param args - 工具参数
   * @returns 工具执行结果
   *
   * @throws {ToolValidationError} 参数验证失败
   * @throws {ToolExecutionError} 工具执行失败
   *
   * @example
   * ```typescript
   * const result = await server.callTool('gateway_check', {
   *   intent: '实现用户登录'
   * });
   * ```
   */
  async callTool<T = any>(
    toolName: string,
    args: Record<string, any>
  ): Promise<T> {
    return await this.handleToolCall(toolName, args);
  }

  /**
   * 处理工具调用
   *
   * @param toolName - 工具名称
   * @param args - 工具参数
   * @returns 工具执行结果
   *
   * @throws {ToolValidationError} 参数验证失败
   * @throws {ToolExecutionError} 工具执行失败
   * @throws {Error} 工具不存在
   */
  private async handleToolCall(
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    // 检查工具是否存在
    if (!(toolName in this.tools)) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // 路由到具体的工具处理器
    switch (toolName) {
      case 'gateway_check':
        return await this.handleGatewayCheck(args);
      case 'query_principles':
        return await this.handleQueryPrinciples(args);
      case 'query_patterns':
        return await this.handleQueryPatterns(args);
      case 'query_traps':
        return await this.handleQueryTraps(args);
      default:
        throw new Error(`Tool not implemented: ${toolName}`);
    }
  }

  /**
   * 处理gateway_check工具调用
   *
   * @param args - 工具参数
   * @returns CheckResult
   *
   * @throws {ToolValidationError} intent参数无效
   */
  private async handleGatewayCheck(args: {
    intent?: string;
    context?: any;
  }): Promise<CheckResult> {
    // 参数验证
    if (args.intent === undefined || args.intent === null) {
      throw new ToolValidationError('gateway_check', 'Missing required parameter: intent');
    }

    if (typeof args.intent !== 'string') {
      throw new ToolValidationError('gateway_check', 'Parameter "intent" must be a string');
    }

    const intent = args.intent;

    // 执行检查（GatewayGuard内部会处理空字符串返回PASS）
    try {
      return await this.gatewayGuard.check(intent, args.context);
    } catch (error) {
      throw new ToolExecutionError(
        'gateway_check',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * 处理query_principles工具调用
   *
   * @param args - 工具参数
   * @returns 原则查询结果
   */
  private async handleQueryPrinciples(args: {
    id?: string;
    keyword?: string;
  }): Promise<{
    principles: Principle[];
    total: number;
    query_time: number;
  }> {
    const startTime = Date.now();

    try {
      let principles: Principle[];

      // 按ID查询
      if (args.id) {
        const principle = await this.memoryStore.getPrincipleById(args.id);
        principles = principle ? [principle] : [];
      }
      // 关键词搜索
      else if (args.keyword) {
        const allPrinciples = await this.memoryStore.getPrinciples();
        const keywordLower = args.keyword.toLowerCase();
        principles = allPrinciples.filter(p =>
          p.name.toLowerCase().includes(keywordLower) ||
          p.violation_message.toLowerCase().includes(keywordLower) ||
          p.keywords.some(k => k.toLowerCase().includes(keywordLower))
        );
      }
      // 获取全部
      else {
        principles = await this.memoryStore.getPrinciples();
      }

      return {
        principles,
        total: principles.length,
        query_time: Date.now() - startTime
      };
    } catch (error) {
      throw new ToolExecutionError(
        'query_principles',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * 处理query_patterns工具调用
   *
   * @param args - 工具参数
   * @returns 模式查询结果
   *
   * @throws {ToolValidationError} type参数无效
   */
  private async handleQueryPatterns(args: {
    type?: 'success' | 'failure' | 'all';
    keyword?: string;
  }): Promise<{
    success_patterns: SuccessPattern[];
    failure_patterns: FailurePattern[];
    total_success: number;
    total_failure: number;
    query_time: number;
  }> {
    const startTime = Date.now();

    // 验证type参数
    const type = args.type || 'all';
    if (type !== 'success' && type !== 'failure' && type !== 'all') {
      throw new ToolValidationError(
        'query_patterns',
        `Invalid pattern type: ${type}. Must be 'success', 'failure', or 'all'`
      );
    }

    try {
      let successPatterns: SuccessPattern[] = [];
      let failurePatterns: FailurePattern[] = [];

      // 关键词搜索
      if (args.keyword) {
        const searchResult = await this.memoryStore.searchPatterns(args.keyword);
        successPatterns = searchResult.success;
        failurePatterns = searchResult.failure;
      }
      // 按类型获取
      else {
        if (type === 'success' || type === 'all') {
          successPatterns = await this.memoryStore.getSuccessPatterns();
        }
        if (type === 'failure' || type === 'all') {
          failurePatterns = await this.memoryStore.getFailurePatterns();
        }
      }

      return {
        success_patterns: successPatterns,
        failure_patterns: failurePatterns,
        total_success: successPatterns.length,
        total_failure: failurePatterns.length,
        query_time: Date.now() - startTime
      };
    } catch (error) {
      throw new ToolExecutionError(
        'query_patterns',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * 处理query_traps工具调用
   *
   * @param args - 工具参数
   * @returns 陷阱查询结果
   *
   * @throws {ToolValidationError} severity参数无效
   */
  private async handleQueryTraps(args: {
    severity?: '高' | '中' | '低';
    keyword?: string;
  }): Promise<{
    traps: Array<FailurePattern & { trap_type: string }>;
    total: number;
    query_time: number;
  }> {
    const startTime = Date.now();

    // 验证severity参数
    if (args.severity && !['高', '中', '低'].includes(args.severity)) {
      throw new ToolValidationError(
        'query_traps',
        `Invalid severity: ${args.severity}. Must be '高', '中', or '低'`
      );
    }

    try {
      let patterns: FailurePattern[];

      // 关键词搜索
      if (args.keyword) {
        const searchResult = await this.memoryStore.searchPatterns(args.keyword);
        patterns = searchResult.failure;
      }
      // 获取所有失败模式
      else {
        patterns = await this.memoryStore.getFailurePatterns();
      }

      // 严重性过滤
      if (args.severity) {
        patterns = patterns.filter(p => p.severity === args.severity);
      }

      // 转换为陷阱格式
      const traps = patterns.map(p => ({
        ...p,
        trap_type: 'failure_pattern'
      }));

      return {
        traps,
        total: traps.length,
        query_time: Date.now() - startTime
      };
    } catch (error) {
      throw new ToolExecutionError(
        'query_traps',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

/**
 * 导出默认的单例实例（可选）
 */
export const mcpServer = new MCPServer();
