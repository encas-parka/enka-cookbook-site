/**
 * migrate.ts — Migration orchestrator: full pipeline + run report.
 *
 * Chains the pipeline (doc_migrationPb.md, phases A–D) against one
 * PocketBase target and writes a dated run report to scripts_dev/runs/:
 *
 *   preflight → cleanup → transforms (2, 2b, 2c, 2d) → import (3)
 *   → stop PB → 4-fix-timestamps → start PB → validate → run report
 *
 * Fail-fast: a failing step stops the chain, the report is written anyway
 * and the process exits 1. The global verdict is VERT only when every step
 * exited 0 and validate reports 0 failed checks / 0 non-verdicted deviations.
 *
 * Usage:
 *   bun run scripts_dev/migrate.ts [options]
 *
 * Options:
 *   --yes              Non-interactive: forwarded to cleanup-pb (skips its
 *                      confirmation). Does NOT ack the Hugo content sync —
 *                      unattended runs must also pass --content-synced.
 *   --content-synced   Acknowledge content/recipe was synced from the site
 *                      repo before this run (human prerequisite, printed
 *                      reminder otherwise; interactive runs can ack by prompt).
 *   --target=migrated|all  Cleanup scope (default: all — reset contract).
 *   --pb-bin=<path>    Managed mode: PocketBase binary migrate.ts spawns.
 *   --pb-dir=<path>    Managed mode: pb_data directory of the target.
 *                      Requires --pb-bin. The instance is started at
 *                      preflight, stopped by PID around 4-fix-timestamps
 *                      (which requires the target NOT served) and disposed
 *                      at the end of the run — the orchestrator only ever
 *                      stops a process it started itself.
 *
 * Without --pb-bin/--pb-dir (operator mode) an already-running target is
 * required; the run then aborts at 4-fix-timestamps (the target must be
 * stopped by whoever started it) and — after a successful fix — waits for
 * the instance to be restarted before validate.
 *
 * Target selection: PB_URL_OVERRIDE env > .env.local PB_URL > 8090 (same
 * convention as every pipeline script; forwarded to all PB-facing steps).
 *
 * Prerequisites (full checklist in doc_migrationPb.md § migrate.ts):
 *   - scripts_dev/.env.local with PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD matching
 *     a superuser on the target;
 *   - the target pb_data provisioned: migrations applied (pocketbase migrate
 *     up) and empty — the pipeline contract is a full reset;
 *   - fresh appwrite-export/*.json (1-export-appwrite.ts);
 *   - Hugo content synced (content/recipe is the source of recipes).
 */
import { execFile, spawn, type ChildProcess } from "node:child_process";
import {
  closeSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { join, basename } from "path";
import { tmpdir } from "os";

// --- Paths ---
const SCRIPTS_DIR = import.meta.dir;
const RUNS_DIR = join(SCRIPTS_DIR, "runs");
const PB_IMPORT_DIR = join(SCRIPTS_DIR, "pb-import");
const ENV_FILE = join(SCRIPTS_DIR, ".env.local");
const REPO_ROOT = join(SCRIPTS_DIR, "..");
const POCKETBASE_DIR = join(REPO_ROOT, "pocketbase");
const CONTENT_RECIPE_DIR = join(REPO_ROOT, "content", "recipe");
const SOURCE_FILES = [
  join(REPO_ROOT, "static", "data", "ingredients.json"),
  join(REPO_ROOT, "static", "data", "recipe-info.json"),
];

// --- Types ---
interface StepOutcome {
  name: string;
  cmd: string;
  exitCode: number | null;
  durationMs: number;
  logFile?: string;
  counts: [string, string][];
  ok: boolean;
  error?: string;
}

interface SourceInfo {
  label: string;
  mtime: string;
  note?: string;
}

// --- Env loading (same file format as the pipeline scripts) ---
function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) {
    console.error(`❌ Missing ${ENV_FILE}`);
    process.exit(1);
  }
  const content = readFileSync(ENV_FILE, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key) env[key] = val;
  }
  return env;
}

