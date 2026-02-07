#!/bin/bash
# PRISM-Gateway 测试环境启动脚本
#
# @description
# 启动 API 服务器用于 E2E 测试
#
# @usage
#   ./scripts/start-test-env.sh [--port PORT] [--background]
#
# @example
#   # 前台运行（默认）
#   ./scripts/start-test-env.sh
#
#   # 后台运行
#   ./scripts/start-test-env.sh --background
#
#   # 指定端口
#   ./scripts/start-test-env.sh --port 3000

set -e

# 默认配置
PORT=${PORT:-3000}
HOSTNAME=${HOSTNAME:-0.0.0.0}
BACKGROUND=false
PID_FILE="/tmp/prism-test-api.pid"

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --port)
      PORT="$2"
      shift 2
      ;;
    --background)
      BACKGROUND=true
      shift
      ;;
    --help)
      echo "Usage: $0 [--port PORT] [--background]"
      echo ""
      echo "Options:"
      echo "  --port PORT       指定端口号（默认: 3000）"
      echo "  --background      后台运行服务器"
      echo "  --help            显示帮助信息"
      exit 0
      ;;
    *)
      echo "未知参数: $1"
      echo "使用 --help 查看帮助"
      exit 1
      ;;
  esac
done

# 检查端口是否被占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "错误: 端口 $PORT 已被占用"
  echo "请检查是否有其他实例正在运行，或使用不同的端口"
  exit 1
fi

# 进入项目目录
cd "$(dirname "$0")/.."

# 设置环境变量
export NODE_ENV=test
export PORT=$PORT
export HOSTNAME=$HOSTNAME

echo "正在启动 PRISM-Gateway 测试服务器..."
echo "端口: $PORT"
echo "主机: $HOSTNAME"
echo ""

if [ "$BACKGROUND" = true ]; then
  # 后台运行
  bun run src/api/server.ts > /tmp/prism-test-server.log 2>&1 &
  API_PID=$!

  # 保存 PID
  echo $API_PID > $PID_FILE

  # 等待服务器启动
  echo "等待服务器启动..."
  for i in {1..30}; do
    if curl -f http://localhost:$PORT/health >/dev/null 2>&1; then
      echo ""
      echo "✅ 服务器已启动 (PID: $API_PID)"
      echo "   日志文件: /tmp/prism-test-server.log"
      echo "   PID 文件: $PID_FILE"
      echo ""
      echo "健康检查: http://localhost:$PORT/health"
      echo "Dashboard:  http://localhost:$PORT/ui/index.html"
      echo "API:        http://localhost:$PORT/api/v1"
      echo ""
      echo "停止服务器: kill $API_PID 或 ./scripts/stop-test-env.sh"
      exit 0
    fi
    echo -n "."
    sleep 0.5
  done

  echo ""
  echo "❌ 服务器启动超时"
  kill $API_PID 2>/dev/null || true
  rm -f $PID_FILE
  exit 1
else
  # 前台运行
  exec bun run src/api/server.ts
fi
