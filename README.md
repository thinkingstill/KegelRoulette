# KegelRoulette

一个基于 Next.js 的多人“凯格尔运动轮盘”小应用。前端托管在 Cloudflare Pages，实时后端运行于 Cloudflare Workers（Durable Object）。支持创建/加入房间、轮盘随机抽取、完成次数统计、心跳保活与断线宽限期。

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

> 提示：首次使用 Socket 连接前，前端会请求 `/api/socket` 来确保后端 Socket 服务就绪。

## 生产部署（Cloudflare 全托管）

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
4. 在 Cloudflare Pages 项目设置中添加环境变量：
   - `NEXT_PUBLIC_WS_BASE` = `https://kegel-roulette-worker.<your>.workers.dev`
5. 完成 Pages 构建与发布后，前端会自动使用 Cloudflare Worker 的 WebSocket 接入：
   - 创建/加入房间：通过 Worker 的 `/ws?roomId=...&playerId=...` 建立 WS 连接并发送 `create-room` / `join-room` 消息
   - 房间页：通过 `src/lib/realtime.ts` 连接 Worker，监听 `room-state`、`wheel-spun` 等事件

> Fallback：如未设置 `NEXT_PUBLIC_WS_BASE`，前端仅在本地开发回退到 Socket.IO（路径 `/api/socket`）。

本地调试 Cloudflare Worker：

```bash
npx wrangler dev
# 得到本地地址，例如 http://127.0.0.1:8787

# 在 .env.local（或 Cloudflare Pages 环境变量）中设置：
NEXT_PUBLIC_WS_BASE=http://127.0.0.1:8787

# 之后运行前端：
npm run dev
```

### Cloudflare Pages（前端托管）

将前端部署在 Cloudflare Pages，并通过环境变量指向上面部署的 Workers 实时后端：

1. 将仓库推送到 GitHub。
2. 在 Cloudflare Dashboard → Pages 创建新项目，连接该仓库。
3. 构建设置：Build Command 设为 `npm ci && npm run build`；Node 版本建议 20。
4. 环境变量：添加 `NEXT_PUBLIC_WS_BASE=https://kegel-roulette-worker.<your>.workers.dev`。
5. 完成后，Pages 会生成前端域名（如 `https://kegelroulette.pages.dev`），前端会自动连接到 Workers 的 `/ws` 实时接口。

> 注：本项目前端以客户端渲染为主，未依赖 Next.js API 路由；生产环境实时通信由 Cloudflare Workers 提供。

### 一键部署脚本与 CI

- NPM 脚本（本地一键部署）：
  - `npm run cf:login` 登录 Cloudflare 账号
  - `npm run cf:deploy` 将 Worker 部署到 Cloudflare
  - `npm run cf:dev` 在本地启动 Worker 调试

- GitHub Action（推送即部署 Workers）：`.github/workflows/deploy-cloudflare.yml`
  - 在 GitHub 仓库的 Settings → Secrets 中添加：
    - `CLOUDFLARE_API_TOKEN`（需要 `Workers Scripts:Edit` 权限）
    - `CLOUDFLARE_ACCOUNT_ID`
  - 推送到 `main` 分支或手动触发 Workflow，即自动执行 `wrangler deploy`

完成部署后，将 Worker 域名配置到前端环境变量：

- 在 Cloudflare Pages 项目设置或 `.env.local` 中设置 `NEXT_PUBLIC_WS_BASE=https://<your-worker>.workers.dev`
- 前端将自动通过 Cloudflare Worker 的 `/ws` 接入实时通信

## 关键目录结构

```
src/
  app/                # Next.js App 路由（首页与房间页）
  components/         # AvatarBadge、RouletteWheel 等组件
  lib/                # 前端 socket 客户端、头像种子
  pages/api/socket.ts # 仅用于本地开发的 Socket.IO 入口（生产使用 Cloudflare Workers）
  server/             # 房间与玩家的服务端逻辑（本地开发）
```

## 配置项与默认值

- 断线清理周期：每 1 分钟检查
- 宽限期：5 分钟（`INACTIVE_MS = 5 * 60 * 1000`）
- 连续中奖上限：3 次

## 常见问题

- 刷新后进不去房间？
  - 已优化为断线不立刻移除玩家；若超过 5 分钟未活跃，房间会清理该玩家，请重新加入。
  - 若房间已无人且被自动删除，请重新创建房间。

- 部署方式？
  - 前端：Cloudflare Pages；后端：Cloudflare Workers（Durable Object）。通过 `NEXT_PUBLIC_WS_BASE` 将前端指向后端。

## 许可证

本项目仅用于演示与学习目的。
