/**
 * PRISM-Gateway Backup Engine
 *
 * @description
 * 备份引擎核心实现，负责文件复制、差异计算、压缩、校验和计算等底层操作
 *
 * @module infrastructure/backup/BackupEngine
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import type { FileDiff, CompressResult } from './types.js';

/**
 * 备份引擎
 *
 * @description
 * 提供文件系统级别的备份操作：
 * - 递归复制文件树
 * - 计算文件差异（增量备份）
 * - 压缩和解压
 * - 校验和计算
 */
export class BackupEngine {
  /**
   * 递归复制文件树
   *
   * @param source - 源目录
   * @param dest - 目标目录
   * @returns 复制的文件数量
   *
   * @example
   * ```typescript
   * const engine = new BackupEngine();
   * const count = await engine.copyTree('/source', '/dest');
   * console.log(`Copied ${count} files`);
   * ```
   */
  async copyTree(source: string, dest: string): Promise<number> {
    let fileCount = 0;

    // 确保目标目录存在
    await fs.mkdir(dest, { recursive: true });

    // 读取源目录内容
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // 递归复制子目录
        fileCount += await this.copyTree(sourcePath, destPath);
      } else if (entry.isFile()) {
        // 复制文件
        await fs.copyFile(sourcePath, destPath);
        fileCount++;
      }
      // 跳过符号链接和其他特殊文件
    }

    return fileCount;
  }

  /**
   * 计算文件差异
   *
   * @param source - 源目录（当前数据）
   * @param baseline - 基线目录（上次备份）
   * @returns 文件差异列表
   *
   * @remarks
   * 差异检测策略：
   * 1. 比较文件列表，找出新增和删除的文件
   * 2. 对于同名文件，比较 mtime 和 size
   * 3. 如果 mtime 或 size 不同，标记为修改
   *
   * @example
   * ```typescript
   * const engine = new BackupEngine();
   * const diffs = await engine.diff('/current', '/baseline');
   * console.log(`${diffs.length} files changed`);
   * ```
   */
  async diff(source: string, baseline: string): Promise<FileDiff[]> {
    const diffs: FileDiff[] = [];

    // 递归扫描源目录
    const sourceFiles = await this.scanDirectory(source);
    const baselineFiles = await this.scanDirectory(baseline);

    // 创建基线文件映射
    const baselineMap = new Map(
      baselineFiles.map((f) => [f.path, f])
    );

    // 检查新增和修改的文件
    for (const sourceFile of sourceFiles) {
      const baselineFile = baselineMap.get(sourceFile.path);

      if (!baselineFile) {
        // 新增文件
        diffs.push({
          path: sourceFile.path,
          type: 'added',
          size: sourceFile.size,
          mtime: sourceFile.mtime,
          checksum: await this.checksum(path.join(source, sourceFile.path))
        });
      } else {
        // 检查是否修改
        const isModified =
          sourceFile.size !== baselineFile.size ||
          sourceFile.mtime.getTime() !== baselineFile.mtime.getTime();

        if (isModified) {
          diffs.push({
            path: sourceFile.path,
            type: 'modified',
            size: sourceFile.size,
            mtime: sourceFile.mtime,
            checksum: await this.checksum(path.join(source, sourceFile.path))
          });
        }
      }
    }

    // 检查删除的文件
    const sourceMap = new Map(sourceFiles.map((f) => [f.path, f]));
    for (const baselineFile of baselineFiles) {
      if (!sourceMap.has(baselineFile.path)) {
        diffs.push({
          path: baselineFile.path,
          type: 'deleted',
          size: baselineFile.size,
          mtime: baselineFile.mtime
        });
      }
    }

    return diffs;
  }

  /**
   * 压缩目录
   *
   * @param source - 源目录
   * @param output - 输出文件路径（.tar.gz）
   * @returns 压缩结果
   *
   * @remarks
   * 使用 gzip 压缩（级别 6），适合备份场景的压缩率和速度平衡
   *
   * @example
   * ```typescript
   * const engine = new BackupEngine();
   * const result = await engine.compress('/data', '/backup.tar.gz');
   * console.log(`Compression ratio: ${result.compressionRatio}%`);
   * ```
   */
  async compress(source: string, output: string): Promise<CompressResult> {
    const startTime = Date.now();
    const files = await this.scanDirectory(source);
    const originalSize = files.reduce((sum, f) => sum + f.size, 0);

    // 确保输出目录存在
    await fs.mkdir(path.dirname(output), { recursive: true });

    // 使用简化的压缩策略：逐文件压缩并写入
    // 注意：这是简化实现，生产环境应使用 tar 库（如 tar-stream）
    const gzip = zlib.createGzip({ level: 6 });
    const outputStream = createWriteStream(output);

    // 创建简单的归档格式（实际应使用 tar 格式）
    // 这里我们只是演示概念，实际实现需要使用 tar-stream
    const archiveData: any[] = [];

    for (const file of files) {
      const filePath = path.join(source, file.path);
      const content = await fs.readFile(filePath);
      archiveData.push({
        path: file.path,
        content: content.toString('base64'),
        mtime: file.mtime.toISOString(),
        size: file.size
      });
    }

    const jsonData = JSON.stringify(archiveData);
    const buffer = Buffer.from(jsonData);

    // 压缩数据
    await pipeline(
      fsSync.createReadStream(buffer as any).pipe(gzip),
      outputStream
    ).catch(async () => {
      // 简单压缩实现
      const compressed = zlib.gzipSync(buffer, { level: 6 });
      await fs.writeFile(output, compressed);
    });

    const compressedSize = (await fs.stat(output)).size;
    const duration = Date.now() - startTime;

    return {
      originalSize,
      compressedSize,
      compressionRatio: ((1 - compressedSize / originalSize) * 100),
      fileCount: files.length,
      duration
    };
  }

  /**
   * 解压文件
   *
   * @param archive - 压缩文件路径
   * @param dest - 解压目标目录
   *
   * @example
   * ```typescript
   * const engine = new BackupEngine();
   * await engine.decompress('/backup.tar.gz', '/restore');
   * ```
   */
  async decompress(archive: string, dest: string): Promise<void> {
    // 确保目标目录存在
    await fs.mkdir(dest, { recursive: true });

    // 读取压缩文件
    const compressed = await fs.readFile(archive);
    const decompressed = zlib.gunzipSync(compressed);
    const archiveData = JSON.parse(decompressed.toString());

    // 恢复文件
    for (const item of archiveData) {
      const filePath = path.join(dest, item.path);
      const fileDir = path.dirname(filePath);

      // 确保目录存在
      await fs.mkdir(fileDir, { recursive: true });

      // 写入文件内容
      const content = Buffer.from(item.content, 'base64');
      await fs.writeFile(filePath, content);

      // 恢复 mtime
      const mtime = new Date(item.mtime);
      await fs.utimes(filePath, mtime, mtime);
    }
  }

  /**
   * 计算文件校验和
   *
   * @param filePath - 文件路径
   * @param algorithm - 算法（sha256, md5）
   * @returns 校验和字符串（十六进制）
   *
   * @example
   * ```typescript
   * const engine = new BackupEngine();
   * const checksum = await engine.checksum('/file.txt', 'sha256');
   * console.log(`SHA256: ${checksum}`);
   * ```
   */
  async checksum(
    filePath: string,
    algorithm: 'sha256' | 'md5' = 'sha256'
  ): Promise<string> {
    const hash = crypto.createHash(algorithm);
    const stream = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * 扫描目录，返回所有文件的元信息
   *
   * @param dir - 目录路径
   * @param basePath - 基础路径（用于计算相对路径）
   * @returns 文件列表
   * @internal
   */
  private async scanDirectory(
    dir: string,
    basePath: string = dir
  ): Promise<Array<{ path: string; size: number; mtime: Date }>> {
    const files: Array<{ path: string; size: number; mtime: Date }> = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // 递归扫描子目录
          files.push(...(await this.scanDirectory(fullPath, basePath)));
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(basePath, fullPath);

          files.push({
            path: relativePath,
            size: stats.size,
            mtime: stats.mtime
          });
        }
      }
    } catch (error) {
      // 目录不存在或无法访问
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return files;
  }
}
