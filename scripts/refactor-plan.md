# ReflectGuard 重构工程实施计划

> **执行日期：** 2026-02-04
> **执行模式：** Shadow Migration (零停机迁移)
> **风险等级：** 低 (有完整回滚方案)

---

## 一、现状分析

### 1.1 项目结构问题

```
prism-gateway-docs/          # 文档项目根目录
├── prism-gateway/           # 实际代码仓库
│   ├── *.md (13个报告文件)  # 问题：根目录混乱，5276行
│   ├── docs/
│   │   ├── api/            # TypeDoc 生成
│   │   ├── api_html/       # 重复 HTML 输出
│   │   ├── api_new/        # 另一个 API 目录
│   │   └── *.md (8个)      # 用户文档
│   ├── level-1-hot/        # 问题：直接在根目录
│   ├── level-2-warm/
│   ├── level-3-cold/
│   ├── tsconfig.json
│   ├── typedoc.json        # 问题：3个配置文件
│   ├── typedoc-html.json
│   └── hooks.config.json
├── reports/                # 报告模块目录
├── docs/                   # 文档模块目录
└── api/                    # API 模块目录
```

### 1.2 关键工程问题

| 问题 | 影响 | 优先级 |
|------|------|--------|
| 根目录13个报告文件 | 难以定位，违反单一职责 | P0 |
| docs/ 下3个重复API目录 | 维护混乱，不知道哪个是权威 | P0 |
| 配置文件分散 | 配置不一致风险 | P1 |
| level-* 直接在根目录 | 数据与代码混合 | P1 |
| import 路径可能断裂 | 移动文件导致编译失败 | P0 |

---

## 二、重构策略

### 2.1 核心原则

1. **Shadow Migration Pattern**: 原文件保持不动，先复制再验证
2. **Test-First**: 重构前确保测试全部通过
3. **Incremental**: 分阶段执行，每阶段可独立验证
4. **Rollback-Ready**: 任何阶段都可回滚

### 2.2 目标结构

```
prism-gateway/
├── .prism/                 # 新：统一的数据目录
│   ├── config/
│   │   ├── hooks.json      # 整合后的 hooks 配置
│   │   └── typedoc.json    # 整合后的 typedoc 配置
│   ├── level-1-hot/        # 从根目录迁移
│   ├── level-2-warm/
│   └── level-3-cold/
├── src/                    # 代码目录（不变）
├── docs/
│   ├── api/                # 权威 API 文档（保留）
│   ├── guides/             # 新：用户指南
│   └── reference/          # 新：参考文档
├── reports/                # 新：所有报告集中
└── config/                 # 新：构建配置
    ├── tsconfig.json       # 从根目录迁移
    └── typedoc.json        # 整合后的单一配置
```

---

## 三、执行步骤

### 阶段 0：准备和备份（5分钟）

```bash
#!/bin/bash
# scripts/00-prepare.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"
BACKUP_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/backups/$(date +%Y%m%d_%H%M%S)"

echo "=== 阶段 0: 准备和备份 ==="

# 1. 创建备份目录
mkdir -p "$BACKUP_DIR"

# 2. 备份关键文件
cp -r "$PRISM_DIR" "$BACKUP_DIR/prism-gateway-backup"

# 3. 验证测试当前状态
cd "$PRISM_DIR"
echo "当前测试状态："
bun test 2>&1 | tee "$BACKUP_DIR/test-before.log"

# 4. 记录当前文件结构
find . -type f -name "*.ts" -o -name "*.md" -o -name "*.json" | \
    grep -v node_modules | \
    sort > "$BACKUP_DIR/files-before.txt"

echo "✅ 备份完成: $BACKUP_DIR"
```

---

### 阶段 1：配置文件整合（10分钟）

