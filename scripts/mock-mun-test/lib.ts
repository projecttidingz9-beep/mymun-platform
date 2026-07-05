import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const QA_REPORT_PATH = join(__dirname, "MOCK_MUN_TEST_REPORT.md");

export type BugSeverity = "critical" | "high" | "medium" | "low";

export type BugEntry = {
  id: string;
  severity: BugSeverity;
  title: string;
  repro: string;
  rootCause?: string;
  fixed: boolean;
  fixNote?: string;
};

const bugLog: BugEntry[] = [];
let bugCounter = 0;

export function logBug(entry: Omit<BugEntry, "id" | "fixed"> & { fixed?: boolean }) {
  bugCounter += 1;
  const bug: BugEntry = {
    id: `BUG-${String(bugCounter).padStart(3, "0")}`,
    fixed: entry.fixed ?? false,
    ...entry,
  };
  bugLog.push(bug);
  const status = bug.fixed ? "FIXED" : "OPEN";
  console.log(`  [${status}] ${bug.id} [${bug.severity}] ${bug.title}`);
  return bug;
}

export function markBugFixed(titleSubstring: string, fixNote: string) {
  for (const bug of bugLog) {
    if (!bug.fixed && bug.title.includes(titleSubstring)) {
      bug.fixed = true;
      bug.fixNote = fixNote;
    }
  }
}

export function getBugLog() {
  return [...bugLog];
}

export function writeBugReport(extraSections = "") {
  const lines = [
    "# Mock MUN QA Test Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `## Summary`,
    "",
    `- Total issues: ${bugLog.length}`,
    `- Fixed: ${bugLog.filter((b) => b.fixed).length}`,
    `- Open: ${bugLog.filter((b) => !b.fixed).length}`,
    "",
    "## Issues",
    "",
  ];

  if (bugLog.length === 0) {
    lines.push("_No issues found._", "");
  } else {
    for (const bug of bugLog) {
      lines.push(
        `### ${bug.id} — ${bug.title}`,
        "",
        `- **Severity:** ${bug.severity}`,
        `- **Status:** ${bug.fixed ? "Fixed" : "Open"}`,
        `- **Repro:** ${bug.repro}`,
        ...(bug.rootCause ? [`- **Root cause:** ${bug.rootCause}`] : []),
        ...(bug.fixNote ? [`- **Fix:** ${bug.fixNote}`] : []),
        ""
      );
    }
  }

  if (extraSections) {
    lines.push(extraSections);
  }

  mkdirSync(dirname(QA_REPORT_PATH), { recursive: true });
  writeFileSync(QA_REPORT_PATH, lines.join("\n"), "utf8");
  return QA_REPORT_PATH;
}

export class HttpSession {
  private jar = new Map<string, string>();

  constructor(public readonly label: string) {}

  private parseSetCookie(header: string) {
    const parts = header.split(/,(?=\s*[^;,]+=)/);
    for (const part of parts) {
      const [pair] = part.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      this.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  private cookieHeader() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  clear() {
    this.jar.clear();
  }

  async request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (this.jar.size) headers.set("cookie", this.cookieHeader());
    const res = await fetch(path, { ...options, headers });
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) this.parseSetCookie(c);
    const legacy = res.headers.get("set-cookie");
    if (legacy) this.parseSetCookie(legacy);
    const json = await res.json().catch(() => ({}));
    return { res, json };
  }
}

export type StepResult = { ok: boolean; message: string; detail?: unknown };

export function step(name: string, result: StepResult) {
  const prefix = result.ok ? "OK " : "FAIL";
  console.log(`${prefix} [${name}]: ${result.message}`);
  if (!result.ok && result.detail) {
    console.error("       ", JSON.stringify(result.detail).slice(0, 500));
  }
  return result.ok;
}

export function assertStep(name: string, condition: boolean, message: string, detail?: unknown) {
  return step(name, { ok: condition, message, detail });
}

export function loadEnv() {
  dotenv.config({ path: resolve(process.cwd(), ".env.local") });
  dotenv.config();
}

export function getBaseUrl() {
  return (process.env.MOCK_MUN_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );
}

export async function waitForHealth(baseUrl: string, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && json.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}
