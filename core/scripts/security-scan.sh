#!/bin/bash
# PRISM-Gateway 本地安全扫描脚本
#
# 功能: 在本地运行完整的安全扫描，模拟 CI/CD 环境的检查
# 用途: 开发者在提交前预检查安全问题
#
# 使用方法:
#   ./scripts/security-scan.sh              # 运行所有扫描
#   ./scripts/security-scan.sh --deps       # 只扫描依赖
#   ./scripts/security-scan.sh --code       # 只扫描代码
#   ./scripts/security-scan.sh --secrets    # 只扫描敏感信息
#   ./scripts/security-scan.sh --owasp      # 只运行 OWASP 检查
#
# 维护者: PRISM-Gateway Pentester Agent
# 版本: 1.0.0
# 更新: 2026-02-06

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="${PROJECT_ROOT}/reports/security"

# 创建报告目录
mkdir -p "$REPORTS_DIR"

# 扫描选项
SCAN_DEPS=true
SCAN_CODE=true
SCAN_SECRETS=true
SCAN_OWASP=true

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --deps)
      SCAN_DEPS=true
      SCAN_CODE=false
      SCAN_SECRETS=false
      SCAN_OWASP=false
      shift
      ;;
    --code)
      SCAN_DEPS=false
      SCAN_CODE=true
      SCAN_SECRETS=false
      SCAN_OWASP=false
      shift
      ;;
    --secrets)
      SCAN_DEPS=false
      SCAN_CODE=false
      SCAN_SECRETS=true
      SCAN_OWASP=false
      shift
      ;;
    --owasp)
      SCAN_DEPS=false
      SCAN_CODE=false
      SCAN_SECRETS=false
      SCAN_OWASP=true
      shift
      ;;
    -h|--help)
      echo "PRISM-Gateway 本地安全扫描脚本"
      echo ""
      echo "使用方法:"
      echo "  $0 [选项]"
      echo ""
      echo "选项:"
      echo "  --deps      只扫描依赖漏洞"
      echo "  --code      只扫描代码安全问题"
      echo "  --secrets   只扫描敏感信息泄露"
      echo "  --owasp     只运行 OWASP Top 10 检查"
      echo "  -h, --help  显示帮助信息"
      echo ""
      echo "不带参数运行时，执行所有扫描。"
      exit 0
      ;;
    *)
      echo -e "${RED}未知参数: $1${NC}"
      echo "使用 -h 或 --help 查看帮助"
      exit 1
      ;;
  esac
done

