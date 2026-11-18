const { test } = require("node:test");
const assert = require("node:assert/strict");
const { browser, createChrome, load, settle } = require("./helpers.cjs");

async function timer(t, initial = {}) {
  const session = createChrome(initial);
  const window = browser(t, { chrome: session.chrome, html: '<div id="movie_player"><video></video></div>' });
  const intervals = new Map();
  const clock = { now: 0 };
  window.setInterval = callback => { const id = Symbol(); intervals.set(id, callback); return id; };
  window.clearInterval = id => intervals.delete(id);
  Object.defineProperty(window.performance, "now", { value: () => clock.now });
  const video = window.document.querySelector("video");
  const state = { paused: false, ended: false, seeking: false, readyState: 4 };
  for (const key of Object.keys(state)) Object.defineProperty(video, key, { get: () => state[key] });
  video.pause = () => {
    if (state.paused) return;
    state.paused = true;
    video.dispatchEvent(new window.Event("pause"));
  };
  video.play = async () => {
    state.paused = false;
    video.dispatchEvent(new window.Event("play"));
  };
  load(window, "shared.js", "timer.js");
  const controller = window.Focuvia.createWatchTimer();
  controller.update(window.Focuvia.readSettings(initial.sync || {}));
  window.addEventListener("pagehide", () => controller.destroy(), { once: true });
  await settle();
  const tick = [...intervals.values()][0];
  return { ...session, window, controller, clock, video, state, intervals, tick };
}

test("timer records elapsed playback and ignores buffering and paused video", async t => {
  const session = await timer(t);
  session.clock.now = 1000;
  session.video.currentTime = 1;
  await session.tick();
  assert.equal((await session.send({ type: "watch", action: "read" })).seconds, 1);
  session.clock.now = 2000;
  await session.tick();
  assert.equal((await session.send({ type: "watch", action: "read" })).seconds, 1);
  session.state.paused = true;
  session.clock.now = 3000;
  session.video.currentTime = 2;
  await session.tick();
  assert.equal((await session.send({ type: "watch", action: "read" })).seconds, 1);
});

test("reaching the daily limit pauses playback and extending it updates persistent state", async t => {
  const date = new Date();
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const session = await timer(t, { local: { [key]: 59 }, sync: { dailyLimitMinutes: 1 } });
  session.clock.now = 1000;
  session.video.currentTime = 1;
  await session.tick();
  const overlay = session.window.document.querySelector('[data-focuvia="limit"]');
  assert.ok(overlay);
  assert.equal(overlay.open, true);
  assert.equal(session.state.paused, true);
  await session.video.play();
  assert.equal(session.state.paused, true, "a play event cannot bypass the limit");
  overlay.querySelector('[data-action="extend"]').click();
  await settle();
  assert.equal(overlay.open, false);
  assert.equal(session.state.paused, false);
  assert.equal((await session.send({ type: "watch", action: "read" })).extraSeconds, 600);
});

test("stored stop state is enforced on load and disabling the limit removes the overlay", async t => {
  const session = await timer(t);
  await session.send({ type: "watch", action: "stop" });
  const overlay = session.window.document.querySelector('[data-focuvia="limit"]');
  assert.equal(overlay.open, true);
  assert.equal(overlay.querySelector('[data-action="close"]').hidden, false);
  overlay.querySelector('[data-action="close"]').click();
  await settle();
  assert.deepEqual(session.chrome.tabs.closed, [1]);
  session.controller.update({ ...session.window.Focuvia.defaults, dailyLimitMinutes: 0 });
  assert.equal(overlay.open, false);
});

test("timer releases its interval, storage listener and DOM on destruction", async t => {
  const session = await timer(t);
  await session.send({ type: "watch", action: "stop" });
  session.controller.destroy();
  assert.equal(session.intervals.size, 0);
  assert.equal(session.chrome.storage.onChanged.listeners.size, 0);
  assert.equal(session.window.document.querySelector('[data-focuvia="limit"]'), null);
  await session.send({ type: "watch", action: "extend" });
  assert.equal(session.window.document.querySelector('[data-focuvia="limit"]'), null);
});
