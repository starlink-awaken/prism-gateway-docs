# PRISM-Gateway v3.0 Quick Start Guide

> Get up and running with PRISM-Gateway in 5 minutes

**Version**: 3.0.0
**Last Updated**: 2026-02-07
**Target Audience**: New users, developers, system administrators

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Bun** >= 1.0 ([installation guide](https://bun.sh/docs/installation))
- **Node.js** >= 18 (optional, for npm compatibility)
- **Git** (for cloning repository)
- **Terminal** access (bash, zsh, or similar)

**System Requirements**:
- OS: Linux, macOS, or Windows (WSL2)
- RAM: 512MB minimum, 2GB recommended
- Disk: 100MB for installation, 1GB recommended for data

---

## 🚀 5-Minute Setup

### Step 1: Clone and Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/your-org/prism-gateway.git
cd prism-gateway

# Install dependencies
bun install

# Verify installation
bun test --run
```

**Expected Output**:
```
✓ 624+ tests passing
✓ Coverage: >90%
✓ Installation successful
```

---

### Step 2: Configure Environment (1 minute)

Generate a secure JWT secret and create your `.env` file:

```bash
# Generate JWT secret (Linux/macOS)
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env

# Or manually create .env file
cat > .env << EOF
JWT_SECRET=your-secret-key-minimum-32-characters-required
NODE_ENV=development
LOG_LEVEL=info
EOF
```

**Verify configuration**:
```bash
bun run prism config validate
```

---

### Step 3: Start the Server (30 seconds)

```bash
# Start API server (port 3000)
bun run api:dev

# Or start in production mode
bun run api
```

**Server will start on**:
- API: `http://localhost:3000`
- WebSocket: `ws://localhost:3001`

**Expected Output**:
```
🚀 PRISM-Gateway v3.0.0
✓ API Server listening on http://localhost:3000
✓ WebSocket Server listening on ws://localhost:3001
✓ Environment: development
✓ Authentication: enabled
```

---

### Step 4: Verify Installation (1 minute)

Open a new terminal and run:

```bash
# Health check
curl http://localhost:3000/health

# Expected response
{
  "status": "healthy",
  "version": "3.0.0",
  "uptime": 12.345,
  "timestamp": "2026-02-07T10:00:00.000Z"
}
```

**Test API endpoints**:

```bash
# Create a test user and get JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Response includes JWT token
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

**Save the token** for authenticated requests:
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Step 5: Run Your First Commands (30 seconds)

#### Option A: Using CLI

```bash
# Check a task intent
bun run prism check "Implement user authentication"

# Run a quick retrospective
bun run prism retro quick

# View system status
bun run prism stats

# Run health checks
bun run prism health check --all
```

#### Option B: Using API

```bash
# Get analytics dashboard
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/analytics/dashboard

# Check system health
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/health/status

# List recent retrospectives
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/retrospectives
```

#### Option C: Using Web UI

1. Open browser: `http://localhost:3000`
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. View the dashboard with real-time metrics

---

## 🎯 Common Use Cases

### Use Case 1: Gateway Checking

Check if a task intent follows your principles:

```bash
# CLI
prism check "Add a new feature without tests"

# API
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/gateway/check \
  -d '{"intent": "Add a new feature without tests"}'

# Response
{
  "status": "BLOCKED",
  "violations": [
    {
      "principle": "Test-Driven Development",
      "severity": "high",
      "suggestion": "Write tests before implementing the feature"
    }
  ]
}
```

---

### Use Case 2: Quick Retrospective

Perform a quick 7-dimension retrospective:

```bash
# CLI
prism retro quick

# Interactive prompts will guide you through:
# 1. Principles: What principles were violated?
# 2. Patterns: Which patterns matched?
# 3. Benchmarks: What are the key metrics?
# 4. Traps: What traps were encountered?
# 5. Success: What contributed to success?
# 6. Tools: What tools were used?
# 7. Data: What data is relevant?

# Result saved to: ~/.prism-gateway/level-2-warm/retros/YYYY-MM-DD-HHmmss.json
```

---

### Use Case 3: System Monitoring

Monitor system health and metrics:

```bash
# Health check (all systems)
prism health check --all

# Get specific health checker
prism health check --checker=system

# Query metrics
prism metrics query \
  --metric=api_requests_total \
  --start="2026-02-07T00:00:00Z" \
  --end="2026-02-07T23:59:59Z"

# View active alerts
prism alerts list --severity=high
```

---

### Use Case 4: Backup & Restore

Create and manage backups:

```bash
# Create full backup
prism backup create --type=full

# Create incremental backup
prism backup create --type=incremental

# List backups
prism backup list

# Restore from backup
prism backup restore --id=backup-2026-02-07-120000
```

---

## 🛠️ Configuration Options

### Minimal Configuration (Development)

`.env` file:
```bash
JWT_SECRET=your-secret-key-minimum-32-characters
NODE_ENV=development
LOG_LEVEL=debug
```

`config.json` file:
```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  }
}
```

---

### Production Configuration

`.env` file:
```bash
JWT_SECRET=<generate-secure-32-char-key>
NODE_ENV=production
LOG_LEVEL=info
RBAC_ENABLED=true
RATE_LIMIT_API=100
BACKUP_ENABLED=true
```

`config.json` file:
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "cors": {
      "enabled": true,
      "allowedOrigins": ["https://your-domain.com"]
    }
  },
  "security": {
    "jwt": {
      "expiresIn": "24h",
      "rotation": {
        "enabled": true,
        "interval": "12h"
      }
    },
    "rbac": {
      "enabled": true
    },
    "rateLimiting": {
      "enabled": true,
      "api": {
        "windowMs": 60000,
        "max": 100
      }
    }
  },
  "backup": {
    "enabled": true,
    "schedule": {
      "cron": "0 2 * * *",
      "type": "incremental"
    }
  },
  "health": {
    "enabled": true,
    "interval": 60
  },
  "metrics": {
    "enabled": true,
    "collectors": {
      "system": { "enabled": true, "interval": 60 },
      "api": { "enabled": true, "interval": 30 }
    }
  }
}
```

**See**: [Configuration Guide](./CONFIGURATION_GUIDE.md) for complete reference.

---

## 📚 Next Steps

Now that you have PRISM-Gateway running, explore these resources:

### Essential Documentation
- **[CLI Operations Guide](./CLI_OPERATIONS.md)** - Complete CLI command reference (22 commands)
- **[API Reference](./API_REFERENCE.md)** - REST API documentation (32 endpoints)
- **[Configuration Guide](./CONFIGURATION_GUIDE.md)** - Comprehensive configuration reference
- **[Troubleshooting Guide](./troubleshooting/OPERATIONS_TROUBLESHOOTING.md)** - Common issues and solutions

### Learn More
- **[Architecture Overview](../../reports/PHASE3_OVERALL_PROGRESS.md)** - System design and components
- **[Security Guide](./SECURITY.md)** - Security best practices and audit results
- **[Development Guide](../README.md#development)** - Contributing to PRISM-Gateway

### Try Advanced Features
1. **Custom Health Checkers** - Create custom health check plugins
2. **Alert Rules** - Configure smart alerting for your metrics
3. **Backup Automation** - Set up automated backup schedules
4. **API Integration** - Integrate PRISM-Gateway into your workflows
5. **WebSocket Streaming** - Real-time event subscriptions

---

## 🔧 Common Issues

### Issue 1: Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 bun run api:dev
```

