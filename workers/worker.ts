// Cloudflare Worker with Durable Object to manage rooms and realtime via WebSocket
// This worker exposes a WebSocket endpoint at /ws?roomId=...&playerId=...
// Messages are JSON: { type: string, payload?: any }

// Minimal type shims to satisfy TypeScript outside Workers type environment
declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
  constructor();
}
interface DurableObjectId {}
interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}
interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
// Minimal Durable Object state (runtime will provide the real type); keep it loose for TS
interface DurableObjectState {
  storage: any;
}
type CFResponseInit = ResponseInit & { webSocket?: WebSocket };
declare global { interface WebSocket { accept(): void } }

export interface Env {
  ROOM_DO: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const roomId = url.searchParams.get("roomId") || "";
      if (!roomId) return new Response("Missing roomId", { status: 400 });
      const id = env.ROOM_DO.idFromName(roomId);
      const stub = env.ROOM_DO.get(id);
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};

type Player = {
  id: string;
  nickname: string;
  avatarSeed: string;
  completedCount: number;
  lastActive?: number;
};

type Room = {
  id: string;
  creatorId: string;
  exerciseCount: number;
  players: Player[];
  currentSpinnerIndex: number;
  lastWinnerId?: string;
  lastWinnerStreak?: number;
};

export class RoomDO {
  state: DurableObjectState;
  env: Env;
  room: Room | null = null;
  sockets = new Map<string, WebSocket>();
  static INACTIVE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }

    const playerId = url.searchParams.get("playerId") || "";
    const roomId = url.searchParams.get("roomId") || "";
    if (!playerId || !roomId) return new Response("Missing params", { status: 400 });

    // Lazy-load room state from storage if not present
    if (!this.room) {
      try {
        const stored = await this.state.storage.get("room");
        if (stored) this.room = stored as Room;
      } catch {}
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    // Do not auto-create rooms on connect; only "create-room" should initialize.

    // Track this socket
    this.sockets.set(playerId, server);

    server.addEventListener("message", async (evt: MessageEvent) => {
      try {
        const data = JSON.parse(typeof evt.data === "string" ? evt.data : "{}");
        const type = data?.type as string;
        const payload = data?.payload;
        switch (type) {
          case "create-room": {
            const { exerciseCount, nickname, avatarSeed } = payload || {};
            const creatorId = playerId;
            const creator: Player = {
              id: creatorId,
              nickname,
              avatarSeed,
              completedCount: 0,
              lastActive: Date.now(),
            };
            this.room = {
              id: roomId,
              creatorId,
              exerciseCount: Number(exerciseCount) || 10,
              players: [creator],
              currentSpinnerIndex: 0,
            };
            await this.saveRoom();
            this.broadcast("room-state", this.room);
            break;
          }
          case "join-room": {
            if (!this.room) {
              server.send(
                JSON.stringify({
                  type: "error",
                  payload: { code: "ROOM_NOT_FOUND", message: "房间不存在或尚未创建" },
                })
              );
              break;
            }
            const { nickname, avatarSeed } = payload || {};
            const exists = this.room.players.find((p) => p.id === playerId);
            if (!exists) {
              this.room.players.push({ id: playerId, nickname, avatarSeed, completedCount: 0, lastActive: Date.now() });
            }
            await this.saveRoom();
            this.broadcast("room-state", this.room);
            break;
          }
          case "get-room": {
            if (this.room) {
              server.send(JSON.stringify({ type: "room-state", payload: this.room }));
            }
            break;
          }
          case "spin-wheel": {
            if (!this.room || this.room.players.length < 1) break;
            this.touch(playerId);
            const len = this.room.players.length;
            let winnerIndex = Math.floor(Math.random() * len);
            const candidateId = this.room.players[winnerIndex]?.id;
            const streak = this.room.lastWinnerStreak ?? 0;
            if (len > 1 && this.room.lastWinnerId && candidateId === this.room.lastWinnerId && streak >= 3) {
              const otherIndexes = this.room.players
                .map((_, i) => i)
                .filter((i) => this.room!.players[i].id !== this.room!.lastWinnerId);
              winnerIndex = otherIndexes[Math.floor(Math.random() * otherIndexes.length)];
            }
            const winnerId = this.room.players[winnerIndex].id;
            this.registerWinner(winnerId);
            await this.saveRoom();
            this.broadcast("wheel-spun", { winnerIndex });
            break;
          }
          case "completed-exercise": {
            if (!this.room) break;
            const { playerId: pid } = payload || {};
            this.touch(pid);
            this.incrementCompleted(pid, this.room.exerciseCount);
            this.setSpinnerByPlayerId(pid);
            await this.saveRoom();
            this.broadcast("room-state", this.room);
            break;
          }
          case "heartbeat": {
            this.touch(playerId);
            await this.cleanupInactive();
            await this.saveRoom();
            break;
          }
        }
      } catch (e) {
        // ignore malformed
      }
    });

    server.addEventListener("close", () => {
      // keep player in room and rely on activity timestamp for cleanup strategies if needed
      this.touch(playerId);
      this.sockets.delete(playerId);
    });

    // Send initial room-state if exists
    if (this.room) {
      server.send(JSON.stringify({ type: "room-state", payload: this.room }));
    }

    return new Response(null, { status: 101, webSocket: client } as CFResponseInit);
  }

  broadcast(type: string, payload: any) {
    const msg = JSON.stringify({ type, payload });
    for (const [, ws] of this.sockets) {
      try { ws.send(msg); } catch {}
    }
  }

  touch(pid?: string) {
    if (!this.room || !pid) return;
    const p = this.room.players.find((x) => x.id === pid);
    if (p) p.lastActive = Date.now();
  }

  incrementCompleted(pid: string, amount: number) {
    if (!this.room) return;
    const p = this.room.players.find((x) => x.id === pid);
    if (p) p.completedCount += amount;
  }

  setSpinnerByPlayerId(pid: string) {
    if (!this.room) return;
    const idx = this.room.players.findIndex((x) => x.id === pid);
    if (idx > -1) this.room.currentSpinnerIndex = idx;
  }

  registerWinner(pid: string) {
    if (!this.room) return;
    if (this.room.lastWinnerId === pid) {
      this.room.lastWinnerStreak = (this.room.lastWinnerStreak ?? 0) + 1;
    } else {
      this.room.lastWinnerId = pid;
      this.room.lastWinnerStreak = 1;
    }
  }

  async saveRoom() {
    try {
      if (this.room) await this.state.storage.put("room", this.room);
      else await this.state.storage.delete?.("room");
    } catch {}
  }

  async cleanupInactive() {
    if (!this.room) return;
    const now = Date.now();
    const before = this.room.players.length;
    this.room.players = this.room.players.filter((p) => (p.lastActive ?? 0) > now - RoomDO.INACTIVE_MS);
    // Reset spinner index if needed
    if (this.room.currentSpinnerIndex >= this.room.players.length) {
      this.room.currentSpinnerIndex = 0;
    }
    if (before !== this.room.players.length) {
      this.broadcast("room-state", this.room);
    }
    if (this.room.players.length === 0) {
      this.room = null;
    }
  }
}