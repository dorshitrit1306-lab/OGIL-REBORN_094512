const express = require("express");
const app = express.Router();
const { tokenSessions } = require("./auth");
const {
  partyPayload,
  createParty,
  getParty,
  getUserParty,
  getUserPartyId,
  addMember,
  removeMember,
  addInvite,
  listUserInvites,
  listUserCurrent,
  updateParty,
} = require("../structs/partyService");
const {
  canViewParty,
  canJoinParty,
  canInviteToParty,
  canRemovePartyMember,
  canUpdateParty,
} = require("../structs/partyAccess");

function authenticatedPartyUser(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const session = token && tokenSessions.get(token);
  if (!session?.accountId) {
    return res.status(401).json({ errorCode: "errors.com.epicgames.common.authentication_required" });
  }
  req.partyUser = session;
  next();
}

function requireOwnAccount(req, res, next) {
  if (req.partyUser.accountId !== req.params.accountId) {
    return res.status(403).json({ error: "account_mismatch" });
  }
  next();
}

function partyError(res, reason) {
  let status = 400;
  if (reason === "party_full" || reason === "already_in_party") status = 409;
  else if (
    reason === "not_member" ||
    reason === "captain_required" ||
    reason === "invite_required" ||
    reason === "party_closed"
  ) status = 403;
  return res.status(status).json({ error: reason });
}

app.get("/party/api/v1/Fortnite/user/:accountId", authenticatedPartyUser, requireOwnAccount, (req, res) => {
  res.json({
    current: listUserCurrent(req.params.accountId),
    pending: [],
    invites: listUserInvites(req.params.accountId),
    pings: [],
  });
});

app.get("/party/api/v1/Fortnite/parties/:partyId", authenticatedPartyUser, (req, res) => {
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  if (!canViewParty(party, req.partyUser.accountId)) {
    return res.status(403).json({ error: "party_access_denied" });
  }
  res.json(partyPayload(party));
});

app.post("/party/api/v1/Fortnite/parties", authenticatedPartyUser, (req, res) => {
  const captainId = req.partyUser.accountId;
  const existing = getUserParty(captainId);
  if (existing) return res.json(partyPayload(existing));
  const party = createParty(captainId, req.body || {});
  res.json(partyPayload(party));
});

app.patch("/party/api/v1/Fortnite/parties/:partyId", authenticatedPartyUser, (req, res) => {
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  const permission = canUpdateParty(party, req.partyUser.accountId);
  if (!permission.ok) return partyError(res, permission.reason);
  updateParty(party, req.body || {});
  res.status(204).end();
});

app.post("/party/api/v1/Fortnite/parties/:partyId/members/:accountId/join", authenticatedPartyUser, requireOwnAccount, (req, res) => {
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  const permission = canJoinParty(party, req.partyUser.accountId, getUserPartyId(req.partyUser.accountId));
  if (!permission.ok) return partyError(res, permission.reason);
  if (!permission.alreadyMember) addMember(party, req.partyUser.accountId, "MEMBER");
  res.status(204).end();
});

app.post("/party/api/v1/Fortnite/parties/:partyId/members/:accountId/invite", authenticatedPartyUser, requireOwnAccount, (req, res) => {
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  const inviteeId = req.body?.invitee_id || req.body?.inviteeId;
  const permission = canInviteToParty(party, req.partyUser.accountId, inviteeId);
  if (!permission.ok) return partyError(res, permission.reason);
  addInvite(party, req.partyUser.accountId, inviteeId, req.body?.meta || {});
  res.status(204).end();
});

app.post("/party/api/v1/Fortnite/parties/:partyId/members/:accountId/kick", authenticatedPartyUser, (req, res) => {
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  const permission = canRemovePartyMember(party, req.partyUser.accountId, req.params.accountId);
  if (!permission.ok) return partyError(res, permission.reason);
  removeMember(party, req.params.accountId);
  res.status(204).end();
});

app.post("/party/api/v1/Fortnite/parties/:partyId/members/:accountId/confirm", authenticatedPartyUser, requireOwnAccount, (req, res) => {
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  if (!canViewParty(party, req.partyUser.accountId)) return partyError(res, "invite_required");
  const permission = canJoinParty(party, req.partyUser.accountId, getUserPartyId(req.partyUser.accountId));
  if (!permission.ok) return partyError(res, permission.reason);
  if (!permission.alreadyMember) addMember(party, req.partyUser.accountId, "MEMBER");
  res.status(204).end();
});

app.post("/party/api/v1/Fortnite/parties/:partyId/members/:accountId/meta", authenticatedPartyUser, requireOwnAccount, (req, res) => {
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  const row = party.members.find((member) => member.account_id === req.partyUser.accountId);
  if (!row) return partyError(res, "not_member");
  row.meta = { ...row.meta, ...(req.body || {}) };
  party.revision += 1;
  res.status(204).end();
});

app.post("/party/api/v1/Fortnite/parties/:partyId/members/:accountId/:action", authenticatedPartyUser, (req, res) => {
  const action = String(req.params.action || "").toLowerCase();
  if (action !== "join" && action !== "confirm") return res.status(400).json({ error: "unsupported_action" });
  if (req.partyUser.accountId !== req.params.accountId) return res.status(403).json({ error: "account_mismatch" });
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  if (action === "confirm" && !canViewParty(party, req.partyUser.accountId)) {
    return partyError(res, "invite_required");
  }
  const permission = canJoinParty(party, req.partyUser.accountId, getUserPartyId(req.partyUser.accountId));
  if (!permission.ok) return partyError(res, permission.reason);
  if (!permission.alreadyMember) addMember(party, req.partyUser.accountId, "MEMBER");
  res.status(204).end();
});

app.delete("/party/api/v1/Fortnite/parties/:partyId/members/:accountId", authenticatedPartyUser, (req, res) => {
  const party = getParty(req.params.partyId);
  if (!party) return res.status(404).end();
  const permission = canRemovePartyMember(party, req.partyUser.accountId, req.params.accountId);
  if (!permission.ok) return partyError(res, permission.reason);
  removeMember(party, req.params.accountId);
  res.status(204).end();
});

app.post("/party/api/v1/Fortnite/user/:accountId/pings/:pingerId", authenticatedPartyUser, (req, res) => {
  if (req.partyUser.accountId !== req.params.pingerId) return res.status(403).json({ error: "account_mismatch" });
  const { areFriends } = require("../structs/friendGraph");
  if (!areFriends(req.params.pingerId, req.params.accountId)) {
    return res.status(403).json({ error: "friends_only" });
  }
  const { notifyParty } = require("../structs/socialNotify");
  const { displayNameFor } = require("../structs/friends");
  notifyParty(req.params.accountId, "PING", {
    pinger_id: req.params.pingerId,
    pinger_display_name: displayNameFor(req.params.pingerId),
    sent_at: new Date().toISOString(),
  });
  res.status(204).end();
});

module.exports = app;
module.exports.authenticatedPartyUser = authenticatedPartyUser;
module.exports.requireOwnAccount = requireOwnAccount;
