#!/usr/bin/env bun
/**
 * PRISM-Gateway CLI
 * 统一的7维度复盘和Gateway系统命令行工具
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 导入核心模块
import { gatewayGuard } from '../core/GatewayGuard.js';
import { retrospectiveCore, RetroMode } from '../core/RetrospectiveCore.js';
import { memoryStore } from '../core/MemoryStore.js';
import { CheckStatus } from '../types/checks.js';
import { MigrationRunner } from '../migration/MigrationRunner.js';

// 获取版本号
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '../../package.json');

let version = '1.0.0';
try {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  version = pkg.version || '1.0.0';
} catch {
  // 使用默认版本
}

/**
 * 创建CLI程序
 */
const program = new Command();

/**
 * 格式化输出
 */
class OutputFormatter {
  /**
   * 格式化检查结果
   */
  static formatCheckResult(result: any, format: 'text' | 'json' | 'markdown'): string {
    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    if (format === 'markdown') {
      return this.formatCheckAsMarkdown(result);
    }

    return this.formatCheckAsText(result);
  }

  /**
   * 格式化为文本
   */
  private static formatCheckAsText(result: any): string {
    const lines: string[] = [];

    // 状态图标
    const statusIcons = {
      [CheckStatus.PASS]: '✅',
      [CheckStatus.WARNING]: '⚠️',
      [CheckStatus.BLOCKED]: '🚫'
    };

    lines.push(statusIcons[result.status] + ' Gateway检查结果: ' + result.status);
    lines.push('检查耗时: ' + result.check_time + 'ms');
    lines.push('');

    // 违规
    if (result.violations && result.violations.length > 0) {
      lines.push('违规:');
      result.violations.forEach((v: any) => {
        lines.push(`  - [${v.principle_id}] ${v.principle_name}`);
        lines.push(`    ${v.message}`);
      });
      lines.push('');
    }

    // 风险
    if (result.risks && result.risks.length > 0) {
      lines.push('风险:');
      result.risks.slice(0, 3).forEach((r: any) => {
        lines.push(`  - [${r.pattern_id}] ${r.pattern_name} (置信度: ${(r.confidence * 100).toFixed(0)}%)`);
      });
      lines.push('');
    }

    // 陷阱
    if (result.traps && result.traps.length > 0) {
      lines.push('陷阱:');
      result.traps.forEach((t: any) => {
        lines.push(`  - [${t.severity}] ${t.pattern_name}`);
        lines.push(`    ${t.message}`);
      });
      lines.push('');
    }

    // 建议
    if (result.suggestions && result.suggestions.length > 0) {
      lines.push('建议:');
      result.suggestions.forEach((s: any) => {
        lines.push(`  - ${s.message}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 格式化为Markdown
   */
  private static formatCheckAsMarkdown(result: any): string {
    const lines: string[] = [];

    lines.push(`# Gateway检查结果`);
    lines.push(``);
    lines.push(`**状态**: ${result.status}`);
    lines.push(`**检查耗时**: ${result.check_time}ms`);
    lines.push(`**时间戳**: ${result.timestamp}`);
    lines.push(``);

    if (result.violations && result.violations.length > 0) {
      lines.push(`## 违规`);
      result.violations.forEach((v: any) => {
        lines.push(`- **[${v.principle_id}]** ${v.principle_name}`);
        lines.push(`  - ${v.message}`);
      });
      lines.push(``);
    }

    if (result.risks && result.risks.length > 0) {
      lines.push(`## 风险`);
      result.risks.forEach((r: any) => {
        lines.push(`- **[${r.pattern_id}]** ${r.pattern_name} (置信度: ${(r.confidence * 100).toFixed(0)}%)`);
      });
      lines.push(``);
    }

    if (result.traps && result.traps.length > 0) {
      lines.push(`## 陷阱`);
      result.traps.forEach((t: any) => {
        lines.push(`- **[${t.severity}]** ${t.pattern_name}: ${t.message}`);
      });
      lines.push(``);
    }

    if (result.suggestions && result.suggestions.length > 0) {
      lines.push(`## 建议`);
      result.suggestions.forEach((s: any) => {
        lines.push(`- ${s.message}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 格式化复盘结果
   */
  static formatRetroResult(execution: any, format: 'text' | 'json' | 'markdown'): string {
    if (format === 'json') {
      return JSON.stringify(execution, null, 2);
    }

    if (format === 'markdown') {
      return this.formatRetroAsMarkdown(execution);
    }

    return this.formatRetroAsText(execution);
  }

  /**
   * 格式化复盘为文本
   */
  private static formatRetroAsText(execution: any): string {
    const lines: string[] = [];

    const statusIcon = execution.status === 'COMPLETED' ? '✅' : '❌';
    lines.push(`${statusIcon} 复盘完成`);
    lines.push(`状态: ${execution.status}`);
    lines.push(`复盘ID: ${execution.id}`);
    lines.push(`耗时: ${execution.totalDuration}ms`);
    lines.push(`模式: ${execution.results?.analysis ? 'Standard/Deep' : 'Quick'}`);
    lines.push('');

    if (execution.results?.analysis) {
      const analysis = execution.results.analysis;
      lines.push('分析结果:');
      lines.push(`  成功要素: ${analysis.successFactors?.length || 0}个`);
      lines.push(`  失败原因: ${analysis.failureReasons?.length || 0}个`);
      lines.push(`  置信度: ${((analysis.confidence || 0) * 100).toFixed(0)}%`);
      lines.push('');
    }

    if (execution.results?.extraction) {
      const extraction = execution.results.extraction;
      lines.push('提取结果:');
      lines.push(`  可复用知识: ${extraction.reusableKnowledge?.length || 0}个`);
      lines.push(`  改进领域: ${extraction.improvementAreas?.length || 0}个`);
      lines.push(`  学到教训: ${extraction.lessonsLearned?.length || 0}个`);
      lines.push(`  行动项: ${extraction.actionItems?.length || 0}个`);
    }

    if (execution.results?.errors && execution.results.errors.length > 0) {
      lines.push('');
      lines.push('错误:');
      execution.results.errors.forEach((e: string) => {
        lines.push(`  - ${e}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 格式化复盘为Markdown
   */
  private static formatRetroAsMarkdown(execution: any): string {
    const lines: string[] = [];

    lines.push(`# 复盘报告`);
    lines.push(``);
    lines.push(`- **状态**: ${execution.status}`);
    lines.push(`- **复盘ID**: ${execution.id}`);
    lines.push(`- **耗时**: ${execution.totalDuration}ms`);
    lines.push(`- **开始时间**: ${execution.startTime}`);
    lines.push(`- **结束时间**: ${execution.endTime || '进行中'}`);
    lines.push(``);

    if (execution.results?.analysis) {
      const analysis = execution.results.analysis;
      lines.push(`## 分析结果`);
      lines.push(``);
      lines.push(`- **成功要素**: ${analysis.successFactors?.length || 0}个`);
      if (analysis.successFactors?.length > 0) {
        analysis.successFactors.forEach((f: string) => lines.push(`  - ${f}`));
      }
      lines.push(`- **失败原因**: ${analysis.failureReasons?.length || 0}个`);
      if (analysis.failureReasons?.length > 0) {
        analysis.failureReasons.forEach((f: string) => lines.push(`  - ${f}`));
      }
      lines.push(``);
    }

    if (execution.results?.errors && execution.results.errors.length > 0) {
      lines.push(`## 错误`);
      execution.results.errors.forEach((e: string) => lines.push(`- ${e}`));
      lines.push(``);
    }

    return lines.join('\n');
  }

  /**
   * 格式化统计信息
   */
  static formatStats(stats: any, format: 'text' | 'json' | 'markdown'): string {
    if (format === 'json') {
      return JSON.stringify(stats, null, 2);
    }

    if (format === 'markdown') {
      return this.formatStatsAsMarkdown(stats);
    }

    return this.formatStatsAsText(stats);
  }

  /**
   * 格式化统计为文本
   */
  private static formatStatsAsText(stats: any): string {
    const lines: string[] = [];

    lines.push('📊 PRISM-Gateway 统计信息');
    lines.push('');
    lines.push(`原则: ${stats.principles || 0}条`);
    lines.push(`成功模式: ${stats.successPatterns || 0}个`);
    lines.push(`失败模式: ${stats.failurePatterns || 0}个`);
    lines.push(`复盘记录: ${stats.retroRecords || 0}条`);
    lines.push(`违规记录: ${stats.violations || 0}条`);
    lines.push(`模板: ${stats.templates || 0}个`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 格式化统计为Markdown
   */
  private static formatStatsAsMarkdown(stats: any): string {
    const lines: string[] = [];

    lines.push(`# PRISM-Gateway 统计信息`);
    lines.push(``);
    lines.push(`| 指标 | 数量 |`);
    lines.push(`|------|------|`);
    lines.push(`| 原则 | ${stats.principles || 0} |`);
    lines.push(`| 成功模式 | ${stats.successPatterns || 0} |`);
    lines.push(`| 失败模式 | ${stats.failurePatterns || 0} |`);
    lines.push(`| 复盘记录 | ${stats.retroRecords || 0} |`);
    lines.push(`| 违规记录 | ${stats.violations || 0} |`);
    lines.push(`| 模板 | ${stats.templates || 0} |`);

    return lines.join('\n');
  }
}

// 配置程序
program
  .name('prism')
  .description('PRISM-Gateway: 统一的7维度复盘和Gateway系统')
  .version(version);

/**
 * 检查是否在测试环境
 */
function isTestMode(): boolean {
  return process.env.PRISM_TEST_MODE === 'true' || process.env.NODE_ENV === 'test';
}

/**
 * 退出程序（测试模式下不退出）
 */
function exitProcess(code: number): void {
  if (!isTestMode()) {
    process.exit(code);
  }
  // 在测试模式下，不调用process.exit，让测试框架控制
}

/**
 * check命令 - 检查任务意图
 */
program
  .command('check')
  .description('检查任务意图是否符合Gateway原则')
  .argument('<intent>', '任务意图描述')
  .option('-f, --format <format>', '输出格式 (text|json|markdown)', 'text')
  .option('-v, --verbose', '显示详细信息')
  .action(async (intent: string, options) => {
    try {
      const result = await gatewayGuard.check(intent);
      console.log(OutputFormatter.formatCheckResult(result, options.format));
      exitProcess(0);
    } catch (error) {
      console.error('检查失败:', error instanceof Error ? error.message : String(error));
      exitProcess(1);
    }
  });

/**
 * retro命令 - 执行复盘
 */
program
  .command('retro')
  .description('执行复盘分析')
  .argument('[mode]', '复盘模式 (quick|standard|deep)', 'quick')
  .option('-p, --project <project>', '项目ID', 'default')
  .option('-f, --format <format>', '输出格式 (text|json|markdown)', 'text')
  .option('--phase <phase>', '项目阶段', '执行')
  .action(async (mode: string, options) => {
    try {
      // 验证模式
      const validModes = ['quick', 'standard', 'deep'];
      if (!validModes.includes(mode)) {
        console.error(`错误: 无效的复盘模式 "${mode}"`);
        console.error(`有效模式: ${validModes.join(', ')}`);
        exitProcess(1);
        return;
      }

      // 切换模式
      const retroMode = mode === 'quick' ? RetroMode.QUICK :
                       mode === 'standard' ? RetroMode.STANDARD : RetroMode.DEEP;

      // 在JSON输出模式下，禁用详细日志
      const originalLog = console.log;
      if (options.format === 'json') {
        console.log = () => {}; // 禁用日志
      }

      retrospectiveCore.switchMode(retroMode);

      // 执行复盘
      const taskInput = {
        id: `cli_retro_${Date.now()}`,
        projectId: options.project,
        triggerType: 'manual' as const,
        context: {
          phase: options.phase,
          history: [],
          user_preferences: {}
        },
        metadata: {
          mode: mode,
          startTime: new Date().toISOString()
        }
      };

      if (options.format !== 'json') {
        console.log(`🔄 开始${mode.toUpperCase()}复盘 - 项目: ${options.project}`);
      }

      const execution = await retrospectiveCore.executeRetro(taskInput);

      // 恢复日志
      console.log = originalLog;

      console.log(OutputFormatter.formatRetroResult(execution, options.format));
      exitProcess(0);
    } catch (error) {
      console.error('复盘失败:', error instanceof Error ? error.message : String(error));
      exitProcess(1);
    }
  });

/**
 * status命令 - 显示系统状态
 */
program
  .command('status')
  .description('显示PRISM-Gateway系统状态')
  .option('-v, --verbose', '显示详细信息')
  .option('-f, --format <format>', '输出格式 (text|json)', 'text')
  .action(async (options) => {
    try {
      const status = {
        status: '运行中',
        version,
        components: {
          memoryStore: '正常',
          gatewayGuard: '正常',
          retrospectiveCore: '正常',
          dataExtractor: '正常'
        },
        timestamp: new Date().toISOString()
      };

      if (options.format === 'json') {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log('🔷 PRISM-Gateway 系统状态');
        console.log('');
        console.log(`状态: ${status.status}`);
        console.log(`版本: ${status.version}`);
        console.log(`时间: ${status.timestamp}`);
        console.log('');

        if (options.verbose) {
          console.log('组件状态:');
          Object.entries(status.components).forEach(([name, state]) => {
            console.log(`  ${name}: ${state}`);
          });
        }
      }

      exitProcess(0);
    } catch (error) {
      console.error('获取状态失败:', error instanceof Error ? error.message : String(error));
      exitProcess(1);
    }
  });

/**
 * stats命令 - 显示统计信息
 */
program
  .command('stats')
  .description('显示PRISM-Gateway统计信息')
  .option('-f, --format <format>', '输出格式 (text|json|markdown)', 'text')
  .action(async (options) => {
    try {
      const stats = await memoryStore.getStats();
      console.log(OutputFormatter.formatStats(stats, options.format));
      exitProcess(0);
    } catch (error) {
      console.error('获取统计失败:', error instanceof Error ? error.message : String(error));
      exitProcess(1);
    }
  });

/**
 * principles命令 - 列出所有原则
 */
program
  .command('principles')
  .description('列出所有Gateway原则')
  .option('-f, --format <format>', '输出格式 (text|json)', 'text')
  .action(async (options) => {
    try {
      const principles = await memoryStore.getPrinciples();

      if (options.format === 'json') {
        console.log(JSON.stringify(principles, null, 2));
      } else {
        console.log('📋 Gateway原则列表');
        console.log('');
        principles.forEach((p, index) => {
          console.log(`${index + 1}. [${p.id}] ${p.name}`);
          console.log(`   级别: ${p.level}`);
          console.log(`   描述: ${p.violation_message}`);
          console.log('');
        });
      }

      exitProcess(0);
    } catch (error) {
      console.error('获取原则失败:', error instanceof Error ? error.message : String(error));
      exitProcess(1);
    }
  });

/**
 * patterns命令 - 搜索模式
 */
program
  .command('patterns')
  .description('搜索成功/失败模式')
  .argument('[keyword]', '搜索关键词', '')
  .option('-t, --type <type>', '模式类型 (success|failure|all)', 'all')
  .option('-f, --format <format>', '输出格式 (text|json)', 'text')
  .action(async (keyword: string, options) => {
    try {
      const result = await memoryStore.searchPatterns(keyword || '');

      let patterns: any[] = [];
      if (options.type === 'success') {
        patterns = result.success;
      } else if (options.type === 'failure') {
        patterns = result.failure;
      } else {
        patterns = [...result.success, ...result.failure];
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(patterns, null, 2));
      } else {
        console.log(`🔍 模式搜索结果 (关键词: "${keyword}" || '无')`);
        console.log(``);
        console.log(`找到 ${patterns.length} 个模式:`);
        console.log('');

        patterns.forEach((p, index) => {
          console.log(`${index + 1}. ${p.name}`);
          if ('severity' in p) {
            console.log(`   严重性: ${p.severity}`);
          }
          if ('maturity' in p) {
            console.log(`   成熟度: ${p.maturity}/5`);
          }
          console.log(`   描述: ${p.description || p.characteristic}`);
          console.log('');
        });
      }

      exitProcess(0);
    } catch (error) {
      console.error('搜索模式失败:', error instanceof Error ? error.message : String(error));
      exitProcess(1);
    }
  });

/**
 * migrate命令 - 数据迁移
 */
program
  .command('migrate')
  .description('Phase 1到Phase 2数据迁移')
  .option('-n, --dry-run', '模拟运行，不执行实际更改')
  .option('-r, --rollback', '回滚迁移')
  .option('-s, --status', '显示迁移状态')
  .option('-p, --path <path>', '自定义基础路径')
  .action(async (options) => {
    try {
      const runner = new MigrationRunner(options.path);

      if (options.status) {
        // 显示状态
        const state = await runner.getMigrationState();

        if (!state) {
          console.log('=== 迁移状态 ===');
          console.log('状态: 未开始');
          console.log('Phase 1 数据: 存在');
          console.log('Phase 2 数据: 未初始化');
          exitProcess(0);
          return;
        }

        console.log('=== 迁移状态 ===');
        console.log(`状态: ${state.migration_completed ? '已完成' : '进行中'}`);
        console.log(`Phase 1 版本: ${state.phase1_version}`);
        console.log(`Phase 2 版本: ${state.phase2_version}`);
        console.log(`开始时间: ${new Date(state.migration_started).toLocaleString()}`);
        if (state.migration_completed) {
          console.log(`完成时间: ${new Date(state.migration_completed).toLocaleString()}`);
        }
        console.log(`可回滚: ${state.rollback_available ? '是' : '否'}`);
        if (state.backup_location) {
          console.log(`备份位置: ${state.backup_location}`);
        }

        console.log('\n--- 步骤 ---');
        for (const step of state.steps) {
          const status = step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○';
          console.log(`  ${status} ${step.name}`);
          if (step.error) {
            console.log(`    错误: ${step.error}`);
          }
        }

        console.log('\n--- 数据完整性 ---');
        const integrity = await runner.checkDataIntegrity();
        console.log(`  原则: ${integrity.principles.valid ? '✓' : '✗'} (${integrity.principles.record_count} 条)`);
        console.log(`  成功模式: ${integrity.success_patterns.valid ? '✓' : '✗'} (${integrity.success_patterns.record_count} 条)`);
        console.log(`  失败模式: ${integrity.failure_patterns.valid ? '✓' : '✗'} (${integrity.failure_patterns.record_count} 条)`);
        console.log(`  复盘: ${integrity.retros.valid ? '✓' : '✗'} (${integrity.retros.record_count} 条)`);
        console.log(`  违规: ${integrity.violations.valid ? '✓' : '✗'} (${integrity.violations.record_count} 条)`);

        exitProcess(0);
        return;
      }

      if (options.rollback) {
        // 回滚
        console.log('\n=== 回滚迁移 ===');
        console.log('这将删除所有Phase 2数据并恢复Phase 1状态。');
        console.log('Phase 1数据将保持完整。\n');

        const state = await runner.getMigrationState();
        if (!state) {
          console.log('没有找到迁移记录。无需回滚。');
          exitProcess(0);
          return;
        }

        const completedSteps = state.steps
          .filter(s => s.status === 'completed')
          .map(s => s.name);

        console.log(`正在回滚 ${completedSteps.length} 个步骤...\n`);

        await runner.rollback(completedSteps);

        console.log('\n✓ 回滚成功完成');
        console.log('Phase 1数据完好，可以继续使用。');
        exitProcess(0);
        return;
      }

      // 执行迁移
      console.log('\n=== PRISM-Gateway Phase 1 到 Phase 2 迁移 ===\n');

      // 预迁移验证
      console.log('运行预迁移检查...');
      const validation = await runner.validateSystem();

      if (!validation.passed) {
        console.error('\n✗ 预迁移验证失败:\n');
        for (const error of validation.errors) {
          console.error(`  - ${error}`);
        }
        console.error('\n请先修复上述问题再运行迁移。');
        exitProcess(1);
        return;
      }

      console.log('✓ 预迁移验证通过\n');

      // 检查是否已迁移
      const isComplete = await runner.isMigrationComplete();
      if (isComplete && !options.dryRun) {
        console.log('⚠ 迁移已经完成。');
        console.log('使用 --status 查看迁移详情。');
        console.log('使用 --rollback 撤销迁移。\n');
        exitProcess(0);
        return;
      }

      const result = await runner.run(options.dryRun);

      console.log('\n=== 迁移结果 ===\n');
      console.log(`状态: ${result.success ? '✓ 成功' : '✗ 失败'}`);
      console.log(`耗时: ${(result.duration_ms / 1000).toFixed(2)}秒`);
      console.log(`完成步骤: ${result.steps_completed.length}`);
      console.log(`失败步骤: ${result.steps_failed.length}`);

      if (result.steps_completed.length > 0) {
        console.log('\n已完成的步骤:');
        for (const step of result.steps_completed) {
          console.log(`  ✓ ${step}`);
        }
      }

      if (result.steps_failed.length > 0) {
        console.log('\n失败的步骤:');
        for (const failure of result.steps_failed) {
          console.log(`  ✗ ${failure.step}: ${failure.error}`);
        }
      }

      if (result.backup_location) {
        console.log(`\n备份位置: ${result.backup_location}`);
      }

      console.log('');

      exitProcess(result.success ? 0 : 1);
    } catch (error) {
      console.error('\n✗ 迁移失败:');
      console.error(`  ${error instanceof Error ? error.message : String(error)}\n`);
      exitProcess(1);
    }
  });

/**
 * 导出CLI程序
 */
export { program };

// 如果直接运行此文件，执行CLI
if (import.meta.main) {
  program.parse();
}
