const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { browser, load, deferred, settle } = require("./helpers.cjs");

function page(t, options) {
  const window = browser(t, options);
  load(window, "shared.js", "page.js");
  const controller = window.Focuvia.createPage();
  window.addEventListener("pagehide", () => controller.destroy(), { once: true });
  return { window, controller, settings: { ...window.Focuvia.defaults, showDislikes: false } };
}

test("page cleanup owns its classes and leaves existing inline styles alone", t => {
  const { window, controller, settings } = page(t, { html: `
    <ytd-video-renderer id="regular" style="display:none">Regular video</ytd-video-renderer>
    <yt-lockup-view-model id="short"><a href="/shorts/123">Short video</a></yt-lockup-view-model>` });
  const document = window.document;
  controller.update(settings);
  assert.equal(document.querySelector("#regular").style.display, "none");
  assert.equal(document.querySelector("#short").classList.contains("focuvia-short"), true);
  controller.update({ ...settings, hideShorts: false });
  assert.equal(document.documentElement.classList.contains("focuvia-hide-shorts"), false);
  assert.equal(document.querySelector("#regular").style.display, "none");
});

test("homepage videos remain visible with legacy settings while Shorts are filtered", t => {
  const { window, controller } = page(t, {
    url: "https://www.youtube.com/",
    html: `<style>${fs.readFileSync("content.css", "utf8")}</style>
      <ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="contents">
        <ytd-rich-item-renderer id="regular"><a href="/watch?v=regular">Regular video</a></ytd-rich-item-renderer>
        <ytd-rich-item-renderer id="short"><a href="/shorts/123">Short video</a></ytd-rich-item-renderer>
      </div></ytd-rich-grid-renderer></ytd-browse>`
  });
  const settings = window.Focuvia.readSettings({ hideHomepage: true, showDislikes: false });
  assert.equal("hideHomepage" in settings, false);
  controller.update(settings);
  const doc = window.document;
  for (const selector of ["ytd-rich-grid-renderer", "#contents", "#regular"]) {
    assert.notEqual(window.getComputedStyle(doc.querySelector(selector)).display, "none");
  }
  assert.equal(window.getComputedStyle(doc.querySelector("#short")).display, "none");
  controller.update({ ...settings, hideShorts: false });
  assert.notEqual(window.getComputedStyle(doc.querySelector("#short")).display, "none");
});

test("new Shorts cards are detected without revisiting the full document", async t => {
  const { window, controller, settings } = page(t);
  controller.update(settings);
  window.document.querySelectorAll = () => { throw new Error("Unexpected document scan"); };
  const card = window.document.createElement("yt-lockup-view-model");
  card.innerHTML = '<a href="/shorts/new">New Short</a>';
  window.document.body.append(card);
  await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  assert.equal(card.classList.contains("focuvia-short"), true);
  delete window.document.querySelectorAll;
});

test("an old dislike response cannot overwrite the current video", async t => {
  const requests = [];
  const { window, controller, settings } = page(t, {
    html: '<div id="below"></div>',
    fetch: (url, options) => {
      const response = deferred();
      requests.push({ ...response, url, signal: options.signal });
      return response.promise;
    }
  });
  settings.showDislikes = true;
  controller.update(settings);
  window.history.pushState({}, "", "/watch?v=second");
  controller.update(settings);
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve({ ok: true, json: async () => ({ likes: 20, dislikes: 2 }) });
  await settle();
  requests[0].resolve({ ok: true, json: async () => ({ likes: 100, dislikes: 10 }) });
  await settle();
  assert.match(window.document.querySelector('[data-focuvia="dislikes"]').textContent, /👍 20/);
  assert.equal(window.document.querySelectorAll('[data-focuvia="dislikes"]').length, 1);
  controller.update({ ...settings, showDislikes: false });
  assert.equal(window.document.querySelector('[data-focuvia="dislikes"]'), null);
});

