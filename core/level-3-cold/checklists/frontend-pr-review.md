# 前端 Pull Request 审查清单

> PRISM-Gateway Web UI Pull Request 代码审查标准清单

**版本：** 1.0.0
**适用范围：** web-ui/ 目录下的所有前端 PR
**审查时间：** 15-30 分钟
**最后更新：** 2026-02-07

---

## 📋 使用说明

### 审查者职责
1. **仔细阅读代码**：理解变更的意图和实现
2. **逐项检查**：按照本清单逐项验证
3. **提供建设性反馈**：指出问题并给出改进建议
4. **批准或请求修改**：明确审查结论

### 审查流程
```
1. 阅读 PR 描述 → 2. 检查代码变更 → 3. 本地测试（可选）
→ 4. 填写清单 → 5. 提交 Review
```

---

## ✅ 代码质量 (Code Quality)

### 基础检查
- [ ] **代码符合 TypeScript 严格模式**
  - 无 `any` 类型（除非有充分理由）
  - 所有函数参数和返回值都有类型注解
  - 无 `@ts-ignore` 或 `@ts-expect-error`（除非有充分理由）

- [ ] **ESLint 检查通过**
  - 0 errors
  - 0 warnings（或已说明理由）
  - 运行 `npm run lint` 验证

- [ ] **代码格式化一致**
  - 使用 Prettier 格式化
  - 缩进一致（2 空格）
  - 无多余的空行或尾随空格

### 命名规范
- [ ] **组件命名**
  - PascalCase: `StatCard`, `TrendChart`, `EventStream`
  - 文件名与组件名一致
  - 描述性强，避免缩写

- [ ] **函数命名**
  - camelCase: `handleClick`, `fetchData`, `formatNumber`
  - 动词开头：`get`, `set`, `handle`, `fetch`, `format`
  - 事件处理器：`handle{Event}` 或 `on{Event}`

- [ ] **变量命名**
  - camelCase: `userData`, `isLoading`, `errorMessage`
  - 布尔值：`is`, `has`, `should` 开头
  - 常量：UPPER_SNAKE_CASE（如需要）

### 代码结构
- [ ] **组件拆分合理**
  - 单个组件 <200 行（除非有充分理由）
  - 职责单一，符合 SRP 原则
  - 可复用性良好

- [ ] **导入顺序规范**
  ```typescript
  // 1. React 和外部库
  import React from 'react';
  import { useStore } from 'zustand';

  // 2. 本地组件
  import { Card } from '../common/Card';

  // 3. 类型定义
  import type { Dashboard } from '../../types/api';

  // 4. 样式和资源
  import './styles.css';
  ```

- [ ] **避免嵌套过深**
  - 最多 3 层嵌套
  - 使用提前返回（early return）简化逻辑
  - 提取复杂逻辑到独立函数

---

## 🎨 UI/UX 审查 (UI/UX Review)

### 视觉一致性
- [ ] **遵循设计规范**
  - 使用 Tailwind CSS utility classes
  - 颜色使用 CSS 变量（`--primary`, `--background` 等）
  - 间距遵循 4px 网格（`p-1`, `p-2`, `p-4` 等）

- [ ] **组件样式正确**
  - 深色模式支持（如适用）
  - 悬停、焦点、激活状态完整
  - 无硬编码的颜色或尺寸

- [ ] **图标使用规范**
  - 使用 Lucide React 图标库
  - 尺寸一致（通常 `w-4 h-4` 或 `w-5 h-5`）
  - 颜色使用语义类名

### 响应式设计
- [ ] **移动端适配** (375px - 767px)
  - 布局正常，无横向滚动
  - 字体大小适中（最小 12px）
  - 按钮和链接可点击区域 ≥44px

- [ ] **平板适配** (768px - 1023px)
  - 充分利用屏幕空间
  - 网格布局合理（2-3 列）
  - 图片和图表清晰

- [ ] **桌面适配** (1024px+)
  - 内容不会过于分散
  - 最大宽度限制（如 `max-w-7xl`）
  - 利用多列布局

### 交互体验
- [ ] **加载状态**
  - 显示 loading 指示器
  - 禁用交互元素（按钮、表单）
  - 提供进度反馈（如可能）

