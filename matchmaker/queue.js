const { randomUUID } = require("crypto");

/**
 * Small in-memory matchmaking queue for an authorized game server.
 * Pairing is deliberately transport-agnostic: the host supplies onMatch
 * to create/assign a session using its own supported server interface.
 */
class MatchmakingQueue {
  constructor({ onMatch, queueTimeoutMs = 120000 } = {}) {
    if (typeof onMatch !== "function") {
      throw new TypeError("MatchmakingQueue requires an onMatch callback");
    }
    this.onMatch = onMatch;
    this.queueTimeoutMs = queueTimeoutMs;
    this.queues = new Map();
    this.playerModes = new Map();
  }

  enqueue({ playerId, mode = "1v1", metadata = {} }) {
    if (!playerId || typeof playerId !== "string") {
      throw new TypeError("playerId must be a non-empty string");
    }
    if (this.playerModes.has(playerId)) {
      return { status: "already_queued", mode: this.playerModes.get(playerId) };
    }

    const queue = this.queues.get(mode) || [];
    const opponentIndex = queue.findIndex((entry) => entry.playerId !== playerId);

    if (opponentIndex !== -1) {
      const [opponent] = queue.splice(opponentIndex, 1);
      this.playerModes.delete(opponent.playerId);
      if (queue.length === 0) this.queues.delete(mode);
      else this.queues.set(mode, queue);

      const match = {
        matchId: randomUUID(),
        mode,
        players: [
          { playerId: opponent.playerId, metadata: opponent.metadata },
          { playerId, metadata },
        ],
        createdAt: Date.now(),
      };

      Promise.resolve()
        .then(() => this.onMatch(match))
        .catch((error) => {
          // Keep the queue module independent of any logging framework.
          if (typeof this.onError === "function") this.onError(error, match);
        });

      return { status: "matched", match };
    }

    const entry = { playerId, metadata, queuedAt: Date.now(), timer: null };
    if (this.queueTimeoutMs > 0) {
      entry.timer = setTimeout(() => this.cancel(playerId), this.queueTimeoutMs);
      if (typeof entry.timer.unref === "function") entry.timer.unref();
    }
    queue.push(entry);
    this.queues.set(mode, queue);
    this.playerModes.set(playerId, mode);

    return { status: "queued", mode, position: queue.length };
  }

  cancel(playerId) {
    const mode = this.playerModes.get(playerId);
    if (!mode) return false;
    const queue = this.queues.get(mode) || [];
    const index = queue.findIndex((entry) => entry.playerId === playerId);
    if (index === -1) {
      this.playerModes.delete(playerId);
      return false;
    }
    const [entry] = queue.splice(index, 1);
    if (entry.timer) clearTimeout(entry.timer);
    this.playerModes.delete(playerId);
    if (queue.length === 0) this.queues.delete(mode);
    else this.queues.set(mode, queue);
    return true;
  }

  getQueueSize(mode = "1v1") {
    return (this.queues.get(mode) || []).length;
  }

  getPlayerMode(playerId) {
    return this.playerModes.get(playerId) || null;
  }

  clear() {
    for (const queue of this.queues.values()) {
      for (const entry of queue) {
        if (entry.timer) clearTimeout(entry.timer);
      }
    }
    this.queues.clear();
    this.playerModes.clear();
  }
}

module.exports = { MatchmakingQueue };
