"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { randomSeed } from "@/lib/avatars";
import { ensureSocketServer } from "@/lib/socket";
import { io } from "socket.io-client";
import { nanoid } from "nanoid";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE;
const toWsBase = (base?: string) => {
  if (!base) return undefined;
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.startsWith("https")) return trimmed.replace(/^https/, "wss");
  if (trimmed.startsWith("http")) return trimmed.replace(/^http/, "ws");
  return trimmed;
};

export default function HomeClient() {
  const router = useRouter();
  const [nicknameCreate, setNicknameCreate] = useState("");
  const [exerciseCount, setExerciseCount] = useState(10);
  const [nicknameJoin, setNicknameJoin] = useState("");
  const [roomIdJoin, setRoomIdJoin] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateRoom() {
    if (!nicknameCreate.trim()) return;
    setLoading(true);
    const avatarSeed = randomSeed();
    if (WS_BASE) {
      const roomId = nanoid(6);
      const playerId = nanoid();
      const wsBase = toWsBase(WS_BASE);
      const wsUrl = `${wsBase}/ws?roomId=${roomId}&playerId=${playerId}`;
      const ws = new WebSocket(wsUrl);
      let fellBack = false;
      const fallbackToSocketIO = async () => {
        if (fellBack) return;
        fellBack = true;
        try {
          await ensureSocketServer();
          const socket = io({ path: "/api/socket", transports: ["polling", "websocket"] });
          socket.emit(
            "create-room",
            { exerciseCount, nickname: nicknameCreate.trim(), avatarSeed },
            ({ roomId: rId, playerId: pId }: { roomId: string; playerId: string }) => {
              localStorage.setItem(`kr-player-${rId}`, pId);
              router.push(`/room/${rId}`);
              socket.disconnect();
            }
          );
        } catch {}
      };
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "create-room", payload: { exerciseCount, nickname: nicknameCreate.trim(), avatarSeed } }));
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg.type === "room-state") {
            localStorage.setItem(`kr-player-${roomId}`, playerId);
            ws.close();
            router.push(`/room/${roomId}`);
          }
        } catch {}
      };
      ws.onerror = () => fallbackToSocketIO();
      ws.onclose = (ev) => {
        // If closed without having navigated, fallback
        if (!fellBack) fallbackToSocketIO();
      };
      // Timeout fallback if ws never opens
      setTimeout(() => fallbackToSocketIO(), 4000);
      return;
    }
    await ensureSocketServer();
    const socket = io({ path: "/api/socket", transports: ["polling", "websocket"] });
    socket.emit(
      "create-room",
      { exerciseCount, nickname: nicknameCreate.trim(), avatarSeed },
      ({ roomId, playerId }: { roomId: string; playerId: string }) => {
        localStorage.setItem(`kr-player-${roomId}`, playerId);
        router.push(`/room/${roomId}`);
        socket.disconnect();
      }
    );
  }

  async function handleJoinRoom() {
    if (!nicknameJoin.trim() || !roomIdJoin.trim()) return;
    setLoading(true);
    const avatarSeed = randomSeed();
    if (WS_BASE) {
      const playerId = nanoid();
      const roomId = roomIdJoin.trim();
      const wsBase = toWsBase(WS_BASE);
      const wsUrl = `${wsBase}/ws?roomId=${roomId}&playerId=${playerId}`;
      const ws = new WebSocket(wsUrl);
      let fellBack = false;
      const fallbackToSocketIO = async (errorMsg?: string) => {
        if (fellBack) return;
        fellBack = true;
        try {
          await ensureSocketServer();
          const socket = io({ path: "/api/socket", transports: ["polling", "websocket"] });
          socket.emit(
            "join-room",
            { roomId: roomIdJoin.trim(), nickname: nicknameJoin.trim(), avatarSeed },
            ({ playerId: pId, error }: { playerId?: string; error?: string }) => {
              const err = error || errorMsg;
              if (err) {
                alert(err);
              } else if (pId) {
                localStorage.setItem(`kr-player-${roomIdJoin}`, pId);
                router.push(`/room/${roomIdJoin.trim()}`);
              }
              socket.disconnect();
            }
          );
        } catch {}
      };
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join-room", payload: { nickname: nicknameJoin.trim(), avatarSeed } }));
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg.type === "room-state") {
            localStorage.setItem(`kr-player-${roomId}`, playerId);
            ws.close();
            router.push(`/room/${roomId}`);
          } else if (msg.type === "error") {
            alert(msg.payload || "加入房间失败");
            ws.close();
          }
        } catch {}
      };
      ws.onerror = () => fallbackToSocketIO("WebSocket 连接失败，已回退到备用通道");
      ws.onclose = () => fallbackToSocketIO();
      setTimeout(() => fallbackToSocketIO(), 4000);
      return;
    }
    await ensureSocketServer();
    const socket = io({ path: "/api/socket", transports: ["polling", "websocket"] });
    socket.emit(
      "join-room",
      { roomId: roomIdJoin.trim(), nickname: nicknameJoin.trim(), avatarSeed },
      ({ playerId, error }: { playerId?: string; error?: string }) => {
        if (error) {
          alert(error);
        } else if (playerId) {
          localStorage.setItem(`kr-player-${roomIdJoin}`, playerId);
          router.push(`/room/${roomIdJoin.trim()}`);
        }
        socket.disconnect();
      }
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center px-3 sm:px-4 py-4">
      <main className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <section className="rounded-2xl bg-white/80 backdrop-blur shadow-xl p-4 sm:p-6 transition hover:shadow-2xl">
          <h1 className="text-2xl font-bold mb-4">创建房间 · KegelRoulette</h1>
          <label className="block text-sm mb-2 font-medium text-gray-900">你的昵称</label>
          <input
            className="w-full rounded-lg border border-black/20 bg-white px-3 py-3 mb-4 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="如：小明"
            value={nicknameCreate}
            onChange={(e) => setNicknameCreate(e.target.value)}
          />
          <label className="block text-sm mb-2 font-medium text-gray-900">每次运动次数</label>
          <div className="flex gap-2 mb-6">
            {[10, 20, 30, 40, 50].map((n) => (
              <button
                key={n}
                onClick={() => setExerciseCount(n)}
                className={`px-3 py-2 rounded-lg border transition ${exerciseCount === n ? "bg-purple-600 text-white border-purple-600" : "hover:bg-purple-50"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full rounded-xl bg-purple-600 text-white py-3 font-medium hover:bg-purple-700 active:scale-[.99] transition"
          >
            创建房间
          </button>
        </section>

        <section className="rounded-2xl bg-white/80 backdrop-blur shadow-xl p-4 sm:p-6 transition hover:shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">加入房间</h2>
          <label className="block text-sm mb-2 font-medium text-gray-900">房间号</label>
          <input
            className="w-full rounded-lg border border-black/20 bg-white px-3 py-3 mb-4 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="如：abc123"
            value={roomIdJoin}
            onChange={(e) => setRoomIdJoin(e.target.value)}
          />
          <label className="block text-sm mb-2 font-medium text-gray-900">你的昵称</label>
          <input
            className="w-full rounded-lg border border-black/20 bg-white px-3 py-3 mb-6 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="如：小红"
            value={nicknameJoin}
            onChange={(e) => setNicknameJoin(e.target.value)}
          />
          <button
            onClick={handleJoinRoom}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 text-white py-3 font-medium hover:bg-blue-700 active:scale-[.99] transition"
          >
            加入房间
          </button>
        </section>
      </main>
    </div>
  );
}