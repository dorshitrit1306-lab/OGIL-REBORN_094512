const API = "/ogfn-panel/api";

async function api(path, method = "GET", body) {
  const headers = { "Content-Type": "application/json" };
  const accessToken = sessionStorage.getItem("ogfn-panel-token");
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const result = await res.json();
  if (!res.ok && !result.reason) result.reason = `Request failed (${res.status}).`;
  return result;
}

function toast(msg, kind = "ok") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  setTimeout(() => (el.className = "toast"), 2600);
}

function fmtUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function targetAccount() {
  return document.getElementById("ownerAccount")?.value.trim() || document.getElementById("grantAccount")?.value.trim() || "";
}

// ---- Navigation ----
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    loadView(btn.dataset.view);
  });
});

// ---- Dashboard ----
async function loadDashboard() {
  const s = await api("/status");
  const chip = document.getElementById("statusChip");
  chip.className = "status-chip " + (s.online ? "online" : "offline");
  chip.innerHTML = `<span class="dot"></span> ${s.online ? "Online" : "Offline"} · v${s.version}`;

  const cards = [
    {
      label: "Players online",
      value: s.connectedXmpp,
      accent: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="8" r="3"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>',
    },
    {
      label: "Known accounts",
      value: s.knownAccounts,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 19h16M6 4h12v15H6z"/><path d="M9 8h6M9 12h4"/></svg>',
    },
    {
      label: "Uptime",
      value: fmtUptime(s.uptimeSeconds),
      mono: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    },
    {
      label: "HTTP port",
      value: s.httpPort,
      mono: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>',
    },
    {
      label: "XMPP port",
      value: s.xmppPort,
      mono: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 6h16v12H4z"/><path d="M4 10h16M8 14h4"/></svg>',
    },
    {
      label: "Matchmaking",
      value: s.matchmaking ? "On" : "Off",
      status: s.matchmaking ? "on" : "off",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M8 12h8M12 8v8"/><circle cx="12" cy="12" r="8"/></svg>',
    },
    {
      label: "MOTD",
      value: s.motdEnabled ? "On" : "Off",
      status: s.motdEnabled ? "on" : "off",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 19h16V5H4v14z"/><path d="M8 9h8M8 13h5"/></svg>',
    },
  ];
  document.getElementById("statCards").innerHTML = cards
    .map((c) => {
      const valueClass = [
        c.accent ? "accent" : "",
        c.mono ? "mono" : "",
        c.status === "on" ? "on" : "",
        c.status === "off" ? "off" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<article class="stat">
        <div class="stat-top">
          <div class="label">${c.label}</div>
          <div class="stat-icon">${c.icon}</div>
        </div>
        <div class="value ${valueClass}">${c.value}</div>
      </article>`;
    })
    .join("");
}

// ---- Players ----
async function loadPlayers() {
  const d = await api("/players");
  const online = document.querySelector("#onlineTable tbody");
  online.innerHTML = d.online.length
    ? d.online
        .map((p) => `<tr><td>${p.displayName}</td><td>${p.accountId}</td><td>${p.resource || "-"}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="empty">No clients connected.</td></tr>`;

  const accts = document.querySelector("#accountsTable tbody");
  accts.innerHTML = d.accounts.length
    ? d.accounts
        .map(
          (a) =>
            `<tr><td>${a.accountId}</td><td>${a.itemCount}</td><td>${a.vbucks}</td><td>${a.level}</td>
             <td><button class="btn small" onclick="fillGrant('${a.accountId}')">Grant</button></td></tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No accounts yet — log in from the game first.</td></tr>`;

  updateOwnerPlayerPick(d.accounts, d.owner);
}

window.fillGrant = (id) => {
  document.getElementById("grantAccount").value = id;
  document.getElementById("ownerAccount").value = id;
  document.querySelector('.nav-item[data-view="owner"]').click();
};

function updateOwnerPlayerPick(accounts, owner) {
  const sel = document.getElementById("ownerPlayerPick");
  if (!sel) return;
  const opts = ['<option value="">Pick from known accounts…</option>'];
  if (owner?.accountId) {
    opts.push(`<option value="${owner.accountId}">${owner.username || "owner"} (configured)</option>`);
  }
  for (const a of accounts || []) {
    if (owner?.accountId && a.accountId === owner.accountId) continue;
    opts.push(`<option value="${a.accountId}">${a.accountId.slice(0, 12)}… · ${a.itemCount} items · ${a.vbucks} vb</option>`);
  }
  sel.innerHTML = opts.join("");
}

// ---- Owner Panel ----
let ownerState = { accountId: "", username: "" };
let catalogState = { offset: 0, total: 0, items: [] };

const OWNER_QUICK = [
  "AthenaCharacter:CID_028_Athena_Commando_F",
  "AthenaCharacter:CID_313_Athena_Commando_M_KpopFashion",
  "AthenaCharacter:CID_A_112_Athena_Commando_M_RebirthSoldier",
  "AthenaPickaxe:Pickaxe_ID_015_HolidayCandyCane",
  "AthenaGlider:Glider_ID_002_Medieval",
  "AthenaDance:EID_Floss",
];

async function loadOwner() {
  const owner = await api("/owner");
  ownerState = owner;
  const input = document.getElementById("ownerAccount");
  const hint = document.getElementById("ownerHint");
  if (owner.accountId && !input.value) input.value = owner.accountId;
  hint.textContent = owner.username
    ? `Owner: ${owner.username} · ${owner.accountId} · ${owner.cosmeticPoolSize} cosmetics in pool`
    : "Set owner in config/config.json";

  document.getElementById("ownerQuickPicks").innerHTML = OWNER_QUICK.map(
    (t) => `<span class="chip" data-t="${t}">${t.split(":")[1].slice(0, 22)}</span>`
  ).join("");
  document.querySelectorAll("#ownerQuickPicks .chip").forEach((c) =>
    c.addEventListener("click", () => (document.getElementById("ownerTemplate").value = c.dataset.t))
  );

  await loadCustomList();
  await loadCustomPaks();
  await searchCatalog(true);
  await loadPlayers();
}

async function ownerAction(fn, successMsg) {
  const accountId = targetAccount();
  if (!accountId) return toast("Enter an account ID first.", "err");
  const r = await fn(accountId);
  if (r.ok) toast(successMsg(r));
  else toast(r.reason || "Failed", "err");
}

function renderCatalog(append = false) {
  const grid = document.getElementById("catalogGrid");
  const meta = document.getElementById("catalogMeta");
  const more = document.getElementById("catalogMore");

  if (!append) grid.innerHTML = "";
  if (!catalogState.items.length) {
    meta.textContent = "No items found.";
    more.style.display = "none";
    return;
  }

  meta.textContent = `Showing ${catalogState.items.length} of ${catalogState.total} items · click to grant · Shift+click = Owner skin`;
  const html = catalogState.items
    .map(
      (item) => {
        const isOwner = String(item.rarity || "").toLowerCase() === "owner";
        return `<article class="catalog-item${item.custom ? " custom" : ""}${isOwner ? " owner" : ""}" data-tid="${item.templateId}" data-name="${(item.name || "").replace(/"/g, "&quot;")}" data-type="${item.type || "skin"}">
        <div class="name">${item.name || item.templateId}</div>
        <div class="meta">${item.templateId}</div>
        <span class="badge${isOwner ? " owner-badge" : ""}">${item.custom ? "custom" : item.type || "item"} · ${item.rarity || "?"}</span>
        <button class="btn tiny owner-grant-btn" type="button" data-owner-tid="${item.templateId}">OWNER</button>
      </article>`;
      }
    )
    .join("");

  if (append) grid.insertAdjacentHTML("beforeend", html);
  else grid.innerHTML = html;

  grid.querySelectorAll(".catalog-item").forEach((el) => {
    el.addEventListener("click", async (ev) => {
      if (ev.target.closest("[data-owner-tid]")) return;
      const accountId = targetAccount();
      if (!accountId) return toast("Enter an account ID first.", "err");

      if (ev.shiftKey) {
        document.getElementById("ownerSkinTemplate").value = el.dataset.tid;
        document.getElementById("ownerSkinName").value = el.dataset.name || "";
        const typeSel = document.getElementById("ownerSkinType");
        if (el.dataset.type && [...typeSel.options].some((o) => o.value === el.dataset.type)) {
          typeSel.value = el.dataset.type;
        }
        toast("Filled Owner skin form — click Create & grant");
        return;
      }

      const r = await api("/grant", "POST", { accountId, templateId: el.dataset.tid });
      r.ok ? toast(`Granted ${el.querySelector(".name").textContent}`) : toast(r.reason || "Failed", "err");
    });
  });

  grid.querySelectorAll("[data-owner-tid]").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const accountId = targetAccount();
      if (!accountId) return toast("Enter an account ID first.", "err");
      const card = btn.closest(".catalog-item");
      const r = await api("/grant-owner-skin", "POST", {
        accountId,
        templateId: btn.dataset.ownerTid,
        name: card?.dataset.name || "",
        type: card?.dataset.type || "skin",
      });
      if (r.ok) {
        toast(`OWNER skin granted${r.updated ? " (pinned)" : ""} — first in locker`);
        await loadCustomList();
      } else toast(r.reason || "Failed", "err");
    });
  });

  more.style.display = catalogState.items.length < catalogState.total ? "inline-block" : "none";
}

async function searchCatalog(reset = false) {
  if (reset) catalogState.offset = 0;
  const search = document.getElementById("catalogSearch").value.trim();
  const type = document.getElementById("catalogType").value;
  const customOnly = document.getElementById("catalogCustomOnly").checked;
  const q = new URLSearchParams({
    search,
    type,
    customOnly: customOnly ? "1" : "0",
    limit: "48",
    offset: String(catalogState.offset),
  });
  const r = await api(`/cosmetics?${q}`);
  if (reset) catalogState.items = r.items || [];
  else catalogState.items = catalogState.items.concat(r.items || []);
  catalogState.total = r.total || 0;
  renderCatalog(!reset);
}

async function loadCustomPaks() {
  const r = await api("/custom-paks");
  const dir = document.getElementById("customPakDir");
  const list = document.getElementById("customPakFiles");
  if (dir) dir.textContent = r.pakDir || "custom-paks folder";
  const files = r.files || [];
  if (!list) return;
  if (!files.length) {
    list.innerHTML = '<p class="hint">No .pak files yet. Copy your custom skin pak into the folder above.</p>';
    return;
  }
  list.innerHTML = files
    .map(
      (f) => `<div class="custom-row">
        <div class="info">
          <div class="name">${f.name}</div>
          <div class="tid">${Math.round((f.size || 0) / 1024)} KB</div>
        </div>
      </div>`
    )
    .join("");
}

async function loadCustomList() {
  const r = await api("/cosmetics/custom");
  const list = document.getElementById("customList");
  const items = r.items || [];
  if (!items.length) {
    list.innerHTML = '<p class="hint">No custom cosmetics yet. Register one on the right.</p>';
    return;
  }
  list.innerHTML = items
    .map(
      (item) => {
        const isOwner = String(item.rarity || "").toLowerCase() === "owner";
        return `<div class="custom-row${isOwner ? " owner" : ""}">
        <div class="info">
          <div class="name">${item.name} ${isOwner ? '<span class="badge owner-badge">OWNER</span>' : ""}</div>
          <div class="tid">${item.templateId} · ${item.rarity || "?"}</div>
        </div>
        <div class="actions">
          <button class="btn small" data-owner-grant="${item.templateId}" data-name="${(item.name || "").replace(/"/g, "&quot;")}" data-type="${item.type || "skin"}">Grant OWNER</button>
          <button class="btn small" data-grant="${item.templateId}">Grant</button>
          <button class="btn small" data-remove="${item.templateId}">Remove</button>
        </div>
      </div>`;
      }
    )
    .join("");

  list.querySelectorAll("[data-owner-grant]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const accountId = targetAccount();
      if (!accountId) return toast("Enter an account ID first.", "err");
      const r = await api("/grant-owner-skin", "POST", {
        accountId,
        templateId: btn.dataset.ownerGrant,
        name: btn.dataset.name || "",
        type: btn.dataset.type || "skin",
      });
      r.ok ? toast("OWNER skin in locker (first / favorited)") : toast(r.reason || "Failed", "err");
    })
  );

  list.querySelectorAll("[data-grant]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const accountId = targetAccount();
      if (!accountId) return toast("Enter an account ID first.", "err");
      const r = await api("/grant", "POST", { accountId, templateId: btn.dataset.grant });
      r.ok ? toast("Custom item granted!") : toast(r.reason || "Failed", "err");
    })
  );

  list.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const r = await api("/cosmetics/custom/remove", "POST", { templateId: btn.dataset.remove });
      if (r.ok) {
        toast("Removed custom cosmetic");
        loadCustomList();
        searchCatalog(true);
      } else toast(r.reason || "Failed", "err");
    })
  );
}

function initOwnerPanel() {
  document.getElementById("ownerUseMe").addEventListener("click", () => {
    if (ownerState.accountId) {
      document.getElementById("ownerAccount").value = ownerState.accountId;
      toast(`Using owner account (${ownerState.username || "owner"})`);
    } else toast("No owner configured.", "err");
  });

  document.getElementById("ownerRefreshPlayers").addEventListener("click", () => loadPlayers());

  document.getElementById("ownerPlayerPick").addEventListener("change", (e) => {
    if (e.target.value) document.getElementById("ownerAccount").value = e.target.value;
  });

  document.getElementById("ownerGrantAll").addEventListener("click", () =>
    ownerAction(
      (accountId) => api("/grant-all", "POST", { accountId }),
      (r) => `Granted ${r.granted || 0} items (${r.skipped || 0} already owned)`
    )
  );

  document.getElementById("ownerSkinGrantBtn")?.addEventListener("click", async () => {
    const accountId = targetAccount();
    if (!accountId) return toast("Enter an account ID first.", "err");
    const templateId = document.getElementById("ownerSkinTemplate").value.trim();
    if (!templateId) return toast("Enter a template ID (or Shift+click a catalog item).", "err");
    const r = await api("/grant-owner-skin", "POST", {
      accountId,
      templateId,
      name: document.getElementById("ownerSkinName").value.trim(),
      type: document.getElementById("ownerSkinType").value,
    });
    if (r.ok) {
      toast(`OWNER skin ready — first in locker${r.live ? " (live)" : ""}`);
      document.getElementById("ownerSkinName").value = "";
      document.getElementById("ownerSkinTemplate").value = "";
      await loadCustomList();
      await searchCatalog(true);
    } else toast(r.reason || "Failed", "err");
  });

  document.getElementById("ownerMaxVbucks").addEventListener("click", () =>
    ownerAction(
      (accountId) => api("/vbucks", "POST", { accountId, amount: 999999 }),
      (r) => `V-Bucks set to ${r.vbucks?.toLocaleString()}`
    )
  );

  document.getElementById("ownerLevel100").addEventListener("click", () =>
    ownerAction(
      (accountId) => api("/level", "POST", { accountId, level: 100 }),
      (r) => `Level set to ${r.level}`
    )
  );

  document.getElementById("ownerBp100").addEventListener("click", () =>
    ownerAction(
      (accountId) => api("/battlepass", "POST", { accountId, tier: 100 }),
      (r) => `Battle pass tier set to ${r.bookLevel}`
    )
  );

  document.querySelectorAll(".vb-btn").forEach((btn) =>
    btn.addEventListener("click", () =>
      ownerAction(
        (accountId) => api("/vbucks/add", "POST", { accountId, amount: parseInt(btn.dataset.amt, 10) }),
        (r) => `V-Bucks: ${r.vbucks?.toLocaleString()} (+${r.added?.toLocaleString()})`
      )
    )
  );

  document.getElementById("ownerVbucksSetBtn").addEventListener("click", () => {
    const amount = document.getElementById("ownerVbucksSet").value;
    ownerAction(
      (accountId) => api("/vbucks", "POST", { accountId, amount }),
      (r) => `V-Bucks set to ${r.vbucks?.toLocaleString()}`
    );
  });

  document.getElementById("ownerGrantOne").addEventListener("click", () => {
    const templateId = document.getElementById("ownerTemplate").value.trim();
    if (!templateId) return toast("Enter a template ID.", "err");
    ownerAction(
      (accountId) => api("/grant", "POST", { accountId, templateId }),
      () => "Item granted!"
    );
  });

  document.getElementById("customAddBtn").addEventListener("click", async () => {
    const body = {
      name: document.getElementById("customName").value.trim(),
      templateId: document.getElementById("customTemplate").value.trim(),
      type: document.getElementById("customType").value,
      rarity: document.getElementById("customRarity").value,
      note: document.getElementById("customNote").value.trim(),
      pakFile: document.getElementById("customPakFile").value.trim(),
      grantTemplateId: document.getElementById("customGrantTemplate").value.trim(),
    };
    const r = await api("/cosmetics/custom", "POST", body);
    if (!r.ok) return toast(r.reason || "Failed", "err");

    toast("Custom cosmetic registered!");
    document.getElementById("customName").value = "";
    document.getElementById("customTemplate").value = "";
    document.getElementById("customNote").value = "";
    document.getElementById("customPakFile").value = "";
    document.getElementById("customGrantTemplate").value = "";

    if (String(body.rarity).toLowerCase() === "owner") {
      const accountId = targetAccount();
      if (accountId) {
        const g = await api("/grant-owner-skin", "POST", {
          accountId,
          templateId: body.templateId,
          name: body.name,
          type: body.type,
        });
        if (g.ok) toast("OWNER skin granted — first in locker");
        else toast(g.reason || "Registered but grant failed", "err");
      }
    }

    await loadCustomList();
    await searchCatalog(true);
  });

  document.getElementById("pakRegisterBtn")?.addEventListener("click", async () => {
    const r = await api("/custom-paks/register", "POST", {
      name: document.getElementById("pakName").value.trim(),
      pakFile: document.getElementById("pakFile").value.trim(),
      templateId: document.getElementById("pakTemplate").value.trim(),
    });
    if (!r.ok) return toast(r.reason || "Failed", "err");
    toast("Pak skin registered — Install paks, then Grant OWNER");
    await loadCustomList();
    await loadCustomPaks();
  });

  document.getElementById("pakInstallBtn")?.addEventListener("click", async () => {
    const r = await api("/custom-paks/install", "POST", {});
    if (!r.ok) return toast(r.reason || "Failed", "err");
    toast(`Installed ${r.installed.length} pak(s) to build — restart Fortnite`);
    await loadCustomPaks();
  });

  document.getElementById("ownerPerksBtn")?.addEventListener("click", async () => {
    const accountId = targetAccount();
    if (!accountId) return toast("Enter an account ID first.", "err");
    const r = await api("/apply-owner-perks", "POST", { accountId });
    r.ok
      ? toast(`Owner perks applied — relog as ${r.displayName}`)
      : toast(r.reason || "Failed", "err");
  });

  document.getElementById("catalogSearchBtn").addEventListener("click", () => searchCatalog(true));
  document.getElementById("catalogSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchCatalog(true);
  });
  document.getElementById("catalogMore").addEventListener("click", () => {
    catalogState.offset += 48;
    searchCatalog(false);
  });
}

// ---- Cosmetics (legacy) ----
const QUICK = [
  "AthenaCharacter:CID_028_Athena_Commando_F",
  "AthenaCharacter:CID_017_Athena_Commando_M",
  "AthenaCharacter:CID_313_Athena_Commando_M_KpopFashion",
  "AthenaPickaxe:Pickaxe_ID_015_HolidayCandyCane",
  "AthenaGlider:Glider_ID_002_Medieval",
  "AthenaDance:EID_Floss",
];
function initCosmetics() {
  document.getElementById("quickPicks").innerHTML = QUICK.map(
    (t) => `<span class="chip" data-t="${t}">${t.split(":")[1]}</span>`
  ).join("");
  document.querySelectorAll("#quickPicks .chip").forEach((c) =>
    c.addEventListener("click", () => (document.getElementById("grantTemplate").value = c.dataset.t))
  );
}
document.getElementById("grantBtn").addEventListener("click", async () => {
  const accountId = document.getElementById("grantAccount").value.trim();
  const templateId = document.getElementById("grantTemplate").value.trim();
  const r = await api("/grant", "POST", { accountId, templateId });
  r.ok ? toast("Item granted!") : toast(r.reason || "Failed", "err");
});
document.getElementById("vbucksBtn").addEventListener("click", async () => {
  const accountId = document.getElementById("grantAccount").value.trim();
  const amount = document.getElementById("vbucksAmount").value;
  const r = await api("/vbucks", "POST", { accountId, amount });
  r.ok ? toast(`V-Bucks set to ${r.vbucks}`) : toast(r.reason || "Failed", "err");
});

// ---- MOTD ----
async function loadMotd() {
  const m = await api("/motd");
  document.getElementById("motdEnabled").checked = m.enabled;
  document.getElementById("motdText").value = m.text;
}
document.getElementById("motdSave").addEventListener("click", async () => {
  const enabled = document.getElementById("motdEnabled").checked;
  const text = document.getElementById("motdText").value;
  await api("/motd", "POST", { enabled, text });
  toast("MOTD saved!");
});

// ---- Hotfixes ----
let hotfixCache = [];
async function loadHotfixes() {
  hotfixCache = await api("/hotfixes");
  const sel = document.getElementById("hotfixSelect");
  sel.innerHTML = hotfixCache.map((f) => `<option value="${f.name}">${f.name}</option>`).join("");
  if (hotfixCache.length) showHotfix(hotfixCache[0].name);
}
function showHotfix(name) {
  const f = hotfixCache.find((x) => x.name === name);
  document.getElementById("hotfixContent").value = f ? f.content : "";
}
document.getElementById("hotfixSelect").addEventListener("change", (e) => showHotfix(e.target.value));
document.getElementById("hotfixSave").addEventListener("click", async () => {
  const newName = document.getElementById("hotfixNewName").value.trim();
  const name = newName || document.getElementById("hotfixSelect").value;
  const content = document.getElementById("hotfixContent").value;
  const r = await api("/hotfixes", "POST", { name, content });
  if (r.ok) {
    toast("Hotfix saved!");
    document.getElementById("hotfixNewName").value = "";
    loadHotfixes();
  } else toast(r.reason || "Failed", "err");
});

// ---- Shop editor ----
const shopState = { featured: [], daily: [], items: [], nextRotation: null, permissions: [], role: "viewer" };
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}
function renderShopTimer() {
  const el = document.getElementById("shopCountdown");
  if (!el || !shopState.nextRotation) return;
  const left = Math.max(0, Math.floor((new Date(shopState.nextRotation).getTime() - Date.now()) / 1000));
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60), s = left % 60;
  el.textContent = `${d ? d + "d " : ""}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
