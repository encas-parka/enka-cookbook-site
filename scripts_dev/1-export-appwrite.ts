/**
 * 1-export-appwrite.ts — Export all Appwrite data to local JSON files
 *
 * Uses fetch HTTP (no SDK) to call Appwrite REST API directly.
 * This returns ALL fields including relations and JSON — unlike the CLI.
 *
 * Usage:
 *   bun run scripts_dev/1-export-appwrite.ts
 *
 * Requires: scripts_dev/.env.local with Appwrite API key
 * Outputs:  scripts_dev/appwrite-export/*.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// --- Config ---
const ENV_FILE = join(import.meta.dir, ".env.local");
const EXPORT_DIR = join(import.meta.dir, "appwrite-export");
const DB_ID = "689d15b10003a5a13636";
const PAGE_SIZE = 500;

// Collections to export (Appwrite collection ID → output file name)
// NOTE: Appwrite 1.8.1 uses /collections/{id}/documents (NOT /tables/{id}/rows)
const COLLECTIONS: { id: string; name: string }[] = [
  { id: "main", name: "events" },
  { id: "products", name: "products" },
  { id: "purchases", name: "purchases" },
  { id: "materiel", name: "materiel" },
  { id: "event_materiel", name: "event_materiel" },
  { id: "materiel_loan", name: "materiel_loan" },
  { id: "teamdocs", name: "teamdocs" },
  { id: "eventTodo", name: "event_todos" },
  { id: "share_links", name: "share_links" },
  { id: "locks", name: "locks" },
  { id: "user_notifications", name: "user_notifications" },
];

// --- Env loading ---

function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) {
    console.error(`❌ Missing ${ENV_FILE}. Create it with Appwrite API key and PB credentials.`);
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

// --- Helpers ---

function makeHeaders(projectId: string, apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Appwrite-Project": projectId,
    "X-Appwrite-Key": apiKey,
  };
}

async function appwriteFetch(
  endpoint: string,
  path: string,
  headers: Record<string, string>,
  params?: Record<string, string>
): Promise<any> {
  const url = new URL(`${endpoint}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Appwrite API ${res.status} on ${path}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

interface PaginatedResult {
  total: number;
  [key: string]: any;
}

async function fetchAll(
  endpoint: string,
  path: string,
  headers: Record<string, string>,
  dataKey: string
): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;

  while (true) {
    // Appwrite 1.8.1 requires JSON query format for limit/offset
    const params = new URLSearchParams();
    params.append("queries[]", JSON.stringify({ method: "limit", values: [PAGE_SIZE] }));
    params.append("queries[]", JSON.stringify({ method: "offset", values: [offset] }));

    const url = `${endpoint}${path}?${params.toString()}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Appwrite API ${res.status} on ${path}: ${(await res.text()).slice(0, 500)}`);
    }
    const result: PaginatedResult = await res.json();

    const items = result[dataKey] || [];
    all.push(...items);

    const total = result.total || 0;
    if (all.length >= total || items.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
    console.log(`   ⏳ ${all.length}/${total}...`);
  }

  return all;
}

function makeMeta(source: string, env: Record<string, string>) {
  return {
    exportedAt: new Date().toISOString(),
    source,
    appwriteEndpoint: env.APPWRITE_ENDPOINT || env.APPWRITE_ENDPOINT_PROD,
    projectId: env.APPWRITE_PROJECT_ID || env.APPWRITE_PROJECT_ID_PROD,
  };
}

function saveJson(name: string, data: any): void {
  const path = join(EXPORT_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// --- Main ---

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📤 1-export-appwrite.ts — Export Appwrite → JSON (fetch HTTP)`);
  console.log(`${"=".repeat(60)}\n`);

  const env = loadEnv();
  const endpoint = env.APPWRITE_ENDPOINT || env.APPWRITE_ENDPOINT_PROD;
  const projectId = env.APPWRITE_PROJECT_ID || env.APPWRITE_PROJECT_ID_PROD;
  const apiKey = env.APPWRITE_API_KEY || env.APPWRITE_API_KEY_PROD;

  if (!endpoint || !projectId || !apiKey) {
    console.error("❌ Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID or APPWRITE_API_KEY in .env.local");
    process.exit(1);
  }

  const headers = makeHeaders(projectId, apiKey);
  const source = endpoint.includes("cloud.appwrite.io") ? "dev" : "prod";

  mkdirSync(EXPORT_DIR, { recursive: true });

  // Quick connectivity test
  console.log("🔗 Testing Appwrite API connection...");
  try {
    await appwriteFetch(endpoint, "/users", headers, { limit: "1" });
    console.log(`   ✅ Connected to ${endpoint} (project: ${projectId})\n`);
  } catch (err: any) {
    console.error(`   ❌ Connection failed: ${err.message}`);
    process.exit(1);
  }

  // 1. Export users
  console.log("📥 Exporting users...");
  const users = await fetchAll(endpoint, "/users", headers, "users");
  saveJson("users", { _meta: makeMeta(source, env), total: users.length, users });
  console.log(`   ✅ ${users.length} users saved\n`);

  // 2. Export native teams + memberships
  console.log("📥 Exporting teams + memberships...");
  const teams = await fetchAll(endpoint, "/teams", headers, "teams");
  const teamsWithMembers = [];

  for (const team of teams) {
    const memberships = await fetchAll(
      endpoint,
      `/teams/${team.$id}/memberships`,
      headers,
      "memberships"
    );
    teamsWithMembers.push({ ...team, _memberships: memberships });
  }
  saveJson("teams", { _meta: makeMeta(source, env), total: teamsWithMembers.length, teams: teamsWithMembers });
  console.log(`   ✅ ${teamsWithMembers.length} teams (with memberships) saved\n`);

  // 3. Export all database collections
  for (const col of COLLECTIONS) {
    console.log(`📥 Exporting ${col.name} (${col.id})...`);
    try {
      const rows = await fetchAll(
        endpoint,
        `/databases/${DB_ID}/collections/${col.id}/documents`,
        headers,
        "documents"
      );
      saveJson(col.name, { _meta: makeMeta(source, env), total: rows.length, rows });
      console.log(`   ✅ ${rows.length} rows saved\n`);
    } catch (err: any) {
      console.error(`   ❌ Failed: ${err.message}\n`);
      saveJson(col.name, { _meta: makeMeta(source, env), total: 0, rows: [], error: String(err) });
    }
  }

  // 4. Summary
  console.log(`${"=".repeat(60)}`);
  console.log(`📊 Export complete. Files in ${EXPORT_DIR}/\n`);

  const files = import("fs").then((fs) => {
    const jsonFiles = fs.readdirSync(EXPORT_DIR).filter((f: string) => f.endsWith(".json"));
    for (const f of jsonFiles.sort()) {
      const content = JSON.parse(fs.readFileSync(join(EXPORT_DIR, f), "utf-8"));
      const count = content.users?.length || content.teams?.length || content.rows?.length || 0;
      const label = f.padEnd(28);
      console.log(`   ${label} ${String(count).padStart(5)} records`);
    }
  });

  await files;
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
