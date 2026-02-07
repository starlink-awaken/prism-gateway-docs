# Authentication & Authorization Guide

> **Version:** 2.4.0
> **Last Updated:** 2026-02-07
> **Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Authentication (JWT)](#authentication-jwt)
4. [Authorization (RBAC)](#authorization-rbac)
5. [API Usage Examples](#api-usage-examples)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

PRISM-Gateway uses a **two-layer security model**:

1. **Authentication Layer**: JWT-based token authentication
2. **Authorization Layer**: Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────┐
│                   Request Flow                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Client Request + JWT Token                      │
│           ↓                                          │
│  2. JWT Middleware → Verify Token                   │
│           ↓                                          │
│  3. RBAC Middleware → Check Permissions             │
│           ↓                                          │
│  4. Route Handler → Process Request                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Key Features

- ✅ **JWT Tokens**: HS256 signature, configurable TTL
- ✅ **Token Refresh**: Automatic refresh mechanism
- ✅ **Token Revocation**: Blacklist support via TokenCache
- ✅ **Role-Based Access**: 4 predefined roles with granular permissions
- ✅ **Resource Protection**: 6 resource types with 5 action types
- ✅ **Security Hardened**: Timing attack prevention, rate limiting ready

---

## Quick Start

### 1. Basic Setup

```typescript
import { Hono } from 'hono';
import { JWTService } from './api/auth/JWTService.js';
import { jwtMiddleware } from './api/auth/middleware/jwtMiddleware.js';
import { rbacMiddleware } from './api/auth/rbac/middleware.js';
import { Resource, Action } from './api/auth/rbac/types.js';

const app = new Hono();

// Initialize JWT service
const jwtService = new JWTService({
  secret: process.env.JWT_SECRET!,
  accessTokenTTL: 3600,        // 1 hour
  refreshTokenTTL: 604800,      // 7 days
  issuer: 'prism-gateway',
  audience: 'prism-gateway-api'
});

// Protect routes with authentication
app.use('/api/*', jwtMiddleware({ jwtService }));

// Protect routes with authorization
app.get('/api/analytics',
  jwtMiddleware({ jwtService }),
  rbacMiddleware({
    rbacService: defaultRBACService,
    resource: Resource.ANALYTICS,
    action: Action.READ
  }),
  (c) => {
    // Only users with READ permission on ANALYTICS can access
    return c.json({ data: 'analytics data' });
  }
);
```

### 2. Login Example

```typescript
// Login endpoint
app.post('/api/v1/auth/login', async (c) => {
  const { username, password } = await c.req.json();

  // Verify credentials (implement your user service)
  const user = await userService.findByUsername(username);
  if (!user || !await userService.verifyPassword(password, user.passwordHash)) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Generate tokens with role
  const tokens = jwtService.generateTokens({
    sub: user.id,
    username: user.username,
    role: user.role // e.g., 'admin', 'user', 'viewer', 'guest'
  });

  return c.json({
    success: true,
    data: tokens
  });
});
```

### 3. Protected Route Example

```typescript
// Admin-only route
app.delete('/api/v1/users/:id',
  jwtMiddleware({ jwtService }),
  requireAdmin(defaultRBACService),
  async (c) => {
    const userId = c.req.param('id');
    await userService.deleteUser(userId);
    return c.json({ success: true });
  }
);

// User-specific route
app.get('/api/v1/analytics/dashboard',
  jwtMiddleware({ jwtService }),
  rbacMiddleware({
    rbacService: defaultRBACService,
    resource: Resource.ANALYTICS,
    action: Action.READ
  }),
  (c) => {
    const user = getAuthUser(c);
    return c.json({ dashboard: 'data', user: user?.username });
  }
);
```

---

## Authentication (JWT)

### JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user123",
    "username": "alice",
    "role": "user",
    "type": "access",
    "iat": 1707300000,
    "exp": 1707303600,
    "jti": "jti_1707300000_1_abc123",
    "iss": "prism-gateway",
    "aud": "prism-gateway-api"
  },
  "signature": "..."
}
```

### Token Types

| Type | TTL | Purpose | Refresh |
|------|-----|---------|---------|
| **Access Token** | 1 hour | API access | ❌ No |
| **Refresh Token** | 7 days | Token renewal | ✅ Yes |

### Token Lifecycle

```
┌────────────────────────────────────────────────────┐
│              Token Lifecycle                        │
├────────────────────────────────────────────────────┤
│                                                     │
│  Login → Generate Tokens → Use Access Token       │
│            ↓                     ↓                  │
│       Store Refresh          Access Expired?      │
│            ↓                     ↓                  │
│       Use Refresh  ←─────  Refresh Access         │
│            ↓                     ↓                  │
│       Get New Pair  ─────→  Continue Using        │
│            ↓                     ↓                  │
│       Logout → Revoke → Blacklist                 │
│                                                     │
└────────────────────────────────────────────────────┘
```

### Authentication API

#### POST /api/v1/auth/login

Login with credentials.

**Request:**
```json
{
  "username": "alice",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "tokenType": "Bearer",
    "expiresIn": 3600
  },
  "meta": {
    "timestamp": "2026-02-07T10:30:00Z",
    "version": "2.0.0"
  }
}
```

#### POST /api/v1/auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "tokenType": "Bearer",
    "expiresIn": 3600
  }
}
```

