/**
 * MCP Server Integration Tests
 *
 * @description
 * MCP Server与GatewayGuard完整集成测试
 *
 * @remarks
 * 测试覆盖：
 * 1. MCP Server与GatewayGuard完整集成
 * 2. MCP Server与MemoryStore完整集成
 * 3. 完整工具调用流程
 * 4. 错误恢复和错误传播
 * 5. 性能基准测试（响应时间<100ms）
 * 6. 并发调用测试
 *
 * ISC标准：MCP集成测试 - MCP Server与GatewayGuard完整集成测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MCPServer } from '../../integration/mcp/MCPServer.js';
import { GatewayGuard } from '../../core/GatewayGuard.js';
import { MemoryStore } from '../../core/MemoryStore.js';
import { CheckStatus } from '../../types/checks.js';
import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * 集成测试环境
 */
class IntegrationTestEnv {
  public dataPath: string;

  constructor() {
    this.dataPath = join(tmpdir(), `prism-integration-test-${Date.now()}`);
  }

  async setup(): Promise<void> {
    await mkdir(this.dataPath, { recursive: true });
    await mkdir(join(this.dataPath, 'level-1-hot', 'patterns'), { recursive: true });
    await mkdir(join(this.dataPath, 'level-2-warm', 'retros'), { recursive: true });
    await mkdir(join(this.dataPath, 'level-3-cold'), { recursive: true });
  }

  async cleanup(): Promise<void> {
    if (existsSync(this.dataPath)) {
      await rm(this.dataPath, { recursive: true, force: true });
    }
  }
}

