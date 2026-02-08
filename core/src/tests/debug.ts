import { GatewayGuard } from '../core/GatewayGuard.js';
import { MemoryStore } from '../core/MemoryStore.js';

const guard = new GatewayGuard();

async function debug() {
  console.log('=== 测试1: 正常任务 ===');
  const result1 = await guard.check('编写一个用户注册功能');
  console.log('Status:', result1.status);
  console.log('Violations:', result1.violations);
  console.log('Risks:', result1.risks);
  console.log('Traps:', result1.traps);

  console.log('\n=== 测试2: 重复失败 ===');
  const result2 = await guard.check('让我再试一次相同的操作');
  console.log('Violations:', result2.violations);

  console.log('\n=== 测试3: 推测问题 ===');
  const result3 = await guard.check('推测这是配置问题，直接修改配置文件');
  console.log('Risks:', result3.risks);
  console.log('Traps:', result3.traps);
}

debug();
