/**
 * 文件操作工具函数
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

/**
 * 读取JSON文件
 */
export async function readJSON<T>(filePath: string): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Failed to read JSON file ${filePath}: ${error}`);
  }
}

/**
 * 写入JSON文件
 */
export async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  try {
    const { writeFile } = await import('fs/promises');
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write JSON file ${filePath}: ${error}`);
  }
}

/**
 * 追加写入JSONL文件
 */
export async function appendJSONL<T>(filePath: string, data: T): Promise<void> {
  try {
    const { appendFile } = await import('fs/promises');
    await appendFile(filePath, JSON.stringify(data) + '\n', 'utf-8');
  } catch (error) {
    throw new Error(`Failed to append to JSONL file ${filePath}: ${error}`);
  }
}

/**
 * 读取JSONL文件
 */
export async function readJSONL<T>(filePath: string, limit?: number): Promise<T[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const data = lines.map(line => JSON.parse(line) as T);
    return limit ? data.slice(0, limit) : data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // 文件不存在返回空数组
    }
    throw new Error(`Failed to read JSONL file ${filePath}: ${error}`);
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 列出目录中的文件
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await readdir(dirPath);
    return files;
  } catch (error) {
    throw new Error(`Failed to list directory ${dirPath}: ${error}`);
  }
}

/**
 * 性能测量装饰器
 */
export function measureTime<T extends (...args: any[]) => any>(
  fn: T,
  label: string
): T {
  return (async (...args: any[]) => {
    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      console.log(`[PERF] ${label}: ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[PERF] ${label}: ${duration}ms (ERROR)`);
      throw error;
    }
  }) as T;
}
