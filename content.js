(async () => {
  const { defaults, readSettings } = Focuvia;
  let settings = readSettings(await chrome.storage.sync.get(defaults));
  const page = Focuvia.createPage();
  const timer = Focuvia.createWatchTimer();

  function update() {
    page.update(settings);
    timer.update(settings);
  }

  function navigate() {
    update();
    timer.refresh();
  }

  function settingsChanged(changes, area) {
    if (area !== "sync") return;
    const values = { ...settings };
    for (const key of Object.keys(defaults)) {
      if (changes[key]) values[key] = changes[key].newValue ?? defaults[key];
    }
    settings = readSettings(values);
    update();
  }

  function destroy() {
    page.destroy();
    timer.destroy();
    chrome.storage.onChanged.removeListener(settingsChanged);
    document.removeEventListener("yt-navigate-finish", navigate);
    window.removeEventListener("popstate", navigate);
    window.removeEventListener("pagehide", pageHidden);
    window.removeEventListener("pageshow", pageShown);
  }

  function pageHidden(event) {
    if (!event.persisted) destroy();
  }

  function pageShown(event) {
    if (event.persisted) navigate();
  }

  update();
  chrome.storage.onChanged.addListener(settingsChanged);
  document.addEventListener("yt-navigate-finish", navigate);
  window.addEventListener("popstate", navigate);
  window.addEventListener("pagehide", pageHidden);
  window.addEventListener("pageshow", pageShown);
})().catch(error => console.error("Focuvia:", error));
