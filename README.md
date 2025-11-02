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

## 部署到 Vercel（一键部署）

本项目包含 `vercel.json` 配置，可直接在 Vercel 上导入并部署：

- 方式一：在 Vercel 控制台选择 “New Project” → 导入本仓库 → 默认设置即可。
- 方式二：README 中的部署按钮（如已推送到 GitHub/GitLab）：

  [Deploy with Vercel](https://vercel.com/new/clone?repository-url=https://github.com/yourname/KegelRoulette)

> 注意：Socket.IO 采用 Next.js API 路由（`/src/pages/api/socket.ts`）并通过 `res.socket.server` 复用单例服务器实例，适用于 Vercel 的 Node 运行时。

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
  - 采用 Next.js 的 `res.socket.server` 单例模式，适配 Vercel 的 Node 运行时，兼容生产环境。

## 许可证

本项目仅用于演示与学习目的。
