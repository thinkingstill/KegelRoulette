var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-ZJLGnx/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// workers/worker.ts
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const roomId = url.searchParams.get("roomId") || "";
      if (!roomId) return new Response("Missing roomId", { status: 400 });
      const id = env.ROOM_DO.idFromName(roomId);
      const stub = env.ROOM_DO.get(id);
      return stub.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  }
};
var RoomDO = class _RoomDO {
  // 5 minutes
  constructor(state, env) {
    this.room = null;
    this.sockets = /* @__PURE__ */ new Map();
    this.state = state;
    this.env = env;
  }
  static {
    __name(this, "RoomDO");
  }
  static {
    this.INACTIVE_MS = 5 * 60 * 1e3;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const playerId = url.searchParams.get("playerId") || "";
    const roomId = url.searchParams.get("roomId") || "";
    if (!playerId || !roomId) return new Response("Missing params", { status: 400 });
    if (!this.room) {
      try {
        const stored = await this.state.storage.get("room");
        if (stored) this.room = stored;
      } catch {
      }
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.set(playerId, server);
    server.addEventListener("message", async (evt) => {
      try {
        const data = JSON.parse(typeof evt.data === "string" ? evt.data : "{}");
        const type = data?.type;
        const payload = data?.payload;
        switch (type) {
          case "create-room": {
            const { exerciseCount, nickname, avatarSeed } = payload || {};
            const creatorId = playerId;
            const creator = {
              id: creatorId,
              nickname,
              avatarSeed,
              completedCount: 0,
              lastActive: Date.now()
            };
            this.room = {
              id: roomId,
              creatorId,
              exerciseCount: Number(exerciseCount) || 10,
              players: [creator],
              currentSpinnerIndex: 0
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
                  payload: { code: "ROOM_NOT_FOUND", message: "\u623F\u95F4\u4E0D\u5B58\u5728\u6216\u5C1A\u672A\u521B\u5EFA" }
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
              const otherIndexes = this.room.players.map((_, i) => i).filter((i) => this.room.players[i].id !== this.room.lastWinnerId);
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
      }
    });
    server.addEventListener("close", () => {
      this.touch(playerId);
      this.sockets.delete(playerId);
    });
    if (this.room) {
      server.send(JSON.stringify({ type: "room-state", payload: this.room }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload });
    for (const [, ws] of this.sockets) {
      try {
        ws.send(msg);
      } catch {
      }
    }
  }
  touch(pid) {
    if (!this.room || !pid) return;
    const p = this.room.players.find((x) => x.id === pid);
    if (p) p.lastActive = Date.now();
  }
  incrementCompleted(pid, amount) {
    if (!this.room) return;
    const p = this.room.players.find((x) => x.id === pid);
    if (p) p.completedCount += amount;
  }
  setSpinnerByPlayerId(pid) {
    if (!this.room) return;
    const idx = this.room.players.findIndex((x) => x.id === pid);
    if (idx > -1) this.room.currentSpinnerIndex = idx;
  }
  registerWinner(pid) {
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
    } catch {
    }
  }
  async cleanupInactive() {
    if (!this.room) return;
    const now = Date.now();
    const before = this.room.players.length;
    this.room.players = this.room.players.filter((p) => (p.lastActive ?? 0) > now - _RoomDO.INACTIVE_MS);
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
};

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-ZJLGnx/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-ZJLGnx/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  RoomDO,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
