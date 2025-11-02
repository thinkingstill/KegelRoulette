import { io, Socket } from "socket.io-client";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE;

export type Realtime = {
  on: (event: string, cb: (data: any) => void) => void;
  emit: (event: string, payload?: any) => void;
  disconnect: () => void;
};

export async function createRealtime(roomId: string, playerId: string): Promise<Realtime> {
  if (WS_BASE) {
    const wsUrl = (WS_BASE.startsWith("https") ? WS_BASE.replace("https", "wss") : WS_BASE.startsWith("http") ? WS_BASE.replace("http", "ws") : WS_BASE) + `/ws?roomId=${roomId}&playerId=${playerId}`;
    const ws = new WebSocket(wsUrl);
    const handlers: Record<string, ((data: any) => void)[]> = {};
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string);
        const { type, payload } = msg || {};
        if (handlers[type]) handlers[type].forEach((h) => h(payload));
      } catch {}
    };
    return {
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
    };
  }

  const socket: Socket = io({ transports: ["polling", "websocket"], query: { roomId, playerId }, path: "/api/socket" });
  return {
    on: (event, cb) => socket.on(event, cb),
    emit: (event, payload) => socket.emit(event, payload),
    disconnect: () => socket.disconnect(),
  };
}