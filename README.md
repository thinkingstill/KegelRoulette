# KegelRoulette

一个基于 Next.js 的多人“凯格尔运动轮盘”小应用。前端可部署在 Vercel 或 Cloudflare Pages，实时后端运行于 Cloudflare Workers（Durable Object）。支持创建/加入房间、轮盘随机抽取、完成次数统计、心跳保活与断线宽限期。

## 功能特性

- 创建房间与加入房间（昵称与头像种子随机）
- 轮盘随机选人，限制同一玩家最多连续中到 3 次
- 完成一次运动后，完成者成为下一位“可转动”的玩家
- 玩家列表显示当前可转动与“你”标识
- 断线不立刻移除，保留 5 分钟宽限期自动清理

## 本地开发

1. 安装依赖：
   ```bash
   npm install
   ```
2. 启动开发：
   ```bash
   npm run dev
   ```
3. 打开浏览器访问：`http://localhost:3000`

## 生产部署

### Cloudflare Workers（实时后端）

本项目已提供 Cloudflare Workers + Durable Object 的实现（`workers/worker.ts` 与 `wrangler.toml`）。部署步骤：

1. 安装 Wrangler 并登录 Cloudflare：
   ```bash
   npm i -D wrangler
   npx wrangler login
   ```
2. 部署 Worker：
   ```bash
   npx wrangler deploy
   ```
3. 记录 Worker 访问地址，例如：`https://kegel-roulette-worker.<your>.workers.dev`
4. 将该地址配置到前端环境变量：
   - `NEXT_PUBLIC_WS_BASE` = `https://kegel-roulette-worker.<your>.workers.dev`
5. 前端会自动使用 Cloudflare Worker 的 WebSocket 接入：
   - 创建/加入房间：通过 Worker 的 `/ws?roomId=...&playerId=...` 建立 WS 连接并发送 `create-room` / `join-room` 消息
   - 房间页：通过 `src/lib/realtime.ts` 连接 Worker，监听 `room-state`、`wheel-spun` 等事件

> 注意：必须配置 `NEXT_PUBLIC_WS_BASE` 指向你的 Cloudflare Worker 地址，否则无法建立实时连接。

本地调试 Cloudflare Worker：

```bash
npx wrangler dev
# 得到本地地址，例如 http://127.0.0.1:8787

# 在 .env.local（或 Cloudflare Pages 环境变量）中设置：
NEXT_PUBLIC_WS_BASE=http://127.0.0.1:8787

# 之后运行前端：
npm run dev
```

### Vercel（推荐前端托管）

将前端部署在 Vercel，并通过环境变量指向上面部署的 Workers 实时后端：

1. 在 Vercel 创建项目并连接到本仓库。
2. 在项目 Settings → Environment Variables 添加：
   - `NEXT_PUBLIC_WS_BASE = https://kegel-roulette-worker.<your>.workers.dev`
   - 建议设置到 `Production` 与 `Preview` 两个环境。
3. 部署 Production：使用 Vercel 控制台或命令行。
   - 命令行（需已安装并链接项目）：
     - `npm run build`
     - `npx vercel deploy --prod --yes`
4. 部署完成后，访问 Vercel 分配的域名，创建房间并验证实时连接。

补充说明：
- Vercel 不支持 Serverless WebSocket；本项目的实时连接完全走 Cloudflare Workers（`NEXT_PUBLIC_WS_BASE`）。
- 若创建房间后页面一直显示“正在连接房间…”，请检查 `NEXT_PUBLIC_WS_BASE` 是否正确配置为你的 Worker 地址，且为 `https`（浏览器将自动转换为 `wss`）。

### Cloudflare Pages（可选前端托管）

将前端部署在 Cloudflare Pages，并通过环境变量指向上面部署的 Workers 实时后端：

1. 将仓库推送到 GitHub。
2. 在 Cloudflare Dashboard → Pages 创建新项目，连接该仓库。
3. 框架预设：请选择 “Next.js”。
   - 原因：项目包含动态路由 `src/app/room/[id]`，直接刷新房间页需要 Pages Functions 支持；选择 Next.js 预设可避免出现 404。
   - 保持预设自动填入的默认构建命令与输出目录即可。
4. 构建设置：建议 `NODE_VERSION=20`。
5. 环境变量：添加 `NEXT_PUBLIC_WS_BASE=https://kegel-roulette-worker.<your>.workers.dev`。
6. 完成后，Pages 会生成前端域名（如 `https://kegelroulette.pages.dev`），前端会自动连接到 Workers 的 `/ws` 实时接口。

补充说明：
- 仅当你的站点是纯静态（不含动态路由与 SSR）时，才可以不选框架预设，并设置 `Build command: npm ci && npm run build && npx next export`，`Output directory: out`。本项目为动态路由场景，不适用静态导出。
- 刷新房间页出现 404 时，请检查：是否选择了 “Next.js” 框架预设、是否设置了 `NODE_VERSION=20`、是否已正确填入 `NEXT_PUBLIC_WS_BASE`。

> 注：本项目前端以客户端渲染为主，未依赖 Next.js API 路由；生产环境实时通信由 Cloudflare Workers 提供。

### 一键部署脚本与 CI

- NPM 脚本（本地一键部署）：
  - `npm run cf:login` 登录 Cloudflare 账号
  - `npm run cf:deploy` 将 Worker 部署到 Cloudflare
  - `npm run cf:dev` 在本地启动 Worker 调试
  - `npm run vercel:deploy` 将前端部署到 Vercel（需设置 `NEXT_PUBLIC_WS_BASE`）
  - `npm run deploy:all` 依次部署 Cloudflare Workers 与 Vercel 前端（从环境变量读取 `NEXT_PUBLIC_WS_BASE`）

- GitHub Action（推送即部署 Workers）：`.github/workflows/deploy-cloudflare.yml`
  - 在 GitHub 仓库的 Settings → Secrets 中添加：
    - `CLOUDFLARE_API_TOKEN`（需要 `Workers Scripts:Edit` 权限）
    - `CLOUDFLARE_ACCOUNT_ID`
  - 推送到 `main` 分支或手动触发 Workflow，即自动执行 `wrangler deploy`

完成部署后，将 Worker 域名配置到前端环境变量：

- 在 Vercel 或 Cloudflare Pages 项目设置中设置 `NEXT_PUBLIC_WS_BASE=https://<your-worker>.workers.dev`
- 前端将自动通过 Cloudflare Worker 的 `/ws` 接入实时通信

## 关键目录结构

```
src/
  app/                # Next.js App 路由（首页与房间页）
  components/         # AvatarBadge、RouletteWheel 等组件
  lib/                # 前端 WebSocket 客户端、头像种子
```

## 配置项与默认值（已修复房间持久化）

- 断线清理周期：每 1 分钟检查
- 宽限期：5 分钟（`INACTIVE_MS = 5 * 60 * 1000`）
- 连续中奖上限：3 次
- Durable Object：房间状态持久化到 `state.storage`，即使所有连接关闭也可恢复房间。

## 常见问题

- 刷新后进不去房间？
  - 已加入 Durable Object 持久化：房间状态会保存到 `storage`，刷新或暂时断线后可恢复。
  - 若超过 5 分钟未活跃会被清理，请重新加入。

- 部署方式？
  - 前端：Vercel 或 Cloudflare Pages；后端：Cloudflare Workers（Durable Object）。通过 `NEXT_PUBLIC_WS_BASE` 将前端指向后端。

## 许可证

本项目仅用于演示与学习目的。
