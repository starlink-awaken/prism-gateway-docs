# 前端开发标准流程 (Frontend Development SOP)

> PRISM-Gateway Web UI 开发标准操作流程

**版本：** 1.0.0
**生效日期：** 2026-02-07
**适用范围：** web-ui/ 目录下的所有前端开发工作
**维护者：** Frontend Team

---

## 📋 目标

本 SOP 旨在：
- 统一前端开发流程，确保代码质量
- 规范组件开发、测试、文档编写
- 提高开发效率和团队协作
- 建立可维护的前端代码库

---

## 🎯 适用场景

- [ ] 开发新的 React 组件
- [ ] 实现新的页面功能
- [ ] 修复前端 Bug
- [ ] 优化前端性能
- [ ] 重构现有组件

---

## 📝 开发流程

### Phase 1: 需求分析与设计 (30分钟 - 2小时)

#### 1.1 理解需求
- [ ] 阅读需求文档或用户故事
- [ ] 与 PM/设计师确认细节
- [ ] 识别技术难点和风险
- [ ] 估算开发时间

#### 1.2 技术设计
- [ ] 确定组件层级和数据流
- [ ] 选择合适的 UI 库组件（shadcn/ui）
- [ ] 设计状态管理方案（Zustand store）
- [ ] 确定 API 接口和数据模型

#### 1.3 原型设计（可选）
- [ ] 使用 Figma/Sketch 创建 UI 原型
- [ ] 确认响应式设计方案
- [ ] 确定交互行为和动画

**产出：**
- 技术设计文档（简化版）
- 组件接口定义（TypeScript interfaces）

---

### Phase 2: 开发环境准备 (5-10分钟)

#### 2.1 创建开发分支
```bash
# 基于最新的 main 分支创建特性分支
git checkout main
git pull origin main
git checkout -b feature/component-name
```

#### 2.2 启动开发服务器
```bash
cd web-ui
npm install  # 首次运行或依赖更新后
npm run dev  # 启动 Vite dev server (port 5173)
```

#### 2.3 确认开发环境
- [ ] Dev server 正常运行（http://localhost:5173）
- [ ] HMR 热更新工作正常
- [ ] TypeScript 类型检查无错误
- [ ] 后端 API 可访问（可选）

---

### Phase 3: 组件开发 (1-8小时)

#### 3.1 创建组件文件

**基础组件：** `src/components/common/{ComponentName}.tsx`
```typescript
import React from 'react';
import { cn } from '../../utils/formatters';

interface ComponentNameProps {
  // 必填属性
  required: string;
  // 可选属性
  optional?: number;
  // 样式类名
  className?: string;
}

export function ComponentName({
  required,
  optional = 0,
  className
}: ComponentNameProps) {
  return (
    <div className={cn('base-classes', className)}>
      {/* 组件内容 */}
    </div>
  );
}
```

**业务组件：** `src/components/{Feature}/{ComponentName}.tsx`

**页面组件：** `src/pages/{PageName}.tsx`

#### 3.2 实现核心逻辑
- [ ] 定义 TypeScript 接口/类型
- [ ] 实现组件渲染逻辑
- [ ] 添加状态管理（useState/useStore）
- [ ] 集成 API 调用（如需要）
- [ ] 实现事件处理函数

#### 3.3 样式实现
```typescript
// 使用 Tailwind CSS utility classes
<div className="flex items-center gap-2 p-4 rounded-lg border bg-card">
  <Icon className="w-5 h-5 text-primary" />
  <span className="text-sm font-medium">Content</span>
</div>

// 使用 cn() 合并类名
<button className={cn(
  'px-4 py-2 rounded-md transition-colors',
  variant === 'primary' && 'bg-primary text-primary-foreground',
  variant === 'secondary' && 'bg-secondary text-secondary-foreground',
  className
)}>
  {children}
</button>
```

#### 3.4 响应式设计
```typescript
// Tailwind 响应式断点
<div className="
  grid
  grid-cols-1       // Mobile: 1 列
  md:grid-cols-2    // Tablet (768px+): 2 列
  lg:grid-cols-4    // Desktop (1024px+): 4 列
  gap-4
">
  {items.map(item => <Card key={item.id} />)}
</div>
```

#### 3.5 错误处理
```typescript
function DataComponent() {
  const { data, loading, error, fetchData } = useStore();

  if (error) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">加载失败</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={fetchData} className="btn-primary">
          重试
        </button>
      </div>
    );
  }

  // 正常渲染
}
```

---

### Phase 4: 本地测试 (30分钟 - 2小时)

