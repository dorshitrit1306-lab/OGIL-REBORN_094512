const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../utils/config").loadConfig();

const FILE = process.env.OGFN_SHOP_STAFF_FILE || path.join(__dirname, "..", "data", "shop-staff.json");
const ALLOWED = new Set(["shop:view", "shop:edit", "shop:publish"]);

function readStaff() {
  try {
    const value = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveStaff(value) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(value, null, 2));
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}


function ownerKeyFilePath() {
  const dataDir = process.env.VELOCITY_DATA_DIR || path.join(__dirname, "..", "data");
  return process.env.OGFN_PANEL_KEY_FILE || path.join(dataDir, "Owner-Panel-Key.txt");
}

/**
 * Create a strong first-run Owner panel key when no environment/config key
 * exists. The plaintext key is stored only in the local user-data folder.
 */
function ensureOwnerToken() {
  if (String(process.env.OGFN_PANEL_TOKEN || "").trim()) {
    return { configured: true, generated: false, keyFilePath: null };
  }

  let generated = false;
  if (!String(config.panelToken || "").trim()) {
    config.panelToken = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    generated = true;
  }

  const keyFilePath = ownerKeyFilePath();
  fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });
  if (!fs.existsSync(keyFilePath)) {
    fs.writeFileSync(
      keyFilePath,
      [
        "OGIL REBORN — OWNER PANEL KEY",
        "",
        "Enter this key in the Owner or Partner key field in the control panel.",
        "Keep this file private. Anyone with this key can manage the server.",
        "",
        config.panelToken,
        "",
      ].join("\n"),
      { mode: 0o600 }
    );
  }

  return { configured: true, generated, keyFilePath };
}

function ownerToken() {
  return String(process.env.OGFN_PANEL_TOKEN || config.panelToken || "");
}

function authenticate(token) {
  const owner = ownerToken();
  if (owner && safeEqual(token, owner)) return { role: "owner", username: "Owner", permissions: ["shop:view", "shop:edit", "shop:publish"] };
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const partner = readStaff().find((entry) => entry.enabled !== false && safeEqual(entry.tokenHash, hash));
  if (!partner) return null;
  return {
    role: "partner",
    id: partner.id,
    username: partner.username,
    permissions: partner.permissions || [],
  };
}

function createPartner(username, permissions) {
  const name = String(username || "").trim().slice(0, 40);
  if (name.length < 2) return { ok: false, reason: "Enter a partner username (at least 2 characters)." };
  const cleanPermissions = [...new Set((Array.isArray(permissions) ? permissions : []).filter((p) => ALLOWED.has(p)))];
  if (!cleanPermissions.includes("shop:view")) cleanPermissions.unshift("shop:view");

  const staff = readStaff();
  if (staff.some((entry) => entry.username.toLowerCase() === name.toLowerCase())) {
    return { ok: false, reason: "That partner already exists." };
  }
  const token = crypto.randomBytes(32).toString("hex");
  const entry = {
    id: crypto.randomUUID(),
    username: name,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    permissions: cleanPermissions,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  staff.push(entry);
  saveStaff(staff);
  return { ok: true, partner: { id: entry.id, username: entry.username, permissions: entry.permissions }, token };
}

function updatePartner(id, permissions) {
  const staff = readStaff();
  const entry = staff.find((item) => item.id === id);
  if (!entry) return { ok: false, reason: "Partner not found." };
  const cleanPermissions = [...new Set((Array.isArray(permissions) ? permissions : []).filter((p) => ALLOWED.has(p)))];
  if (!cleanPermissions.includes("shop:view")) cleanPermissions.unshift("shop:view");
  entry.permissions = cleanPermissions;
  saveStaff(staff);
  return { ok: true, partner: { id: entry.id, username: entry.username, permissions: entry.permissions } };
}

function removePartner(id) {
  const staff = readStaff();
  const next = staff.filter((entry) => entry.id !== id);
  if (next.length === staff.length) return { ok: false, reason: "Partner not found." };
  saveStaff(next);
  return { ok: true };
}

function listPartners() {
  return readStaff().map(({ id, username, permissions, enabled, createdAt }) => ({
    id, username, permissions: permissions || [], enabled: enabled !== false, createdAt,
  }));
}

module.exports = { authenticate, createPartner, updatePartner, removePartner, listPartners, ensureOwnerToken };
