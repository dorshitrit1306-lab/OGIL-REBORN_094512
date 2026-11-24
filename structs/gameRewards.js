const fs = require("fs");
const path = require("path");

const FILE = process.env.OGFN_REWARD_EVENTS_FILE || path.join(__dirname, "..", "data", "reward-events.json");
const REWARDS = Object.freeze({ elimination: 50, victory: 200 });

function readEvents() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeEvents(events) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(events, null, 2));
}

function award({ accountId, eventType, matchId, eventId }, grant) {
  const type = String(eventType || "").toLowerCase();
  const player = String(accountId || "");
  const match = String(matchId || "");
  const event = String(eventId || "");
  if (!Object.hasOwn(REWARDS, type)) return { ok: false, reason: "Unsupported reward event." };
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(player)) return { ok: false, reason: "Invalid accountId." };
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(match)) return { ok: false, reason: "Invalid matchId." };
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(event)) return { ok: false, reason: "Invalid eventId." };

  const key = type === "victory"
    ? `victory:${match}:${player}`
    : `elimination:${event}:${player}`;
  const events = readEvents();
  if (events[key]) return { ok: false, duplicate: true, reason: "This match reward was already paid." };

  const amount = REWARDS[type];
  const result = grant(player, amount);
  if (!result?.ok) return { ok: false, reason: result?.reason || "Could not credit V-Bucks." };

  events[key] = { accountId: player, eventType: type, matchId: match, eventId: event, amount, awardedAt: new Date().toISOString() };
  writeEvents(events);
  return { ok: true, amount, vbucks: result.vbucks, accountId: player };
}

module.exports = { award, REWARDS };
