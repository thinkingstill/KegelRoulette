import { io, Socket } from "socket.io-client";

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
  if (WS_BASE) {
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

    const buildSocketRealtime = (): Realtime => {
      const socket: Socket = io({ transports: ["polling", "websocket"], query: { roomId, playerId }, path: "/api/socket" });
      return {
        on: (event, cb) => socket.on(event, cb),
        emit: (event, payload) => socket.emit(event, payload),
        disconnect: () => socket.disconnect(),
      };
    };

    return await new Promise<Realtime>((resolve) => {
      let settled = false;
      const settle = (rt: Realtime) => { if (!settled) { settled = true; resolve(rt); } };
      ws.onopen = () => settle(buildWSRealtime());
      ws.onerror = () => settle(buildSocketRealtime());
      ws.onclose = () => settle(buildSocketRealtime());
      setTimeout(() => settle(buildSocketRealtime()), 4000);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          const { type, payload } = msg || {};
          if (handlers[type]) handlers[type].forEach((h) => h(payload));
        } catch {}
      };
    });
  }

  const socket: Socket = io({ transports: ["polling", "websocket"], query: { roomId, playerId }, path: "/api/socket" });
  return {
    on: (event, cb) => socket.on(event, cb),
    emit: (event, payload) => socket.emit(event, payload),
    disconnect: () => socket.disconnect(),
  };
}