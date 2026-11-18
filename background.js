importScripts("shared.js");

const { defaults, localDay, emptyDay, isBlocked, readSettings } = Focuvia;
const actions = new Set(["read", "record", "extend", "stop", "close"]);
let pendingWrite = Promise.resolve();

async function updateWatch(message, sender) {
  if (message.action === "close") {
    if (!sender.tab) throw new Error("No tab to close");
    await chrome.tabs.remove(sender.tab.id);
    return {};
  }

  const date = localDay();
  const key = `watch:${date}`;
  const stored = await chrome.storage.local.get([key, date]);
  const day = stored[key] || emptyDay(date, stored[date] || 0);
  if (message.action === "read") return day;

  if (message.action === "record") {
    if (!sender.tab || !Number.isFinite(message.seconds) || message.seconds <= 0 || message.seconds > 5) {
      throw new Error("Invalid watch duration");
    }
    const settings = readSettings(await chrome.storage.sync.get(defaults));
    if (isBlocked(day, settings.dailyLimitMinutes)) return day;
    const remaining = settings.dailyLimitMinutes
      ? settings.dailyLimitMinutes * 60 + day.extraSeconds - day.seconds
      : Infinity;
    day.seconds += Math.min(message.seconds, remaining);
  } else if (message.action === "extend") {
    day.extraSeconds += 600;
    day.stopped = false;
  } else if (message.action === "stop") {
    day.stopped = true;
  }

  day.revision += 1;
  await chrome.storage.local.set({ [key]: day });
  return day;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "watch" || !actions.has(message.action)) return;
  pendingWrite = pendingWrite
    .then(() => updateWatch(message, sender))
    .then(respond, error => respond({ error: error.message }));
  return true;
});
