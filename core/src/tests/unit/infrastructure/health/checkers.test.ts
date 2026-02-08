/**
 * Tests for built-in health checkers
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  SystemHealthChecker,
  DiskHealthChecker,
  DataHealthChecker,
  APIHealthChecker
} from '../../../../infrastructure/health/checkers.js';

describe('SystemHealthChecker', () => {
  it('should create checker with default config', () => {
    const checker = new SystemHealthChecker();

    expect(checker.name).toBe('system');
    expect(checker.severity).toBe('critical');
    expect(checker.interval).toBe(30);
  });

  it('should return healthy status for normal system', async () => {
    const checker = new SystemHealthChecker({
      config: {
        cpuThreshold: 95,
        memoryThreshold: 95,
        loadThreshold: 50
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('healthy');
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.metrics).toBeDefined();
  });

  it('should return degraded status for high CPU', async () => {
    const checker = new SystemHealthChecker({
      config: {
        cpuThreshold: 0, // Will trigger threshold
        memoryThreshold: 95,
        loadThreshold: 50
      }
    });

    const result = await checker.check();

    expect(['degraded', 'unhealthy']).toContain(result.status);
    expect(result.message).toContain('CPU');
  });

  it('should return unhealthy status for multiple issues', async () => {
    const checker = new SystemHealthChecker({
      config: {
        cpuThreshold: 0,
        memoryThreshold: 0,
        loadThreshold: 0
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('unhealthy');
    expect(result.message).toContain('Multiple system issues');
  });

  it('should include system metrics in metadata', async () => {
    const checker = new SystemHealthChecker();
    const result = await checker.check();

    const metrics = result.metadata?.metrics as any;
    expect(metrics).toBeDefined();
    expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
    expect(metrics.memoryUsage).toBeGreaterThan(0);
    expect(metrics.totalMemory).toBeGreaterThan(0);
    expect(metrics.loadAverage).toHaveLength(3);
  });
});

describe('DiskHealthChecker', () => {
  it('should create checker with default config', () => {
    const checker = new DiskHealthChecker();

    expect(checker.name).toBe('disk');
    expect(checker.severity).toBe('critical');
    expect(checker.interval).toBe(60);
  });

  it('should check disk space for provided paths', async () => {
    const checker = new DiskHealthChecker({
      config: {
        paths: [process.cwd()],
        threshold: 95
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('healthy');
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.metrics).toBeDefined();
  });

  it('should handle multiple paths', async () => {
    const checker = new DiskHealthChecker({
      config: {
        paths: [process.cwd(), os.tmpdir()],
        threshold: 95
      }
    });

    const result = await checker.check();

    const metrics = result.metadata?.metrics as any[];
    expect(metrics).toHaveLength(2);
  });

  it('should return degraded status for high disk usage', async () => {
    const checker = new DiskHealthChecker({
      config: {
        paths: [process.cwd()],
        threshold: 0 // Will trigger threshold
      }
    });

    const result = await checker.check();

    // Note: Test checker uses mock disk stats, so will always show high usage
    expect(['degraded', 'unhealthy']).toContain(result.status);
  });
});

describe('DataHealthChecker', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `health-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create checker with default config', () => {
    const checker = new DataHealthChecker();

    expect(checker.name).toBe('data');
    expect(checker.severity).toBe('important');
    expect(checker.interval).toBe(120);
  });

  it('should return healthy status for accessible paths', async () => {
    const testFile = path.join(testDir, 'test.txt');
    await fs.writeFile(testFile, 'test content');

    const checker = new DataHealthChecker({
      config: {
        paths: [testFile],
        requireWritable: true
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('healthy');
    expect(result.message).toContain('accessible');
  });

  it('should detect non-existent paths', async () => {
    const nonExistent = path.join(testDir, 'does-not-exist.txt');

    const checker = new DataHealthChecker({
      config: {
        paths: [nonExistent],
        requireWritable: true
      }
    });

    const result = await checker.check();

    expect(['degraded', 'unhealthy']).toContain(result.status);
    expect(result.message).toContain('does not exist');
  });

  it('should check file readability', async () => {
    const testFile = path.join(testDir, 'readable.txt');
    await fs.writeFile(testFile, 'test content');

    const checker = new DataHealthChecker({
      config: {
        paths: [testFile],
        requireWritable: false
      }
    });

    const result = await checker.check();
    const results = result.metadata?.results as any[];

    expect(results[0].exists).toBe(true);
    expect(results[0].readable).toBe(true);
  });

  it('should check file writability', async () => {
    const testFile = path.join(testDir, 'writable.txt');
    await fs.writeFile(testFile, 'test content');

    const checker = new DataHealthChecker({
      config: {
        paths: [testFile],
        requireWritable: true
      }
    });

    const result = await checker.check();
    const results = result.metadata?.results as any[];

    expect(results[0].writable).toBe(true);
  });

  it('should handle multiple paths with mixed results', async () => {
    const existingFile = path.join(testDir, 'exists.txt');
    const missingFile = path.join(testDir, 'missing.txt');

    await fs.writeFile(existingFile, 'test');

    const checker = new DataHealthChecker({
      config: {
        paths: [existingFile, missingFile],
        requireWritable: true
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('degraded');
    expect(result.metadata?.results).toHaveLength(2);
  });

  it('should include file metadata', async () => {
    const testFile = path.join(testDir, 'metadata.txt');
    await fs.writeFile(testFile, 'test content');

    const checker = new DataHealthChecker({
      config: {
        paths: [testFile],
        requireWritable: true
      }
    });

    const result = await checker.check();
    const results = result.metadata?.results as any[];

    expect(results[0].size).toBeGreaterThan(0);
    expect(results[0].modified).toBeDefined();
  });
});

describe('APIHealthChecker', () => {
  it('should create checker with default config', () => {
    const checker = new APIHealthChecker();

    expect(checker.name).toBe('api');
    expect(checker.severity).toBe('important');
    expect(checker.interval).toBe(60);
  });

  it('should return healthy status when no endpoints configured', async () => {
    const checker = new APIHealthChecker({
      config: {
        endpoints: [],
        timeout: 3000
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('healthy');
    expect(result.message).toContain('No API endpoints configured');
  });

  it('should check HTTP endpoints', async () => {
    // Using a reliable public endpoint for testing
    const checker = new APIHealthChecker({
      config: {
        endpoints: ['https://httpbin.org/status/200'],
        timeout: 5000
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('healthy');
    expect(result.metadata?.results).toBeDefined();
  }, 10000);

  it('should detect failing endpoints', async () => {
    const checker = new APIHealthChecker({
      config: {
        endpoints: ['https://httpbin.org/status/500'],
        timeout: 5000
      }
    });

    const result = await checker.check();

    expect(['degraded', 'unhealthy']).toContain(result.status);
    expect(result.message).toContain('500');
  }, 10000);

  it('should handle unreachable endpoints', async () => {
    const checker = new APIHealthChecker({
      config: {
        endpoints: ['https://this-domain-does-not-exist-12345.invalid'],
        timeout: 2000
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('unhealthy');
    expect(result.metadata?.issues).toBeDefined();
  }, 10000);

  it('should calculate success rate', async () => {
    const checker = new APIHealthChecker({
      config: {
        endpoints: [
          'https://httpbin.org/status/200',
          'https://httpbin.org/status/500'
        ],
        timeout: 5000
      }
    });

    const result = await checker.check();

    const successRate = result.metadata?.successRate as number;
    expect(successRate).toBeGreaterThanOrEqual(0);
    expect(successRate).toBeLessThanOrEqual(100);
  }, 15000);

  it('should measure response time', async () => {
    const checker = new APIHealthChecker({
      config: {
        endpoints: ['https://httpbin.org/status/200'],
        timeout: 5000
      }
    });

    const result = await checker.check();
    const results = result.metadata?.results as any[];

    expect(results[0].responseTime).toBeGreaterThan(0);
  }, 10000);

  it('should timeout slow endpoints', async () => {
    const checker = new APIHealthChecker({
      config: {
        endpoints: ['https://httpbin.org/delay/10'],
        timeout: 1000
      }
    });

    const result = await checker.check();

    expect(result.status).toBe('unhealthy');
  }, 15000);
});
