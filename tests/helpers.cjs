const fs = require("node:fs");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

function event() {
  const listeners = new Set();
  return {
    addListener: listener => listeners.add(listener),
    removeListener: listener => listeners.delete(listener),
    emit: (...args) => listeners.forEach(listener => listener(...args)),
    listeners
  };
}

function createChrome(initial = {}, clock = { date: new Date() }) {
  const changed = event();
  const messages = event();
  const data = { local: structuredClone(initial.local || {}), sync: structuredClone(initial.sync || {}) };
  const storage = { onChanged: changed };
  for (const area of ["local", "sync"]) {
    storage[area] = {
      async get(keys) {
        const result = Array.isArray(keys) ? {} : { ...keys };
        for (const key of Array.isArray(keys) ? keys : Object.keys(keys)) {
          if (key in data[area]) result[key] = structuredClone(data[area][key]);
        }
        return result;
      },
      async set(values) {
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          changes[key] = { oldValue: structuredClone(data[area][key]), newValue: structuredClone(value) };
          data[area][key] = structuredClone(value);
        }
        changed.emit(changes, area);
      }
    };
  }
  const chrome = {
    storage,
    runtime: {
      onMessage: messages,
      sendMessage: message => send(message),
    },
    tabs: { closed: [], async remove(id) { this.closed.push(id); } }
  };
  function send(message, sender = { tab: { id: 1 } }) {
    return new Promise(resolve => {
      messages.emit(message, sender, response => resolve(structuredClone(response)));
    });
  }
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.date])); }
  }
  const context = vm.createContext({ chrome, Date: ClockDate, console });
  context.importScripts = file => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  vm.runInContext(fs.readFileSync("background.js", "utf8"), context, { filename: "background.js" });
  return { chrome, send, data, clock };
}

function browser(t, { html = "", url = "https://www.youtube.com/watch?v=first", chrome, fetch } = {}) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  if (chrome) window.chrome = chrome;
  window.fetch = fetch || (async () => { throw new Error("Unexpected request"); });
  window.AbortController = AbortController;
  window.AbortSignal = AbortSignal;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  t.after(() => {
    window.dispatchEvent(new window.PageTransitionEvent("pagehide"));
    window.close();
  });
  return window;
}

function load(window, ...files) {
  let result;
  for (const file of files) result = window.eval(fs.readFileSync(file, "utf8"));
  return result;
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function settle() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

module.exports = { browser, createChrome, load, deferred, settle };
