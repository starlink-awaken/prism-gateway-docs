/**
 * BackupEngine 单元测试
 *
 * @description
 * 测试备份引擎的核心功能：文件复制、差异计算、压缩解压、校验和计算
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BackupEngine } from '../../../../infrastructure/backup/BackupEngine.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('BackupEngine', () => {
  let engine: BackupEngine;
  let testDir: string;

  beforeEach(async () => {
    engine = new BackupEngine();
    // 创建临时测试目录
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-engine-test-'));
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('copyTree()', () => {
    it('should copy a simple directory structure', async () => {
      // 准备：创建源目录
      const sourceDir = path.join(testDir, 'source');
      const destDir = path.join(testDir, 'dest');

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');

      // 执行：复制目录
      const fileCount = await engine.copyTree(sourceDir, destDir);

      // 验证：文件数量和内容
      expect(fileCount).toBe(2);

      const file1Content = await fs.readFile(path.join(destDir, 'file1.txt'), 'utf-8');
      const file2Content = await fs.readFile(path.join(destDir, 'file2.txt'), 'utf-8');

      expect(file1Content).toBe('content1');
      expect(file2Content).toBe('content2');
    });

    it('should copy nested directory structure', async () => {
      // 准备：创建嵌套目录
      const sourceDir = path.join(testDir, 'source');
      const destDir = path.join(testDir, 'dest');

      await fs.mkdir(path.join(sourceDir, 'subdir1/subdir2'), { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(sourceDir, 'subdir1/file2.txt'), 'content2');
      await fs.writeFile(path.join(sourceDir, 'subdir1/subdir2/file3.txt'), 'content3');

      // 执行：复制目录
      const fileCount = await engine.copyTree(sourceDir, destDir);

      // 验证：文件数量和结构
      expect(fileCount).toBe(3);

      const file3Exists = await fs.access(path.join(destDir, 'subdir1/subdir2/file3.txt'))
        .then(() => true)
        .catch(() => false);
      expect(file3Exists).toBe(true);
    });

    it('should return 0 for empty directory', async () => {
      // 准备：创建空目录
      const sourceDir = path.join(testDir, 'empty-source');
      const destDir = path.join(testDir, 'empty-dest');

      await fs.mkdir(sourceDir, { recursive: true });

      // 执行：复制空目录
      const fileCount = await engine.copyTree(sourceDir, destDir);

      // 验证：文件数量为0
      expect(fileCount).toBe(0);
    });
  });

  describe('diff()', () => {
    it('should detect added files', async () => {
      // 准备：创建基线和源目录
      const baselineDir = path.join(testDir, 'baseline');
      const sourceDir = path.join(testDir, 'source');

      await fs.mkdir(baselineDir, { recursive: true });
      await fs.mkdir(sourceDir, { recursive: true });

      await fs.writeFile(path.join(baselineDir, 'old.txt'), 'old content');
      await fs.writeFile(path.join(sourceDir, 'old.txt'), 'old content');
      await fs.writeFile(path.join(sourceDir, 'new.txt'), 'new content');

      // 执行：计算差异
      const diffs = await engine.diff(sourceDir, baselineDir);

      // 验证：检测到新增文件
      const addedFiles = diffs.filter((d) => d.type === 'added');
      expect(addedFiles.length).toBe(1);
      expect(addedFiles[0].path).toBe('new.txt');
    });

    it('should detect modified files', async () => {
      // 准备：创建基线和源目录
      const baselineDir = path.join(testDir, 'baseline');
      const sourceDir = path.join(testDir, 'source');

      await fs.mkdir(baselineDir, { recursive: true });
      await fs.mkdir(sourceDir, { recursive: true });

      await fs.writeFile(path.join(baselineDir, 'file.txt'), 'old content');
      await fs.writeFile(path.join(sourceDir, 'file.txt'), 'new content');

      // 等待一小段时间确保 mtime 不同
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 执行：计算差异
      const diffs = await engine.diff(sourceDir, baselineDir);

      // 验证：检测到修改的文件
      const modifiedFiles = diffs.filter((d) => d.type === 'modified');
      expect(modifiedFiles.length).toBe(1);
      expect(modifiedFiles[0].path).toBe('file.txt');
    });

    it('should detect deleted files', async () => {
      // 准备：创建基线和源目录
      const baselineDir = path.join(testDir, 'baseline');
      const sourceDir = path.join(testDir, 'source');

      await fs.mkdir(baselineDir, { recursive: true });
      await fs.mkdir(sourceDir, { recursive: true });

      await fs.writeFile(path.join(baselineDir, 'deleted.txt'), 'deleted content');
      await fs.writeFile(path.join(baselineDir, 'kept.txt'), 'kept content');
      await fs.writeFile(path.join(sourceDir, 'kept.txt'), 'kept content');

      // 执行：计算差异
      const diffs = await engine.diff(sourceDir, baselineDir);

      // 验证：检测到删除的文件
      const deletedFiles = diffs.filter((d) => d.type === 'deleted');
      expect(deletedFiles.length).toBe(1);
      expect(deletedFiles[0].path).toBe('deleted.txt');
    });

    it('should return empty array when no changes', async () => {
      // 准备：创建相同的基线和源目录
      const baselineDir = path.join(testDir, 'baseline');
      const sourceDir = path.join(testDir, 'source');

      await fs.mkdir(baselineDir, { recursive: true });
      await fs.mkdir(sourceDir, { recursive: true });

      await fs.writeFile(path.join(baselineDir, 'file.txt'), 'same content');
      await fs.writeFile(path.join(sourceDir, 'file.txt'), 'same content');

      // 复制文件以确保 mtime 相同
      await fs.copyFile(
        path.join(baselineDir, 'file.txt'),
        path.join(sourceDir, 'file.txt')
      );

      // 执行：计算差异
      const diffs = await engine.diff(sourceDir, baselineDir);

      // 验证：无变化
      expect(diffs.length).toBe(0);
    });
  });

  describe('compress() and decompress()', () => {
    it('should compress and decompress a directory', async () => {
      // 准备：创建源目录
      const sourceDir = path.join(testDir, 'source');
      const archivePath = path.join(testDir, 'archive.tar.gz');
      const destDir = path.join(testDir, 'dest');

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');

      // 执行：压缩
      const compressResult = await engine.compress(sourceDir, archivePath);

      // 验证：压缩结果
      expect(compressResult.fileCount).toBe(2);
      expect(compressResult.originalSize).toBeGreaterThan(0);
      expect(compressResult.compressedSize).toBeGreaterThan(0);
      expect(compressResult.compressionRatio).toBeGreaterThan(0);
      expect(compressResult.compressionRatio).toBeLessThan(100);

      // 执行：解压
      await engine.decompress(archivePath, destDir);

      // 验证：解压后的文件
      const file1Content = await fs.readFile(path.join(destDir, 'file1.txt'), 'utf-8');
      const file2Content = await fs.readFile(path.join(destDir, 'file2.txt'), 'utf-8');

      expect(file1Content).toBe('content1');
      expect(file2Content).toBe('content2');
    });

    it('should handle empty directory compression', async () => {
      // 准备：创建空目录
      const sourceDir = path.join(testDir, 'empty-source');
      const archivePath = path.join(testDir, 'empty-archive.tar.gz');

      await fs.mkdir(sourceDir, { recursive: true });

      // 执行：压缩空目录
      const compressResult = await engine.compress(sourceDir, archivePath);

      // 验证：压缩结果
      expect(compressResult.fileCount).toBe(0);
      expect(compressResult.originalSize).toBe(0);
    });

    it('should achieve reasonable compression ratio', async () => {
      // 准备：创建包含可压缩内容的目录
      const sourceDir = path.join(testDir, 'source');
      const archivePath = path.join(testDir, 'archive.tar.gz');

      await fs.mkdir(sourceDir, { recursive: true });

      // 创建重复内容以获得较好的压缩率
      const repeatContent = 'AAAAAAAAAA'.repeat(1000);
      await fs.writeFile(path.join(sourceDir, 'repeating.txt'), repeatContent);

      // 执行：压缩
      const compressResult = await engine.compress(sourceDir, archivePath);

      // 验证：压缩率应该较高（>50%）
      expect(compressResult.compressionRatio).toBeGreaterThan(50);
    });

    it('should preserve file metadata on decompress', async () => {
      // 准备：创建源目录
      const sourceDir = path.join(testDir, 'source');
      const archivePath = path.join(testDir, 'archive.tar.gz');
      const destDir = path.join(testDir, 'dest');

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file.txt'), 'content');

      const originalStat = await fs.stat(path.join(sourceDir, 'file.txt'));

      // 执行：压缩和解压
      await engine.compress(sourceDir, archivePath);
      await engine.decompress(archivePath, destDir);

      // 验证：mtime 应该保留
      const restoredStat = await fs.stat(path.join(destDir, 'file.txt'));
      expect(Math.abs(restoredStat.mtime.getTime() - originalStat.mtime.getTime())).toBeLessThan(1000);
    });
  });

  describe('checksum()', () => {
    it('should calculate SHA256 checksum', async () => {
      // 准备：创建测试文件
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      // 执行：计算 SHA256 校验和
      const checksum = await engine.checksum(filePath, 'sha256');

      // 验证：校验和格式（64个十六进制字符）
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should calculate MD5 checksum', async () => {
      // 准备：创建测试文件
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      // 执行：计算 MD5 校验和
      const checksum = await engine.checksum(filePath, 'md5');

      // 验证：校验和格式（32个十六进制字符）
      expect(checksum).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should produce consistent checksums', async () => {
      // 准备：创建测试文件
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      // 执行：计算校验和两次
      const checksum1 = await engine.checksum(filePath, 'sha256');
      const checksum2 = await engine.checksum(filePath, 'sha256');

      // 验证：校验和应该相同
      expect(checksum1).toBe(checksum2);
    });

    it('should produce different checksums for different content', async () => {
      // 准备：创建两个不同内容的文件
      const file1Path = path.join(testDir, 'file1.txt');
      const file2Path = path.join(testDir, 'file2.txt');

      await fs.writeFile(file1Path, 'content 1');
      await fs.writeFile(file2Path, 'content 2');

      // 执行：计算校验和
      const checksum1 = await engine.checksum(file1Path, 'sha256');
      const checksum2 = await engine.checksum(file2Path, 'sha256');

      // 验证：校验和应该不同
      expect(checksum1).not.toBe(checksum2);
    });
  });
});
