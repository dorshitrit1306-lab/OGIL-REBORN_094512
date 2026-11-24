const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "shop-settings.json");
const ZONE = "Asia/Jerusalem";

function read() {
  try {
    const value = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return {
      featured: Array.isArray(value.featured) ? value.featured : [],
      daily: Array.isArray(value.daily) ? value.daily : [],
      updatedAt: value.updatedAt || null,
      updatedBy: value.updatedBy || null,
    };
  } catch {
    return { featured: [], daily: [], updatedAt: null, updatedBy: null };
  }
}

function write(settings) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const value = {
    featured: [...new Set(settings.featured || [])].slice(0, 24),
    daily: [...new Set(settings.daily || [])].slice(0, 24),
    updatedAt: new Date().toISOString(),
    updatedBy: String(settings.updatedBy || "owner").slice(0, 80),
  };
  fs.writeFileSync(FILE, JSON.stringify(value, null, 2));
  return value;
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
  // Find the next local 19:30 boundary; minute scanning naturally handles DST.
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
  const previous = new Date(next.getTime() - 24 * 60 * 60 * 1000);
  const p = israelParts(previous);
  return {
    key: `${p.year}-${p.month}-${p.day}-1930`,
    expires: next.toISOString(),
  };
}

module.exports = { read, write, nextRotation, rotationWindow };
