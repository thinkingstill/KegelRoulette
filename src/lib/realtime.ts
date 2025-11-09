// WebSocket-only realtime client for Cloudflare Worker

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE;
const toWsBase = (base?: string) => {
  if (!base) return undefined;
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.startsWith("https")) return trimmed.replace(/^https/, "wss");
  if (trimmed.startsWith("http")) return trimmed.replace(/^http/, "ws");
  return trimmed;
};

export type Realtime = {
  on: (event: string, cb: (data: any) => void) => void;
  emit: (event: string, payload?: any) => void;
  disconnect: () => void;
};

export async function createRealtime(roomId: string, playerId: string): Promise<Realtime> {
  if (!WS_BASE) {
    return Promise.reject(new Error("NEXT_PUBLIC_WS_BASE 未配置，无法建立 WebSocket 连接"));
  }
  const wsBase = toWsBase(WS_BASE);
  const wsUrl = `${wsBase}/ws?roomId=${roomId}&playerId=${playerId}`;
  const ws = new WebSocket(wsUrl);
  const handlers: Record<string, ((data: any) => void)[]> = {};

  const buildWSRealtime = (): Realtime => ({
    on: (event, cb) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(cb);
    },
    emit: (event, payload) => {
      try { ws.send(JSON.stringify({ type: event, payload })); } catch {}
    },
    disconnect: () => {
      try { ws.close(); } catch {}
    },
  });

  return await new Promise<Realtime>((resolve) => {
    ws.onopen = () => resolve(buildWSRealtime());
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string);
        const { type, payload } = msg || {};
        if (handlers[type]) handlers[type].forEach((h) => h(payload));
      } catch {}
    };
  });
}