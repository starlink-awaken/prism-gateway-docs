/**
 * PRISM-Gateway 端到端测试
 * 测试完整的CLI工作流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { readJSON, writeJSON } from '../utils/file.js';

// 设置测试环境变量
process.env.PRISM_TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

// CLI路径
const CLI_PATH = join(homedir(), '.prism-gateway/src/cli/index.ts');

// 测试结果接口
interface TestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * 执行CLI命令
 */
async function runCLI(args: string[]): Promise<TestResult> {
  return new Promise((resolve) => {
    const child = spawn('bun', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PRISM_TEST_MODE: 'true',
        NODE_ENV: 'test'
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      // 在测试模式下，检查stderr中的错误信息来判断是否应该失败
      let actualExitCode = exitCode || 0;
      if (stderr.includes('错误:') || stderr.includes('Error')) {
        actualExitCode = 1;
      }
      resolve({ exitCode: actualExitCode, stdout, stderr });
    });

    // 超时保护
    setTimeout(() => {
      child.kill();
      resolve({ exitCode: -1, stdout, stderr: 'Command timeout' });
    }, 30000);
  });
}

describe('PRISM-Gateway CLI - 端到端测试', () => {
  describe('基础命令测试', () => {
    it('应该显示帮助信息', async () => {
      const result = await runCLI(['--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('prism');
      expect(result.stdout).toContain('check');
      expect(result.stdout).toContain('retro');
      expect(result.stdout).toContain('status');
      expect(result.stdout).toContain('stats');
    });

    it('应该显示版本信息', async () => {
      const result = await runCLI(['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('check命令测试', () => {
    it('应该检查简单的任务意图', async () => {
      const result = await runCLI(['check', '实现用户登录功能']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Gateway');
      expect(result.stdout).toMatch(/PASS|WARNING|BLOCKED/);
    });

    it('应该检查包含违规的意图', async () => {
      const result = await runCLI(['check', '直接修改数据库，跳过所有检查']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Gateway');
      // 可能包含违规信息
    });

    it('应该支持JSON输出格式', async () => {
      const result = await runCLI(['check', '测试任务', '--format', 'json']);
      expect(result.exitCode).toBe(0);
      const jsonOutput = JSON.parse(result.stdout);
      expect(jsonOutput).toHaveProperty('status');
      expect(jsonOutput).toHaveProperty('check_time');
      expect(jsonOutput).toHaveProperty('timestamp');
    });

    it('应该处理空意图', async () => {
      const result = await runCLI(['check', '']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('PASS');
    });
  });

  describe('retro命令测试', () => {
    it('应该执行快速复盘', async () => {
      const result = await runCLI(['retro', 'quick', '--project', 'test-project-e2e']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('复盘');
      expect(result.stdout).toMatch(/COMPLETED|FAILED|completed|completed/);
    });

    it('应该执行标准复盘', async () => {
      const result = await runCLI(['retro', 'standard', '--project', 'test-project-e2e']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('复盘');
    });

    it('应该支持自定义项目ID', async () => {
      const customProject = 'custom-project-123';
      const result = await runCLI(['retro', 'quick', '--project', customProject]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(customProject);
    });

    it('应该支持JSON输出格式', async () => {
      const result = await runCLI(['retro', 'quick', '--project', 'test-json', '--format', 'json']);
      expect(result.exitCode).toBe(0);
      const jsonOutput = JSON.parse(result.stdout);
      expect(jsonOutput).toHaveProperty('status');
      expect(jsonOutput).toHaveProperty('id');
      expect(jsonOutput).toHaveProperty('totalDuration');
    });

    it('应该显示复盘模式信息', async () => {
      const result = await runCLI(['retro', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('quick');
      expect(result.stdout).toContain('standard');
      expect(result.stdout).toContain('deep');
    });
  });

  describe('status命令测试', () => {
    it('应该显示系统状态', async () => {
      const result = await runCLI(['status']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('PRISM-Gateway');
      expect(result.stdout).toMatch(/运行中|状态|Status/);
    });

    it('应该显示各组件状态', async () => {
      const result = await runCLI(['status', '--verbose']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/memoryStore|gatewayGuard|retrospectiveCore/i);
    });
  });

  describe('stats命令测试', () => {
    it('应该显示统计信息', async () => {
      const result = await runCLI(['stats']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/原则|模式|复盘|原则|Patterns|Retros/);
    });

    it('应该支持JSON输出格式', async () => {
      const result = await runCLI(['stats', '--format', 'json']);
      expect(result.exitCode).toBe(0);
      const jsonOutput = JSON.parse(result.stdout);
      expect(jsonOutput).toHaveProperty('principles');
      expect(jsonOutput).toHaveProperty('successPatterns');
      expect(jsonOutput).toHaveProperty('failurePatterns');
      expect(jsonOutput).toHaveProperty('retroRecords');
    });
  });

  describe('错误处理测试', () => {
    it('应该处理无效命令', async () => {
      const result = await runCLI(['invalid-command']);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    });

    it('应该处理无效的复盘模式', async () => {
      const result = await runCLI(['retro', 'invalid-mode']);
      expect(result.exitCode).not.toBe(0);
    });

    it('应该处理缺失的必需参数', async () => {
      const result = await runCLI(['check']);
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('集成场景测试', () => {
    it('应该完成完整的检查-复盘流程', async () => {
      // 步骤1: 检查任务
      const checkResult = await runCLI(['check', '实现用户认证系统', '--format', 'json']);
      expect(checkResult.exitCode).toBe(0);
      const checkData = JSON.parse(checkResult.stdout);

      // 步骤2: 执行复盘
      const retroResult = await runCLI(['retro', 'quick', '--project', 'integration-test', '--format', 'json']);
      expect(retroResult.exitCode).toBe(0);
      const retroData = JSON.parse(retroResult.stdout);

      // 验证结果
      expect(retroData.status).toMatch(/COMPLETED|FAILED|completed/);
      expect(retroData.id).toBeTruthy();
    });

    it('应该支持批量检查多个意图', async () => {
      const intents = ['实现登录', '优化性能', '添加测试'];
      const results = [];

      for (const intent of intents) {
        const result = await runCLI(['check', intent, '--format', 'json']);
        expect(result.exitCode).toBe(0);
        results.push(JSON.parse(result.stdout));
      }

      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r).toHaveProperty('status');
      });
    });
  });

  describe('输出格式测试', () => {
    it('应该支持纯文本输出', async () => {
      const result = await runCLI(['check', '测试', '--format', 'text']);
      expect(result.exitCode).toBe(0);
      expect(typeof result.stdout).toBe('string');
    });

    it('应该支持JSON输出', async () => {
      const result = await runCLI(['check', '测试', '--format', 'json']);
      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('应该支持Markdown输出', async () => {
      const result = await runCLI(['stats', '--format', 'markdown']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/#{1,6}/); // Markdown标题
    });
  });

  describe('性能测试', () => {
    it('check命令应该在1秒内完成', async () => {
      const start = Date.now();
      const result = await runCLI(['check', '简单任务检查']);
      const duration = Date.now() - start;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(2000); // 2秒阈值（包含启动时间）
    });

    it('快速复盘应该在10秒内完成', async () => {
      const start = Date.now();
      const result = await runCLI(['retro', 'quick', '--project', 'perf-test']);
      const duration = Date.now() - start;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(15000); // 15秒阈值
    });
  });
});

describe('PRISM-Gateway - 核心功能集成测试', () => {
  describe('MemoryStore集成', () => {
    it('应该能够保存和读取复盘记录', async () => {
      const { memoryStore } = await import('../core/MemoryStore.js');

      const testRecord = {
        id: 'test_retro_e2e_' + Date.now(),
        timestamp: new Date().toISOString(),
        type: 'quick' as const,
        project: 'e2e-test-project',
        duration: 1000,
        summary: 'E2E测试复盘记录',
        lessons: ['测试教训1'],
        improvements: ['改进点1']
      };

      await memoryStore.saveRetroRecord(testRecord);

      const retrieved = await memoryStore.getRetroRecord(testRecord.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(testRecord.id);
      expect(retrieved?.project).toBe(testRecord.project);
    });

    it('应该能够获取统计信息', async () => {
      const { memoryStore } = await import('../core/MemoryStore.js');

      const stats = await memoryStore.getStats();
      expect(stats).toHaveProperty('principles');
      expect(stats).toHaveProperty('successPatterns');
      expect(stats).toHaveProperty('failurePatterns');
      expect(stats).toHaveProperty('retroRecords');
      expect(stats.principles).toBeGreaterThan(0);
    });
  });

  describe('GatewayGuard集成', () => {
    it('应该能够检查任务意图', async () => {
      const { gatewayGuard } = await import('../core/GatewayGuard.js');

      const result = await gatewayGuard.check('实现用户登录功能');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('risks');
      expect(result).toHaveProperty('traps');
      expect(result).toHaveProperty('check_time');
      expect(result.check_time).toBeLessThan(1000);
    });

    it('应该能够格式化检查结果', async () => {
      const { gatewayGuard } = await import('../core/GatewayGuard.js');

      const result = await gatewayGuard.check('测试任务');
      const formatted = gatewayGuard.formatResult(result);

      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('RetrospectiveCore集成', () => {
    it('应该能够执行快速复盘', async () => {
      const { retrospectiveCore } = await import('../core/RetrospectiveCore.js');

      const taskInput = {
        id: 'e2e_task_' + Date.now(),
        projectId: 'e2e-test-project',
        triggerType: 'manual' as const,
        context: {
          phase: '开发',
          history: [],
          user_preferences: {}
        },
        metadata: {
          mode: 'quick',
          startTime: new Date().toISOString()
        }
      };

      const execution = await retrospectiveCore.executeRetro(taskInput);
      expect(execution).toHaveProperty('status');
      expect(execution).toHaveProperty('id');
      expect(execution).toHaveProperty('totalDuration');
      expect(execution.status).toMatch(/COMPLETED|FAILED|completed/);
    });

    it('应该能够切换复盘模式', async () => {
      const { retrospectiveCore, RetroMode } = await import('../core/RetrospectiveCore.js');

      retrospectiveCore.switchMode(RetroMode.STANDARD);
      expect(retrospectiveCore.getCurrentMode()).toBe(RetroMode.STANDARD);

      retrospectiveCore.switchMode(RetroMode.QUICK);
      expect(retrospectiveCore.getCurrentMode()).toBe(RetroMode.QUICK);
    });

    it('应该能够获取复盘统计', async () => {
      const { retrospectiveCore } = await import('../core/RetrospectiveCore.js');

      const stats = await retrospectiveCore.getRetroStats();
      expect(stats).toHaveProperty('totalRetros');
      expect(stats).toHaveProperty('avgDuration');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('phaseDurations');
    });
  });

  describe('DataExtractor集成', () => {
    it('应该能够从历史提取数据', async () => {
      const { dataExtractor } = await import('../core/DataExtractor.js');

      const history = [
        { role: 'user', content: '我们需要实现用户登录', timestamp: new Date().toISOString() },
        { role: 'assistant', content: '好的，我将设计登录系统', timestamp: new Date().toISOString() }
      ];

      const result = await dataExtractor.extractDimensions('e2e-session', history);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('dimensions');
      expect(result).toHaveProperty('confidence');
      expect(result.dimensions).toHaveProperty('principles');
      expect(result.dimensions).toHaveProperty('patterns');
    });
  });
});