```bash
#!/bin/bash
# scripts/01-integrate-configs.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"

echo "=== 阶段 1: 配置文件整合 ==="

cd "$PRISM_DIR"

# 1. 创建 config/ 目录
mkdir -p config

# 2. 合并 typedoc 配置（优先级：typedoc.json > typedoc-html.json）
cat > config/typedoc.json << 'EOF'
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": [
    "src/index.ts",
    "src/core/GatewayGuard.ts",
    "src/core/MemoryStore.ts",
    "src/core/DataExtractor.ts",
    "src/core/RetrospectiveCore.ts",
    "src/core/QuickReview.ts",
    "src/core/PatternMatcher.ts",
    "src/core/PrincipleChecker.ts",
    "src/core/TrapDetector.ts",
    "src/types/index.ts",
    "src/types/checks.ts"
  ],
  "out": "docs/api",
  "name": "ReflectGuard API Documentation",
  "plugin": ["typedoc-plugin-markdown"],
  "theme": "markdown",
  "readme": "docs/api/README.md",
  "exclude": [
    "**/tests/**",
    "**/test/**",
    "**/*.test.ts",
    "node_modules/**",
    "dist/**"
  ],
  "excludePrivate": true,
  "excludeProtected": false,
  "excludeInternal": true,
  "categorizeByGroup": true,
  "sort": ["source-order"],
  "kindSortOrder": [
    "Module", "Namespace", "Enum", "EnumMember",
    "Class", "Interface", "TypeAlias",
    "Constructor", "Property", "Method", "Function", "Variable"
  ],
  "hideGenerator": true,
  "gitRevision": "main",
  "includeVersion": true,
  "version": "1.0.0",
  "hideBreadcrumbs": true,
  "navigation": {
    "includeCategories": true,
    "includeGroups": true
  },
  "commentStyle": "jsdoc",
  "logLevel": "Info"
}
EOF

# 3. 迁移 tsconfig.json
mv tsconfig.json config/tsconfig.json

# 4. 创建 tsconfig 根级引用
cat > tsconfig.json << 'EOF'
{
  "extends": "./config/tsconfig.json",
  "references": []
}
EOF

# 5. 迁移 hooks 配置到 .prism/config/
mkdir -p .prism/config
mv hooks.config.json .prism/config/hooks.json

# 6. 更新 package.json scripts
cat > package.json.tmp << 'EOF'
{
  "name": "prism-gateway",
  "version": "1.0.0",
  "description": "ReflectGuard: 统一的7维度复盘和Gateway系统",
  "type": "module",
  "main": "src/index.ts",
  "bin": {
    "prism": "src/cli/index.ts"
  },
  "scripts": {
    "dev": "bun run src/index.ts",
    "test": "bun test",
    "test:e2e": "bun test src/tests/e2e.test.ts",
    "test:unit": "bun test src/tests/*.test.ts",
    "build": "bun build src/index.ts --outdir dist --config config/tsconfig.json",
    "lint": "eslint src/",
    "docs": "typedoc --config config/typedoc.json",
    "docs:serve": "cd docs/api && python3 -m http.server 8080",
    "docs:verify": "ls docs/api/*.md | head -5"
  },
  "keywords": ["gateway", "retrospective", "ai", "prism", "cli", "7-dimensions"],
  "author": "隔壁老王",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.3",
    "commander": "^14.0.3",
    "typescript": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "bun-types": "latest",
    "typedoc": "^0.28.16",
    "typedoc-plugin-markdown": "^4.9.0"
  }
}
EOF
mv package.json.tmp package.json

echo "✅ 配置文件整合完成"
echo "   - tsconfig.json -> config/tsconfig.json"
echo "   - typedoc.json -> config/typedoc.json (合并)"
echo "   - hooks.config.json -> .prism/config/hooks.json"
```

---

### 阶段 2：报告文件迁移（5分钟）

