const test = require("node:test");
const assert = require("node:assert/strict");
const router = require("../routes/friends");

test("all Friends endpoints pass through authenticated session middleware", () => {
  const middlewareLayer = router.stack.find((layer) => !layer.route);
  assert.ok(middlewareLayer, "router-level auth middleware should exist");
  assert.equal(middlewareLayer.name, "authenticatedFriendAccount");
});

test("Friends middleware rejects requests without a valid bearer token", () => {
  const middleware = router.authenticatedFriendAccount;
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

test("Friends routes cannot act on another account identifier", () => {
  const middleware = router.requireOwnFriendAccount;
  let status = 200;
  let nextCalled = false;
  middleware(
    { params: { accountId: "11111111111111111111111111111111" }, friendUser: { accountId: "22222222222222222222222222222222" } },
    { status(value) { status = value; return this; }, json() {} },
    () => { nextCalled = true; }
  );
  assert.equal(status, 403);
  assert.equal(nextCalled, false);
});

test("a valid session is attached to the Friends request", () => {
  const { tokenSessions } = require("../routes/auth");
  const token = "friends-security-test-token";
  tokenSessions.set(token, {
    accountId: "11111111111111111111111111111111",
    displayName: "TestPlayer",
  });

  let nextCalled = false;
  let attached = null;
  router.authenticatedFriendAccount(
    { headers: { authorization: "Bearer " + token } },
    { status(code) { throw new Error("Unexpected status " + code); }, json() {} },
    function () { nextCalled = true; attached = this; }
  );
  assert.equal(nextCalled, true);
  tokenSessions.delete(token);
});

test("a valid friend session still cannot use a different account ID in the route", () => {
  let status = 200;
  let nextCalled = false;
  router.requireOwnFriendAccount(
    {
      params: { accountId: "22222222222222222222222222222222" },
      friendUser: { accountId: "11111111111111111111111111111111" },
    },
    { status(code) { status = code; return this; }, json() {} },
    () => { nextCalled = true; }
  );
  assert.equal(status, 403);
  assert.equal(nextCalled, false);
});