- [ ] **错误处理**
  - 显示用户友好的错误信息
  - 提供重试或返回操作
  - 不泄露敏感技术细节

- [ ] **成功反馈**
  - 操作成功后有明确反馈
  - Toast 通知或状态变化
  - 自动导航（如适用）

---

## 🧪 测试 (Testing)

### 单元测试
- [ ] **测试文件存在**
  - 文件命名：`{ComponentName}.test.tsx`
  - 位置：与组件文件同目录

- [ ] **测试覆盖率充分** (>80%)
  - 基本渲染测试
  - Props 传递测试
  - 用户交互测试（点击、输入）
  - 边界条件测试（空数据、错误状态）

- [ ] **测试用例清晰**
  ```typescript
  describe('ComponentName', () => {
    it('应该渲染基本内容', () => { ... });
    it('应该处理点击事件', () => { ... });
    it('应该显示错误状态', () => { ... });
  });
  ```

- [ ] **测试通过**
  - 运行 `npm run test`
  - 所有测试通过
  - 无跳过的测试（除非有说明）

### 手动测试
- [ ] **功能正常工作**
  - PR 作者已在本地验证
  - 审查者也可本地验证（推荐）

- [ ] **浏览器兼容性**
  - Chrome 最新版 ✓
  - Firefox 最新版 ✓
  - Safari 最新版 ✓（如可用）

- [ ] **无控制台错误**
  - 无 React 警告
  - 无 TypeScript 错误
  - 无未处理的 Promise rejection

---

## 🚀 性能 (Performance)

### Bundle Size
- [ ] **组件大小合理**
  - 单个组件 <10KB (gzipped)
  - 无不必要的依赖导入
  - 使用动态 import（如适用）

- [ ] **避免过度渲染**
  - 使用 `React.memo`（如需要）
  - 使用 `useMemo` 缓存计算
  - 使用 `useCallback` 缓存函数

### 加载性能
- [ ] **图片优化**
  - 使用适当的格式（WebP, PNG, SVG）
  - 图片大小 <500KB
  - 使用 lazy loading（如适用）

- [ ] **代码拆分**
  - 大型组件使用懒加载
  - 第三方库按需导入
  - 避免全量导入（如 `import * as`）

---

## 📝 文档 (Documentation)

### 代码注释
- [ ] **复杂逻辑有注释**
  - 说明"为什么"而非"是什么"
  - 算法或业务逻辑有注释
  - Hack 或临时方案有 TODO 注释

- [ ] **JSDoc 注释完整**（公共组件）
  ```typescript
  /**
   * 组件描述
   *
   * @param props - 属性说明
   * @returns JSX 元素
   *
   * @example
   * <Component prop="value" />
   */
  ```

### 文档更新
- [ ] **README 更新**（如添加新功能）
  - 功能列表
  - 使用示例
  - API 文档（如需要）

- [ ] **CHANGELOG 更新**（如有重大变更）
  - 记录破坏性变更
  - 记录新功能
  - 记录 Bug 修复

---

## 🔒 安全 (Security)

### 输入验证
- [ ] **用户输入已验证**
  - 使用 Zod 或类似库验证
  - 前端验证 + 后端验证
  - 拒绝无效输入

- [ ] **XSS 防护**
  - 避免 `dangerouslySetInnerHTML`（除非必要）
  - 用户输入已转义
  - 使用 React 自动转义

### 敏感数据
- [ ] **无敏感信息泄露**
  - 无硬编码的密钥或令牌
  - 无敏感数据记录到控制台
  - API 密钥通过环境变量

- [ ] **API 调用安全**
  - 使用 HTTPS
  - 包含认证 token（如需要）
  - 错误信息不泄露技术细节

---

## 🔄 状态管理 (State Management)

### Zustand Store
- [ ] **Store 结构合理**
  - 状态扁平化
  - 避免嵌套过深
  - 使用 TypeScript 类型

- [ ] **Actions 命名清晰**
  - `fetch{Data}`: 获取数据
  - `set{State}`: 设置状态
  - `reset`: 重置状态

- [ ] **避免状态冗余**
  - 派生状态通过计算获得
  - 避免重复存储相同数据

### React State
- [ ] **useState 使用正确**
  - 局部状态使用 useState
  - 初始值类型正确
  - 避免直接修改状态

