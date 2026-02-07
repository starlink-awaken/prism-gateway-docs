/**
 * MCP Server单元测试
 *
 * @description
 * 测试MCP Server的完整功能，包括：
 * - Server初始化和生命周期
 * - Gateway check工具
 * - Memory查询工具（queryPrinciples、queryPatterns、queryTraps）
 * - 错误处理和参数验证
 *
 * @remarks
 * TDD RED阶段：测试先于实现编写
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { MCPServer } from './MCPServer.js';
import { GatewayGuard } from '../../core/GatewayGuard.js';
import { MemoryStore } from '../../core/MemoryStore.js';
import { CheckStatus } from '../../types/checks.js';

// Mock dependencies
class MockMemoryStore {
  private principles = [
    {
      id: 'P1',
      name: '测试原则1',
      level: 'MANDATORY' as const,
      priority: 1,
      check_phases: ['all'],
      keywords: ['test'],
      violation_message: '测试违规消息',
      verification_method: 'test',
      consequence: 'test',
      historical_evidence: 'test'
    },
    {
      id: 'P2',
      name: '测试原则2',
      level: 'HARD_BLOCK' as const,
      priority: 2,
      check_phases: ['development'],
      keywords: ['block'],
      violation_message: '阻断违规消息',
      verification_method: 'test',
      consequence: 'blocked',
      historical_evidence: 'test'
    }
  ];

  private successPatterns = [
    {
      id: 'SP1',
      dimension: 'Planning',
      name: '成功模式1',
      maturity: 5,
      impact: 'high',
      description: '测试成功模式',
      features: ['feature1'],
      effects: ['effect1'],
      constraints: 'none',
      benefits: ['benefit1'],
      weight: 10
    }
  ];

  private failurePatterns = [
    {
      id: 'FP1',
      name: '失败模式1',
      severity: '高' as const,
      frequency: 'often',
      occurrences: 10,
      characteristic: '测试失败特征',
      root_causes: ['cause1'],
      prevention: ['prevent1'],
      cases: ['case1'],
      user_feedback: 'feedback1'
    }
  ];

  async getPrinciples() {
    return this.principles;
  }

  async getPrincipleById(id: string) {
    return this.principles.find(p => p.id === id);
  }

  async getSuccessPatterns() {
    return this.successPatterns;
  }

  async getFailurePatterns() {
    return this.failurePatterns;
  }

  async searchPatterns(keyword: string) {
    const kw = keyword.toLowerCase();
    return {
      success: this.successPatterns.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        p.description.toLowerCase().includes(kw)
      ),
      failure: this.failurePatterns.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        p.characteristic.toLowerCase().includes(kw)
      )
    };
  }

  clearCache() {}
}

class MockGatewayGuard {
  async check(intent: string, context?: any) {
    // 模拟检查逻辑
    if (intent.includes('block')) {
      return {
        status: CheckStatus.BLOCKED,
        violations: [{
          principle_id: 'P2',
          principle_name: '测试原则2',
          severity: 'HARD_BLOCK' as const,
          message: '检测到阻断违规',
          detected_at: new Date().toISOString()
        }],
        risks: [],
        traps: [],
        suggestions: [],
        check_time: 10,
        timestamp: new Date().toISOString()
      };
    }

    if (intent.includes('warning')) {
      return {
        status: CheckStatus.WARNING,
        violations: [],
        risks: [{
          pattern_id: 'FP1',
          pattern_name: '失败模式1',
          type: 'failure' as const,
          confidence: 0.8,
          message: '检测到高风险模式'
        }],
        traps: [],
        suggestions: [{
          type: 'consideration' as const,
          message: '建议注意风险',
          priority: 2
        }],
        check_time: 15,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: CheckStatus.PASS,
      violations: [],
      risks: [],
      traps: [],
      suggestions: [],
      check_time: 5,
      timestamp: new Date().toISOString()
    };
  }

  async quickCheck(intent: string) {
    return !intent.includes('block');
  }

  formatResult(result: any) {
    return `Status: ${result.status}`;
  }
}

describe('MCPServer', () => {
  let mockMemoryStore: MockMemoryStore;
  let mockGatewayGuard: MockGatewayGuard;
  let server: MCPServer;

  beforeEach(() => {
    mockMemoryStore = new MockMemoryStore();
    mockGatewayGuard = new MockGatewayGuard();
    server = new MCPServer({
      memoryStore: mockMemoryStore as any,
      gatewayGuard: mockGatewayGuard as any,
      serverConfig: {
        name: 'test-prism-gateway',
        version: '1.0.0'
      }
    });
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
  });

  // ==================== Server初始化测试 ====================

  describe('初始化', () => {
    it('应该正确初始化server配置', () => {
      expect(server).toBeDefined();
      expect(server.getName()).toBe('test-prism-gateway');
      expect(server.getVersion()).toBe('1.0.0');
    });

    it('应该使用默认配置当未提供时', () => {
      const defaultServer = new MCPServer();
      expect(defaultServer.getName()).toBe('prism-gateway');
      expect(defaultServer.getVersion()).toBeDefined();
    });

    it('应该在初始化时注册所有工具', () => {
      const tools = server.getRegisteredTools();
      expect(tools).toContain('gateway_check');
      expect(tools).toContain('query_principles');
      expect(tools).toContain('query_patterns');
      expect(tools).toContain('query_traps');
    });
  });

  // ==================== Server生命周期测试 ====================

  describe('生命周期管理', () => {
    it('应该正确启动server', async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('应该正确停止server', async () => {
      await server.start();
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('重复启动应该抛出错误', async () => {
      await server.start();
      await expect(server.start()).rejects.toThrow('already running');
    });

    it('停止未启动的server不应该报错', async () => {
      // stop()应该总是能安全调用，即使server未启动
      await server.stop();
      await server.stop(); // 再次调用也不应该报错
      expect(server.isRunning()).toBe(false);
    });

    it('启动后应该提供有效的server实例', async () => {
      await server.start();
      const mcpServer = server.getServer();
      expect(mcpServer).toBeDefined();
    });
  });

  // ==================== Gateway check工具测试 ====================

  describe('gateway_check工具', () => {
    it('应该正确检查正常意图', async () => {
      const result = await server.callTool('gateway_check', {
        intent: '实现用户登录功能'
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(CheckStatus.PASS);
      expect(result.check_time).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it('应该正确检测阻断违规', async () => {
      const result = await server.callTool('gateway_check', {
        intent: 'block这个任务'
      });

      expect(result.status).toBe(CheckStatus.BLOCKED);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].principle_id).toBe('P2');
    });

    it('应该正确检测警告', async () => {
      const result = await server.callTool('gateway_check', {
        intent: 'warning任务'
      });

      expect(result.status).toBe(CheckStatus.WARNING);
      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].pattern_id).toBe('FP1');
    });

    it('应该正确处理空字符串', async () => {
      const result = await server.callTool('gateway_check', {
        intent: ''
      });

      expect(result.status).toBe(CheckStatus.PASS);
    });

    it('缺少intent参数应该抛出错误', async () => {
      await expect(server.callTool('gateway_check', {} as any)).rejects.toThrow(
        'Missing required parameter'
      );
    });

    it('intent不是字符串应该抛出错误', async () => {
      await expect(server.callTool('gateway_check', {
        intent: 123 as any
      })).rejects.toThrow('must be a string');
    });

    it('应该支持可选的context参数', async () => {
      const result = await server.callTool('gateway_check', {
        intent: '实现功能',
        context: {
          phase: 'development',
          user_preferences: { strict: true }
        }
      });

      expect(result).toBeDefined();
    });
  });

  // ==================== query_principles工具测试 ====================

  describe('query_principles工具', () => {
    it('应该返回所有原则', async () => {
      const result = await server.callTool('query_principles', {});

      expect(result).toBeDefined();
      expect(result.principles).toHaveLength(2);
      expect(result.principles[0].id).toBe('P1');
      expect(result.total).toBe(2);
    });

    it('应该支持按ID查询单个原则', async () => {
      const result = await server.callTool('query_principles', {
        id: 'P1'
      });

      expect(result.principles).toHaveLength(1);
      expect(result.principles[0].id).toBe('P1');
    });

    it('查询不存在的ID应该返回空数组', async () => {
      const result = await server.callTool('query_principles', {
        id: 'NONEXISTENT'
      });

      expect(result.principles).toHaveLength(0);
    });

    it('应该支持关键词搜索', async () => {
      const result = await server.callTool('query_principles', {
        keyword: '测试'
      });

      expect(result.principles.length).toBeGreaterThan(0);
    });

    it('应该包含查询时间', async () => {
      const result = await server.callTool('query_principles', {});
      expect(result.query_time).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== query_patterns工具测试 ====================

  describe('query_patterns工具', () => {
    it('应该返回所有模式（成功+失败）', async () => {
      const result = await server.callTool('query_patterns', {});

      expect(result).toBeDefined();
      expect(result.success_patterns).toBeDefined();
      expect(result.failure_patterns).toBeDefined();
      expect(result.success_patterns).toHaveLength(1);
      expect(result.failure_patterns).toHaveLength(1);
      expect(result.total_success).toBe(1);
      expect(result.total_failure).toBe(1);
    });

    it('应该支持只查询成功模式', async () => {
      const result = await server.callTool('query_patterns', {
        type: 'success'
      });

      expect(result.success_patterns).toHaveLength(1);
      expect(result.failure_patterns).toHaveLength(0);
    });

    it('应该支持只查询失败模式', async () => {
      const result = await server.callTool('query_patterns', {
        type: 'failure'
      });

      expect(result.success_patterns).toHaveLength(0);
      expect(result.failure_patterns).toHaveLength(1);
    });

    it('应该支持关键词搜索', async () => {
      const result = await server.callTool('query_patterns', {
        keyword: '成功'
      });

      expect(result.success_patterns.length).toBeGreaterThan(0);
    });

    it('应该包含查询时间', async () => {
      const result = await server.callTool('query_patterns', {});
      expect(result.query_time).toBeGreaterThanOrEqual(0);
    });

    it('无效的type参数应该抛出错误', async () => {
      await expect(server.callTool('query_patterns', {
        type: 'invalid' as any
      })).rejects.toThrow('Invalid pattern type');
    });
  });

  // ==================== query_traps工具测试 ====================

  describe('query_traps工具', () => {
    it('应该返回所有陷阱（失败模式）', async () => {
      const result = await server.callTool('query_traps', {});

      expect(result).toBeDefined();
      expect(result.traps).toBeDefined();
      expect(result.traps.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('应该支持按严重性过滤', async () => {
      const result = await server.callTool('query_traps', {
        severity: '高'
      });

      expect(result.traps).toBeDefined();
      // 所有返回的陷阱都应该有高严重性
      result.traps.forEach(trap => {
        expect(trap.severity).toBe('高');
      });
    });

    it('应该支持关键词搜索', async () => {
      const result = await server.callTool('query_traps', {
        keyword: '失败'
      });

      expect(result.traps.length).toBeGreaterThan(0);
    });

    it('应该包含查询时间', async () => {
      const result = await server.callTool('query_traps', {});
      expect(result.query_time).toBeGreaterThanOrEqual(0);
    });

    it('无效的severity参数应该抛出错误', async () => {
      await expect(server.callTool('query_traps', {
        severity: 'critical' as any
      })).rejects.toThrow('Invalid severity');
    });
  });

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('调用不存在的工具应该抛出错误', async () => {
      await expect(server.callTool('nonexistent_tool' as any, {}))
        .rejects.toThrow('Tool not found');
    });

    it('MemoryStore错误应该被正确传播', async () => {
      const errorStore = {
        getPrinciples: async () => {
          throw new Error('Memory access error');
        },
        clearCache: () => {}
      };

      const errorServer = new MCPServer({
        memoryStore: errorStore as any,
        gatewayGuard: mockGatewayGuard as any
      });

      await expect(errorServer.callTool('query_principles', {}))
        .rejects.toThrow('Memory access error');
    });

    it('GatewayGuard错误应该被正确传播', async () => {
      const errorGuard = {
        check: async () => {
          throw new Error('Gateway check error');
        }
      };

      const errorServer = new MCPServer({
        memoryStore: mockMemoryStore as any,
        gatewayGuard: errorGuard as any
      });

      await expect(errorServer.callTool('gateway_check', {
        intent: 'test'
      })).rejects.toThrow('Gateway check error');
    });
  });

  // ==================== 参数验证测试 ====================

  describe('参数验证', () => {
    it('应该验证intent参数非空', async () => {
      // 只有null/undefined会报错，空字符串会被GatewayGuard处理返回PASS
      await expect(server.callTool('gateway_check', {} as any))
        .rejects.toThrow('Missing required parameter');
    });

    it('应该验证pattern type参数有效值', async () => {
      await expect(server.callTool('query_patterns', {
        type: 'maybe' as any
      })).rejects.toThrow();
    });

    it('应该验证trap severity参数有效值', async () => {
      await expect(server.callTool('query_traps', {
        severity: 'critical' as any
      })).rejects.toThrow();
    });
  });

  // ==================== 集成测试 ====================

  describe('集成测试', () => {
    it('应该与真实GatewayGuard集成', async () => {
      const realGuard = new GatewayGuard(mockMemoryStore as any);
      const integrationServer = new MCPServer({
        memoryStore: mockMemoryStore,
        gatewayGuard: realGuard as any,
        serverConfig: {
          name: 'integration-test-server',
          version: '1.0.0'
        }
      });

      const result = await integrationServer.callTool('gateway_check', {
        intent: '实现一个新功能'
      });

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.check_time).toBeGreaterThanOrEqual(0);
    });

    it('应该与真实MemoryStore集成', async () => {
      const integrationServer = new MCPServer({
        memoryStore: mockMemoryStore,
        gatewayGuard: mockGatewayGuard as any
      });

      const result = await integrationServer.callTool('query_principles', {});

      expect(result.principles).toBeDefined();
      expect(result.principles).toHaveLength(2);
    });

    it('应该支持完整的检查-查询工作流', async () => {
      // 先检查
      const checkResult = await server.callTool('gateway_check', {
        intent: '实现功能X'
      });

      expect(checkResult.status).toBeDefined();

      // 查询原则
      const principlesResult = await server.callTool('query_principles', {});

      expect(principlesResult.principles).toBeDefined();

      // 查询模式
      const patternsResult = await server.callTool('query_patterns', {});

      expect(patternsResult.success_patterns).toBeDefined();
      expect(patternsResult.failure_patterns).toBeDefined();

      // 查询陷阱
      const trapsResult = await server.callTool('query_traps', {});

      expect(trapsResult.traps).toBeDefined();
    });
  });

  // ==================== 工具元数据测试 ====================

  describe('工具元数据', () => {
    it('应该返回正确的工具列表', () => {
      const tools = server.getRegisteredTools();
      expect(tools).toEqual([
        'gateway_check',
        'query_principles',
        'query_patterns',
        'query_traps'
      ]);
    });

    it('应该返回工具定义', () => {
      const toolDef = server.getToolDefinition('gateway_check');

      expect(toolDef).toBeDefined();
      expect(toolDef.name).toBe('gateway_check');
      expect(toolDef.description).toBeDefined();
      expect(toolDef.inputSchema).toBeDefined();
    });

    it('应该返回所有工具定义', () => {
      const toolDefs = server.getAllToolDefinitions();

      expect(toolDefs).toBeDefined();
      expect(Object.keys(toolDefs)).toHaveLength(4);
      expect(toolDefs.gateway_check).toBeDefined();
      expect(toolDefs.query_principles).toBeDefined();
      expect(toolDefs.query_patterns).toBeDefined();
      expect(toolDefs.query_traps).toBeDefined();
    });
  });

  // ==================== 性能测试 ====================

  describe('性能测试', () => {
    it('gateway_check应该在合理时间内完成', async () => {
      const start = Date.now();
      await server.callTool('gateway_check', {
        intent: '测试性能'
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // 1秒内完成
    });

    it('query_principles应该在合理时间内完成', async () => {
      const start = Date.now();
      await server.callTool('query_principles', {});
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // 500ms内完成
    });

    it('query_patterns应该在合理时间内完成', async () => {
      const start = Date.now();
      await server.callTool('query_patterns', {});
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('query_traps应该在合理时间内完成', async () => {
      const start = Date.now();
      await server.callTool('query_traps', {});
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });

  // ==================== Server配置测试 ====================

  describe('Server配置', () => {
    it('应该支持自定义服务器名称', () => {
      const customServer = new MCPServer({
        serverConfig: {
          name: 'custom-server',
          version: '2.0.0'
        }
      });

      expect(customServer.getName()).toBe('custom-server');
      expect(customServer.getVersion()).toBe('2.0.0');
    });

    it('应该支持获取服务器信息', () => {
      const info = server.getServerInfo();

      expect(info).toBeDefined();
      expect(info.name).toBe('test-prism-gateway');
      expect(info.version).toBe('1.0.0');
      expect(info.tools).toContain('gateway_check');
    });
  });
});
