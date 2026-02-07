# PRISM-Gateway Operations API Reference

> REST API documentation for Backup, Health Check, Metrics, and Alerting services

**Version**: 3.0.0
**Last Updated**: 2026-02-07
**Base URL**: `http://localhost:3000/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Patterns](#common-patterns)
3. [Backup API](#backup-api)
4. [Health Check API](#health-check-api)
5. [Metrics API](#metrics-api)
6. [Alerting API](#alerting-api)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints require JWT authentication via the `Authorization` header:

```http
Authorization: Bearer <jwt-token>
```

**Required Role**: `operator` or higher for operational APIs.

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbGc..." \
     http://localhost:3000/api/v1/health
```

---

## Common Patterns

### Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "data": { /* response data */ },
  "metadata": {
    "timestamp": "2026-02-07T14:05:30.123Z",
    "version": "3.0.0"
  }
}
```

### Error Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERR_1001",
    "message": "Resource not found",
    "details": { /* additional context */ }
  },
  "metadata": {
    "timestamp": "2026-02-07T14:05:30.123Z",
    "version": "3.0.0"
  }
}
```

### Pagination

List endpoints support pagination:

```http
GET /api/v1/backups?page=1&limit=20&sort=created_at&order=desc
```

**Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sort` - Sort field (varies by endpoint)
- `order` - Sort order: `asc` or `desc` (default: desc)

**Response includes pagination metadata:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Backup API

### Create Backup

Create a new backup (full or incremental).

**Endpoint:** `POST /api/v1/backups`

**Request Body:**
```json
{
  "type": "full",
  "compression": 6,
  "exclude": ["*.tmp", "*.log"],
  "metadata": {
    "description": "Daily backup",
    "tags": ["scheduled", "production"]
  }
}
```

**Parameters:**
- `type` (required): `"full"` or `"incremental"`
- `compression` (optional): 0-9, default: 6
- `exclude` (optional): Array of glob patterns
- `metadata` (optional): Custom metadata object

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "backup_20260207_140512",
    "type": "full",
    "status": "completed",
    "createdAt": "2026-02-07T14:05:12.000Z",
    "completedAt": "2026-02-07T14:05:24.000Z",
    "stats": {
      "fileCount": 1234,
      "originalSize": 163400000,
      "compressedSize": 45200000,
      "compressionRatio": 72.3,
      "duration": 12400
    },
    "location": "~/.prism-gateway/backups/backup_20260207_140512.tar.gz",
    "checksum": "sha256:abc123..."
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/backups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "full",
    "compression": 9,
    "metadata": {
      "description": "Pre-deployment backup"
    }
  }'
```

---

### List Backups

Retrieve list of all backups.

**Endpoint:** `GET /api/v1/backups`

**Query Parameters:**
- `type`: Filter by type (`full`, `incremental`, `all`)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field (`created_at`, `size`, `type`)
- `order`: Sort order (`asc`, `desc`)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "backup_20260207_140512",
      "type": "full",
      "createdAt": "2026-02-07T14:05:12.000Z",
      "size": 45200000,
      "fileCount": 1234,
      "status": "completed"
    },
    {
      "id": "backup_20260207_120030",
      "type": "incremental",
      "createdAt": "2026-02-07T12:00:30.000Z",
      "size": 2100000,
      "fileCount": 45,
      "status": "completed"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/v1/backups?type=full&limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get Backup Details

Get detailed information about a specific backup.

**Endpoint:** `GET /api/v1/backups/:id`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "backup_20260207_140512",
    "type": "full",
    "status": "completed",
    "createdAt": "2026-02-07T14:05:12.000Z",
    "completedAt": "2026-02-07T14:05:24.000Z",
    "stats": {
      "fileCount": 1234,
      "originalSize": 163400000,
      "compressedSize": 45200000,
      "compressionRatio": 72.3,
      "duration": 12400
    },
    "location": "~/.prism-gateway/backups/backup_20260207_140512.tar.gz",
    "checksum": "sha256:abc123...",
    "metadata": {
      "description": "Daily backup",
      "tags": ["scheduled", "production"]
    },
    "verification": {
      "lastVerified": "2026-02-07T14:05:25.000Z",
      "status": "valid"
    }
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/v1/backups/backup_20260207_140512 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Restore Backup

Restore data from a backup.

**Endpoint:** `POST /api/v1/backups/:id/restore`

**Request Body:**
```json
{
  "target": "/custom/restore/path",
  "overwrite": true,
  "verify": true
}
```

**Parameters:**
- `target` (optional): Custom restore path
- `overwrite` (optional): Overwrite existing files (default: false)
- `verify` (optional): Verify before restoring (default: true)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "restoredFiles": 1234,
    "totalSize": 163400000,
    "duration": 8200,
    "errors": []
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/backups/backup_20260207_140512/restore \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "overwrite": true,
    "verify": true
  }'
