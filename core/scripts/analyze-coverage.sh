#!/bin/bash

# 测试覆盖率可视化分析脚本
# 用途：从覆盖率报告中提取关键数据并生成可视化报告

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 报告文件
COVERAGE_REPORT="test-coverage-raw.txt"
OUTPUT_MD="COVERAGE_ANALYSIS.md"

echo -e "${BLUE}📊 测试覆盖率可视化分析${NC}"
echo "======================================"
echo ""

# 检查报告文件是否存在
if [ ! -f "$COVERAGE_REPORT" ]; then
    echo -e "${RED}❌ 错误：未找到覆盖率报告文件 $COVERAGE_REPORT${NC}"
    echo "请先运行: bun test --coverage 2>&1 | tee coverage-report.txt"
    exit 1
fi

# 提取整体覆盖率
echo -e "${BLUE}1. 提取整体覆盖率数据...${NC}"
OVERALL=$(grep "All files" "$COVERAGE_REPORT" | tail -1)
echo "$OVERALL"

# 提取测试统计
echo ""
echo -e "${BLUE}2. 提取测试统计...${NC}"
TEST_STATS=$(grep -E "^[0-9]+ pass" "$COVERAGE_REPORT" | tail -3)
echo "$TEST_STATS"

# 统计模块数量
echo ""
echo -e "${BLUE}3. 分析模块覆盖率...${NC}"

# 创建临时文件存储数据
TMP_FILE=$(mktemp)
grep "^src/" "$COVERAGE_REPORT" | tail -64 > "$TMP_FILE"

# 计算总数和达标数
TOTAL_MODULES=$(wc -l < "$TMP_FILE" | tr -d ' ')

# 统计达标模块（>=85%）
PASS_MODULES=$(awk '{
  # 提取行覆盖率（第3列）
  coverage = $3
  gsub(/[|%]/, "", coverage)

  if (coverage + 0 >= 85.0) {
    print
  }
}' "$TMP_FILE" | wc -l | tr -d ' ')

# 统计未达标模块（<85%）
FAIL_MODULES=$((TOTAL_MODULES - PASS_MODULES))

# 统计严重缺失（<40%）
CRITICAL_MODULES=$(awk '{
  coverage = $3
  gsub(/[|%]/, "", coverage)

  if (coverage + 0 < 40.0) {
    print $1, $3
  }
}' "$TMP_FILE" | wc -l | tr -d ' ')

echo "总模块数: $TOTAL_MODULES"
echo -e "达标模块 (>=85%): ${GREEN}$PASS_MODULES${NC}"
echo -e "未达标模块 (<85%): ${YELLOW}$FAIL_MODULES${NC}"
echo -e "严重缺失 (<40%): ${RED}$CRITICAL_MODULES${NC}"

# 生成可视化条形图
echo ""
echo -e "${BLUE}4. 生成覆盖率可视化...${NC}"
echo ""

# 整体覆盖率条形图
OVERALL_COVERAGE=$(echo "$OVERALL" | awk '{print $6}' | tr -d '%|')
PERCENT_INT=${OVERALL_COVERAGE%.*}
FILLED=$((PERCENT_INT / 2))
EMPTY=$((50 - FILLED))

echo -e "${BLUE}整体覆盖率：${NC}"
printf "["
printf "%0.s█" $(seq 1 $FILLED)
printf "%0.s░" $(seq 1 $EMPTY)
printf "] %s%%\n" "$OVERALL_COVERAGE"

if (( PERCENT_INT >= 85 )); then
    echo -e "状态: ${GREEN}✅ 达标${NC}"
else
    GAP=$((85 - PERCENT_INT))
    echo -e "状态: ${RED}❌ 未达标（差距 $GAP%%）${NC}"
fi

echo ""

# 模块分类饼图（文字版）
echo -e "${BLUE}模块分类统计：${NC}"
echo ""
echo "达标模块 (>=85%):   $PASS_MODULES/$TOTAL_MODULES ($((PASS_MODULES * 100 / TOTAL_MODULES))%)"
echo "未达标模块 (<85%):  $FAIL_MODULES/$TOTAL_MODULES ($((FAIL_MODULES * 100 / TOTAL_MODULES))%)"
echo "严重缺失 (<40%):    $CRITICAL_MODULES/$TOTAL_MODULES"

# 列出覆盖率最低的 10 个模块
echo ""
echo -e "${BLUE}5. 覆盖率最低的 10 个模块：${NC}"
echo ""

awk '{
  file = $1
  coverage = $3
  gsub(/[|%]/, "", coverage)

  printf "%s %.2f%%\n", coverage, file
}' "$TMP_FILE" | sort -n | head -10 | while read -r line; do
  coverage=$(echo "$line" | awk '{print $1}')
  file=$(echo "$line" | cut -d' ' -f2-)

  if (( $(echo "$coverage < 40" | bc -l) )); then
    echo -e "${RED}🔴 $file${NC} - ${coverage}%"
  elif (( $(echo "$coverage < 70" | bc -l) )); then
    echo -e "${YELLOW}🟡 $file${NC} - ${coverage}%"
  else
    echo -e "${GREEN}🟢 $file${NC} - ${coverage}%"
  fi
done

# 列出覆盖率最高的 10 个模块
echo ""
echo -e "${BLUE}6. 覆盖率最高的 10 个模块：${NC}"
echo ""

