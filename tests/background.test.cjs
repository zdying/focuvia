const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createChrome } = require("./helpers.cjs");

const message = (action, seconds) => ({ type: "watch", action, seconds });

test("concurrent tabs keep every recorded interval", async () => {
  const { send } = createChrome();
  await Promise.all([send(message("record", 1.25)), send(message("record", 1.5)), send(message("record", 2))]);
  const day = await send(message("read"));
  assert.equal(day.seconds, 4.75);
  assert.equal(day.revision, 3);
});

test("daily allowance and stopped state survive worker restarts", async () => {
  const first = createChrome();
  await first.send(message("extend"));
  await first.send(message("stop"));
  const second = createChrome(first.data);
  const stopped = await second.send(message("read"));
  assert.equal(stopped.extraSeconds, 600);
  assert.equal(stopped.stopped, true);
  assert.equal((await second.send(message("record", 1))).seconds, 0);
  const resumed = await second.send(message("extend"));
  assert.equal(resumed.extraSeconds, 1200);
  assert.equal(resumed.stopped, false);
});

test("counting stops at the allowance and zero disables the limit", async () => {
  const session = createChrome({ sync: { dailyLimitMinutes: 1 } });
  for (let i = 0; i < 12; i++) await session.send(message("record", 5));
  assert.equal((await session.send(message("record", 2))).seconds, 60);
  await session.chrome.storage.sync.set({ dailyLimitMinutes: 0 });
  assert.equal((await session.send(message("record", 2))).seconds, 62);
});

test("a new local day starts clean and legacy totals are retained", async () => {
  const clock = { date: new Date(2026, 10, 18, 23, 59) };
  const { send } = createChrome({ local: { "2026-11-18": 123 } }, clock);
  assert.equal((await send(message("read"))).seconds, 123);
  await send(message("stop"));
  clock.date = new Date(2026, 10, 19, 0, 1);
  const day = await send(message("read"));
  assert.equal(day.date, "2026-11-19");
  assert.equal(day.seconds, 0);
  assert.equal(day.stopped, false);
});

test("an invalid interval does not prevent later writes", async () => {
  const { send } = createChrome();
  assert.match((await send(message("record", 100))).error, /Invalid/);
  assert.equal((await send(message("record", 1))).seconds, 1);
});

test("closing a tab uses the sending tab only", async () => {
  const { send, chrome } = createChrome();
  await send(message("close"), { tab: { id: 7 } });
  assert.deepEqual(chrome.tabs.closed, [7]);
  assert.match((await send(message("close"), {})).error, /No tab/);
});
