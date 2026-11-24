const express = require("express");
const router = express.Router();
const { tokenSessions } = require("./auth");
const arenaModes = require("../structs/arenaModes");
const { MODES } = arenaModes;

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

  const result = arenaModes.saveSelection(session.accountId, mode.id);
  res.json({ ...result, arena: "OGIL ARENA" });
});

router.get("/api/ogil/arena/select", (req, res) => {
  const session = authSession(req);
  if (!session?.accountId) return res.status(401).json({ ok: false, reason: "Game login required." });
  const selection = arenaModes.getSelection(session.accountId);
  res.json({ ok: true, selection });
});

module.exports = router;