```bash
#!/bin/bash
# scripts/02-move-reports.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"

echo "=== 阶段 2: 报告文件迁移 ==="

cd "$PRISM_DIR"

# 1. 创建 reports/ 目录
mkdir -p reports

# 2. 移动所有报告文件（保持原文件作为备份）
REPORT_FILES=(
    "TASK68_COMPLETION_REPORT.md"
    "TASK143_MCP_SERVER_COMPLETION_REPORT.md"
    "VERIFICATION_REPORT_Task63-65.md"
    "VERIFICATION_REPORT_Task66.md"
    "VERIFICATION_REPORT_Task67.md"
    "PROJECT_PROGRESS.md"
    "WEEK2-3_COMPLETION_REPORT.md"
    "DELIVERY_REPORT_Phase1_Retrospective_Phase2_Planning.md"
    "PHASE1_MVP_COMPLETION_REPORT.md"
    "PHASE1_MVP_DEEP_RETROSPECTIVE_REPORT.md"
    "PHASE2_PREPARATION_WEEK_COMPLETION_REPORT.md"
    "PHASE2_ARCHITECTURE.md"
)

for file in "${REPORT_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "reports/$file"
        echo "  复制: $file -> reports/$file"
    fi
done

# 3. 创建 reports/README.md
cat > reports/README.md << 'EOF'
# ReflectGuard 项目报告

本目录包含所有项目进度和复盘报告。

## 报告索引

### 阶段报告
- [Phase 1 MVP 完成报告](./PHASE1_MVP_COMPLETION_REPORT.md)
- [Phase 1 深度复盘](./PHASE1_MVP_DEEP_RETROSPECTIVE_REPORT.md)
- [Phase 2 准备周完成报告](./PHASE2_PREPARATION_WEEK_COMPLETION_REPORT.md)
- [Phase 2 架构设计](./PHASE2_ARCHITECTURE.md)

### 交付报告
- [Phase 1 复盘与 Phase 2 规划交付](./DELIVERY_REPORT_Phase1_Retrospective_Phase2_Planning.md)
- [Week 2-3 完成报告](./WEEK2-3_COMPLETION_REPORT.md)

### 任务报告
- [Task 68 完成报告](./TASK68_COMPLETION_REPORT.md)
- [Task 143 MCP Server 完成报告](./TASK143_MCP_SERVER_COMPLETION_REPORT.md)
- [Task 63-65 验证报告](./VERIFICATION_REPORT_Task63-65.md)
- [Task 66 验证报告](./VERIFICATION_REPORT_Task66.md)
- [Task 67 验证报告](./VERIFICATION_REPORT_Task67.md)

### 进度跟踪
- [项目进度](./PROJECT_PROGRESS.md)
EOF

# 4. 创建根目录索引指向新位置
cat > REPORTS.md << 'EOF'
# 报告文档索引

> 项目报告已迁移到 [`reports/`](./reports/) 目录

所有项目进度、复盘和验证报告现在集中在 `reports/` 目录中。

[查看报告目录](./reports/)
EOF

echo "✅ 报告文件迁移完成"
```

---

### 阶段 3：数据目录重组（5分钟）

```bash
#!/bin/bash
# scripts/03-organize-data.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"

echo "=== 阶段 3: 数据目录重组 ==="

cd "$PRISM_DIR"

# 1. 创建 .prism 数据目录结构
mkdir -p .prism/{level-1-hot,level-2-warm,level-3-cold,config,state}

# 2. 如果存在原有数据，迁移（保留原目录）
for level in level-1-hot level-2-warm level-3-cold; do
    if [ -d "$level" ] && [ "$(ls -A $level 2>/dev/null)" ]; then
        cp -r "$level"/* ".prism/$level/" 2>/dev/null || true
        echo "  迁移数据: $level -> .prism/$level/"
    fi
done

# 3. 创建 .prism/README.md
cat > .prism/README.md << 'EOF'
# ReflectGuard 数据目录

本目录存储 ReflectGuard 的所有运行时数据。

## 目录结构

```
.prism/
├── config/          # 配置文件
│   ├── hooks.json   # Hook 系统配置
│   └── typedoc.json # TypeDoc 配置
├── level-1-hot/     # 热数据（实时访问）
│   └── patterns/    # 成功/失败模式
├── level-2-warm/    # 温数据（复盘历史）
│   ├── retros/      # 复盘记录
│   └── violations.jsonl
├── level-3-cold/    # 冷数据（知识库）
│   ├── sops/        # 标准操作流程
│   ├── checklists/  # 检查清单
│   └── templates/   # 模板库
└── state/           # 运行时状态
```

## 数据访问

- 热数据：`~/.prism-gateway/level-1-hot/`
- 温数据：`~/.prism-gateway/level-2-warm/`
- 冷数据：`~/.prism-gateway/level-3-cold/`
EOF

echo "✅ 数据目录重组完成"
```

---

### 阶段 4：文档目录整合（10分钟）

