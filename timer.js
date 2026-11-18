Focuvia.createWatchTimer = function () {
  const { localDay, emptyDay, isBlocked, watchedBetween } = Focuvia;
  let settings = Focuvia.defaults;
  let day = emptyDay();
  let loaded = false;
  let previous = null;
  let busy = false;
  let overlay = null;
  let lastError = "";
  let destroyed = false;

  function acceptDay(next) {
    if (destroyed) return;
    if (next.date !== localDay()) return;
    if (next.date === day.date && next.revision < day.revision) return;
    day = next;
    loaded = true;
    render();
  }

  async function send(action, seconds) {
    const result = await chrome.runtime.sendMessage({ type: "watch", action, seconds });
    if (result.error) throw new Error(result.error);
    if (action !== "close") acceptDay(result);
  }

  function pauseVideos() {
    document.querySelectorAll("video").forEach(video => video.pause());
  }

  function createOverlay() {
    const element = document.createElement("dialog");
    element.dataset.focuvia = "limit";
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-modal", "true");
    element.setAttribute("aria-labelledby", "focuvia-limit-title");
    element.addEventListener("cancel", event => event.preventDefault());
    element.innerHTML = `
      <div class="focuvia-limit-card">
        <h2 id="focuvia-limit-title"></h2>
        <p data-field="message"></p>
        <progress max="100" value="0" aria-label="Daily watch limit"></progress>
        <div class="focuvia-limit-actions">
          <button type="button" data-action="extend">Add 10 minutes</button>
          <button type="button" data-action="stop">Stop watching</button>
          <button type="button" data-action="close">Close this tab</button>
        </div>
        <p data-field="error" role="status"></p>
      </div>`;
    element.addEventListener("click", async event => {
      const button = event.target.closest("button[data-action]");
      if (!button || button.disabled) return;
      button.disabled = true;
      const errorText = element.querySelector('[data-field="error"]');
      errorText.textContent = "";
      try {
        await send(button.dataset.action);
        if (button.dataset.action === "extend" && !isBlocked(day, settings.dailyLimitMinutes)) {
          await document.querySelector("#movie_player video")?.play();
        }
      } catch (error) {
        errorText.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
    document.body.appendChild(element);
    return element;
  }

  function render() {
    const blocked = loaded && isBlocked(day, settings.dailyLimitMinutes);
    if (!blocked) {
      if (overlay?.open) overlay.close();
      return;
    }
    pauseVideos();
    if (!overlay) overlay = createOverlay();
    if (!overlay.open) overlay.showModal();
    overlay.querySelector("h2").textContent = day.stopped ? "Stopped for today" : "Time’s up for today";
    const minutes = Math.floor(day.seconds / 60);
    const allowance = settings.dailyLimitMinutes + day.extraSeconds / 60;
    overlay.querySelector('[data-field="message"]').textContent = `You watched ${minutes} min today (limit ${allowance} min).`;
    overlay.querySelector("progress").value = Math.min(100, day.seconds / (allowance * 60) * 100);
    overlay.querySelector('[data-action="stop"]').hidden = day.stopped;
    overlay.querySelector('[data-action="close"]').hidden = !day.stopped;
  }

  async function tick() {
    if (busy || destroyed) return;
    busy = true;
    try {
      if (day.date !== localDay()) {
        day = emptyDay();
        loaded = false;
        previous = null;
        render();
      }
      if (!loaded) await send("read");
      const video = document.querySelector("#movie_player video");
      const current = {
        video,
        now: performance.now(),
        time: video?.currentTime || 0,
        rate: video?.playbackRate || 1,
        active: Boolean(video && document.visibilityState === "visible" && !video.paused &&
          !video.ended && !video.seeking && video.readyState >= 3 && !isBlocked(day, settings.dailyLimitMinutes))
      };
      const seconds = watchedBetween(previous, current);
      previous = current;
      if (seconds > 0) await send("record", seconds);
      if (isBlocked(day, settings.dailyLimitMinutes)) pauseVideos();
      lastError = "";
    } catch (error) {
      if (error.message !== lastError) console.warn("Focuvia watch timer:", error.message);
      lastError = error.message;
    } finally {
      busy = false;
    }
  }

  function playbackChanged(event) {
    previous = null;
    if (event.type === "play" || event.type === "playing") {
      if (loaded && isBlocked(day, settings.dailyLimitMinutes)) pauseVideos();
    }
    tick();
  }

  function storageChanged(changes, area) {
    const change = changes[`watch:${localDay()}`];
    if (area === "local" && change?.newValue) acceptDay(change.newValue);
  }

  const events = ["play", "playing", "pause", "waiting", "seeking", "seeked", "ended", "loadedmetadata"];
  events.forEach(name => document.addEventListener(name, playbackChanged, true));
  document.addEventListener("visibilitychange", playbackChanged);
  chrome.storage.onChanged.addListener(storageChanged);
  const interval = setInterval(tick, 1000);
  tick();

  return {
    update(nextSettings) {
      settings = nextSettings;
      previous = null;
      render();
    },
    refresh() {
      previous = null;
      loaded = false;
      tick();
    },
    destroy() {
      destroyed = true;
      clearInterval(interval);
      events.forEach(name => document.removeEventListener(name, playbackChanged, true));
      document.removeEventListener("visibilitychange", playbackChanged);
      chrome.storage.onChanged.removeListener(storageChanged);
      overlay?.remove();
    }
  };
};
