/**
 * PRISM-Gateway Health Checker Base Class
 *
 * @module infrastructure/health/HealthChecker
 */

import type { HealthCheckResult, HealthCheckConfig, HealthStatus, CheckSeverity } from './types.js';

/**
 * Abstract base class for health checkers
 */
export abstract class HealthChecker {
  protected config: HealthCheckConfig;
  protected lastCheck?: HealthCheckResult;
  protected checkCount: number = 0;

  constructor(config: HealthCheckConfig) {
    this.config = config;
  }

  /**
   * Get checker name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get checker severity
   */
  get severity(): CheckSeverity {
    return this.config.severity;
  }

  /**
   * Get checker interval
   */
  get interval(): number {
    return this.config.interval;
  }

  /**
   * Check if checker is enabled
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get last check result
   */
  getLastCheck(): HealthCheckResult | undefined {
    return this.lastCheck;
  }

  /**
   * Get total check count
   */
  getCheckCount(): number {
    return this.checkCount;
  }

  /**
   * Perform health check
   */
  async check(): Promise<HealthCheckResult> {
    if (!this.config.enabled) {
      return this.createResult('unknown', 0, 'Check is disabled');
    }

    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Check timeout')), this.config.timeout);
      });

      const checkPromise = this.performCheck();
      const result = await Promise.race([checkPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      this.checkCount++;
      this.lastCheck = this.createResult(result.status, duration, result.message, result.metadata);

      return this.lastCheck;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.checkCount++;

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastCheck = this.createResult('unhealthy', duration, 'Check failed', undefined, errorMessage);

      return this.lastCheck;
    }
  }

  /**
   * Perform the actual health check (to be implemented by subclasses)
   */
  protected abstract performCheck(): Promise<{
    status: HealthStatus;
    message: string;
    metadata?: Record<string, unknown>;
  }>;

  /**
   * Create health check result
   */
  protected createResult(
    status: HealthStatus,
    duration: number,
    message: string,
    metadata?: Record<string, unknown>,
    error?: string
  ): HealthCheckResult {
    return {
      name: this.config.name,
      status,
      severity: this.config.severity,
      duration,
      timestamp: new Date().toISOString(),
      message,
      ...(metadata && { metadata }),
      ...(error && { error })
    };
  }

  /**
   * Update checker configuration
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset checker state
   */
  reset(): void {
    this.lastCheck = undefined;
    this.checkCount = 0;
  }
}