// --- Args ---
function parseArgs() {
  const args = process.argv.slice(2);
  const valued = (name: string): string | undefined => {
    const inline = args.find((a) => a.startsWith(`--${name}=`));
    return inline ? inline.slice(`--${name}=`.length) : undefined;
  };
  return {
    help: args.includes("--help") || args.includes("-h"),
    yes: args.includes("--yes"),
    contentSynced: args.includes("--content-synced"),
    cleanupTarget: valued("target") ?? "all",
    pbBin: valued("pb-bin"),
    pbDir: valued("pb-dir"),
    unknown: args.filter(
      (a) =>
        !["--yes", "--content-synced", "--help", "-h"].includes(a) &&
        !/^--(target|pb-bin|pb-dir)=/.test(a),
    ),
  };
}

// --- Health probes ---
async function isUp(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitUp(base: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUp(base)) return;
    await sleep(400);
  }
  throw new Error(`PocketBase not healthy on ${base} after ${timeoutMs / 1000}s`);
}

async function waitDown(base: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isUp(base))) return;
    await sleep(400);
  }
  throw new Error(`PocketBase still responding on ${base} after ${timeoutMs / 1000}s`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Managed PocketBase lifecycle ---
let pbChild: ChildProcess | null = null;
let pbLogFd: number | null = null;
let pbTmpDir: string | null = null;
let pbLogsDir: string | null = null;

/**
 * Start the managed instance. Migrations and hooks are copied to a temp dir
 * OUTSIDE the repo first: a served instance writes dynamic migrations into
 * the pb_migrations dir it resolves — pointing it into the repo would leak
 * files there (pitfall measured 11-10).
 */
async function startManagedPb(pbBin: string, pbDir: string, target: string): Promise<StepOutcome> {
  const t0 = Date.now();
  // Restart: release the previous instance's log fd and temp dir first.
  if (pbLogFd !== null) closeSync(pbLogFd);
  if (pbTmpDir) rmSync(pbTmpDir, { recursive: true, force: true });
  pbTmpDir = mkdtempSync(join(tmpdir(), "enka-migrate-"));
  cpSync(join(POCKETBASE_DIR, "pb_migrations"), join(pbTmpDir, "pb_migrations"), { recursive: true });
  if (existsSync(join(POCKETBASE_DIR, "pb_hooks"))) {
    cpSync(join(POCKETBASE_DIR, "pb_hooks"), join(pbTmpDir, "pb_hooks"), { recursive: true });
  }
  pbLogFd = openSync(join(pbLogsDir!, "pb-instance.log"), "a");
  const url = new URL(target);
  let child: ChildProcess;
  try {
    child = spawn(
      pbBin,
      [
        "serve",
        `--http=${url.hostname}:${url.port}`,
        `--dir=${pbDir}`,
        `--migrationsDir=${join(pbTmpDir, "pb_migrations")}`,
        `--hooksDir=${join(pbTmpDir, "pb_hooks")}`,
      ],
      { cwd: REPO_ROOT, stdio: ["ignore", pbLogFd, pbLogFd] },
    );
  } catch (err: any) {
    pbChild = null;
    return stepOutcome(
      "pb-start (managed)",
      `${basename(pbBin)} serve`,
      t0,
      1,
      undefined,
      `spawn failed: ${err.message}`,
    );
  }
  pbChild = child;
  // A serve that dies during startup (e.g. port already bound — the dev
  // instance) must never be mistaken for a healthy target: race the health
  // probe against the child's exit.
  let exitNote: string | null = null;
  const exited = new Promise<boolean>((resolve) =>
    child.once("exit", (code) => {
      exitNote = `managed instance exited during startup (code ${code}) — port busy? see ${join(pbLogsDir!, "pb-instance.log")}`;
      resolve(false);
    }),
  );
  const healthy = waitUp(target, 30_000).then(() => true);
  const becameHealthy = await Promise.race([healthy, exited]);
  if (!becameHealthy) {
    pbChild = null;
    return stepOutcome("pb-start (managed)", `${basename(pbBin)} serve`, t0, 1, undefined, exitNote ?? "instance did not become healthy");
  }
  return stepOutcome("pb-start (managed)", `${basename(pbBin)} serve`, t0, 0, undefined);
}

/** Stop the managed instance by PID — never anything migrate.ts did not spawn. */
async function stopManagedPb(): Promise<StepOutcome> {
  const t0 = Date.now();
  const child = pbChild;
  pbChild = null;
  if (!child) {
    return stepOutcome("pb-stop (managed)", "kill managed instance", t0, 1, undefined, "no managed instance running");
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    // Already dead (crash mid-run) — the exit event already fired; make sure
    // the port is actually free before the sqlite step.
    console.log("   ⚠️  managed instance already exited — checking the port is free");
  } else {
    await new Promise<void>((resolve) => {
      const escalate = setTimeout(() => child.kill("SIGKILL"), 10_000);
      child.once("exit", () => {
        clearTimeout(escalate);
        resolve();
      });
      child.kill("SIGTERM");
    });
  }
  await waitDown(TARGET, 10_000);
  return stepOutcome("pb-stop (managed)", "kill (SIGTERM) managed instance", t0, 0, undefined);
}

/** Best-effort cleanup — runs on every exit path; the child must never outlive us. */
function disposeManagedPb(): void {
  if (pbChild) {
    pbChild.kill("SIGTERM");
    pbChild = null;
  }
  if (pbLogFd !== null) {
    closeSync(pbLogFd);
    pbLogFd = null;
  }
  if (pbTmpDir) {
    rmSync(pbTmpDir, { recursive: true, force: true });
    pbTmpDir = null;
  }
}

// --- Steps ---
function stepOutcome(
  name: string,
  cmd: string,
  t0: number,
  exitCode: number | null,
  logFile: string | undefined,
  error?: string,
  counts: [string, string][] = [],
): StepOutcome {
  return {
    name,
    cmd,
    exitCode,
    durationMs: Date.now() - t0,
    logFile,
    counts,
    ok: exitCode === 0 && !error,
    error,
  };
}

async function runStep(
  name: string,
  displayCmd: string,
  cmd: string[],
  opts: {
    env?: Record<string, string>;
    extract?: (output: string) => [string, string][];
  } = {},
): Promise<StepOutcome> {
  const t0 = Date.now();
  const logFile = join(pbLogsDir!, `${name}.log`);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`▶ [${name}] ${displayCmd}`);
  console.log(`${"=".repeat(60)}\n`);

  const child = spawn(cmd[0], cmd.slice(1), {
    cwd: REPO_ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const forward = (chunk: Buffer) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  };
  child.stdout!.on("data", forward);
  child.stderr!.on("data", forward);

  const exitCode = await new Promise<number>((resolve) => {
    child.on("error", (err) => {
      output += `\n[spawn error] ${err.message}`;
      resolve(-1);
    });
    child.on("exit", (code) => resolve(code ?? -1));
  });

  writeFileSync(logFile, output);
  const counts = opts.extract ? opts.extract(output) : [];
  return stepOutcome(name, displayCmd, t0, exitCode, logFile, undefined, counts);
}

// Extractors — regex on the step's own output, kept tolerant (a parse miss
// just means a missing count line in the report, never a false green).
function sumMatches(output: string, re: RegExp): number {
  let total = 0;
  for (const m of output.matchAll(re)) total += Number(m[1]);
  return total;
}

const extractCleanup = (output: string): [string, string][] => [
  ["records deleted", String(sumMatches(output, /(\d+) deleted/g))],
];

const extractImport = (output: string): [string, string][] => {
  const created = output.match(/Total: (\d+) created, (\d+) failed/);
  const refMap = output.match(/RefId mapping: (\d+) entries/);
  const counts: [string, string][] = [];
  if (created) counts.push(["created", created[1]], ["failed", created[2]]);
  if (refMap) counts.push(["id-map entries", refMap[1]]);
  return counts;
};

const extractFix = (output: string): [string, string][] => {
  const updated = output.match(/Records updated:\s+(\d+)/);
  const skipped = output.match(/Skipped \(no ts\):\s+(\d+)/);
  const missing = output.match(/Missing \(no ID\):\s+(\d+)/);
  const counts: [string, string][] = [];
  if (updated) counts.push(["updated", updated[1]]);
  if (skipped) counts.push(["no timestamps", skipped[1]]);
  if (missing) counts.push(["no PB id", missing[1]]);
  return counts;
};

const extractValidate = (output: string): [string, string][] => {
  const total = output.match(/Total: (\d+)\/(\d+) checks passed/);
  const nonVerdicted = output.match(/Non-verdicted deviations: (\d+)/);
  const counts: [string, string][] = [];
  if (total) counts.push(["checks passed", `${total[1]}/${total[2]}`]);
  if (nonVerdicted) counts.push(["non-verdicted", nonVerdicted[1]]);
  return counts;
};

/** The validate summary block, copied verbatim into the run report. */
function validateSummaryBlock(output: string): string | null {
  const idx = output.indexOf("Validation Summary");
  if (idx === -1) return null;
  return output.slice(idx - 4).trimEnd();
}

// --- pb-import inspection (after the transforms) ---
function collectImportDirCounts(): [string, string][] {
  const counts: [string, string][] = [];
  let totalRecords = 0;
  const perCollection: [string, number][] = [];
  for (const f of readdirSync(PB_IMPORT_DIR).sort()) {
    if (!f.endsWith(".json") || f === "expected-verdicts.json" || f === "id-map.json") continue;
    try {
      const parsed = JSON.parse(readFileSync(join(PB_IMPORT_DIR, f), "utf-8"));
      if (Array.isArray(parsed)) {
        perCollection.push([f.replace(/\.json$/, ""), parsed.length]);
        totalRecords += parsed.length;
      }
    } catch {
      // not an array-shaped artifact — skip, never fail the run for a report count
    }
  }
  counts.push(["pb-import records", String(totalRecords)]);
  counts.push(["collections", String(perCollection.length)]);
  return counts;
}

function collectVerdictCounts(): [string, string][] {
  const file = join(PB_IMPORT_DIR, "expected-verdicts.json");
  if (!existsSync(file)) return [["verdicts emitted", "0 (file missing)"]];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf-8"));
    const verdicts: { type: string }[] = parsed?.verdicts ?? [];
    const byType = new Map<string, number>();
    for (const v of verdicts) byType.set(v.type, (byType.get(v.type) ?? 0) + 1);
    return [
      ["verdicts emitted", String(verdicts.length)],
      ...[...byType.entries()].map(([t, n]) => [`  ${t}`, String(n)] as [string, string]),
    ];
  } catch (err: any) {
    return [["verdicts emitted", `unreadable: ${err.message}`]];
  }
}

