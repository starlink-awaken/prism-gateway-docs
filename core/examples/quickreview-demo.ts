#!/usr/bin/env bun
/**
 * QuickReview 快速复盘演示
 *
 * 使用方法:
 *   bun run examples/quickreview-demo.ts
 */

import { QuickReview } from '../src/core/QuickReview.js';

async function main() {
  const qr = new QuickReview();

  console.log('========================================');
  console.log('  QuickReview 快速复盘演示');
  console.log('========================================\n');

  // 示例1: 简单复盘
  console.log('>>> 示例1: 简单快速复盘');
  const result1 = await qr.review({
    projectId: 'demo-project-1',
    context: '完成用户认证功能开发，采用TDD方法，使用React和Node.js，性能提升30%'
  });

  console.log(qr.toCliOutput(result1));

  // 示例2: 带元数据的复盘
  console.log('\n>>> 示例2: 带标签和元数据的复盘');
  const result2 = await qr.review({
    projectId: 'demo-project-2',
    context: '项目开发过程中发现3个原则违规，使用了Docker部署，团队协作良好',
    tags: ['performance', 'devops'],
    metadata: {
      phase: 'optimization',
      team: 'backend',
      sprint: 'Sprint-12'
    }
  });

  console.log(qr.toCliOutput(result2));

  // 示例3: JSON输出
  console.log('\n>>> 示例3: JSON格式输出');
  console.log(qr.toJsonOutput(result1));

  // 示例4: 仅生成Markdown报告
  console.log('\n>>> 示例4: Markdown报告');
  console.log(result1.report);

  // 清理
  qr.cleanup();

  console.log('\n演示完成！');
}

main().catch(console.error);
