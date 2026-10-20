#!/bin/bash
# 双击启动本地预览（先关闭旧进程，再启动，保证成功）
cd "$(dirname "$0")" || exit 1

PORT=4173
URL="http://localhost:${PORT}/"
NODE="/usr/local/bin/node"
command -v "$NODE" >/dev/null 2>&1 || NODE=$(command -v node)

echo "=========================================="
echo "  AI Passport 本地预览启动器"
echo "=========================================="
echo ""

# 1) 关闭旧的本地预览进程（按端口找，最可靠）
echo "[1/4] 检查并关闭旧进程..."
PIDS=$(lsof -ti tcp:${PORT} 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "      发现占用端口 ${PORT} 的进程: ${PIDS}"
  kill $PIDS 2>/dev/null
  sleep 1
  # 仍存活则强制杀掉
  PIDS=$(lsof -ti tcp:${PORT} 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "      强制结束: ${PIDS}"
    kill -9 $PIDS 2>/dev/null
    sleep 0.5
  fi
  echo "      旧进程已关闭"
else
  echo "      没有旧进程在运行"
fi

# 2) 启动服务器（后台运行，日志写入文件）
echo "[2/4] 启动本地服务器 (端口 ${PORT})..."
"$NODE" server.js > server.log 2>&1 &
SERVER_PID=$!

# 3) 等待服务器就绪（最多 10 秒）
echo "[3/4] 等待服务器就绪..."
READY=0
for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://localhost:${PORT}/"; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ "$READY" != "1" ]; then
  echo ""
  echo "❌ 启动失败，服务器日志："
  echo "------------------------------------------"
  cat server.log
  echo "------------------------------------------"
  echo "窗口不会自动关闭，方便你查看错误。看完后可直接关闭本窗口。"
  # 等待用户看完错误后手动关闭
  exec osascript -e "display notification \"本地预览启动失败，请查看终端窗口中的日志\" with title \"AI Passport 本地预览\""
  exit 1
fi

# 4) 打开浏览器
echo "[4/4] 打开浏览器..."
open "$URL"

echo ""
echo "✅ 已启动: ${URL}"
echo "   停止服务：直接关闭本窗口，或在本窗口按 Ctrl+C"
echo ""
echo "（本窗口保持运行。最小化即可，关掉窗口服务也会停止。）"

# 前台等待服务器进程，保持窗口开启
wait $SERVER_PID
