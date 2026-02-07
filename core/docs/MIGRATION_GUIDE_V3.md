# Migration Guide: v2.x → v3.0

> Complete guide for upgrading PRISM-Gateway from version 2.x to 3.0

**Target Versions**: 2.0.x - 2.4.x → 3.0.0
**Migration Time**: 30-60 minutes
**Downtime**: Optional (zero-downtime upgrade possible)
**Rollback Time**: 5-10 minutes

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Breaking Changes](#breaking-changes)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Configuration Migration](#configuration-migration)
6. [API Client Updates](#api-client-updates)
7. [Testing the Migration](#testing-the-migration)
8. [Rollback Procedure](#rollback-procedure)
9. [Post-Migration Tasks](#post-migration-tasks)
10. [FAQ](#faq)

---

## 🎯 Overview

### What's New in v3.0?

PRISM-Gateway v3.0 introduces production-grade operational infrastructure:

**Major Features**:
- 🔐 **Security Layer**: JWT + RBAC authentication, rate limiting
- 💾 **Backup System**: Full/incremental backups with scheduling
- 🏥 **Health Monitoring**: 7 system checkers with self-healing
- 📈 **Metrics Collection**: 6 collectors with 4-level time-series storage
- 🚨 **Alerting System**: Smart rules with 5 notification channels
- 🌐 **Web UI**: React 18 dashboard with real-time updates

**Statistics**:
- 9,210+ lines of code added
- 624+ tests (>90% coverage)
- 36 API endpoints (32 new)
- 650KB documentation

### Migration Impact

| Aspect | Impact Level | Action Required |
|--------|--------------|-----------------|
| **Data Files** | 🟢 None | No migration needed |
| **Configuration** | 🟡 Medium | Update config structure |
| **Environment Variables** | 🟡 Medium | Add JWT_SECRET (required) |
| **API Clients** | 🔴 High | Add authentication |
| **CLI Usage** | 🟢 Low | Compatible (new commands) |
| **Dependencies** | 🟢 None | No new dependencies |

### Compatibility

- ✅ **Data Files**: 100% backward compatible
- ✅ **CLI Commands**: All v2.x commands work in v3.0
- ⚠️ **API Endpoints**: Require authentication (breaking)
- ⚠️ **Configuration**: New structure (breaking)

---

## ✅ Pre-Migration Checklist

Before starting migration, complete these steps:

### 1. Backup Current Installation

```bash
# Backup data directory
cp -r ~/.prism-gateway ~/.prism-gateway.backup.$(date +%Y%m%d_%H%M%S)

# Backup configuration
cp config.json config.json.backup

# Verify backup
ls -lah ~/.prism-gateway.backup.*
```

### 2. Document Current State

```bash
# Record current version
prism --version > migration-notes.txt

# Export current configuration
cat config.json >> migration-notes.txt

# List installed packages
bun pm ls >> migration-notes.txt

# Check for running processes
ps aux | grep prism >> migration-notes.txt
```

### 3. Review System Requirements

**Minimum Requirements** (v3.0):
- Bun >= 1.0
- Node.js >= 18 (optional)
- RAM: 512MB (2GB recommended)
- Disk: 100MB installation + 1GB data

**Check current system**:
```bash
# Check Bun version
bun --version

# Check available RAM
free -h

# Check available disk space
df -h ~/.prism-gateway
```

### 4. Read Release Notes

- Review [CHANGELOG.md](../CHANGELOG.md#300---2026-02-07)
- Check [Breaking Changes](#breaking-changes)
- Understand [New Features](../README.md#-phase-3-operational-capabilities-v30-new)

### 5. Plan Downtime (if needed)

**Zero-Downtime Option**: Run v3.0 on different port, test, then switch
**Planned Downtime**: 15-30 minutes recommended for small installations

---

## 🚨 Breaking Changes

### 1. Configuration Structure

**Breaking**: Configuration file structure has changed significantly.

#### v2.x Configuration:
```json
{
  "port": 3000,
  "host": "localhost",
  "logLevel": "info",
  "dataDir": "~/.prism-gateway"
}
```

#### v3.0 Configuration:
```json
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "cors": {
      "enabled": true,
      "allowedOrigins": ["http://localhost:3000"]
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  },
  "data": {
    "directory": "~/.prism-gateway"
  },
  "security": {
    "jwt": {
      "secret": "${JWT_SECRET}",
      "expiresIn": "24h"
    },
    "rbac": {
      "enabled": true
    }
  }
}
```

**Action Required**: Restructure configuration file using migration tool or manually.

---

### 2. API Authentication

**Breaking**: All API endpoints now require JWT authentication.

#### v2.x API Calls (No Auth):
```bash
curl http://localhost:3000/api/v1/analytics/records
```

#### v3.0 API Calls (JWT Required):
```bash
# 1. Obtain token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# 2. Use token in requests
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/analytics/records
```

**Action Required**: Update all API clients to include JWT token in `Authorization` header.

---

### 3. Environment Variables

**Breaking**: `JWT_SECRET` environment variable is now **required**.

#### v2.x Environment:
```bash
# Optional
NODE_ENV=development
LOG_LEVEL=info
```

#### v3.0 Environment (Minimum):
```bash
# REQUIRED
JWT_SECRET=your-secret-key-minimum-32-characters-required

# Optional
NODE_ENV=development
LOG_LEVEL=info
RBAC_ENABLED=true
RATE_LIMIT_API=100
```

**Action Required**: Generate and set `JWT_SECRET` in `.env` file.

---

### 4. Rate Limiting

**Breaking**: API endpoints are now rate-limited by default.

**Limits** (configurable):
- API endpoints: 100 requests/minute per IP
- WebSocket connections: 5 connections/minute per IP
- WebSocket messages: 100 messages/minute per connection

**Response**: HTTP 429 (Too Many Requests) when limit exceeded

**Action Required**:
- Update client code to handle 429 responses
- Configure rate limits if defaults don't fit your use case
- Implement retry logic with exponential backoff

---

### 5. CORS Configuration

**Breaking**: CORS is now restricted to allowlist by default.

#### v2.x (Permissive):
```javascript
// All origins allowed
Access-Control-Allow-Origin: *
```

#### v3.0 (Restricted):
```javascript
// Only allowlisted origins
Access-Control-Allow-Origin: http://localhost:3000
```

**Action Required**: Add your frontend URLs to `cors.allowedOrigins` in config.

---

## 📝 Step-by-Step Migration

### Phase 1: Preparation (10 minutes)

#### Step 1.1: Stop Current Services

```bash
# Find running PRISM-Gateway processes
ps aux | grep prism

# Stop API server
pkill -f "prism.*api"

# Verify stopped
ps aux | grep prism
```

#### Step 1.2: Backup Everything

```bash
# Create backup directory
mkdir -p ~/prism-migration-backup

# Backup data directory
cp -r ~/.prism-gateway ~/prism-migration-backup/data

# Backup configuration
cp config.json ~/prism-migration-backup/
cp .env ~/prism-migration-backup/ 2>/dev/null || true

# Backup current installation
cp -r prism-gateway ~/prism-migration-backup/codebase
```

#### Step 1.3: Update Repository

```bash
cd prism-gateway

# Fetch latest changes
git fetch origin

# Check current version
git describe --tags

# View available versions
git tag -l

# Checkout v3.0.0
git checkout v3.0.0

# Verify version
cat package.json | grep version
```

---

### Phase 2: Environment Configuration (5 minutes)

#### Step 2.1: Generate JWT Secret

```bash
# Generate secure JWT secret (32+ characters)
openssl rand -base64 32

# Or use Bun
bun -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Save to .env file
cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
LOG_LEVEL=info
RBAC_ENABLED=true
RATE_LIMIT_API=100
BACKUP_ENABLED=true
HEALTH_ENABLED=true
METRICS_ENABLED=true
ALERTING_ENABLED=true
EOF
```

#### Step 2.2: Verify Environment

```bash
# Check .env file
cat .env

# Verify JWT secret length (should be 40+ chars)
echo $JWT_SECRET | wc -c

# Validate environment
bun run prism config validate
```

---

### Phase 3: Configuration Migration (10 minutes)

#### Step 3.1: Automatic Migration (Recommended)

```bash
# Use built-in migration tool
bun run prism migrate config \
  --from=v2 \
  --to=v3 \
  --input=config.json.backup \
  --output=config.json \
  --dry-run

# Review changes
diff config.json.backup config.json

# Apply migration
bun run prism migrate config \
  --from=v2 \
  --to=v3 \
  --input=config.json.backup \
  --output=config.json
```

#### Step 3.2: Manual Migration (Alternative)

If automatic migration fails, manually update configuration:

```bash
# Create new config.json
cat > config.json << 'EOF'
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "cors": {
      "enabled": true,
      "allowedOrigins": [
        "http://localhost:3000",
        "https://your-domain.com"
      ],
      "credentials": true
    },
    "compression": {
      "enabled": true
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "destination": "file"
  },
  "data": {
    "directory": "~/.prism-gateway"
  },
  "security": {
    "jwt": {
      "secret": "${JWT_SECRET}",
      "algorithm": "HS256",
      "expiresIn": "24h",
      "rotation": {
        "enabled": true,
        "interval": "12h"
      }
    },
    "rbac": {
      "enabled": true,
      "defaultRole": "viewer"
    },
    "rateLimiting": {
      "enabled": true,
      "strategies": {
        "api": {
          "windowMs": 60000,
          "max": 100
        },
        "websocket": {
          "connections": {
            "windowMs": 60000,
            "max": 5
          },
          "messages": {
            "windowMs": 60000,
            "max": 100
          }
        }
      }
    }
  },
  "backup": {
    "enabled": true,
    "directory": "~/.prism-gateway/backups",
    "schedule": {
      "enabled": true,
      "cron": "0 2 * * *",
      "type": "incremental"
    },
    "retention": {
      "full": {
        "count": 7,
        "days": 30
      },
      "incremental": {
        "count": 30,
        "days": 90
      }
    },
    "compression": {
      "enabled": true,
      "level": 6
    }
  },
  "health": {
    "enabled": true,
    "interval": 60,
    "checkers": {
      "system": { "enabled": true },
      "disk": { "enabled": true },
      "api": { "enabled": true },
      "websocket": { "enabled": true },
      "data": { "enabled": true },
      "service": { "enabled": true },
      "network": { "enabled": true }
    },
    "thresholds": {
      "cpu": 80,
      "memory": 85,
      "disk": 90
    },
    "healing": {
      "enabled": true,
      "actions": {
        "restartService": true,
        "clearCache": true,
        "rotateLog": true
      }
    }
  },
  "metrics": {
    "enabled": true,
    "collectors": {
      "system": { "enabled": true, "interval": 60 },
      "api": { "enabled": true, "interval": 30 },
      "websocket": { "enabled": true, "interval": 60 },
      "gateway": { "enabled": true, "interval": 300 },
      "retrospective": { "enabled": true, "interval": 300 },
      "data": { "enabled": true, "interval": 600 }
    },
    "storage": {
      "directory": "~/.prism-gateway/metrics",
      "retention": {
        "raw": { "resolution": "1m", "duration": "24h" },
        "hourly": { "resolution": "1h", "duration": "7d" },
        "daily": { "resolution": "1d", "duration": "90d" },
        "monthly": { "resolution": "1M", "duration": "2y" }
      }
    }
  },
  "alerting": {
    "enabled": true,
    "channels": {
      "console": {
        "enabled": true
      },
      "file": {
        "enabled": true,
        "path": "~/.prism-gateway/alerts.log"
      },
      "webhook": {
        "enabled": false,
        "url": ""
      },
      "email": {
        "enabled": false,
        "smtp": {}
      },
      "slack": {
        "enabled": false,
        "webhookUrl": ""
      }
    },
    "rules": [
      {
        "name": "High CPU Usage",
        "condition": { "metric": "system_cpu_usage", "operator": "gt", "value": 80 },
        "window": "5m",
        "severity": "high",
        "enabled": true
      },
      {
        "name": "High Memory Usage",
        "condition": { "metric": "system_memory_usage", "operator": "gt", "value": 85 },
        "window": "5m",
        "severity": "high",
        "enabled": true
      },
      {
        "name": "Low Disk Space",
        "condition": { "metric": "disk_free_percent", "operator": "lt", "value": 10 },
        "window": "5m",
        "severity": "critical",
        "enabled": true
      }
    ]
  }
}
EOF
```

#### Step 3.3: Validate Configuration

```bash
# Validate new configuration
bun run prism config validate

# Test configuration loading
bun run prism config show

# Expected output: No errors, all sections present
```

---

### Phase 4: Update Dependencies (5 minutes)

```bash
# Install dependencies
bun install

# Verify installation
bun pm ls

# Run tests to ensure everything works
bun test
```

**Expected Output**:
```
✓ 624+ tests passing
✓ Coverage: >90%
✓ All dependencies installed successfully
```

---

### Phase 5: Data Migration (5 minutes)

**Good News**: No data migration required! v3.0 is fully backward compatible with v2.x data files.

**Verify data compatibility**:
```bash
# Check data directory structure
ls -lah ~/.prism-gateway/

# Verify data files are readable
bun run prism data verify

# Expected output: All data files valid
```

**Optional**: Create initial backup using new backup system:
```bash
# Create first full backup
bun run prism backup create --type=full --verify

# List backups
bun run prism backup list
```

---

### Phase 6: Start v3.0 Services (5 minutes)

#### Step 6.1: Start API Server

```bash
# Start in development mode (recommended for first start)
bun run api:dev

# Or start in production mode
# bun run api
```

**Expected Output**:
```
🚀 PRISM-Gateway v3.0.0
✓ Configuration loaded successfully
✓ JWT authentication enabled
✓ RBAC authorization enabled
✓ Rate limiting enabled
✓ API Server listening on http://0.0.0.0:3000
✓ WebSocket Server listening on ws://0.0.0.0:3001
✓ Health checks enabled (7 checkers)
✓ Metrics collection enabled (6 collectors)
✓ Alerting system enabled (3 rules)
✓ Backup system enabled (scheduled: daily 2:00 AM)
```

#### Step 6.2: Verify Services

```bash
# Health check
curl http://localhost:3000/health

# API status
curl http://localhost:3000/api/v1/status

# WebSocket connection (using wscat)
wscat -c ws://localhost:3001
```

---

### Phase 7: Test Authentication (10 minutes)

#### Step 7.1: Create Admin User

```bash
# Login with default credentials
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }' | jq

# Save token
export TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# Verify token
echo $TOKEN
```

#### Step 7.2: Test Authenticated Endpoints

```bash
# Get analytics dashboard
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/analytics/dashboard | jq

# List retrospectives
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/retrospectives | jq

# Get health status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/health/status | jq
```

#### Step 7.3: Test RBAC

```bash
# Create viewer user
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/auth/users \
  -d '{
    "username": "viewer1",
    "password": "viewer123",
    "role": "viewer"
  }' | jq

# Login as viewer
VIEWER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"viewer1","password":"viewer123"}' \
  | jq -r '.token')

# Test viewer permissions (should succeed: read)
curl -H "Authorization: Bearer $VIEWER_TOKEN" \
  http://localhost:3000/api/v1/analytics/dashboard | jq

# Test viewer permissions (should fail: write)
curl -X POST -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/backups \
  -d '{"type":"full"}' | jq
```

---

## 🔧 Configuration Migration

### Mapping v2.x → v3.0

| v2.x Config Key | v3.0 Config Key | Notes |
|-----------------|-----------------|-------|
| `port` | `server.port` | Nested under server |
| `host` | `server.host` | Nested under server |
| `logLevel` | `logging.level` | Renamed section |
| `dataDir` | `data.directory` | Nested under data |
| N/A | `security.*` | New section (required) |
| N/A | `backup.*` | New section (optional) |
| N/A | `health.*` | New section (optional) |
| N/A | `metrics.*` | New section (optional) |
| N/A | `alerting.*` | New section (optional) |

### Example Migration

**v2.x config.json**:
```json
{
  "port": 3000,
  "host": "localhost",
  "logLevel": "info",
  "dataDir": "~/.prism-gateway",
  "enableWebSocket": true,
  "corsOrigins": ["*"]
}
```

**Migrated to v3.0**:
```json
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "cors": {
      "enabled": true,
      "allowedOrigins": ["http://localhost:3000"]
    }
  },
  "logging": {
    "level": "info"
  },
  "data": {
    "directory": "~/.prism-gateway"
  },
  "security": {
    "jwt": {
      "secret": "${JWT_SECRET}",
      "expiresIn": "24h"
    },
    "rbac": {
      "enabled": true
    }
  }
}
```

---

## 🌐 API Client Updates

### JavaScript/TypeScript Clients

#### v2.x Client (No Auth):
```typescript
// Old client
async function getAnalytics() {
  const response = await fetch('http://localhost:3000/api/v1/analytics/dashboard');
  return response.json();
}
```

#### v3.0 Client (With Auth):
```typescript
// New client with authentication
class PrismGatewayClient {
  private token: string = '';

  async login(username: string, password: string): Promise<void> {
    const response = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    this.token = data.token;
  }

  async getAnalytics(): Promise<any> {
    const response = await fetch('http://localhost:3000/api/v1/analytics/dashboard', {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    if (response.status === 401) {
      throw new Error('Authentication required or token expired');
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Retry after: ' + response.headers.get('Retry-After'));
    }
    return response.json();
  }
}

// Usage
const client = new PrismGatewayClient();
await client.login('admin', 'admin123');
const analytics = await client.getAnalytics();
```

### Python Clients

#### v3.0 Python Client:
```python
import requests
from typing import Optional

class PrismGatewayClient:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.token: Optional[str] = None

    def login(self, username: str, password: str) -> None:
        response = requests.post(
            f"{self.base_url}/api/v1/auth/login",
            json={"username": username, "password": password}
        )
        response.raise_for_status()
        self.token = response.json()["token"]

    def _headers(self) -> dict:
        if not self.token:
            raise ValueError("Not authenticated. Call login() first.")
        return {"Authorization": f"Bearer {self.token}"}

    def get_analytics(self) -> dict:
        response = requests.get(
            f"{self.base_url}/api/v1/analytics/dashboard",
            headers=self._headers()
        )
        if response.status_code == 401:
            raise Exception("Authentication failed or token expired")
        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "60")
            raise Exception(f"Rate limit exceeded. Retry after {retry_after}s")
        response.raise_for_status()
        return response.json()

# Usage
client = PrismGatewayClient()
client.login("admin", "admin123")
analytics = client.get_analytics()
```

### cURL Scripts

#### Update Shell Scripts:
```bash
#!/bin/bash
# Old v2.x script
# curl http://localhost:3000/api/v1/analytics/dashboard

# New v3.0 script
BASE_URL="http://localhost:3000"

# 1. Login and get token
TOKEN=$(curl -s -X POST ${BASE_URL}/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# 2. Check if token was obtained
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "Failed to obtain authentication token"
  exit 1
fi

# 3. Use token in API calls
curl -H "Authorization: Bearer $TOKEN" \
  ${BASE_URL}/api/v1/analytics/dashboard | jq

# 4. Handle rate limiting
handle_rate_limit() {
  local response=$1
  local status=$(echo $response | jq -r '.statusCode')

  if [ "$status" == "429" ]; then
    local retry_after=$(echo $response | jq -r '.retryAfter')
    echo "Rate limit exceeded. Waiting ${retry_after}s..."
    sleep $retry_after
    return 1
  fi
  return 0
}
```

---

## 🧪 Testing the Migration

### Automated Test Suite

Create a test script to verify migration:

```bash
#!/bin/bash
# test-migration.sh

set -e

echo "=== PRISM-Gateway v3.0 Migration Test Suite ==="

# Test 1: Health Check
echo "Test 1: Health check..."
curl -f http://localhost:3000/health || { echo "FAIL: Health check"; exit 1; }
echo "✓ PASS"

# Test 2: Authentication
echo "Test 2: Authentication..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { echo "FAIL: Authentication"; exit 1; }
echo "✓ PASS"

# Test 3: Authenticated API Call
echo "Test 3: Authenticated API access..."
curl -f -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/analytics/dashboard > /dev/null || { echo "FAIL: API access"; exit 1; }
echo "✓ PASS"

# Test 4: Rate Limiting
echo "Test 4: Rate limiting..."
for i in {1..5}; do
  curl -s -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/v1/analytics/dashboard > /dev/null
done
echo "✓ PASS"

# Test 5: RBAC
echo "Test 5: RBAC permissions..."
curl -f -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/health/status > /dev/null || { echo "FAIL: RBAC"; exit 1; }
echo "✓ PASS"

# Test 6: WebSocket Connection
echo "Test 6: WebSocket connectivity..."
# Requires wscat: npm install -g wscat
timeout 5 wscat -c "ws://localhost:3001?token=$TOKEN" -x "ping" || { echo "FAIL: WebSocket"; exit 1; }
echo "✓ PASS"

# Test 7: Backup System
echo "Test 7: Backup system..."
bun run prism backup create --type=full --verify || { echo "FAIL: Backup"; exit 1; }
echo "✓ PASS"

# Test 8: Health Checks
echo "Test 8: Health check system..."
bun run prism health check --all | grep -q "healthy" || { echo "FAIL: Health checks"; exit 1; }
echo "✓ PASS"

# Test 9: Metrics Query
echo "Test 9: Metrics collection..."
sleep 65  # Wait for first metric collection
curl -f -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/metrics/query?metric=system_cpu_usage&start=-5m" > /dev/null || { echo "FAIL: Metrics"; exit 1; }
echo "✓ PASS"

# Test 10: Data Compatibility
echo "Test 10: v2.x data compatibility..."
bun run prism data verify || { echo "FAIL: Data compatibility"; exit 1; }
echo "✓ PASS"

echo ""
echo "=== All Tests Passed! ==="
echo "Migration to v3.0 successful ✓"
```

Run the test suite:
```bash
chmod +x test-migration.sh
./test-migration.sh
```

---

## ⏮️ Rollback Procedure

If you encounter issues, rollback to v2.x:

### Quick Rollback (5 minutes)

```bash
# 1. Stop v3.0 services
pkill -f "prism.*api"

# 2. Restore v2.x codebase
cd ~/prism-migration-backup/codebase
bun install

# 3. Restore v2.x configuration
cp ~/prism-migration-backup/config.json ./config.json
cp ~/prism-migration-backup/.env ./.env 2>/dev/null || true

# 4. Restore data (if modified)
rm -rf ~/.prism-gateway
cp -r ~/prism-migration-backup/data ~/.prism-gateway

# 5. Start v2.x services
bun run api

# 6. Verify v2.x is running
curl http://localhost:3000/health
prism --version
```

### Verify Rollback

```bash
# Check version
prism --version  # Should show 2.x

# Test API (no auth required in v2.x)
curl http://localhost:3000/api/v1/analytics/dashboard

# Test CLI
prism stats
```

---

## ✅ Post-Migration Tasks

After successful migration, complete these tasks:

### 1. Security Hardening

```bash
# Change default admin password
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/auth/users/admin/password \
  -d '{"oldPassword":"admin123","newPassword":"StrongP@ssw0rd!"}'

# Review and update JWT expiration
# Edit config.json: security.jwt.expiresIn

# Enable token rotation
# Edit config.json: security.jwt.rotation.enabled = true

# Review RBAC roles
bun run prism auth roles list
```

### 2. Configure Backup Automation

```bash
# Verify backup schedule
bun run prism backup schedule show

# Run test backup
bun run prism backup create --type=full --verify

# Configure retention policy
# Edit config.json: backup.retention
```

### 3. Set Up Monitoring

```bash
# Configure alerting channels
# Edit config.json: alerting.channels

# Test alert notification
bun run prism alerts test --channel=console

# Review and customize alert rules
# Edit config.json: alerting.rules

# Enable metrics collectors
bun run prism metrics collectors list
```

### 4. Update Documentation

```bash
# Document your configuration
cp config.json ~/docs/prism-gateway-config-v3.json

# Document environment variables
cp .env ~/docs/prism-gateway-env-v3.env

# Update runbooks with v3.0 commands
# Update monitoring dashboards
# Update alert responder guides
```

### 5. Update CI/CD Pipelines

If you have CI/CD pipelines, update them:

```yaml
# Example: GitHub Actions
- name: Set JWT Secret
  run: echo "JWT_SECRET=${{ secrets.JWT_SECRET }}" >> .env

- name: Run tests
  run: |
    bun install
    bun test

- name: Deploy
  run: |
    bun run prism config validate
    bun run api
```

### 6. Train Team Members

- Share [Quick Start Guide](./QUICK_START.md)
- Review [CLI Operations Guide](./CLI_OPERATIONS.md)
- Walkthrough [API Reference](./API_REFERENCE.md)
- Practice [Troubleshooting Guide](./troubleshooting/OPERATIONS_TROUBLESHOOTING.md)

---

## ❓ FAQ

### Q1: Do I need to migrate my data?

**A**: No. v3.0 is 100% backward compatible with v2.x data files. Your existing retrospectives, violations, and patterns will work without modification.

---

### Q2: Can I run v2.x and v3.0 simultaneously?

**A**: Yes! Run them on different ports for testing:

```bash
# Terminal 1: v2.x on port 3000
cd v2.x-directory
bun run api

# Terminal 2: v3.0 on port 4000
cd v3.0-directory
PORT=4000 bun run api
```

---

### Q3: What if I forget my JWT secret?

**A**: Regenerate and restart:

```bash
# Generate new secret
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env.new

# Update .env
mv .env .env.backup
mv .env.new .env

# Restart server (all existing tokens will be invalidated)
pkill -f "prism.*api"
bun run api
```

---

### Q4: How do I disable authentication for development?

**A**: Not recommended, but possible with environment variable:

```bash
# In .env
AUTH_DISABLED=true

# Start server
bun run api:dev
```

**Warning**: Only use in isolated development environments.

---

### Q5: Can I upgrade from v1.x directly to v3.0?

**A**: Yes, but recommended path is v1.x → v2.0 → v3.0. If directly upgrading:

1. First migrate to v2.0 structure
2. Then follow this guide for v2.x → v3.0
3. Test thoroughly after each step

---

### Q6: What if rate limiting is too strict?

**A**: Adjust in configuration:

```json
{
  "security": {
    "rateLimiting": {
      "api": {
        "windowMs": 60000,
        "max": 1000  // Increase from 100
      }
    }
  }
}
```

Or disable temporarily:
```bash
# In .env
RATE_LIMIT_ENABLED=false
```

---

### Q7: How do I export data before migration?

**A**: Use backup system:

```bash
# v2.x backup (if available)
prism backup create

# Or manual backup
tar -czf prism-backup-$(date +%Y%m%d).tar.gz ~/.prism-gateway/
```

---

### Q8: Can I use my existing CI/CD secrets?

**A**: Yes, but add JWT_SECRET:

```yaml
# Add to your secrets
JWT_SECRET: ${{ secrets.PRISM_JWT_SECRET }}

# Or generate during build
- run: echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

---

### Q9: What about Docker deployments?

**A**: Update Dockerfile environment:

```dockerfile
# Add JWT_SECRET as build arg or runtime env
ENV JWT_SECRET=${JWT_SECRET}

# Ensure it's set at runtime
CMD ["sh", "-c", "test -n \"$JWT_SECRET\" || exit 1; bun run api"]
```

---

### Q10: How do I monitor migration success?

**A**: Use health endpoints:

```bash
# Overall health
curl http://localhost:3000/health

# Detailed health (authenticated)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/health/status

# Check all systems
bun run prism health check --all --detailed
```

---

## 📞 Support

### Getting Help

**Documentation**:
- [Configuration Guide](./CONFIGURATION_GUIDE.md)
- [Troubleshooting Guide](./troubleshooting/OPERATIONS_TROUBLESHOOTING.md)
- [CLI Reference](./CLI_OPERATIONS.md)
- [API Reference](./API_REFERENCE.md)

**Community**:
- GitHub Issues: https://github.com/your-org/prism-gateway/issues
- Discussions: https://github.com/your-org/prism-gateway/discussions
- Discord: https://discord.gg/prism-gateway

**Professional Support**:
- Email: support@prism-gateway.io
- Migration assistance available
- Custom deployment consulting

---

## 📊 Migration Checklist

Print this checklist and mark items as you complete them:

### Pre-Migration
- [ ] Backup data directory
- [ ] Backup configuration files
- [ ] Document current version
- [ ] Review breaking changes
- [ ] Plan downtime window
- [ ] Communicate to stakeholders

### Migration
- [ ] Stop v2.x services
- [ ] Update repository to v3.0
- [ ] Generate JWT secret
- [ ] Update .env file
- [ ] Migrate configuration
- [ ] Install dependencies
- [ ] Validate configuration
- [ ] Start v3.0 services

### Testing
- [ ] Health check passes
- [ ] Authentication works
- [ ] API calls succeed
- [ ] WebSocket connects
- [ ] RBAC enforced
- [ ] Rate limiting active
- [ ] Backup system works
- [ ] Health checks run
- [ ] Metrics collecting
- [ ] Alerts functional

### Post-Migration
- [ ] Change default passwords
- [ ] Configure backup automation
- [ ] Set up monitoring
- [ ] Update documentation
- [ ] Update CI/CD pipelines
- [ ] Train team members
- [ ] Monitor for issues
- [ ] Clean up backups (after 1 week)

---

**Migration Guide Version**: 1.0
**Target Version**: 3.0.0
**Last Updated**: 2026-02-07
**Maintained By**: PRISM-Gateway Team
