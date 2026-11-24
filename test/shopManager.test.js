const test = require("node:test");
const assert = require("node:assert/strict");
const { nextRotation, rotationWindow } = require("../structs/shopManager");

test("shop rotates at 19:30 in Israel during standard time", () => {
  const now = new Date("2026-11-24T15:00:00.000Z"); // 17:00 in Israel
  const next = nextRotation(now);
  assert.equal(next.toISOString(), "2026-11-24T17:30:00.000Z");
  assert.deepEqual(rotationWindow(now), {
    key: "2026-11-23-1930",
    expires: "2026-11-24T17:30:00.000Z",
  });
});

test("the rotation window advances after 19:30 Israel time", () => {
  const now = new Date("2026-11-24T18:00:00.000Z"); // 20:00 in Israel
  assert.deepEqual(rotationWindow(now), {
    key: "2026-11-24-1930",
    expires: "2026-11-25T17:30:00.000Z",
  });
});

test("shop rotation respects daylight saving time changes", () => {
  const now = new Date("2026-03-29T17:00:00.000Z"); // 20:00 in Israel after DST begins
  assert.deepEqual(rotationWindow(now), {
    key: "2026-03-29-1930",
    expires: "2026-03-30T16:30:00.000Z",
  });
});
