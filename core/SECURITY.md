# Security Policy

## Supported Versions

| Version | Supported          | Release Date | Support Until |
|---------|--------------------|--------------|--------------|
| 2.4.x   | :white_check_mark: | 2026-02-17   | 2026-08-17   |
| 2.3.x   | :white_check_mark: | 2026-02-06   | 2026-08-06   |
| 2.2.x   | :white_check_mark: | 2026-02-05   | 2026-08-05   |
| 2.1.x   | :white_check_mark: | 2026-02-04   | 2026-08-04   |
| 2.0.x   | :white_check_mark: | 2026-02-03   | 2026-08-03   |
| < 2.0   | :x:                | -            | -            |

---

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please **DO NOT** open a public issue.

### Private Disclosure Process

#### Step 1: Email Us

Send an email to: **security@prism-gateway.org**

Include the following information:
- Description of the vulnerability
- Steps to reproduce (minimal reproducible example)
- Potential impact
- Suggested fix (if any)
- Your name/handle for credit (optional)

#### Step 2: Acknowledgment

We will respond within **48 hours** to:
- Acknowledge receipt of your report
- Confirm we are investigating
- Provide an estimated timeline for fix

#### Step 3: Investigation

We will investigate the issue and determine:
- Severity level (Critical/High/Medium/Low)
- Affected versions
- Potential impact
- Fix approach

#### Step 4: Resolution Timeline

| Severity | Response Time | Fix Timeline |
|----------|---------------|--------------|
| **Critical** | 12 hours | Within 7 days |
| **High** | 24 hours | Within 14 days |
| **Medium** | 48 hours | Within 30 days |
| **Low** | 1 week | Next release |

#### Step 5: Disclosure

- We will coordinate public disclosure with you
- Credit will be given to the reporter (with permission)
- Security advisory will be published
- CVE will be requested if applicable

---

## Security Best Practices

### For Developers

#### Input Validation

All API endpoints must validate input using Zod schemas:

```typescript
import { z } from 'zod';

export const CreateRecordSchema = z.object({
  type: z.enum(['custom', 'scheduled', 'adhoc']),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  config: z.object({
    metrics: z.array(z.string()).optional()
  }).optional()
});
```

**Protection against:**
- SQL Injection
- NoSQL Injection
- XSS (Cross-Site Scripting)
- Path Traversal
- Parameter Pollution
- Prototype Pollution

#### Authentication

- Use JWT tokens with secure signing
- Implement token expiration and refresh
- Use timing-safe string comparison for tokens

```typescript
import { timingSafeEqual } from './security/timingSafe.js';

// Always use timing-safe comparison for tokens
if (timingSafeEqual(providedToken, storedToken)) {
  // Token is valid
}
```

#### Authorization

- Verify permissions before every protected operation
- Implement principle of least privilege
- Use role-based access control (RBAC)

#### Cryptography

- Use KeyManagementService for key management
- Never hardcode secrets
- Rotate keys regularly
- Use environment variables for configuration

```typescript
// Correct: Use KeyManagementService
const key = await keyManagementService.getCurrentKey();

// Incorrect: Never hardcode keys
const key = 'hardcoded-secret-key'; // NEVER DO THIS
```

#### Dependencies

- Regularly audit dependencies
- Keep dependencies up to date
- Review security advisories
- Use Dependabot for automated updates

### For Users

#### Deployment

- Use HTTPS in production
- Configure CORS properly
- Enable rate limiting
- Use strong passwords for JWT secrets
- Keep dependencies updated

#### Configuration

```bash
# .env.example
JWT_SECRET=your-secure-random-secret-at-least-32-characters
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

#### Monitoring

- Monitor access logs
- Set up alerts for suspicious activity
- Track failed authentication attempts
- Monitor API error rates

---

## Security Features

### Input Validation

- **All API endpoints** validated with Zod schemas
- **Protection against:**
  - Injection attacks (SQL, NoSQL, XSS)
  - Path traversal
  - Parameter pollution
  - Prototype pollution

### Authentication

- **JWT tokens** with secure signing
- **Token expiration** and refresh
- **Timing-safe** string comparison
- **Secure key management** via KeyManagementService

### Rate Limiting

- **IP-based** rate limiting
- **User-based** rate limiting
- **Endpoint-specific** limits
- **Sliding window** algorithm

### CORS

- **Strict origin** validation
- **Configurable** allowlist
- **Reduced** preflight cache time

---

## Security Audits

### Past Audits

| Date | Type | Findings | Status |
|------|------|----------|--------|
| 2026-02-07 | P0 Threat Fix | 3 issues fixed | :white_check_mark: Complete |
| 2026-02-06 | Input Validation | 8 endpoints hardened | :white_check_mark: Complete |
| 2026-02-05 | CORS Review | Configuration optimized | :white_check_mark: Complete |

### Fixed Vulnerabilities

#### SEC-001: Timing Attack Vulnerability (2026-02-07)

**Severity:** High

**Description:** Token comparison was vulnerable to timing attacks.

**Fix:** Implemented `timingSafeEqual()` function using Node.js `crypto.timingSafeEqual()`.

#### SEC-002: Missing Input Validation (2026-02-06)

**Severity:** Critical

**Description:** Several API endpoints lacked input validation.

**Fix:** Added Zod schema validation to all API endpoints.

#### SEC-003: CORS Misconfiguration (2026-02-05)

**Severity:** Medium

**Description:** CORS configuration was too permissive.

**Fix:** Implemented strict origin validation with allowlist.

### Future Audits

- **Next scheduled audit:** 2026-04-01 (Quarterly)
- **Tools:** npm audit, OWASP ZAP, Snyk

---

## Dependency Security

### Automated Scanning

We use the following tools for automated dependency scanning:

- **Dependabot:** Automated PRs for security updates
- **npm audit:** Weekly vulnerability scans
- **Snyk:** Continuous monitoring

### Response Process

1. **Detection** - Automatic detection by scanning tools
2. **Triage** - Security team assesses severity
3. **Patch** - Fix within SLA based on severity
4. **Release** - Security update published
5. **Notification** - Users notified via advisory

### Reporting Dependency Issues

If you discover a vulnerability in a dependency:
1. Check if it's already reported (check GitHub security advisories)
2. Report following the [Private Disclosure Process](#private-disclosure-process)
3. Include affected package name and version

---

## Security Contact

- **Email:** security@prism-gateway.org
- **PGP Key:** Available at https://prism-gateway.org/pgp-key
- **Response Time:** 48 hours

### Encryption

For sensitive communications, please encrypt your message using our PGP key:

```
-----BEGIN PGP PUBLIC KEY BLOCK-----

[PGP key would be here]

-----END PGP PUBLIC KEY BLOCK-----
```

---

## Security Policy Updates

This policy is reviewed quarterly. The next review is scheduled for **2026-05-07**.

### Change History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-07 | 1.0.0 | Initial security policy |

---

## Related Resources

- [GitHub Security](https://github.com/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [CVE Database](https://cve.mitre.org/)

---

**Maintained by:** PRISM-Gateway Security Team
**Last Updated:** 2026-02-07
**License:** MIT
