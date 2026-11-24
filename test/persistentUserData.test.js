const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogil-persistent-user-data-"));
process.env.VELOCITY_DATA_DIR = path.join(tempDir, "data");
process.env.VELOCITY_CUSTOM_COSMETICS_FILE = path.join(tempDir, "data", "custom-cosmetics.json");
process.env.VELOCITY_CUSTOM_PAK_DIR = path.join(tempDir, "custom-paks");
process.env.VELOCITY_CUSTOM_PAK_REGISTRY = path.join(tempDir, "data", "custom-paks.json");
process.env.VELOCITY_FRIENDS_STORE = path.join(tempDir, "data", "friends-graph.json");
process.env.OGFN_ARENA_SELECTIONS_FILE = path.join(tempDir, "data", "arena-selections.json");
process.env.VELOCITY_BANS_FILE = path.join(tempDir, "data", "bans.json");

test.after(() => {
  for (const key of [
    "VELOCITY_DATA_DIR",
    "VELOCITY_CUSTOM_COSMETICS_FILE",
    "VELOCITY_CUSTOM_PAK_DIR",
    "VELOCITY_CUSTOM_PAK_REGISTRY",
    "VELOCITY_FRIENDS_STORE",
    "OGFN_ARENA_SELECTIONS_FILE",
    "VELOCITY_BANS_FILE",
  ]) delete process.env[key];
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("custom cosmetics survive module reloads in the persistent user-data folder", () => {
  const modulePath = require.resolve("../structs/customCosmetics");
  delete require.cache[modulePath];
  let cosmetics = require(modulePath);

  const result = cosmetics.addCustomCosmetic({
    name: "OGIL Test Outfit",
    templateId: "AthenaCharacter:CID_OGIL_Test",
    type: "outfit",
    rarity: "epic",
  });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(process.env.VELOCITY_CUSTOM_COSMETICS_FILE), true);

  delete require.cache[modulePath];
  cosmetics = require(modulePath);
  assert.equal(cosmetics.loadCustomCosmetics()[0].name, "OGIL Test Outfit");
});

test("server metadata survives module reloads in the persistent user-data folder", () => {
  const modulePath = require.resolve("../structs/serverMeta");
  delete require.cache[modulePath];
  let meta = require(modulePath);

  const result = meta.addCustomMatchCode({
    code: "OGIL2026",
    playlist: "Playlist_DefaultSolo",
    region: "NAE",
    createdBy: "Owner",
  });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(process.env.VELOCITY_DATA_DIR, "custom-match-codes.json")), true);

  delete require.cache[modulePath];
  meta = require(modulePath);
  assert.equal(meta.listCustomMatchCodes()[0].code, "OGIL2026");
});

test("custom PAK registry and related cosmetic metadata use persistent user data", () => {
  fs.mkdirSync(process.env.VELOCITY_CUSTOM_PAK_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.VELOCITY_CUSTOM_PAK_DIR, "ogil-test.pak"), "test");

  const modulePath = require.resolve("../structs/customPaks");
  delete require.cache[modulePath];
  let paks = require(modulePath);
  const result = paks.registerPakEntry({
    name: "OGIL Test Cosmetic",
    pakFile: "ogil-test.pak",
    templateId: "AthenaCharacter:CID_OGIL_PAK_Test",
  });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(process.env.VELOCITY_CUSTOM_PAK_REGISTRY), true);

  delete require.cache[modulePath];
  paks = require(modulePath);
  assert.equal(paks.loadPakRegistry()[0].pakFile, "ogil-test.pak");

  const cosmeticModulePath = require.resolve("../structs/customCosmetics");
  delete require.cache[cosmeticModulePath];
  const cosmetics = require(cosmeticModulePath);
  assert.equal(
    cosmetics.findCustomCosmetic("AthenaCharacter:CID_OGIL_PAK_Test").pakFile,
    "ogil-test.pak"
  );
});

test("friend relationships survive module reloads in the persistent user-data folder", () => {
  const modulePath = require.resolve("../structs/friendGraph");
  delete require.cache[modulePath];
  let friends = require(modulePath);

  friends.registerAccount("player-account-0001");
  friends.registerAccount("player-account-0002");
  friends.addFriendship("player-account-0001", "player-account-0002");
  assert.equal(fs.existsSync(process.env.VELOCITY_FRIENDS_STORE), true);

  delete require.cache[modulePath];
  friends = require(modulePath);
  assert.equal(friends.areFriends("player-account-0001", "player-account-0002"), true);
  assert.deepEqual(friends.listFriends("player-account-0002"), ["player-account-0001"]);
});

test("OGIL Arena mode selection survives module reloads in persistent user data", () => {
  const modulePath = require.resolve("../structs/arenaModes");
  delete require.cache[modulePath];
  let arena = require(modulePath);

  const saved = arena.saveSelection("player-account-0003", "DUOS");
  assert.equal(saved.ok, true);
  assert.equal(fs.existsSync(process.env.OGFN_ARENA_SELECTIONS_FILE), true);

  delete require.cache[modulePath];
  arena = require(modulePath);
  assert.equal(arena.getSelection("player-account-0003").id, "DUOS");
  assert.equal(arena.getSelection("player-account-0003").playlist, "Playlist_DefaultDuo");
});

test("player bans survive module reloads in persistent user data", () => {
  const modulePath = require.resolve("../structs/bans");
  delete require.cache[modulePath];
  let bans = require(modulePath);

  const result = bans.banAccount({
    accountId: "11111111111111111111111111111111",
    username: "TestPlayer",
    reason: "Persistence test",
    bannedBy: "Owner",
  });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(process.env.VELOCITY_BANS_FILE), true);

  delete require.cache[modulePath];
  bans = require(modulePath);
  assert.equal(bans.isBanned("11111111111111111111111111111111"), true);
  assert.equal(bans.listBans()[0].username, "TestPlayer");
});
