const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogfn-profile-test-"));
process.env.VELOCITY_PROFILE_DIR = tempDir;
const { ensureAccountProfiles, getProfile } = require("../structs/profiles");

test.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test("new account profiles start with exactly 2,000 V-Bucks", () => {
  const accountId = "abcdef0123456789abcdef0123456789";
  ensureAccountProfiles(accountId);
  const core = getProfile(accountId, "common_core");
  assert.equal(core.items.Currency.quantity, 2000);
});