```

---

### Verify Backup

Verify backup integrity.

**Endpoint:** `POST /api/v1/backups/:id/verify`

**Request Body:**
```json
{
  "deep": true
}
```

**Parameters:**
- `deep` (optional): Perform deep verification (default: false)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "valid": true,
    "checksumMatch": true,
    "errors": [],
    "verifiedAt": "2026-02-07T14:10:00.000Z"
  }
}
```

---

### Delete Backup

Delete a backup.

**Endpoint:** `DELETE /api/v1/backups/:id`

**Query Parameters:**
- `keepMetadata`: Keep metadata (default: false)

**Response:** `204 No Content`

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/v1/backups/backup_20260207_140512 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get Backup Statistics

Get backup system statistics.

**Endpoint:** `GET /api/v1/backups/stats`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalBackups": 15,
    "fullBackups": 5,
    "incrementalBackups": 10,
    "totalStorage": 250500000,
    "compressedStorage": 250500000,
    "uncompressedStorage": 890200000,
    "compressionRatio": 71.9,
    "oldestBackup": "2026-01-15T08:30:00.000Z",
    "newestBackup": "2026-02-07T14:05:12.000Z",
    "averageSize": 16700000
  }
}
```

---

## Health Check API

### Run Health Check

Execute health checks on all or specific systems.

**Endpoint:** `POST /api/v1/health/check`

**Request Body:**
```json
{
  "systems": ["system", "disk", "api"],
  "timeout": 30
}
```

**Parameters:**
- `systems` (optional): Array of system names (default: all)
- `timeout` (optional): Timeout per check in seconds (default: 30)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "overallStatus": "healthy",
    "checks": [
      {
        "system": "system",
        "status": "healthy",
        "message": "CPU: 45%, Memory: 62%, Uptime: 5d",
        "metrics": {
          "cpu": 45.2,
          "memory": 62.1,
          "uptime": 432000
        },
        "timestamp": "2026-02-07T14:05:30.123Z",
        "duration": 45
      },
      {
        "system": "disk",
        "status": "healthy",
        "message": "Usage: 45%, I/O: normal",
        "metrics": {
          "usage": 45.3,
          "ioWait": 2.1
        },
        "timestamp": "2026-02-07T14:05:30.168Z",
        "duration": 23
      }
    ],
    "summary": {
      "total": 7,
      "healthy": 7,
      "degraded": 0,
      "unhealthy": 0
    },
    "duration": 2400
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/health/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "systems": ["system", "disk", "api"]
  }'
```

---

### Get Health Status

Get current health status summary.

**Endpoint:** `GET /api/v1/health/status`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "lastCheck": "2026-02-07T14:05:30.123Z",
    "systems": {
      "system": "healthy",
      "disk": "healthy",
      "api": "healthy",
      "websocket": "healthy",
      "data": "healthy",
      "service": "healthy",
      "network": "healthy"
    }
  }
}
```

---

### Get Health History

Retrieve health check history.

**Endpoint:** `GET /api/v1/health/history`

**Query Parameters:**
- `system`: Filter by system name
- `status`: Filter by status (`healthy`, `degraded`, `unhealthy`)
- `since`: Duration string (e.g., "1h", "1d", "7d")
- `page`: Page number
- `limit`: Items per page

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "check_20260207_140530",
      "system": "system",
      "status": "healthy",
      "timestamp": "2026-02-07T14:05:30.123Z",
      "metrics": {
        "cpu": 45.2,
        "memory": 62.1
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

### Get Health Configuration

Get current health check configuration.

**Endpoint:** `GET /api/v1/health/config`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "interval": 60,
    "timeout": 30,
    "thresholds": {
      "cpu": 80,
      "memory": 85,
      "disk": 90
    },
    "enabledSystems": [
      "system",
      "disk",
      "api",
      "websocket",
      "data",
      "service",
      "network"
    ]
  }
}
```

