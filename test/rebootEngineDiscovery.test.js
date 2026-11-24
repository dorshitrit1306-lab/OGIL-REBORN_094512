const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogil-reboot-engine-"));
process.env.VELOCITY_USER_DATA = tempDir;
const { resolveDllPath } = require("../launcher/gameserver-host");

test.after(() => {
  delete process.env.VELOCITY_USER_DATA;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("Chapter 2 build discovers the below-S20 Reboot server DLL", () => {
  const dir = path.join(tempDir, "gameserver");
  fs.mkdirSync(dir, { recursive: true });
  const dll = path.join(dir, "reboot.dll");
  fs.writeFileSync(dll, "test");
  assert.equal(resolveDllPath({}, {}, 14.30), dll);
});

test("Chapter 3 S20+ build discovers the matching S20 Reboot server DLL", () => {
  const dir = path.join(tempDir, "gameserver");
  fs.mkdirSync(dir, { recursive: true });
  const dll = path.join(dir, "rebootS20.dll");
  fs.writeFileSync(dll, "test");
  assert.equal(resolveDllPath({}, {}, 20.40), dll);
});

test("an explicitly configured server DLL takes priority", () => {
  const custom = path.join(tempDir, "custom-engine.dll");
  fs.writeFileSync(custom, "test");
  assert.equal(resolveDllPath({ gameserverDll: custom }, {}, 14.30), custom);
});
