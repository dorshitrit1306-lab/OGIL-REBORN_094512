const test = require("node:test");
const assert = require("node:assert/strict");
const { MatchmakingQueue } = require("./queue");

test("pairs two different players into one 1v1 match", () => {
  const queue = new MatchmakingQueue();
  assert.equal(queue.enqueue({ playerId: "a", displayName: "Alpha" }).status, "queued");
  const result = queue.enqueue({ playerId: "b", displayName: "Bravo" });
  assert.equal(result.status, "matched");
  assert.equal(result.match.players.length, 2);
  assert.deepEqual(result.match.players.map((p) => p.playerId), ["a", "b"]);
  assert.equal(queue.getPlayerState("a").match.id, result.match.id);
  assert.equal(queue.getQueueSize(), 0);
});

test("does not pair different regions unless one side chooses auto", () => {
  const queue = new MatchmakingQueue();
  queue.enqueue({ playerId: "a", region: "eu" });
  assert.equal(queue.enqueue({ playerId: "b", region: "nae" }).status, "queued");
  assert.equal(queue.getQueueSize(), 2);
});

test("prevents duplicate queue entries and supports cancellation", () => {
  const queue = new MatchmakingQueue();
  assert.equal(queue.enqueue({ playerId: "a" }).status, "queued");
  assert.equal(queue.enqueue({ playerId: "a" }).status, "already_queued");
  assert.equal(queue.cancel("a"), true);
  assert.equal(queue.getPlayerState("a").status, "not_queued");
});

test("rejects unsupported modes", () => {
  const queue = new MatchmakingQueue();
  assert.throws(() => queue.enqueue({ playerId: "a", mode: "solo" }), /Only 1v1/);
});

test("expires old queue entries", () => {
  let now = 1000;
  const queue = new MatchmakingQueue({ ttlMs: 50, now: () => now });
  queue.enqueue({ playerId: "a" });
  now += 51;
  assert.equal(queue.getPlayerState("a").status, "not_queued");
});