---

### Update Health Configuration

Update health check configuration.

**Endpoint:** `PATCH /api/v1/health/config`

**Request Body:**
```json
{
  "interval": 120,
  "thresholds": {
    "cpu": 90,
    "memory": 90
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "updated": true,
    "config": { /* updated configuration */ }
  }
}
```

---

## Metrics API

### List Metrics

Get list of all available metrics.

**Endpoint:** `GET /api/v1/metrics`

**Query Parameters:**
- `collector`: Filter by collector name
- `type`: Filter by metric type (`gauge`, `counter`, `histogram`, `summary`)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "name": "system.cpu.usage",
      "type": "gauge",
      "collector": "system",
      "description": "CPU usage percentage",
      "unit": "percent"
    },
    {
      "name": "system.memory.used",
      "type": "gauge",
      "collector": "system",
      "description": "Memory used in bytes",
      "unit": "bytes"
    }
  ]
}
```

---

### Get Metrics Snapshot

Get real-time snapshot of all current metric values.

**Endpoint:** `GET /api/v1/metrics/snapshot`

**Query Parameters:**
- `collector`: Filter by collector name (optional)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "timestamp": "2026-02-07T14:05:30.123Z",
    "metrics": [
      {
        "name": "system.cpu.usage",
        "value": 45.2,
        "timestamp": "2026-02-07T14:05:30.123Z",
        "labels": {},
        "metadata": {}
      },
      {
        "name": "system.memory.used",
        "value": 8589934592,
        "timestamp": "2026-02-07T14:05:30.123Z",
        "labels": {},
        "metadata": {}
      }
    ]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/v1/metrics/snapshot?collector=system \
  -H "Authorization: Bearer $TOKEN"
```

---

### Query Metric Data

Query metric data over time.

**Endpoint:** `GET /api/v1/metrics/:name`

**Query Parameters:**
- `start` (required): Start timestamp (ISO 8601 or relative like "-1h")
- `end` (optional): End timestamp (default: now)
- `granularity`: Data granularity (`raw`, `1m`, `5m`, `1h`, default: auto)
- `aggregation`: Aggregation function (`avg`, `sum`, `min`, `max`, `p50`, `p95`, `p99`)
- `limit`: Limit number of data points

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "metric": "system.cpu.usage",
    "start": "2026-02-07T13:00:00.000Z",
    "end": "2026-02-07T14:00:00.000Z",
    "granularity": "raw",
    "dataPoints": [
      {
        "timestamp": "2026-02-07T13:00:00.000Z",
        "value": 45.2
      },
      {
        "timestamp": "2026-02-07T13:01:00.000Z",
        "value": 46.8
      }
    ],
    "summary": {
      "count": 60,
      "avg": 45.8,
      "min": 42.1,
      "max": 52.3,
      "p95": 50.2
    }
  }
}
```

**Examples:**
```bash
# Query last hour
curl "http://localhost:3000/api/v1/metrics/system.cpu.usage?start=-1h" \
  -H "Authorization: Bearer $TOKEN"

# Query with aggregation
curl "http://localhost:3000/api/v1/metrics/api.requests.total?start=-24h&aggregation=sum" \
  -H "Authorization: Bearer $TOKEN"

# Query specific granularity
curl "http://localhost:3000/api/v1/metrics/process.memory.rss?start=-7d&granularity=5m" \
  -H "Authorization: Bearer $TOKEN"
```

---

### List Collectors

Get list of all metric collectors.

**Endpoint:** `GET /api/v1/metrics/collectors`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "name": "system",
      "enabled": true,
      "interval": 10,
      "metricsCount": 6,
      "collectionCount": 8640,
      "errorCount": 0,
      "lastCollection": "2026-02-07T14:05:30.000Z"
    },
    {
      "name": "process",
      "enabled": true,
      "interval": 10,
      "metricsCount": 7,
      "collectionCount": 8640,
      "errorCount": 0,
      "lastCollection": "2026-02-07T14:05:30.000Z"
    }
  ]
}
```