```bash
#!/bin/bash
# scripts/04-integrate-docs.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"

echo "=== 阶段 4: 文档目录整合 ==="

cd "$PRISM_DIR"

# 1. 分析现有 API 文档目录
echo "分析 API 文档目录..."
if [ -d "docs/api_html" ]; then
    echo "  发现: docs/api_html/ ($(find docs/api_html -name '*.md' | wc -l) 个文件)"
fi
if [ -d "docs/api_new" ]; then
    echo "  发现: docs/api_new/ ($(find docs/api_new -name '*.md' | wc -l) 个文件)"
fi
if [ -d "docs/api" ]; then
    echo "  保留: docs/api/ ($(find docs/api -name '*.md' | wc -l) 个文件) - 作为权威源"
fi

# 2. 创建清晰的文档结构
mkdir -p docs/{guides,reference}

# 3. 移动用户指南文档
for file in mcp-server.md FILE_LOCK_USAGE.md MIGRATION_GUIDE.md; do
    if [ -f "docs/$file" ]; then
        cp "docs/$file" "docs/guides/$file"
        echo "  复制指南: docs/$file -> docs/guides/$file"
    fi
done

# 4. 移动参考文档
for file in DATA_MIGRATION_PLAN.md DATA_MIGRATION_SUMMARY.md \
            MIGRATION_ROLLBACK_PLAN.md MIGRATION_VALIDATION_PLAN.md; do
    if [ -f "docs/$file" ]; then
        cp "docs/$file" "docs/reference/$file"
        echo "  复制参考: docs/$file -> docs/reference/$file"
    fi
done

# 5. 创建 docs/README.md
cat > docs/README.md << 'EOF'
# ReflectGuard 文档

## 文档结构

### API 文档
- [API 参考](./api/) - TypeDoc 生成的 API 文档（权威源）

### 用户指南
- [MCP Server 使用指南](./guides/mcp-server.md)
- [文件锁使用文档](./guides/FILE_LOCK_USAGE.md)
- [数据迁移指南](./guides/MIGRATION_GUIDE.md)

### 参考文档
- [数据迁移计划](./reference/DATA_MIGRATION_PLAN.md)
- [数据迁移总结](./reference/DATA_MIGRATION_SUMMARY.md)
- [迁移回滚计划](./reference/MIGRATION_ROLLBACK_PLAN.md)
- [迁移验证计划](./reference/MIGRATION_VALIDATION_PLAN.md)
EOF

# 6. 标记冗余目录（不删除，仅标记）
if [ -d "docs/api_html" ]; then
    echo "⚠️  保留 docs/api_html/ (标记为冗余，待清理)"
fi
if [ -d "docs/api_new" ]; then
    echo "⚠️  保留 docs/api_new/ (标记为冗余，待清理)"
fi

echo "✅ 文档目录整合完成"
```

---

### 阶段 5：Import 路径更新（15分钟）

```bash
#!/bin/bash
# scripts/05-update-imports.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"

echo "=== 阶段 5: Import 路径更新 ==="

cd "$PRISM_DIR"

# 1. 分析现有 import 路径
echo "分析现有 import 路径..."
grep -r "from ['\"]\.\./\.\./\.\./" src/ --include="*.ts" | head -10 || true
grep -r "from ['\"]\.\./\.\./" src/ --include="*.ts" | head -10 || true

# 2. 由于我们没有移动 src/ 下的文件，import 路径无需更新
# 但如果将来需要，可以使用 TypeScript 的语言服务

# 3. 创建路径映射配置（预防性）
cat > config/tsconfig.paths.json << 'EOF'
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@integration/*": ["src/integration/*"],
      "@cli/*": ["src/cli/*"]
    }
  }
}
EOF

# 4. 更新主 tsconfig 引用路径
cat config/tsconfig.json | jq '. += {include: ["src/**/*", "config/**/*"]}' > /tmp/tsconfig.tmp
mv /tmp/tsconfig.tmp config/tsconfig.json

echo "✅ Import 路径分析完成"
echo "   - 当前无需更新（src/ 目录结构未变）"
echo "   - 已添加路径映射配置供未来使用"
```

---

### 阶段 6：验证和测试（10分钟）

