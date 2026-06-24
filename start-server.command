#!/bin/bash
# 双击此文件启动本地开发服务（含后台保存 / 上传 / AI 文案 API）
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

PORT=8765
URL="http://127.0.0.1:${PORT}/"
ADMIN_URL="http://127.0.0.1:${PORT}/admin.html"

if ! command -v python3 >/dev/null 2>&1; then
  echo ""
  echo "  错误：未找到 python3，请先安装 Python 3。"
  echo ""
  read -r -p "按回车键关闭此窗口…"
  exit 1
fi

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo ""
  echo "  端口 ${PORT} 已有服务在运行。"
  echo "  主页: ${URL}"
  echo "  后台: ${ADMIN_URL}"
  echo ""
  open "$URL" 2>/dev/null || true
  read -r -p "按回车键关闭此窗口…"
  exit 0
fi

echo ""
echo "  作品集站点正在启动…"
echo "  主页: ${URL}"
echo "  后台: ${ADMIN_URL}"
echo "  按 Ctrl+C 可停止服务（关闭此终端窗口也会停止）"
echo ""

(sleep 1 && open "$URL") &

exec python3 "$DIR/dev-server.py"