async function loadShopSettings() {
  const r = await api("/shop/settings");
  if (!r.ok) { toast(r.reason || "Could not load shop settings", "err"); return; }
  shopState.featured = [...(r.settings?.draft?.featured || [])];
  shopState.daily = [...(r.settings?.draft?.daily || [])];
  shopState.nextRotation = r.nextRotation;
  shopState.permissions = r.permissions || [];
  shopState.role = r.role || "viewer";
  document.getElementById("shopScheduleInfo").textContent =
    `Role: ${shopState.role} · Draft is scheduled for 19:30 Israel time.`;
  document.getElementById("shopSaveDraft").hidden = !shopState.permissions.includes("shop:edit") && shopState.role !== "owner";
  document.getElementById("shopPublishNow").hidden = !shopState.permissions.includes("shop:publish") && shopState.role !== "owner";
  document.getElementById("shopPartnerCreate").disabled = shopState.role !== "owner";
  renderShopSelection(); renderShopTimer();
}
function renderShopSelection() {
  for (const section of ["featured", "daily"]) {
    const target = document.getElementById(section === "featured" ? "shopFeaturedList" : "shopDailyList");
    const ids = shopState[section];
    target.innerHTML = ids.length ? ids.map((id) => {
      const item = shopState.items.find((entry) => entry.templateId === id);
      return `<div class="shop-selected-item"><div><strong>${escapeHtml(item?.name || id)}</strong><small>${escapeHtml(id)}</small></div><button class="btn tiny" data-shop-remove="${escapeHtml(id)}" data-section="${section}">Remove</button></div>`;
    }).join("") : '<p class="hint">No items selected yet.</p>';
    target.querySelectorAll("[data-shop-remove]").forEach((button) => button.addEventListener("click", () => {
      shopState[section] = shopState[section].filter((id) => id !== button.dataset.shopRemove);
      renderShopSelection();
    }));
  }
}
function renderShopCatalog(items) {
  const target = document.getElementById("shopCatalog");
  shopState.items = items || [];
  if (!shopState.items.length) { target.innerHTML = '<p class="hint">No cosmetics found.</p>'; renderShopSelection(); return; }
  target.innerHTML = shopState.items.map((item) => `<div class="shop-catalog-item">
    <div><strong>${escapeHtml(item.name || item.templateId)}</strong><small>${escapeHtml(item.templateId)} · ${escapeHtml(item.type || "item")}</small></div>
    <div class="shop-item-actions"><button class="btn tiny" data-add="featured" data-id="${escapeHtml(item.templateId)}">+ Featured</button><button class="btn tiny" data-add="daily" data-id="${escapeHtml(item.templateId)}">+ Daily</button></div>
  </div>`).join("");
  target.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.id, section = button.dataset.add;
    const other = section === "featured" ? "daily" : "featured";
    if (shopState[section].includes(id) || shopState[other].includes(id)) return toast("Item already selected.", "err");
    if (shopState[section].length >= 24) return toast("Maximum 24 items per section.", "err");
    shopState[section].push(id); renderShopSelection();
  }));
  renderShopSelection();
}
async function searchShopCatalog() {
  const q = new URLSearchParams({ search: document.getElementById("shopSearch").value.trim(), type: document.getElementById("shopType").value, limit: "200", offset: "0" });
  const r = await api(`/cosmetics?${q}`);
  if (!r.items) return toast(r.reason || "Catalog search failed", "err");
  renderShopCatalog(r.items);
}
async function saveShopDraft() {
  const r = await api("/shop/settings", "POST", { featured: shopState.featured, daily: shopState.daily });
  if (!r.ok) return toast(r.reason || "Could not save shop", "err");
  shopState.nextRotation = r.nextRotation; renderShopTimer(); toast("Draft saved for 19:30 Israel time.");
}
async function publishShopNow() {
  if (!confirm("Publish this shop immediately for every player?")) return;
  const r = await api("/shop/publish", "POST", {});
  if (!r.ok) return toast(r.reason || "Publish failed", "err");
  toast(`Shop published: ${r.featured} featured, ${r.daily} daily.`);
  loadShopSettings();
}
async function loadShopPartners() {
  const list = document.getElementById("shopPartners");
  const r = await api("/shop/staff");
  if (!r.ok) { list.innerHTML = '<p class="hint">Partner management is Owner-only.</p>'; return; }
  const partners = r.partners || [];
  if (!partners.length) { list.innerHTML = '<p class="hint">No partners added yet.</p>'; return; }
  list.innerHTML = partners.map((p) => `<div class="shop-selected-item" data-partner="${escapeHtml(p.id)}">
    <div><strong>${escapeHtml(p.username)}</strong><div class="partner-permissions">
      <label><input type="checkbox" data-perm="shop:edit" ${p.permissions.includes("shop:edit") ? "checked" : ""}/> Edit</label>
      <label><input type="checkbox" data-perm="shop:publish" ${p.permissions.includes("shop:publish") ? "checked" : ""}/> Publish now</label>
    </div></div><div class="shop-item-actions"><button class="btn tiny" data-save-partner>Save</button><button class="btn tiny danger" data-remove-partner>Remove</button></div>
  </div>`).join("");
  list.querySelectorAll("[data-save-partner]").forEach((button) => button.addEventListener("click", async () => {
    const row = button.closest("[data-partner]");
    const permissions = ["shop:view", ...[...row.querySelectorAll("[data-perm]:checked")].map((el) => el.dataset.perm)];
    const result = await api(`/shop/staff/${encodeURIComponent(row.dataset.partner)}`, "PATCH", { permissions });
    result.ok ? toast("Partner permissions saved.") : toast(result.reason || "Failed", "err");
  }));
  list.querySelectorAll("[data-remove-partner]").forEach((button) => button.addEventListener("click", async () => {
    const row = button.closest("[data-partner]");
    if (!confirm("Remove this partner's shop access?")) return;
    const result = await api(`/shop/staff/${encodeURIComponent(row.dataset.partner)}`, "DELETE");
    if (result.ok) { toast("Partner removed."); loadShopPartners(); } else toast(result.reason || "Failed", "err");
  }));
}
function initShopPanel() {
  document.getElementById("shopSearchBtn").addEventListener("click", searchShopCatalog);
  document.getElementById("shopSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") searchShopCatalog(); });
  document.getElementById("shopReload").addEventListener("click", () => { loadShopSettings(); loadShopPartners(); });
  document.getElementById("shopSaveDraft").addEventListener("click", saveShopDraft);
  document.getElementById("shopPublishNow").addEventListener("click", publishShopNow);
  document.getElementById("shopPartnerCreate").addEventListener("click", async () => {
    const username = document.getElementById("shopPartnerName").value.trim();
    const permissions = ["shop:view"];
    if (document.getElementById("partnerCanEdit").checked) permissions.push("shop:edit");
    if (document.getElementById("partnerCanPublish").checked) permissions.push("shop:publish");
    const r = await api("/shop/staff", "POST", { username, permissions });
    if (!r.ok) return toast(r.reason || "Could not create partner", "err");
    const output = document.getElementById("shopPartnerToken");
    output.hidden = false; output.textContent = `Partner key (shown once): ${r.token}`;
    document.getElementById("shopPartnerName").value = "";
    toast("Partner created. Copy the key and share it privately."); loadShopPartners();
  });
  document.getElementById("panelTokenSave").addEventListener("click", async () => {
    const token = document.getElementById("panelAccessToken").value.trim();
    if (!token) return toast("Enter an access key.", "err");
    sessionStorage.setItem("ogfn-panel-token", token);
    document.getElementById("panelAccessToken").value = "";
    await loadShopSettings(); await loadShopPartners();
    toast("Access key set for this browser session.");
  });
}

