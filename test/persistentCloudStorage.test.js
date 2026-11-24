const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogil-cloudstorage-"));
process.env.VELOCITY_CLOUDSTORAGE_SYSTEM_DIR = path.join(tempDir, "cloudstorage", "system");
process.env.VELOCITY_CLOUDSTORAGE_USER_DIR = path.join(tempDir, "cloudstorage", "user");

test.after(() => {
  delete process.env.VELOCITY_CLOUDSTORAGE_SYSTEM_DIR;
  delete process.env.VELOCITY_CLOUDSTORAGE_USER_DIR;
  const modulePath = require.resolve("../utils/cloudstoragePaths");
  delete require.cache[modulePath];
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("Cloud Storage paths use persistent user-data directories", () => {
  const modulePath = require.resolve("../utils/cloudstoragePaths");
  delete require.cache[modulePath];
  let paths = require(modulePath);

  const systemDir = paths.getSystemDir();
  const userDir = paths.getUserDir();
  assert.equal(systemDir, process.env.VELOCITY_CLOUDSTORAGE_SYSTEM_DIR);
  assert.equal(userDir, process.env.VELOCITY_CLOUDSTORAGE_USER_DIR);
  assert.equal(fs.existsSync(systemDir), true);
  assert.equal(fs.existsSync(userDir), true);

  const userSettings = path.join(userDir, "test-account", "ClientSettings.Sav");
  fs.mkdirSync(path.dirname(userSettings), { recursive: true });
  fs.writeFileSync(userSettings, Buffer.from("saved settings"));

  delete require.cache[modulePath];
  paths = require(modulePath);
  assert.equal(fs.readFileSync(path.join(paths.getUserDir(), "test-account", "ClientSettings.Sav"), "utf8"), "saved settings");
});
