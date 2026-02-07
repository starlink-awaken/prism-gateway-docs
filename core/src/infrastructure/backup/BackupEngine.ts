/**
 * PRISM-Gateway Backup Engine
 *
 * @module infrastructure/backup/BackupEngine
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { createReadStream } from 'node:fs';
import type { FileDiff, CompressResult } from './types.js';

/**
 * Backup engine for low-level file operations
 */
export class BackupEngine {
  /**
   * Copy directory tree recursively
   */
  async copyTree(source: string, dest: string): Promise<number> {
    let fileCount = 0;
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        fileCount += await this.copyTree(sourcePath, destPath);
      } else if (entry.isFile()) {
        await fs.copyFile(sourcePath, destPath);
        fileCount++;
      }
    }

    return fileCount;
  }

  /**
   * Calculate file differences between source and baseline
   */
  async diff(source: string, baseline: string): Promise<FileDiff[]> {
    const diffs: FileDiff[] = [];
    const sourceFiles = await this.scanDirectory(source);
    const baselineFiles = await this.scanDirectory(baseline);

    const baselineMap = new Map(baselineFiles.map(f => [f.path, f]));

    for (const sourceFile of sourceFiles) {
      const baselineFile = baselineMap.get(sourceFile.path);

      if (!baselineFile) {
        diffs.push({
          path: sourceFile.path,
          type: 'added',
          size: sourceFile.size,
          mtime: sourceFile.mtime,
          checksum: await this.checksum(path.join(source, sourceFile.path))
        });
      } else {
        const isModified = sourceFile.size !== baselineFile.size ||
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

    const sourceMap = new Map(sourceFiles.map(f => [f.path, f]));
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
   * Compress directory to archive
   */
  async compress(source: string, output: string): Promise<CompressResult> {
    const startTime = Date.now();
    const files = await this.scanDirectory(source);
    const originalSize = files.reduce((sum, f) => sum + f.size, 0);

    await fs.mkdir(path.dirname(output), { recursive: true });

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
    const compressed = zlib.gzipSync(buffer, { level: 6 });
    await fs.writeFile(output, compressed);

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
   * Decompress archive to directory
   */
  async decompress(archive: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });

    const compressed = await fs.readFile(archive);
    const decompressed = zlib.gunzipSync(compressed);
    const archiveData = JSON.parse(decompressed.toString());

    for (const item of archiveData) {
      const filePath = path.join(dest, item.path);
      const fileDir = path.dirname(filePath);

      await fs.mkdir(fileDir, { recursive: true });

      const content = Buffer.from(item.content, 'base64');
      await fs.writeFile(filePath, content);

      const mtime = new Date(item.mtime);
      await fs.utimes(filePath, mtime, mtime);
    }
  }

  /**
   * Calculate file checksum
   */
  async checksum(filePath: string, algorithm: 'sha256' | 'md5' = 'sha256'): Promise<string> {
    const hash = crypto.createHash(algorithm);
    const stream = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Scan directory recursively
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
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return files;
  }
}
