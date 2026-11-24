const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { syncPersistentBackendConfig } = require("../launcher/persistent-backend-config");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogil-config-persist-"));
const bundled = path.join(tempDir, "resources", "backend", "config", "config.json");
const persistent = path.join(tempDir, "user-data", "config", "config.json");

test.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test("first launch seeds persistent config from packaged defaults", () => {
  fs.mkdirSync(path.dirname(bundled), { recursive: true });
  fs.writeFileSync(bundled, JSON.stringify({ owner: { username: "Owner" }, port: 3551 }));
  assert.equal(syncPersistentBackendConfig(bundled, persistent), persistent);
  assert.deepEqual(JSON.parse(fs.readFileSync(persistent, "utf8")), { owner: { username: "Owner" }, port: 3551 });
});

test("later launches restore persistent settings over packaged defaults", () => {
  fs.writeFileSync(persistent, JSON.stringify({ owner: { username: "Dor" }, panelToken: "kept-private" }));
  fs.writeFileSync(bundled, JSON.stringify({ owner: { username: "Owner" } }));
  syncPersistentBackendConfig(bundled, persistent);
  assert.deepEqual(JSON.parse(fs.readFileSync(bundled, "utf8")), { owner: { username: "Dor" }, panelToken: "kept-private" });
});

test("missing bundled config fails clearly", () => {
  assert.throws(() => syncPersistentBackendConfig(path.join(tempDir, "missing.json"), persistent), /not found/);
});
