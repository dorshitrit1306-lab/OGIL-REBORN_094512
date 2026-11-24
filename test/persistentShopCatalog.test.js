const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogil-shop-catalog-"));
process.env.NODE_ENV = "test";
process.env.VELOCITY_SHOP_COSMETICS_FILE = path.join(tempDir, "data", "shop-cosmetics.json");

test.after(() => {
  delete process.env.VELOCITY_SHOP_COSMETICS_FILE;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("item shop reads the personal cosmetics catalog from user data", () => {
  fs.mkdirSync(path.dirname(process.env.VELOCITY_SHOP_COSMETICS_FILE), { recursive: true });
  const catalog = [
    {
      name: "OGIL Catalog Test",
      type: "outfit",
      templateId: "AthenaCharacter:CID_OGIL_Catalog_Test",
      rarity: "rare",
      chapter: 2,
      season: 4,
    },
  ];
  fs.writeFileSync(process.env.VELOCITY_SHOP_COSMETICS_FILE, JSON.stringify(catalog));

  const modulePath = require.resolve("../structs/itemShop");
  delete require.cache[modulePath];
  const shop = require("../structs/itemShop");
  assert.deepEqual(shop.loadPoolFromDisk(), catalog);
});
