const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogfn-shop-test-"));
process.env.OGFN_SHOP_SETTINGS_FILE = path.join(tempDir, "shop-settings.json");
const manager = require("../structs/shopManager");

test.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test("shop rotates at 19:30 in Israel during standard time", () => {
  const now = new Date("2026-11-24T15:00:00.000Z"); // 17:00 in Israel
  const next = manager.nextRotation(now);
  assert.equal(next.toISOString(), "2026-11-24T17:30:00.000Z");
  assert.deepEqual(manager.rotationWindow(now), {
    key: "2026-11-23-1930",
    expires: "2026-11-24T17:30:00.000Z",
  });
});

test("the rotation window advances after 19:30 Israel time", () => {
  const now = new Date("2026-11-24T18:00:00.000Z"); // 20:00 in Israel
  assert.deepEqual(manager.rotationWindow(now), {
    key: "2026-11-24-1930",
    expires: "2026-11-25T17:30:00.000Z",
  });
});

test("shop rotation respects daylight saving time changes", () => {
  const now = new Date("2026-03-29T17:00:00.000Z"); // 20:00 in Israel after DST begins
  assert.deepEqual(manager.rotationWindow(now), {
    key: "2026-03-29-1930",
    expires: "2026-03-30T16:30:00.000Z",
  });
});

test("a shop draft remains pending until the next rotation", () => {
  const now = new Date("2026-11-24T15:00:00.000Z");
  const currentKey = manager.rotationWindow(now).key;
  manager.saveDraft({ featured: ["AthenaCharacter:CID_001"], daily: ["AthenaDance:EID_Test"] });
  const beforeRotation = manager.activateIfDue(currentKey);
  assert.equal(beforeRotation.active.featured.length, 0);
  assert.deepEqual(beforeRotation.draft.featured, ["AthenaCharacter:CID_001"]);

  const afterRotation = manager.activateIfDue("2026-11-24-1930");
  assert.deepEqual(afterRotation.active.featured, ["AthenaCharacter:CID_001"]);
});

test("owner can publish a saved draft immediately", () => {
  const saved = manager.saveDraft({ featured: ["AthenaCharacter:CID_002"], daily: [] });
  const published = manager.publishDraft();
  assert.deepEqual(published.active, saved.draft);
});