#### GET /api/v1/auth/me

Get current user information.

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sub": "user123",
    "username": "alice",
    "jti": "jti_..."
  }
}
```

#### POST /api/v1/auth/logout

Logout current user (revokes tokens).

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out",
    "instruction": "Please discard your tokens"
  }
}
```

### Token Revocation

```typescript
import { TokenCache } from './infrastructure/cache/TokenCache.js';

const tokenCache = new TokenCache();

// Add token to blacklist
const payload = jwtService.decodeToken(token);
if (payload) {
  tokenCache.addToBlacklist(payload.jti, payload.exp);
}

// Check if token is blacklisted
if (tokenCache.isBlacklisted(payload.jti)) {
  return c.json({ error: 'Token has been revoked' }, 401);
}
```

---

## Authorization (RBAC)

### Role Hierarchy

```
┌───────────────────────────────────────────────────┐
│              Role Hierarchy                        │
├───────────────────────────────────────────────────┤
│                                                    │
│  ADMIN     ────→  Full Access (All Resources)    │
│    ↓                                               │
│  USER      ────→  Standard Access                 │
│    ↓             (Gateway Read/Execute,           │
│  VIEWER    ────→  Retrospective CRUD,             │
│    ↓             Analytics Read)                   │
│  GUEST     ────→  Read-Only (Limited)             │
│                                                    │
└───────────────────────────────────────────────────┘
```

### Permission Matrix

| Role | Gateway | Retrospective | Analytics | Users | Settings | API Keys |
|------|---------|---------------|-----------|-------|----------|----------|
| **ADMIN** | CRUD+E | CRUD+E | CRUD | CRUD | CRUD | CRUD |
| **USER** | R+E | CRUD+E | R | R | ❌ | CRD |
| **VIEWER** | R | R | R | R | ❌ | ❌ |
| **GUEST** | R | R | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- **C** = CREATE
- **R** = READ
- **U** = UPDATE
- **D** = DELETE
- **E** = EXECUTE

### Resources

```typescript
enum Resource {
  GATEWAY = 'gateway',           // Gateway checks
  RETROSPECTIVE = 'retrospective', // Retrospectives
  ANALYTICS = 'analytics',         // Analytics data
  USERS = 'users',                 // User management
  SETTINGS = 'settings',           // System settings
  API_KEYS = 'api_keys'            // API key management
}
```

### Actions

```typescript
enum Action {
  CREATE = 'create',   // Create new resource
  READ = 'read',       // Read/view resource
  UPDATE = 'update',   // Update existing resource
  DELETE = 'delete',   // Delete resource
  EXECUTE = 'execute'  // Execute/run resource
}
```

### RBAC Middleware

#### Basic Usage

```typescript
import { rbacMiddleware } from './api/auth/rbac/middleware.js';
import { defaultRBACService } from './api/auth/rbac/RBACService.js';
import { Resource, Action } from './api/auth/rbac/types.js';

// Protect single endpoint
app.get('/api/v1/analytics',
  jwtMiddleware({ jwtService }),
  rbacMiddleware({
    rbacService: defaultRBACService,
    resource: Resource.ANALYTICS,
    action: Action.READ
  }),
  (c) => c.json({ data: 'analytics' })
);
```

#### Flexible RBAC (OR Logic)

```typescript
import { flexibleRBACMiddleware } from './api/auth/rbac/middleware.js';

// Allow if user has EITHER permission
app.get('/api/v1/dashboard',
  jwtMiddleware({ jwtService }),
  flexibleRBACMiddleware(defaultRBACService, [
    { resource: Resource.ANALYTICS, action: Action.READ },
    { resource: Resource.RETROSPECTIVE, action: Action.READ }
  ]),
  (c) => c.json({ dashboard: 'data' })
);
```

