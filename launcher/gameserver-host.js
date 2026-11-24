const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const net = require("net");
const { resolveBuildNumber, getDirectLaunchExtras, usesLibCurlHttp } = require("./launch-profiles");
const { buildAuthArgs, accountIdFromName } = require("./auth-launch");
const { getLibCurlLaunchArgs } = require("./libcurl-ssl");
const { injectDll } = require("./dll-inject");

// Keep game-server lifecycle state explicit; these values are read before
// the first host attempt and must not depend on accidental globals.
let gameserverProcess = null;
let starting = false;

function logPath() {
  return path.join(
    process.env.VELOCITY_USER_DATA || path.join(process.env.APPDATA || "", "velocity-app"),
    "Gameserver.log"
  );
}

function isPortOpen(port, host = "127.0.0.1", timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port, host, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isPortOpen(port, host)) return true;
    if (gameserverProcess && gameserverProcess.exitCode !== null) return false;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function isRunning(port = 7777, host = "127.0.0.1") {
  return isPortOpen(port, host);
}

function stopGameserver() {
  if (!gameserverProcess) return;
  try {
    gameserverProcess.kill();
  } catch {
    /* ignore */
  }
  gameserverProcess = null;
}

function fetchBackendConfig(backendBase) {
  return new Promise((resolve) => {
    const url = `${backendBase.replace(/\/$/, "")}/ogfn-panel/api/config`;
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function resolveDllPath(cfg, backendCfg, build = 0) {
  const gs = backendCfg?.gameserver || {};
  const dllName = Number(build) >= 20 ? "rebootS20.dll" : "reboot.dll";
  const appData = process.env.APPDATA || "";
  const localAppData = process.env.LOCALAPPDATA || "";
  const userData = process.env.VELOCITY_USER_DATA || path.join(appData, "velocity-app");
  const rebootInstall = process.env.REBOOT_LAUNCHER_DIR || "";

  const candidates = [
    cfg.gameserverDll,
    gs.dllPath,
    process.env.VELOCITY_GAMESERVER_DLL,
    process.resourcesPath ? path.join(process.resourcesPath, "gameserver", "dlls", dllName) : "",
    path.join(__dirname, "gameserver-bundle", "dlls", dllName),
    path.join(userData, "gameserver", dllName),
    path.join(rebootInstall, "dlls", dllName),
    path.join(appData, "Reboot Launcher", "dlls", dllName),
    path.join(localAppData, "Programs", "Reboot Launcher", "dlls", dllName),
    path.join(process.env.PROGRAMFILES || "", "Reboot Launcher", "dlls", dllName),
    // Older Reboot Launcher builds and custom configurations.
    path.join(appData, "reboot-launcher", "dlls", dllName),
    path.join(userData, "gameserver", "ProjectReboot.dll"),
    path.join(appData, "reboot-launcher", "dlls", "ProjectReboot.dll"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return cfg.gameserverDll || gs.dllPath || "";
}

async function buildServerArgs(cfg, backendBase, shippingExe) {
  const username = cfg.username || "VelocityPlayer";
  const accountId = accountIdFromName(username);
  const backendCfg = (await fetchBackendConfig(backendBase)) || {};
  const gs = backendCfg.gameserver || {};
  const build = resolveBuildNumber(cfg, shippingExe);
  const authArgs = await buildAuthArgs({ username, build, backendBase });

  const playlist = gs.playlist || "Playlist_DefaultSolo";
  const port = gs.port || 7777;

  return [
    "-server",
    "-log",
    "-nosteam",
    "-nosound",
    "-messaging",
    ...getDirectLaunchExtras(build),
    "-skippatchcheck",
    "-HTTP=WinInet",
    ...(usesLibCurlHttp(build) ? getLibCurlLaunchArgs() : []),
    ...authArgs,
    "-epicapp=Fortnite",
    "-epicenv=Prod",
    "-epiclocale=en-US",
    `-epicusername=${username}`,
    `-epicuserid=${accountId}`,
    `-PORT=${port}`,
    `-Playlist=${playlist}`,
  ];
}

async function ensureGameserver({ cfg, backendBase, shippingExe, waitForReady = true }) {
  if (cfg.serverMode === "join") return { ok: true, skipped: true };
  if (cfg.autoHostGameserver === false) return { ok: true, skipped: true };
  if (starting) return { ok: true, starting: true };

  const build = resolveBuildNumber(cfg, shippingExe);
  if (build >= 23) return { ok: true, skipped: true, reason: "Gameserver auto-host skipped for Chapter 4+ builds." };

  const backendCfg = (await fetchBackendConfig(backendBase)) || {};
  if (!backendCfg.bEnableMatchmaking) return { ok: true, skipped: true };
  if (backendCfg.gameserver?.autoStart === false) return { ok: true, skipped: true };
  if (!shippingExe || !fs.existsSync(shippingExe)) {
    return { ok: false, reason: "Game executable not found for gameserver host." };
  }

  const port = Number(backendCfg.gameserver?.port || 7777);
  const host = backendCfg.gameserver?.ip || "127.0.0.1";
  if (await isPortOpen(port, host)) return { ok: true, alreadyRunning: true };

  const dllPath = resolveDllPath(cfg, backendCfg, build);
  const needsDll = build < 23;
  if (needsDll && (!dllPath || !fs.existsSync(dllPath))) {
    return {
      ok: false,
      needsDll: true,
      reason:
        "This pre-Chapter 4 build needs the matching Project Reboot gameserver DLL. Install the Reboot engine or set gameserverDll in OGIL settings.",
    };
  }

  starting = true;
  stopGameserver();

  const win64 = path.dirname(shippingExe);
  const args = await buildServerArgs(cfg, backendBase, shippingExe);
  const outLog = logPath();

  try {
    fs.mkdirSync(path.dirname(outLog), { recursive: true });
    const logFd = fs.openSync(outLog, "a");
    fs.writeSync(
      logFd,
      `\n[${new Date().toISOString()}] Launcher gameserver build=${build} port=${port}\n${args.join(" ")}\n`
    );

    gameserverProcess = spawn(shippingExe, args, {
      cwd: win64,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
      shell: false,
    });
    gameserverProcess.unref();
    gameserverProcess.on("exit", () => {
      gameserverProcess = null;
      try {
        fs.closeSync(logFd);
      } catch {
        /* ignore */
      }
    });

    if (dllPath && fs.existsSync(dllPath) && gameserverProcess.pid) {
      setTimeout(async () => {
        await injectDll(gameserverProcess?.pid, dllPath);
      }, 2500);
    }

    if (!waitForReady) {
      starting = false;
      return { ok: true, started: true, pending: true };
    }

    const ready = await waitForPort(port, host, 90000);
    starting = false;
    if (ready) return { ok: true, started: true };

    return {
      ok: false,
      reason: needsDll
        ? "Gameserver did not open port 7777. Verify your Project Reboot DLL and check Gameserver.log."
        : "Gameserver did not open port 7777. Check Gameserver.log in %AppData%\\velocity-app.",
    };
  } catch (err) {
    starting = false;
    return { ok: false, reason: err.message };
  }
}

module.exports = { ensureGameserver, stopGameserver, isRunning, resolveDllPath };
