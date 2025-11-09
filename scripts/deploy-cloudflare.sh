#!/usr/bin/env bash
set -euo pipefail

echo "[Cloudflare] 部署 Workers…"
if ! command -v npx >/dev/null 2>&1; then
  echo "请安装 Node.js/npm 后重试"; exit 1;
fi

npx wrangler deploy
echo "[Cloudflare] 部署完成。请记录你的 Worker 域名 (例如 https://<name>.<account>.workers.dev)"