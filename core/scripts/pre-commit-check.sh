#!/bin/bash
# PRISM-Gateway 本地预检查脚本
#
# 用途: 在推送代码前运行与 CI 相同的检查
# 使用: bun run pre-commit 或 ./scripts/pre-commit-check.sh
#
# 维护者: PRISM-Gateway Team
# 最后更新: 2026-02-06

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0
WARNINGS=0

# 打印标题
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"
}

# 打印成功
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED++))
}

# 打印失败
print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED++))
}

# 打印警告
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

# 打印信息
print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 切换到脚本所在目录的父目录（项目根目录）
cd "$(dirname "$0")/.."

# ============================================
# 1. 类型检查
# ============================================
print_header "类型检查 (TypeScript)"

if bun run tsc --noEmit 2>&1; then
    print_success "类型检查通过"
else
    print_error "类型检查失败，请修复类型错误"
fi

# ============================================
# 2. Lint 检查
# ============================================
print_header "代码规范检查 (ESLint)"

if bun run lint 2>&1; then
    print_success "代码规范检查通过"
else
    print_warning "代码规范检查发现问题"
    print_info "尝试运行 'bun run lint --fix' 自动修复"
fi

# ============================================
# 3. 单元测试
# ============================================
print_header "单元测试"

if bun test 2>&1; then
    print_success "所有测试通过"
else
    print_error "测试失败，请修复失败的测试"
fi

# ============================================
# 4. 覆盖率检查
# ============================================
print_header "覆盖率检查"

COVERAGE_THRESHOLD=85

if bun test --coverage 2>&1; then
    # 尝试读取覆盖率（如果可用）
    if [ -f "coverage/coverage-summary.json" ]; then
        COVERAGE=$(node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
            const total = data.total;
            const pct = (total.lines.pct + total.branches.pct + total.functions.pct + total.statements.pct) / 4;
            console.log(Math.round(pct));
        " 2>/dev/null || echo "0")

        if [ "$COVERAGE" -ge "$COVERAGE_THRESHOLD" ]; then
            print_success "覆盖率 ${COVERAGE}% 达到要求 (>=${COVERAGE_THRESHOLD}%)"
        else
            print_error "覆盖率 ${COVERAGE}% 低于要求阈值 (${COVERAGE_THRESHOLD}%)"
        fi
    else
        print_warning "无法读取覆盖率报告，请检查 c8 配置"
    fi
else
    print_error "覆盖率检查失败"
fi

# ============================================
# 5. 安全扫描
# ============================================
print_header "安全扫描"

AUDIT_OUTPUT=$(bun audit 2>&1 || true)

if echo "$AUDIT_OUTPUT" | grep -q "0 vulnerabilities"; then
    print_success "安全扫描通过，未发现漏洞"
elif echo "$AUDIT_OUTPUT" | grep -q "critical"; then
    print_error "发现严重安全漏洞，请立即修复"
    echo "$AUDIT_OUTPUT"
elif echo "$AUDIT_OUTPUT" | grep -q "high"; then
    print_error "发现高危安全漏洞，请修复后再提交"
    echo "$AUDIT_OUTPUT"
elif echo "$AUDIT_OUTPUT" | grep -q "medium"; then
    print_warning "发现中危安全漏洞，建议修复"
    echo "$AUDIT_OUTPUT"
else
    print_success "安全扫描通过（仅有低危漏洞）"
fi

# ============================================
# 总结报告
# ============================================
print_header "检查总结"

echo -e "通过: ${GREEN}${PASSED}${NC}"
echo -e "警告: ${YELLOW}${WARNINGS}${NC}"
echo -e "失败: ${RED}${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}所有检查通过！可以安全提交代码。${NC}\n"
    exit 0
else
    echo -e "\n${RED}检查失败！请修复问题后再提交。${NC}\n"
    exit 1
fi
