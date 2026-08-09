/**
 * Live site status probe for the Teaching Command Center.
 *
 * GET /api/status — probes production health endpoints (not CI).
 * Prefer /api/health JSON; fall back to a homepage GET if health is missing.
 */

const SITES = [
  {
    id: "bulletin-board",
    label: "Bulletin Board",
    healthUrl: "https://ebhcsjobboard.web.app/student-feed-snapshot.json",
    fallbackUrl: "https://ebhcsjobboard.web.app/",
    kind: "snapshot",
  },
  {
    id: "esol-lms",
    label: "ESOL LMS",
    healthUrl: "https://myesolclass.com/api/health",
    fallbackUrl: "https://myesolclass.com/",
  },
];

const TIMEOUT_MS = 5000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function probeSite(site) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(site.healthUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "teaching-command-center" },
    });
    const latencyMs = Date.now() - started;
    const contentType = res.headers.get("content-type") || "";

    if (res.ok && contentType.includes("application/json")) {
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (site.kind === "snapshot" && body && Array.isArray(body.items) && body.generatedAt) {
        return {
          id: site.id,
          label: site.label,
          ok: true,
          source: "snapshot",
          db: null,
          latencyMs,
          url: site.fallbackUrl,
          checkedAt: new Date().toISOString(),
        };
      }
      if (body && typeof body.ok === "boolean") {
        return {
          id: site.id,
          label: site.label,
          ok: body.ok === true && body.db !== "fail",
          source: "health",
          db: body.db ?? null,
          latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : latencyMs,
          url: site.fallbackUrl,
          checkedAt: new Date().toISOString(),
        };
      }
    }

    // Health route missing/old deploy — fall back to homepage reachability.
    if (res.status === 404 || !contentType.includes("application/json")) {
      const homeController = new AbortController();
      const homeTimer = setTimeout(() => homeController.abort(), TIMEOUT_MS);
      try {
        const homeStarted = Date.now();
        const home = await fetch(site.fallbackUrl, {
          method: "GET",
          redirect: "follow",
          signal: homeController.signal,
          headers: { "User-Agent": "teaching-command-center" },
        });
        return {
          id: site.id,
          label: site.label,
          ok: home.ok,
          source: "homepage",
          db: null,
          latencyMs: Date.now() - homeStarted,
          url: site.fallbackUrl,
          checkedAt: new Date().toISOString(),
        };
      } finally {
        clearTimeout(homeTimer);
      }
    }

    return {
      id: site.id,
      label: site.label,
      ok: false,
      source: "health",
      db: "fail",
      latencyMs,
      url: site.fallbackUrl,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      id: site.id,
      label: site.label,
      ok: false,
      source: "error",
      db: null,
      latencyMs: Date.now() - started,
      url: site.fallbackUrl,
      error: err instanceof Error ? err.name : "fetch_failed",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestGet() {
  try {
    const sites = await Promise.all(SITES.map(probeSite));
    return json({ sites, updated: new Date().toISOString() });
  } catch {
    return json({ error: "probe failed" }, 502);
  }
}

export const onRequest = ({ request }) =>
  json({ error: `${request.method} not allowed` }, 405);
