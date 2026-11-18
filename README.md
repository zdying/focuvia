# Focuvia

A small Manifest V3 extension for YouTube. Current version: 0.2.0.

## Features

- Hide Shorts, recommendations, comments, the homepage feed, or the watch-page sidebar.
- Reveal the watch-page header and video information on hover or keyboard focus.
- Track daily viewing time and pause playback at a chosen limit.
- Add ten minutes or stop watching for the day.
- Display estimated dislike counts from Return YouTube Dislike.

There is no transcript tool, sponsor skipping, channel filtering, playback adjustment, or screenshot tool.

## Install

Requires Chromium 120 or newer (Chrome, Edge, or Brave).

1. Open the browser’s extension management page and enable Developer mode.
2. Choose **Load unpacked** and select this folder.
3. After an update, reload the extension and refresh existing YouTube tabs.

The extension runs directly from these files. No build or production dependency is required.

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

Settings use `chrome.storage.sync` and may sync through the browser account. Viewing totals, extra time, and stopped state use `chrome.storage.local` on this device.

When dislike counts are enabled, the current video ID is sent to `returnyoutubedislikeapi.com`. Turning the feature off cancels the active request and removes its display. No account, analytics, or extension backend is used.

The extension requests `storage` and access to YouTube and Return YouTube Dislike. It does not request access to all websites.

## Tests

```sh
npm ci
npm test
```

Tests require Node.js compatible with jsdom 31. jsdom is a development dependency only. Tests execute the production scripts with a DOM implementation and a simulated Chrome API; they do not establish compatibility with a live YouTube session. See [TESTING.md](TESTING.md) for verification results.
