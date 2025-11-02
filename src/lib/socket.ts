"use client";
import { io, Socket } from "socket.io-client";

let serverInitialized = false;

export async function ensureSocketServer() {
  if (serverInitialized) return;
  try {
    await fetch("/api/socket");
    serverInitialized = true;
  } catch (e) {
    // ignore
  }
}

export async function createSocket(roomId: string, playerId: string) {
  await ensureSocketServer();
  const socket: Socket = io({
    transports: ["websocket"],
    query: { roomId, playerId },
  });
  return socket;
}