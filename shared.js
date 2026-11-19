(() => {
  const defaults = Object.freeze({
    hideShorts: true,
    hideRecommendations: true,
    hideComments: true,
    hideSidebar: false,
    hideHeaderHover: true,
    hideVideoInfoHover: true,
    dailyLimitMinutes: 30,
    showDislikes: true
  });

  function readSettings(values) {
    const settings = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (typeof defaults[key] === "boolean" && typeof values[key] === "boolean") {
        settings[key] = values[key];
      }
    }
    const limit = Number(values.dailyLimitMinutes ?? defaults.dailyLimitMinutes);
    settings.dailyLimitMinutes = Number.isFinite(limit) ? Math.max(0, Math.min(600, Math.floor(limit))) : 30;
    return settings;
  }

  function localDay(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function emptyDay(date = localDay(), seconds = 0) {
    return { date, seconds, extraSeconds: 0, stopped: false, revision: 0 };
  }

  function isBlocked(day, limitMinutes) {
    if (!limitMinutes) return false;
    return day.stopped || day.seconds >= limitMinutes * 60 + day.extraSeconds;
  }

  function watchedBetween(previous, current) {
    if (!previous || !previous.active || !current.active || previous.video !== current.video) return 0;
    const elapsed = (current.now - previous.now) / 1000;
    const progress = (current.time - previous.time) / current.rate;
    return Math.max(0, Math.min(elapsed, progress, 5));
  }

  globalThis.Focuvia = { api: globalThis.browser || globalThis.chrome, defaults, readSettings, localDay, emptyDay, isBlocked, watchedBetween };
})();
