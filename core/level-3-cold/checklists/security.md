# 安全检查清单 (Security Checklist)

> 系统化的安全审查清单，覆盖 OWASP Top 10 和常见安全风险

**版本：** 1.0.0
**最后更新：** 2026-02-07
**安全级别：** 生产环境必须

---

## 🔴 输入验证与注入防护

### SQL 注入防护
- [ ] 使用参数化查询
  ```typescript
  // ✅ 正确
  db.query('SELECT * FROM users WHERE id = ?', [userId]);

  // ❌ 错误
  db.query(`SELECT * FROM users WHERE id = '${userId}'`);
  ```
- [ ] 使用 ORM（如 Prisma）
- [ ] 输入长度限制
- [ ] 特殊字符转义

### XSS 防护
- [ ] 输出转义（HTML、JavaScript、URL）
- [ ] Content-Type 正确设置
- [ ] CSP (Content Security Policy) 配置
- [ ] HTTPOnly Cookie 标记

### 命令注入防护
- [ ] 避免执行外部命令
- [ ] 使用白名单验证
- [ ] 参数化命令执行
- [ ] 最小权限原则

### 路径遍历防护
- [ ] 使用 `pathValidator` 验证路径
- [ ] 禁止 `../` 序列
- [ ] 使用绝对路径
- [ ] 限制访问目录

---

## 🔐 认证与授权

### 认证安全
- [ ] 密码加密存储（bcrypt/argon2）
- [ ] JWT 密钥足够强（≥32 字符）
- [ ] Token 过期时间合理（≤24 小时）
- [ ] Refresh Token 机制
- [ ] 登录失败次数限制
- [ ] 双因素认证（如适用）

### 授权检查
- [ ] 每个端点都有授权检查
- [ ] RBAC (Role-Based Access Control)
- [ ] 资源所有权验证
- [ ] 最小权限原则

### Session 管理
- [ ] Session ID 足够随机
- [ ] Session 过期机制
- [ ] 注销清除 Session
- [ ] Secure Cookie 标记

---

## 🛡️ 数据保护

### 敏感数据加密
- [ ] 传输加密（HTTPS/TLS）
- [ ] 存储加密（AES-256-GCM）
- [ ] 使用 KeyManagementService
- [ ] 密钥定期轮换

### 数据脱敏
- [ ] 日志中无密码/Token
- [ ] 日志中无个人信息
- [ ] 错误消息不泄露信息
- [ ] 使用 LoggerSanitizer

### 数据完整性
- [ ] 使用 HMAC 验证
- [ ] 恒定时间比较（timingSafeEqual）
- [ ] 防篡改机制

---

## 🚨 错误处理与日志

### 错误处理
- [ ] 统一错误处理（ErrorHandler）
- [ ] 错误信息不泄露内部细节
- [ ] 使用错误代码而非详细消息
- [ ] 记录详细错误到日志

### 日志安全
- [ ] 日志脱敏（LoggerSanitizer）
- [ ] 日志访问控制
- [ ] 日志完整性保护
- [ ] 定期日志审查

---

## ⚡ 拒绝服务防护

### 速率限制
- [ ] API 速率限制（100 req/min）
- [ ] 登录速率限制（5 次/5min）
- [ ] 文件上传大小限制
- [ ] 请求超时设置

### 资源限制
- [ ] 内存使用限制
- [ ] CPU 使用限制
- [ ] 并发连接数限制
- [ ] 文件描述符限制

---

## 🔍 依赖与配置安全

### 依赖管理
- [ ] 定期运行 `bun audit`
- [ ] 无已知高危漏洞
- [ ] 依赖版本锁定
- [ ] 使用可信来源

### 配置安全
- [ ] 无硬编码密钥
- [ ] 使用环境变量
- [ ] 配置文件权限（600）
- [ ] 生产配置独立

---

## 📋 代码审查安全检查

- [ ] 使用 ESLint 安全插件
- [ ] 静态代码分析（Snyk）
- [ ] 人工安全审查
- [ ] 定期渗透测试

---

## 🔗 相关资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [安全编码规范](../../docs/SECURITY_GUIDELINES.md)
- [KeyManagementService](../../src/infrastructure/security/KeyManagementService.ts)

---

**维护者：** 安全组
**审核周期：** 每月
