/**
 * P0-3: 路径白名单验证器测试
 *
 * 测试目标:
 * 1. PathValidator 类实现路径白名单检查
 * 2. 过滤路径遍历攻击 (..)
 * 3. 过滤绝对路径
 * 4. 前缀验证
 * 5. 正则表达式匹配
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  PathValidator,
  PathValidationResult,
  PathType,
  ValidationError
} from '../utils/pathValidator.js';

describe('P0-3: 路径白名单验证器', () => {
  let validator: PathValidator;

  beforeEach(() => {
    // 创建默认的验证器
    validator = new PathValidator({
      allowRelative: true,
      allowAbsolute: false,
      maxDepth: 10,
      allowedExtensions: ['.json', '.jsonl', '.md'],
      whitelist: ['/level-1-hot', '/level-2-warm', '/level-3-cold']
    });
  });

  describe('PathValidator - 基本验证', () => {
    it('应该接受有效的相对路径', () => {
      const result = validator.validate('level-1-hot/principles.json');
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBeDefined();
    });

    it('应该拒绝包含 .. 的路径（路径遍历攻击）', () => {
      const result = validator.validate('../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.PATH_TRAVERSAL);
    });

    it('应该拒绝包含 ./../ 的路径', () => {
      const result = validator.validate('./level-1-hot/../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.PATH_TRAVERSAL);
    });

    it('应该拒绝包含 ../ 的深层路径', () => {
      const result = validator.validate('data/../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.PATH_TRAVERSAL);
    });

    it('应该拒绝绝对路径（当配置禁用时）', () => {
      const result = validator.validate('/etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.ABSOLUTE_PATH_NOT_ALLOWED);
    });

    it('应该接受绝对路径（当配置启用时）', () => {
      const absValidator = new PathValidator({
        allowRelative: true,
        allowAbsolute: true,
        whitelist: ['/etc', '/var']
      });

      const result = absValidator.validate('/etc/passwd');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝空路径', () => {
      const result = validator.validate('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.EMPTY_PATH);
    });

    it('应该拒绝只包含空格的路径', () => {
      const result = validator.validate('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('PathValidator - 白名单验证', () => {
    it('应该接受在白名单中的路径', () => {
      const result = validator.validate('level-1-hot/principles.json');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝不在白名单中的路径', () => {
      const result = validator.validate('level-4-invalid/data.json');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.NOT_IN_WHITELIST);
    });

    it('应该支持白名单前缀匹配', () => {
      const result = validator.validate('level-1-hot/patterns/success.json');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝类似但不同的路径', () => {
      const result = validator.validate('level-1-hot-fake/data.json');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.NOT_IN_WHITELIST);
    });

    it('应该支持空白名单（允许所有路径）', () => {
      const noWhitelistValidator = new PathValidator({
        allowRelative: true,
        allowAbsolute: false,
        whitelist: [] // 空白名单
      });

      const result = noWhitelistValidator.validate('any-path/data.json');
      expect(result.valid).toBe(true);
    });
  });

  describe('PathValidator - 文件扩展名验证', () => {
    it('应该接受允许的扩展名', () => {
      const jsonResult = validator.validate('level-1-hot/data.json');
      expect(jsonResult.valid).toBe(true);

      const jsonlResult = validator.validate('level-1-hot/data.jsonl');
      expect(jsonlResult.valid).toBe(true);

      const mdResult = validator.validate('level-1-hot/readme.md');
      expect(mdResult.valid).toBe(true);
    });

    it('应该拒绝不允许的扩展名', () => {
      const result = validator.validate('level-1-hot/script.js');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.INVALID_EXTENSION);
    });

    it('应该接受没有扩展名的文件（当配置启用时）', () => {
      const noExtValidator = new PathValidator({
        allowRelative: true,
        allowAbsolute: false,
        allowedExtensions: [] // 空列表表示允许所有
      });

      const result = noExtValidator.validate('level-1-hot/README');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝没有扩展名的文件（当配置禁用时）', () => {
      const result = validator.validate('level-1-hot/README');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.INVALID_EXTENSION);
    });
  });

  describe('PathValidator - 路径深度限制', () => {
    it('应该限制路径深度', () => {
      const deepPath = 'a/b/c/d/e/f/g/h/i/j/k'; // 11 层
      const result = validator.validate(deepPath);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.MAX_DEPTH_EXCEEDED);
    });

    it('应该接受在深度限制内的路径', () => {
      const shallowPath = 'a/b/c/d'; // 4 层
      const result = validator.validate(shallowPath);
      // 这个路径不在白名单中，所以不是因为深度失败
      // 但如果配置为空白名单，应该通过深度检查
      const noWhitelistValidator = new PathValidator({
        allowRelative: true,
        allowAbsolute: false,
        maxDepth: 10,
        whitelist: []
      });

      const shallowResult = noWhitelistValidator.validate(shallowPath);
      expect(shallowResult.valid).toBe(true);
    });

    it('应该正确计算深度', () => {
      const noWhitelistValidator = new PathValidator({
        allowRelative: true,
        allowAbsolute: false,
        maxDepth: 3,
        whitelist: []
      });

      const validResult = noWhitelistValidator.validate('a/b/c');
      expect(validResult.valid).toBe(true);

      const invalidResult = noWhitelistValidator.validate('a/b/c/d');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe(ValidationError.MAX_DEPTH_EXCEEDED);
    });
  });

  describe('PathValidator - 路径规范化', () => {
    it('应该规范化路径中的 ./', () => {
      const result = validator.validate('./level-1-hot/principles.json');
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe('level-1-hot/principles.json');
    });

    it('应该规范化路径中的多个 /', () => {
      const result = validator.validate('level-1-hot//principles.json');
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe('level-1-hot/principles.json');
    });

    it('应该移除尾部斜杠', () => {
      const result = validator.validate('level-1-hot/');
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe('level-1-hot');
    });

    it('应该规范化路径中的 .', () => {
      const result = validator.validate('./level-1-hot/./principles.json');
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe('level-1-hot/principles.json');
    });

    it('应该处理 Windows 风格路径', () => {
      const result = validator.validate('level-1-hot\\principles.json');
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBe('level-1-hot/principles.json');
    });
  });

  describe('PathValidator - 路径类型检测', () => {
    it('应该正确识别相对路径', () => {
      expect(validator.getPathType('level-1-hot/data.json')).toBe(PathType.RELATIVE);
      expect(validator.getPathType('./data.json')).toBe(PathType.RELATIVE);
      expect(validator.getPathType('../parent/data.json')).toBe(PathType.RELATIVE);
    });

    it('应该正确识别绝对路径', () => {
      expect(validator.getPathType('/etc/passwd')).toBe(PathType.ABSOLUTE);
      expect(validator.getPathType('C:\\Windows\\System32')).toBe(PathType.ABSOLUTE);
    });

    it('应该正确识别根路径', () => {
      expect(validator.getPathType('/')).toBe(PathType.ROOT);
    });

    it('应该正确识别 UNC 路径', () => {
      expect(validator.getPathType('\\\\server\\share\\file.txt')).toBe(PathType.UNC);
    });
  });

  describe('PathValidator - 正则表达式匹配', () => {
    it('应该支持正则表达式白名单', () => {
      const regexValidator = new PathValidator({
        allowRelative: true,
        allowAbsolute: false,
        whitelist: [],
        whitelistPatterns: [/^level-\d+-hot\/.*\.json$/, /^level-\d+-warm\/.*\.jsonl$/]
      });

      const result1 = regexValidator.validate('level-1-hot/principles.json');
      expect(result1.valid).toBe(true);

      const result2 = regexValidator.validate('level-2-warm/logs.jsonl');
      expect(result2.valid).toBe(true);

      const result3 = regexValidator.validate('level-1-hot/readme.txt');
      expect(result3.valid).toBe(false);
    });

    it('应该同时支持字符串和正则表达式白名单', () => {
      const mixedValidator = new PathValidator({
        allowRelative: true,
        allowAbsolute: false,
        whitelist: ['allowed-dir'],
        whitelistPatterns: [/^temp-.*\.tmp$/]
      });

      const result1 = mixedValidator.validate('allowed-dir/file.json');
      expect(result1.valid).toBe(true);

      const result2 = mixedValidator.validate('temp-123.tmp');
      expect(result2.valid).toBe(true);

      const result3 = mixedValidator.validate('other/file.json');
      expect(result3.valid).toBe(false);
    });
  });

  describe('PathValidator - 批量验证', () => {
    it('应该支持批量验证路径', () => {
      const paths = [
        'level-1-hot/principles.json',
        'level-2-warm/logs.jsonl',
        'invalid/path.txt'
      ];

      const results = validator.validateBatch(paths);

      expect(results.get('level-1-hot/principles.json')?.valid).toBe(true);
      expect(results.get('level-2-warm/logs.jsonl')?.valid).toBe(true);
      expect(results.get('invalid/path.txt')?.valid).toBe(false);
    });

    it('应该返回有效的路径列表', () => {
      const paths = [
        'level-1-hot/principles.json',
        'level-2-warm/logs.jsonl',
        'invalid/path.txt'
      ];

      const validPaths = validator.filterValid(paths);

      expect(validPaths).toHaveLength(2);
      expect(validPaths).toContain('level-1-hot/principles.json');
      expect(validPaths).toContain('level-2-warm/logs.jsonl');
    });
  });

  describe('PathValidator - 边界情况', () => {
    it('应该拒绝 null 输入', () => {
      const result = validator.validate(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.INVALID_INPUT);
    });

    it('应该拒绝 undefined 输入', () => {
      const result = validator.validate(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.INVALID_INPUT);
    });

    it('应该拒绝非字符串输入', () => {
      const result = validator.validate(123 as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(ValidationError.INVALID_INPUT);
    });

    it('应该拒绝包含空字节的路径', () => {
      const result = validator.validate('level-1-hot/\x00file.json');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝包含控制字符的路径', () => {
      const result = validator.validate('level-1-hot/\nfile.json');
      expect(result.valid).toBe(false);
    });

    it('应该处理 Unicode 路径', () => {
      const unicodeValidator = new PathValidator({
        allowRelative: true,
        allowAbsolute: false,
        whitelist: ['数据']
      });

      const result = unicodeValidator.validate('数据/文件.json');
      expect(result.valid).toBe(true);
    });
  });

  describe('PathValidator - 安全相关', () => {
    it('应该拒绝 URL 编码的路径遍历', () => {
      const result = validator.validate('level-1-hot/%2e%2e/%2e%2e/etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝双编码的路径遍历', () => {
      const result = validator.validate('level-1-hot/..%252f/etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝包含 null 字符的路径', () => {
      const result = validator.validate('level-1-hot/principles.json\x00.txt');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝超长路径', () => {
      const longPath = 'a/' + 'x'.repeat(10000);
      const result = validator.validate(longPath);
      expect(result.valid).toBe(false);
    });
  });

  describe('PathValidator - 配置更新', () => {
    it('应该支持动态更新白名单', () => {
      validator.updateWhitelist(['new-dir']);

      const result = validator.validate('new-dir/file.json');
      expect(result.valid).toBe(true);
    });

    it('应该支持动态添加白名单项', () => {
      validator.addToWhitelist('another-dir');

      const result = validator.validate('another-dir/file.json');
      expect(result.valid).toBe(true);
    });

    it('应该支持动态从白名单移除', () => {
      validator.removeFromWhitelist('level-1-hot');

      const result = validator.validate('level-1-hot/principles.json');
      expect(result.valid).toBe(false);
    });

    it('应该支持更新扩展名列表', () => {
      validator.updateAllowedExtensions(['.txt']);

      const result = validator.validate('level-1-hot/readme.txt');
      expect(result.valid).toBe(true);
    });
  });

  describe('PathValidator - 工具方法', () => {
    it('应该正确提取文件扩展名', () => {
      expect(validator.getExtension('file.json')).toBe('.json');
      expect(validator.getExtension('file.tar.gz')).toBe('.gz');
      expect(validator.getExtension('file')).toBe('');
      // 隐藏文件被视为没有扩展名
      expect(validator.getExtension('.hidden')).toBe('');
      expect(validator.getExtension('.hidden.txt')).toBe('.txt');
    });

    it('应该正确计算路径深度', () => {
      expect(validator.getDepth('a/b/c')).toBe(3);
      expect(validator.getDepth('a')).toBe(1);
      expect(validator.getDepth('a/b/c/d/e/f')).toBe(6);
      expect(validator.getDepth('')).toBe(0);
    });

    it('应该正确拼接路径', () => {
      expect(validator.joinPath('a', 'b', 'c')).toBe('a/b/c');
      expect(validator.joinPath('a/', '/b/', 'c')).toBe('a/b/c');
      // .. 会被保留，validate() 会拒绝它
      expect(validator.joinPath('a', '..', 'b')).toBe('a/../b');
    });
  });
});
