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

---

## Add / edit / remove a link

Everything you edit day-to-day lives in the **`EDIT HERE`** block near the
bottom of `index.html` (search the file for `EDIT HERE`). There are two
separate lists in there, not one.

### Drive folders — `DRIVE_FOLDERS`

The rows under the Google Drive heading:

```js
{ name:"Materials", url:"https://drive.google.com/drive/folders/...",
  accent:"var(--hue-1)" },
```

- **`url`** — the real link. Opens in a new tab.
- **`accent`** — any CSS color; sets the little diamond next to the name.
  The `--hue-N` tokens in `tokens.css` are a ready-made set.
- **`soon: true`** — dims the row and makes it unclickable.
- **`subfolders: [{ name, url }, ...]`** — optional. The row becomes an
  expand/collapse toggle showing these underneath, and the folder's own
  `url` is ignored (the row no longer links anywhere itself).

The two italic quick-open links that bracket the folder rows come from
`DRIVE_ROOT_NAME` / `DRIVE_ROOT_URL` and `DRIVE_EXTERNAL_URL` just above
the array — not from any folder entry.

### Websites — `SITES`

The icon tiles under My Websites:

```js
{ name:"ESOL LMS", desc:"myesolclass.com", url:"https://myesolclass.com/",
  mono:"E", accent:"var(--hue-4)" },
```

- **`mono`** — a letter for the tile's monogram, or use
  `icon: "icons/thing.svg"` for a logo image instead.
- **`desc`** — the small grey line under the name.

To remove either kind, delete its entry. That's it.

> **Still placeholders:** all four Drive folders, plus both quick-open
> links, point at a bare `https://drive.google.com/`. Swap those for your
> real folder links whenever you have them. The four site tiles are real.

---

## Search

The search box (or press `/`) filters **everything on the page at once** —
Drive folders and their subfolders, the Drive quick links, website tiles,
pins, and list items. Sections with no matches drop out, and the results
stack into a single column.

It also matches on text you can't see: a site's or pin's URL, so searching
a domain finds it. A collapsed Drive section still shows its matches, and
clearing the search leaves it exactly as collapsed as you had it. `Esc`
clears the box.

---

## Pins and List

Pins and your list sync through `GET|PUT /api/data`, a Cloudflare Pages
Function backed by a KV namespace. Until the KV binding is set up (see
below), everything still works — it just saves to `localStorage` on that one
browser instead of following you across devices.

The list behaves like this:

- **New items go to the bottom.**
- **Checking something off sinks it to the bottom** of the list. Unchecking
  it puts it back where it was, not at the end.
- **Press "Add" to reorder.** While the add form is open, every row grows
  up/down arrows so you can arrange the list however you like. The arrows
  won't move an item across the finished/unfinished divide, since checked
  items always sort to the bottom anyway.
- **"Clear finished"** appears once anything is checked off.

Pin URLs are forced to `http(s)` — a bare `example.com` becomes
`https://example.com`, and anything else (`javascript:`, `data:`) is
rejected rather than saved as a live link.

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

At the top of `sw.js`:

```js
const CACHE = "tcc-shell-v3";   // bump the number on every deploy
```

Increment that number every time you deploy, so the old cached copy is
thrown away and you get a clean update on the next visit.

You mostly need this for `tokens.css` and the manifest, which are served
cache-first. `index.html` is fetched network-first, so edits to the page
itself show up right away either way.

---

## Run it locally

From this folder:

```
python -m http.server 8000
```

Then open <http://localhost:8000>. This serves the files only — there's no
`/api/data` behind it, so Pins/List fall back to `localStorage` and the
footer reads "Saved on this device". That footer text is a status readout,
not a switch; it tells you which way the data went:

| Footer says | Meaning |
|-------------|---------|
| Saving… | a write is in flight |
| Saved | it reached KV |
| Saved on this device | `localStorage` only — there's no KV binding, or no API at all |
| Couldn't sync | there *is* an API and it failed (offline, or a server error) |

Your data is never lost in the bottom two cases — it's written to
`localStorage` first, every time, before the sync is even attempted.

To exercise the real API locally (KV included, in memory):

```
npx wrangler pages dev . --kv FOCUS_KV
```
