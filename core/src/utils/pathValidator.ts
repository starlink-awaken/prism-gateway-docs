/**
 * P0-3: 路径白名单验证器
 *
 * @description
 * 提供安全的路径验证功能，防止：
 * 1. 路径遍历攻击 (..)
 * 2. 绝对路径注入
 * 3. 未授权目录访问
 * 4. 危险文件扩展名
 *
 * @module utils/pathValidator
 */

/**
 * 路径类型枚举
 */
export enum PathType {
  RELATIVE = 'relative',
  ABSOLUTE = 'absolute',
  ROOT = 'root',
  UNC = 'unc' // Universal Naming Convention (\\server\share)
}

/**
 * 验证错误类型
 */
export enum ValidationError {
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  ABSOLUTE_PATH_NOT_ALLOWED = 'ABSOLUTE_PATH_NOT_ALLOWED',
  NOT_IN_WHITELIST = 'NOT_IN_WHITELIST',
  INVALID_EXTENSION = 'INVALID_EXTENSION',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
  EMPTY_PATH = 'EMPTY_PATH',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_CHARACTER = 'INVALID_CHARACTER',
  PATH_TOO_LONG = 'PATH_TOO_LONG'
}

/**
 * 验证结果接口
 */
export interface PathValidationResult {
  valid: boolean;
  normalizedPath?: string;
  error?: ValidationError;
  errorMessage?: string;
}

/**
 * PathValidator 配置选项
 */
export interface PathValidatorOptions {
  /** 是否允许相对路径 */
  allowRelative?: boolean;
  /** 是否允许绝对路径 */
  allowAbsolute?: boolean;
  /** 最大路径深度 */
  maxDepth?: number;
  /** 允许的文件扩展名（空列表表示允许所有） */
  allowedExtensions?: string[];
  /** 路径白名单（前缀匹配） */
  whitelist?: string[];
  /** 路径白名单正则表达式 */
  whitelistPatterns?: RegExp[];
  /** 最大路径长度 */
  maxPathLength?: number;
  /** 是否启用严格模式（拒绝特殊字符） */
  strictMode?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<PathValidatorOptions> = {
  allowRelative: true,
  allowAbsolute: false,
  maxDepth: 20,
  allowedExtensions: [],
  whitelist: [],
  whitelistPatterns: [],
  maxPathLength: 4096,
  strictMode: true
};

/**
 * 危险字符集合（严格模式下拒绝）
 */
const DANGEROUS_CHARS = [
  '\x00', // 空字节
  '\n',   // 换行
  '\r',   // 回车
  '\t',   // 制表符
  '\x1b', // ESC
  '<',   // HTML 特殊字符
  '>',
  '|',
  '*',
  '?'
];

/**
 * 路径白名单验证器
 *
 * @description
 * 提供安全的路径验证，防止路径遍历攻击和未授权访问。
 *
 * @example
 * ```ts
 * const validator = new PathValidator({
 *   allowRelative: true,
 *   allowAbsolute: false,
 *   whitelist: ['/level-1-hot', '/level-2-warm'],
 *   allowedExtensions: ['.json', '.jsonl']
 * });
 *
 * const result = validator.validate('level-1-hot/principles.json');
 * if (result.valid) {
 *   console.log(result.normalizedPath);
 * }
 * ```
 */
export class PathValidator {
  private options: Required<PathValidatorOptions>;