- [ ] **useEffect 使用正确**
  - 依赖数组完整
  - 清理函数存在（如需要）
  - 避免无限循环

---

## 🌐 API 集成 (API Integration)

### API 调用
- [ ] **API Service 封装**
  - 使用 `src/services/api.ts`
  - 不在组件中直接 fetch
  - 类型安全的响应

- [ ] **错误处理完善**
  ```typescript
  try {
    const data = await apiService.getData();
    setData(data);
  } catch (error) {
    setError(error.message);
    console.error('API Error:', error);
  }
  ```

- [ ] **加载状态管理**
  - 开始时设置 `loading = true`
  - 完成时设置 `loading = false`
  - 错误时也要设置 `loading = false`

### WebSocket
- [ ] **连接管理正确**
  - 组件卸载时断开连接
  - 错误时尝试重连（如需要）
  - 连接状态可观察

---

## 📦 依赖管理 (Dependencies)

### 新增依赖
- [ ] **依赖必要性**
  - 确实需要此依赖
  - 无更轻量的替代方案
  - 依赖维护良好（>100k 下载/周）

- [ ] **版本固定**
  - 使用 `^` 或 `~` 版本范围
  - 避免使用 `latest`
  - package-lock.json 已更新

- [ ] **安全检查**
  - 运行 `npm audit`
  - 无 high/critical 漏洞
  - 有漏洞需说明并计划修复

---

## 🎯 PR 描述 (PR Description)

### 内容完整性
- [ ] **标题清晰**
  - 遵循 Conventional Commits
  - 格式：`feat:`, `fix:`, `refactor:`, `docs:` 等
  - 简明扼要（<50 字符）

- [ ] **描述详细**
  ```markdown
  ## 功能描述
  添加 StatCard 组件用于显示统计数据

  ## 主要变更
  - 新增 StatCard 组件
  - 添加 formatNumber 工具函数
  - 添加单元测试

  ## 测试
  - [x] 单元测试通过
  - [x] 手动测试验证
  - [x] 响应式设计测试

  ## 截图
  [添加截图或 GIF]
  ```

- [ ] **关联 Issue**
  - 链接到相关 Issue
  - 使用 `Fixes #123` 或 `Closes #123`

### 变更范围
- [ ] **变更合理**
  - 一个 PR 解决一个问题
  - 变更文件数 <20（除非重构）
  - 变更行数 <500（除非重构）

- [ ] **无无关变更**
  - 无格式化整个文件
  - 无重构无关代码
  - 无调试代码（console.log 等）

---

## ✅ 最终检查 (Final Check)

### CI/CD
- [ ] **所有检查通过**
  - TypeScript 编译通过
  - ESLint 检查通过
  - 单元测试通过
  - Build 成功

### 代码审查
- [ ] **无遗留 TODO**（除非有 Issue 跟踪）
- [ ] **无注释掉的代码**（删除而非注释）
- [ ] **无调试代码**（console.log, debugger 等）
- [ ] **无临时文件**（.DS_Store, .vscode 等）

### 合并准备
- [ ] **无合并冲突**
- [ ] **Rebase 到最新 main**（如需要）
- [ ] **至少 1 个 Approve**

---

## 🎯 审查结论

### 批准 (Approve)
✅ **所有检查项通过，代码质量优秀，批准合并**

### 请求修改 (Request Changes)
⚠️ **发现以下需要修复的问题：**
1. [问题 1]
2. [问题 2]
3. ...

### 评论 (Comment)
💬 **有一些建议但不阻塞合并：**
1. [建议 1]
2. [建议 2]
3. ...

---

## 📊 审查统计

**审查时间：** ___ 分钟
**发现问题：** ___ 个
**提出建议：** ___ 个

---

## 📚 参考资源

- [React 最佳实践](https://react.dev/learn)
- [TypeScript 最佳实践](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Tailwind CSS 最佳实践](https://tailwindcss.com/docs/reusing-styles)
- [前端开发 SOP](./frontend-development.md)

---

**版本历史：**
- v1.0.0 (2026-02-07): 初始版本

**维护者：** Frontend Team
**审核者：** Tech Lead
**下次更新：** 2026-03-07
