# Focuvia

[![CI](https://github.com/zdying/focuvia/actions/workflows/ci.yml/badge.svg)](https://github.com/zdying/focuvia/actions/workflows/ci.yml)
[![Preview release](https://img.shields.io/github/v/release/zdying/focuvia?include_prereleases&label=preview)](https://github.com/zdying/focuvia/releases)
[![License: GPLv3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)
![Chrome 120+](https://img.shields.io/badge/Chrome-120%2B-4285F4)
![Edge 120+](https://img.shields.io/badge/Edge-120%2B-0078D7)
![Firefox 142+](https://img.shields.io/badge/Firefox-142%2B-FF7139)

Focuvia is a free, open-source **YouTube focus extension** for desktop Chrome, Edge and Firefox. Hide YouTube Shorts and recommendations, reveal video details when you need them, and set a daily watch limit.

**Watch YouTube on purpose.**

## Hide Shorts and recommendations

Hide YouTube Shorts, the recommendation sidebar and comments. Optionally hide the homepage feed, too. Regular video search results stay available; hiding coverage depends on YouTube’s layout. Each control can be changed independently.

## Video details, on hover

The top bar, title, channel and description stay hidden until you hover over their areas. Revealing them keeps the player in place. Playback controls stay available, and optional estimated dislike counts appear below the player.

## Daily watch limit

Choose your daily watch time — 30 minutes by default. When time’s up, playback pauses. Add 10 minutes or stop for the day. Check today’s progress in the popup; your total and stopped state carry across tabs and refreshes on this device.

## Development preview

[Website](https://zdying.github.io/focuvia/) · [Preview downloads](https://github.com/zdying/focuvia/releases) · [Privacy details](https://zdying.github.io/focuvia/privacy.html)

Browser-store listings are not available yet. Version 0.2.2 is a development preview, not a signed store release. Desktop targets are Chrome/Edge 120+ and Firefox 142+.

## Install

### Chrome and Edge

1. Download `focuvia-0.2.2-chromium.zip` from the preview release and extract it.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge), and enable **Developer mode**.
3. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
4. After updates, reload the extension and refresh existing YouTube tabs.

You can also load this repository's root directory directly during development.

### Firefox

1. Download `focuvia-0.2.2-firefox.zip` from the preview release and extract it.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on** and choose the extracted `manifest.json`.

The unsigned preview is removed when Firefox restarts. Regular installation requires Mozilla signing; renaming the ZIP to XPI does not sign it. Do not load the root Chromium manifest in Firefox: use the Firefox package, which has background scripts and a Gecko extension ID.

Firefox declares browsing-activity transmission because estimated dislike counts send the current video ID to Return YouTube Dislike. This feature defaults to on and can be turned off in the popup.

## Build packages

Requires Node.js 22+ for tests and Python 3 for packaging. The extension has no production dependencies or compilation step.

```sh
npm ci
npm test
npm run package
```

Outputs:

- `dist/focuvia-0.2.2-chromium.zip` — Chrome and Edge runtime package.
- `dist/focuvia-0.2.2-firefox.zip` — unsigned Firefox development/submission package.
- `dist/chromium/` and `dist/firefox/` — folders for developer loading.
- `dist/SHA256SUMS` — SHA-256 checksums for the ZIP files.

All three browsers run **the same JavaScript, CSS, popup and icons**. The two ZIPs differ only in `manifest.json`: Chrome/Edge require a service-worker background entry; Firefox requires a background-scripts entry and Firefox-specific metadata. The packaging script generates both manifests from the single base `manifest.json`, without changing or duplicating the feature code.

Packages contain runtime assets and GPLv3, excluding website files, tests, development dependencies and local configuration. Package and manifest versions must match.

## Releases

CI runs tests and packaging on pushes and pull requests. A version tag matching the manifest, such as `v0.2.2`, runs the checks and publishes both ZIPs and their checksums as a **GitHub prerelease**. A GitHub prerelease does not publish or sign an extension in any browser store.

## Code

| File | Responsibility |
| --- | --- |
| `shared.js` | Settings, local dates, daily state, and watch-duration calculations |
| `content.js` | Startup, settings changes, navigation, and cleanup |
| `page.js` | Page classes, added Shorts cards, and dislike requests |
| `timer.js` | Playback sampling and the daily-limit dialog |
| `background.js` | Serialised daily-state updates and closing the sending tab |
| `popup.html`, `popup.css`, `popup.js` | Settings and live watch statistics |

The scripts share a single `Focuvia` namespace inside the extension’s isolated context. Each page controller owns its listeners, requests, and DOM elements.

## Watch time

Only visible, playing videos in `#movie_player` contribute time. Samples compare elapsed time with playback progress; paused, seeking, and buffering video does not contribute. A sample contributes at most five seconds after a delayed callback. Short transitions between samples can be missed.

Visible videos in separate windows contribute to the same daily total. The background worker serialises updates and enforces the allowance. Extra time and the stopped state persist across tabs, reloads, and worker restarts. A new local calendar day starts fresh. Setting the limit to zero disables blocking.

Existing numeric daily totals are read when no new-format state exists for that date.

## Data and permissions

Settings use the browser’s `storage.sync` and may sync through the browser account. Viewing totals, extra time, and stopped state use `storage.local` on this device.

When dislike counts are enabled, the current video ID is sent to `returnyoutubedislikeapi.com`. Turning the feature off cancels the active request and removes its display. No account, analytics, or extension backend is used.

The extension requests `storage` and access to YouTube and Return YouTube Dislike. It does not request access to all websites.
