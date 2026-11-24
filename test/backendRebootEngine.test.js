const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogil-backend-engine-"));
const bundleDir = path.join(tempDir, "dlls");
fs.mkdirSync(bundleDir, { recursive: true });
process.env.VELOCITY_GAMESERVER_BUNDLE_DIR = bundleDir;

const { resolveDllPath } = require("../structs/gameserver");

test.after(() => {
  delete process.env.VELOCITY_GAMESERVER_BUNDLE_DIR;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("backend uses the Reboot engine build for pre-S20 Fortnite versions", () => {
  const dll = path.join(bundleDir, "reboot.dll");
  fs.writeFileSync(dll, "test");
  assert.equal(resolveDllPath({}, 14.30), dll);
});

test("backend uses the Reboot S20 engine build for S20+ versions", () => {
  const dll = path.join(bundleDir, "rebootS20.dll");
  fs.writeFileSync(dll, "test");
  assert.equal(resolveDllPath({}, 20.40), dll);
});

test("a custom gameserver DLL path overrides the bundled default", () => {
  const custom = path.join(tempDir, "custom.dll");
  fs.writeFileSync(custom, "test");
  assert.equal(resolveDllPath({ dllPath: custom }, 14.30), custom);
});
