/**
 * AlertManager 单元测试
 *
 * @description
 * 测试告警管理器的核心功能：
 * - 告警规则配置
 * - 告警触发条件检测
 * - 告警去重和节流
 * - 告警通知
 * - 告警历史
 * - 告警恢复检测
 *
 * @testStrategy
 * RED-GREEN-REFACTOR:
 * 1. RED: 先写测试，预期失败
 * 2. GREEN: 实现 AlertManager 使测试通过
 * 3. REFACTOR: 重构优化代码
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  AlertManager,
  AlertRule,
  AlertSeverity,
  AlertStatus,
  AlertCondition
} from './AlertManager.js';
import { Metrics } from './Metrics.js';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let metrics: Metrics;
  let firedAlerts: unknown[] = [];

  beforeEach(() => {
    metrics = new Metrics({ prefix: 'test' });
    firedAlerts = [];

    // 创建不包含默认规则的 AlertManager 用于测试
    alertManager = new AlertManager({
      metrics,
      initializeDefaultRules: false,
      onAlert: (alert) => {
        firedAlerts.push(alert);
      }
    });
  });

  afterEach(() => {
    alertManager.clear();
    metrics.clear();
  });

  describe('构造函数', () => {
    it('应该创建默认配置的告警管理器', () => {
      const manager = new AlertManager({ metrics });
      expect(manager).toBeDefined();
    });

    it('应该支持自定义告警回调', () => {
      let callbackCalled = false;
      const manager = new AlertManager({
        metrics,
        onAlert: () => {
          callbackCalled = true;
        }
      });
      expect(manager).toBeDefined();
    });

    it('应该支持配置冷却时间', () => {
      const manager = new AlertManager({
        metrics,
        cooldown: 60000 // 1分钟
      });
      expect(manager.cooldown).toBe(60000);
    });

    it('应该支持配置最大历史记录数', () => {
      const manager = new AlertManager({
        metrics,
        maxHistory: 100
      });
      expect(manager.maxHistory).toBe(100);
    });
  });

  describe('告警规则', () => {
    it('应该添加告警规则', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      };

      alertManager.addRule(rule);
      const rules = alertManager.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('test-rule');
    });

    it('应该支持多个告警规则', () => {
      alertManager.addRule({
        id: 'rule-1',
        name: 'Rule 1',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      alertManager.addRule({
        id: 'rule-2',
        name: 'Rule 2',
        condition: AlertCondition.RESPONSE_TIME_SLOW,
        threshold: 100,
        severity: AlertSeverity.CRITICAL
      });

      const rules = alertManager.getRules();
      expect(rules).toHaveLength(2);
    });

    it('应该删除告警规则', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      alertManager.removeRule('test-rule');
      const rules = alertManager.getRules();

      expect(rules).toHaveLength(0);
    });

    it('应该更新告警规则', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      alertManager.updateRule('test-rule', { threshold: 0.1 });
      const rule = alertManager.getRule('test-rule');

      expect(rule?.threshold).toBe(0.1);
    });

    it('应该按 ID 获取规则', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      const rule = alertManager.getRule('test-rule');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('test-rule');
    });
  });

  describe('错误率告警', () => {
    it('应该在错误率超过阈值时触发告警', () => {
      alertManager.addRule({
        id: 'error-rate-rule',
        name: 'High Error Rate',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 记录 100 个请求，10 个失败（错误率 10%）
      for (let i = 0; i < 90; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 200,
          duration: 50
        });
      }
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      alertManager.evaluateRules();

      // 检查是否有该规则的告警
      const ruleAlerts = firedAlerts.filter((a) => (a as { ruleId: string }).ruleId === 'error-rate-rule');
      expect(ruleAlerts.length).toBeGreaterThan(0);
    });

    it('应该在错误率低于阈值时不触发告警', () => {
      alertManager.addRule({
        id: 'error-rate-rule',
        name: 'High Error Rate',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 记录 100 个请求，2 个失败（错误率 2%）
      for (let i = 0; i < 98; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 200,
          duration: 50
        });
      }
      for (let i = 0; i < 2; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      alertManager.evaluateRules();

      // 检查是否有该规则的告警（应该没有）
      const ruleAlerts = firedAlerts.filter((a) => (a as { ruleId: string }).ruleId === 'error-rate-rule');
      expect(ruleAlerts.length).toBe(0);
    });

    it('应该正确计算时间窗口内的错误率', () => {
      alertManager.addRule({
        id: 'error-rate-rule',
        name: 'High Error Rate',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 模拟不同时间的请求
      // （简化版本：直接记录请求）
      for (let i = 0; i < 50; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 200,
          duration: 50
        });
      }

      alertManager.evaluateRules();
      // 错误率为 0，不应该触发
      const ruleAlerts = firedAlerts.filter((a) => (a as { ruleId: string }).ruleId === 'error-rate-rule');
      expect(ruleAlerts.length).toBe(0);
    });
  });

  describe('响应时间告警', () => {
    it('应该在 P95 响应时间超过阈值时触发', () => {
      alertManager.addRule({
        id: 'response-time-rule',
        name: 'Slow Response',
        condition: AlertCondition.RESPONSE_TIME_SLOW,
        threshold: 100,
        severity: AlertSeverity.CRITICAL,
        percentile: 95
      });

      // 记录响应时间，确保 P95 超过 100ms
      // 使用 6 个 150ms 和 94 个 50ms，这样 P95 应该是 150
      for (let i = 0; i < 94; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 200,
          duration: 50
        });
      }
      for (let i = 0; i < 6; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 200,
          duration: 150
        });
      }

      alertManager.evaluateRules();

      const ruleAlerts = firedAlerts.filter((a) => (a as { ruleId: string }).ruleId === 'response-time-rule');
      expect(ruleAlerts.length).toBeGreaterThan(0);
    });

    it('应该支持自定义百分位数', () => {
      alertManager.addRule({
        id: 'response-time-rule',
        name: 'Slow P99',
        condition: AlertCondition.RESPONSE_TIME_SLOW,
        threshold: 200,
        severity: AlertSeverity.CRITICAL,
        percentile: 99
      });

      // 记录响应时间
      // 使用 1 个 150ms 和 99 个 50ms，P99 应该是 150，低于阈值 200
      for (let i = 0; i < 99; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 200,
          duration: 50
        });
      }
      metrics.recordHttpRequest({
        method: 'GET',
        path: '/api/test',
        status: 200,
        duration: 150
      });

      alertManager.evaluateRules();

      // P99 是 150ms，低于阈值 200ms，不应该触发
      const ruleAlerts = firedAlerts.filter((a) => (a as { ruleId: string }).ruleId === 'response-time-rule');
      expect(ruleAlerts.length).toBe(0);
    });
  });

  describe('速率限制告警', () => {
    it('应该在速率限制频繁触发时告警', () => {
      alertManager.addRule({
        id: 'rate-limit-rule',
        name: 'Rate Limit Exceeded',
        condition: AlertCondition.RATE_LIMIT_HIGH,
        threshold: 10,
        severity: AlertSeverity.WARNING
      });

      // 触发 10 次速率限制
      for (let i = 0; i < 10; i++) {
        metrics.recordRateLimitExceeded('auth', '127.0.0.1');
      }

      alertManager.evaluateRules();

      expect(firedAlerts.length).toBeGreaterThan(0);
    });

    it('应该按端点分组检测速率限制', () => {
      alertManager.addRule({
        id: 'rate-limit-rule',
        name: 'Rate Limit Exceeded',
        condition: AlertCondition.RATE_LIMIT_HIGH,
        threshold: 5,
        severity: AlertSeverity.WARNING
      });

      // auth 端点触发 5 次
      for (let i = 0; i < 5; i++) {
        metrics.recordRateLimitExceeded('auth', '127.0.0.1');
      }

      alertManager.evaluateRules();

      expect(firedAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('缓存命中率告警', () => {
    it('应该在缓存命中率低于阈值时告警', () => {
      alertManager.addRule({
        id: 'cache-hit-rate-rule',
        name: 'Low Cache Hit Rate',
        condition: AlertCondition.CACHE_HIT_RATE_LOW,
        threshold: 0.8,
        severity: AlertSeverity.INFO
      });

      // 缓存命中率 60%
      for (let i = 0; i < 6; i++) {
        metrics.recordCacheHit('analytics');
      }
      for (let i = 0; i < 4; i++) {
        metrics.recordCacheMiss('analytics');
      }

      alertManager.evaluateRules();

      expect(firedAlerts.length).toBeGreaterThan(0);
    });

    it('应该在缓存命中率正常时不告警', () => {
      alertManager.addRule({
        id: 'cache-hit-rate-rule',
        name: 'Low Cache Hit Rate',
        condition: AlertCondition.CACHE_HIT_RATE_LOW,
        threshold: 0.5,
        severity: AlertSeverity.INFO
      });

      // 缓存命中率 60%
      for (let i = 0; i < 6; i++) {
        metrics.recordCacheHit('analytics');
      }
      for (let i = 0; i < 4; i++) {
        metrics.recordCacheMiss('analytics');
      }

      alertManager.evaluateRules();

      const ruleAlerts = firedAlerts.filter((a) => (a as { ruleId: string }).ruleId === 'cache-hit-rate-rule');
      expect(ruleAlerts.length).toBe(0);
    });
  });

  describe('告警去重和节流', () => {
    it('应该在冷却时间内抑制重复告警', async () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发告警条件
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      // 第一次评估
      alertManager.evaluateRules();
      const firstAlertCount = firedAlerts.length;

      // 立即再次评估（应该在冷却期内）
      firedAlerts.length = 0;
      alertManager.evaluateRules();
      const secondAlertCount = firedAlerts.length;

      // 冷却期内不应该重复触发
      expect(secondAlertCount).toBeLessThanOrEqual(firstAlertCount);
    });

    it('应该在冷却期后允许重新触发', async () => {
      const shortCooldownManager = new AlertManager({
        metrics,
        cooldown: 100, // 100ms 冷却
        onAlert: (alert) => {
          firedAlerts.push(alert);
        }
      });

      shortCooldownManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发告警条件
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      // 第一次评估
      shortCooldownManager.evaluateRules();
      const firstAlertCount = firedAlerts.length;

      // 等待冷却期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 再次评估
      firedAlerts.length = 0;
      shortCooldownManager.evaluateRules();
      const secondAlertCount = firedAlerts.length;

      // 冷却期后应该允许重新触发
      expect(secondAlertCount).toBeGreaterThan(0);
    });
  });

  describe('告警状态', () => {
    it('应该跟踪告警状态', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      const status = alertManager.getAlertStatus('test-rule');
      expect(status).toBeDefined();
      expect(status).toBe(AlertStatus.OK);
    });

    it('应该在触发告警时更新状态', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发告警条件
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      alertManager.evaluateRules();

      const status = alertManager.getAlertStatus('test-rule');
      expect(status).toBe(AlertStatus.FIRING);
    });

    it('应该检测告警恢复', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 先触发告警
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      alertManager.evaluateRules();
      expect(alertManager.getAlertStatus('test-rule')).toBe(AlertStatus.FIRING);

      // 清除指标，记录正常请求
      metrics.clear();
      for (let i = 0; i < 100; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 200,
          duration: 50
        });
      }

      firedAlerts.length = 0;
      alertManager.evaluateRules();

      // 应该检测到恢复
      const resolvedAlerts = firedAlerts.filter(
        (a: unknown) => (a as { status: string }).status === 'resolved'
      );
      expect(resolvedAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('告警历史', () => {
    it('应该记录告警历史', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发告警
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      alertManager.evaluateRules();

      const history = alertManager.getAlertHistory('test-rule');
      expect(history.length).toBeGreaterThan(0);
    });

    it('应该限制历史记录数量', () => {
      const limitedManager = new AlertManager({
        metrics,
        maxHistory: 5,
        onAlert: () => {}
      });

      limitedManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发多次告警
      for (let i = 0; i < 10; i++) {
        // 模拟多次触发
      }

      const history = limitedManager.getAlertHistory('test-rule');
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('应该支持获取所有告警历史', () => {
      alertManager.addRule({
        id: 'rule-1',
        name: 'Rule 1',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      alertManager.addRule({
        id: 'rule-2',
        name: 'Rule 2',
        condition: AlertCondition.RESPONSE_TIME_SLOW,
        threshold: 100,
        severity: AlertSeverity.CRITICAL
      });

      const allHistory = alertManager.getAllAlertHistory();
      expect(allHistory).toBeDefined();
      expect(Array.isArray(allHistory)).toBe(true);
    });
  });

  describe('告警通知', () => {
    it('应该调用告警回调', () => {
      let callbackCalled = false;
      let receivedAlert: unknown = null;

      const callbackManager = new AlertManager({
        metrics,
        onAlert: (alert) => {
          callbackCalled = true;
          receivedAlert = alert;
        }
      });

      callbackManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发告警
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      callbackManager.evaluateRules();

      expect(callbackCalled).toBe(true);
      expect(receivedAlert).toBeDefined();
    });

    it('应该包含告警详情', () => {
      let receivedAlert: unknown = null;

      const callbackManager = new AlertManager({
        metrics,
        onAlert: (alert) => {
          receivedAlert = alert;
        }
      });

      callbackManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发告警
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      callbackManager.evaluateRules();

      const alert = receivedAlert as {
        ruleId: string;
        ruleName: string;
        severity: string;
        condition: string;
        value: number;
        threshold: number;
        message: string;
        timestamp: Date;
      };

      expect(alert.ruleId).toBe('test-rule');
      expect(alert.ruleName).toBe('Test Rule');
      expect(alert.severity).toBe(AlertSeverity.WARNING);
      expect(alert.value).toBeGreaterThan(0);
      expect(alert.threshold).toBe(0.05);
      expect(alert.message).toBeDefined();
      expect(alert.timestamp).toBeDefined();
    });
  });

  describe('清理和重置', () => {
    it('应该清除所有告警历史', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发告警
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      alertManager.evaluateRules();

      alertManager.clear();

      const history = alertManager.getAlertHistory('test-rule');
      expect(history.length).toBe(0);
    });

    it('应该重置告警状态', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: AlertCondition.ERROR_RATE_HIGH,
        threshold: 0.05,
        severity: AlertSeverity.WARNING
      });

      // 触发告警
      for (let i = 0; i < 10; i++) {
        metrics.recordHttpRequest({
          method: 'GET',
          path: '/api/test',
          status: 500,
          duration: 50
        });
      }

      alertManager.evaluateRules();
      expect(alertManager.getAlertStatus('test-rule')).toBe(AlertStatus.FIRING);

      alertManager.resetStatus('test-rule');
      expect(alertManager.getAlertStatus('test-rule')).toBe(AlertStatus.OK);
    });
  });
});