#### 4.1 功能测试
- [ ] 验证基本功能正常工作
- [ ] 测试边界条件（空数据、错误情况）
- [ ] 测试交互行为（点击、输入、导航）
- [ ] 测试异步操作（API 调用、加载状态）

#### 4.2 响应式测试
- [ ] Mobile (375px): iPhone SE
- [ ] Tablet (768px): iPad
- [ ] Desktop (1024px): 笔记本电脑
- [ ] Large Desktop (1920px+): 台式机

使用 Chrome DevTools 设备模式测试：
```
F12 → Toggle Device Toolbar (Ctrl+Shift+M)
```

#### 4.3 浏览器兼容性测试
- [ ] Chrome (最新版)
- [ ] Firefox (最新版)
- [ ] Safari (最新版) - 如果可用
- [ ] Edge (最新版)

#### 4.4 性能检查
```bash
# 检查 Bundle Size（开发环境）
npm run build
# 查看 dist/ 目录大小

# Lighthouse 性能测试（生产构建）
npm run preview
# 打开 http://localhost:4173
# F12 → Lighthouse → 生成报告
```

**性能目标：**
- FCP < 1.0s
- LCP < 2.5s
- TTI < 3.0s
- CLS < 0.1

#### 4.5 TypeScript 类型检查
```bash
# 运行 TypeScript 编译器检查
npx tsc --noEmit

# 或查看 IDE 错误面板（VS Code）
```

#### 4.6 Lint 检查
```bash
# 运行 ESLint
npm run lint

# 自动修复（如果可能）
npm run lint -- --fix
```

---

### Phase 5: 单元测试 (1-3小时)

#### 5.1 创建测试文件
```bash
# 组件测试文件命名：{ComponentName}.test.tsx
touch src/components/Dashboard/StatCard.test.tsx
```

