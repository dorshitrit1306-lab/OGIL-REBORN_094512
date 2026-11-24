const test = require("node:test");
const assert = require("node:assert/strict");

const { buildConfiguredStorefronts } = require("../structs/itemShop");

function item(id, type = "outfit") {
  return {
    name: id,
    type,
    templateId: `AthenaCharacter:${id}`,
    rarity: "rare",
    chapter: 1,
    season: 4,
  };
}

test("custom shop keeps the legacy BRSeasonStorefront and excludes selected items", () => {
  const pool = Array.from({ length: 16 }, (_, i) => item(`CID_${String(i).padStart(3, "0")}`));
  const featured = pool[0].templateId;
  const daily = pool[1].templateId;
  const storefronts = buildConfiguredStorefronts({
    schedule: { active: { featured: [featured], daily: [daily] } },
    pool,
    season: 4,
    expiration: "2026-11-25T17:30:00.000Z",
    rotationKey: "2026-11-24-1930",
  });

  assert.deepEqual(storefronts.map((store) => store.name), [
    "BRWeeklyStorefront",
    "BRDailyStorefront",
    "BRSeasonStorefront",
  ]);
  assert.equal(storefronts[0].catalogEntries.length, 1);
  assert.equal(storefronts[1].catalogEntries.length, 1);
  assert.equal(storefronts[2].catalogEntries.length, 6);
  const selectedIds = new Set([featured, daily]);
  for (const entry of storefronts[2].catalogEntries) {
    assert.equal(selectedIds.has(entry.itemGrants[0].templateId), false);
  }
});

test("custom modern shop preserves the existing two-storefront layout", () => {
  const pool = Array.from({ length: 12 }, (_, i) => item(`CID_${String(i).padStart(3, "0")}`));
  const storefronts = buildConfiguredStorefronts({
    schedule: { active: { featured: [pool[0].templateId], daily: [pool[1].templateId] } },
    pool,
    season: 14,
    expiration: "2026-11-25T17:30:00.000Z",
    rotationKey: "2026-11-24-1930",
  });
  assert.deepEqual(storefronts.map((store) => store.name), [
    "BRWeeklyStorefront",
    "BRDailyStorefront",
  ]);
});
