# PRISM-Gateway Operations Troubleshooting Guide

> Comprehensive guide for diagnosing and resolving issues with Backup, Health Check, Metrics, and Alerting systems

**Version**: 3.0.0
**Last Updated**: 2026-02-07
**Target Audience**: System Administrators, DevOps Engineers

---

## Table of Contents

1. [General Troubleshooting Approach](#general-troubleshooting-approach)
2. [Backup System Issues](#backup-system-issues)
3. [Health Check Issues](#health-check-issues)
4. [Metrics System Issues](#metrics-system-issues)
5. [Alerting System Issues](#alerting-system-issues)
6. [Performance Issues](#performance-issues)
7. [Storage Issues](#storage-issues)
8. [Network Issues](#network-issues)
9. [Common Error Messages](#common-error-messages)
10. [Diagnostic Tools](#diagnostic-tools)

---

## General Troubleshooting Approach

### Step-by-Step Diagnostic Process

1. **Identify the Problem**
   - What is not working?
   - When did it start?
   - What changed recently?

2. **Check System Health**
   ```bash
   prism health check --verbose
   ```

3. **Review Logs**
   ```bash
   tail -f ~/.prism-gateway/logs/prism-gateway.log
   tail -f ~/.prism-gateway/logs/errors.log
   ```

4. **Check Resource Usage**
   ```bash
   prism metrics snapshot --collector system
   ```

5. **Verify Configuration**
   ```bash
   cat ~/.prism-gateway/config.json
   ```

6. **Test Connectivity**
   ```bash
   prism health check --systems network
   ```

### Quick Health Check Commands

```bash
# Overall system status
prism health status

# Detailed health check
prism health check --verbose

# Check specific subsystem
prism health check --systems <system-name>

# Review recent health issues
prism health history --status degraded --since 1h
```

---

## Backup System Issues

### Issue: Backup Creation Fails

**Symptoms:**
- Backup command returns error
- No backup file created
- Partial backup files left behind

**Possible Causes:**
1. Insufficient disk space
2. Permission issues
3. Corrupted source files
4. Process interrupted

**Diagnostic Steps:**

```bash
# 1. Check disk space
df -h ~/.prism-gateway/backups

# 2. Check permissions
ls -la ~/.prism-gateway/backups

# 3. Try dry run
prism backup create --type full --dry-run

# 4. Check logs
tail -100 ~/.prism-gateway/logs/backup.log | grep ERROR
```

**Solutions:**

**Solution 1: Free Up Disk Space**
```bash
# Delete old backups
prism backup list --sort created_at --order asc
prism backup delete <old-backup-id> --force

# Or use automatic cleanup
prism backup schedule config --retention 30
```

**Solution 2: Fix Permissions**
```bash
# Ensure backup directory is writable
chmod 755 ~/.prism-gateway/backups
chown $USER ~/.prism-gateway/backups
```

**Solution 3: Exclude Problematic Files**
```bash
# Create backup excluding problematic files
prism backup create --type full --exclude "*.corrupted,bad-dir/*"
```

---

### Issue: Backup is Too Slow

**Symptoms:**
- Backup takes longer than expected
- System becomes unresponsive during backup
- Timeout errors

**Possible Causes:**
1. Large number of files
2. High compression level
3. Slow disk I/O
4. Insufficient system resources

**Diagnostic Steps:**

```bash
# 1. Check system resources during backup
prism metrics query system.cpu.usage --start "-1h"
prism metrics query system.disk.io --start "-1h"

# 2. Check backup stats
prism backup stats

# 3. Test with lower compression
time prism backup create --type full --compression 3 --dry-run
```

**Solutions:**

**Solution 1: Reduce Compression Level**
```bash
# Use lower compression (faster, larger files)
prism backup create --type full --compression 3
```

**Solution 2: Use Incremental Backups**
```bash
# After initial full backup, use incremental
prism backup create --type incremental
```

**Solution 3: Exclude Large Unnecessary Files**
```bash
# Exclude logs, temp files, caches
prism backup create --type full --exclude "*.log,*.tmp,cache/*,node_modules/*"
```

**Solution 4: Schedule During Off-Peak Hours**
```bash
# Schedule backups at night
prism backup schedule enable --cron "0 2 * * *" --type incremental
```

---

### Issue: Backup Restoration Fails

**Symptoms:**
- Restoration command fails
- Partial restoration
- Corrupted files after restoration

**Possible Causes:**
1. Corrupted backup file
2. Insufficient disk space
3. Permission issues
4. File conflicts

**Diagnostic Steps:**

```bash
# 1. Verify backup integrity
prism backup verify <backup-id> --deep

# 2. Check available disk space
df -h ~/.prism-gateway

# 3. Check logs
tail -100 ~/.prism-gateway/logs/backup.log | grep ERROR

# 4. Try dry run
prism backup restore <backup-id> --dry-run
```

**Solutions:**

**Solution 1: Verify and Repair Backup**
```bash
# Verify backup
prism backup verify <backup-id> --deep

# If corrupted, try another backup
prism backup list --type full
prism backup verify <alternative-backup-id>
```

**Solution 2: Restore to Alternative Location**
```bash
# Restore to temporary location first
prism backup restore <backup-id> --target /tmp/restore

# Then manually copy files
cp -r /tmp/restore/* ~/.prism-gateway/
```

**Solution 3: Force Overwrite**
```bash
# Overwrite existing files
prism backup restore <backup-id> --overwrite
```

---

### Issue: Cannot Delete Backup

**Symptoms:**
- Delete command fails
- Backup file still exists after deletion
- Permission denied errors

**Diagnostic Steps:**

```bash
# 1. Check backup status
prism backup list

# 2. Check file permissions
ls -la ~/.prism-gateway/backups/<backup-id>*

# 3. Check if file is in use
lsof | grep backup
```

**Solutions:**

**Solution 1: Force Delete**
```bash
# Force delete without confirmation
prism backup delete <backup-id> --force
```

**Solution 2: Manual Deletion**
```bash
# Delete files manually
rm -f ~/.prism-gateway/backups/<backup-id>*
rm -f ~/.prism-gateway/metadata/backups/<backup-id>.json
```

---

## Health Check Issues

### Issue: Health Check Times Out

**Symptoms:**
- Health check command hangs
- Timeout error after 30+ seconds
- Some systems not responding

**Possible Causes:**
1. System under heavy load
2. Network connectivity issues
3. Disk I/O bottleneck
4. Service not responding

**Diagnostic Steps:**

```bash
# 1. Check system load
prism metrics snapshot --collector system

# 2. Test individual systems
prism health check --systems system
prism health check --systems disk
prism health check --systems api

# 3. Increase timeout
prism health check --timeout 60

# 4. Check logs
tail -100 ~/.prism-gateway/logs/health.log
```

**Solutions:**

**Solution 1: Increase Timeout**
```bash
# Set longer timeout
prism health config set --timeout 60

# Or use command-line option
prism health check --timeout 90
```

**Solution 2: Disable Slow Checkers**
```bash
# Disable specific checker temporarily
prism health config set --disable-systems network,websocket

# Run health check
prism health check

# Re-enable later
prism health config set --enable-systems network,websocket
```

**Solution 3: Reduce Check Frequency**
```bash
# Reduce automatic check frequency
prism health config set --interval 300  # 5 minutes
```

---

### Issue: Persistent Degraded Health Status

**Symptoms:**
- Health checks always show degraded
- Specific system always unhealthy
- No obvious errors in logs

**Possible Causes:**
1. Threshold too strict
2. Genuine system issue
3. Resource constraints
4. Configuration problem

**Diagnostic Steps:**

```bash
# 1. Get detailed health information
prism health check --verbose --format json

# 2. Check current thresholds
prism health config show

# 3. Review health history
prism health history --system <system-name> --since 24h

# 4. Check relevant metrics
prism metrics query <relevant-metric> --start "-1h"
```

**Solutions:**

**Solution 1: Adjust Thresholds**
```bash
# Example: Increase CPU threshold
prism health config set --cpu-threshold 90

# Example: Increase memory threshold
prism health config set --memory-threshold 90

# Example: Increase disk threshold
prism health config set --disk-threshold 95
```

**Solution 2: Investigate Root Cause**
```bash
# Check system metrics
prism metrics snapshot --collector system

# Check disk usage
df -h

# Check memory usage
free -h

# Check CPU usage
top -bn1 | head -20
```

**Solution 3: Optimize System Resources**
```bash
# Clear caches
prism metrics collectors disable --name websocket  # If not needed

# Reduce metric collection frequency
prism metrics collectors config system --interval 30

# Clean old data
prism metrics storage cleanup --older-than 30d
```

---

### Issue: Health Check Doesn't Detect Issues

**Symptoms:**
- Health check shows healthy but system has issues
- Alerts not firing when expected
- Missing health checks in history

**Possible Causes:**
1. Check interval too long
2. Thresholds too lenient
3. Checks disabled
4. Service not running

**Diagnostic Steps:**

```bash
# 1. Verify check is enabled
prism health config show

# 2. Check current status
prism health status

# 3. Force immediate check
prism health check --verbose

# 4. Review configuration
cat ~/.prism-gateway/config.json | jq '.health'
```

**Solutions:**

**Solution 1: Reduce Check Interval**
```bash
# Check more frequently
prism health config set --interval 30  # 30 seconds
```

**Solution 2: Tighten Thresholds**
```bash
# More conservative thresholds
prism health config set --cpu-threshold 70
prism health config set --memory-threshold 80
prism health config set --disk-threshold 85
```

**Solution 3: Enable Disabled Checks**
```bash
# Enable all systems
prism health config set --enable-all
```

---

## Metrics System Issues

### Issue: No Metrics Data Available

**Symptoms:**
- Metrics query returns empty results
- No data points in time range
- Snapshot shows no metrics

**Possible Causes:**
1. Collectors disabled
2. Collection not started
3. Storage issues
4. Time range incorrect

**Diagnostic Steps:**

```bash
# 1. Check collector status
prism metrics collectors list

# 2. Check if service is running
prism health check --systems service

# 3. Check storage
ls -la ~/.prism-gateway/data/metrics/

# 4. Check stats
prism metrics stats
```

**Solutions:**

**Solution 1: Enable Collectors**
```bash
# Enable all collectors
prism metrics collectors enable system
prism metrics collectors enable process
prism metrics collectors enable api

# Or enable all at once
prism metrics config set --enable-all-collectors
```

**Solution 2: Restart Metrics Service**
```bash
# Restart PRISM-Gateway
systemctl restart prism-gateway
# Or if running manually:
# Kill and restart the process
```

**Solution 3: Check Storage Permissions**
```bash
# Ensure metrics directory is writable
chmod 755 ~/.prism-gateway/data/metrics
chown -R $USER ~/.prism-gateway/data/metrics
```

---

### Issue: Metrics Query is Slow

**Symptoms:**
- Query takes a long time
- API times out
- High CPU during queries

**Possible Causes:**
1. Large time range
2. High granularity (raw data)
3. Storage fragmentation
4. Too many data points

**Diagnostic Steps:**

```bash
# 1. Check query parameters
# Review time range and granularity

# 2. Check storage size
prism metrics stats

# 3. Monitor system during query
prism metrics query <metric> --start "-24h" &
prism metrics snapshot --collector system
```

**Solutions:**

**Solution 1: Use Appropriate Granularity**
```bash
# For long time ranges, use aggregated data
prism metrics query system.cpu.usage --start "-30d" --granularity 1h

# Instead of raw data
# prism metrics query system.cpu.usage --start "-30d" --granularity raw
```

**Solution 2: Limit Data Points**
```bash
# Limit number of results
prism metrics query system.cpu.usage --start "-7d" --limit 100
```

**Solution 3: Aggregate Data**
```bash
# Use aggregation to reduce data points
prism metrics query api.requests.total --start "-24h" --aggregation sum
```

**Solution 4: Cleanup Old Data**
```bash
# Clean old raw data more frequently
prism metrics config set --retention-raw 12h
prism metrics config set --retention-1m 3d
prism metrics config set --retention-5m 7d
```

---

### Issue: High Storage Usage

**Symptoms:**
- Metrics taking up too much disk space
- Disk full errors
- Slow metrics performance

**Possible Causes:**
1. Retention period too long
2. Too many collectors enabled
3. High collection frequency
4. No automatic cleanup

**Diagnostic Steps:**

```bash
# 1. Check metrics storage
prism metrics stats

# 2. Check disk usage
du -sh ~/.prism-gateway/data/metrics/*

# 3. Check retention configuration
prism metrics config show
```

**Solutions:**

**Solution 1: Adjust Retention Policies**
```bash
# Reduce retention periods
prism metrics config set --retention-raw 12h     # Default: 24h
prism metrics config set --retention-1m 3d       # Default: 7d
prism metrics config set --retention-5m 14d      # Default: 30d
prism metrics config set --retention-1h 90d      # Default: 365d
```

**Solution 2: Disable Unnecessary Collectors**
```bash
# Disable collectors you don't need
prism metrics collectors disable websocket
prism metrics collectors disable business
```

**Solution 3: Increase Collection Intervals**
```bash
# Collect less frequently
prism metrics collectors config system --interval 30   # Default: 10
prism metrics collectors config process --interval 30  # Default: 10
```

**Solution 4: Manual Cleanup**
```bash
# Clean old data manually
prism metrics storage cleanup --older-than 30d

# Or remove specific granularity
rm -rf ~/.prism-gateway/data/metrics/raw/*
# Note: Aggregated data will remain
```

---

### Issue: Metrics Not Being Collected

**Symptoms:**
- Specific metrics missing
- Collector shows 0 collections
- No recent data points

**Possible Causes:**
1. Collector disabled
2. Collector error
3. Permission issues
4. System resource unavailable

**Diagnostic Steps:**

```bash
# 1. Check collector status
prism metrics collectors list

# 2. Check collector errors
prism metrics collectors list --format json | jq '.[] | select(.errorCount > 0)'

# 3. Test collector manually
prism metrics snapshot --collector <collector-name>

# 4. Check logs
tail -100 ~/.prism-gateway/logs/metrics.log | grep ERROR
```

**Solutions:**

**Solution 1: Enable Collector**
```bash
# Enable specific collector
prism metrics collectors enable <collector-name>
```

**Solution 2: Reset Collector**
```bash
# Reset collector to clear errors
prism metrics collectors reset <collector-name>
```

**Solution 3: Check Permissions**
```bash
# Ensure process has permission to collect system metrics
# Some metrics may require elevated privileges
```

---

## Alerting System Issues

### Issue: Alerts Not Firing

**Symptoms:**
- No alerts generated
- Alert should have fired but didn't
- Alert history empty

**Possible Causes:**
1. Alert rule disabled
2. Threshold not met
3. Duration too long
4. Alert silenced
5. Notification channels disabled

**Diagnostic Steps:**

```bash
# 1. Check alert rule status
prism alerts list

# 2. Check current metric value
prism metrics query <metric-name> --start "-1h"

# 3. Check alert history
prism alerts history --rule "<rule-name>" --since 24h

# 4. Check if rule is silenced
prism alerts list --format json | jq '.[] | select(.silenced == true)'

# 5. Check notification channels
prism alerts config show
```

**Solutions:**

**Solution 1: Enable Alert Rule**
```bash
# Enable disabled rule
prism alerts enable <rule-name>
```

**Solution 2: Adjust Threshold**
```bash
# Lower threshold to make more sensitive
prism alerts update <rule-name> --threshold 70  # Was 80
```

**Solution 3: Reduce Duration**
```bash
# Reduce duration for faster alerts
prism alerts update <rule-name> --duration 60  # Was 300
```

**Solution 4: Un-silence Rule**
```bash
# Remove silence
prism alerts unsilence <rule-name>
```

**Solution 5: Enable Notification Channels**
```bash
# Enable console notifications
prism alerts config channels enable console

# Enable file notifications
prism alerts config channels enable file
```

---

### Issue: Too Many Alerts (Alert Fatigue)

**Symptoms:**
- Constant alert notifications
- Same alert firing repeatedly
- Alert floods

**Possible Causes:**
1. Threshold too sensitive
2. Duration too short
3. Flapping metric values
4. No deduplication

**Diagnostic Steps:**

```bash
# 1. Check alert frequency
prism alerts history --since 24h

# 2. Check metric stability
prism metrics query <metric-name> --start "-1h"

# 3. Check alert configuration
prism alerts list --format json | jq '.[] | select(.name == "<rule-name>")'

# 4. Check deduplication settings
prism alerts config show
```

**Solutions:**

**Solution 1: Increase Threshold**
```bash
# Make threshold less sensitive
prism alerts update <rule-name> --threshold 90  # Was 80
```

**Solution 2: Increase Duration**
```bash
# Require threshold breach for longer period
prism alerts update <rule-name> --duration 600  # Was 300
```

**Solution 3: Enable Deduplication**
```bash
# Enable alert deduplication
prism alerts config set --deduplication-enabled true
prism alerts config set --deduplication-window 300
```

**Solution 4: Enable Alert Aggregation**
```bash
# Aggregate multiple alerts
prism alerts config set --aggregation-enabled true
prism alerts config set --aggregation-window 60
```

**Solution 5: Temporarily Silence**
```bash
# Silence alert during investigation
prism alerts silence <rule-name> --duration 1h --reason "Investigating root cause"
```

---

### Issue: Alert Notifications Not Received

**Symptoms:**
- Alerts firing but no notifications
- Notification channel shows errors
- Partial notifications

**Possible Causes:**
1. Channel disabled
2. Channel configuration incorrect
3. Permission issues
4. Network issues (for webhook)

**Diagnostic Steps:**

```bash
# 1. Check alert history (did it fire?)
prism alerts history --rule "<rule-name>"

# 2. Check channel status
prism alerts config channels list

# 3. Test notification
prism alerts config test --channel console

# 4. Check logs
tail -100 ~/.prism-gateway/logs/alerts.log | grep ERROR
```

**Solutions:**

**Solution 1: Enable Channel**
```bash
# Enable notification channel
prism alerts config channels enable console
prism alerts config channels enable file
```

**Solution 2: Fix Channel Configuration**
```bash
# For file channel
prism alerts config channels config file --path ~/.prism-gateway/logs/alerts.log

# For webhook channel
prism alerts config channels config webhook --url https://hooks.example.com/alerts
```

**Solution 3: Check Permissions**
```bash
# Ensure log file is writable
touch ~/.prism-gateway/logs/alerts.log
chmod 644 ~/.prism-gateway/logs/alerts.log
```

**Solution 4: Test Notification**
```bash
# Send test alert
prism alerts config test --channel file --message "Test alert"
```

---

## Performance Issues

### Issue: High CPU Usage

**Symptoms:**
- PRISM-Gateway using excessive CPU
- System sluggish
- High system load

**Diagnostic Steps:**

```bash
# 1. Check PRISM-Gateway CPU usage
prism metrics query process.cpu.usage --start "-1h"

# 2. Check system CPU
prism metrics query system.cpu.usage --start "-1h"

# 3. Check active collectors
prism metrics collectors list

# 4. Check query frequency
tail -100 ~/.prism-gateway/logs/metrics.log | grep "Query"
```

**Solutions:**

**Solution 1: Reduce Collection Frequency**
```bash
# Increase collection intervals
prism metrics collectors config system --interval 30
prism metrics collectors config process --interval 30
```

**Solution 2: Disable Expensive Collectors**
```bash
# Disable collectors you don't need
prism metrics collectors disable business
prism metrics collectors disable data
```

**Solution 3: Reduce Health Check Frequency**
```bash
# Check less often
prism health config set --interval 120
```

**Solution 4: Optimize Query Patterns**
```bash
# Use aggregated data instead of raw
# Use appropriate granularity
# Limit time ranges
```

---

### Issue: High Memory Usage

**Symptoms:**
- PRISM-Gateway using excessive memory
- Memory warnings
- OOM errors

**Diagnostic Steps:**

```bash
# 1. Check memory usage
prism metrics query process.memory.rss --start "-1h"

# 2. Check cache size
prism metrics stats

# 3. Check active connections
prism metrics query websocket.connections --start "-1h"
```

**Solutions:**

**Solution 1: Reduce Cache Size**
```bash
# Configure smaller cache
prism metrics config set --cache-size 1000  # Default: 10000
```

**Solution 2: Cleanup Old Data**
```bash
# Remove old metrics data
prism metrics storage cleanup --older-than 30d
```

**Solution 3: Restart Service**
```bash
# Restart to clear memory
systemctl restart prism-gateway
```

---

## Storage Issues

### Issue: Disk Full

**Symptoms:**
- "No space left on device" errors
- Cannot create backups
- Cannot write metrics

**Diagnostic Steps:**

```bash
# 1. Check disk usage
df -h ~/.prism-gateway

# 2. Check what's using space
du -sh ~/.prism-gateway/*
du -sh ~/.prism-gateway/backups/*
du -sh ~/.prism-gateway/data/metrics/*

# 3. Check backup stats
prism backup stats

# 4. Check metrics stats
prism metrics stats
```

**Solutions:**

**Solution 1: Delete Old Backups**
```bash
# List old backups
prism backup list --sort created_at --order asc

# Delete old backups
prism backup delete <backup-id> --force

# Configure automatic cleanup
prism backup schedule config --retention 30
```

**Solution 2: Cleanup Metrics Data**
```bash
# Remove old metrics
prism metrics storage cleanup --older-than 30d

# Reduce retention
prism metrics config set --retention-raw 12h
prism metrics config set --retention-1m 3d
```

**Solution 3: Move Data to Larger Disk**
```bash
# Move data directory
mv ~/.prism-gateway/data /larger/disk/prism-data
ln -s /larger/disk/prism-data ~/.prism-gateway/data

# Update configuration
prism config set --data-path /larger/disk/prism-data
```

---

## Network Issues

### Issue: API Not Responding

**Symptoms:**
- API requests timeout
- Connection refused errors
- 503 Service Unavailable

**Diagnostic Steps:**

```bash
# 1. Check if service is running
prism health check --systems api

# 2. Check if port is listening
netstat -tlnp | grep 3000

# 3. Test local connection
curl http://localhost:3000/api/v1/health

# 4. Check logs
tail -100 ~/.prism-gateway/logs/api.log
```

**Solutions:**

**Solution 1: Restart API Server**
```bash
# Restart service
systemctl restart prism-gateway
```

**Solution 2: Check Port Binding**
```bash
# Ensure port is not in use
lsof -i :3000

# Kill process if needed
kill <pid>
```

**Solution 3: Check Firewall**
```bash
# Allow port through firewall
sudo ufw allow 3000/tcp
```

---

## Common Error Messages

### `ERR_1001: Invalid input parameters`

**Cause**: Invalid or missing request parameters

**Solution**:
```bash
# Check parameter format and requirements
prism <command> --help

# Ensure all required parameters are provided
# Verify parameter values are in correct format
```

---

### `ERR_2001: Backup creation failed`

**Cause**: Backup process encountered an error

**Solution**:
```bash
# Check disk space
df -h ~/.prism-gateway/backups

# Check logs
tail -100 ~/.prism-gateway/logs/backup.log

# Try with dry-run
prism backup create --type full --dry-run

# Exclude problematic files
prism backup create --type full --exclude "*.tmp"
```

---

### `ERR_3001: Health check failed`

**Cause**: One or more health checks failed

**Solution**:
```bash
# Get detailed information
prism health check --verbose

# Check individual systems
prism health check --systems <system-name>

# Review recent issues
prism health history --status unhealthy --since 1h
```

---

### `ERR_4001: Metrics query failed`

**Cause**: Metrics query encountered an error

**Solution**:
```bash
# Verify metric exists
prism metrics list | grep <metric-name>

# Check time range
prism metrics stats  # See "Oldest Data"

# Use appropriate granularity
prism metrics query <metric> --start "-24h" --granularity 1m

# Limit results
prism metrics query <metric> --start "-7d" --limit 100
```

---

## Diagnostic Tools

### Comprehensive System Report

Generate a complete diagnostic report:

```bash
#!/bin/bash
# diagnostic-report.sh

echo "=== PRISM-Gateway Diagnostic Report ==="
echo "Generated: $(date)"
echo

echo "=== System Health ==="
prism health check --verbose
echo

echo "=== Metrics Stats ==="
prism metrics stats
echo

echo "=== Backup Stats ==="
prism backup stats
echo

echo "=== Alert Status ==="
prism alerts list
echo

echo "=== Disk Usage ==="
df -h ~/.prism-gateway
du -sh ~/.prism-gateway/*
echo

echo "=== Recent Errors ==="
tail -50 ~/.prism-gateway/logs/errors.log
echo

echo "=== Process Info ==="
ps aux | grep prism-gateway
echo

echo "=== Network Status ==="
netstat -tlnp | grep prism
echo

echo "=== Configuration ==="
cat ~/.prism-gateway/config.json
```

Run the report:
```bash
bash diagnostic-report.sh > diagnostic-$(date +%Y%m%d-%H%M%S).txt
```

---

### Log Analysis Script

Analyze logs for common issues:

```bash
#!/bin/bash
# analyze-logs.sh

LOG_DIR=~/.prism-gateway/logs

echo "=== Error Summary (Last 24 hours) ==="
find $LOG_DIR -name "*.log" -mtime -1 -exec grep -i error {} \; | sort | uniq -c | sort -rn
echo

echo "=== Warning Summary (Last 24 hours) ==="
find $LOG_DIR -name "*.log" -mtime -1 -exec grep -i warning {} \; | sort | uniq -c | sort -rn
echo

echo "=== Top Errors ==="
find $LOG_DIR -name "*.log" -mtime -1 -exec grep -i "ERR_" {} \; | cut -d: -f4 | sort | uniq -c | sort -rn | head -10
echo

echo "=== Failed Operations ==="
find $LOG_DIR -name "*.log" -mtime -1 -exec grep -i "failed" {} \; | tail -20
```

---

### Performance Monitor

Monitor system performance in real-time:

```bash
#!/bin/bash
# monitor-performance.sh

while true; do
  clear
  echo "=== PRISM-Gateway Performance Monitor ==="
  echo "Time: $(date)"
  echo

  echo "System Metrics:"
  prism metrics snapshot --collector system | grep -E "cpu|memory|disk"
  echo

  echo "Process Metrics:"
  prism metrics snapshot --collector process | grep -E "memory|cpu"
  echo

  echo "Health Status:"
  prism health status
  echo

  sleep 5
done
```

---

## Getting Additional Help

### Resources

- **Documentation**: https://docs.prism-gateway.dev
- **GitHub Issues**: https://github.com/prism-gateway/prism-gateway/issues
- **Community Discord**: https://discord.gg/prism-gateway
- **Email Support**: support@prism-gateway.dev

### Reporting Issues

When reporting issues, include:

1. **Environment Information**
   ```bash
   prism --version
   uname -a
   node --version  # or bun --version
   ```

2. **Diagnostic Report**
   ```bash
   bash diagnostic-report.sh > report.txt
   ```

3. **Relevant Logs**
   ```bash
   tail -100 ~/.prism-gateway/logs/errors.log
   ```

4. **Steps to Reproduce**
   - What command was run
   - Expected vs actual result
   - Any error messages

5. **Configuration** (sanitize sensitive data)
   ```bash
   cat ~/.prism-gateway/config.json
   ```

---

**Last Updated**: 2026-02-07
**Version**: 3.0.0
**License**: MIT
