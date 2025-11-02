# KegelRoulette

一个基于 Next.js 和 Socket.IO 的多人“凯格尔运动轮盘”小应用。支持创建/加入房间、轮盘随机抽取、完成次数统计、心跳保活与断线宽限期。

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

## 生产部署方案

### 方案 A：Vercel（前端托管）

本项目包含 `vercel.json` 配置，可在 Vercel 上一键部署前端：

- 在 Vercel 控制台选择 “New Project” → 导入本仓库 → 默认设置即可。
- 或使用部署按钮：

  [Deploy with Vercel](https://vercel.com/new/clone?repository-url=https://github.com/yourname/KegelRoulette)

> 提示：Vercel 的无服务器环境不保证持续的 WebSocket 连接。为保证实时性，本项目在生产环境建议配合 Cloudflare Workers 提供 WebSocket 服务，前端通过环境变量自动切换。

### 方案 B：Cloudflare Workers（实时后端）

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
4. 在 Vercel 项目设置中添加环境变量：
   - `NEXT_PUBLIC_WS_BASE` = `https://kegel-roulette-worker.<your>.workers.dev`
5. 重新在 Vercel 进行构建与发布。前端会自动使用 Cloudflare Worker 的 WebSocket 接入：
   - 创建/加入房间：通过 Worker 的 `/ws?roomId=...&playerId=...` 建立 WS 连接并发送 `create-room` / `join-room` 消息
   - 房间页：通过 `src/lib/realtime.ts` 连接 Worker，监听 `room-state`、`wheel-spun` 等事件

> Fallback：如未设置 `NEXT_PUBLIC_WS_BASE`，前端将回退到 Socket.IO（路径 `/api/socket`），便于本地调试。

本地调试 Cloudflare Worker：

```bash
npx wrangler dev
# 得到本地地址，例如 http://127.0.0.1:8787

# 在 .env.local（或 Vercel 环境变量）中设置：
NEXT_PUBLIC_WS_BASE=http://127.0.0.1:8787

# 之后运行前端：
npm run dev
```

## 关键目录结构

```
src/
  app/                # Next.js App 路由（首页与房间页）
  components/         # AvatarBadge、RouletteWheel 等组件
  lib/                # 前端 socket 客户端、头像种子
  pages/api/socket.ts # 后端 Socket.IO 入口（引用 src/server/index.ts）
  server/             # 房间与玩家的服务端逻辑
```

## 配置项与默认值

- 断线清理周期：每 1 分钟检查
- 宽限期：5 分钟（`INACTIVE_MS = 5 * 60 * 1000`）
- 连续中奖上限：3 次

## 常见问题

- 刷新后进不去房间？
  - 已优化为断线不立刻移除玩家；若超过 5 分钟未活跃，房间会清理该玩家，请重新加入。
  - 若房间已无人且被自动删除，请重新创建房间。

- WebSocket 在 Vercel 是否可用？
  - Vercel 无服务器函数不保证持续 WebSocket 连接。在生产建议置于 Cloudflare Workers；若缺省则前端会使用 Socket.IO 并自动回退为轮询。

## 许可证

本项目仅用于演示与学习目的。
