const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogil-owner-panel-"));
process.env.VELOCITY_CONFIG_FILE = path.join(tempDir, "config", "config.json");
process.env.VELOCITY_DATA_DIR = path.join(tempDir, "data");
delete process.env.OGFN_PANEL_TOKEN;

test.after(() => {
  delete process.env.VELOCITY_CONFIG_FILE;
  delete process.env.VELOCITY_DATA_DIR;
  delete process.env.OGFN_PANEL_TOKEN;
  for (const modulePath of [
    "../utils/config",
    "../structs/shopStaff",
  ]) {
    try { delete require.cache[require.resolve(modulePath)]; } catch {}
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("first backend start creates a private Owner key and enables Owner authentication", () => {
  const configModule = require.resolve("../utils/config");
  const staffModule = require.resolve("../structs/shopStaff");
  delete require.cache[configModule];
  delete require.cache[staffModule];

  const staff = require("../structs/shopStaff");
  const result = staff.ensureOwnerToken();
  assert.equal(result.configured, true);
  assert.equal(result.generated, true);
  assert.equal(fs.existsSync(result.keyFilePath), true);

  const config = JSON.parse(fs.readFileSync(process.env.VELOCITY_CONFIG_FILE, "utf8"));
  assert.equal(typeof config.panelToken, "string");
  assert.equal(config.panelToken.length, 64);

  const keyFile = fs.readFileSync(result.keyFilePath, "utf8");
  assert.ok(keyFile.includes(config.panelToken));
  assert.equal(staff.authenticate(config.panelToken).role, "owner");
});

test("a later backend start reuses the same Owner key", () => {
  const staff = require("../structs/shopStaff");
  const first = staff.ensureOwnerToken();
  const configBefore = JSON.parse(fs.readFileSync(process.env.VELOCITY_CONFIG_FILE, "utf8"));
  const second = staff.ensureOwnerToken();
  const configAfter = JSON.parse(fs.readFileSync(process.env.VELOCITY_CONFIG_FILE, "utf8"));

  assert.equal(second.generated, false);
  assert.equal(configAfter.panelToken, configBefore.panelToken);
  assert.equal(second.keyFilePath, first.keyFilePath);
});

test("an explicitly configured environment Owner key is not copied to a file", () => {
  process.env.OGFN_PANEL_TOKEN = "externally-managed-owner-key";
  const staff = require("../structs/shopStaff");
  const result = staff.ensureOwnerToken();
  assert.equal(result.generated, false);
  assert.equal(result.keyFilePath, null);
  assert.equal(staff.authenticate(process.env.OGFN_PANEL_TOKEN).role, "owner");
});
