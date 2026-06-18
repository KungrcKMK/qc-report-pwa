# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this is

**QCControl** is a Progressive Web App (PWA) for factory floor staff to report
foreign objects / contamination found during quality control (รายงานสิ่งแปลกปลอม).
It is a **static, build-less frontend** hosted on GitHub Pages that talks to a
**Google Apps Script** backend (Google Sheets + Drive) over `fetch`.

The UI language is **Thai**. Keep all user-facing strings in Thai and match the
existing tone (short, practical, emoji-prefixed labels). Code identifiers and
comments are a mix of English and Thai — follow the surrounding style.

```
[PWA — GitHub Pages]  --fetch-->  [Apps Script /exec]  -->  [Google Sheets + Drive]
  HTML + CSS + Vanilla JS           doGet / doPost API         data + photos
```

## Repository layout

| Path | Purpose |
|------|---------|
| `index.html` | **The entire app** — markup, inline `<style>`, and inline `<script>`. ~1600 lines, no build step. |
| `manifest.json` | PWA manifest (name `QCControl`, Thai lang, standalone, red theme `#dc2626`). |
| `sw.js` | Service Worker. App-shell caching: HTML = network-first, other static = cache-first; Apps Script / Drive requests bypass the cache. |
| `icons/` | App icons: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. |
| `README.md` | Short Thai-language overview. |

There is **no `package.json`, no bundler, no transpiler, no test suite, no CI
config**. Everything ships exactly as written.

## How the app is structured (`index.html`)

Single-page app with four tabs (`data-page` on `.tab` buttons), switched by
`switchPage()`:

- **`form` (📝 รายงาน)** — the report form. Fields are collected by
  `currentFormData()`: `reporter`, `product`, `categories` (multi-select chips),
  `stage`, `supplier`, `quantity`, `unit`, `note`, and an optional `photo`
  (resized client-side to ≤1280px JPEG via `resizeImage()`).
- **`dash` (📊 สรุป)** — dashboard. `loadDashboard()` → `getDashboard`, then
  `renderDashboard()` fans out to KPIs, bar charts, scoreboard, monthly trend
  (`renderTrend`), per-category trend (`renderCatTrend`), supplier×category, etc.
- **`history` (📜 ประวัติ)** — searchable/paginated history with filters
  (from/to date, supplier, product, category, reporter, free-text `q`). Rows open
  an **edit/delete modal** (`openEditModal` → `updateReport` / `deleteReport`).
- **`qr` (📲 แชร์)** — QR code + share. Renders a report card to canvas
  (`renderReportCard`) and shares via the Web Share API; QR via the `qrcodejs`
  CDN library.

Several text/combo inputs are "combo boxes" (`initCombo`/`comboValue`): a
`<select>` of known options plus a `__new__` entry that reveals a free-text field,
letting users add new suppliers/products/etc. inline.

## Backend integration (important)

The frontend has **no real Google Apps Script runtime**. Instead it ships a
**`google.script.run` shim** (top of the inline script, ~line 553) that translates
calls into `fetch` against `APP_URL`:

```js
var APP_URL = "https://script.google.com/macros/s/.../exec";
```

- **GET actions** (`getOptions`, `getDashboard`, `ping`) → `GET ?action=<name>`.
- **POST actions** (`saveReport`, `searchReports`, `updateReport`, `deleteReport`)
  → `POST` with `JSON.stringify({ action, data })` and the **default `text/plain`
  content type** — this is deliberate to avoid a CORS preflight against Apps Script.

Calls use the Apps-Script-style fluent API:
`google.script.run.withSuccessHandler(cb).withFailureHandler(cb).action(arg)`.

Backend response convention: `{ ok: true, ... }` on success, otherwise an object
with `ok: false` and a `message`. `saveReport` returns `{ ok, rowIndex, added,
newFields }`; `searchReports` returns `{ ok, rows, total, offset }`.

> **If the Apps Script deployment URL changes, update `APP_URL` in `index.html`.**
> That string is the single source of truth for the backend endpoint.

### Offline queue

A second IIFE wraps `google.script.run` again (~line 1583) to add **offline
support** for `saveReport`:

- Reports are queued in **IndexedDB** (`qc-queue` DB, `queue` store) when offline
  or when a send fails.
- `flushQueue()` retries on the `online` event and on page load; a
  `#queueBadge` shows the pending count.
- Read/mutation actions (`getOptions`, `getDashboard`, `searchReports`,
  `updateReport`, `deleteReport`, `ping`) pass straight through to the inner shim.

When adding a new backend action, remember it must be registered in **both** the
base shim's `ACTIONS`/`GET_ACTIONS` (line ~554) **and** the offline wrapper's
pass-through list (line ~1594), or it won't be callable.

## Service Worker cache

`sw.js` uses a versioned cache name: `var CACHE = 'qc-shell-v3'`. **Bump this
version (`v3` → `v4` …) whenever you change cached shell assets** (`index.html`,
`manifest.json`, icons, or the CDN list in `SHELL`) so clients pick up the update;
the `activate` handler deletes old caches. HTML is served network-first, so code
changes generally reach users without a bump, but bumping is the safe default when
touching shell assets or the SW itself.

## Development workflow

No install/build. Serve the folder over HTTP (Service Workers require
`https` or `localhost`):

```bash
python -m http.server 8080
# open http://localhost:8080
```

Note: the live backend (`APP_URL`) is called directly from local dev too — there
is no mock. Test reads (dashboard, options) freely; be cautious with
`saveReport`/`updateReport`/`deleteReport` since they mutate the real Sheet.

### Deploy

Production deploys via **GitHub Pages on the `main` branch** — push to `main` and
Pages auto-publishes to `https://<user>.github.io/<repo>/`. There is no
intermediate build artifact; the repo content *is* the site.

## Conventions to follow

- **Vanilla ES5-ish JS only.** The code uses `var`, `function` expressions, and
  no framework, modules, or build tooling. Match it — do not introduce
  `import`/`export`, JSX, TypeScript, npm dependencies, or a bundler.
- **Everything lives in `index.html`.** Add markup, styles, and behavior inline
  alongside the existing sections rather than creating new files (unless a genuine
  new asset like an icon is needed).
- **Always escape user/data strings** with the `esc()` helper before injecting
  into `innerHTML` (this is the app's only XSS guard).
- **Thai UI copy**, English-ish identifiers. Keep emoji-prefixed labels consistent
  with neighbors.
- **Mobile-first.** The app targets phones in standalone/installed mode; keep
  layouts narrow-screen friendly (recent commits specifically fixed mobile fit).

## Git / branch workflow

- Active development branch for this task: **`claude/claude-md-docs-o1rb4w`**.
  Commit and push there; do not push to `main` without explicit permission.
- Commit messages in history are short, imperative, and describe the
  user-visible change (e.g. "Filter unknown suppliers from scoreboard…"). Follow
  that style.
- Do **not** open a pull request unless explicitly asked.