// --- Header info ---
function collectSources(): SourceInfo[] {
  const sources: SourceInfo[] = [];
  const exportDir = join(SCRIPTS_DIR, "appwrite-export");
  if (existsSync(exportDir)) {
    const files = readdirSync(exportDir).filter((f) => f.endsWith(".json")).sort();
    for (const f of files) {
      sources.push({ label: `appwrite-export/${f}`, mtime: statSync(join(exportDir, f)).mtime.toISOString() });
    }
  } else {
    sources.push({ label: "appwrite-export/", mtime: "MISSING", note: "run 1-export-appwrite.ts" });
  }
  if (existsSync(CONTENT_RECIPE_DIR)) {
    const n = readdirSync(CONTENT_RECIPE_DIR).length;
    sources.push({ label: `content/recipe (${n} recipes)`, mtime: statSync(CONTENT_RECIPE_DIR).mtime.toISOString() });
  } else {
    sources.push({ label: "content/recipe", mtime: "MISSING", note: "sync Hugo content from the site repo" });
  }
  for (const p of SOURCE_FILES) {
    const label = `static/data/${basename(p)}`;
    sources.push(existsSync(p) ? { label, mtime: statSync(p).mtime.toISOString() } : { label, mtime: "MISSING" });
  }
  return sources;
}

