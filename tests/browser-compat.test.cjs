const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { browser, createChrome, load, settle } = require("./helpers.cjs");

test("Firefox background, content and popup work with only browser APIs and no importScripts", async t => {
  const session = createChrome({ sync: { showDislikes: false } }, undefined, "browser");
  const window = browser(t);
  window.browser = session.chrome;
  load(window, "shared.js", "page.js", "timer.js");
  await load(window, "content.js");
  await settle();
  assert.equal(window.document.documentElement.classList.contains("focuvia-hide-shorts"), true);
  await session.chrome.storage.sync.set({ hideShorts: false });
  assert.equal(window.document.documentElement.classList.contains("focuvia-hide-shorts"), false);
  await session.send({ type: "watch", action: "record", seconds: 5 });
  const popup = browser(t, { html: fs.readFileSync("popup.html", "utf8") });
  popup.browser = session.chrome;
  load(popup, "shared.js");
  await load(popup, "popup.js");
  const comments = popup.document.getElementById("hideComments");
  comments.checked = false;
  comments.dispatchEvent(new popup.Event("change"));
  await settle();
  assert.equal(session.data.sync.hideComments, false);
  assert.equal((await session.send({ type: "watch", action: "read" })).seconds, 5);
});