---

### Issue 2: JWT Secret Not Set

**Error**: `JWT_SECRET environment variable is required`

**Solution**:
```bash
# Generate and set JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# Verify
cat .env
```

---

### Issue 3: Bun Not Found

**Error**: `command not found: bun`

**Solution**:
```bash
# Install Bun (Linux/macOS)
curl -fsSL https://bun.sh/install | bash

# Reload shell
source ~/.bashrc  # or ~/.zshrc

# Verify installation
bun --version
```

---

### Issue 4: Permission Denied

**Error**: `EACCES: permission denied, mkdir '~/.prism-gateway'`

**Solution**:
```bash
# Create data directory with proper permissions
mkdir -p ~/.prism-gateway
chmod 755 ~/.prism-gateway

# Or run with sudo (not recommended)
sudo bun run prism init
```

---

## 🆘 Getting Help

### Documentation
- **Main README**: [README.md](../README.md)
- **FAQ**: See [Troubleshooting Guide](./troubleshooting/OPERATIONS_TROUBLESHOOTING.md)
- **CHANGELOG**: [CHANGELOG.md](../CHANGELOG.md)

### Community
- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/prism-gateway/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/your-org/prism-gateway/discussions)

### Professional Support
- **Email**: support@prism-gateway.io
- **Documentation**: https://docs.prism-gateway.io
- **Status Page**: https://status.prism-gateway.io

---

## ✅ Checklist

After completing this quick start, you should have:

- [x] Installed PRISM-Gateway and dependencies
- [x] Generated JWT secret and configured environment
- [x] Started API and WebSocket servers
- [x] Verified installation with health check
- [x] Obtained authentication token
- [x] Executed first CLI command or API call
- [x] Explored basic features (Gateway, Retro, Health, Backup)

**You're ready to use PRISM-Gateway!** 🎉

---

## 🚀 What's Next?

### For Developers
1. Read the [Development Guide](../README.md#development)
2. Explore the [API Reference](./API_REFERENCE.md)
3. Try the [TypeScript examples](../examples/)
4. Contribute to the project

### For Operators
1. Set up [Production Configuration](./CONFIGURATION_GUIDE.md)
2. Configure [Backup Automation](./CLI_OPERATIONS.md#backup-commands)
3. Set up [Alert Rules](./CLI_OPERATIONS.md#alerting-commands)
4. Monitor with [Metrics](./CLI_OPERATIONS.md#metrics-commands)

### For Analysts
1. Run [Retrospectives](./CLI_OPERATIONS.md#retrospective-commands)
2. Analyze [Trends](./API_REFERENCE.md#analytics-endpoints)
3. Export [Reports](./CLI_OPERATIONS.md#analytics-commands)
4. View [Dashboard](http://localhost:3000)

---

**Welcome to PRISM-Gateway v3.0!** 🌟

**Maintained by**: PRISM-Gateway Team
**License**: MIT
**Version**: 3.0.0
**Documentation**: https://docs.prism-gateway.io
