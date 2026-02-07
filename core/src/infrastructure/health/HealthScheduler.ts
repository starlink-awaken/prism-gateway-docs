/**
 * PRISM-Gateway Health Scheduler
 *
 * @module infrastructure/health/HealthScheduler
 */

import type { HealthChecker } from './HealthChecker.js';
import type { HealthScheduleConfig, HealthCheckResult, CheckSeverity } from './types.js';

/**
 * Scheduled health check job
 */
interface ScheduledCheck {
  checker: HealthChecker;
  timerId?: NodeJS.Timeout;
  running: boolean;
  lastRun?: Date;
}

/**
 * Health check scheduler
 */
export class HealthScheduler {
  private checks: Map<string, ScheduledCheck>;
  private config: HealthScheduleConfig;
  private running: boolean;
  private onCheckComplete?: (result: HealthCheckResult) => void;

  constructor(config?: Partial<HealthScheduleConfig>) {
    this.checks = new Map();
    this.running = false;
    this.config = {
      criticalInterval: 30,
      importantInterval: 60,
      optionalInterval: 120,
      runOnStartup: true,
      ...config
    };
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Scheduler is already running');
    }

    this.running = true;

    // Run all checks on startup if configured
    if (this.config.runOnStartup) {
      await this.runAllChecks();
    }

    // Schedule periodic checks
    for (const [name, scheduled] of this.checks.entries()) {
      this.scheduleCheck(name, scheduled);
    }

    console.log('[HealthScheduler] Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Clear all timers
    for (const scheduled of this.checks.values()) {
      if (scheduled.timerId) {
        clearInterval(scheduled.timerId);
        scheduled.timerId = undefined;
      }
    }

    this.running = false;
    console.log('[HealthScheduler] Scheduler stopped');
  }

  /**
   * Add health checker
   */
  addChecker(checker: HealthChecker): void {
    if (this.checks.has(checker.name)) {
      throw new Error(`Health checker already exists: ${checker.name}`);
    }

    this.checks.set(checker.name, {
      checker,
      running: false
    });

    // Schedule immediately if running
    if (this.running) {
      const scheduled = this.checks.get(checker.name)!;
      this.scheduleCheck(checker.name, scheduled);
    }

    console.log(`[HealthScheduler] Added checker: ${checker.name}`);
  }

  /**
   * Remove health checker
   */
  removeChecker(name: string): void {
    const scheduled = this.checks.get(name);
    if (scheduled?.timerId) {
      clearInterval(scheduled.timerId);
    }

    this.checks.delete(name);
    console.log(`[HealthScheduler] Removed checker: ${name}`);
  }

  /**
   * Get all registered checkers
   */
  getCheckers(): HealthChecker[] {
    return Array.from(this.checks.values()).map(s => s.checker);
  }

  /**
   * Get checker by name
   */
  getChecker(name: string): HealthChecker | undefined {
    return this.checks.get(name)?.checker;
  }

  /**
   * Run a specific check immediately
   */
  async runCheck(name: string): Promise<HealthCheckResult> {
    const scheduled = this.checks.get(name);
    if (!scheduled) {
      throw new Error(`Health checker not found: ${name}`);
    }

    return this.executeCheck(name, scheduled);
  }

  /**
   * Run all checks immediately
   */
  async runAllChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [name, scheduled] of this.checks.entries()) {
      try {
        const result = await this.executeCheck(name, scheduled);
        results.push(result);
      } catch (error) {
        console.error(`[HealthScheduler] Check failed: ${name}`, error);
      }
    }

    return results;
  }

  /**
   * Set callback for check completion
   */
  onComplete(callback: (result: HealthCheckResult) => void): void {
    this.onCheckComplete = callback;
  }

  /**
   * Update schedule configuration
   */
  updateSchedule(config: Partial<HealthScheduleConfig>): void {
    this.config = { ...this.config, ...config };

    // Reschedule all checks if running
    if (this.running) {
      for (const [name, scheduled] of this.checks.entries()) {
        if (scheduled.timerId) {
          clearInterval(scheduled.timerId);
        }
        this.scheduleCheck(name, scheduled);
      }
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats(): {
    totalChecks: number;
    runningChecks: number;
    enabledChecks: number;
    disabledChecks: number;
  } {
    const checkers = this.getCheckers();

    return {
      totalChecks: checkers.length,
      runningChecks: Array.from(this.checks.values()).filter(s => s.running).length,
      enabledChecks: checkers.filter(c => c.enabled).length,
      disabledChecks: checkers.filter(c => !c.enabled).length
    };
  }

  private scheduleCheck(name: string, scheduled: ScheduledCheck): void {
    if (!scheduled.checker.enabled) {
      return;
    }

    const interval = this.getIntervalForChecker(scheduled.checker);

    scheduled.timerId = setInterval(async () => {
      if (!scheduled.running) {
        await this.executeCheck(name, scheduled);
      }
    }, interval * 1000);
  }

  private async executeCheck(name: string, scheduled: ScheduledCheck): Promise<HealthCheckResult> {
    scheduled.running = true;
    scheduled.lastRun = new Date();

    try {
      const result = await scheduled.checker.check();

      if (this.onCheckComplete) {
        this.onCheckComplete(result);
      }

      return result;
    } catch (error) {
      console.error(`[HealthScheduler] Check execution failed: ${name}`, error);
      throw error;
    } finally {
      scheduled.running = false;
    }
  }

  private getIntervalForChecker(checker: HealthChecker): number {
    // Use checker's configured interval if available
    if (checker.interval > 0) {
      return checker.interval;
    }

    // Otherwise use severity-based interval from config
    switch (checker.severity) {
      case 'critical':
        return this.config.criticalInterval;
      case 'important':
        return this.config.importantInterval;
      case 'optional':
        return this.config.optionalInterval;
      default:
        return this.config.importantInterval;
    }
  }
}
