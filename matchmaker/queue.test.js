const test = require("node:test");
const assert = require("node:assert/strict");
const { MatchmakingQueue } = require("./queue");

test("pairs two different players in the same mode", async () => {
  let resolved;
  const matched = new Promise((resolve) => { resolved = resolve; });
  const queue = new MatchmakingQueue({ onMatch: resolved });
  const first = queue.enqueue({ playerId: "player-a", mode: "1v1" });
  assert.equal(first.status, "queued");
  assert.equal(queue.getQueueSize("1v1"), 1);

  const second = queue.enqueue({ playerId: "player-b", mode: "1v1" });
  assert.equal(second.status, "matched");
  assert.equal(second.match.players.length, 2);
  assert.deepEqual(
    second.match.players.map((player) => player.playerId).sort(),
    ["player-a", "player-b"]
  );
  assert.equal(await matched, second.match);
  assert.equal(queue.getQueueSize("1v1"), 0);
});

test("does not pair players from different modes", () => {
  const queue = new MatchmakingQueue({ onMatch: () => {} });
  assert.equal(queue.enqueue({ playerId: "solo", mode: "solo" }).status, "queued");
  assert.equal(queue.enqueue({ playerId: "duo", mode: "duo" }).status, "queued");
  assert.equal(queue.getQueueSize("solo"), 1);
  assert.equal(queue.getQueueSize("duo"), 1);
  queue.clear();
});

test("allows a player to cancel and requeue", () => {
  const queue = new MatchmakingQueue({ onMatch: () => {} });
  queue.enqueue({ playerId: "player-a" });
  assert.equal(queue.cancel("player-a"), true);
  assert.equal(queue.getQueueSize("1v1"), 0);
  assert.equal(queue.enqueue({ playerId: "player-a" }).status, "queued");
  queue.clear();
});

test("does not queue the same player twice", () => {
  const queue = new MatchmakingQueue({ onMatch: () => {} });
  assert.equal(queue.enqueue({ playerId: "player-a" }).status, "queued");
  assert.equal(queue.enqueue({ playerId: "player-a" }).status, "already_queued");
  assert.equal(queue.getQueueSize("1v1"), 1);
  queue.clear();
});
