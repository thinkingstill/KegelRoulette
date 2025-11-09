#!/usr/bin/env bash
set -euo pipefail

# 使用方法：
#   WS_BASE=https://<your-worker>.workers.dev ./scripts/deploy-all.sh

echo "[STEP 1/2] 部署 Cloudflare Workers"
./scripts/deploy-cloudflare.sh

echo "[STEP 2/2] 部署 Vercel 前端"
./scripts/deploy-vercel.sh "${WS_BASE:-}"

echo "全部部署完成。请在浏览器访问 Vercel 生成的域名进行验证。"