function pbVersion(pbBin: string | undefined): string {
  if (!pbBin) return "unknown (operator mode)";
  try {
    const res = Bun.spawnSync([pbBin, "--version"], { cwd: REPO_ROOT });
    return res.stdout.toString().trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function gitHead(): Promise<string> {
  return new Promise<string>((resolve) => {
    execFile("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO_ROOT }, (err, stdout) => {
      resolve(err ? "unknown" : stdout.trim());
    });
  });
}

// --- Human gates ---
async function verifySuperuser(env: Record<string, string>, target: string): Promise<void> {
  const email = env.PB_ADMIN_EMAIL;
  const password = env.PB_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(`Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD in ${ENV_FILE}`);
  }
  const res = await fetch(`${target}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(
      `Superuser auth failed on ${target} (${res.status}) — the provisioned target must have a ` +
      `superuser matching PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD from scripts_dev/.env.local ` +
      `(provision it with: pocketbase superuser upsert).`,
    );
  }
}

async function contentGate(opts: { yes: boolean; contentSynced: boolean }): Promise<void> {
  const n = existsSync(CONTENT_RECIPE_DIR) ? readdirSync(CONTENT_RECIPE_DIR).length : 0;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📎 Human prerequisite — Hugo content sync`);
  console.log(`   content/recipe (${n} recipes) is the SOURCE of the recipe data.`);
  console.log(`   Sync it from the site repo (fetch) BEFORE this run — the pipeline`);
  console.log(`   migrates what is on disk, staleness is only caught afterwards.`);
  console.log(`   Latest local commit: see git log -1 -- content/recipe`);
  console.log(`${"─".repeat(60)}`);
  if (opts.contentSynced) {
    console.log(`   ✓ acknowledged via --content-synced\n`);
    return;
  }
  if (opts.yes || !process.stdin.isTTY) {
    throw new Error(
      `Hugo content sync not acknowledged — re-run with --content-synced after syncing ` +
      `content/recipe from the site repo (a --yes run never fabricates this ack).`,
    );
  }
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`   Is content/recipe synced? Type "yes" to continue: `)).trim().toLowerCase();
  rl.close();
  if (answer !== "yes" && answer !== "y") {
    throw new Error(`Aborted at the content-sync gate — sync content/recipe, then re-run.`);
  }
  console.log();
}

