/**
 * CI status proxy for the Teaching Command Center.
 *
 * GET /api/ci — latest GitHub Actions run per tracked workflow.
 *
 * Uses GITHUB_TOKEN (or GH_TOKEN) when set for higher rate limits; both
 * repos are public so the endpoint works without it.
 */

const PROJECTS = [
  {
    repo: "marlanamc/advisor-bulletin",
    label: "Bulletin Board",
    workflows: [
      { file: "production-health.yml", label: "Production Health" },
      { file: "full-test-matrix.yml", label: "Weekly Link Test" },
    ],
  },
  {
    repo: "marlanamc/esol-resources",
    label: "ESOL LMS",
    workflows: [
      { file: "ci.yml", label: "CI" },
      { file: "maintenance-weekly.yml", label: "Weekly Maintenance" },
      { file: "maintenance-monthly.yml", label: "Monthly Maintenance" },
      { file: "release-gate.yml", label: "Release Gate" },
    ],
  },
];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function fetchRun(repo, file, headers) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${file}/runs?per_page=1`,
    { headers }
  );
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return {
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    updatedAt: run.updated_at,
  };
}

export async function onRequestGet({ env }) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN || "";
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "teaching-command-center",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const projects = await Promise.all(
      PROJECTS.map(async (project) => {
        const workflows = await Promise.all(
          project.workflows.map(async (w) => {
            try {
              const run = await fetchRun(project.repo, w.file, headers);
              return { file: w.file, label: w.label, run };
            } catch {
              return { file: w.file, label: w.label, run: null, error: true };
            }
          })
        );
        return { repo: project.repo, label: project.label, workflows };
      })
    );
    return json({ projects, updated: new Date().toISOString() });
  } catch {
    return json({ error: "fetch failed" }, 502);
  }
}

export const onRequest = ({ request }) =>
  json({ error: `${request.method} not allowed` }, 405);
