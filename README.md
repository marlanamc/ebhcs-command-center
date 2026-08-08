# Teaching Command Center

A personal launcher for Drive folders, your teaching websites, pins, and a
running list. Nautical look, on purpose — so it reads as clearly different
from the work Command Center at a glance.

**Built the same way as [command-center](https://github.com/mcreed-mlri/command-center):**
plain HTML/CSS/JS, no build step, hosted on Cloudflare Pages.

---

## How it's built

| File | What it is |
|------|------------|
| `index.html` | The whole app: styles, tiles, and render logic. **This is the only file you normally edit.** |
| `tokens.css` | Color/theme variables (nautical palette, light + dark). |
| `sw.js` | Service worker — caches the app so it loads instantly and works offline. |
| `manifest.webmanifest` | PWA settings (name, icons, colors). |
| `functions/api/data.js` | Cloudflare Pages Function — reads/writes your pins + list to KV. |

Everything you edit day-to-day lives in the **`EDIT HERE`** block near the
bottom of `index.html` (search the file for `EDIT HERE`).

---

## Add / edit / remove a tile

In `index.html`, find the `TILES = [ ... ]` array. Each entry is one tile
under Google Drive or My Websites:

```js
{ section:"drive", name:"Materials", desc:"Lesson materials and handouts",
  url:"https://drive.google.com/drive/folders/...", mono:"M", accent:"var(--hue-1)" },
```

- **`section`** — `"drive"` or `"sites"`.
- **`url`** — the real link. Opens in a new tab.
- **`accent`** — any CSS color (the `--hue-N` tokens in `tokens.css` are a
  ready-made set); sets the tile's monogram color.
- **`mono`** — a letter for the monogram (or `icon: "icons/thing.svg"` for a logo).
- **`soon: true`** — mark a tile that isn't live yet. Dimmed and unclickable.

The three Drive tiles (Materials, Admin, Workforce Data Analyst) currently
point at placeholder `https://drive.google.com/` URLs — swap those for your
real folder links whenever you have them.

To remove a tile, delete its entry. That's it.

---

## Pins and List

Pins and your list sync through `GET|PUT /api/data`, a Cloudflare Pages
Function backed by a KV namespace. Until the KV binding is set up (see
below), everything still works — it just saves to `localStorage` on that one
browser instead of following you across devices.

---

## Deploying (Cloudflare Pages)

1. Push this repo to GitHub (already created at
   `marlanamc/ebhcs-command-center` — wire it up as the remote, see below).
2. In the Cloudflare dashboard: **Pages → Create a project → Connect to Git**,
   pick the repo. No build command — it just serves the files.
3. **Settings → Bindings → add a KV namespace binding** named `FOCUS_KV`
   (create a new namespace if you don't have one yet), then redeploy. This
   is what makes pins/list follow you across devices instead of staying
   local to one browser.

```
git remote add origin https://github.com/marlanamc/ebhcs-command-center.git
git push -u origin main
```

---

## Bump the cache (do this after any edit, once deployed)

```js
const CACHE = "tcc-shell-v1";   // change v1 → v2, etc.
```

in `sw.js`, so everyone (well, you) gets a clean update on the next visit.
The page itself is fetched network-first, so most edits show up right away.

---

## Run it locally

From this folder:

```
python -m http.server 8000
```

Then open <http://localhost:8000>. Pins/List will use `localStorage` until
the KV binding exists — the toggle for that lives in the sync status text in
the footer.
