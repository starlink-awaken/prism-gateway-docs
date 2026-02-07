# PRISM-Gateway Configuration Reference

> Complete guide for configuring PRISM-Gateway v3.0 operational systems

**Version**: 3.0.0-rc1
**Last Updated**: 2026-02-07
**Target Users**: System Administrators, DevOps Engineers

---

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Configuration File Structure](#configuration-file-structure)
3. [Core Configuration](#core-configuration)
4. [Security Configuration](#security-configuration)
5. [Backup Configuration](#backup-configuration)
6. [Health Check Configuration](#health-check-configuration)
7. [Metrics Configuration](#metrics-configuration)
8. [Alerting Configuration](#alerting-configuration)
9. [Environment Variables](#environment-variables)
10. [Advanced Configuration](#advanced-configuration)
11. [Configuration Examples](#configuration-examples)

---

## Configuration Overview

PRISM-Gateway uses a hierarchical configuration system with multiple sources:

```
Priority (highest to lowest):
1. Environment variables
2. Command-line arguments
3. Configuration file (~/.prism-gateway/config.json)
4. Default values
```

### Configuration Locations

```
~/.prism-gateway/
├── config.json                    # Main configuration file
├── .env                           # Environment variables (optional)
├── level-1-hot/
│   └── config/                    # Hot configuration (runtime)
└── level-3-cold/
    └── config/                    # Default configurations
```

---

## Configuration File Structure

### Main Configuration File

**Location**: `~/.prism-gateway/config.json`

```json
{
  "version": "3.0.0",
  "environment": "production",
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:5173"]
    }
  },
  "security": {
    "jwt": {
      "secret": "${JWT_SECRET}",
      "expiresIn": "24h",
      "issuer": "prism-gateway",
      "audience": "prism-api"
    },
    "rbac": {
      "enabled": true,
      "defaultRole": "viewer"
    },
    "rateLimit": {
      "enabled": true,
      "windowMs": 60000,
      "maxRequests": 100
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
      "days": 30,
      "maxBackups": 100
    },
    "compression": {
      "enabled": true,
      "level": 6
    }
  },
  "health": {
    "enabled": true,
    "interval": 60,
    "timeout": 30,
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
    }
  },
  "metrics": {
    "enabled": true,
    "collectors": {
      "system": { "enabled": true, "interval": 10 },
      "process": { "enabled": true, "interval": 10 },
      "api": { "enabled": true, "interval": 5 },
      "websocket": { "enabled": true, "interval": 10 },
      "business": { "enabled": true, "interval": 60 },
      "data": { "enabled": true, "interval": 60 }
    },
    "storage": {
      "directory": "~/.prism-gateway/data/metrics",
      "retention": {
        "raw": "24h",
        "1m": "7d",
        "5m": "30d",
        "1h": "365d"
      }
    }
  },
  "alerting": {
    "enabled": true,
    "evaluationInterval": 30,
    "channels": {
      "console": { "enabled": true },
      "file": {
        "enabled": true,
        "path": "~/.prism-gateway/logs/alerts.log"
      },
      "webhook": {
        "enabled": false,
        "url": ""
      },
      "email": {
        "enabled": false,
        "smtp": {
          "host": "",
          "port": 587,
          "secure": true,
          "auth": {
            "user": "",
            "pass": ""
          }
        },
        "from": "",
        "to": []
      },
      "slack": {
        "enabled": false,
        "webhookUrl": ""
      }
    },
    "deduplication": {
      "enabled": true,
      "window": 300
    },
    "aggregation": {
      "enabled": true,
      "window": 60
    }
  },
  "logging": {
    "level": "info",
    "directory": "~/.prism-gateway/logs",
    "maxSize": "10MB",
    "maxFiles": 10,
    "format": "json"
  },
  "websocket": {
    "enabled": true,
    "path": "/ws",
    "maxConnections": 100,
    "messageRateLimit": 100,
    "connectionRateLimit": 5
  }
}
```

---

## Core Configuration

### Server Settings

```json
{
  "server": {
    "host": "0.0.0.0",           // Bind address (0.0.0.0 = all interfaces)
    "port": 3000,                // Port number (1024-65535)
    "cors": {
      "enabled": true,           // Enable CORS
      "origins": [               // Allowed origins
        "http://localhost:5173",
        "https://app.example.com"
      ],
      "credentials": true        // Allow credentials
    },
    "compression": {
      "enabled": true,           // Enable gzip compression
      "threshold": 1024          // Minimum size to compress (bytes)
    },
    "timeout": {
      "request": 30000,          // Request timeout (ms)
      "keepAlive": 5000          // Keep-alive timeout (ms)
    }
  }
}
```

**Environment Variables**:
- `HOST` - Override server host
- `PORT` - Override server port
- `CORS_ORIGINS` - Comma-separated list of origins

### Data Directories

```json
{
  "directories": {
    "data": "~/.prism-gateway/data",
    "backups": "~/.prism-gateway/backups",
    "logs": "~/.prism-gateway/logs",
    "temp": "~/.prism-gateway/tmp"
  }
}
```

---

## Security Configuration

### JWT Authentication

```json
{
  "security": {
    "jwt": {
      "secret": "${JWT_SECRET}",      // Secret key (use env var!)
      "algorithm": "HS256",            // Signing algorithm
      "expiresIn": "24h",              // Token expiration
      "refreshExpiresIn": "7d",        // Refresh token expiration
      "issuer": "prism-gateway",       // Token issuer
      "audience": "prism-api",         // Token audience
      "rotation": {
        "enabled": true,               // Enable token rotation
        "interval": "12h"              // Rotation interval
      }
    }
  }
}
```

**Best Practices**:
- **NEVER** hardcode `secret` in config file
- Use strong, random 32+ character secret
- Store secret in environment variable or secure vault
- Rotate secrets regularly in production

**Generate Secret**:
```bash
# Generate secure random secret
openssl rand -base64 32
```

### RBAC Authorization

```json
{
  "security": {
    "rbac": {
      "enabled": true,
      "defaultRole": "viewer",        // Default role for new users
      "roles": {
        "admin": {
          "permissions": ["*"]        // All permissions
        },
        "operator": {
          "permissions": [
            "backup:*",
            "health:read",
            "metrics:read",
            "alerts:*"
          ]
        },
        "viewer": {
          "permissions": [
            "health:read",
            "metrics:read",
            "alerts:read"
          ]
        },
        "guest": {
          "permissions": []           // No permissions
        }
      }
    }
  }
}
```

**Permission Format**: `resource:action`
- Resources: `backup`, `health`, `metrics`, `alerts`, `gateway`, `retro`
- Actions: `create`, `read`, `update`, `delete`, `*` (all)
- Wildcards: `backup:*` (all backup actions), `*` (all resources/actions)

### Rate Limiting

```json
{
  "security": {
    "rateLimit": {
      "enabled": true,
      "strategy": "enhanced",         // basic | enhanced | queue
      "windowMs": 60000,              // Time window (ms)
      "maxRequests": 100,             // Max requests per window
      "skipSuccessfulRequests": false,
      "skipFailedRequests": false,
      "keyGenerator": "ip",           // ip | user | custom
      "store": "memory"               // memory | redis
    }
  }
}
```

**Rate Limit Strategies**:
- `basic`: Simple fixed-window counter
- `enhanced`: Sliding window with decay
- `queue`: Request queuing with backpressure

---

## Backup Configuration

### Backup Service

```json
{
  "backup": {
    "enabled": true,
    "directory": "~/.prism-gateway/backups",
    "strategy": {
      "defaultType": "incremental",   // full | incremental
      "compression": {
        "enabled": true,
        "level": 6,                   // 0-9 (0=none, 9=max)
        "algorithm": "gzip"           // gzip | bzip2 | xz
      },
      "verification": {
        "enabled": true,
        "automatic": true             // Auto-verify after creation
      }
    },
    "schedule": {
      "enabled": true,
      "rules": [
        {
          "type": "full",
          "cron": "0 2 * * 0",        // Sunday 2 AM
          "retention": 12              // Keep 12 full backups
        },
        {
          "type": "incremental",
          "cron": "0 2 * * 1-6",      // Mon-Sat 2 AM
          "retention": 30              // Keep 30 incremental
        }
      ]
    },
    "retention": {
      "days": 30,                     // Delete backups older than
      "maxBackups": 100,              // Max total backups
      "minFree": 5368709120           // Min free space (5GB)
    },
    "exclude": [
      "*.tmp",
      "*.log",
      "node_modules/**",
      ".git/**"
    ],
    "notifications": {
      "onSuccess": false,
      "onFailure": true
    }
  }
}
```

**Backup Strategies**:
- **Full**: Complete backup of all data (slower, larger)
- **Incremental**: Only changed files since last backup (faster, smaller)

**Compression Levels**:
- 0: No compression (fastest, largest)
- 1-3: Low compression (fast, moderate size)
- 4-6: Balanced (recommended)
- 7-9: High compression (slow, smallest)

---

## Health Check Configuration

### Health Check Service

```json
{
  "health": {
    "enabled": true,
    "interval": 60,                   // Check interval (seconds)
    "timeout": 30,                    // Check timeout (seconds)
    "retries": 3,                     // Retry count for failed checks
    "checkers": {
      "system": {
        "enabled": true,
        "interval": 30,               // Override global interval
        "thresholds": {
          "cpu": 80,                  // CPU usage threshold (%)
          "memory": 85,               // Memory usage threshold (%)
          "loadAvg1m": 4.0           // 1-min load average
        }
      },
      "disk": {
        "enabled": true,
        "interval": 60,
        "thresholds": {
          "usage": 90,                // Disk usage threshold (%)
          "inodesUsage": 90,          // Inodes usage (%)
          "ioWait": 20                // I/O wait time (%)
        },
        "paths": [
          "~/.prism-gateway",
          "/tmp"
        ]
      },
      "api": {
        "enabled": true,
        "interval": 30,
        "endpoint": "http://localhost:3000/api/v1/health",
        "expectedStatus": 200,
        "timeout": 5000
      },
      "websocket": {
        "enabled": true,
        "interval": 60,
        "url": "ws://localhost:3000/ws",
        "timeout": 5000
      },
      "data": {
        "enabled": true,
        "interval": 300,              // Check every 5 minutes
        "checks": [
          "file_integrity",
          "database_size",
          "corruption_detection"
        ]
      },
      "service": {
        "enabled": true,
        "interval": 60,
        "services": [
          "gateway",
          "retrospective",
          "analytics"
        ]
      },
      "network": {
        "enabled": true,
        "interval": 120,
        "checks": [
          {
            "type": "dns",
            "host": "google.com"
          },
          {
            "type": "ping",
            "host": "8.8.8.8",
            "timeout": 2000
          }
        ]
      }
    },
    "selfHealing": {
      "enabled": true,
      "actions": {
        "restartService": true,       // Restart failed services
        "clearCache": true,           // Clear cache on errors
        "compactData": false          // Compact data files
      }
    },
    "notifications": {
      "onDegraded": true,
      "onUnhealthy": true,
      "onRecovered": true
    }
  }
}
```

**Health Status Levels**:
- `healthy`: All checks passed
- `degraded`: Some checks failed but system functional
- `unhealthy`: Critical checks failed

---

## Metrics Configuration

### Metrics Collection

```json
{
  "metrics": {
    "enabled": true,
    "collectors": {
      "system": {
        "enabled": true,
        "interval": 10,               // Collection interval (seconds)
        "metrics": [
          "cpu.usage",
          "memory.used",
          "memory.percent",
          "disk.usage",
          "load.1m",
          "load.5m"
        ]
      },
      "process": {
        "enabled": true,
        "interval": 10,
        "metrics": [
          "memory.rss",
          "memory.heap.used",
          "memory.heap.total",
          "cpu.usage",
          "uptime",
          "handles",
          "eventloop.lag"
        ]
      },
      "api": {
        "enabled": true,
        "interval": 5,
        "metrics": [
          "requests.total",
          "requests.status.2xx",
          "requests.status.4xx",
          "requests.status.5xx",
          "response.time.avg",
          "response.time.p95",
          "response.time.p99"
        ]
      },
      "websocket": {
        "enabled": true,
        "interval": 10,
        "metrics": [
          "connections.active",
          "connections.total",
          "messages.sent",
          "messages.received",
          "latency.avg"
        ]
      },
      "business": {
        "enabled": true,
        "interval": 60,
        "metrics": [
          "gateway.checks.total",
          "gateway.violations.total",
          "retro.quick.total",
          "retro.standard.total"
        ]
      },
      "data": {
        "enabled": true,
        "interval": 60,
        "metrics": [
          "storage.hot.size",
          "storage.warm.size",
          "storage.cold.size",
          "backups.total",
          "backups.size"
        ]
      }
    },
    "storage": {
      "directory": "~/.prism-gateway/data/metrics",
      "engine": "filesystem",         // filesystem | memory
      "retention": {
        "raw": "24h",                 // Raw data points
        "1m": "7d",                   // 1-minute aggregates
        "5m": "30d",                  // 5-minute aggregates
        "1h": "365d"                  // 1-hour aggregates
      },
      "aggregation": {
        "enabled": true,
        "functions": [
          "avg",
          "sum",
          "min",
          "max",
          "count",
          "p50",
          "p95",
          "p99"
        ]
      },
      "compression": {
        "enabled": true,
        "threshold": "7d"             // Compress data older than
      }
    },
    "cache": {
      "enabled": true,
      "size": 10000,                  // Max cached entries
      "ttl": 300                      // Cache TTL (seconds)
    }
  }
}
```

**Metric Types**:
- **Counter**: Cumulative value (requests, errors)
- **Gauge**: Current value (CPU, memory)
- **Histogram**: Distribution (response times)
- **Summary**: Statistical summary (percentiles)

---

## Alerting Configuration

### Alert Rules

```json
{
  "alerting": {
    "enabled": true,
    "evaluationInterval": 30,        // Evaluate rules every 30s
    "rules": [
      {
        "id": "high_cpu",
        "name": "High CPU Usage",
        "enabled": true,
        "metric": "system.cpu.usage",
        "condition": {
          "operator": ">",
          "threshold": 80,
          "duration": 300             // Sustained for 5 minutes
        },
        "severity": "high",           // critical | high | medium | low
        "channels": ["console", "file"],
        "annotations": {
          "description": "CPU usage exceeded 80%",
          "runbook": "https://docs.example.com/runbook/high-cpu"
        },
        "throttle": {
          "enabled": true,
          "interval": 300             // Min 5 min between alerts
        }
      },
      {
        "id": "disk_full",
        "name": "Disk Space Critical",
        "enabled": true,
        "metric": "system.disk.percent",
        "condition": {
          "operator": ">",
          "threshold": 90,
          "duration": 60
        },
        "severity": "critical",
        "channels": ["console", "file", "webhook"],
        "actions": [
          "trigger_backup_cleanup",
          "send_notification"
        ]
      },
      {
        "id": "api_errors",
        "name": "High API Error Rate",
        "enabled": true,
        "metric": "api.requests.status.5xx",
        "condition": {
          "operator": ">",
          "threshold": 10,
          "window": "5m",             // In last 5 minutes
          "aggregation": "rate"       // Calculate rate
        },
        "severity": "high",
        "channels": ["console", "file", "slack"]
      }
    ],
    "channels": {
      "console": {
        "enabled": true,
        "colors": true,
        "format": "pretty"            // pretty | json
      },
      "file": {
        "enabled": true,
        "path": "~/.prism-gateway/logs/alerts.log",
        "maxSize": "10MB",
        "maxFiles": 10,
        "format": "json"
      },
      "webhook": {
        "enabled": false,
        "url": "https://hooks.example.com/alerts",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json",
          "Authorization": "Bearer ${WEBHOOK_TOKEN}"
        },
        "timeout": 5000,
        "retries": 3
      },
      "email": {
        "enabled": false,
        "smtp": {
          "host": "smtp.gmail.com",
          "port": 587,
          "secure": true,
          "auth": {
            "user": "${SMTP_USER}",
            "pass": "${SMTP_PASS}"
          }
        },
        "from": "alerts@example.com",
        "to": [
          "ops@example.com",
          "oncall@example.com"
        ],
        "template": "default"
      },
      "slack": {
        "enabled": false,
        "webhookUrl": "${SLACK_WEBHOOK_URL}",
        "channel": "#alerts",
        "username": "PRISM-Gateway",
        "iconEmoji": ":warning:"
      }
    },
    "deduplication": {
      "enabled": true,
      "window": 300,                  // 5 minutes
      "keys": ["rule", "severity"]    // Dedupe by rule + severity
    },
    "aggregation": {
      "enabled": true,
      "window": 60,                   // 1 minute
      "maxAlerts": 10                 // Aggregate if >10 alerts
    },
    "silencing": {
      "enabled": true,
      "rules": [
        {
          "matcher": { "severity": "low" },
          "schedule": {
            "days": ["saturday", "sunday"],
            "hours": [0, 23]
          }
        }
      ]
    }
  }
}
```

**Alert Severity Levels**:
- `critical`: Immediate action required
- `high`: Action required soon
- `medium`: Should be investigated
- `low`: Informational

---

## Environment Variables

### Required Variables

```bash
# Security (REQUIRED)
JWT_SECRET=your-secret-key-here-32-chars-minimum

# Optional overrides
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

### Optional Variables

```bash
# Database
DB_PATH=~/.prism-gateway/data

# Backup
BACKUP_DIR=~/.prism-gateway/backups
BACKUP_COMPRESSION=6

# Metrics
METRICS_DIR=~/.prism-gateway/data/metrics
METRICS_RETENTION_RAW=24h
METRICS_RETENTION_1M=7d

# Alerting
ALERT_EMAIL_USER=alerts@example.com
ALERT_EMAIL_PASS=your-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
WEBHOOK_TOKEN=your-webhook-token

# CORS
CORS_ORIGINS=http://localhost:5173,https://app.example.com

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

### Environment File

**Location**: `~/.prism-gateway/.env`

```bash
# PRISM-Gateway v3.0 Configuration
# Copy this to .env and customize

# Required
JWT_SECRET=generate-with-openssl-rand-base64-32

# Server
HOST=0.0.0.0
PORT=3000
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_COMPRESSION=6

# Metrics
METRICS_ENABLED=true
METRICS_RETENTION_RAW=24h
METRICS_RETENTION_1M=7d

# Alerting
ALERTING_ENABLED=true
# SLACK_WEBHOOK_URL=
# WEBHOOK_TOKEN=
```

---

## Advanced Configuration

### Custom Metric Collectors

```json
{
  "metrics": {
    "customCollectors": [
      {
        "name": "custom_business_metric",
        "enabled": true,
        "interval": 60,
        "script": "~/.prism-gateway/collectors/custom.js",
        "config": {
          "param1": "value1"
        }
      }
    ]
  }
}
```

### Custom Health Checkers

```json
{
  "health": {
    "customCheckers": [
      {
        "name": "external_service",
        "enabled": true,
        "interval": 60,
        "script": "~/.prism-gateway/checkers/external.js",
        "timeout": 10000
      }
    ]
  }
}
```

### Performance Tuning

```json
{
  "performance": {
    "workers": 4,                     // Worker threads (0 = auto)
    "cache": {
      "memory": "256MB",              // Max cache memory
      "strategy": "lru"               // lru | lfu | fifo
    },
    "database": {
      "poolSize": 10,
      "connectionTimeout": 5000
    },
    "fileWatch": {
      "enabled": true,
      "debounce": 100                 // Debounce delay (ms)
    }
  }
}
```

---

## Configuration Examples

### Development Environment

```json
{
  "version": "3.0.0",
  "environment": "development",
  "server": {
    "host": "localhost",
    "port": 3000
  },
  "security": {
    "jwt": {
      "expiresIn": "7d"
    },
    "rateLimit": {
      "enabled": false
    }
  },
  "backup": {
    "schedule": {
      "enabled": false
    }
  },
  "health": {
    "interval": 120
  },
  "metrics": {
    "storage": {
      "retention": {
        "raw": "1h",
        "1m": "1d"
      }
    }
  },
  "logging": {
    "level": "debug"
  }
}
```

### Production Environment

```json
{
  "version": "3.0.0",
  "environment": "production",
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "compression": {
      "enabled": true
    }
  },
  "security": {
    "jwt": {
      "expiresIn": "12h",
      "rotation": {
        "enabled": true
      }
    },
    "rateLimit": {
      "enabled": true,
      "strategy": "enhanced"
    }
  },
  "backup": {
    "schedule": {
      "enabled": true
    },
    "compression": {
      "level": 9
    }
  },
  "health": {
    "interval": 60,
    "selfHealing": {
      "enabled": true
    }
  },
  "metrics": {
    "storage": {
      "compression": {
        "enabled": true
      }
    }
  },
  "alerting": {
    "enabled": true,
    "channels": {
      "webhook": {
        "enabled": true
      },
      "slack": {
        "enabled": true
      }
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

### High-Performance Setup

```json
{
  "performance": {
    "workers": 8,
    "cache": {
      "memory": "512MB"
    }
  },
  "metrics": {
    "collectors": {
      "system": {
        "interval": 5
      },
      "api": {
        "interval": 1
      }
    },
    "storage": {
      "engine": "memory",
      "compression": {
        "enabled": false
      }
    }
  },
  "health": {
    "interval": 30
  },
  "logging": {
    "level": "warn"
  }
}
```

---

## Configuration Validation

### Validate Configuration

```bash
# Validate configuration file
prism config validate

# Check configuration syntax
prism config check

# Display current configuration
prism config show

# Test configuration
prism config test
```

### Configuration Schema

PRISM-Gateway validates configuration against a JSON schema. View the schema:

```bash
prism config schema
```

---

## Troubleshooting

### Common Configuration Issues

**Issue**: JWT authentication fails
```bash
# Solution: Check JWT secret
echo $JWT_SECRET
# Ensure it's at least 32 characters
```

**Issue**: Rate limiting too strict
```json
{
  "security": {
    "rateLimit": {
      "windowMs": 60000,
      "maxRequests": 1000        // Increase limit
    }
  }
}
```

**Issue**: Backup disk space full
```json
{
  "backup": {
    "retention": {
      "days": 7,                  // Reduce retention
      "maxBackups": 20
    },
    "compression": {
      "level": 9                  // Increase compression
    }
  }
}
```

**Issue**: High memory usage
```json
{
  "metrics": {
    "cache": {
      "size": 1000                // Reduce cache size
    },
    "storage": {
      "retention": {
        "raw": "12h"              // Reduce retention
      }
    }
  }
}
```

---

## Best Practices

### Security

1. **Always use environment variables for secrets**
2. **Enable JWT token rotation in production**
3. **Use strong rate limiting settings**
4. **Enable RBAC for multi-user deployments**
5. **Regularly rotate secrets and credentials**

### Performance

1. **Adjust collector intervals based on load**
2. **Enable compression for backups and metrics**
3. **Use appropriate retention periods**
4. **Monitor system resources**
5. **Disable unused features**

### Reliability

1. **Enable automatic backups**
2. **Configure health check thresholds appropriately**
3. **Set up alerting for critical metrics**
4. **Enable self-healing features**
5. **Test backup restoration regularly**

### Monitoring

1. **Review metrics retention needs**
2. **Configure relevant alerts**
3. **Set appropriate notification channels**
4. **Enable alert deduplication**
5. **Monitor alert volume**

---

## Configuration Migration

### From v2.x to v3.0

```bash
# Backup current configuration
cp ~/.prism-gateway/config.json ~/.prism-gateway/config.v2.backup.json

# Run migration tool
prism config migrate --from 2.x --to 3.0

# Validate migrated configuration
prism config validate
```

**Breaking Changes in v3.0**:
- New `security` section required
- `backup`, `health`, `metrics`, `alerting` sections added
- Some path configurations changed

---

## Getting Help

### Configuration Help

```bash
# General help
prism config --help

# Specific section help
prism config backup --help
prism config health --help
prism config metrics --help
```

### Resources

- [CLI Operations Guide](./cli/OPERATIONS_CLI_GUIDE.md)
- [API Reference](./api/OPERATIONS_API_REFERENCE.md)
- [Troubleshooting Guide](./troubleshooting/OPERATIONS_TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/starlink-awaken/prism-gateway/issues)

---

**Last Updated**: 2026-02-07
**Version**: 3.0.0-rc1
**License**: MIT
