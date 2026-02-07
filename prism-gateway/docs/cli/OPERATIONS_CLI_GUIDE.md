# PRISM-Gateway Operations CLI Guide

> Comprehensive guide for Backup, Health Check, Metrics, and Alerting CLI commands

**Version**: 3.0.0
**Last Updated**: 2026-02-07
**Target Users**: System Administrators, DevOps Engineers

---

## Table of Contents

1. [Overview](#overview)
2. [Backup Commands](#backup-commands)
3. [Health Check Commands](#health-check-commands)
4. [Metrics Commands](#metrics-commands)
5. [Alerting Commands](#alerting-commands)
6. [Common Options](#common-options)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

---

## Overview

PRISM-Gateway provides a unified CLI for managing operational tasks:

```bash
prism <command> [subcommand] [options]
```

### Quick Start

```bash
# Check system health
prism health check

# Create a backup
prism backup create --type full

# View metrics
prism metrics list

# Configure alerts
prism alerts config
```

---

## Backup Commands

### `prism backup create`

Create a new backup of PRISM-Gateway data.

**Syntax:**
```bash
prism backup create --type <full|incremental> [options]
```

**Options:**
- `--type, -t <type>` - Backup type: `full` or `incremental` (required)
- `--compression, -c <level>` - Compression level: 0-9 (default: 6)
- `--exclude <patterns>` - Comma-separated glob patterns to exclude
- `--dry-run` - Preview what would be backed up without creating backup
- `--output, -o <path>` - Custom backup output directory

**Examples:**
```bash
# Create full backup with default settings
prism backup create --type full

# Create incremental backup with maximum compression
prism backup create --type incremental --compression 9

# Dry run to preview backup
prism backup create --type full --dry-run

# Exclude temporary files
prism backup create --type full --exclude "*.tmp,*.log"
```

**Output:**
```
✓ Backup created successfully
  ID: backup_20260207_140512
  Type: full
  Size: 45.2 MB (compressed)
  Files: 1,234
  Compression: 72.3%
  Duration: 12.4s
  Location: ~/.prism-gateway/backups/backup_20260207_140512.tar.gz
```

---

### `prism backup list`

List all available backups with metadata.

**Syntax:**
```bash
prism backup list [options]
```

**Options:**
- `--type <full|incremental|all>` - Filter by backup type (default: all)
- `--limit, -n <number>` - Limit number of results (default: 20)
- `--format <table|json|csv>` - Output format (default: table)
- `--sort <field>` - Sort by: `date`, `size`, `type` (default: date)
- `--order <asc|desc>` - Sort order (default: desc)

**Examples:**
```bash
# List all backups
prism backup list

# List only full backups
prism backup list --type full

# List last 5 backups in JSON format
prism backup list --limit 5 --format json

# List backups sorted by size
prism backup list --sort size --order desc
```

**Output (Table Format):**
```
┌────────────────────────────┬──────────────┬──────────┬────────┬───────────────────┐
│ ID                         │ Type         │ Size     │ Files  │ Created           │
├────────────────────────────┼──────────────┼──────────┼────────┼───────────────────┤
│ backup_20260207_140512     │ full         │ 45.2 MB  │ 1,234  │ 2026-02-07 14:05  │
│ backup_20260207_120030     │ incremental  │ 2.1 MB   │ 45     │ 2026-02-07 12:00  │
│ backup_20260206_180015     │ full         │ 42.8 MB  │ 1,189  │ 2026-02-06 18:00  │
└────────────────────────────┴──────────────┴──────────┴────────┴───────────────────┘
```

---

### `prism backup restore`

Restore data from a backup.

**Syntax:**
```bash
prism backup restore <backup-id> [options]
```

**Options:**
- `--target, -t <path>` - Target directory for restoration (default: ~/.prism-gateway)
- `--dry-run` - Preview what would be restored without actual restoration
- `--overwrite` - Overwrite existing files (default: prompt)
- `--verify` - Verify backup integrity before restoration

**Examples:**
```bash
# Restore from specific backup
prism backup restore backup_20260207_140512

# Dry run restoration
prism backup restore backup_20260207_140512 --dry-run

# Restore to custom directory
prism backup restore backup_20260207_140512 --target /tmp/restore

# Verify and restore
prism backup restore backup_20260207_140512 --verify --overwrite
```

**Output:**
```
✓ Verifying backup integrity...
✓ Backup verification passed
✓ Restoring 1,234 files...
  Progress: [████████████████████] 100%
✓ Restoration completed successfully
  Files restored: 1,234
  Total size: 163.4 MB
  Duration: 8.2s
```

---

### `prism backup verify`

Verify backup integrity and checksum.

**Syntax:**
```bash
prism backup verify <backup-id> [options]
```

**Options:**
- `--deep` - Perform deep verification (decompress and check all files)
- `--format <table|json>` - Output format (default: table)

**Examples:**
```bash
# Quick verification
prism backup verify backup_20260207_140512

# Deep verification
prism backup verify backup_20260207_140512 --deep
```

---

### `prism backup delete`

Delete a backup.

**Syntax:**
```bash
prism backup delete <backup-id> [options]
```

**Options:**
- `--force, -f` - Skip confirmation prompt
- `--keep-metadata` - Delete backup file but keep metadata

**Examples:**
```bash
# Delete with confirmation
prism backup delete backup_20260207_140512

# Force delete without confirmation
prism backup delete backup_20260207_140512 --force
```

---

### `prism backup stats`

Display backup statistics and storage usage.

**Syntax:**
```bash
prism backup stats [options]
```

**Options:**
- `--format <table|json>` - Output format (default: table)

**Example:**
```bash
prism backup stats
```

**Output:**
```
Backup Statistics
─────────────────────────────────────────────
Total Backups:        15
  Full:               5
  Incremental:        10

Total Storage:        250.5 MB
  Compressed:         250.5 MB
  Uncompressed:       890.2 MB
  Compression Ratio:  71.9%

Oldest Backup:        2026-01-15 08:30
Newest Backup:        2026-02-07 14:05
Average Size:         16.7 MB
```

---

### `prism backup schedule`

Configure automatic backup scheduling.

**Syntax:**
```bash
prism backup schedule <action> [options]
```

**Actions:**
- `enable` - Enable scheduled backups
- `disable` - Disable scheduled backups
- `status` - Show current schedule
- `config` - Configure schedule parameters

**Options:**
- `--cron <expression>` - Cron expression for schedule (e.g., "0 2 * * *")
- `--type <full|incremental>` - Backup type for scheduled backups
- `--retention <days>` - Retention period in days (default: 30)

**Examples:**
```bash
# Enable daily full backups at 2 AM
prism backup schedule enable --cron "0 2 * * *" --type full

# Show current schedule
prism backup schedule status

# Configure retention
prism backup schedule config --retention 60
```

---

## Health Check Commands

### `prism health check`

Run health checks on all systems.

**Syntax:**
```bash
prism health check [options]
```

**Options:**
- `--systems <names>` - Comma-separated list of systems to check (default: all)
- `--timeout <seconds>` - Timeout for each check (default: 30)
- `--format <table|json>` - Output format (default: table)
- `--verbose, -v` - Show detailed check information

**Available Systems:**
- `system` - System resources (CPU, memory, disk)
- `disk` - Disk space and I/O
- `api` - API server health
- `websocket` - WebSocket server health
- `data` - Data integrity checks
- `service` - Core service health
- `network` - Network connectivity

**Examples:**
```bash
# Check all systems
prism health check

# Check specific systems
prism health check --systems system,disk,api

# Verbose output
prism health check --verbose

# JSON output for scripting
prism health check --format json
```

**Output:**
```
System Health Check Results
───────────────────────────────────────────────────────────
✓ System       healthy   CPU: 45%, Memory: 62%, Uptime: 5d
✓ Disk         healthy   Usage: 45%, I/O: normal
✓ API          healthy   Response time: 15ms, Status: 200
✓ WebSocket    healthy   Connections: 12, Latency: 8ms
✓ Data         healthy   Integrity: OK, Size: 2.3GB
✓ Service      healthy   All services running
✓ Network      healthy   Connectivity: OK, DNS: OK

Overall Status: HEALTHY
Checks Passed: 7/7
Duration: 2.4s
```

---

### `prism health status`

Get current health status summary.

**Syntax:**
```bash
prism health status [options]
```

**Options:**
- `--format <summary|detailed|json>` - Output format (default: summary)

**Examples:**
```bash
# Quick status
prism health status

# Detailed status
prism health status --format detailed
```

---

### `prism health history`

View health check history.

**Syntax:**
```bash
prism health history [options]
```

**Options:**
- `--system <name>` - Filter by system name
- `--status <healthy|degraded|unhealthy>` - Filter by status
- `--limit <number>` - Limit number of results (default: 20)
- `--since <duration>` - Show checks since duration (e.g., "1h", "1d", "7d")
- `--format <table|json>` - Output format (default: table)

**Examples:**
```bash
# Show last 20 checks
prism health history

# Show disk checks from last 24 hours
prism health history --system disk --since 1d

# Show only unhealthy checks
prism health history --status unhealthy
```

---

### `prism health config`

Configure health check system.

**Syntax:**
```bash
prism health config <action> [options]
```

**Actions:**
- `show` - Show current configuration
- `set` - Set configuration parameter
- `reset` - Reset to default configuration

**Examples:**
```bash
# Show configuration
prism health config show

# Set check interval
prism health config set --interval 60

# Set CPU threshold
prism health config set --cpu-threshold 80

# Reset configuration
prism health config reset
```

---

## Metrics Commands

### `prism metrics list`

List all available metrics.

**Syntax:**
```bash
prism metrics list [options]
```

**Options:**
- `--collector <name>` - Filter by collector name
- `--type <gauge|counter|histogram|summary>` - Filter by metric type
- `--format <table|json>` - Output format (default: table)

**Examples:**
```bash
# List all metrics
prism metrics list

# List system metrics
prism metrics list --collector system

# List counter metrics
prism metrics list --type counter
```

**Output:**
```
Available Metrics
─────────────────────────────────────────────────────────────
Collector: system (6 metrics)
  • system.cpu.usage           gauge    CPU usage percentage
  • system.memory.used         gauge    Memory used in bytes
  • system.memory.total        gauge    Total memory in bytes
  • system.memory.percent      gauge    Memory usage percentage
  • system.load.1m             gauge    Load average (1 minute)
  • system.load.5m             gauge    Load average (5 minutes)

Collector: process (7 metrics)
  • process.memory.rss         gauge    RSS memory in bytes
  • process.memory.heap.used   gauge    Heap memory used
  • process.cpu.usage          gauge    Process CPU usage
  • process.uptime             counter  Process uptime in seconds

Collector: api (4 metrics)
  • api.requests.total         counter  Total API requests
  • api.requests.status.2xx    counter  2xx status codes
  • api.requests.status.4xx    counter  4xx status codes
  • api.requests.status.5xx    counter  5xx status codes

Total: 17 metrics across 3 collectors
```

---

### `prism metrics query`

Query metric data over time.

**Syntax:**
```bash
prism metrics query <metric-name> [options]
```

**Options:**
- `--start <timestamp>` - Start time (ISO 8601 or relative like "-1h")
- `--end <timestamp>` - End time (ISO 8601 or "now")
- `--granularity <raw|1m|5m|1h>` - Data granularity (default: auto)
- `--aggregation <avg|sum|min|max|p50|p95|p99>` - Aggregation function
- `--format <table|json|csv>` - Output format (default: table)
- `--limit <number>` - Limit number of data points

**Examples:**
```bash
# Query CPU usage from last hour
prism metrics query system.cpu.usage --start "-1h"

# Query with aggregation
prism metrics query api.requests.total --start "-24h" --aggregation sum

# Query with specific granularity
prism metrics query process.memory.rss --start "-1d" --granularity 5m

# Export to CSV
prism metrics query system.memory.percent --start "-7d" --format csv > memory.csv
```

**Output:**
```
Metric: system.cpu.usage
Period: 2026-02-07 13:00 - 2026-02-07 14:00
Granularity: raw (60 data points)
─────────────────────────────────────────────
2026-02-07 13:00:00  45.2%
2026-02-07 13:01:00  46.8%
2026-02-07 13:02:00  44.5%
...

Summary:
  Average: 45.8%
  Min: 42.1%
  Max: 52.3%
  P95: 50.2%
```

---

### `prism metrics snapshot`

Get real-time snapshot of all current metric values.

**Syntax:**
```bash
prism metrics snapshot [options]
```

**Options:**
- `--collector <name>` - Filter by collector
- `--format <table|json>` - Output format (default: table)

**Examples:**
```bash
# Get all metrics
prism metrics snapshot

# Get system metrics only
prism metrics snapshot --collector system
```

---

### `prism metrics collectors`

Manage metric collectors.

**Syntax:**
```bash
prism metrics collectors <action> [options]
```

**Actions:**
- `list` - List all collectors
- `enable <name>` - Enable a collector
- `disable <name>` - Disable a collector
- `config <name>` - Configure collector

**Examples:**
```bash
# List collectors
prism metrics collectors list

# Disable a collector
prism metrics collectors disable websocket

# Configure collection interval
prism metrics collectors config system --interval 30
```

---

### `prism metrics stats`

Display metrics system statistics.

**Syntax:**
```bash
prism metrics stats [options]
```

**Options:**
- `--format <table|json>` - Output format (default: table)

**Example:**
```bash
prism metrics stats
```

**Output:**
```
Metrics System Statistics
─────────────────────────────────────────────
Active Collectors:    6
Total Metrics:        28
Total Data Points:    145,892

Storage:
  Raw:                12.3 MB (24h retention)
  1-minute:           45.1 MB (7d retention)
  5-minute:           89.6 MB (30d retention)
  1-hour:             156.2 MB (365d retention)
  Total:              303.2 MB

Collection Rate:      28 metrics/min
Storage Growth:       ~15 MB/day
Oldest Data:          2026-01-08 00:00
```

---

## Alerting Commands

### `prism alerts list`

List all configured alert rules.

**Syntax:**
```bash
prism alerts list [options]
```

**Options:**
- `--status <enabled|disabled|all>` - Filter by status (default: all)
- `--severity <critical|high|medium|low>` - Filter by severity
- `--format <table|json>` - Output format (default: table)

**Examples:**
```bash
# List all alerts
prism alerts list

# List enabled critical alerts
prism alerts list --status enabled --severity critical
```

---

### `prism alerts create`

Create a new alert rule.

**Syntax:**
```bash
prism alerts create [options]
```

**Options:**
- `--name <name>` - Alert rule name (required)
- `--metric <name>` - Metric to monitor (required)
- `--condition <expr>` - Condition expression (e.g., "> 80")
- `--duration <seconds>` - Duration threshold (default: 60)
- `--severity <level>` - Severity: critical, high, medium, low (default: medium)
- `--channels <names>` - Comma-separated notification channels

**Examples:**
```bash
# Create CPU usage alert
prism alerts create \
  --name "High CPU Usage" \
  --metric system.cpu.usage \
  --condition "> 80" \
  --duration 300 \
  --severity high \
  --channels console,file

# Create disk space alert
prism alerts create \
  --name "Low Disk Space" \
  --metric system.disk.percent \
  --condition "> 90" \
  --severity critical \
  --channels console,file
```

---

### `prism alerts history`

View alert history.

**Syntax:**
```bash
prism alerts history [options]
```

**Options:**
- `--rule <name>` - Filter by rule name
- `--severity <level>` - Filter by severity
- `--status <firing|resolved>` - Filter by status
- `--since <duration>` - Show alerts since duration
- `--limit <number>` - Limit number of results
- `--format <table|json>` - Output format (default: table)

**Examples:**
```bash
# Show recent alerts
prism alerts history --limit 10

# Show critical alerts from last 24h
prism alerts history --severity critical --since 1d

# Show alerts for specific rule
prism alerts history --rule "High CPU Usage"
```

---

### `prism alerts silence`

Silence an alert rule temporarily.

**Syntax:**
```bash
prism alerts silence <rule-name> [options]
```

**Options:**
- `--duration <duration>` - Silence duration (e.g., "1h", "4h", "1d")
- `--reason <text>` - Reason for silencing (optional)

**Examples:**
```bash
# Silence for 1 hour
prism alerts silence "High CPU Usage" --duration 1h

# Silence with reason
prism alerts silence "Low Disk Space" --duration 4h --reason "Planned maintenance"
```

---

### `prism alerts config`

Configure alerting system.

**Syntax:**
```bash
prism alerts config <action> [options]
```

**Actions:**
- `show` - Show current configuration
- `channels` - Manage notification channels
- `test` - Test alert notifications

**Examples:**
```bash
# Show configuration
prism alerts config show

# List channels
prism alerts config channels list

# Test notifications
prism alerts config test --channel console
```

---

## Common Options

These options work with all commands:

- `--help, -h` - Show command help
- `--version, -v` - Show version information
- `--config <path>` - Use custom config file
- `--verbose` - Enable verbose output
- `--quiet, -q` - Suppress non-essential output
- `--json` - Force JSON output (shorthand for --format json)
- `--no-color` - Disable colored output

**Examples:**
```bash
# Get help for any command
prism backup --help
prism metrics query --help

# Use custom config
prism health check --config /path/to/config.json

# Quiet mode for scripting
prism backup create --type full --quiet
```

---

## Examples

### Daily Operations Workflow

```bash
# 1. Morning health check
prism health check --verbose

# 2. Check metrics from last 24h
prism metrics query system.cpu.usage --start "-24h"
prism metrics query system.memory.percent --start "-24h"

# 3. Review alerts
prism alerts history --since 1d

# 4. Create daily backup
prism backup create --type incremental
```

### Weekly Maintenance

```bash
# 1. Create full backup
prism backup create --type full --compression 9

# 2. Verify all backups
for backup in $(prism backup list --format json | jq -r '.[].id'); do
  prism backup verify $backup
done

# 3. Clean old backups (>30 days)
prism backup list --format json | \
  jq -r 'map(select(.age_days > 30)) | .[].id' | \
  xargs -I {} prism backup delete {} --force

# 4. Review metrics statistics
prism metrics stats

# 5. Export metrics for analysis
prism metrics query api.requests.total --start "-7d" --format csv > weekly-requests.csv
```

### Troubleshooting Scenario

```bash
# 1. Check overall health
prism health check

# 2. Review recent degraded checks
prism health history --status degraded --since 1h

# 3. Check relevant metrics
prism metrics snapshot --collector system

# 4. Review related alerts
prism alerts history --severity high --since 1h

# 5. Create diagnostic backup
prism backup create --type full --output /tmp/diagnostic-backup
```

---

## Troubleshooting

### Backup Issues

**Problem:** Backup creation is slow
```bash
# Solution 1: Use lower compression
prism backup create --type full --compression 3

# Solution 2: Exclude large unnecessary files
prism backup create --type full --exclude "*.log,node_modules/*"
```

**Problem:** Cannot restore backup
```bash
# Solution: Verify backup first
prism backup verify <backup-id> --deep

# If corrupt, try alternate backup
prism backup list --type full
```

### Health Check Issues

**Problem:** Health check times out
```bash
# Solution: Increase timeout
prism health check --timeout 60

# Or check systems individually
prism health check --systems system
prism health check --systems disk
```

**Problem:** Persistent degraded status
```bash
# Solution: Get detailed information
prism health check --verbose --format json

# Check system resources
prism metrics snapshot --collector system
```

### Metrics Issues

**Problem:** Metrics query returns no data
```bash
# Solution 1: Check if metric exists
prism metrics list | grep <metric-name>

# Solution 2: Verify time range
prism metrics stats  # Check "Oldest Data"

# Solution 3: Check collector status
prism metrics collectors list
```

**Problem:** High storage usage
```bash
# Solution: Check stats and adjust retention
prism metrics stats
prism metrics config set --retention-raw 12h
prism metrics config set --retention-1m 3d
```

### Alert Issues

**Problem:** Not receiving alert notifications
```bash
# Solution: Test notification channels
prism alerts config test --channel console
prism alerts config test --channel file

# Check channel configuration
prism alerts config channels list
```

**Problem:** Too many alerts (alert fatigue)
```bash
# Solution 1: Adjust thresholds
prism alerts config set --rule "High CPU Usage" --threshold 90

# Solution 2: Increase duration
prism alerts config set --rule "High CPU Usage" --duration 600

# Solution 3: Temporarily silence
prism alerts silence "High CPU Usage" --duration 1h
```

---

## Getting Help

For more information:

- **General Help**: `prism --help`
- **Command Help**: `prism <command> --help`
- **Full Documentation**: https://docs.prism-gateway.dev
- **Issue Tracker**: https://github.com/prism-gateway/prism-gateway/issues
- **Community**: https://discord.gg/prism-gateway

---

**Last Updated**: 2026-02-07
**Version**: 3.0.0
**License**: MIT