describe('MCP Integration Tests', () => {
  let env: IntegrationTestEnv;
  let memoryStore: MemoryStore;
  let gatewayGuard: GatewayGuard;
  let mcpServer: MCPServer;

  beforeEach(async () => {
    env = new IntegrationTestEnv();
    await env.setup();

    // 使用真实组件进行集成测试
    // MemoryStore不需要dataPath参数，它会使用默认路径
    memoryStore = new MemoryStore();

    gatewayGuard = new GatewayGuard(memoryStore);

    mcpServer = new MCPServer({
      memoryStore,
      gatewayGuard,
      serverConfig: {
        name: 'integration-test-mcp',
        version: '1.0.0'
      }
    });
  });

  afterEach(async () => {
    if (mcpServer && mcpServer.isRunning()) {
      await mcpServer.stop();
    }
    await env.cleanup();
  });

  // ==================== 完整集成测试 ====================

  describe('完整组件集成', () => {
    it('应该与GatewayGuard和MemoryStore完整集成', async () => {
      // 测试gateway_check工具
      const checkResult = await mcpServer.callTool('gateway_check', {
        intent: '实现用户登录功能'
      });

      expect(checkResult).toBeDefined();
      expect(checkResult.status).toBeDefined();
      expect(checkResult.check_time).toBeGreaterThanOrEqual(0);

      // 测试query_principles工具
      const principlesResult = await mcpServer.callTool('query_principles', {});

      expect(principlesResult).toBeDefined();
      expect(principlesResult.principles).toBeInstanceOf(Array);
      expect(principlesResult.total).toBe(principlesResult.principles.length);
      expect(principlesResult.query_time).toBeGreaterThanOrEqual(0);
    });

    it('应该支持完整的检查-查询工作流', async () => {
      // 1. 执行Gateway检查
      const checkResult = await mcpServer.callTool('gateway_check', {
        intent: '实现一个新功能',
        context: {
          phase: 'planning',
          user_preferences: { strict: true }
        }
      });

      expect(checkResult.status).toBeDefined();

      // 2. 查询原则列表
      const principlesResult = await mcpServer.callTool('query_principles', {});

      expect(principlesResult.principles).toBeDefined();

      // 3. 查询成功和失败模式
      const patternsResult = await mcpServer.callTool('query_patterns', {
        type: 'all'
      });

      expect(patternsResult.success_patterns).toBeDefined();
      expect(patternsResult.failure_patterns).toBeDefined();

      // 4. 查询陷阱
      const trapsResult = await mcpServer.callTool('query_traps', {
        severity: '高'
      });

      expect(trapsResult.traps).toBeDefined();
    });

    it('应该正确检测违规并返回详细信息', async () => {
      // 查询一个高严重性的原则
      const principlesResult = await mcpServer.callTool('query_principles', {});
      const highSeverityPrinciple = principlesResult.principles.find(
        (p: any) => p.level === 'HARD_BLOCK' || p.level === 'MANDATORY'
      );

      expect(highSeverityPrinciple).toBeDefined();

      // 使用原则关键词进行检测
      if (highSeverityPrinciple) {
        const checkResult = await mcpServer.callTool('gateway_check', {
          intent: `实现${highSeverityPrinciple.name}功能`
        });

        expect(checkResult).toBeDefined();
      }
    });
  });

  // ==================== 性能基准测试 ====================

  describe('性能基准测试', () => {
    it('gateway_check响应时间应该<100ms', async () => {
      const times: number[] = [];

      // 执行10次获取平均响应时间
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await mcpServer.callTool('gateway_check', {
          intent: '测试性能'
        });
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(150); // 允许偶尔的峰值

      console.log(`gateway_check性能: 平均${avgTime.toFixed(2)}ms, 最大${maxTime}ms`);
    });

    it('query_principles响应时间应该<100ms', async () => {
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await mcpServer.callTool('query_principles', {});
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(avgTime).toBeLessThan(100);

      console.log(`query_principles性能: 平均${avgTime.toFixed(2)}ms`);
    });

    it('query_patterns响应时间应该<100ms', async () => {
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await mcpServer.callTool('query_patterns', {});
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(avgTime).toBeLessThan(100);

      console.log(`query_patterns性能: 平均${avgTime.toFixed(2)}ms`);
    });

    it('query_traps响应时间应该<100ms', async () => {
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await mcpServer.callTool('query_traps', {});
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(avgTime).toBeLessThan(100);

      console.log(`query_traps性能: 平均${avgTime.toFixed(2)}ms`);
    });

    it('并发调用10个请求应该全部成功', async () => {
      const concurrentRequests = 10;
      const promises: Promise<any>[] = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          mcpServer.callTool('gateway_check', {
            intent: `并发测试请求 ${i}`
          })
        );
      }

      const results = await Promise.all(promises);
      const elapsed = Date.now() - startTime;

      // 所有请求都应该成功
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.status).toBeDefined();
      });

      // 平均每个请求时间
      const avgTime = elapsed / concurrentRequests;

      expect(avgTime).toBeLessThan(100);

      console.log(`并发${concurrentRequests}个请求: 总耗时${elapsed}ms, 平均${avgTime.toFixed(2)}ms/请求`);
    });
  });

  // ==================== 错误恢复测试 ====================

  describe('错误恢复测试', () => {
    it('应该处理MemoryStore错误并优雅降级', async () => {
      // 创建一个会抛出错误的MemoryStore
      const errorMemoryStore = {
        getPrinciples: async () => {
          throw new Error('MemoryStore暂时不可用');
        },
        getPrincipleById: async () => null,
        getSuccessPatterns: async () => [],
        getFailurePatterns: async () => [],
        searchPatterns: async () => ({ success: [], failure: [] }),
        clearCache: () => {}
      };

      const errorMcpServer = new MCPServer({
        memoryStore: errorMemoryStore as any,
        gatewayGuard,
        serverConfig: {
          name: 'error-test-mcp',
          version: '1.0.0'
        }
      });

      // 查询应该抛出错误
      await expect(errorMcpServer.callTool('query_principles', {}))
        .rejects.toThrow('MemoryStore暂时不可用');
    });

    it('应该处理GatewayGuard错误并返回错误信息', async () => {
      const errorGatewayGuard = {
        check: async () => {
          throw new Error('GatewayGuard检查失败');
        },
        quickCheck: async () => false,
        formatResult: () => ''
      };

      const errorMcpServer = new MCPServer({
        memoryStore,
        gatewayGuard: errorGatewayGuard as any,
        serverConfig: {
          name: 'error-test-mcp-2',
          version: '1.0.0'
        }
      });

      await expect(errorMcpServer.callTool('gateway_check', {
        intent: '测试'
      })).rejects.toThrow('GatewayGuard检查失败');
    });

    it('应该处理无效的参数并返回验证错误', async () => {
      // 测试缺少必需参数
      await expect(mcpServer.callTool('gateway_check', {} as any))
        .rejects.toThrow('Missing required parameter');

      // 测试无效的type参数
      await expect(mcpServer.callTool('query_patterns', {
        type: 'invalid' as any
      })).rejects.toThrow('Invalid pattern type');

      // 测试无效的severity参数
      await expect(mcpServer.callTool('query_traps', {
        severity: 'critical' as any
      })).rejects.toThrow('Invalid severity');
    });

    it('应该恢复从临时错误', async () => {
      let callCount = 0;

      const flakyMemoryStore = {
        getPrinciples: async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('临时网络错误');
          }
          return memoryStore.getPrinciples();
        },
        getPrincipleById: async (id: string) => memoryStore.getPrincipleById(id),
        getSuccessPatterns: async () => memoryStore.getSuccessPatterns(),
        getFailurePatterns: async () => memoryStore.getFailurePatterns(),
        searchPatterns: async (keyword: string) => memoryStore.searchPatterns(keyword),
        clearCache: () => {}
      };

      const flakyMcpServer = new MCPServer({
        memoryStore: flakyMemoryStore as any,
        gatewayGuard,
        serverConfig: {
          name: 'flaky-test-mcp',
          version: '1.0.0'
        }
      });

      // 第一次调用失败
      await expect(flakyMcpServer.callTool('query_principles', {}))
        .rejects.toThrow();

      // 第二次调用成功
      const result = await flakyMcpServer.callTool('query_principles', {});
      expect(result.principles).toBeDefined();
    });
  });

  // ==================== 数据一致性测试 ====================

  describe('数据一致性测试', () => {
    it('query_principles应该返回一致的数据', async () => {
      const result1 = await mcpServer.callTool('query_principles', {});
      const result2 = await mcpServer.callTool('query_principles', {});

      expect(result1.principles).toEqual(result2.principles);
      expect(result1.total).toBe(result2.total);
    });

    it('query_patterns应该返回一致的数据', async () => {
      const result1 = await mcpServer.callTool('query_patterns', {});
      const result2 = await mcpServer.callTool('query_patterns', {});

      expect(result1.success_patterns).toEqual(result2.success_patterns);
      expect(result1.failure_patterns).toEqual(result2.failure_patterns);
    });

    it('按ID查询应该返回正确的单个原则', async () => {
      // 首先获取所有原则
      const allResult = await mcpServer.callTool('query_principles', {});

      if (allResult.principles.length > 0) {
        const firstPrinciple = allResult.principles[0];

        // 按ID查询
        const byIdResult = await mcpServer.callTool('query_principles', {
          id: firstPrinciple.id
        });

        expect(byIdResult.principles).toHaveLength(1);
        expect(byIdResult.principles[0]).toEqual(firstPrinciple);
      }
    });

    it('关键词搜索应该返回匹配的结果', async () => {
      // 首先获取所有原则找到一个关键词
      const allResult = await mcpServer.callTool('query_principles', {});

      if (allResult.principles.length > 0) {
        const firstPrinciple = allResult.principles[0];
        const keyword = firstPrinciple.name.substring(0, 2);

        // 关键词搜索
        const searchResult = await mcpServer.callTool('query_principles', {
          keyword
        });

        // 结果应该包含关键词
        expect(searchResult.principles.length).toBeGreaterThan(0);
      }
    });
  });

  // ==================== 服务器生命周期测试 ====================

  describe('服务器生命周期测试', () => {
    it('应该正确启动和停止服务器', async () => {
      expect(mcpServer.isRunning()).toBe(false);

      await mcpServer.start();
      expect(mcpServer.isRunning()).toBe(true);

      await mcpServer.stop();
      expect(mcpServer.isRunning()).toBe(false);
    });

    it('启动后应该获取服务器实例', async () => {
      await mcpServer.start();

      const serverInstance = mcpServer.getServer();
      expect(serverInstance).toBeDefined();
      expect(serverInstance).not.toBeNull();

      await mcpServer.stop();
    });

    it('应该正确报告服务器信息', () => {
      const info = mcpServer.getServerInfo();

      expect(info.name).toBe('integration-test-mcp');
      expect(info.version).toBe('1.0.0');
      expect(info.tools).toContain('gateway_check');
      expect(info.tools).toContain('query_principles');
      expect(info.tools).toContain('query_patterns');
      expect(info.tools).toContain('query_traps');
      expect(info.running).toBe(false);
    });

    it('应该返回所有工具定义', () => {
      const tools = mcpServer.getAllToolDefinitions();

      expect(tools).toBeDefined();
      expect(Object.keys(tools)).toHaveLength(4);
      expect(tools.gateway_check).toBeDefined();
      expect(tools.query_principles).toBeDefined();
      expect(tools.query_patterns).toBeDefined();
      expect(tools.query_traps).toBeDefined();
    });
  });

  // ==================== 高级场景测试 ====================

  describe('高级场景测试', () => {
    it('应该处理复杂的上下文参数', async () => {
      const complexContext = {
        phase: 'development',
        history: [
          { timestamp: '2024-01-01', action: 'check', result: 'PASS' },
          { timestamp: '2024-01-02', action: 'check', result: 'WARNING' }
        ],
        user_preferences: {
          strict: true,
          allow_warnings: false,
          timeout: 5000
        }
      };

      const result = await mcpServer.callTool('gateway_check', {
        intent: '实现复杂功能',
        context: complexContext
      });

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('应该支持同时查询多种模式类型', async () => {
      const result = await mcpServer.callTool('query_patterns', {
        type: 'all',
        keyword: '测试'
      });

      expect(result.success_patterns).toBeDefined();
      expect(result.failure_patterns).toBeDefined();
      expect(result.total_success).toBe(result.success_patterns.length);
      expect(result.total_failure).toBe(result.failure_patterns.length);
    });

    it('应该支持多种严重性过滤组合', async () => {
      const highSeverity = await mcpServer.callTool('query_traps', {
        severity: '高'
      });

      const allTraps = await mcpServer.callTool('query_traps', {});

      // 高严重性陷阱应该是所有陷阱的子集
      expect(highSeverity.traps.length).toBeLessThanOrEqual(allTraps.traps.length);

      // 所有高严重性陷阱都应该有高严重性标记
      highSeverity.traps.forEach((trap: any) => {
        expect(trap.severity).toBe('高');
      });
    });

    it('应该处理空字符串intent', async () => {
      const result = await mcpServer.callTool('gateway_check', {
        intent: ''
      });

      // 空字符串应该被GatewayGuard处理返回PASS
      expect(result.status).toBe(CheckStatus.PASS);
    });
  });

  // ==================== 边界情况测试 ====================

  describe('边界情况测试', () => {
    it('应该处理非常长的intent字符串', async () => {
      const longIntent = '实现功能 '.repeat(1000);

      const result = await mcpServer.callTool('gateway_check', {
        intent: longIntent
      });

      expect(result).toBeDefined();
    });

    it('应该处理特殊字符在intent中', async () => {
      const specialIntent = '实现功能: 测试@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';

      const result = await mcpServer.callTool('gateway_check', {
        intent: specialIntent
      });

      expect(result).toBeDefined();
    });

    it('应该处理Unicode字符在intent中', async () => {
      const unicodeIntent = '实现功能: 测试中文🚀emoji表情符号';

      const result = await mcpServer.callTool('gateway_check', {
        intent: unicodeIntent
      });

      expect(result).toBeDefined();
    });

    it('应该查询不存在的原则ID返回空数组', async () => {
      const result = await mcpServer.callTool('query_principles', {
        id: 'NONEXISTENT_ID_12345'
      });

      expect(result.principles).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('应该搜索不存在的关键词返回空结果', async () => {
      const result = await mcpServer.callTool('query_principles', {
        keyword: 'xyz_nonexistent_keyword_12345'
      });

      expect(result.principles).toHaveLength(0);
    });
  });
});

/**
 * 集成验收测试
 * 验证整个系统在真实场景下的表现
 */
describe('MCP Integration Acceptance Tests', () => {
  let env: IntegrationTestEnv;
  let memoryStore: MemoryStore;
  let gatewayGuard: GatewayGuard;
  let mcpServer: MCPServer;

  beforeEach(async () => {
    env = new IntegrationTestEnv();
    await env.setup();

    memoryStore = new MemoryStore();

    gatewayGuard = new GatewayGuard(memoryStore);

    mcpServer = new MCPServer({
      memoryStore,
      gatewayGuard,
      serverConfig: {
        name: 'acceptance-test-mcp',
        version: '1.0.0'
      }
    });
  });

  afterEach(async () => {
    if (mcpServer && mcpServer.isRunning()) {
      await mcpServer.stop();
    }
    await env.cleanup();
  });

  it('验收标准1: 所有工具响应时间<100ms', async () => {
    const tools = [
      { name: 'gateway_check', args: { intent: '测试' } },
      { name: 'query_principles', args: {} },
      { name: 'query_patterns', args: {} },
      { name: 'query_traps', args: {} }
    ];

    const results: { tool: string; avgTime: number; passed: boolean }[] = [];

    for (const tool of tools) {
      const times: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await mcpServer.callTool(tool.name as any, tool.args);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const passed = avgTime < 100;

      results.push({ tool: tool.name, avgTime, passed });

      console.log(`${tool.name}: ${avgTime.toFixed(2)}ms ${passed ? '✓' : '✗'}`);
    }

    // 所有工具都应该通过性能测试
    results.forEach(result => {
      expect(result.passed).toBe(true);
    });
  });

  it('验收标准2: 支持并发10个Agent调用', async () => {
    const agentCount = 10;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < agentCount; i++) {
      promises.push(
        mcpServer.callTool('gateway_check', {
          intent: `Agent ${i} 测试`
        })
      );
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    // 所有请求都应该成功
    expect(results).toHaveLength(agentCount);
    results.forEach(result => {
      expect(result.status).toBeDefined();
    });

    // 性能验证
    const avgTime = elapsed / agentCount;
    expect(avgTime).toBeLessThan(100);

    console.log(`并发${agentCount}个Agent: 总耗时${elapsed}ms, 平均${avgTime.toFixed(2)}ms/Agent`);
  });

  it('验收标准3: 错误处理覆盖率100%', async () => {
    const errorCases = [
      {
        name: '缺少必需参数',
        tool: 'gateway_check',
        args: {} as any,
        expectedError: 'Missing required parameter'
      },
      {
        name: '无效pattern类型',
        tool: 'query_patterns',
        args: { type: 'invalid' as any },
        expectedError: 'Invalid pattern type'
      },
      {
        name: '无效severity',
        tool: 'query_traps',
        args: { severity: 'critical' as any },
        expectedError: 'Invalid severity'
      },
      {
        name: '不存在的工具',
        tool: 'nonexistent_tool' as any,
        args: {},
        expectedError: 'Tool not found'
      }
    ];

    const passed: string[] = [];
    const failed: string[] = [];

    for (const testCase of errorCases) {
      try {
        await mcpServer.callTool(testCase.tool as any, testCase.args);
        failed.push(`${testCase.name} (未抛出错误)`);
      } catch (error: any) {
        if (error.message.includes(testCase.expectedError)) {
          passed.push(testCase.name);
        } else {
          failed.push(`${testCase.name} (错误消息不匹配)`);
        }
      }
    }

    console.log(`错误处理测试: 通过${passed.length}/${errorCases.length}`);
    if (failed.length > 0) {
      console.log('失败:', failed);
    }

    expect(failed).toHaveLength(0);
  });

  it('验收标准4: 完整工作流测试', async () => {
    // 模拟完整的Agent工作流
    const workflow = [
      // 1. 检查任务意图
      { tool: 'gateway_check', args: { intent: '实现用户认证' } },
      // 2. 查询相关原则
      { tool: 'query_principles', args: { keyword: '认证' } },
      // 3. 查询成功模式
      { tool: 'query_patterns', args: { type: 'success' } },
      // 4. 查询失败模式
      { tool: 'query_patterns', args: { type: 'failure' } },
      // 5. 查询高严重性陷阱
      { tool: 'query_traps', args: { severity: '高' } }
    ];

    const results: any[] = [];

    for (const step of workflow) {
      const result = await mcpServer.callTool(step.tool as any, step.args);
      results.push(result);
    }

    // 验证工作流完整性
    expect(results).toHaveLength(5);
    expect(results[0].status).toBeDefined();
    expect(results[1].principles).toBeDefined();
    expect(results[2].success_patterns).toBeDefined();
    expect(results[3].failure_patterns).toBeDefined();
    expect(results[4].traps).toBeDefined();

    console.log('完整工作流测试通过 ✓');
  });
});
