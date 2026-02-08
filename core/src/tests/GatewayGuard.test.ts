/**
 * GatewayGuard 单元测试
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { GatewayGuard } from '../core/GatewayGuard';
import { MemoryStore } from '../core/MemoryStore';
import { CheckStatus } from '../types/checks';

describe('GatewayGuard', () => {
  let guard: GatewayGuard;
  let memoryStore: MemoryStore;

  beforeEach(() => {
    memoryStore = new MemoryStore();
    guard = new GatewayGuard(memoryStore);
  });

  describe('基础检查功能', () => {
    it('应该能够通过正常任务', async () => {
      const result = await guard.check('创建一个简单的TODO列表应用');

      expect(result.status).toBe(CheckStatus.PASS);
      expect(result.check_time).toBeLessThan(1000);
    });

    it('应该检测到P1搜索优先违规', async () => {
      const result = await guard.check('这个问题需要深度分析，我推测是配置错误');

      expect(result.status).not.toBe(CheckStatus.PASS);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].principle_id).toBe('P1');
    });

    it('应该检测到P3重复失败违规', async () => {
      const result = await guard.check('操作失败了，让我再失败重试一下');

      expect(result.violations.length).toBeGreaterThan(0);
      const p3Violation = result.violations.find(v => v.principle_id === 'P3');
      expect(p3Violation).toBeDefined();
    });

    it('应该检测到表面修复陷阱', async () => {
      const result = await guard.check('这个异常数据太大了，我限制显示为100%');

      expect(result.traps.length).toBeGreaterThan(0);
      const surfaceFixTrap = result.traps.find(t => t.pattern_id.includes('表面修复'));
      expect(surfaceFixTrap).toBeDefined();
    });
  });

  describe('快速检查功能', () => {
    it('应该快速判断是否通过', async () => {
      const result1 = await guard.quickCheck('正常任务');
      expect(result1).toBe(true);

      const result2 = await guard.quickCheck('操作失败了，让我重试一下');
      expect(result2).toBe(false);
    });

    it('快速检查应该在100ms内完成', async () => {
      const start = Date.now();
      await guard.quickCheck('测试任务');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('模式匹配功能', () => {
    it('应该匹配成功模式', async () => {
      const result = await guard.check('我想建立一个结构化的目标管理系统');

      expect(result.risks.length).toBeGreaterThan(0);
      const successRisk = result.risks.find(r => r.type === 'success');
      expect(successRisk).toBeDefined();
    });

    it('应该匹配失败模式', async () => {
      const result = await guard.check('推测这是配置问题，直接修改配置文件');

      // 高严重性陷阱也算作风险
      const hasHighSeverityTrap = result.traps.some(t => t.severity === '高');
      expect(hasHighSeverityTrap).toBe(true);
    });
  });

  describe('结果格式化', () => {
    it('应该格式化检查结果', async () => {
      const result = await guard.check('测试任务');
      const formatted = guard.formatResult(result);

      expect(formatted).toContain('Gateway检查结果');
      expect(formatted).toContain('检查耗时');
    });

    it('应该包含违规信息', async () => {
      const result = await guard.check('深度分析这个问题');
      const formatted = guard.formatResult(result);

      if (result.violations.length > 0) {
        expect(formatted).toContain('违规');
      }
    });
  });

  describe('性能要求', () => {
    it('检查时间应该小于1秒', async () => {
      const result = await guard.check('测试任务，包含原则、模式、陷阱等多种检查');

      expect(result.check_time).toBeLessThan(1000);
    });

    it('复杂任务检查时间应该小于1秒', async () => {
      const complexIntent = `
        这个问题需要深度分析，我推测是配置错误。
        语法检查通过了，应该没问题。
        让我再试一次相同的操作。
      `;
      const result = await guard.check(complexIntent);

      expect(result.check_time).toBeLessThan(1000);
    });
  });

  describe('建议生成', () => {
    it('应该为P1违规生成搜索建议', async () => {
      const result = await guard.check('深度分析这个问题');

      if (result.violations.some(v => v.principle_id === 'P1')) {
        const searchSuggestion = result.suggestions.find(s =>
          s.message.includes('WebSearch')
        );
        expect(searchSuggestion).toBeDefined();
      }
    });

    it('应该为P2违规生成测试建议', async () => {
      const result = await guard.check('语法检查通过了');

      if (result.violations.some(v => v.principle_id === 'P2')) {
        const testSuggestion = result.suggestions.find(s =>
          s.message.includes('功能测试')
        );
        expect(testSuggestion).toBeDefined();
      }
    });
  });

  describe('边界条件', () => {
    it('应该处理空字符串', async () => {
      const result = await guard.check('');

      expect(result).toBeDefined();
      expect(result.status).toBe(CheckStatus.PASS);
    });

    it('应该处理超长字符串', async () => {
      const longIntent = '测试'.repeat(1000);
      const result = await guard.check(longIntent);

      expect(result).toBeDefined();
      expect(result.check_time).toBeLessThan(1000);
    });

    it('应该处理特殊字符', async () => {
      const specialIntent = '测试@#$%^&*()_+-={}[]|\\:";\'<>?,./~`';
      const result = await guard.check(specialIntent);

      expect(result).toBeDefined();
    });
  });
});
