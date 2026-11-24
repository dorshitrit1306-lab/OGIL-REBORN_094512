const fs = require("fs");
const path = require("path");

const FILE = process.env.OGFN_ARENA_SELECTIONS_FILE || path.join(__dirname, "..", "data", "arena-selections.json");
const MODES = Object.freeze([
  { id: "SOLO", name: "SOLO", playlist: "Playlist_DefaultSolo", teamSize: 1 },
  { id: "DUOS", name: "DUOS", playlist: "Playlist_DefaultDuo", teamSize: 2 },
  { id: "SQUADS", name: "SQUADS", playlist: "Playlist_DefaultSquad", teamSize: 4 },
]);

function readAll() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function getSelection(accountId) {
  if (!accountId) return null;
  const entry = readAll()[accountId];
  const mode = MODES.find((item) => item.id === entry?.mode);
  if (!mode) return null;
  return { ...entry, ...mode };
}

function saveSelection(accountId, modeId) {
  const mode = MODES.find((item) => item.id === String(modeId || "").toUpperCase());
  if (!accountId || !mode) return { ok: false, reason: "Choose SOLO, DUOS, or SQUADS." };
  const all = readAll();
  all[accountId] = { mode: mode.id, playlist: mode.playlist, selectedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
  return { ok: true, selection: all[accountId] };
}

module.exports = { MODES, readAll, getSelection, saveSelection };
