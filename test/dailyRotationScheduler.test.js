const test = require("node:test");
const assert = require("node:assert/strict");
const { startDailyRotationScheduler } = require("../utils/dailyRotationScheduler");

function fakeManager() {
  const activations = [];
  return {
    activations,
    nextRotation(from) {
      const next = new Date(from);
      next.setTime(next.getTime() + 30 * 60 * 1000);
      return next;
    },
    rotationWindow(date) {
      return { key: date.toISOString().slice(0, 10) + "-1930" };
    },
    activateIfDue(key) {
      activations.push(key);
      return { key };
    },
  };
}

test("daily scheduler activates the current window on startup and schedules the next rotation", () => {
  const manager = fakeManager();
  let current = new Date("2026-11-24T17:00:00.000Z");
  const timers = [];
  const delays = [];
  const scheduler = startDailyRotationScheduler({
    manager,
    now: () => current,
    setTimer(callback, delay) {
      const timer = { callback, delay, unref() {} };
      timers.push(timer);
      delays.push(delay);
      return timer;
    },
    clearTimer(timer) {
      timer.cleared = true;
    },
  });

  assert.deepEqual(manager.activations, ["2026-11-24-1930"]);
  assert.equal(delays[0], 30 * 60 * 1000);

  current = new Date("2026-11-24T17:30:00.000Z");
  timers[0].callback();
  assert.deepEqual(manager.activations, ["2026-11-24-1930", "2026-11-24-1930"]);
  assert.equal(delays[1], 30 * 60 * 1000);

  scheduler.stop();
  assert.equal(timers[1].cleared, true);
});

test("daily scheduler applies the latest due shop window after a late process wake-up", () => {
  const manager = fakeManager();
  let current = new Date("2026-11-24T17:00:00.000Z");
  const timers = [];
  startDailyRotationScheduler({
    manager,
    now: () => current,
    setTimer(callback, delay) {
      const timer = { callback, delay, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearTimer() {},
  });

  current = new Date("2026-11-25T18:00:00.000Z");
  timers[0].callback();
  assert.equal(manager.activations.at(-1), "2026-11-25-1930");
});

test("scheduler rejects invalid managers", () => {
  assert.throws(() => startDailyRotationScheduler({ manager: {} }), /shop manager/);
});
