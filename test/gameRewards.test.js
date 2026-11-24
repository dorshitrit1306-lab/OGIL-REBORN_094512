const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogfn-reward-test-"));
process.env.OGFN_REWARD_EVENTS_FILE = path.join(tempDir, "rewards.json");
const { award } = require("../structs/gameRewards");

test("elimination and victory rewards use the configured amounts", () => {
  const awards = [];
  const grant = (accountId, amount) => {
    awards.push({ accountId, amount });
    return { ok: true, vbucks: amount };
  };

  const elimination = award({
    accountId: "abcdef0123456789",
    eventType: "elimination",
    matchId: "match-0001",
    eventId: "elim-0000001",
  }, grant);
  const victory = award({
    accountId: "abcdef0123456789",
    eventType: "victory",
    matchId: "match-0001",
    eventId: "vict-0000001",
  }, grant);

  assert.equal(elimination.amount, 50);
  assert.equal(victory.amount, 200);
  assert.deepEqual(awards.map((item) => item.amount), [50, 200]);
});

test("the same match victory cannot be paid twice", () => {
  let paid = 0;
  const input = {
    accountId: "abcdef0123456789",
    eventType: "victory",
    matchId: "match-0002",
    eventId: "vict-0000002",
  };
  const grant = () => { paid += 1; return { ok: true, vbucks: paid * 200 }; };
  assert.equal(award(input, grant).ok, true);
  const duplicate = award(input, grant);
  assert.equal(duplicate.duplicate, true);
  assert.equal(paid, 1);
});

test("reward amounts are not client-selectable", () => {
  const result = award({
    accountId: "abcdef0123456789",
    eventType: "grant-999999",
    matchId: "match-0003",
    eventId: "event-0000003",
  }, () => ({ ok: true }));
  assert.equal(result.ok, false);
});
