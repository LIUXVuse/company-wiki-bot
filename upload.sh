#!/bin/bash
# 上傳文件到知識庫
# 用法：./upload.sh /path/to/pdf資料夾/
#       ./upload.sh /path/to/單一檔案.pdf

set -e

# 讀取 .env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 找不到 .env 檔"
  echo "   請執行：cp .env.example .env"
  echo "   然後填入你的 INGEST_SECRET"
  exit 1
fi

source "$ENV_FILE"

if [ -z "$INGEST_SECRET" ] || [ "$INGEST_SECRET" = "你的金鑰填這裡" ]; then
  echo "❌ 請先在 .env 填入正確的 INGEST_SECRET"
  exit 1
fi

if [ -z "$1" ]; then
  echo "用法：./upload.sh /path/to/PDF資料夾/"
  echo "      ./upload.sh /path/to/單一檔案.pdf"
  exit 1
fi

# 找 Python
PYTHON=""
for p in /opt/homebrew/bin/python3 /usr/local/bin/python3 python3 python; do
  if command -v "$p" &>/dev/null; then
    PYTHON="$p"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "❌ 找不到 Python，請先安裝 Python 3"
  exit 1
fi

echo "🚀 使用 Python：$PYTHON"

INGEST_SECRET="$INGEST_SECRET" BOT_URL="$BOT_URL" "$PYTHON" "$SCRIPT_DIR/scripts/ingest_pdfs.py" "$1"