test("turning dislikes off during a request prevents a late badge", async t => {
  const response = deferred();
  const { window, controller, settings } = page(t, { html: '<div id="below"></div>', fetch: () => response.promise });
  controller.update({ ...settings, showDislikes: true });
  controller.update(settings);
  response.resolve({ ok: true, json: async () => ({ dislikes: 100 }) });
  await settle();
  assert.equal(window.document.querySelector('[data-focuvia="dislikes"]'), null);
});

test("failed dislike requests are not retried by unrelated setting changes", async t => {
  let requests = 0;
  const { controller, settings } = page(t, { fetch: async () => { requests++; return { ok: false, status: 404 }; } });
  settings.showDislikes = true;
  for (let i = 0; i < 20; i++) controller.update({ ...settings, hideComments: i % 2 === 0 });
  await settle();
  assert.equal(requests, 1);
});

test("leaving the watch page removes video-specific UI and destruction restores owned classes", async t => {
  const { window, controller, settings } = page(t, { html: '<div id="below"></div>', fetch: async () => ({ ok: true, json: async () => ({ dislikes: 5 }) }) });
  controller.update({ ...settings, showDislikes: true });
  await settle();
  window.history.pushState({}, "", "/results?search_query=test");
  controller.update(settings);
  assert.equal(window.document.querySelector('[data-focuvia="dislikes"]'), null);
  assert.equal(window.document.documentElement.classList.contains("focuvia-watch"), false);
  controller.destroy();
  assert.equal(window.document.documentElement.className, "");
});

test("the dislike badge follows a replaced video-info container without another request", async t => {
  let requests = 0;
  const { window, controller, settings } = page(t, {
    html: '<div><div id="below"></div></div>',
    fetch: async () => { requests++; return { ok: true, json: async () => ({ dislikes: 3 }) }; }
  });
  controller.update({ ...settings, showDislikes: true });
  await settle();
  const badge = window.document.querySelector('[data-focuvia="dislikes"]');
  const replacement = window.document.createElement("section");
  replacement.innerHTML = '<div id="below"></div>';
  window.document.body.replaceChildren(replacement);
  await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  assert.equal(badge.nextElementSibling, window.document.querySelector("#below"));
  assert.equal(requests, 1);
});

test("search Shorts shelves hide completely, including late results, and restore with the toggle", async t => {
  const { window, controller, settings } = page(t, {
    url: "https://www.youtube.com/results?search_query=shorts",
    html: `<style>${fs.readFileSync("content.css", "utf8")}</style>
      <ytd-search>
        <grid-shelf-view-model id="first-shelf"><h2>Shorts</h2>
          <ytm-shorts-lockup-view-model><a href="/shorts/first">First Short</a></ytm-shorts-lockup-view-model>
        </grid-shelf-view-model>
        <grid-shelf-view-model id="second-shelf"><h2>Shorts</h2></grid-shelf-view-model>
        <grid-shelf-view-model id="regular-shelf"><a href="/watch?v=regular">Shorts editing tutorial</a></grid-shelf-view-model>
        <ytd-video-renderer id="regular-video"><a href="/watch?v=another">Regular result</a></ytd-video-renderer>
      </ytd-search>
      <ytd-browse page-subtype="home"><ytd-reel-shelf-renderer id="home-shorts">Shorts</ytd-reel-shelf-renderer></ytd-browse>`
  });
  const doc = window.document;
  const display = id => window.getComputedStyle(doc.getElementById(id)).display;
  controller.update(settings);
  assert.equal(display("first-shelf"), "none");
  assert.equal(display("home-shorts"), "none");
  assert.notEqual(display("regular-shelf"), "none");
  assert.notEqual(display("regular-video"), "none");
  doc.getElementById("second-shelf").insertAdjacentHTML("beforeend", `
    <ytm-shorts-lockup-view-model-v2><a href="https://www.youtube.com/shorts/second">Second Short</a></ytm-shorts-lockup-view-model-v2>`);
  await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  assert.equal(display("second-shelf"), "none");
  controller.update({ ...settings, hideShorts: false });
  assert.notEqual(display("first-shelf"), "none");
  assert.notEqual(display("second-shelf"), "none");
  controller.update(settings);
  assert.equal(display("first-shelf"), "none");
  assert.equal(display("second-shelf"), "none");
});
