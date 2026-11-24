const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogil-arena-matchmaking-"));
process.env.OGFN_ARENA_SELECTIONS_FILE = path.join(tempDir, "selections.json");

const arenaModes = require("../structs/arenaModes");
const { resolveMatchPlaylist } = require("../routes/matchmaking");
const accountId = "1234567890abcdef1234567890abcdef";

test.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test("OGIL Arena matchmaking uses the saved SOLO selection", () => {
  assert.equal(arenaModes.saveSelection(accountId, "SOLO").ok, true);
  assert.equal(resolveMatchPlaylist("14.60:NAE:ogil_arena", accountId), "Playlist_DefaultSolo");
});

test("OGIL Arena matchmaking uses the saved DUOS selection", () => {
  arenaModes.saveSelection(accountId, "DUOS");
  assert.equal(resolveMatchPlaylist("14.60:NAE:ogil_arena", accountId), "Playlist_DefaultDuo");
});

test("OGIL Arena matchmaking uses the saved SQUADS selection", () => {
  arenaModes.saveSelection(accountId, "SQUADS");
  assert.equal(resolveMatchPlaylist("14.60:NAE:ogil_arena", accountId), "Playlist_DefaultSquad");
});

test("non-Arena matchmaking remains controlled by the requested playlist", () => {
  arenaModes.saveSelection(accountId, "SQUADS");
  assert.equal(resolveMatchPlaylist("14.60:NAE:playlist_defaultduo", accountId), "Playlist_DefaultDuo");
});

test("Arena matchmaking defaults to SOLO when no choice has been saved", () => {
  assert.equal(resolveMatchPlaylist("14.60:NAE:ogil_arena", "fedcba0987654321fedcba0987654321"), "Playlist_DefaultSolo");
});
