#!/usr/bin/env node
/**
 * Post-deploy smoke check: production bundle includes dashboard feature pack UI.
 * Usage: node scripts/verify-production-deploy.mjs
 *        PRODUCTION_URL=https://tidingz.com node scripts/verify-production-deploy.mjs
 */
const baseUrl = (process.env.PRODUCTION_URL || "https://tidingz.com").replace(/\/$/, "");

const REQUIRED_STRINGS = [
  "Organiser Committee Applications",
  "EB Applications",
  "allotChairWithRole",
];

const FORBIDDEN_STRINGS = ['children:"Waitlist"', 'label:"Waitlist"'];

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function extractChunkUrls(html) {
  const matches = html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g);
  return [...new Set([...matches].map((m) => m[0]))];
}

async function main() {
  console.log(`Checking production deploy at ${baseUrl} ...`);

  const healthRes = await fetch(`${baseUrl}/api/health`);
  if (!healthRes.ok) {
    throw new Error(`/api/health returned ${healthRes.status}`);
  }
  const health = await healthRes.json();
  if (!health.ok) {
    throw new Error(`/api/health not ok: ${JSON.stringify(health)}`);
  }
  console.log("  /api/health ok");

  const dashboardHtml = await fetchText(`${baseUrl}/organizers/dashboard`);
  const chunkPaths = extractChunkUrls(dashboardHtml);
  if (chunkPaths.length === 0) {
    throw new Error("No JS chunks found in /organizers/dashboard HTML");
  }

  let combined = "";
  for (const path of chunkPaths) {
    combined += await fetchText(`${baseUrl}${path}`);
  }

  const missing = REQUIRED_STRINGS.filter((needle) => !combined.includes(needle));
  if (missing.length > 0) {
    throw new Error(`Production bundle missing expected strings: ${missing.join(", ")}`);
  }
  console.log(`  Found required UI markers: ${REQUIRED_STRINGS.join(", ")}`);

  const forbiddenFound = FORBIDDEN_STRINGS.filter((needle) => combined.includes(needle));
  if (forbiddenFound.length > 0) {
    throw new Error(`Production bundle still contains removed UI: ${forbiddenFound.join(", ")}`);
  }
  console.log("  Waitlist action button not present in bundle");

  console.log("Production deploy verification passed.");
}

main().catch((err) => {
  console.error("Production deploy verification FAILED:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