// ---- Settings ----
async function loadSettings() {
  const c = await api("/config");
  document.getElementById("mmEnabled").checked = Boolean(c.bEnableMatchmaking);
  document.getElementById("publicGameAddress").value = c.gameserver?.publicIp || "";
}
document.getElementById("settingsSave").addEventListener("click", async () => {
  const bEnableMatchmaking = document.getElementById("mmEnabled").checked;
  const publicIp = document.getElementById("publicGameAddress").value.trim();
  const result = await api("/config", "POST", {
    bEnableMatchmaking,
    gameserver: { publicIp },
  });
  if (!result.ok) return toast(result.reason || "Could not save settings.", "err");
  toast("Settings saved!");
});

// ---- View loader ----
function loadView(view) {
  ({
    dashboard: loadDashboard,
    players: loadPlayers,
    owner: loadOwner,
    motd: loadMotd,
    hotfixes: loadHotfixes,
    settings: loadSettings,
    shop: () => { loadShopSettings(); loadShopPartners(); },
    cosmetics: () => {},
  }[view] || (() => {}))();
}

// Init
initOwnerPanel();
initCosmetics();
initShopPanel();
loadDashboard();
setInterval(() => {
  renderShopTimer();
  const active = document.querySelector(".nav-item.active").dataset.view;
  if (active === "dashboard") loadDashboard();
  if (active === "players") loadPlayers();
}, 5000);
