const net = require("net");

/** Accept a public IP literal or a DNS hostname; ports and URL schemes are configured elsewhere. */
function normalizePublicAddress(input) {
  if (typeof input !== "string") return { ok: false, reason: "Public server address must be text." };
  const value = input.trim();
  if (!value) return { ok: true, value: "" };
  if (net.isIP(value)) return { ok: true, value };

  if (value.length > 253 || /[\s/:?#@]/.test(value)) {
    return { ok: false, reason: "Enter only a public IP address or DNS hostname, without a port or URL." };
  }
  const hostname = value.toLowerCase().replace(/\.$/, "");
  const labels = hostname.split(".");
  const valid = labels.length >= 2 && labels.every((label) =>
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
  if (!valid) {
    return { ok: false, reason: "Enter a valid public IPv4/IPv6 address or DNS hostname." };
  }
  return { ok: true, value: hostname };
}

module.exports = { normalizePublicAddress };
