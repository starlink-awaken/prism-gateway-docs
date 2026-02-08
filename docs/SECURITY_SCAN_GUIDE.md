# ReflectGuard 安全扫描使用指南

**版本:** 1.0.0
**更新:** 2026-02-06
**维护者:** ReflectGuard Pentester Agent

---

## 目录

1. [概述](#1-概述)
2. [扫描组件](#2-扫描组件)
3. [本地使用](#3-本地使用)
4. [CI/CD 集成](#4-cicd-集成)
5. [配置说明](#5-配置说明)
6. [报告解读](#6-报告解读)
7. [故障排除](#7-故障排除)

---

## 1. 概述

ReflectGuard 安全扫描系统是一套**自动化安全测试解决方案**，覆盖：

- **依赖安全扫描** - 检测第三方库漏洞
- **代码安全扫描** - 检测代码中的安全问题
- **敏感信息扫描** - 检测硬编码的密钥和凭证
- **OWASP Top 10 检查** - 检测常见 Web 应用漏洞
- **合规检查** - 验证安全标准和规范

### 设计原则

| 原则 | 说明 |
|------|------|
| **安全优先** | 严重/高危问题阻断合并 |
| **快速反馈** | 本地扫描 <5 分钟 |
| **自动化** | CI/CD 自动触发，每日定时扫描 |
| **可配置** | 灵活调整扫描规则和阈值 |
| **轻量级** | 不引入重量级安全框架 |

---

## 2. 扫描组件

### 2.1 依赖安全扫描

**工具:** Bun Audit + npm audit
**目标:** 检测第三方依赖库中的已知漏洞

| 严重级别 | 行为 |
|---------|------|
| 严重 (Critical) | ❌ 阻断合并 |
| 高危 (High) | ❌ 阻断合并 |
| 中危 (Moderate) | ⚠️ 建议修复 (≤5个) |
| 低危 (Low) | ℹ️ 提示 |

### 2.2 代码安全扫描

**工具:** ESLint + security plugins
**目标:** 检测代码中的安全反模式

**检测规则:**
- `security/detect-buffer-noassert` - 缓冲区断言缺失
- `security/detect-child-process` - 子进程调用
- `security/detect-eval-with-expression` - 动态代码执行
- `security/detect-non-literal-fs-filename` - 路径遍历风险
- `security/detect-object-injection` - 对象注入风险
- `security/detect-pseudoRandomBytes` - 弱随机数生成
- `no-secrets/secrets` - 硬编码密钥检测

### 2.3 敏感信息扫描

**工具:** gitleaks + 自定义模式
**目标:** 检测硬编码的敏感信息

**检测模式:**
- AWS 凭证 (AKIA*)
- GitHub Token (ghp_*)
- Stripe 密钥 (sk-*)
- Google API Key (AIza*)
- Bearer Token
- 一般密码/密钥模式

### 2.4 OWASP Top 10 检查

**工具:** 自定义静态分析
**目标:** 检测 OWASP Top 10 (2021) 漏洞类别

| 类别 | 检测内容 | 严重级别 |
|------|---------|---------|
| A01 - 访问控制失效 | 权限检查缺失 | 高危 |
| A02 - 加密失败 | 弱哈希算法 | 严重 |
| A03 - 注入攻击 | SQL/命令注入 | 严重 |
| A04 - 不安全设计 | CORS * 配置 | 高危 |
| A05 - 安全配置错误 | debug=true | 中危 |
| A07 - 认证失效 | 弱密码哈希 | 高危 |

### 2.5 合规检查

**标准:**
- OWASP Top 10 (2021)
- OWASP ASVS Level 1
- PCI DSS SSR (相关部分)
- GDPR 数据保护

---

## 3. 本地使用

### 3.1 安装依赖

```bash
cd prism-gateway
bun install

# 安装安全扫描工具（可选）
bun add -d eslint eslint-plugin-security eslint-plugin-no-secrets @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

### 3.2 运行完整扫描

```bash
# 运行所有安全扫描
bun run security

# 或直接运行脚本
./scripts/security-scan.sh
```

**预期输出:**
```
██████╗ ██╗██████╗ ███████╗ █████╗ ███╗   ███╗███████╗██████╗
██╔══██╗██║██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔════╝██╔══██╗
██████╔╝██║██████╔╝█████╗  ███████║██╔████╔██║█████╗  ██████╔╝
██╔══██╗██║██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║██╔══╝  ██╔══██╗
██████╔╝██║██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗██║  ██║
╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝

ReflectGuard 本地安全扫描
时间: 2026-02-06 10:00:00 UTC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  依赖安全扫描
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 依赖安全扫描通过

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  扫描结果汇总
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

耗时: 45 秒

扫描任务结果:
  依赖安全扫描:    ✅ 通过
  代码安全扫描:    ✅ 通过
  敏感信息扫描:    ✅ 通过
  OWASP 检查:      ✅ 通过

报告位置: reports/security

✅ 安全门禁: 通过

所有安全扫描任务均已通过，可以提交代码。
```

### 3.3 单独运行扫描

```bash
# 只扫描依赖
bun run security:deps

# 只扫描代码
bun run security:code

# 只扫描敏感信息
bun run security:secrets

# 只运行 OWASP 检查
bun run security:owasp
```

### 3.4 查看报告

```bash
# 列出所有报告
ls -la reports/security/

# 查看依赖漏洞报告
cat reports/security/bun-audit-report.txt

# 查看 ESLint 安全报告
cat reports/security/eslint-security-report.txt

# 查看 OWASP 报告
cat reports/security/owasp-report.txt
```

---

## 4. CI/CD 集成

### 4.1 触发条件

**GitHub Actions 工作流:** `.github/workflows/security-scan.yml`

| 事件 | 条件 | 说明 |
|------|------|------|
| Pull Request | 到 main 分支 | 代码合并前检查 |
| Push | 到 main 分支 | 确保主分支安全 |
| Schedule | 每日 UTC 02:00 | 定时扫描，发现新漏洞 |
| Manual | workflow_dispatch | 手动触发 |

### 4.2 安全门禁

**阻断条件:**
- 严重/高危依赖漏洞
- 代码安全错误
- 敏感信息泄露
- OWASP 严重/高危问题

**允许条件:**
- 中低危依赖漏洞 (在允许数量内)
- 安全警告 (不阻断)

### 4.3 报告和通知

**自动生成:**
- 安全扫描汇总报告
- 各扫描任务详细报告
- PR 安全状态评论

**通知渠道:**
- GitHub PR 评论
- GitHub Actions 日志
- Artifacts 存储 (30天)

### 4.4 查看扫描结果

**GitHub Actions:**
1. 进入 Actions 标签
2. 选择 "Security Scan" 工作流
3. 查看最新运行
4. 下载 artifacts 获取详细报告

---

## 5. 配置说明

### 5.1 安全扫描配置

**文件:** `.securityrc.json`

```json
{
  "scan": {
    "enabled": true,
    "parallel": true,
    "failOnError": true,
    "timeoutMinutes": 15
  },
  "dependencyScan": {
    "severityThreshold": "high",
    "allowedVulnerabilities": {
      "moderate": 5,
      "low": 10
    }
  },
  "codeScan": {
    "config": ".eslintrc.security.json"
  },
  "secretsScan": {
    "patterns": [...],
    "excludePaths": [...]
  },
  "owaspCheck": {
    "categories": {...}
  }
}
```

### 5.2 ESLint 安全配置

**文件:** `.eslintrc.security.json`

```json
{
  "extends": ["plugin:security/recommended"],
  "plugins": ["security", "no-secrets"],
  "rules": {
    "security/detect-buffer-noassert": "error",
    "no-secrets/secrets": "error"
  }
}
```

### 5.3 自定义配置

**修改漏洞阈值:**

```bash
# .securityrc.json
{
  "dependencyScan": {
    "allowedVulnerabilities": {
      "moderate": 10,  # 增加
      "low": 20        # 增加
    }
  }
}
```

**排除特定包:**

```json
{
  "dependencyScan": {
    "excludePackages": [
      "some-package-with-false-positive"
    ]
  }
}
```

**添加允许列表:**

```json
{
  "secretsScan": {
    "allowList": [
      "password = \"example\"",
      "API_KEY = \"test_key\""
    ]
  }
}
```

---

## 6. 报告解读

### 6.1 依赖漏洞报告

**文件:** `reports/security/bun-audit-report.txt`

```
Found 0 vulnerabilities
```

**有漏洞时:**
```
+ pkgname@1.0.0
  ├─ severity: high
  ├─ title: Prototype Pollution
  └─ patch: 1.0.1
```

**修复步骤:**
```bash
# 更新到安全版本
bun update pkgname

# 或更新所有依赖
bun update
```

### 6.2 代码安全报告

**文件:** `reports/security/eslint-security-report.txt`

```
src/module.ts:10:14  error  Detected eval with expression  security/detect-eval-with-expression
```

**修复步骤:**
1. 查看报告中的具体位置
2. 理解安全问题
3. 重写代码避免安全反模式

### 6.3 敏感信息报告

**文件:** `reports/security/secrets-scan-report.txt`

```
敏感信息扫描报告

发现匹配: password\s*=\s*["'][^"']+["']
src/config.ts:15:password = "supersecretpassword"
```

**修复步骤:**
1. 移除硬编码的敏感信息
2. 使用环境变量或密钥管理服务
3. 轮换已泄露的凭证

### 6.4 OWASP 报告

**文件:** `reports/security/owasp-report.txt`

```
🔴 A02 - Cryptographic Failures
   文件: src/crypto.ts
   行号: 25
   描述: 检测加密失败问题
   代码: crypto.createHash('md5')
```

**修复步骤:**
1. 替换弱加密算法 (MD5, SHA1)
2. 使用强加密算法 (SHA-256, Argon2)

---

## 7. 故障排除

### 7.1 扫描失败

**问题:** 依赖扫描超时
```bash
# 解决: 使用缓存或增加超时
bun install --frozen-lockfile
```

**问题:** ESLint 插件未安装
```bash
# 解决: 安装缺失的依赖
bun add -d eslint eslint-plugin-security eslint-plugin-no-secrets
```

**问题:** gitleaks 不可用
```bash
# 解决: CI 环境会自动安装，本地可选
brew install gitleaks  # macOS
```

### 7.2 误报处理

**代码误报:**
```json
// .eslintrc.security.json
{
  "rules": {
    "security/detect-child-process": "off"  // 关闭规则
  }
}
```

**密钥误报:**
```json
// .securityrc.json
{
  "secretsScan": {
    "allowList": [
      "const TEST_KEY = \"test-key-12345\""
    ]
  }
}
```

### 7.3 性能优化

**并行扫描:**
```json
// .securityrc.json
{
  "scan": {
    "parallel": true  // 启用并行
  }
}
```

**增量扫描:**
```bash
# 只扫描变更文件
./scripts/security-scan.sh --changed
```

---

## 附录

### A. 快速参考

| 命令 | 说明 |
|------|------|
| `bun run security` | 运行完整扫描 |
| `bun run security:deps` | 依赖扫描 |
| `bun run security:code` | 代码扫描 |
| `bun run security:secrets` | 敏感信息扫描 |
| `bun run security:owasp` | OWASP 检查 |
| `bun run lint:security` | ESLint 安全检查 |

### B. 安全扫描流程图

```
代码提交
    │
    ▼
┌─────────────────────────────────────────┐
│  PR 触发 / Push 触发 / 定时触发        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  1. 依赖安全扫描 (Bun Audit)           │
│  2. 代码安全扫描 (ESLint Security)     │
│  3. 敏感信息扫描 (gitleaks)            │
│  4. OWASP Top 10 检查                  │
│  5. 合规检查                            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  汇总结果                               │
│  - 生成报告                             │
│  - 发布 PR 评论                         │
│  - 上传 artifacts                      │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  安全门禁判断                           │
│  ├─ 通过 → 允许合并                    │
│  └─ 失败 → 阻断合并                    │
└─────────────────────────────────────────┘
```

### C. 相关链接

- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Bun Security](https://bun.sh/guides/install/package-management)
- [ESLint Security Plugins](https://github.com/nodesecurity/eslint-plugin-security)
- [gitleaks](https://github.com/gitleaks/gitleaks)

---

**维护者:** ReflectGuard Pentester Agent
**版本:** 1.0.0
**最后更新:** 2026-02-06
