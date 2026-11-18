Focuvia.createPage = function () {
  const cards = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "yt-lockup-view-model",
    "ytd-reel-item-renderer",
    "ytd-reel-shelf-renderer",
    "ytd-shelf-renderer"
  ].join(", ");
  const classes = {
    hideShorts: "focuvia-hide-shorts",
    hideRecommendations: "focuvia-hide-recommendations",
    hideComments: "focuvia-hide-comments",
    hideHomepage: "focuvia-hide-homepage",
    hideSidebar: "focuvia-hide-sidebar",
    hideHeaderHover: "focuvia-hide-header-hover",
    hideVideoInfoHover: "focuvia-hide-info-hover"
  };
  const pendingCards = new Set();
  let settings = Focuvia.defaults;
  let pageUrl = "";
  let videoId = "";
  let request = null;
  let badge = null;
  let frame = 0;

  function markCard(card) {
    const shortLink = card.querySelector('a[href^="/shorts/"], [overlay-style="SHORTS"]');
    const badge = card.querySelector("ytd-badge-supported-renderer");
    const isShelf = card.matches("ytd-shelf-renderer, ytd-reel-shelf-renderer");
    const title = isShelf ? card.querySelector("#title, #title-text") : null;
    const hasBadge = /shorts/i.test(badge?.textContent || "");
    const hasTitle = title?.textContent.trim().toLowerCase() === "shorts";
    const isShort = Boolean(shortLink) || hasBadge || hasTitle;
    card.classList.toggle("focuvia-short", isShort);
  }

  function collectCards(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element || element.closest("[data-focuvia]")) return;
    const parent = element.closest(cards);
    if (parent) pendingCards.add(parent);
    element.querySelectorAll(cards).forEach(card => pendingCards.add(card));
  }

  function placeBadge() {
    const anchor = document.querySelector("#below, ytd-watch-metadata");
    if (badge && anchor && badge.nextElementSibling !== anchor) anchor.before(badge);
  }

  function flushCards() {
    frame = 0;
    for (const card of pendingCards) {
      if (card.isConnected) markCard(card);
    }
    pendingCards.clear();
    placeBadge();
  }

  const observer = new MutationObserver(records => {
    if (settings.hideShorts) {
      for (const record of records) {
        if (record.target.closest?.("[data-focuvia]")) continue;
        const parent = record.target.closest?.(cards);
        if (parent) pendingCards.add(parent);
        record.addedNodes.forEach(collectCards);
      }
    }
    if (!frame && (pendingCards.size || badge)) frame = requestAnimationFrame(flushCards);
  });

  async function loadDislikes(id) {
    const controller = new AbortController();
    request = controller;
    try {
      const response = await fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${encodeURIComponent(id)}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])
      });
      if (!response.ok) return;
      const votes = await response.json();
      if (controller.signal.aborted || id !== videoId) return;
      badge = document.createElement("div");
      badge.dataset.focuvia = "dislikes";
      const count = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
      badge.textContent = `👍 ${count.format(votes.likes || 0)}   👎 ${count.format(votes.dislikes || 0)} (estimated dislikes)`;
      placeBadge();
    } catch (error) {
      if (!controller.signal.aborted) console.warn("Focuvia dislike count:", error.message);
    }
  }

  function update(nextSettings) {
    const scanShorts = nextSettings.hideShorts && (!settings.hideShorts || pageUrl !== location.href);
    settings = nextSettings;
    pageUrl = location.href;
    const root = document.documentElement;
    const isWatch = location.pathname === "/watch";
    root.classList.toggle("focuvia-watch", isWatch);
    for (const [key, name] of Object.entries(classes)) root.classList.toggle(name, settings[key]);
    if (scanShorts) {
      document.querySelectorAll(cards).forEach(markCard);
    }

    const nextId = isWatch && settings.showDislikes ? new URLSearchParams(location.search).get("v") || "" : "";
    if (nextId === videoId) return;
    request?.abort();
    badge?.remove();
    badge = null;
    videoId = nextId;
    if (videoId) loadDislikes(videoId);
  }

  function destroy() {
    observer.disconnect();
    cancelAnimationFrame(frame);
    request?.abort();
    badge?.remove();
    document.querySelectorAll(".focuvia-short").forEach(card => card.classList.remove("focuvia-short"));
    document.documentElement.classList.remove("focuvia-watch", ...Object.values(classes));
  }

  observer.observe(document.body, { childList: true, subtree: true });
  return { update, destroy };
};
