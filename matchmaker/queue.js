const crypto = require("crypto");

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const MATCH_TTL_MS = 30 * 60 * 1000;

class MatchmakingQueue {
  constructor({ ttlMs = DEFAULT_TTL_MS, matchTtlMs = MATCH_TTL_MS, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.matchTtlMs = matchTtlMs;
    this.now = now;
    this.waiting = new Map();
    this.matches = new Map();
    this.playerMatches = new Map();
  }

  _clean() {
    const now = this.now();
    for (const [playerId, entry] of this.waiting) {
      if (now - entry.queuedAt > this.ttlMs) this.waiting.delete(playerId);
    }
    for (const [matchId, match] of this.matches) {
      if (now - match.createdAt > this.matchTtlMs) {
        this.matches.delete(matchId);
        for (const player of match.players) this.playerMatches.delete(player.playerId);
      }
    }
  }

  enqueue({ playerId, displayName, mode = "1v1", region = "auto" }) {
    if (!playerId) throw new TypeError("playerId is required");
    if (mode !== "1v1") throw new TypeError("Only 1v1 matchmaking is currently supported");
    this._clean();

    const activeMatchId = this.playerMatches.get(playerId);
    if (activeMatchId) {
      return { status: "matched", match: this.matches.get(activeMatchId) || null };
    }

    const existing = this.waiting.get(playerId);
    if (existing) return { status: "already_queued", queuedAt: existing.queuedAt };

    const normalizedRegion = String(region || "auto").toLowerCase();
    const entry = {
      playerId,
      displayName: String(displayName || "Player").slice(0, 32),
      mode,
      region: normalizedRegion,
      queuedAt: this.now(),
    };

    const opponent = [...this.waiting.values()].find(
      (candidate) => candidate.mode === mode &&
        (candidate.region === normalizedRegion || candidate.region === "auto" || normalizedRegion === "auto")
    );

    if (!opponent) {
      this.waiting.set(playerId, entry);
      return { status: "queued", queuedAt: entry.queuedAt, position: this.waiting.size };
    }

    this.waiting.delete(opponent.playerId);
    const match = {
      id: crypto.randomUUID(),
      mode,
      region: normalizedRegion === "auto" ? opponent.region : normalizedRegion,
      status: "paired",
      createdAt: this.now(),
      players: [opponent, entry].map(({ playerId: id, displayName: name }) => ({
        playerId: id,
        displayName: name,
      })),
    };
    this.matches.set(match.id, match);
    for (const player of match.players) this.playerMatches.set(player.playerId, match.id);
    return { status: "matched", match };
  }

  cancel(playerId) {
    this._clean();
    return this.waiting.delete(playerId);
  }

  getPlayerState(playerId) {
    this._clean();
    const matchId = this.playerMatches.get(playerId);
    if (matchId) return { status: "matched", match: this.matches.get(matchId) || null };
    const queued = this.waiting.get(playerId);
    if (queued) return { status: "queued", queuedAt: queued.queuedAt, position: this.waiting.size };
    return { status: "not_queued" };
  }

  getQueueSize(mode = "1v1") {
    this._clean();
    return [...this.waiting.values()].filter((entry) => entry.mode === mode).length;
  }
}

const matchmakingQueue = new MatchmakingQueue();

module.exports = { MatchmakingQueue, matchmakingQueue };
