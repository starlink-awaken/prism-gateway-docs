/**
 * IAnalyzer - 分析器接口
 *
 * @description
 * 定义数据分析的通用契约
 *
 * @remarks
 * 设计原则：
 * - 泛型设计：支持不同类型的输入输出
 * - 单一职责：只负责数据分析，不负责数据聚合
 * - 可扩展性：支持多种分析算法
 *
 * @example
 * ```typescript
 * class TrendAnalyzer implements IAnalyzer<TrendData, TrendAnalysis> {
 *   async analyze(data: TrendData, options?: AnalysisOptions): Promise<TrendAnalysis> {
 *     // 分析逻辑
 *   }
 * }
 * ```
 */

/**
 * 分析选项
 *
 * @description
 * 分析算法的可配置选项
 */
export interface AnalysisOptions {
  /**
   * 窗口大小（用于移动平均）
   *
   * @default 7
   */
  windowSize?: number;

  /**
   * 置信度阈值
   *
   * @default 0.8
   */
  confidenceThreshold?: number;

  /**
   * 是否启用详细输出
   *
   * @default false
   */
  verbose?: boolean;
}

/**
 * IAnalyzer - 分析器接口
 *
 * @description
 * 定义数据分析的通用操作
 *
 * @typeParam TInput - 输入数据类型
 * @typeParam TOutput - 输出分析结果类型
 *
 * @remarks
 * 所有分析器必须实现此接口
 */
export interface IAnalyzer<TInput, TOutput> {
  /**
   * 分析数据
   *
   * @param data - 输入数据
   * @param options - 分析选项
   * @returns 分析结果
   *
   * @example
   * ```typescript
   * const analyzer = new TrendAnalyzer();
   * const trendData = await getTrendData('violations', TimePeriod.month());
   * const analysis = await analyzer.analyze(trendData, { windowSize: 7 });
   * console.log(`趋势方向: ${analysis.direction}`);
   * ```
   */
  analyze(data: TInput, options?: AnalysisOptions): Promise<TOutput>;
}
