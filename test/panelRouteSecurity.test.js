const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const router = require("../routes/panel-api");

function routeFor(path) {
  return router.stack.find((layer) => layer.route?.path === path)?.route || null;
}

test("administrative shop purchases require Owner authentication", () => {
  const route = routeFor("/ogfn-panel/api/buy");
  assert.ok(route, "buy route should be registered");
  assert.equal(route.methods.post, true);
  assert.equal(route.stack[0]?.name, "requirePanelAuth");
});

test("reward event reporting is protected by the private server token", () => {
  const route = routeFor("/ogfn-panel/api/game-events/reward");
  assert.ok(route, "reward event route should be registered");
  assert.equal(route.stack[0]?.name, "requireGameEventToken");
});

test("public config response never exposes Owner or game-event secrets", () => {
  const config = require("../utils/config").loadConfig();
  config.panelToken = "owner-secret-test-value";
  process.env.OGFN_GAME_EVENT_TOKEN = "game-event-secret-test-value";

  const route = routeFor("/ogfn-panel/api/config");
  assert.ok(route, "config route should be registered");
  const handler = route.stack[0]?.handle;
  assert.equal(typeof handler, "function");

  let payload = null;
  handler({}, { json(value) { payload = value; } });

  assert.equal(payload.panelToken, undefined);
  assert.equal(payload.owner, undefined);
  assert.equal(payload.OGFN_GAME_EVENT_TOKEN, undefined);
  assert.equal(typeof payload.bEnableMatchmaking, "boolean");
  assert.ok(payload.gameserver);
  delete process.env.OGFN_GAME_EVENT_TOKEN;
});