---

### Update Collector Configuration

Update collector configuration.

**Endpoint:** `PATCH /api/v1/metrics/collectors/:name`

**Request Body:**
```json
{
  "enabled": false,
  "interval": 30
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "name": "websocket",
    "enabled": false,
    "interval": 30
  }
}
```

---

### Get Metrics Statistics

Get metrics system statistics.

**Endpoint:** `GET /api/v1/metrics/stats`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "activeCollectors": 6,
    "totalMetrics": 28,
    "totalDataPoints": 145892,
    "storage": {
      "raw": 12300000,
      "oneMinute": 45100000,
      "fiveMinute": 89600000,
      "oneHour": 156200000,
      "total": 303200000
    },
    "collectionRate": 28,
    "storageGrowth": 15000000,
    "oldestData": "2026-01-08T00:00:00.000Z"
  }
}
```

---

### Record Event

Record a business or API event (for custom metrics).

**Endpoint:** `POST /api/v1/metrics/events`

**Request Body:**
```json
{
  "type": "api_request",
  "data": {
    "path": "/api/v1/health",
    "method": "GET",
    "status": 200,
    "duration": 15
  }
}
```

**Event Types:**
- `api_request`: API request event
- `websocket_connection`: WebSocket connection event
- `websocket_message`: WebSocket message event
- `gateway_check`: Gateway check event
- `retrospective`: Retrospective event
- `violation`: Violation event

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "recorded": true
  }
}
```

---

## Alerting API

### List Alert Rules

Get list of all alert rules.

**Endpoint:** `GET /api/v1/alerts/rules`

**Query Parameters:**
- `status`: Filter by status (`enabled`, `disabled`, `all`)
- `severity`: Filter by severity (`critical`, `high`, `medium`, `low`)
- `page`: Page number
- `limit`: Items per page

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "rule_high_cpu",
      "name": "High CPU Usage",
      "enabled": true,
      "metric": "system.cpu.usage",
      "condition": {
        "operator": ">",
        "threshold": 80,
        "duration": 300
      },
      "severity": "high",
      "channels": ["console", "file"],
      "createdAt": "2026-02-01T10:00:00.000Z",
      "updatedAt": "2026-02-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10
  }
}
```

---

### Create Alert Rule

Create a new alert rule.

**Endpoint:** `POST /api/v1/alerts/rules`

**Request Body:**
```json
{
  "name": "High CPU Usage",
  "metric": "system.cpu.usage",
  "condition": {
    "operator": ">",
    "threshold": 80,
    "duration": 300
  },
  "severity": "high",
  "channels": ["console", "file"],
  "metadata": {
    "description": "Alert when CPU exceeds 80% for 5 minutes",
    "team": "ops"
  }
}
```

**Parameters:**
- `name` (required): Rule name
- `metric` (required): Metric to monitor
- `condition` (required): Alert condition object
- `severity` (required): `critical`, `high`, `medium`, `low`
- `channels` (required): Array of notification channels
- `metadata` (optional): Custom metadata

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "rule_high_cpu",
    "name": "High CPU Usage",
    "enabled": true,
    "metric": "system.cpu.usage",
    "condition": {
      "operator": ">",
      "threshold": 80,
      "duration": 300
    },
    "severity": "high",
    "channels": ["console", "file"],
    "createdAt": "2026-02-07T14:10:00.000Z",
    "updatedAt": "2026-02-07T14:10:00.000Z"
  }
}
```

---

### Get Alert Rule

Get details of a specific alert rule.