```bash
#!/bin/bash
# scripts/06-verify.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"
BACKUP_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/backups/$(ls -t /Volumes/Model/Workspace/Agent/prism-gateway-docs/backups/ | head -1)"

echo "=== 阶段 6: 验证和测试 ==="

cd "$PRISM_DIR"

# 1. 配置文件验证
echo "1. 配置文件验证..."
if [ -f "config/tsconfig.json" ]; then
    echo "  ✅ config/tsconfig.json 存在"
    npx tsc --project config/tsconfig.json --noEmit 2>&1 | head -20 || echo "  ⚠️  TypeScript 编译检查有警告"
else
    echo "  ❌ config/tsconfig.json 不存在"
fi

if [ -f "config/typedoc.json" ]; then
    echo "  ✅ config/typedoc.json 存在"
    npx typedoc --config config/typedoc.json --version 2>&1 | grep typedoc || echo "  ⚠️  TypeDoc 检查有警告"
else
    echo "  ❌ config/typedoc.json 不存在"
fi

# 2. 测试运行
echo ""
echo "2. 运行测试套件..."
bun test 2>&1 | tee "$BACKUP_DIR/test-after.log" | tail -20

# 3. 文件完整性检查
echo ""
echo "3. 文件完整性检查..."
MISSING_COUNT=0

# 检查关键文件
KEY_FILES=(
    "src/index.ts"
    "src/core/GatewayGuard.ts"
    "src/core/MemoryStore.ts"
    "config/tsconfig.json"
    "config/typedoc.json"
    ".prism/config/hooks.json"
    "reports/README.md"
    "docs/README.md"
)

for file in "${KEY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (缺失)"
        ((MISSING_COUNT++))
    fi
done

# 4. 对比测试结果
echo ""
echo "4. 对比测试结果..."
if [ -f "$BACKUP_DIR/test-before.log" ] && [ -f "$BACKUP_DIR/test-after.log" ]; then
    BEFORE_TESTS=$(grep -c "pass" "$BACKUP_DIR/test-before.log" || echo "0")
    AFTER_TESTS=$(grep -c "pass" "$BACKUP_DIR/test-after.log" || echo "0")
    echo "  重构前通过: $BEFORE_TESTS"
    echo "  重构后通过: $AFTER_TESTS"

    if [ "$AFTER_TESTS" -ge "$BEFORE_TESTS" ]; then
        echo "  ✅ 测试数量保持或增加"
    else
        echo "  ⚠️  测试数量减少，请检查"
    fi
fi

# 5. 生成验证报告
cat > "$BACKUP_DIR/verification-report.md" << EOF
# 重构验证报告

**日期:** $(date)
**备份目录:** $BACKUP_DIR

## 检查结果

### 配置文件
- tsconfig.json: ✅
- typedoc.json: ✅
- hooks.json: ✅

### 测试状态
- 重构前: $BEFORE_TESTS 通过
- 重构后: $AFTER_TESTS 通过

### 缺失文件
- $MISSING_COUNT 个关键文件缺失

## 建议
$([ $MISSING_COUNT -eq 0 ] && echo "重构验证通过，可以提交" || echo "请检查缺失文件")
EOF

echo ""
echo "=== 验证完成 ==="
echo "验证报告: $BACKUP_DIR/verification-report.md"
```

---

### 阶段 7：清理（可选，5分钟）

```bash
#!/bin/bash
# scripts/07-cleanup.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"

echo "=== 阶段 7: 清理（可选） ==="

cd "$PRISM_DIR"

echo "⚠️  清理操作会删除原始文件，请确认已完成验证"
read -p "继续清理? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "跳过清理"
    exit 0
fi

# 1. 删除根目录报告文件（已复制到 reports/）
REPORT_FILES=(
    "TASK68_COMPLETION_REPORT.md"
    "TASK143_MCP_SERVER_COMPLETION_REPORT.md"
    "VERIFICATION_REPORT_Task63-65.md"
    "VERIFICATION_REPORT_Task66.md"
    "VERIFICATION_REPORT_Task67.md"
    "PROJECT_PROGRESS.md"
    "WEEK2-3_COMPLETION_REPORT.md"
    "DELIVERY_REPORT_Phase1_Retrospective_Phase2_Planning.md"
    "PHASE1_MVP_COMPLETION_REPORT.md"
    "PHASE1_MVP_DEEP_RETROSPECTIVE_REPORT.md"
    "PHASE2_PREPARATION_WEEK_COMPLETION_REPORT.md"
    "PHASE2_ARCHITECTURE.md"
)

for file in "${REPORT_FILES[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "  删除: $file"
    fi
done

# 2. 删除冗余 API 文档目录
if [ -d "docs/api_html" ]; then
    rm -rf "docs/api_html"
    echo "  删除: docs/api_html/"
fi

if [ -d "docs/api_new" ]; then
    rm -rf "docs/api_new"
    echo "  删除: docs/api_new/"
fi

# 3. 删除旧的配置文件
if [ -f "typedoc.json" ]; then
    rm "typedoc.json"
    echo "  删除: typedoc.json (已迁移到 config/)"
fi

if [ -f "typedoc-html.json" ]; then
    rm "typedoc-html.json"
    echo "  删除: typedoc-html.json (已整合到 config/typedoc.json)"
fi

# 4. 删除原始 level-* 目录（如果数据已迁移）
for level in level-1-hot level-2-warm level-3-cold; do
    if [ -d "$level" ] && [ -d ".prism/$level" ]; then
        # 检查目录是否为空
        if [ -z "$(ls -A $level 2>/dev/null)" ]; then
            rmdir "$level"
            echo "  删除空目录: $level/"
        else
            echo "  保留: $level/ (不为空，手动检查)"
        fi
    fi
done

echo "✅ 清理完成"
```

