#!/usr/bin/env bash
set -euo pipefail

# 使用方法：
#   WS_BASE=https://<your-worker>.workers.dev ./scripts/deploy-vercel.sh
# 或传参：
#   ./scripts/deploy-vercel.sh https://<your-worker>.workers.dev

WS_BASE_ENV=${WS_BASE:-${1:-}}
if [ -z "$WS_BASE_ENV" ]; then
  echo "请提供 Cloudflare Worker 地址作为 NEXT_PUBLIC_WS_BASE";
  echo "示例：WS_BASE=https://kegel-roulette-worker.<your>.workers.dev ./scripts/deploy-vercel.sh";
  exit 1;
fi

echo "[Vercel] 设置环境变量 NEXT_PUBLIC_WS_BASE=${WS_BASE_ENV}（preview/production）"
if ! command -v npx >/dev/null 2>&1; then
  echo "请安装 Node.js/npm 后重试"; exit 1;
fi

# 非交互设置环境变量到 Vercel（需已链接项目）
npx vercel env set NEXT_PUBLIC_WS_BASE "$WS_BASE_ENV" production --yes || true
npx vercel env set NEXT_PUBLIC_WS_BASE "$WS_BASE_ENV" preview --yes || true

echo "[Vercel] 构建并部署生产环境"
npm run build
npx vercel deploy --prod --yes
echo "[Vercel] 部署完成"