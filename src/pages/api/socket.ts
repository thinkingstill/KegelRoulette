// Vercel 部署：在 Node.js 运行时启动 Socket.IO 服务器
import type { NextApiRequest, NextApiResponse } from 'next';
import socketHandler from '@/server/index';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return socketHandler(req, res as any);
}