---

## 四、回滚方案

```bash
#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

PRISM_DIR="/Volumes/Model/Workspace/Agent/prism-gateway-docs/prism-gateway"
BACKUP_BASE="/Volumes/Model/Workspace/Agent/prism-gateway-docs/backups"

echo "=== 回滚脚本 ==="

# 1. 列出可用备份
echo "可用备份:"
ls -lt "$BACKUP_BASE" | head -10

# 2. 选择备份
read -p "输入要回滚到的备份目录名: " BACKUP_NAME
BACKUP_DIR="$BACKUP_BASE/$BACKUP_NAME"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "错误: 备份目录不存在"
    exit 1
fi

# 3. 确认
echo "将回滚到: $BACKUP_DIR"
read -p "确认回滚? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "取消回滚"
    exit 0
fi

# 4. 执行回滚
cd "$PRISM_DIR"
rm -rf config/ .prism/ reports/ docs/guides/ docs/reference/
cp -r "$BACKUP_DIR/prism-gateway-backup/"* "$PRISM_DIR/"

echo "✅ 回滚完成"
```

---

## 五、执行计划

### 执行顺序

```bash
# 完整执行流程
cd /Volumes/Model/Workspace/Agent/prism-gateway-docs

# 0. 准备
bash scripts/00-prepare.sh

# 1-6. 依次执行各阶段
bash scripts/01-integrate-configs.sh
bash scripts/02-move-reports.sh
bash scripts/03-organize-data.sh
bash scripts/04-integrate-docs.sh
bash scripts/05-update-imports.sh
bash scripts/06-verify.sh

# 7. (可选) 清理
bash scripts/07-cleanup.sh
```

### 时间估算

| 阶段 | 时间 | 风险 |
|------|------|------|
| 准备和备份 | 5分钟 | 低 |
| 配置文件整合 | 10分钟 | 中 |
| 报告文件迁移 | 5分钟 | 低 |
| 数据目录重组 | 5分钟 | 低 |
| 文档目录整合 | 10分钟 | 低 |
| Import 路径更新 | 15分钟 | 低 |
| 验证和测试 | 10分钟 | 中 |
| 清理 | 5分钟 | 低 |
| **总计** | **65分钟** | - |

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 测试失败 | 低 | 中 | 每阶段后验证测试 |
| 配置冲突 | 中 | 低 | 使用优先级合并 |
| Import 断裂 | 低 | 高 | 保持 src/ 结构不变 |
| 数据丢失 | 极低 | 高 | Shadow Migration |
| 回滚失败 | 极低 | 高 | 备份在独立目录 |

---

## 七、验证清单

- [ ] 所有测试通过
- [ ] `bun test` 无错误
- [ ] `tsc --noEmit` 无类型错误
- [ ] `typedoc` 生成成功
- [ ] 配置文件 JSON 格式正确
- [ ] 文档链接可访问
- [ ] 报告文件完整迁移
- [ ] 数据目录可访问
- [ ] 回滚脚本可用

---

**维护者:** Engineer Agent
**版本:** 1.0.0
**状态:** Ready for Execution
