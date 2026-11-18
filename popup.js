(async () => {
  const { defaults, readSettings, localDay, emptyDay } = Focuvia;
  const elements = Object.fromEntries(Object.keys(defaults).map(key => [key, document.getElementById(key)]));
  const saved = document.getElementById("saved");
  let settings = readSettings(await chrome.storage.sync.get(defaults));
  let day = emptyDay();
  let savedTimeout;

  function render() {
    if (day.date !== localDay()) day = emptyDay();
    for (const [key, element] of Object.entries(elements)) {
      if (element.type === "checkbox") element.checked = settings[key];
      else element.value = settings[key];
    }
    const minutes = Math.floor(day.seconds / 60);
    const limit = settings.dailyLimitMinutes ? settings.dailyLimitMinutes + day.extraSeconds / 60 : 0;
    document.getElementById("todayMins").textContent = minutes;
    document.getElementById("todayLimit").textContent = limit || "∞";
    const summary = limit
      ? `${minutes} min watched · ${Math.max(0, limit - minutes)} min left today`
      : `${minutes} min watched · no limit set`;
    document.getElementById("todayStats").textContent = limit && day.stopped
      ? `${minutes} min watched · stopped for today`
      : summary;
    const progress = limit ? Math.min(100, day.seconds / (limit * 60) * 100) : 0;
    document.getElementById("todayProgress").value = progress;
  }

  for (const [key, element] of Object.entries(elements)) {
    element.addEventListener("change", async () => {
      const value = element.type === "checkbox" ? element.checked : element.value;
      const next = readSettings({ ...settings, [key]: value });
      try {
        await chrome.storage.sync.set({ [key]: next[key] });
        settings[key] = next[key];
        render();
        saved.textContent = "Saved.";
        clearTimeout(savedTimeout);
        savedTimeout = setTimeout(() => { saved.textContent = ""; }, 1200);
      } catch (error) {
        render();
        saved.textContent = "Save failed";
        console.error("Focuvia settings:", error);
      }
    });
  }

  function storageChanged(changes, area) {
    if (area === "sync") {
      const values = { ...settings };
      for (const key of Object.keys(defaults)) {
        if (changes[key]) values[key] = changes[key].newValue ?? defaults[key];
      }
      settings = readSettings(values);
    }
    const change = changes[`watch:${localDay()}`];
    if (area === "local" && change?.newValue) day = change.newValue;
    render();
  }

  chrome.storage.onChanged.addListener(storageChanged);
  window.addEventListener("pagehide", () => {
    clearTimeout(savedTimeout);
    chrome.storage.onChanged.removeListener(storageChanged);
  }, { once: true });
  render();
  const result = await chrome.runtime.sendMessage({ type: "watch", action: "read" });
  if (result.error) throw new Error(result.error);
  if (result.date === localDay() && result.revision >= day.revision) day = result;
  render();
})().catch(error => {
  document.getElementById("todayStats").textContent = "Could not load watch time.";
  console.error("Focuvia popup:", error);
});
