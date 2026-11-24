const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogfn-staff-test-"));
process.env.OGFN_SHOP_STAFF_FILE = path.join(tempDir, "shop-staff.json");
process.env.OGFN_PANEL_TOKEN = "owner-test-secret";
const staff = require("../structs/shopStaff");

test.after(() => {
  delete process.env.OGFN_PANEL_TOKEN;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("only the owner can create and remove partner credentials", () => {
  assert.equal(staff.authenticate("owner-test-secret").role, "owner");
  const created = staff.createPartner("partner-one", ["shop:view", "shop:edit"]);
  assert.equal(created.ok, true);
  assert.equal(staff.authenticate(created.token).role, "partner");
  assert.deepEqual(staff.authenticate(created.token).permissions, ["shop:view", "shop:edit"]);
  assert.equal(staff.authenticate("wrong-token"), null);
  assert.equal(staff.listPartners()[0].tokenHash, undefined);
  assert.equal(staff.removePartner(created.partner.id).ok, true);
  assert.equal(staff.authenticate(created.token), null);
});

test("partner permissions can be restricted by the owner", () => {
  const created = staff.createPartner("partner-two", ["shop:view", "shop:edit", "not-valid"]);
  assert.equal(created.ok, true);
  const updated = staff.updatePartner(created.partner.id, ["shop:view"]);
  assert.deepEqual(updated.partner.permissions, ["shop:view"]);
  assert.deepEqual(staff.authenticate(created.token).permissions, ["shop:view"]);
});
