// Cloudflare Pages（Next.js 预设）要求非静态路由使用 Edge Runtime。
// 该 API 仅用于本地开发的 Socket.IO 启动，在生产（Pages）下不需要，提供 Edge 兼容占位实现。

export const config = { runtime: 'edge' };

export default async function handler(_req: Request): Promise<Response> {
  return new Response('OK', { status: 200 });
}