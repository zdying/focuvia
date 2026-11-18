Focuvia 0.2.0 is a **development preview**, not a browser-store release.

- Chrome / Edge: download `focuvia-0.2.0-chromium.zip`, extract it, enable Developer mode at `chrome://extensions` or `edge://extensions`, and choose **Load unpacked**.
- Firefox 142+: download and extract `focuvia-0.2.0-firefox.zip`, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select its `manifest.json`. This unsigned preview is removed when Firefox restarts. Normal installation requires Mozilla signing; an unsigned ZIP is not an installable signed XPI.
- Firefox uses background scripts; Chrome and Edge use a service worker. Both packages use the same feature code.
- Estimated dislikes are enabled by default and send the current video ID to Return YouTube Dislike. Firefox declares browsing-activity transmission at installation. Turn the dislike option off to stop these requests.
- Settings may sync through your browser; viewing totals remain local. No Focuvia account or analytics.

Validate downloads using `SHA256SUMS`. Packages contain runtime files and GPLv3, excluding the website, tests and dependencies.