#### 5.2 编写测试用例
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('应该渲染标题和数值', () => {
    render(<StatCard title="总检查次数" value={1234} />);

    expect(screen.getByText('总检查次数')).toBeInTheDocument();
    expect(screen.getByText('1.2K')).toBeInTheDocument();
  });

  it('应该显示趋势指示器', () => {
    const { container } = render(
      <StatCard title="Test" value={100} trend={5.2} />
    );

    const trendElement = container.querySelector('[data-trend="up"]');
    expect(trendElement).toBeInTheDocument();
  });

  it('应该处理 0 值', () => {
    render(<StatCard title="Test" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
```

#### 5.3 运行测试
```bash
# 运行所有测试
npm run test

# 运行特定文件测试
npm run test StatCard.test.tsx

# 生成覆盖率报告
npm run test:coverage
```

**测试覆盖率目标：** >80%

---

### Phase 6: 文档编写 (15-30分钟)

#### 6.1 组件文档
在组件文件顶部添加 JSDoc 注释：

```typescript
/**
 * StatCard 组件 - 显示统计数据卡片
 *
 * @description
 * 用于 Dashboard 的统计卡片组件，支持显示数值、趋势和图标
 *
 * @example
 * ```tsx
 * <StatCard
 *   title="总检查次数"
 *   value={1234}
 *   trend={5.2}
 *   icon={<Activity />}
 * />
 * ```
 */
export function StatCard({ ... }) { ... }
```

#### 6.2 更新 README（如果是新功能）
在 `web-ui/README.md` 添加功能说明：

```markdown
## Features

### Dashboard
- **StatCard**: 统计卡片组件，支持趋势指示器
- **TrendChart**: 基于 Chart.js 的趋势图表
- ...
```

#### 6.3 API 文档（如果涉及新 API）
在 `api/` 目录更新 API 文档。

---

### Phase 7: Code Review 准备 (15-30分钟)

#### 7.1 自我审查
- [ ] 代码符合 TypeScript 严格模式
- [ ] 无 ESLint 错误或警告
- [ ] 无 TypeScript 类型错误
- [ ] 代码逻辑清晰，命名规范
- [ ] 无硬编码的魔法数字或字符串
- [ ] 无 console.log（除非是有意的）
- [ ] 错误处理完善
- [ ] 组件可复用性良好

#### 7.2 提交代码
```bash
# 添加文件到暂存区
git add src/components/Dashboard/StatCard.tsx
git add src/components/Dashboard/StatCard.test.tsx

# 提交（遵循 Conventional Commits）
git commit -m "feat(dashboard): add StatCard component with trend indicator

- Add StatCard component for displaying metrics
- Support trend indicator (up/down/stable)
- Add formatNumber utility for K/M formatting
- Add unit tests (coverage >85%)
"

# 推送到远程仓库
git push origin feature/stat-card
```

#### 7.3 创建 Pull Request
```bash
# 使用 gh CLI 创建 PR
gh pr create --title "feat: Add StatCard component" --body "
## 功能描述
添加 Dashboard 统计卡片组件

## 主要变更
- 新增 StatCard 组件
- 支持趋势指示器（↑↓➖）
- 自动格式化数字（1K, 1M）

## 测试
- [x] 单元测试通过（15 个测试用例）
- [x] 响应式设计验证
- [x] 浏览器兼容性测试

## 截图
[添加截图]

## 检查清单
- [x] 代码符合规范
- [x] 测试覆盖率 >80%
- [x] 文档已更新
- [x] 无 TypeScript 错误
- [x] 无 ESLint 警告
"
```

---

### Phase 8: Code Review 响应 (1-2天)

#### 8.1 响应 Review 意见
- [ ] 阅读所有 Review 评论
- [ ] 逐一响应或修复
- [ ] 推送更新代码
- [ ] 标记已解决的评论

#### 8.2 常见 Review 问题
| 问题 | 解决方案 |
|------|----------|
| 类型定义不完整 | 添加明确的 TypeScript 类型 |
| 组件过于复杂 | 拆分为更小的子组件 |
| 缺少错误处理 | 添加 try-catch 和错误状态 |
| 性能问题 | 使用 React.memo 或 useMemo |
| 测试覆盖不足 | 添加边界情况测试 |

---

### Phase 9: 合并与部署 (15分钟)

#### 9.1 合并前检查
- [ ] 所有 Review 意见已解决
- [ ] CI/CD 流水线通过
- [ ] 无合并冲突
- [ ] 至少 1 个 Approve

#### 9.2 合并 PR
```bash
# Squash and Merge（推荐）
# 在 GitHub UI 点击 "Squash and merge"

# 或使用 gh CLI
gh pr merge --squash --delete-branch
```

#### 9.3 验证部署
- [ ] 检查生产环境部署成功
- [ ] 验证功能正常工作
- [ ] 监控错误日志（如果有）

---

## 🎯 质量标准

### 代码质量
- [ ] TypeScript 严格模式：100% 类型覆盖
- [ ] ESLint 检查：0 错误，0 警告
- [ ] 测试覆盖率：>80%
- [ ] 组件复用性：>2 个场景可用

### 性能标准
- [ ] Bundle Size：单个组件 <10KB (gzipped)
- [ ] 渲染时间：<16ms (60fps)
- [ ] 首次渲染：<100ms
- [ ] 内存占用：<5MB

### 文档标准
- [ ] JSDoc 注释完整
- [ ] README 更新（如需要）
- [ ] API 文档更新（如需要）
- [ ] 使用示例清晰

---

## 🔧 工具和资源

### 开发工具
- **IDE:** VS Code with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript Hero
- **Chrome DevTools:** 调试和性能分析
- **React DevTools:** 组件树和状态检查
- **Vite DevTools:** 构建分析

### 参考资源
- [React 官方文档](https://react.dev/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [Chart.js 文档](https://www.chartjs.org/)

---

## 🚨 常见问题

### Q1: 组件应该放在哪个目录？
**A:**
- 基础 UI 组件 → `src/components/common/`
- 业务组件 → `src/components/{Feature}/`
- 页面组件 → `src/pages/`

### Q2: 何时使用 Zustand vs useState？
**A:**
- **Zustand:** 全局状态，多个组件共享
- **useState:** 局部状态，单个组件内部

### Q3: 如何优化渲染性能？
**A:**
1. 使用 `React.memo` 包裹组件
2. 使用 `useMemo` 缓存计算结果
3. 使用 `useCallback` 缓存函数
4. 避免在 render 中创建对象/数组

### Q4: 如何处理 API 错误？
**A:**
```typescript
try {
  const data = await apiService.getData();
  setState({ data, error: null });
} catch (error) {
  setState({ data: null, error: error.message });
  console.error('API Error:', error);
}
```

---

## 📊 SOP 效果评估

**关键指标：**
- 平均开发时间：4-12 小时/组件
- Bug 率：<5%
- Code Review 往返次数：<3 次
- 测试覆盖率：>85%
- 文档完整性：>90%

**持续改进：**
- 每月回顾 SOP 执行情况
- 收集团队反馈
- 更新最佳实践
- 优化开发流程

---

**版本历史：**
- v1.0.0 (2026-02-07): 初始版本，基于 Phase 3 Week 2 经验

**维护者：** Frontend Team
**审核者：** Tech Lead
**下次审查：** 2026-03-07
