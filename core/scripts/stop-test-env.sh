#!/bin/bash
# PRISM-Gateway 测试环境停止脚本
#
# @description
# 停止测试服务器并清理资源

set -e

PID_FILE="/tmp/prism-test-api.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat $PID_FILE)
  echo "正在停止测试服务器 (PID: $PID)..."
  kill $PID 2>/dev/null || echo "进程已停止"
  rm -f $PID_FILE
  echo "✅ 测试服务器已停止"
else
  echo "未找到测试服务器 PID 文件"
  echo "尝试查找并停止运行中的服务器..."

  # 查找可能的服务器进程
  PIDS=$(lsof -ti :3000 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "发现端口 3000 上的进程: $PIDS"
    echo $PIDS | xargs kill 2>/dev/null || true
    echo "✅ 已停止"
  else
    echo "没有发现运行中的服务器"
  fi
fi
