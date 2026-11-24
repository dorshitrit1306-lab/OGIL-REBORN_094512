/**
 * Schedule a daily task at the shop's Israel-local 19:30 boundary.
 * The scheduler runs once on startup too, so a server restart after the
 * rotation applies any draft that became due while the process was offline.
 *
 * Timers are injectable to keep the behavior deterministic in tests.
 */
function startDailyRotationScheduler({
  manager,
  onRotation = () => {},
  now = () => new Date(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (!manager || typeof manager.nextRotation !== "function" ||
      typeof manager.rotationWindow !== "function" ||
      typeof manager.activateIfDue !== "function") {
    throw new TypeError("A shop manager with rotation methods is required.");
  }

  let timer = null;
  let stopped = false;

  function activateCurrentWindow() {
    const window = manager.rotationWindow(now());
    const state = manager.activateIfDue(window.key);
    onRotation(state, window);
    return window;
  }

  function armNext() {
    if (stopped) return;
    const current = now();
    const next = manager.nextRotation(current);
    const delay = Math.max(1, next.getTime() - current.getTime());
    timer = setTimer(() => {
      timer = null;
      if (stopped) return;
      try {
        activateCurrentWindow();
      } finally {
        armNext();
      }
    }, delay);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  activateCurrentWindow();
  armNext();

  return {
    stop() {
      stopped = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}

module.exports = { startDailyRotationScheduler };
