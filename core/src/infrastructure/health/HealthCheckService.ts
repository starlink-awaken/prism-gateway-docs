/**
 * PRISM-Gateway Health Check Service
 *
 * @module infrastructure/health/HealthCheckService
 */

import { homedir } from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { HealthScheduler } from './HealthScheduler.js';
import { SystemHealthChecker, DiskHealthChecker, DataHealthChecker, APIHealthChecker } from './checkers.js';
import type { HealthChecker } from './HealthChecker.js';
import type {
  HealthReport,
  HealthStatus,
  HealthCheckResult,
  HealthStats,
  HealthCheckFilter,
  HealthHistoryEntry,
  HealthAlertConfig,
  HealthScheduleConfig,
  SelfHealingAction
} from './types.js';

/**
 * Health check service configuration
 */
export interface HealthCheckServiceConfig {
  /** Data root directory */
  dataRoot?: string;
  /** History directory for check results */
  historyRoot?: string;
  /** Maximum history entries to keep */
  maxHistoryEntries?: number;
  /** Alert configuration */
  alertConfig?: HealthAlertConfig;
  /** Schedule configuration */
  scheduleConfig?: Partial<HealthScheduleConfig>;
  /** Whether to enable built-in checkers */
  enableBuiltInCheckers?: boolean;
}

/**
 * Health check service providing unified API
 */
export class HealthCheckService {
  private scheduler: HealthScheduler;
  private config: Required<HealthCheckServiceConfig>;
  private initialized: boolean;
  private startTime: Date;
  private historyPath: string;
  private selfHealingActions: Map<string, SelfHealingAction>;
  private lastAlertTime: Map<string, Date>;

  constructor(config?: HealthCheckServiceConfig) {
    const defaultDataRoot = path.join(homedir(), '.prism-gateway');

    this.config = {
      dataRoot: config?.dataRoot || defaultDataRoot,
      historyRoot: config?.historyRoot || path.join(defaultDataRoot, 'health-history'),
      maxHistoryEntries: config?.maxHistoryEntries || 1000,
      alertConfig: {
        degradedThreshold: 25,
        unhealthyThreshold: 50,
        cooldownPeriod: 300,
        enableSelfHealing: true,
        ...config?.alertConfig
      },
      scheduleConfig: config?.scheduleConfig || {},
      enableBuiltInCheckers: config?.enableBuiltInCheckers ?? true
    };

    this.scheduler = new HealthScheduler(this.config.scheduleConfig);
    this.initialized = false;
    this.startTime = new Date();
    this.historyPath = path.join(this.config.historyRoot, 'history.jsonl');
    this.selfHealingActions = new Map();
    this.lastAlertTime = new Map();

    // Set up check completion handler
    this.scheduler.onComplete(result => this.handleCheckComplete(result));
  }

  /**
   * Initialize health check service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create history directory
    await fs.mkdir(this.config.historyRoot, { recursive: true });

    // Register built-in checkers if enabled
    if (this.config.enableBuiltInCheckers) {
      await this.registerBuiltInCheckers();
    }

    // Start scheduler
    await this.scheduler.start();

    this.initialized = true;
    console.log('[HealthCheckService] Health check service initialized');
  }

  /**
   * Get current health report
   */
  async getHealthReport(): Promise<HealthReport> {
    if (!this.initialized) {
      throw new Error('Health check service not initialized');
    }

    const startTime = Date.now();
    const results = await this.scheduler.runAllChecks();
    const duration = Date.now() - startTime;

    const status = this.calculateOverallStatus(results);
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    return {
      status,
      checks: results,
      timestamp: new Date().toISOString(),
      duration,
      uptime,
      version: '1.0.0'
    };
  }

  /**
   * Get specific health check result
   */
  async getCheck(name: string): Promise<HealthCheckResult> {
    if (!this.initialized) {
      throw new Error('Health check service not initialized');
    }

    return this.scheduler.runCheck(name);
  }

  /**
   * List all registered checkers
   */
  listCheckers(filter?: HealthCheckFilter): HealthChecker[] {
    if (!this.initialized) {
      throw new Error('Health check service not initialized');
    }

    let checkers = this.scheduler.getCheckers();

    if (filter) {
      if (filter.name) {
        checkers = checkers.filter(c => c.name === filter.name);
      }
      if (filter.severity) {
        checkers = checkers.filter(c => c.severity === filter.severity);
      }
      if (filter.enabled !== undefined) {
        checkers = checkers.filter(c => c.enabled === filter.enabled);
      }
    }

    return checkers;
  }

  /**
   * Add custom health checker
   */
  addChecker(checker: HealthChecker): void {
    if (!this.initialized) {
      throw new Error('Health check service not initialized');
    }

    this.scheduler.addChecker(checker);
  }

  /**
   * Remove health checker
   */
  removeChecker(name: string): void {
    if (!this.initialized) {
      throw new Error('Health check service not initialized');
    }

    this.scheduler.removeChecker(name);
  }

  /**
   * Get health check statistics
   */
  async getStats(): Promise<HealthStats> {
    if (!this.initialized) {
      throw new Error('Health check service not initialized');
    }

    const checkers = this.scheduler.getCheckers();
    let totalChecks = 0;
    let successfulChecks = 0;
    let failedChecks = 0;
    let totalDuration = 0;
    let lastCheckTimestamp: string | undefined;

    for (const checker of checkers) {
      const count = checker.getCheckCount();
      totalChecks += count;

      const lastCheck = checker.getLastCheck();
      if (lastCheck) {
        if (lastCheck.status === 'healthy') {
          successfulChecks++;
        } else if (lastCheck.status === 'unhealthy') {
          failedChecks++;
        }

        totalDuration += lastCheck.duration;

        if (!lastCheckTimestamp || lastCheck.timestamp > lastCheckTimestamp) {
          lastCheckTimestamp = lastCheck.timestamp;
        }
      }
    }

    const avgDuration = totalChecks > 0 ? totalDuration / totalChecks : 0;
    const uptimePercentage = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100;

    return {
      totalChecks,
      successfulChecks,
      failedChecks,
      avgDuration,
      lastCheck: lastCheckTimestamp,
      uptimePercentage
    };
  }

