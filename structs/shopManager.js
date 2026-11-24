const fs = require("fs");
const path = require("path");

const FILE = process.env.OGFN_SHOP_SETTINGS_FILE || path.join(__dirname, "..", "data", "shop-settings.json");
const ZONE = "Asia/Jerusalem";

function defaultState() {
  return {
    active: { featured: [], daily: [] },
    draft: { featured: [], daily: [] },
    configured: false,
    lastRotationKey: null,
    updatedAt: null,
    updatedBy: null,
  };
}

function read() {
  try {
    const value = JSON.parse(fs.readFileSync(FILE, "utf8"));
    // Migrate the earlier draft-only format safely.
    const draft = value.draft || {
      featured: Array.isArray(value.featured) ? value.featured : [],
      daily: Array.isArray(value.daily) ? value.daily : [],
    };
    const active = value.active || { featured: [], daily: [] };
    return {
      active: {
        featured: Array.isArray(active.featured) ? active.featured : [],
        daily: Array.isArray(active.daily) ? active.daily : [],
      },
      draft: {
        featured: Array.isArray(draft.featured) ? draft.featured : [],
        daily: Array.isArray(draft.daily) ? draft.daily : [],
      },
      configured: Boolean(value.configured || value.featured || value.draft),
      lastRotationKey: value.lastRotationKey || null,
      updatedAt: value.updatedAt || null,
      updatedBy: value.updatedBy || null,
      publishedAt: value.publishedAt || null,
    };
  } catch {
    return defaultState();
  }
}

function persist(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  return state;
}

function uniqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && id.trim()))].slice(0, 24);
}

function saveDraft(settings, now = new Date()) {
  const state = read();
  state.draft = {
    featured: uniqueIds(settings.featured),
    daily: uniqueIds(settings.daily),
  };
  state.configured = true;
  if (!state.lastRotationKey) state.lastRotationKey = rotationWindow(now).key;
  state.updatedAt = now.toISOString();
  state.updatedBy = String(settings.updatedBy || "owner").slice(0, 80);
  return persist(state);
}

function israelParts(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
}

function nextRotation(from = new Date()) {
  const candidate = new Date(from);
  candidate.setUTCSeconds(0, 0);
  candidate.setTime(candidate.getTime() + 60000);
  for (let i = 0; i < 26 * 60; i++, candidate.setTime(candidate.getTime() + 60000)) {
    const p = israelParts(candidate);
    if (p.hour === "19" && p.minute === "30") return candidate;
  }
  throw new Error("Could not calculate next Israel shop rotation.");
}

function rotationWindow(now = new Date()) {
  const next = nextRotation(now);
  const current = israelParts(now);
  let year = Number(current.year);
  let month = Number(current.month);
  let day = Number(current.day);
  if (current.hour < "19" || (current.hour === "19" && current.minute < "30")) {
    const previousDay = new Date(Date.UTC(year, month - 1, day - 1));
    year = previousDay.getUTCFullYear();
    month = previousDay.getUTCMonth() + 1;
    day = previousDay.getUTCDate();
  }
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-1930`;
  return { key, expires: next.toISOString() };
}

function publishDraft(now = new Date()) {
  const state = read();
  state.active = { ...state.draft };
  state.lastRotationKey = rotationWindow(now).key;
  state.publishedAt = now.toISOString();
  persist(state);
  return state;
}

// Called when the catalog is built. Draft selections become active once per
// Israeli 19:30 shop window, including after a server restart.
function activateIfDue(rotationKey) {
  const state = read();
  if (state.lastRotationKey !== rotationKey) {
    if (state.configured) {
      state.active = { ...state.draft };
      state.publishedAt = new Date().toISOString();
    }
    state.lastRotationKey = rotationKey;
    persist(state);
  }
  return state;
}

module.exports = { read, saveDraft, publishDraft, nextRotation, rotationWindow, activateIfDue, ZONE };
