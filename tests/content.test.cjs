const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { browser, createChrome, load, settle } = require("./helpers.cjs");

test("navigation and settings update the page, and pagehide removes subscriptions", async t => {
  const { chrome } = createChrome({ sync: { showDislikes: false } });
  const window = browser(t, { chrome });
  load(window, "shared.js", "page.js", "timer.js");
  await load(window, "content.js");
  await settle();
  assert.equal(window.document.documentElement.classList.contains("focuvia-watch"), true);
  await chrome.storage.sync.set({ hideComments: false });
  assert.equal(window.document.documentElement.classList.contains("focuvia-hide-comments"), false);
  window.history.pushState({}, "", "/results?search_query=test");
  window.document.dispatchEvent(new window.Event("yt-navigate-finish"));
  assert.equal(window.document.documentElement.classList.contains("focuvia-watch"), false);
  window.dispatchEvent(new window.PageTransitionEvent("pagehide", { persisted: true }));
  assert.ok(chrome.storage.onChanged.listeners.size > 0);
  window.dispatchEvent(new window.PageTransitionEvent("pagehide"));
  assert.equal(chrome.storage.onChanged.listeners.size, 0);
});

test("extension entry points exist and all scripts parse", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  const scripts = [...manifest.content_scripts[0].js, manifest.background.service_worker, "popup.js"];
  for (const file of scripts) new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
  const html = fs.readFileSync("popup.html", "utf8");
  for (const file of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1])) {
    assert.equal(fs.existsSync(file), true, file);
  }
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://www.youtube.com/*", "https://returnyoutubedislikeapi.com/*"]);
});
