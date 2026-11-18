const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { browser, createChrome, load, settle } = require("./helpers.cjs");

async function popup(t, initial = {}) {
  const session = createChrome(initial);
  const window = browser(t, { chrome: session.chrome, html: fs.readFileSync("popup.html", "utf8") });
  load(window, "shared.js");
  await load(window, "popup.js");
  return { ...session, window, document: window.document };
}

test("zero limit is preserved and watch statistics update while the popup stays open", async t => {
  const { document, chrome, send } = await popup(t, { sync: { dailyLimitMinutes: 0 } });
  assert.equal(document.querySelector("#dailyLimitMinutes").value, "0");
  assert.equal(document.querySelector("#todayLimit").textContent, "∞");
  for (let i = 0; i < 12; i++) await send({ type: "watch", action: "record", seconds: 5 });
  assert.equal(document.querySelector("#todayMins").textContent, "1");
  await chrome.storage.sync.set({ dailyLimitMinutes: 10 });
  assert.equal(document.querySelector("#todayLimit").textContent, "10");
});

test("quick edits to different settings keep both values", async t => {
  const { document, window, data } = await popup(t);
  const comments = document.querySelector("#hideComments");
  const shorts = document.querySelector("#hideShorts");
  comments.checked = false;
  comments.dispatchEvent(new window.Event("change"));
  shorts.checked = false;
  shorts.dispatchEvent(new window.Event("change"));
  await settle();
  assert.equal(data.sync.hideComments, false);
  assert.equal(data.sync.hideShorts, false);
  assert.equal(comments.checked, false);
  assert.equal(shorts.checked, false);
  assert.equal(document.querySelector("#saved").textContent, "Saved.");
});

test("numeric settings are constrained before saving", async t => {
  const { document, window, data } = await popup(t);
  const limit = document.querySelector("#dailyLimitMinutes");
  limit.value = "900";
  limit.dispatchEvent(new window.Event("change"));
  await settle();
  assert.equal(data.sync.dailyLimitMinutes, 600);
  assert.equal(limit.value, "600");
});

test("a failed save restores the stored setting and reports the failure", async t => {
  const { document, window, chrome } = await popup(t);
  chrome.storage.sync.set = async () => { throw new Error("Storage unavailable"); };
  window.console.error = () => {};
  const comments = document.querySelector("#hideComments");
  comments.checked = false;
  comments.dispatchEvent(new window.Event("change"));
  await settle();
  assert.equal(comments.checked, true);
  assert.equal(document.querySelector("#saved").textContent, "Save failed");
});
