# Sablier

Sablier is a Chrome Manifest V3 extension that tracks focused browser time in two buckets: configured entertainment websites (`within`) and all other normal web pages (`without`). When `without * ratio < within`, configured sites redirect to the Sablier dashboard until the next daily reset.

## Structure

- `manifest.json`: extension metadata and permissions.
- `background.js`: service worker, focused-tab tracking, persistence, and blocking rules.
- `core.js`: pure time, domain, and balance helpers.
- `dashboard.html`, `dashboard.css`, `dashboard.js`: popup and blocked-page dashboard.

Load the `Sablier` directory through `chrome://extensions` with Developer mode and “Load unpacked”. Data is stored in `chrome.storage.local`; only the last 120 days are retained.