// --- Run report ---
function newRunStem(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  let stem = date;
  if (existsSync(join(RUNS_DIR, `${stem}.md`))) {
    stem = `${date}-${now.toTimeString().slice(0, 8).replace(/:/g, "")}`;
  }
  return stem;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function writeReport(opts: {
  stem: string;
  target: string;
  mode: string;
  cleanupTarget: string;
  versionInfo: [string, string][];
  sources: SourceInfo[];
  outcomes: StepOutcome[];
  validateSummary: string | null;
  verdict: "VERT" | "ROUGE";
  failure?: string;
}): string {
  const reportPath = join(RUNS_DIR, `${opts.stem}.md`);
  const totalMs = opts.outcomes.reduce((acc, o) => acc + o.durationMs, 0);
  const lines: string[] = [];

  lines.push(`# Migration run — ${opts.stem.replace(/-\d{6}$/, "")}`);
  lines.push("");
  lines.push(`- **Target** : ${opts.target} (${opts.mode})`);
  for (const [k, v] of opts.versionInfo) lines.push(`- **${k}** : ${v}`);
  lines.push(`- **Cleanup scope** : --target=${opts.cleanupTarget}`);
  lines.push(`- **Verdict global** : ${opts.verdict === "VERT" ? "✅ VERT" : "❌ ROUGE"}`);
  if (opts.failure) lines.push(`- **Échec** : ${opts.failure}`);
  lines.push("");

  lines.push(`## Sources`);
  lines.push("");
  lines.push(`| Source | mtime |`);
  lines.push(`| ------ | ----- |`);
  for (const s of opts.sources) {
    lines.push(`| ${s.label}${s.note ? ` (${s.note})` : ""} | ${s.mtime} |`);
  }
  lines.push("");

  lines.push(`## Steps`);
  lines.push("");
  lines.push(`| # | Step | Duration | Exit | Key counts |`);
  lines.push(`| - | ---- | -------- | ---- | ---------- |`);
  opts.outcomes.forEach((o, i) => {
    const counts = o.counts.map(([k, v]) => `${k}: ${v}`).join(", ") || (o.error ? o.error.slice(0, 120) : "—");
    lines.push(`| ${i + 1} | ${o.name} | ${fmtDuration(o.durationMs)} | ${o.exitCode ?? "?"} | ${counts} |`);
  });
  lines.push("");
  lines.push(`Total pipeline: ${fmtDuration(totalMs)}. Per-step logs: \`scripts_dev/runs/${opts.stem}-logs/\`.`);
  lines.push("");

  const verdictCounts = opts.outcomes.flatMap((o) => o.counts).filter(([k]) => k === "verdicts emitted" || k.startsWith("  "));
  if (verdictCounts.length > 0) {
    lines.push(`## Verdicts émis (pb-import/expected-verdicts.json — artefact)`);
    lines.push("");
    for (const [k, v] of verdictCounts) {
      if (k.startsWith("  ")) lines.push(`  - ${k.trim()} : ${v}`);
      else lines.push(`- ${k} : **${v}**`);
    }
    lines.push("");
  }

  if (opts.validateSummary) {
    lines.push(`## Récap validate`);
    lines.push("");
    lines.push("```");
    lines.push(opts.validateSummary);
    lines.push("```");
    lines.push("");
  }

  writeFileSync(reportPath, lines.join("\n") + "\n");
  return reportPath;
}

// --- Main ---
const args = parseArgs();
// Resolved in main() — after --help / arg validation — so a --help run never
// requires .env.local to exist.
let TARGET = "http://127.0.0.1:8090";

function printHelp(): void {
  console.log(
    `migrate.ts — full Appwrite → PocketBase migration pipeline + run report

Chains: preflight → cleanup --target=all → transforms (2, 2b, 2c, 2d) →
import (3) → stop PB → 4-fix-timestamps → start PB → validate → report.
Fail-fast: a failing step stops the run, the report is written anyway,
exit code is 0 (VERT) only when every step passed and validate is green.

Usage:
  bun run scripts_dev/migrate.ts [options]

Options:
  --yes                 Non-interactive run (forwards --yes to cleanup-pb).
                        Does NOT ack the Hugo content sync: unattended runs
                        must also pass --content-synced.
  --content-synced      Acknowledge content/recipe was synced from the site
                        repo before this run (human prerequisite — the
                        pipeline migrates what is on disk).
  --target=migrated|all Cleanup scope (default: all — reset contract).
  --pb-bin=<path>       Managed mode: PocketBase binary to spawn. Requires
                        --pb-dir. migrate.ts starts/stops the instance by
                        PID around the sqlite timestamp fix and never kills
                        anything it did not spawn.
  --pb-dir=<path>       Managed mode: pb_data directory of the target.
                        The dir must be provisioned: migrations applied and
                        empty, with a superuser matching .env.local
                        (pocketbase migrate up + superuser upsert).
  -h, --help            Show this help.

Target selection: PB_URL_OVERRIDE env > scripts_dev/.env.local PB_URL >
http://127.0.0.1:8090 (same convention as every pipeline script). Managed
mode requires an explicit port in the target URL.

Without --pb-bin/--pb-dir (operator mode) an already-running target is
required; the run then stops at 4-fix-timestamps until the instance
serving the target is stopped, and waits for its restart before validate.

Output: report at scripts_dev/runs/<date>.md, per-step logs in
scripts_dev/runs/<date>-logs/.

Prerequisites (full checklist in scripts_dev/doc_migrationPb.md):
  - scripts_dev/.env.local with PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD matching a
    superuser on the target;
  - fresh appwrite-export/*.json (1-export-appwrite.ts);
  - Hugo content synced (content/recipe is the source of recipes);
  - target pb_data provisioned: migrations applied and EMPTY — the pipeline
    contract is a full reset.
`,
  );
}

async function main(): Promise<number> {
  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.unknown.length > 0) {
    console.error(`❌ Unknown argument(s): ${args.unknown.join(", ")}`);
    console.error(`   Supported: --yes --content-synced --target=migrated|all --pb-bin=<path> --pb-dir=<path> --help`);
    return 1;
  }
  const env = loadEnv();
  TARGET = (process.env.PB_URL_OVERRIDE || env.PB_URL || "http://127.0.0.1:8090").replace(/\/+$/, "");
  const managed = Boolean(args.pbBin || args.pbDir);
  if (managed && (!args.pbBin || !args.pbDir)) {
    console.error(`❌ Managed mode requires BOTH --pb-bin=<path> and --pb-dir=<path>.`);
    return 1;
  }
  if (managed && !new URL(TARGET).port) {
    console.error(`❌ Managed mode needs an explicit port in the target URL (got ${TARGET}).`);
    return 1;
  }
  if (args.cleanupTarget !== "migrated" && args.cleanupTarget !== "all") {
    console.error(`❌ Invalid --target: ${args.cleanupTarget}. Use "migrated" or "all".`);
    return 1;
  }
  if (!existsSync(join(SCRIPTS_DIR, "2-transform-data.ts"))) {
    console.error(`❌ Pipeline scripts not found in ${SCRIPTS_DIR}`);
    return 1;
  }

  mkdirSync(RUNS_DIR, { recursive: true });
  const stem = newRunStem();
  pbLogsDir = join(RUNS_DIR, `${stem}-logs`);
  mkdirSync(pbLogsDir, { recursive: true });

  const mode = managed ? `managed: pb-bin=${args.pbBin}, pb-dir=${args.pbDir}` : "operator (external instance)";
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 migrate.ts — full migration pipeline`);
  console.log(`   target: ${TARGET} (${mode})`);
  console.log(`   report: scripts_dev/runs/${stem}.md`);
  console.log(`${"=".repeat(60)}`);

  const outcomes: StepOutcome[] = [];
  let validateSummary: string | null = null;
  let failure: string | undefined;
  let verdict: "VERT" | "ROUGE" = "ROUGE";

  const bun = process.execPath;
  const script = (f: string) => join(SCRIPTS_DIR, f);
  const pbStepEnv = { PB_URL_OVERRIDE: TARGET };
  const fixEnv = managed ? { ...pbStepEnv, PB_DB_PATH_OVERRIDE: join(args.pbDir!, "data.db") } : pbStepEnv;

  try {
    // Preflight — target reachable (managed: spawn it), superuser matches.
    if (managed) {
      outcomes.push(await startManagedPb(args.pbBin!, args.pbDir!, TARGET));
      if (!outcomes[outcomes.length - 1].ok) throw new Error("managed PocketBase failed to start");
    } else {
      const t0 = Date.now();
      if (!(await isUp(TARGET))) {
        outcomes.push(
          stepOutcome("preflight", `health probe ${TARGET}`, t0, 1, undefined, `target down — start PocketBase or use managed mode (--pb-bin/--pb-dir)`),
        );
        throw new Error(`target ${TARGET} is not reachable`);
      }
      outcomes.push(stepOutcome("preflight", `health probe ${TARGET}`, t0, 0, undefined));
    }
    {
      const t0 = Date.now();
      await verifySuperuser(env, TARGET);
      outcomes.push(stepOutcome("preflight", "superuser auth probe", t0, 0, undefined));
    }

    // Human gate — Hugo content sync.
    await contentGate(args);

    // 1. Cleanup (reset contract).
    outcomes.push(
      await runStep(
        "1-cleanup",
        `bun run scripts_dev/cleanup-pb.ts --target=${args.cleanupTarget} --yes`,
        [bun, script("cleanup-pb.ts"), `--target=${args.cleanupTarget}`, "--yes"],
        { env: pbStepEnv, extract: extractCleanup },
      ),
    );
    if (!outcomes[outcomes.length - 1].ok) throw new Error("cleanup failed");

    // 2. Transforms (pure file operations, no PB dependency).
    const transformSteps: [string, string][] = [
      ["2-transform-data", "2-transform-data.ts"],
      ["2b-transform-recipes", "2b-transform-recipes.ts"],
      ["2c-transform-ingredients", "2c-transform-ingredients.ts"],
      ["2d-transform-catalog", "2d-transform-catalog.ts"],
    ];
    for (const [name, file] of transformSteps) {
      outcomes.push(await runStep(name, `bun run scripts_dev/${file}`, [bun, script(file)]));
      if (!outcomes[outcomes.length - 1].ok) throw new Error(`${name} failed`);
    }
    // Inventory of what the transforms produced (counts + emitted verdicts).
    {
      const last = outcomes[outcomes.length - 1];
      last.counts.push(...collectImportDirCounts(), ...collectVerdictCounts());
    }

    // 3. Import (target must be empty — its own preflight enforces it).
    outcomes.push(
      await runStep("3-import", `bun run scripts_dev/3-import-pb.ts`, [bun, script("3-import-pb.ts")], {
        env: pbStepEnv,
        extract: extractImport,
      }),
    );
    if (!outcomes[outcomes.length - 1].ok) throw new Error("import failed");

    // 4. Timestamps — requires the target NOT served (WAL/sqlite safety).
    if (managed) {
      outcomes.push(await stopManagedPb());
      if (!outcomes[outcomes.length - 1].ok) throw new Error("failed to stop the managed instance");
    } else {
      const t0 = Date.now();
      if (await isUp(TARGET)) {
        outcomes.push(
          stepOutcome(
            "4-fix-timestamps",
            "bun run scripts_dev/4-fix-timestamps.ts",
            t0,
            1,
            undefined,
            `PocketBase is running on ${TARGET} — stop the instance serving this target first ` +
            `(or use managed mode --pb-bin/--pb-dir)`,
          ),
        );
        throw new Error("4-fix-timestamps requires the target to be stopped");
      }
    }
    outcomes.push(
      await runStep("4-fix-timestamps", `bun run scripts_dev/4-fix-timestamps.ts`, [bun, script("4-fix-timestamps.ts")], {
        env: fixEnv,
        extract: extractFix,
      }),
    );
    if (!outcomes[outcomes.length - 1].ok) throw new Error("4-fix-timestamps failed");

    // 5. Validate — target served again.
    if (managed) {
      outcomes.push(await startManagedPb(args.pbBin!, args.pbDir!, TARGET));
      if (!outcomes[outcomes.length - 1].ok) throw new Error("failed to restart the managed instance");
      outcomes[outcomes.length - 1].name = "pb-restart (managed)";
    } else {
      const t0 = Date.now();
      console.log(`\n⏳ Waiting for the target to be restarted on ${TARGET} (up to 120s)...`);
      try {
        await waitUp(TARGET, 120_000);
        outcomes.push(stepOutcome("pb-restart (operator)", "wait for external restart", t0, 0, undefined));
      } catch (err: any) {
        outcomes.push(
          stepOutcome("pb-restart (operator)", "wait for external restart", t0, 1, undefined, err.message),
        );
        throw new Error(`validate requires the target up — restart the instance serving ${TARGET}`);
      }
    }
    {
      const step = await runStep("5-validate", `bun run scripts_dev/validate-migration.ts`, [bun, script("validate-migration.ts")], {
        env: pbStepEnv,
        extract: extractValidate,
      });
      validateSummary = validateSummaryBlock(readFileSync(step.logFile!, "utf-8"));
      outcomes.push(step);
      if (!step.ok) throw new Error("validation failed — see the récap in the report");
    }

    verdict = "VERT";
  } catch (err: any) {
    failure = err?.message ?? String(err);
    console.error(`\n❌ ${failure}`);
  } finally {
    disposeManagedPb();
    const reportPath = writeReport({
      stem,
      target: TARGET,
      mode,
      cleanupTarget: args.cleanupTarget,
      versionInfo: [
        ["PocketBase", pbVersion(args.pbBin)],
        ["Bun", Bun.version],
        ["Git HEAD", await gitHead()],
      ],
      sources: collectSources(),
      outcomes,
      validateSummary,
      verdict,
      failure,
    });
    console.log(`\n📝 Run report: ${reportPath}`);
    console.log(`🏁 Verdict: ${verdict}`);
  }

  return verdict === "VERT" ? 0 : 1;
}

// The managed child must never outlive the orchestrator, whatever the exit path.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    disposeManagedPb();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("Fatal:", err);
      disposeManagedPb();
      process.exit(1);
    });
}