#### Admin-Only Routes

```typescript
import { requireAdmin } from './api/auth/rbac/middleware.js';

// Only admins can access
app.delete('/api/v1/users/:id',
  jwtMiddleware({ jwtService }),
  requireAdmin(defaultRBACService),
  (c) => {
    // Admin-only logic
  }
);
```

### Programmatic Authorization

```typescript
import { RBACService } from './api/auth/rbac/RBACService.js';
import { Role, Resource, Action } from './api/auth/rbac/types.js';

const rbacService = new RBACService();

// Check if user can perform action
const user = { sub: 'user1', username: 'alice', role: Role.USER, jti: 'jti123' };
const result = rbacService.authorize(user, Resource.ANALYTICS, Action.READ);

if (result.granted) {
  // User has permission
} else {
  // User lacks permission
  console.log(result.reason);
}

// Simple permission check
if (rbacService.can(user, Resource.ANALYTICS, Action.DELETE)) {
  // User can delete analytics
}

// Get all allowed actions for user on resource
const actions = rbacService.getAllowedActions(user, Resource.ANALYTICS);
// ['read']

// List all roles
const roles = rbacService.listRoles();
roles.forEach(r => console.log(`${r.displayName}: ${r.description}`));
```

---

## API Usage Examples

### Example 1: User Registration & Login Flow

