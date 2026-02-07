# 组件文档模板 (Component Documentation Template)

> 用于编写 React 组件文档的标准模板

**适用范围：** web-ui/src/components/ 下的所有组件
**维护者：** Frontend Team
**最后更新：** 2026-02-07

---

## 📋 使用说明

1. 复制本模板创建新的组件文档
2. 填写所有必填部分（标记为 `[必填]`）
3. 根据实际情况填写可选部分
4. 保持格式一致性

---

# [组件名称] Component

> [一句话描述组件的用途]

**版本：** `[版本号，如 1.0.0]` [必填]
**状态：** `[stable | beta | deprecated]` [必填]
**作者：** `[作者名]` [必填]
**创建日期：** `[YYYY-MM-DD]` [必填]
**最后更新：** `[YYYY-MM-DD]` [必填]

---

## 📖 概述 (Overview)

### 组件描述
`[2-3 句话详细描述组件的功能、用途和使用场景]` [必填]

### 使用场景
`[列举 2-3 个典型使用场景]` [必填]

- **场景 1：** `[描述]`
- **场景 2：** `[描述]`
- **场景 3：** `[描述]`（可选）

### 主要特性
`[列举组件的主要特性和亮点]` [必填]

- ✅ `[特性 1]`
- ✅ `[特性 2]`
- ✅ `[特性 3]`
- ✅ `[特性 4]`（可选）

---

## 🎯 快速开始 (Quick Start)

### 基本用法
```tsx
import { [ComponentName] } from '@/components/[path]/[ComponentName]';

function Example() {
  return (
    <[ComponentName]
      prop1="value1"
      prop2={value2}
    />
  );
}
```

### 完整示例
```tsx
import { [ComponentName] } from '@/components/[path]/[ComponentName]';

function CompleteExample() {
  const [state, setState] = useState(initialValue);

  const handleAction = () => {
    // 处理逻辑
  };

  return (
    <div className="container">
      <[ComponentName]
        // 所有可用的 props
        prop1="value1"
        prop2={value2}
        prop3={value3}
        onAction={handleAction}
      />
    </div>
  );
}
```

---

## 📐 API 文档 (API Reference)

### Props

#### 基本属性

| Prop 名 | 类型 | 默认值 | 必填 | 描述 |
|---------|------|--------|------|------|
| `prop1` | `string` | `undefined` | ✅ | `[描述属性的用途]` |
| `prop2` | `number` | `0` | ❌ | `[描述属性的用途]` |
| `prop3` | `boolean` | `false` | ❌ | `[描述属性的用途]` |
| `className` | `string` | `undefined` | ❌ | 自定义 CSS 类名 |

#### 高级属性（可选）

| Prop 名 | 类型 | 默认值 | 必填 | 描述 |
|---------|------|--------|------|------|
| `onAction` | `() => void` | `undefined` | ❌ | `[回调函数描述]` |
| `children` | `ReactNode` | `undefined` | ❌ | 子元素 |

### TypeScript 类型定义

```typescript
interface [ComponentName]Props {
  // 必填属性
  prop1: string;

  // 可选属性
  prop2?: number;
  prop3?: boolean;
  className?: string;

  // 回调函数
  onAction?: () => void;

  // 子元素
  children?: React.ReactNode;
}
```

### Hooks（如果组件导出 hooks）

```typescript
/**
 * [Hook 名称]
 *
 * @description [Hook 描述]
 * @returns [返回值描述]
 *
 * @example
 * ```tsx
 * const { state, action } = use[HookName]();
 * ```
 */
export function use[HookName]() {
  // Hook 实现
}
```

---

## 🎨 样式定制 (Styling)

### Tailwind Classes
组件支持通过 `className` prop 传递自定义 Tailwind 类：

```tsx
<[ComponentName]
  className="custom-class another-class"
/>
```

### CSS 变量
组件使用以下 CSS 变量（可在 `index.css` 中自定义）：

```css
:root {
  --component-variable-1: value1;
  --component-variable-2: value2;
}
```

### 预设样式变体（可选）

```tsx
// 主要样式
<[ComponentName] variant="primary" />

// 次要样式
<[ComponentName] variant="secondary" />

// 危险样式
<[ComponentName] variant="danger" />
```

---

## 💡 使用示例 (Examples)

### 示例 1: [场景描述]
```tsx
import { [ComponentName] } from '@/components/[path]/[ComponentName]';

function Example1() {
  return (
    <[ComponentName]
      prop1="value1"
      prop2={100}
    />
  );
}
```

**效果：** `[描述示例的效果或行为]`

### 示例 2: [场景描述]
```tsx
import { [ComponentName] } from '@/components/[path]/[ComponentName]';

function Example2() {
  const handleAction = () => {
    console.log('Action triggered');
  };

  return (
    <[ComponentName]
      prop1="value1"
      onAction={handleAction}
    />
  );
}
```

**效果：** `[描述示例的效果或行为]`

### 示例 3: 结合其他组件
```tsx
import { [ComponentName] } from '@/components/[path]/[ComponentName]';
import { OtherComponent } from '@/components/other/OtherComponent';

function Example3() {
  return (
    <div className="grid gap-4">
      <[ComponentName] prop1="value1" />
      <OtherComponent prop2="value2" />
    </div>
  );
}
```

---

## 🧪 测试 (Testing)

### 单元测试示例

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { [ComponentName] } from './[ComponentName]';