  /**
   * Get health check history
   */
  async getHistory(limit: number = 100): Promise<HealthHistoryEntry[]> {
    if (!this.initialized) {
      throw new Error('Health check service not initialized');
    }

    try {
      const exists = await fs.access(this.historyPath).then(() => true).catch(() => false);
      if (!exists) {
        return [];
      }

      const content = await fs.readFile(this.historyPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      const entries = lines.slice(-limit).map(line => JSON.parse(line) as HealthHistoryEntry);

      return entries.reverse();
    } catch (error) {
      console.error('[HealthCheckService] Failed to read history:', error);
      return [];
    }
  }

  /**
   * Register self-healing action
   */
  registerSelfHealing(action: SelfHealingAction): void {
    this.selfHealingActions.set(action.checkName, action);
    console.log(`[HealthCheckService] Registered self-healing action for: ${action.checkName}`);
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.scheduler.stop();
    this.initialized = false;
    console.log('[HealthCheckService] Health check service stopped');
  }

  private async registerBuiltInCheckers(): Promise<void> {
    // System health checker
    this.scheduler.addChecker(new SystemHealthChecker());

    // Disk health checker
    this.scheduler.addChecker(new DiskHealthChecker({
      config: {
        paths: [this.config.dataRoot],
        threshold: 90
      }
    }));

    // Data integrity checker
    const dataPaths = [
      path.join(this.config.dataRoot, 'level-1-hot'),
      path.join(this.config.dataRoot, 'level-2-warm'),
      path.join(this.config.dataRoot, 'level-3-cold')
    ];

    this.scheduler.addChecker(new DataHealthChecker({
      config: {
        paths: dataPaths,
        requireWritable: true
      }
    }));

    console.log('[HealthCheckService] Registered built-in health checkers');
  }

  private calculateOverallStatus(results: HealthCheckResult[]): HealthStatus {
    if (results.length === 0) {
      return 'unknown';
    }

    const criticalChecks = results.filter(r => r.severity === 'critical');
    const importantChecks = results.filter(r => r.severity === 'important');

    // If any critical check is unhealthy, overall is unhealthy
    if (criticalChecks.some(r => r.status === 'unhealthy')) {
      return 'unhealthy';
    }

    // If any important check is unhealthy or any critical is degraded, overall is degraded
    if (
      importantChecks.some(r => r.status === 'unhealthy') ||
      criticalChecks.some(r => r.status === 'degraded')
    ) {
      return 'degraded';
    }

    // If any check is degraded, overall is degraded
    if (results.some(r => r.status === 'degraded')) {
      return 'degraded';
    }

    // All checks are healthy
    return 'healthy';
  }

  private async handleCheckComplete(result: HealthCheckResult): Promise<void> {
    // Save to history
    await this.saveToHistory(result);

    // Check for alerts
    if (result.status !== 'healthy') {
      await this.handleAlert(result);
    }

    // Attempt self-healing if enabled
    if (
      this.config.alertConfig.enableSelfHealing &&
      result.status === 'unhealthy' &&
      this.selfHealingActions.has(result.name)
    ) {
      await this.attemptSelfHealing(result);
    }
  }

  private async saveToHistory(result: HealthCheckResult): Promise<void> {
    try {
      const entry: HealthHistoryEntry = {
        name: result.name,
        status: result.status,
        timestamp: result.timestamp,
        duration: result.duration,
        ...(result.error && { error: result.error })
      };

      const line = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.historyPath, line);

      // Cleanup old entries if needed
      await this.cleanupHistory();
    } catch (error) {
      console.error('[HealthCheckService] Failed to save history:', error);
    }
  }

  private async cleanupHistory(): Promise<void> {
    try {
      const content = await fs.readFile(this.historyPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      if (lines.length > this.config.maxHistoryEntries) {
        const keepLines = lines.slice(-this.config.maxHistoryEntries);
        await fs.writeFile(this.historyPath, keepLines.join('\n') + '\n');
      }
    } catch (error) {
      console.error('[HealthCheckService] Failed to cleanup history:', error);
    }
  }

  private async handleAlert(result: HealthCheckResult): Promise<void> {
    const now = new Date();
    const lastAlert = this.lastAlertTime.get(result.name);

    // Check cooldown period
    if (lastAlert) {
      const timeSinceLastAlert = (now.getTime() - lastAlert.getTime()) / 1000;
      if (timeSinceLastAlert < this.config.alertConfig.cooldownPeriod) {
        return;
      }
    }

    console.warn(`[HealthCheckService] Alert: ${result.name} is ${result.status} - ${result.message}`);
    this.lastAlertTime.set(result.name, now);
  }

  private async attemptSelfHealing(result: HealthCheckResult): Promise<void> {
    const action = this.selfHealingActions.get(result.name);
    if (!action) {
      return;
    }

    console.log(`[HealthCheckService] Attempting self-healing for: ${result.name}`);

    let retries = 0;
    while (retries < action.maxRetries) {
      try {
        await action.action();
        console.log(`[HealthCheckService] Self-healing succeeded for: ${result.name}`);
        return;
      } catch (error) {
        retries++;
        console.error(`[HealthCheckService] Self-healing attempt ${retries} failed for: ${result.name}`, error);

        if (retries < action.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }

    console.error(`[HealthCheckService] Self-healing exhausted all retries for: ${result.name}`);
  }
}
