const test = require("node:test");
const assert = require("node:assert/strict");

const { tokenSessions } = require("../routes/auth");
const router = require("../routes/party");
const access = require("../structs/partyAccess");

function routeFor(path, method) {
  return router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method])?.route || null;
}

test("every Party API route requires an authenticated Bearer session", () => {
  for (const layer of router.stack) {
    if (!layer.route) continue;
    assert.equal(layer.route.stack[0]?.name, "authenticatedPartyUser", String(layer.route.path) + " must authenticate first");
  }
});

test("Party middleware rejects missing or invalid Bearer tokens", () => {
  const route = routeFor("/party/api/v1/Fortnite/user/:accountId", "get");
  const middleware = route.stack[0].handle;
  let status = 200;
  let nextCalled = false;
  middleware(
    { headers: {} },
    { status(value) { status = value; return this; }, json() {} },
    () => { nextCalled = true; }
  );
  assert.equal(status, 401);
  assert.equal(nextCalled, false);
});

test("Party middleware binds the route account to the authenticated session", () => {
  const route = routeFor("/party/api/v1/Fortnite/user/:accountId", "get");
  const ownAccount = route.stack.find((layer) => layer.name === "requireOwnAccount").handle;
  let status = 200;
  let nextCalled = false;
  ownAccount(
    { params: { accountId: "11111111111111111111111111111111" }, partyUser: { accountId: "22222222222222222222222222222222" } },
    { status(value) { status = value; return this; }, json() {} },
    () => { nextCalled = true; }
  );
  assert.equal(status, 403);
  assert.equal(nextCalled, false);
});

test("only party members can view parties unless they have an invite", () => {
  const party = {
    id: "party-1",
    members: [{ account_id: "captain", role: "CAPTAIN" }],
    invites: [{ invitee_id: "invited", status: "SENT" }],
  };
  assert.equal(access.canViewParty(party, "captain"), true);
  assert.equal(access.canViewParty(party, "invited"), true);
  assert.equal(access.canViewParty(party, "stranger"), false);
});

test("open parties allow joining but private parties require an invite", () => {
  const open = { id: "open", config: { joinability: "OPEN", max_size: 4 }, members: [], meta: {} };
  const privateParty = { id: "private", config: { joinability: "INVITE_ONLY", max_size: 4 }, members: [], meta: {} };
  assert.equal(access.canJoinParty(open, "player").ok, true);
  assert.deepEqual(access.canJoinParty(privateParty, "player"), { ok: false, reason: "invite_required" });
  privateParty.invites = [{ invitee_id: "player", status: "SENT" }];
  assert.equal(access.canJoinParty(privateParty, "player").ok, true);
});

test("a member cannot kick another member; captain can", () => {
  const party = {
    members: [
      { account_id: "captain", role: "CAPTAIN" },
      { account_id: "member-1", role: "MEMBER" },
      { account_id: "member-2", role: "MEMBER" },
    ],
  };
  assert.equal(access.canRemovePartyMember(party, "member-1", "member-2").ok, false);
  assert.equal(access.canRemovePartyMember(party, "captain", "member-2").ok, true);
  assert.equal(access.canRemovePartyMember(party, "member-1", "member-1").ok, true);
});
