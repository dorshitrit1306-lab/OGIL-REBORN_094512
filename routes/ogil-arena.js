const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { tokenSessions } = require("./auth");

const FILE = path.join(__dirname, "..", "data", "arena-selections.json");
const MODES = Object.freeze([
  { id: "SOLO", name: "SOLO", playlist: "Playlist_DefaultSolo", teamSize: 1 },
  { id: "DUOS", name: "DUOS", playlist: "Playlist_DefaultDuo", teamSize: 2 },
  { id: "SQUADS", name: "SQUADS", playlist: "Playlist_DefaultSquad", teamSize: 4 },
]);

function readSelections() {
  try {
    const value = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function authSession(req) {
  const header = String(req.headers.authorization || "");
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token ? tokenSessions.get(token) || null : null;
}

router.get("/api/ogil/arena/modes", (req, res) => {
  res.json({ arena: "OGIL ARENA", modes: MODES });
});

router.post("/api/ogil/arena/select", (req, res) => {
  const session = authSession(req);
  if (!session?.accountId) return res.status(401).json({ ok: false, reason: "Game login required." });

  const modeId = String(req.body?.mode || "").toUpperCase();
  const mode = MODES.find((entry) => entry.id === modeId);
  if (!mode) return res.status(400).json({ ok: false, reason: "Choose SOLO, DUOS, or SQUADS." });

  const selections = readSelections();
  selections[session.accountId] = { mode: mode.id, playlist: mode.playlist, selectedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(selections, null, 2));
  res.json({ ok: true, arena: "OGIL ARENA", selection: selections[session.accountId] });
});

router.get("/api/ogil/arena/select", (req, res) => {
  const session = authSession(req);
  if (!session?.accountId) return res.status(401).json({ ok: false, reason: "Game login required." });
  const selection = readSelections()[session.accountId] || null;
  res.json({ ok: true, selection });
});

module.exports = router;
