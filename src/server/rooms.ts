type Player = {
  id: string;
  nickname: string;
  avatarSeed: string;
  completedCount: number;
  lastActive?: number;
};

export type Room = {
  id: string;
  creatorId: string;
  exerciseCount: number;
  players: Player[];
  currentSpinnerIndex: number; // index of player whose turn to spin
  lastWinnerId?: string;
  lastWinnerStreak?: number;
};

class RoomsStore {
  private rooms = new Map<string, Room>();

  get(roomId: string) {
    return this.rooms.get(roomId);
  }

  create(room: Room) {
    this.rooms.set(room.id, room);
    return room;
  }

  remove(roomId: string) {
    this.rooms.delete(roomId);
  }

  addPlayer(roomId: string, player: Player) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    // prevent duplicates by id
    if (!room.players.find((p) => p.id === player.id)) {
      room.players.push(player);
    }
    return room;
  }

  removePlayer(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    // adjust spinner index if needed
    if (room.currentSpinnerIndex >= room.players.length) {
      room.currentSpinnerIndex = 0;
    }
    return room;
  }

  setExerciseCount(roomId: string, count: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.exerciseCount = count;
    return room;
  }

  incrementCompleted(roomId: string, playerId: string, amount: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player) player.completedCount += amount;
    return room;
  }

  setSpinnerByPlayerId(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex > -1) {
      room.currentSpinnerIndex = playerIndex;
    }
    return room;
  }

  registerWinner(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.lastWinnerId === playerId) {
      room.lastWinnerStreak = (room.lastWinnerStreak ?? 0) + 1;
    } else {
      room.lastWinnerId = playerId;
      room.lastWinnerStreak = 1;
    }
    return room;
  }

  touch(roomId: string, playerId?: string) {
    const room = this.rooms.get(roomId);
    if (!room || !playerId) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player) player.lastActive = Date.now();
    return room;
  }

  removeInactivePlayers(roomId: string, thresholdMs: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const now = Date.now();
    const beforeLength = room.players.length;
    room.players = room.players.filter((p) => (p.lastActive ?? now) > now - thresholdMs);
    if (room.currentSpinnerIndex >= room.players.length) {
      room.currentSpinnerIndex = 0;
    }
    return beforeLength !== room.players.length;
  }

  listRooms() {
    return Array.from(this.rooms.values());
  }
}

export const roomsStore = new RoomsStore();
export type { Player };