describe('[ComponentName]', () => {
  it('should render correctly', () => {
    render(<[ComponentName] prop1="test" />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('should handle user interaction', () => {
    const handleAction = vi.fn();
    render(<[ComponentName] prop1="test" onAction={handleAction} />);

    // 触发交互
    fireEvent.click(screen.getByRole('button'));

    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('should handle edge cases', () => {
    // 测试边界条件
  });
});
```

### 测试覆盖率
- **目标：** `[百分比，如 >85%]`
- **当前：** `[百分比]`

---

## 🔧 最佳实践 (Best Practices)

### ✅ 推荐做法

1. **[最佳实践 1]**
   ```tsx
   // 正确示例
   <[ComponentName] prop1="value" />
   ```

2. **[最佳实践 2]**
   ```tsx
   // 正确示例
   ```

3. **[最佳实践 3]**

### ❌ 避免做法

1. **[反模式 1]**
   ```tsx
   // 错误示例
   <[ComponentName] prop1={undefined} />
   ```
   **原因：** `[解释为什么这样做不好]`

2. **[反模式 2]**
   ```tsx
   // 错误示例
   ```
   **原因：** `[解释]`

---

## ⚡ 性能优化 (Performance)

### 渲染性能
- **渲染时间：** `[测量值，如 <16ms]`
- **内存占用：** `[测量值，如 <2MB]`
- **Bundle Size：** `[大小，如 5KB gzipped]`

### 优化建议

1. **使用 React.memo**（如适用）
   ```tsx
   export const [ComponentName] = React.memo(function [ComponentName](props) {
     // 组件实现
   });
   ```

2. **使用 useMemo 缓存计算**
   ```tsx
   const expensiveValue = useMemo(() => {
     return computeExpensiveValue(prop1);
   }, [prop1]);
   ```

3. **使用 useCallback 缓存函数**
   ```tsx
   const handleAction = useCallback(() => {
     // 处理逻辑
   }, [dependency]);
   ```

---

## 🔌 依赖 (Dependencies)

### 外部依赖
- `react` (^18.3.1)
- `lucide-react` (^0.400.0) - 图标库（如使用）
- `[其他依赖]`

### 内部依赖
- `@/components/common/Card` - 基础卡片组件（如使用）
- `@/utils/formatters` - 格式化工具（如使用）
- `@/types/api` - API 类型定义（如使用）

---

## 🐛 已知问题 (Known Issues)

### Issue 1: [问题描述]
- **影响：** `[描述影响范围和严重程度]`
- **复现步骤：**
  1. `[步骤 1]`
  2. `[步骤 2]`
  3. `[步骤 3]`
- **临时解决方案：** `[描述 workaround]`
- **跟踪：** `[链接到 GitHub Issue]`

### Issue 2: [问题描述]
`[如果有更多问题，继续列举]`

---

## 🚀 未来计划 (Roadmap)

### v1.1.0（计划中）
- [ ] `[计划添加的功能 1]`
- [ ] `[计划添加的功能 2]`
- [ ] `[计划修复的问题]`

### v2.0.0（长期）
- [ ] `[重大重构或新特性]`
- [ ] `[破坏性变更（如有）]`

---

## 🔗 相关资源 (Related Resources)

### 组件
- `[相关组件 1]` - `[链接]`
- `[相关组件 2]` - `[链接]`

### 文档
- [设计规范](../../../docs/DESIGN_GUIDELINES.md)
- [开发指南](../../../docs/DEVELOPMENT_GUIDE.md)
- [测试指南](../../../docs/TESTING_GUIDE.md)

### 外部资源
- [React 文档](https://react.dev/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 文档](https://tailwindcss.com/)

---

## 📊 变更日志 (Changelog)

### [1.0.0] - YYYY-MM-DD
#### Added
- 初始版本发布
- `[新增功能 1]`
- `[新增功能 2]`

#### Changed
`[如果有变更]`

#### Fixed
`[如果有修复]`

#### Deprecated
`[如果有废弃]`

---

## 🤝 贡献 (Contributing)

### 报告问题
发现 Bug？请在 GitHub 创建 Issue：
- 使用清晰的标题
- 提供复现步骤
- 附上截图或代码示例

### 提交改进
欢迎提交 Pull Request：
1. Fork 仓库
2. 创建特性分支
3. 提交变更
4. 创建 Pull Request

### 联系方式
- **负责人：** `[姓名]`
- **Email：** `[邮箱]`
- **Slack：** `[频道]`

---

## 📄 许可证 (License)

本组件遵循 MIT License。

---

## 📝 文档元信息

**模板版本：** 1.0.0
**文档状态：** Draft / Review / Published
**审核者：** `[审核者名称]`
**审核日期：** `[YYYY-MM-DD]`

---

## 附录 (Appendix)

### A. 完整代码示例

```tsx
// [ComponentName].tsx - 完整实现
import React from 'react';
import { cn } from '@/utils/formatters';

interface [ComponentName]Props {
  prop1: string;
  prop2?: number;
  className?: string;
}

export function [ComponentName]({
  prop1,
  prop2 = 0,
  className
}: [ComponentName]Props) {
  return (
    <div className={cn('base-classes', className)}>
      <h2>{prop1}</h2>
      <p>{prop2}</p>
    </div>
  );
}

// 导出类型（可选）
export type { [ComponentName]Props };
```

### B. 样式定义

```css
/* [ComponentName].css */
.component-name {
  /* 自定义样式 */
}

.component-name--variant {
  /* 变体样式 */
}
```

### C. 测试工具函数

```typescript
// test-utils.ts
export function render[ComponentName](props?: Partial<[ComponentName]Props>) {
  return render(
    <[ComponentName]
      prop1="default"
      {...props}
    />
  );
}
```

---

**文档维护者：** Frontend Team
**文档路径：** `web-ui/src/components/[path]/[ComponentName].md`
**最后审核：** `[审核者]` @ `[日期]`