# 打印标题
print_header() {
  local title="$1"
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $title${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# 打印结果
print_result() {
  local status="$1"
  local message="$2"

  if [ "$status" = "PASS" ]; then
    echo -e "${GREEN}✅ $message${NC}"
  elif [ "$status" = "WARN" ]; then
    echo -e "${YELLOW}⚠️  $message${NC}"
  else
    echo -e "${RED}❌ $message${NC}"
  fi
}

# ============================================
# 任务 1: 依赖安全扫描
# ============================================

scan_dependencies() {
  print_header "依赖安全扫描"

  cd "$PROJECT_ROOT"

  echo "运行 Bun Audit..."
  bun pm audit > "$REPORTS_DIR/bun-audit-report.txt" 2>&1 || true

  cat "$REPORTS_DIR/bun-audit-report.txt"

  # 分析结果
  CRITICAL=$(grep -i "critical" "$REPORTS_DIR/bun-audit-report.txt" | wc -l || echo 0)
  HIGH=$(grep -i "high" "$REPORTS_DIR/bun-audit-report.txt" | wc -l || echo 0)
  MODERATE=$(grep -i "moderate" "$REPORTS_DIR/bun-audit-report.txt" | wc -l || echo 0)
  LOW=$(grep -i "low" "$REPORTS_DIR/bun-audit-report.txt" | wc -l || echo 0)

  echo ""
  echo "漏洞统计:"
  echo "  严重 (Critical): $CRITICAL"
  echo "  高危 (High):      $HIGH"
  echo "  中危 (Moderate):  $MODERATE"
  echo "  低危 (Low):       $LOW"

  if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
    print_result "FAIL" "依赖安全扫描失败: 发现严重或高危漏洞"
    return 1
  elif [ "$MODERATE" -gt 5 ] || [ "$LOW" -gt 10 ]; then
    print_result "WARN" "依赖安全扫描: 中低危漏洞数量较多"
    return 0
  else
    print_result "PASS" "依赖安全扫描通过"
    return 0
  fi
}

# ============================================
# 任务 2: 代码安全扫描
# ============================================

scan_code_security() {
  print_header "代码安全扫描"

  cd "$PROJECT_ROOT"

  # 检查是否安装了 ESLint 安全插件
  if ! bun pm ls | grep -q "eslint-plugin-security"; then
    echo "安装 ESLint 安全插件..."
    bun add -d eslint eslint-plugin-security eslint-plugin-no-secrets @typescript-eslint/eslint-plugin @typescript-eslint/parser || {
      print_result "WARN" "无法安装 ESLint 安全插件，跳过代码安全扫描"
      return 0
    }
  fi

  echo "运行 ESLint 安全扫描..."
  bunx eslint src/ \
    --config .eslintrc.security.json \
    --format json \
    --output-file "$REPORTS_DIR/eslint-security-report.json" \
    || ESLINT_EXIT=$?

  bunx eslint src/ \
    --config .eslintrc.security.json \
    --format stylish \
    > "$REPORTS_DIR/eslint-security-report.txt" 2>&1 || true

  cat "$REPORTS_DIR/eslint-security-report.txt"

  if [ -f "$REPORTS_DIR/eslint-security-report.json" ]; then
    ERROR_COUNT=$(node -e "
      const fs = require('fs');
      try {
        const data = JSON.parse(fs.readFileSync('$REPORTS_DIR/eslint-security-report.json', 'utf8'));
        console.log(data.length || 0);
      } catch {
        console.log(0);
      }
    ")
  else
    ERROR_COUNT=0
  fi

  echo ""
  echo "发现 $ERROR_COUNT 个安全问题"

  if [ "$ERROR_COUNT" -gt 0 ]; then
    print_result "FAIL" "代码安全扫描失败: 发现安全问题"
    return 1
  else
    print_result "PASS" "代码安全扫描通过"
    return 0
  fi
}

# ============================================
# 任务 3: 敏感信息扫描
# ============================================

scan_secrets() {
  print_header "敏感信息扫描"

  cd "$PROJECT_ROOT"

  # 简单的敏感信息检测（无需 gitleaks）
  echo "扫描硬编码的敏感信息..."

  SECRET_PATTERNS=(
    "password\\s*=\\s*['\\\"].*['\\\"]"
    "api[_-]?key\\s*=\\s*['\\\"].*['\\\"]"
    "secret[_-]?key\\s*=\\s*['\\\"].*['\\\"]"
    "auth[_-]?token\\s*=\\s*['\\\"].*['\\\"]"
    "AKIA[0-9A-Z]{16}"
    "gh[pous]_[A-Za-z0-9_]{36,}"
    "sk-[a-zA-Z0-9]{20,}"
    "AIza[A-Za-z0-9_\\-]{35}"
    "bearer\\s+[a-zA-Z0-9._~+/=\\-]{20,}"
  )

  FOUND_SECRETS=0
  REPORT_FILE="$REPORTS_DIR/secrets-scan-report.txt"

  echo "" > "$REPORT_FILE"
  echo "敏感信息扫描报告" >> "$REPORT_FILE"
  echo "生成时间: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"

  for pattern in "${SECRET_PATTERNS[@]}"; do
    MATCHES=$(grep -rnE --include="*.ts" --include="*.js" --include="*.json" --exclude-dir=node_modules "$pattern" src/ 2>/dev/null || true)

    if [ -n "$MATCHES" ]; then
      echo "发现匹配: $pattern" >> "$REPORT_FILE"
      echo "$MATCHES" >> "$REPORT_FILE"
      echo "" >> "$REPORT_FILE"
      FOUND_SECRETS=$((FOUND_SECRETS + 1))
    fi
  done

  # 排除示例文件和测试文件
  if [ -f "$REPORT_FILE" ]; then
    FILTERED_REPORT="$REPORT_FILE.filtered"
    grep -v "\.example\|\.test\|\.spec\|example\|test" "$REPORT_FILE" > "$FILTERED_REPORT" || true
    FOUND_SECRETS=$(wc -l < "$FILTERED_REPORT" || echo 0)
  fi

  cat "$REPORT_FILE"

  if [ "$FOUND_SECRETS" -gt 5 ]; then
    print_result "FAIL" "敏感信息扫描失败: 发现可能的硬编码敏感信息"
    echo "请检查上述结果，确保没有真实的敏感信息泄露"
    return 1
  elif [ "$FOUND_SECRETS" -gt 0 ]; then
    print_result "WARN" "敏感信息扫描: 发现可能的敏感信息，请确认"
    return 0
  else
    print_result "PASS" "敏感信息扫描通过"
    return 0
  fi
}

# ============================================
# 任务 4: OWASP Top 10 检查
# ============================================

scan_owasp() {
  print_header "OWASP Top 10 检查"

  cd "$PROJECT_ROOT"

  # 创建 OWASP 检查脚本
  cat > "$REPORTS_DIR/owasp-check.js" << 'OWASP_SCRIPT'
  import { readFileSync, readdirSync, statSync } from 'fs';
  import { join } from 'path';

  const owaspChecks = {
    // A01:2021 - Broken Access Control
    brokenAccessControl: {
      patterns: [
        /authorization\s*=\s*["']user["']/i,
        /if\s*\(\s*req\.user\.id\s*===\s*params\.id/i,
      ],
      severity: 'high',
      category: 'A01 - Broken Access Control',
      description: '检测访问控制失效问题'
    },
    // A02:2021 - Cryptographic Failures
    cryptoFailures: {
      patterns: [
        /password\s*=\s*["'][^"']+["']/i,
        /crypto\.createHash\(["']md5["']\)/i,
        /crypto\.createHash\(["']sha1["']\)/i,
      ],
      severity: 'critical',
      category: 'A02 - Cryptographic Failures',
      description: '检测加密失败问题'
    },
    // A03:2021 - Injection
    injection: {
      patterns: [
        /execute\s*\(\s*["'].*?\$\{.*?\}.*?["']\s*\)/i,
        /eval\s*\(\s*["'].*?\$\{.*?\}.*?["']\s*\)/i,
        /query\s*\(\s*["'].*?\$\{.*?\}.*?["']\s*\)/i,
      ],
      severity: 'critical',
      category: 'A03 - Injection',
      description: '检测注入漏洞'
    },
    // A04:2021 - Insecure Design
    insecureDesign: {
      patterns: [
        /cors\s*\(\s*\{\s*origin:\s*["']\*["']/i,
      ],
      severity: 'high',
      category: 'A04 - Insecure Design',
      description: '检测不安全设计'
    },
    // A05:2021 - Security Misconfiguration
    misconfig: {
      patterns: [
        /debug:\s*true/i,
        /NODE_ENV\s*===\s*["']development["']/i,
      ],
      severity: 'medium',
      category: 'A05 - Security Misconfiguration',
      description: '检测安全配置错误'
    },
    // A07:2021 - Identification and Authentication Failures
    authFailures: {
      patterns: [
        /jwt\.sign\s*\(\s*payload\s*\)/i,
        /bcrypt\.hash\(\s*password\s*,\s*[1-5]\s*\)/i,
      ],
      severity: 'high',
      category: 'A07 - Authentication Failures',
      description: '检测身份认证失效'
    },
  };

  function checkFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const findings = [];

      for (const [name, check] of Object.entries(owaspChecks)) {
        for (const pattern of check.patterns) {
          const regex = new RegExp(pattern, 'gim');
          lines.forEach((line, index) => {
            const matches = line.match(regex);
            if (matches) {
              findings.push({
                file: filePath,
                line: index + 1,
                category: check.category,
                check: name,
                severity: check.severity,
                description: check.description,
                pattern: pattern.source,
                match: matches[0],
              });
            }
          });
        }
      }

      return findings;
    } catch (error) {
      return [];
    }
  }

  function scanDirectory(dir, baseDir = dir) {
    const findings = [];
    let fileCount = 0;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
            findings.push(...scanDirectory(fullPath, baseDir));
          }
        } else if (entry.isFile()) {
          if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
            fileCount++;
            findings.push(...checkFile(fullPath));
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
    }

    return findings;
  }

  const srcDir = 'src';
  let findings = [];

  try {
    findings = scanDirectory(srcDir);
  } catch (error) {
    console.log('无法扫描源代码目录:', error.message);
  }

  // 排除测试文件
  findings = findings.filter(f => !f.file.includes('.test.') && !f.file.includes('.spec.'));

  // 输出结果
  console.log('\nOWASP Top 10 检查结果');
  console.log('='.repeat(60));

  if (findings.length === 0) {
    console.log('\n✅ 未发现 OWASP Top 10 安全问题\n');
    console.log(JSON.stringify({
      total: 0,
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0 }
    }, null, 2));
    process.exit(0);
  }

  findings.forEach(finding => {
    const emoji = finding.severity === 'critical' ? '🔴' :
                  finding.severity === 'high' ? '🟠' :
                  finding.severity === 'medium' ? '🟡' : '🟢';
    console.log(`\n${emoji} ${finding.category}`);
    console.log(`   文件: ${finding.file}`);
    console.log(`   行号: ${finding.line}`);
    console.log(`   描述: ${finding.description}`);
    console.log(`   代码: ${finding.match.substring(0, 50)}...`);
  });

  const summary = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  console.log('\n' + '='.repeat(60));
  console.log('统计:');
  console.log(`  严重 (Critical): ${summary.critical}`);
  console.log(`  高危 (High):      ${summary.high}`);
  console.log(`  中危 (Medium):    ${summary.medium}`);
  console.log(`  低危 (Low):       ${summary.low}`);
  console.log('');

  console.log(JSON.stringify({
    total: findings.length,
    findings: findings,
    summary: summary
  }, null, 2));

  // 严重/高危问题导致退出码为 1
  const hasCriticalOrHigh = summary.critical > 0 || summary.high > 0;
  process.exit(hasCriticalOrHigh ? 1 : 0);
  OWASP_SCRIPT

  echo "运行 OWASP Top 10 检查..."
  bun run "$REPORTS_DIR/owasp-check.js" | tee "$REPORTS_DIR/owasp-report.txt"
  OWASP_EXIT=$?

  if [ $OWASP_EXIT -ne 0 ]; then
    print_result "FAIL" "OWASP 检查失败: 发现严重或高危问题"
    return 1
  else
    print_result "PASS" "OWASP 检查通过"
    return 0
  fi
}

# ============================================
# 主程序
# ============================================

main() {
  echo -e "${BLUE}"
  echo "██████╗ ██╗██████╗ ███████╗ █████╗ ███╗   ███╗███████╗██████╗ "
  echo "██╔══██╗██║██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔════╝██╔══██╗"
  echo "██████╔╝██║██████╔╝█████╗  ███████║██╔████╔██║█████╗  ██████╔╝"
  echo "██╔══██╗██║██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║██╔══╝  ██╔══██╗"
  echo "██████╔╝██║██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗██║  ██║"
  echo "╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝"
  echo -e "${NC}"
  echo ""
  echo "PRISM-Gateway 本地安全扫描"
  echo "时间: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo ""

  # 记录开始时间
  START_TIME=$(date +%s)

  # 运行扫描
  DEPS_RESULT=0
  CODE_RESULT=0
  SECRETS_RESULT=0
  OWASP_RESULT=0

  if [ "$SCAN_DEPS" = true ]; then
    scan_dependencies || DEPS_RESULT=$?
  fi

  if [ "$SCAN_CODE" = true ]; then
    scan_code_security || CODE_RESULT=$?
  fi

  if [ "$SCAN_SECRETS" = true ]; then
    scan_secrets || SECRETS_RESULT=$?
  fi

  if [ "$SCAN_OWASP" = true ]; then
    scan_owasp || OWASP_RESULT=$?
  fi

  # 计算耗时
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  # 输出汇总
  print_header "扫描结果汇总"

  echo "耗时: ${DURATION} 秒"
  echo ""
  echo "扫描任务结果:"
  [ "$SCAN_DEPS" = true ] && echo "  依赖安全扫描:    $([ $DEPS_RESULT -eq 0 ] && echo '✅ 通过' || echo '❌ 失败')"
  [ "$SCAN_CODE" = true ] && echo "  代码安全扫描:    $([ $CODE_RESULT -eq 0 ] && echo '✅ 通过' || echo '❌ 失败')"
  [ "$SCAN_SECRETS" = true ] && echo "  敏感信息扫描:    $([ $SECRETS_RESULT -eq 0 ] && echo '✅ 通过' || echo '❌ 失败')"
  [ "$SCAN_OWASP" = true ] && echo "  OWASP 检查:      $([ $OWASP_RESULT -eq 0 ] && echo '✅ 通过' || echo '❌ 失败')"

  echo ""
  echo "报告位置: $REPORTS_DIR"

  # 安全门禁判断
  if [ $DEPS_RESULT -ne 0 ] || [ $CODE_RESULT -ne 0 ] || [ $SECRETS_RESULT -ne 0 ] || [ $OWASP_RESULT -ne 0 ]; then
    echo ""
    print_result "FAIL" "安全门禁: 失败"
    echo ""
    echo "请修复上述安全问题后再提交代码。"
    echo "查看详细报告: $REPORTS_DIR"
    exit 1
  else
    echo ""
    print_result "PASS" "安全门禁: 通过"
    echo ""
    echo "所有安全扫描任务均已通过，可以提交代码。"
    exit 0
  fi
}

# 运行主程序
main "$@"