**Endpoint:** `GET /api/v1/alerts/rules/:id`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "rule_high_cpu",
    "name": "High CPU Usage",
    "enabled": true,
    "metric": "system.cpu.usage",
    "condition": {
      "operator": ">",
      "threshold": 80,
      "duration": 300
    },
    "severity": "high",
    "channels": ["console", "file"],
    "stats": {
      "totalAlerts": 15,
      "lastFired": "2026-02-06T18:30:00.000Z"
    },
    "createdAt": "2026-02-01T10:00:00.000Z",
    "updatedAt": "2026-02-01T10:00:00.000Z"
  }
}
```

---

### Update Alert Rule

Update an existing alert rule.

**Endpoint:** `PATCH /api/v1/alerts/rules/:id`

**Request Body:**
```json
{
  "enabled": true,
  "condition": {
    "threshold": 90,
    "duration": 600
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "rule_high_cpu",
    "updated": true
  }
}
```

---

### Delete Alert Rule

Delete an alert rule.

**Endpoint:** `DELETE /api/v1/alerts/rules/:id`

**Response:** `204 No Content`

---

### Get Alert History

Get alert history.

**Endpoint:** `GET /api/v1/alerts/history`

**Query Parameters:**
- `rule`: Filter by rule ID or name
- `severity`: Filter by severity
- `status`: Filter by status (`firing`, `resolved`)
- `since`: Duration string (e.g., "1h", "1d", "7d")
- `page`: Page number
- `limit`: Items per page

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "alert_20260207_140545",
      "rule": "High CPU Usage",
      "severity": "high",
      "status": "resolved",
      "firedAt": "2026-02-07T14:05:45.000Z",
      "resolvedAt": "2026-02-07T14:10:30.000Z",
      "duration": 285000,
      "value": 85.3,
      "threshold": 80,
      "message": "CPU usage exceeded 80% threshold"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50
  }
}
```

---

### Silence Alert Rule

Temporarily silence an alert rule.

**Endpoint:** `POST /api/v1/alerts/rules/:id/silence`

**Request Body:**
```json
{
  "duration": 3600,
  "reason": "Planned maintenance"
}
```

**Parameters:**
- `duration` (required): Silence duration in seconds
- `reason` (optional): Reason for silencing

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "silenced": true,
    "until": "2026-02-07T15:10:00.000Z"
  }
}
```

---

### Get Alerting Configuration

Get current alerting system configuration.

**Endpoint:** `GET /api/v1/alerts/config`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "evaluationInterval": 30,
    "channels": {
      "console": {
        "enabled": true
      },
      "file": {
        "enabled": true,
        "path": "~/.prism-gateway/logs/alerts.log"
      },
      "webhook": {
        "enabled": false
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
  }
}
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `204 No Content` - Request successful, no response body
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

### Error Codes

| Code | Description |
|------|-------------|
| `ERR_1001` | Invalid input parameters |
| `ERR_1002` | Resource not found |
| `ERR_1003` | Authentication failed |
| `ERR_1004` | Insufficient permissions |
| `ERR_1005` | Resource conflict |
| `ERR_1006` | Validation failed |
| `ERR_2001` | Backup creation failed |
| `ERR_2002` | Backup restoration failed |
| `ERR_2003` | Backup verification failed |
| `ERR_3001` | Health check failed |
| `ERR_4001` | Metrics query failed |
| `ERR_4002` | Collector error |
| `ERR_5001` | Alert rule creation failed |
| `ERR_5002` | Alert evaluation failed |

---

## Rate Limiting

### Limits

- **Standard endpoints**: 100 requests/minute per IP
- **Metrics query**: 30 requests/minute per IP
- **Backup operations**: 5 requests/minute per IP

### Headers

Rate limit information is included in response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1675777200
```

### Exceeded Limit Response

```json
{
  "success": false,
  "error": {
    "code": "ERR_RATE_LIMIT",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 100,
      "window": 60,
      "retryAfter": 45
    }
  }
}
```

---

## WebSocket API

For real-time metrics and health updates, use WebSocket connections:

**Endpoint:** `ws://localhost:3000/ws`

**Authentication:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=<jwt-token>');
```

**Subscribe to metrics:**
```json
{
  "type": "subscribe",
  "channel": "metrics",
  "filters": {
    "collectors": ["system", "process"]
  }
}
```

**Real-time metric updates:**
```json
{
  "type": "metric",
  "data": {
    "name": "system.cpu.usage",
    "value": 45.2,
    "timestamp": "2026-02-07T14:05:30.123Z"
  }
}
```

---

## Changelog

### Version 3.0.0 (2026-02-07)
- Initial release of Operations API
- Backup API endpoints
- Health Check API endpoints
- Metrics API endpoints
- Alerting API endpoints

---

**Last Updated**: 2026-02-07
**Version**: 3.0.0
**License**: MIT
