const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePublicAddress } = require("../utils/networkAddress");

test("accepts IPv4 and IPv6 address literals", () => {
  assert.deepEqual(normalizePublicAddress("198.51.100.25"), { ok: true, value: "198.51.100.25" });
  assert.deepEqual(normalizePublicAddress("2001:db8::1"), { ok: true, value: "2001:db8::1" });
});

test("normalizes DNS names and allows an empty address for local play", () => {
  assert.deepEqual(normalizePublicAddress("PLAY.Example.com."), { ok: true, value: "play.example.com" });
  assert.deepEqual(normalizePublicAddress(""), { ok: true, value: "" });
});

test("rejects URLs, ports, paths, local hostnames, and invalid labels", () => {
  for (const value of ["https://play.example.com", "play.example.com:7777", "127.0.0.1/path", "localhost", "-bad.example.com", "bad..example.com"]) {
    assert.equal(normalizePublicAddress(value).ok, false, value);
  }
});
