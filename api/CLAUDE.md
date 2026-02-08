# API 模块文档

[← 返回根目录](../CLAUDE.md)

---

## 模块概述

API 模块提供 ReflectGuard 系统的完整 API 文档，包括核心类、接口定义、使用示例和类型说明。

---

## 快速导航

### 📚 主文档
- **[README.md](./README.md)** - API 文档总览和快速开始指南 (13KB)

### 🎯 核心 API
- **[GatewayGuard.md](./GatewayGuard.md)** - Gateway 检查器 (5.5KB)
- **[MemoryStore.md](./MemoryStore.md)** - 三层 MEMORY 架构 (9.4KB)
- **[DataExtractor.md](./DataExtractor.md)** - 7 维度数据提取 (9.9KB)
- **[RetrospectiveCore.md](./RetrospectiveCore.md)** - 复盘核心引擎 (8.7KB)
- **[QuickReview.md](./QuickReview.md)** - 快速复盘工具 (7.0KB)

### 🔍 模式匹配器
- **[PatternMatcher.md](./PatternMatcher.md)** - 模式匹配器 (6.7KB)
- **[PrincipleChecker.md](./PrincipleChecker.md)** - 原则检查器 (7.8KB)
- **[TrapDetector.md](./TrapDetector.md)** - 陷阱检测器 (7.8KB)

### 🔌 REST API
- **[REST_API_GUIDE.md](./REST_API_GUIDE.md)** - REST API 使用指南
- **[CONTEXT_SYNC_API.md](./CONTEXT_SYNC_API.md)** - 上下文同步 API

---

## 快速开始

```typescript
import { prismGateway } from 'reflectguard';

// 快速复盘
const retroResult = await prismGateway.quickRetro('my-project', {
  phase: 'Development',
  history: []
});

// 检查任务意图
const checkResult = await prismGateway.checkIntent('实现用户登录');
console.log(checkResult.status); // PASS | WARNING | BLOCKED
```

---

**最后更新：** 2026-02-07
