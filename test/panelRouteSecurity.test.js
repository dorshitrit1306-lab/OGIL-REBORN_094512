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