awk '{
  file = $1
  coverage = $3
  gsub(/[|%]/, "", coverage)

  printf "%s %.2f%%\n", coverage, file
}' "$TMP_FILE" | sort -rn | head -10 | while read -r line; do
  coverage=$(echo "$line" | awk '{print $1}')
  file=$(echo "$line" | cut -d' ' -f2-)
  echo -e "${GREEN}✅ $file${NC} - ${coverage}%"
done

# 清理临时文件
rm -f "$TMP_FILE"

echo ""
echo -e "${BLUE}7. 优先级建议：${NC}"
echo ""

if [ "$CRITICAL_MODULES" -gt 0 ]; then
    echo -e "${RED}🔴 P0 - 紧急修复（覆盖率 <40%）${NC}"
    echo "   需要立即补充测试，严重缺失影响核心功能"
    echo ""
fi

if [ "$FAIL_MODULES" -gt 0 ]; then
    echo -e "${YELLOW}🟡 P1 - 本周修复（覆盖率 40-85%）${NC}"
    echo "   需要本周内补充测试，达到目标覆盖率"
    echo ""
fi

if [ "$PASS_MODULES" -lt "$TOTAL_MODULES" ]; then
    echo -e "${GREEN}🟢 P2 - 持续优化（覆盖率 >85%）${NC}"
    echo "   继续优化测试用例，提升代码质量"
    echo ""
fi

# 生成 Markdown 报告
echo -e "${BLUE}8. 生成 Markdown 报告...${NC}"

cat > "$OUTPUT_MD" << EOF
# 测试覆盖率分析报告

> **生成时间：** $(date '+%Y-%m-%d %H:%M:%S')
> **数据来源：** $COVERAGE_REPORT

---

## 整体统计

| 指标 | 数值 |
|------|------|
| **总模块数** | $TOTAL_MODULES |
| **整体覆盖率** | ${OVERALL_COVERAGE}% |
| **达标模块（>=85%）** | $PASS_MODULES ($((PASS_MODULES * 100 / TOTAL_MODULES))%) |
| **未达标模块（<85%）** | $FAIL_MODULES ($((FAIL_MODULES * 100 / TOTAL_MODULES))%) |
| **严重缺失（<40%）** | $CRITICAL_MODULES |

## 覆盖率可视化

### 整体覆盖率

EOF

# 添加条形图到 Markdown
FILLED=$((PERCENT_INT / 2))
printf "覆盖率：" >> "$OUTPUT_MD"
printf "%0.s█" $(seq 1 $FILLED) >> "$OUTPUT_MD"
printf "%0.s░" $(seq 1 $EMPTY) >> "$OUTPUT_MD"
printf " %s%%\n\n" "$OVERALL_COVERAGE" >> "$OUTPUT_MD"

if (( PERCENT_INT >= 85 )); then
    echo "✅ **达标**" >> "$OUTPUT_MD"
else
    GAP=$((85 - PERCENT_INT))
    echo "❌ **未达标**（差距 $GAP%%）" >> "$OUTPUT_MD"
fi

cat >> "$OUTPUT_MD" << EOF

## 最低覆盖率模块（Top 10）

EOF

# 添加最低覆盖率模块列表
awk '{
  file = $1
  coverage = $3
  gsub(/[|%]/, "", coverage)

  printf "%s %.2f%%\n", coverage, file
}' "$TMP_FILE" | sort -n | head -10 | while read -r line; do
  coverage=$(echo "$line" | awk '{print $1}')
  file=$(echo "$line" | cut -d' ' -f2-)
  echo "- \`${file}\` - **${coverage}%**" >> "$OUTPUT_MD"
done

cat >> "$OUTPUT_MD" << EOF

## 最高覆盖率模块（Top 10）

EOF

# 添加最高覆盖率模块列表
awk '{
  file = $1
  coverage = $3
  gsub(/[|%]/, "", coverage)

  printf "%s %.2f%%\n", coverage, file
}' "$TMP_FILE" | sort -rn | head -10 | while read -r line; do
  coverage=$(echo "$line" | awk '{print $1}')
  file=$(echo "$line" | cut -d' ' -f2-)
  echo "- \`${file}\` - **${coverage}%**" >> "$OUTPUT_MD"
done

cat >> "$OUTPUT_MD" << EOF

## 优先级建议

EOF

if [ "$CRITICAL_MODULES" -gt 0 ]; then
    echo "### 🔴 P0 - 紧急修复（覆盖率 <40%）" >> "$OUTPUT_MD"
    echo "" >> "$OUTPUT_MD"
    echo "需要立即补充测试，严重缺失影响核心功能。" >> "$OUTPUT_MD"
    echo "" >> "$OUTPUT_MD"
fi

if [ "$FAIL_MODULES" -gt 0 ]; then
    echo "### 🟡 P1 - 本周修复（覆盖率 40-85%）" >> "$OUTPUT_MD"
    echo "" >> "$OUTPUT_MD"
    echo "需要本周内补充测试，达到目标覆盖率。" >> "$OUTPUT_MD"
    echo "" >> "$OUTPUT_MD"
fi

if [ "$PASS_MODULES" -lt "$TOTAL_MODULES" ]; then
    echo "### 🟢 P2 - 持续优化（覆盖率 >85%）" >> "$OUTPUT_MD"
    echo "" >> "$OUTPUT.md"
    echo "继续优化测试用例，提升代码质量。" >> "$OUTPUT_MD"
    echo "" >> "$OUTPUT_MD"
fi

echo ""
echo -e "${GREEN}✅ 分析完成！${NC}"
echo ""
echo "生成的文件："
echo "  - $OUTPUT_MD (Markdown 报告)"
echo ""
echo "查看报告："
echo "  cat $OUTPUT_MD"
echo ""

exit 0