  constructor(options: PathValidatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 验证路径
   *
   * @param path - 待验证的路径
   * @returns 验证结果
   */
  validate(path: unknown): PathValidationResult {
    // 输入类型检查
    if (path === null || path === undefined) {
      return {
        valid: false,
        error: ValidationError.INVALID_INPUT,
        errorMessage: '路径不能为 null 或 undefined'
      };
    }

    if (typeof path !== 'string') {
      return {
        valid: false,
        error: ValidationError.INVALID_INPUT,
        errorMessage: `路径必须是字符串，收到: ${typeof path}`
      };
    }

    const trimmed = path.trim();

    // 空路径检查
    if (trimmed === '') {
      return {
        valid: false,
        error: ValidationError.EMPTY_PATH,
        errorMessage: '路径不能为空'
      };
    }

    // 长度检查
    if (trimmed.length > this.options.maxPathLength) {
      return {
        valid: false,
        error: ValidationError.PATH_TOO_LONG,
        errorMessage: `路径超过最大长度 ${this.options.maxPathLength}`
      };
    }

    // 危险字符检查
    if (this.options.strictMode) {
      for (const char of DANGEROUS_CHARS) {
        if (trimmed.includes(char)) {
          return {
            valid: false,
            error: ValidationError.INVALID_CHARACTER,
            errorMessage: `路径包含危险字符: ${char.charCodeAt(0).toString(16)}`
          };
        }
      }
    }

    // 规范化路径
    let normalized = this.normalizePath(trimmed);

    // 路径遍历检查（必须在规范化后再次检查）
    if (this.containsPathTraversal(normalized)) {
      return {
        valid: false,
        error: ValidationError.PATH_TRAVERSAL,
        errorMessage: '路径包含遍历序列 (..)'
      };
    }

    // 路径类型检查
    const pathType = this.getPathType(normalized);

    if (pathType === PathType.ABSOLUTE && !this.options.allowAbsolute) {
      return {
        valid: false,
        error: ValidationError.ABSOLUTE_PATH_NOT_ALLOWED,
        errorMessage: '绝对路径不被允许'
      };
    }

    // 移除开头的 / 用于白名单检查
    const relativePath = normalized.startsWith('/')
      ? normalized.slice(1)
      : normalized;

    // 深度检查（在白名单检查之前）
    const depth = this.getDepth(relativePath);
    if (depth > this.options.maxDepth) {
      return {
        valid: false,
        error: ValidationError.MAX_DEPTH_EXCEEDED,
        errorMessage: `路径深度 ${depth} 超过最大值 ${this.options.maxDepth}`
      };
    }

    // 白名单检查
    if (!this.isWhitelisted(relativePath)) {
      return {
        valid: false,
        error: ValidationError.NOT_IN_WHITELIST,
        errorMessage: `路径不在白名单中: ${relativePath}`
      };
    }

    // 扩展名检查
    if (this.options.allowedExtensions.length > 0) {
      const ext = this.getExtension(relativePath);

      // 检查是否是目录（没有文件名部分或路径以 / 结尾）
      const isDirectory = relativePath.endsWith('/') ||
                          !relativePath.includes('/') ||
                          relativePath.split('/').pop() === '';

      // 如果不是目录且没有扩展名，拒绝
      if (!isDirectory && ext === '') {
        return {
          valid: false,
          error: ValidationError.INVALID_EXTENSION,
          errorMessage: '文件必须有扩展名'
        };
      }

      // 检查扩展名是否在允许列表中
      if (ext !== '' && !this.options.allowedExtensions.includes(ext)) {
        return {
          valid: false,
          error: ValidationError.INVALID_EXTENSION,
          errorMessage: `不允许的文件扩展名: ${ext}`
        };
      }
    }

    return {
      valid: true,
      normalizedPath: relativePath
    };
  }

  /**
   * 批量验证路径
   *
   * @param paths - 路径数组
   * @returns 验证结果 Map
   */
  validateBatch(paths: string[]): Map<string, PathValidationResult> {
    const results = new Map<string, PathValidationResult>();

    for (const path of paths) {
      results.set(path, this.validate(path));
    }

    return results;
  }

  /**
   * 过滤出有效的路径
   *
   * @param paths - 路径数组
   * @returns 有效的路径数组
   */
  filterValid(paths: string[]): string[] {
    const results: string[] = [];

    for (const path of paths) {
      const result = this.validate(path);
      if (result.valid && result.normalizedPath) {
        results.push(result.normalizedPath);
      }
    }

    return results;
  }

  /**
   * 规范化路径
   *
   * @param path - 原始路径
   * @returns 规范化后的路径
   * @description
   * 注意：此方法不解析 ..，因为路径遍历检测需要在验证阶段进行。
   */
  normalizePath(path: string): string {
    // 统一分隔符
    let normalized = path.replace(/\\/g, '/');

    // 解码 URL 编码（防止编码攻击）
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // 如果解码失败，保持原样
    }

    // 移除多余的斜杠
    normalized = normalized.replace(/\/+/g, '/');

    // 移除当前目录引用（但不处理 ..）
    normalized = normalized.replace(/\/\.\//g, '/');

    // 移除尾部斜杠（但保留根路径的 /）
    if (normalized.length > 1) {
      normalized = normalized.replace(/\/+$/, '');
    }

    // 移除开头的 ./
    normalized = normalized.replace(/^\.\//, '');

    // 处理 Windows 盘符
    if (/^[A-Za-z]:/.test(normalized)) {
      normalized = '/' + normalized;
    }

    return normalized;
  }

  /**
   * 检测路径遍历
   *
   * @param path - 待检查的路径
   * @returns 是否包含路径遍历
   */
  private containsPathTraversal(path: string): boolean {
    // 检查显式的 ..
    if (path.includes('..')) {
      return true;
    }

    // 检查 URL 编码的 ..
    if (/%2e%2e/i.test(path) || /%252e/i.test(path)) {
      return true;
    }

    return false;
  }

  /**
   * 检查路径是否在白名单中
   *
   * @param path - 相对路径
   * @returns 是否在白名单中
   */
  private isWhitelisted(path: string): boolean {
    // 空白名单表示允许所有路径
    if (this.options.whitelist.length === 0 && this.options.whitelistPatterns.length === 0) {
      return true;
    }

    // 检查字符串白名单
    for (const prefix of this.options.whitelist) {
      // 移除白名单项前导斜杠
      const normalizedPrefix = prefix.startsWith('/') ? prefix.slice(1) : prefix;

      // 完全匹配
      if (path === normalizedPrefix) {
        return true;
      }

      // 前缀匹配（路径以白名单项开头，后面跟着 /）
      // 需要确保不会匹配 level-1-hot-fake
      if (path.startsWith(normalizedPrefix + '/')) {
        return true;
      }
    }

    // 检查正则表达式白名单
    for (const pattern of this.options.whitelistPatterns) {
      if (pattern.test(path)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取路径类型
   *
   * @param path - 路径
   * @returns 路径类型
   */
  getPathType(path: string): PathType {
    if (path === '/') {
      return PathType.ROOT;
    }

    if (path.startsWith('//') || path.startsWith('\\\\')) {
      return PathType.UNC;
    }

    if (path.startsWith('/')) {
      return PathType.ABSOLUTE;
    }

    // Windows 盘符路径
    if (/^[A-Za-z]:/.test(path)) {
      return PathType.ABSOLUTE;
    }

    return PathType.RELATIVE;
  }

  /**
   * 获取文件扩展名
   *
   * @param path - 文件路径
   * @returns 扩展名（包含点号）
   * @description
   * 纯隐藏文件（. 开头且只有一个点）被视为无扩展名
   * 例如：.hidden 返回 ''，.hidden.txt 返回 '.txt'，file.json 返回 '.json'
   */
  getExtension(path: string): string {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];

    // 纯隐藏文件（只有一个点且在开头）
    if (filename === '.' || filename.startsWith('.') && !filename.includes('.', 1)) {
      return '';
    }

    const dotIndex = filename.lastIndexOf('.');

    // 无扩展名
    if (dotIndex <= 0) {
      return '';
    }

    return filename.slice(dotIndex);
  }

  /**
   * 检查路径是否有扩展名
   *
   * @param path - 文件路径
   * @returns 是否有扩展名
   */
  private hasExtension(path: string): boolean {
    const ext = this.getExtension(path);
    return ext.length > 0;
  }

  /**
   * 计算路径深度
   *
   * @param path - 路径
   * @returns 深度（层级数）
   */
  getDepth(path: string): number {
    const parts = path.split('/').filter(p => p.length > 0);
    return parts.length;
  }

  /**
   * 拼接路径
   *
   * @param parts - 路径片段
   * @returns 拼接并规范化后的路径
   * @description
   * 注意：如果输入包含 ..，结果会因为安全检查而被拒绝。
   * 此方法主要用于安全的路径拼接。
   */
  joinPath(...parts: string[]): string {
    const joined = parts.join('/');
    const normalized = this.normalizePath(joined);

    // 如果规范化后包含 ..，返回原结果（用于测试场景）
    // 实际使用时 validate() 会拒绝这些路径
    return normalized;
  }

  /**
   * 更新白名单
   *
   * @param whitelist - 新的白名单
   */
  updateWhitelist(whitelist: string[]): void {
    this.options.whitelist = [...whitelist];
  }

  /**
   * 添加到白名单
   *
   * @param path - 要添加的路径
   */
  addToWhitelist(path: string): void {
    if (!this.options.whitelist.includes(path)) {
      this.options.whitelist.push(path);
    }
  }

  /**
   * 从白名单移除
   *
   * @param path - 要移除的路径
   * @description
   * 会移除带或不带前导斜杠的路径
   */
  removeFromWhitelist(path: string): void {
    // 标准化路径进行比较
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const withSlash = '/' + normalizedPath;

    this.options.whitelist = this.options.whitelist.filter(p => {
      const normalizedP = p.startsWith('/') ? p.slice(1) : p;
      return normalizedP !== normalizedPath;
    });
  }

  /**
   * 更新允许的扩展名列表
   *
   * @param extensions - 新的扩展名列表
   */
  updateAllowedExtensions(extensions: string[]): void {
    this.options.allowedExtensions = [...extensions];
  }

  /**
   * 添加允许的扩展名
   *
   * @param ext - 要添加的扩展名
   */
  addAllowedExtension(ext: string): void {
    if (!ext.startsWith('.')) {
      ext = '.' + ext;
    }
    if (!this.options.allowedExtensions.includes(ext)) {
      this.options.allowedExtensions.push(ext);
    }
  }

  /**
   * 获取当前配置
   *
   * @returns 当前配置的副本
   */
  getOptions(): Readonly<Required<PathValidatorOptions>> {
    return { ...this.options };
  }
}

/**
 * 创建默认的 PRISM-Gateway 路径验证器
 *
 * @returns 配置好的 PathValidator 实例
 *
 * @example
 * ```ts
 * const validator = createPrismPathValidator();
 * const result = validator.validate('level-1-hot/principles.json');
 * ```
 */
export function createPrismPathValidator(): PathValidator {
  return new PathValidator({
    allowRelative: true,
    allowAbsolute: false,
    maxDepth: 10,
    allowedExtensions: ['.json', '.jsonl', '.md'],
    whitelist: [
      'level-1-hot',
      'level-2-warm',
      'level-3-cold'
    ]
  });
}

/**
 * 验证单个路径的快捷方法
 *
 * @param path - 待验证的路径
 * @param options - 验证器选项
 * @returns 验证结果
 */
export function validatePath(
  path: string,
  options?: PathValidatorOptions
): PathValidationResult {
  const validator = new PathValidator(options);
  return validator.validate(path);
}

/**
 * 导出类型
 */
export type { PathValidationResult, PathValidatorOptions };
