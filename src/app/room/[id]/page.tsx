"use client";
export const runtime = "edge";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createRealtime } from "@/lib/realtime";
import AvatarBadge from "@/components/AvatarBadge";
import RouletteWheel from "@/components/RouletteWheel";
import Link from "next/link";

type Player = { id: string; nickname: string; avatarSeed: string; completedCount: number };
type Room = { id: string; creatorId: string; exerciseCount: number; players: Player[]; currentSpinnerIndex: number };

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params?.id as string;
  const [socket, setSocket] = useState<any>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [winnerIndex, setWinnerIndex] = useState<number | undefined>(undefined);
  const [playerId, setPlayerId] = useState<string>("");

  useEffect(() => {
    if (!roomId) return;
    if (typeof window !== "undefined") {
      const id = localStorage.getItem(`kr-player-${roomId}`) ?? "";
      setPlayerId(id);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !playerId) return;
    let heartbeat: any;
    createRealtime(roomId, playerId).then((s) => {
      setSocket(s);
      s.on("room-state", (r: Room) => setRoom(r));
      s.on("wheel-spun", ({ winnerIndex }: { winnerIndex: number }) => {
        setWinnerIndex(winnerIndex);
      });
      // Request current state
      s.emit("get-room", { roomId });
      // Heartbeat every 20s to keep active
      heartbeat = setInterval(() => {
        try {
          s.emit("heartbeat", { roomId });
        } catch {}
      }, 20000);
    });
    return () => {
      if (heartbeat) clearInterval(heartbeat);
      socket?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]);

  function spin() {
    if (!socket || !room) return;
    const myIndex = room.players.findIndex((p) => p.id === playerId);
    if (myIndex !== room.currentSpinnerIndex) return; // not your turn
    socket.emit("spin-wheel", { roomId });
  }

  function complete() {
    if (!socket || !room || winnerIndex == null) return;
    const winner = room.players[winnerIndex];
    if (!winner) return;
    if (winner.id !== playerId) return; // only winner can confirm
    socket.emit("completed-exercise", { roomId, playerId });
    setWinnerIndex(undefined);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-100 via-indigo-100 to-cyan-100 px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
          <h1 className="text-2xl font-bold">房间：{roomId}</h1>
          <div className="flex items-center gap-2">
            {room && (
              <div className="text-sm px-3 py-1 rounded-full bg-black text-white whitespace-nowrap">每次运动：{room.exerciseCount}</div>
            )}
            <Link
              href="/"
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.removeItem(`kr-player-${roomId}`);
                }
              }}
              className="text-sm px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 whitespace-nowrap"
            >
              退出房间
            </Link>
          </div>
        </header>

        {room ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 rounded-2xl bg-white/80 backdrop-blur p-4 sm:p-6 shadow">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3">
                <div className="text-lg font-semibold">当前转盘</div>
                <button
                  onClick={spin}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 w-full sm:w-auto"
                  disabled={!room || room.players.findIndex((p) => p.id === playerId) !== room.currentSpinnerIndex}
                >
                  我来转动
                </button>
              </div>
              <RouletteWheel
                players={room.players.map((p) => ({ label: p.nickname }))}
                winnerIndex={winnerIndex}
                onSpinEnd={() => {}}
                sizeClass="w-64 h-64 sm:w-72 sm:h-72 md:w-96 md:h-96"
              />
              {winnerIndex != null && (
                <div className="mt-6 p-4 rounded-xl bg-yellow-100/70 border border-yellow-300">
                  <div className="font-medium">本次轮到：{room.players[winnerIndex]?.nickname}</div>
                  <div className="text-sm text-gray-600">请完成 {room.exerciseCount} 次凯格尔运动</div>
                  {room.players[winnerIndex]?.id === playerId ? (
                    <button
                      onClick={complete}
                      className="mt-3 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                    >
                      我已完成
                    </button>
                  ) : (
                    <div className="mt-3 text-xs text-gray-500">等待对方完成后继续</div>
                  )}
                </div>
              )}
            </div>

            <aside className="rounded-2xl bg-white/80 backdrop-blur p-4 sm:p-6 shadow">
              <div className="text-lg font-semibold mb-4">玩家列表</div>
              <ul className="space-y-2 sm:space-y-3">
                {room.players.map((p, idx) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AvatarBadge seed={p.avatarSeed} count={p.completedCount} name={p.nickname} />
                      <div>
                        <div className="font-medium">
                          {p.nickname}
                          {p.id === playerId && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">你</span>
                          )}
                        </div>
                        {room.currentSpinnerIndex === idx && (
                          <div className="text-xs text-purple-600">当前可转动</div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/80 backdrop-blur p-6 shadow text-center">
            正在连接房间...
          </div>
        )}
      </div>
    </div>
  );
}