```typescript
// 1. Register new user
const registerResponse = await fetch('http://localhost:3000/api/v1/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'alice',
    email: 'alice@example.com',
    password: 'SecurePass123!'
  })
});

// 2. Login
const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'alice',
    password: 'SecurePass123!'
  })
});

const { accessToken, refreshToken } = (await loginResponse.json()).data;

// 3. Access protected resource
const analyticsResponse = await fetch('http://localhost:3000/api/v1/analytics', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### Example 2: Token Refresh Flow

```typescript
async function fetchWithTokenRefresh(url: string, options: RequestInit = {}) {
  let accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  // Try request with current access token
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  // If 401, try refreshing token
  if (response.status === 401) {
    const refreshResponse = await fetch('http://localhost:3000/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (refreshResponse.ok) {
      const { accessToken: newAccessToken } = (await refreshResponse.json()).data;
      localStorage.setItem('accessToken', newAccessToken);

      // Retry original request with new token
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newAccessToken}`
        }
      });
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login';
    }
  }

  return response;
}

// Usage
const data = await fetchWithTokenRefresh('http://localhost:3000/api/v1/analytics');
```

### Example 3: Admin Panel Access

```typescript
async function checkAdminAccess() {
  const token = localStorage.getItem('accessToken');

  // Decode token to check role (client-side, for UI purposes only)
  const payload = JSON.parse(atob(token.split('.')[1]));

  if (payload.role !== 'admin') {
    alert('Admin access required');
    return false;
  }

  // Try accessing admin endpoint (server validates)
  const response = await fetch('http://localhost:3000/api/v1/admin/settings', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 403) {
    alert('Insufficient permissions');
    return false;
  }

  return true;
}
```

---

## Security Best Practices

### 1. Token Storage

✅ **Recommended:**
- Store tokens in memory (for SPAs)
- Use `httpOnly` cookies (for SSR)
- Use secure storage APIs (iOS Keychain, Android Keystore)

❌ **Avoid:**
- LocalStorage (XSS vulnerable)
- SessionStorage (same as LocalStorage)
- Plain cookies without `httpOnly` flag

### 2. Token Security

```typescript
// ✅ GOOD: Secure JWT configuration
const jwtService = new JWTService({
  secret: process.env.JWT_SECRET!, // At least 32 characters
  accessTokenTTL: 3600,             // Short-lived access tokens
  refreshTokenTTL: 604800,          // Longer-lived refresh tokens
  issuer: 'prism-gateway',
  audience: 'prism-gateway-api'
});

// ❌ BAD: Weak configuration
const jwtService = new JWTService({
  secret: 'weak-secret',     // Too short
  accessTokenTTL: 86400,     // 24 hours (too long)
  refreshTokenTTL: 31536000, // 1 year (way too long)
  issuer: '',                // Empty issuer
  audience: ''               // Empty audience
});
```

### 3. RBAC Best Practices

```typescript
// ✅ GOOD: Layered protection
app.delete('/api/v1/users/:id',
  jwtMiddleware({ jwtService }),     // Authentication layer
  requireAdmin(rbacService),         // Authorization layer
  validateInput(UserIdSchema),        // Input validation layer
  async (c) => {
    // Business logic
  }
);

// ❌ BAD: Single layer of protection
app.delete('/api/v1/users/:id', async (c) => {
  // No authentication or authorization
  await userService.deleteUser(c.req.param('id'));
});
```

### 4. Rate Limiting (Coming Soon)

```typescript
// Future implementation
app.post('/api/v1/auth/login',
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5                      // 5 attempts
  }),
  async (c) => {
    // Login logic
  }
);
```

### 5. HTTPS Only

```
Production environments MUST use HTTPS.
Tokens transmitted over HTTP are vulnerable to interception.
```

---

## Troubleshooting

### Common Errors

#### ERR_2001: Authentication Failed

**Symptom:**
```json
{
  "success": false,
  "error": {
    "code": "ERR_2001",
    "message": "Authentication required"
  }
}
```

**Solutions:**
1. Check if `Authorization` header is present
2. Verify token format: `Bearer <token>`
3. Check if token is expired
4. Verify JWT secret matches

#### ERR_2002: Authorization Failed

**Symptom:**
```json
{
  "success": false,
  "error": {
    "code": "ERR_2002",
    "message": "Insufficient permissions",
    "details": {
      "reason": "Role 'user' cannot perform 'delete' on 'analytics'",
      "userRole": "user",
      "required": {
        "resource": "analytics",
        "action": "delete"
      }
    }
  }
}
```

**Solutions:**
1. Check user's role in JWT payload
2. Verify role has required permission
3. Contact admin to upgrade role if needed

#### Token Expired

**Symptom:**
```json
{
  "success": false,
  "error": "Token has expired"
}
```

**Solution:**
Use refresh token to get new access token:
```typescript
const response = await fetch('/api/v1/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
});
```

#### Token Revoked

**Symptom:**
```json
{
  "valid": false,
  "error": "Token has been revoked"
}
```

**Solution:**
User was logged out. Redirect to login page.

### Debugging Tips

#### 1. Decode JWT Token (Client-Side)

```typescript
function decodeJWT(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token Payload:', payload);
    console.log('Role:', payload.role);
    console.log('Expires:', new Date(payload.exp * 1000));
    return payload;
  } catch (error) {
    console.error('Invalid token format');
    return null;
  }
}
```

#### 2. Check Token Expiry

```typescript
function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}
```

#### 3. Test Permissions

```typescript
const rbacService = new RBACService();
const user = { sub: 'user1', username: 'alice', role: 'user', jti: 'jti123' };

// Test specific permission
const result = rbacService.authorize(user, Resource.ANALYTICS, Action.DELETE);
console.log('Can delete analytics?', result.granted);
console.log('Reason:', result.reason);

// Get all allowed actions
const actions = rbacService.getAllowedActions(user, Resource.ANALYTICS);
console.log('Allowed actions on analytics:', actions);
```

---

## Migration Guide

### From Phase 1 to Phase 2

If you're upgrading from a previous version without RBAC:

1. **Update JWT Payload:**
```typescript
// Old
const tokens = jwtService.generateTokens({
  sub: user.id,
  username: user.username
});

// New (add role)
const tokens = jwtService.generateTokens({
  sub: user.id,
  username: user.username,
  role: user.role || 'user' // Default to 'user' role
});
```

2. **Add RBAC Middleware:**
```typescript
// Old
app.get('/api/analytics', jwtMiddleware({ jwtService }), handler);

// New (add RBAC)
app.get('/api/analytics',
  jwtMiddleware({ jwtService }),
  rbacMiddleware({
    rbacService: defaultRBACService,
    resource: Resource.ANALYTICS,
    action: Action.READ
  }),
  handler
);
```

3. **Update User Schema:**
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user' | 'viewer' | 'guest'; // Add this field
  createdAt: Date;
  updatedAt: Date;
}
```

---

## API Reference

For complete API documentation, see:
- [JWT Service API](../api/JWTService.md)
- [RBAC Service API](../api/RBACService.md)
- [Auth Middleware API](../api/AuthMiddleware.md)

---

## Support

- **Documentation:** https://github.com/starlink-awaken/prism-gateway-docs
- **Issues:** https://github.com/starlink-awaken/prism-gateway/issues
- **Security:** security@prism-gateway.io

---

**Last Updated:** 2026-02-07
**Version:** 2.4.0
**Authors:** PRISM-Gateway Security Team
