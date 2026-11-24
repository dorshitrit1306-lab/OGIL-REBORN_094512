const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ogfn-arena-test-"));
process.env.OGFN_ARENA_SELECTIONS_FILE = path.join(tempDir, "selections.json");
const { tokenSessions } = require("../routes/auth");
const arenaRouter = require("../routes/ogil-arena");
const app = express();
app.use(express.json());
app.use(arenaRouter);

let server;
let baseUrl;

test.before(async () => {
  tokenSessions.set("arena-test-token", {
    accountId: "abcdef0123456789abcdef0123456789",
    username: "ArenaTester",
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  tokenSessions.delete("arena-test-token");
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("Arena exposes exactly SOLO, DUOS, and SQUADS", async () => {
  const res = await fetch(`${baseUrl}/api/ogil/arena/modes`);
  const body = await res.json();
  assert.deepEqual(body.modes.map((mode) => mode.id), ["SOLO", "DUOS", "SQUADS"]);
});

test("Arena mode selection requires a game login", async () => {
  const res = await fetch(`${baseUrl}/api/ogil/arena/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "SOLO" }),
  });
  assert.equal(res.status, 401);
});

test("authenticated players can select only the three Arena modes", async () => {
  const modes = ["SOLO", "DUOS", "SQUADS"];
  for (const mode of modes) {
    const res = await fetch(`${baseUrl}/api/ogil/arena/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer arena-test-token",
      },
      body: JSON.stringify({ mode }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.selection.mode, mode);
  }

  for (const mode of ["TILTED ZONE WARS", "1V1 BUILD FIGHT", "BOX PVP"]) {
    const res = await fetch(`${baseUrl}/api/ogil/arena/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer arena-test-token",
      },
      body: JSON.stringify({ mode }),
    });
    assert.equal(res.status, 400);
  }
});
