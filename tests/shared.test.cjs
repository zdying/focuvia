const { test } = require("node:test");
const assert = require("node:assert/strict");
const { browser, load } = require("./helpers.cjs");

test("settings accept known values and constrain the daily limit", t => {
  const window = browser(t);
  load(window, "shared.js");
  const { readSettings } = window.Focuvia;
  assert.equal(readSettings({ dailyLimitMinutes: 0 }).dailyLimitMinutes, 0);
  assert.equal(readSettings({ dailyLimitMinutes: 900 }).dailyLimitMinutes, 600);
  assert.equal(readSettings({ dailyLimitMinutes: "bad" }).dailyLimitMinutes, 30);
  assert.equal(readSettings({ hideComments: "false" }).hideComments, true);
  assert.equal("removedOption" in readSettings({ removedOption: true }), false);
});

test("dates use the local calendar", t => {
  const window = browser(t);
  load(window, "shared.js");
  const date = new window.Date(2026, 10, 18, 0, 30);
  assert.equal(window.Focuvia.localDay(date), "2026-11-18");
});

test("watch duration follows elapsed playback, excluding stalls, seeks and background time", t => {
  const window = browser(t);
  load(window, "shared.js");
  const video = {};
  const previous = { video, active: true, now: 0, time: 0, rate: 2 };
  const current = { video, active: true, now: 1500, time: 3, rate: 2 };
  const duration = window.Focuvia.watchedBetween;
  assert.equal(duration(previous, current), 1.5);
  assert.equal(duration(previous, { ...current, time: 0 }), 0);
  assert.equal(duration(previous, { ...current, active: false }), 0);
  assert.equal(duration(previous, { ...current, video: {} }), 0);
  assert.equal(duration(previous, { ...current, time: -10 }), 0);
  assert.equal(duration(previous, { ...current, now: 60000, time: 120 }), 5);
});
