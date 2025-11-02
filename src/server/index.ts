import { nanoid } from 'nanoid';
import type { Server as HTTPServer } from 'http';
import { Server, type Socket } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';
import { roomsStore, type Player, type Room } from './rooms';

type SocketResponseWithIO = NextApiResponse & {
  socket: NextApiResponse['socket'] & {
    server: HTTPServer & {
      io?: Server;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const socketHandler = (req: NextApiRequest, res: SocketResponseWithIO) => {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  const io = new Server(res.socket.server, {
    path: '/api/socket',
  });
  res.socket.server.io = io;

  io.on('connection', (socket: Socket) => {
    const { roomId, playerId } = socket.handshake.query;
    const socketRoomId = typeof roomId === 'string' ? roomId : undefined;
    const socketPlayerId = typeof playerId === 'string' ? playerId : undefined;

    if (socketRoomId) {
      socket.join(socketRoomId);
      roomsStore.touch(socketRoomId, socketPlayerId);
    }

    // Room creation
    socket.on('create-room', ({ exerciseCount, nickname, avatarSeed }, callback) => {
      const newRoomId = nanoid(6);
      const creatorId = nanoid();
      const creator: Player = { id: creatorId, nickname, avatarSeed, completedCount: 0, lastActive: Date.now() };
      roomsStore.create({
        id: newRoomId,
        creatorId,
        exerciseCount,
        players: [creator],
        currentSpinnerIndex: 0,
      });
      socket.join(newRoomId);
      callback({ roomId: newRoomId, playerId: creatorId });
    });

    // Player joining
    socket.on('join-room', ({ roomId, nickname, avatarSeed }, callback) => {
      const room = roomsStore.get(roomId);
      if (!room) {
        callback({ error: 'Room not found' });
        return;
      }
      const newPlayerId = nanoid();
      const newPlayer: Player = { id: newPlayerId, nickname, avatarSeed, completedCount: 0, lastActive: Date.now() };
      roomsStore.addPlayer(roomId, newPlayer);
      socket.join(roomId);
      io.to(roomId).emit('room-state', roomsStore.get(roomId));
      callback({ playerId: newPlayerId });
    });

    // Spin the wheel
    socket.on('spin-wheel', ({ roomId }) => {
      const room = roomsStore.get(roomId);
      if (!room || room.players.length < 1) return;
      roomsStore.touch(roomId, socketPlayerId);
      const len = room.players.length;
      let winnerIndex = Math.floor(Math.random() * len);
      const candidateId = room.players[winnerIndex]?.id;
      const streak = room.lastWinnerStreak ?? 0;
      // If there are multiple players and the same player has already won 3 times in a row,
      // force the next winner to be someone else
      if (len > 1 && room.lastWinnerId && candidateId === room.lastWinnerId && streak >= 3) {
        const otherIndexes = room.players
          .map((_, i) => i)
          .filter((i) => room.players[i].id !== room.lastWinnerId);
        winnerIndex = otherIndexes[Math.floor(Math.random() * otherIndexes.length)];
      }
      const winnerId = room.players[winnerIndex].id;
      roomsStore.registerWinner(roomId, winnerId);
      io.to(roomId).emit('wheel-spun', { winnerIndex });
    });

    // Get current room state
    socket.on('get-room', ({ roomId }, callback) => {
      const room = roomsStore.get(roomId);
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }
      socket.emit('room-state', room);
    });

    // Player completed exercise
    socket.on('completed-exercise', ({ roomId, playerId }) => {
      const room = roomsStore.get(roomId);
      if (!room) return;
      roomsStore.touch(roomId, playerId);
      roomsStore.incrementCompleted(roomId, playerId, room.exerciseCount);
      roomsStore.setSpinnerByPlayerId(roomId, playerId);
      io.to(roomId).emit('room-state', roomsStore.get(roomId));
    });

    // Heartbeat to keep active
    socket.on('heartbeat', ({ roomId }) => {
      roomsStore.touch(roomId, socketPlayerId);
    });

    // Player disconnection
    socket.on('disconnect', () => {
      // 不再立即移除玩家，保留 5 分钟的宽限期由定时清理处理
      // 这样移动端锁屏或短暂断网后刷新可以自动恢复
      if (socketRoomId && socketPlayerId) {
        roomsStore.touch(socketRoomId, socketPlayerId);
      }
    });
  });

  // Periodic inactive cleanup (5 minutes)
  const INACTIVE_MS = 5 * 60 * 1000;
  setInterval(() => {
    for (const room of roomsStore.listRooms()) {
      const changed = roomsStore.removeInactivePlayers(room.id, INACTIVE_MS);
      if (changed) {
        const updated = roomsStore.get(room.id);
        if (updated) {
          if (updated.players.length === 0) {
            roomsStore.remove(room.id);
          } else {
            io.to(room.id).emit('room-state', updated);
          }
        }
      }
    }
  }, 60 * 1000);

  res.end();
};

export default socketHandler;