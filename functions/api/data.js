/**
 * Pins + list storage for the Teaching Command Center.
 *
 * Cloudflare Pages picks this up automatically as GET|PUT /api/data.
 * Single user, so there's one fixed KV key — no per-person slug needed.
 * No accounts: opening the page on any device gets your stuff, which also
 * means the endpoint is open (fine for a small personal tool on an
 * unlisted URL).
 *
 * Setup (one time, in the Cloudflare dashboard):
 *   Pages project → Settings → Bindings → add a KV namespace binding
 *   named FOCUS_KV (or KV) → redeploy.
 *
 * Until that binding exists this returns 503 and the page falls back to
 * localStorage only, which is also what happens offline. Nothing breaks.
 */

const MAX_BYTES = 64 * 1024;
const MAX_PINS = 40;
const MAX_TODOS = 300;
const MAX_EVENTS = 200;
const KV_KEY = "focus:teaching";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const str = (v, max) => (typeof v === "string" ? v : "").slice(0, max).trim();

/* Only http(s) survives. A pin url becomes an href, so a "javascript:" value
   arriving from storage would be a self-XSS waiting to happen. */
function safeUrl(v) {
  let raw = str(v, 2048);
  if (!raw) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

/* The client sanitizes too, but never trust that — this is the only gate in
   front of whatever ends up in KV. */
function clean(input) {
  const o = input && typeof input === "object" ? input : {};
  const pins = (Array.isArray(o.pins) ? o.pins : []).slice(0, MAX_PINS).map((p) => ({
    id: str(p?.id, 40),
    label: str(p?.label, 60),
    url: safeUrl(p?.url),
    icon: /^[a-z0-9]{0,24}$/.test(str(p?.icon, 24)) ? str(p?.icon, 24) : "anchor",
    color: /^#[0-9a-fA-F]{6}$/.test(p?.color || "") ? p.color : "#0c7272",
  }));
  const todos = (Array.isArray(o.todos) ? o.todos : []).slice(0, MAX_TODOS).map((t) => ({
    id: str(t?.id, 40),
    text: str(t?.text, 300),
    done: Boolean(t?.done),
    created: str(t?.created, 40),
  }));
  const events = (Array.isArray(o.events) ? o.events : []).slice(0, MAX_EVENTS).map((e) => ({
    id: str(e?.id, 40),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(e?.date, 10)) ? str(e?.date, 10) : "",
    text: str(e?.text, 80),
  }));
  return {
    v: 1,
    pins: pins.filter((p) => p.id && p.label && p.url),
    todos: todos.filter((t) => t.id && t.text),
    events: events.filter((e) => e.id && e.date && e.text),
    updated: str(o.updated, 40) || new Date().toISOString(),
  };
}

/* Accepts whichever binding variable the dashboard was set up with. */
const store = (env) => env.FOCUS_KV || env.KV || null;

export async function onRequestGet({ env }) {
  const kv = store(env);
  if (!kv) return json({ error: "kv not bound" }, 503);

  const raw = await kv.get(KV_KEY);
  if (!raw) return json({ v: 1, pins: [], todos: [], events: [], updated: null });
  return new Response(raw, {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function onRequestPut({ env, request }) {
  const kv = store(env);
  if (!kv) return json({ error: "kv not bound" }, 503);

  const body = await request.text();
  if (body.length > MAX_BYTES) return json({ error: "too large" }, 413);

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const value = clean(parsed);
  await kv.put(KV_KEY, JSON.stringify(value));
  return json({ ok: true, updated: value.updated });
}

export const onRequest = ({ request }) =>
  json({ error: `${request.method} not allowed` }, 405);
