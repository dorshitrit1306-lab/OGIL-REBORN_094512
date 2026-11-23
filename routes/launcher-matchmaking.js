const express = require("express");
const router = express.Router();
const { tokenSessions } = require("./auth");
const { matchmakingQueue } = require("../matchmaker/queue");

function authenticatedPlayer(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\\s+/i, "").trim();
  const session = token && tokenSessions.get(token);
  if (!session?.accountId) {
    return res.status(401).json({ ok: false, error: "A valid bearer access token is required." });
  }
  req.player = session;
  next();
}

router.post("/api/matchmaking/1v1/queue", authenticatedPlayer, (req, res) => {
  try {
    const result = matchmakingQueue.enqueue({
      playerId: req.player.accountId,
      displayName: req.player.displayName || req.player.username,
      mode: "1v1",
      region: req.body?.region || "auto",
    });
    res.status(result.status === "matched" ? 200 : 202).json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.get("/api/matchmaking/1v1/status", authenticatedPlayer, (req, res) => {
  res.json({ ok: true, ...matchmakingQueue.getPlayerState(req.player.accountId) });
});

router.delete("/api/matchmaking/1v1/queue", authenticatedPlayer, (req, res) => {
  const cancelled = matchmakingQueue.cancel(req.player.accountId);
  res.json({ ok: true, cancelled, ...matchmakingQueue.getPlayerState(req.player.accountId) });
});

module.exports = router;
