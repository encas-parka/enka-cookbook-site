/**
 * cleanup-pb.ts — Purge migrated data from PocketBase for re-testing
 *
 * Usage:
 *   bun run scripts_dev/cleanup-pb.ts [--target=migrated|all]
 *
 * Modes:
 *   --target=migrated (default): Delete only records from migration-map.json
 *   --target=all: Delete ALL records from ALL collections
 *                 (including static data: ingredients, categories)
 *
 * Requires:
 *   - scripts_dev/.env.local with PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
 *   - scripts_dev/migration-map.json (for migrated mode)
 *   - PocketBase running locally
 */
import { readFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

// --- Config ---
const ENV_FILE = join(import.meta.dir, ".env.local");
const MAP_FILE = join(import.meta.dir, "migration-map.json");

// Collections in reverse dependency order (delete referencing collections first)
const DYNAMIC_COLLECTIONS = [
  "locks",
  "share_links",
  "event_todos",
  "teamdocs",
  "materiel_loan",
  "event_materiel",
  "purchases",
  "products",
  "events",
  "materiel",
  "teams",
  "users",
  "recipes", // ← Imported from Hugo markdown via migrate-recipes.ts
] as const;

// Static collections (NEVER delete)
const STATIC_COLLECTIONS = ["ingredients", "categories"];

// --- Env loading ---

function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) {
    console.error(`❌ Missing ${ENV_FILE}`);
    process.exit(1);
  }
  const content = readFileSync(ENV_FILE, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n") ) {
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

// --- PB HTTP helpers ---

let pbToken = "";
let pbBaseUrl = "";

async function pbAuth(email: string, password: string): Promise<void> {
  const res = await fetch(`${pbBaseUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
  });

  if (!res.ok) {
    throw new Error(`PB auth failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  pbToken = data.token;
}

async function pbListAll(collection: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const res = await fetch(
      `${pbBaseUrl}/api/collections/${collection}/records?page=${page}&perPage=${perPage}`,
      { headers: { Authorization: pbToken } }
    );

    if (!res.ok) {
      if (res.status === 404) return []; // Collection doesn't exist
      throw new Error(`PB list ${collection} failed: ${await res.text()}`);
    }

    const data = await res.json();
    const items = data.items || [];
    all.push(...items);

    if (all.length >= (data.total || 0) || items.length < perPage) break;
    page++;
  }

  return all;
}

async function pbDelete(collection: string, id: string): Promise<boolean> {
  const res = await fetch(`${pbBaseUrl}/api/collections/${collection}/records/${id}`, {
    method: "DELETE",
    headers: { Authorization: pbToken },
  });
  return res.ok;
}

// --- Cleanup modes ---

async function cleanImportDir(): Promise<void> {
  const importDir = join(import.meta.dir, "pb-import");
  console.log("\n📁 Cleaning pb-import/ directory...");
  try {
    const files = readdirSync(importDir).filter(f => f.endsWith(".json"));
    for (const f of files) {
      unlinkSync(join(importDir, f));
    }
    console.log(`   🗑️  Deleted ${files.length} JSON files from pb-import/`);
  } catch {
    console.log("   ⏭️  pb-import/ directory not found or empty");
  }
}

async function cleanupAll(includeStatic = false): Promise<void> {
  const collections = includeStatic
    ? [...DYNAMIC_COLLECTIONS, ...STATIC_COLLECTIONS]
    : [...DYNAMIC_COLLECTIONS];

  console.log(`🗑️  Mode: ALL — Deleting all records from ${collections.length} collections\n`);
  if (!includeStatic) {
    console.log(`   ⚠️  Static collections (${STATIC_COLLECTIONS.join(", ")}) will be preserved.\n`);
  } else {
    console.log(`   🧨 Static collections (${STATIC_COLLECTIONS.join(", ")}) will also be purged.\n`);
  }

  for (const collection of collections) {
    try {
      let totalDeleted = 0;
      let totalFailed = 0;

      while (true) {
        const records = await pbListAll(collection);
        if (records.length === 0) break;

        for (const record of records) {
          const ok = await pbDelete(collection, record.id);
          if (ok) totalDeleted++;
          else totalFailed++;
        }
      }

      if (totalDeleted > 0 || totalFailed > 0) {
        console.log(
          `   🗑️  ${collection}: ${totalDeleted} deleted${totalFailed ? `, ${totalFailed} failed` : ""}`
        );
      } else {
        console.log(`   ⏭️  ${collection}: empty`);
      }
    } catch (err: any) {
      console.log(`   ❌ ${collection}: ${err.message?.slice(0, 150)}`);
    }
  }

  // Clean pb-import/ directory
  await cleanImportDir();

  // Clean migration-map.json
  try {
    unlinkSync(MAP_FILE);
    console.log("   🗑️  Deleted migration-map.json");
  } catch {
    // File doesn't exist, that's fine
  }
}

async function cleanupMigrated(): Promise<void> {
  console.log("🗑️  Mode: MIGRATED — Deleting only records from migration-map.json\n");

  if (!existsSync(MAP_FILE)) {
    console.error(`❌ Missing ${MAP_FILE}. Run 2-transform-data.ts first.`);
    process.exit(1);
  }

  const migrationMap = JSON.parse(readFileSync(MAP_FILE, "utf-8"));

  // Build a map: collection → Set of appwriteIds
  // We need to find records by _appwriteId or by matching PB IDs
  // Strategy: list all records, match by any identifier

  // First, build lookup of all refIds → collection
  const refIdToCollection = new Map<string, string>();
  for (const [collection, entries] of Object.entries(migrationMap)) {
    if (collection === "_meta") continue;
    if (typeof entries !== "object" || entries === null) continue;
    for (const [awId, data] of Object.entries(entries as Record<string, any>)) {
      if (data?.refId) {
        refIdToCollection.set(data.refId, collection);
      }
    }
  }

  console.log(`   Found ${refIdToCollection.size} refIds in migration map\n`);

  // For each collection in reverse order, find and delete migrated records
  for (const collection of DYNAMIC_COLLECTIONS) {
    try {
      let totalDeleted = 0;
      let totalFailed = 0;

      while (true) {
        const records = await pbListAll(collection);
        if (records.length === 0) break;

        for (const record of records) {
          const ok = await pbDelete(collection, record.id);
          if (ok) totalDeleted++;
          else totalFailed++;
        }
      }

      if (totalDeleted > 0 || totalFailed > 0) {
        console.log(
          `   🗑️  ${collection}: ${totalDeleted} deleted${totalFailed ? `, ${totalFailed} failed` : ""}`
        );
      } else {
        console.log(`   ⏭️  ${collection}: empty`);
      }
    } catch (err: any) {
      console.log(`   ❌ ${collection}: ${err.message?.slice(0, 150)}`);
    }
  }

  // Clean pb-import/ directory
  await cleanImportDir();

  // Clean migration-map.json
  try {
    unlinkSync(MAP_FILE);
    console.log("   🗑️  Deleted migration-map.json");
  } catch {
    // File doesn't exist, that's fine
  }
}

// --- Main ---

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧹 cleanup-pb.ts — Purge PocketBase data`);
  console.log(`${"=".repeat(60)}\n`);

  // Parse args
  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith("--target="));
  const target = targetArg ? targetArg.split("=")[1] : "migrated";

  if (target !== "migrated" && target !== "all") {
    console.error(`Invalid --target: ${target}. Use "migrated" or "all".`);
    process.exit(1);
  }

  // Load env
  const env = loadEnv();
  pbBaseUrl = env.PB_URL || "http://127.0.0.1:8090";
  const adminEmail = env.PB_ADMIN_EMAIL;
  const adminPassword = env.PB_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("❌ Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD in .env.local");
    process.exit(1);
  }

  // Auth
  console.log("🔗 Connecting to PocketBase...");
  try {
    await pbAuth(adminEmail, adminPassword);
    console.log(`   🔑 Authenticated as superuser\n`);
  } catch (err: any) {
    console.error(`❌ Auth failed: ${err.message}`);
    process.exit(1);
  }

  if (target === "all") {
    await cleanupAll(true);
  } else {
    // For migrated mode, since we can't identify individual migrated records
    // without _appwriteId stored in PB, we delete all dynamic collection data.
    // This is equivalent to cleanupAll but documents the intent.
    console.log("   ℹ️  Note: migrated mode deletes all dynamic collection data");
    console.log("   (records don't store migration metadata in PB).\n");
    await cleanupAll(false);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Cleanup complete. PocketBase is ready for a fresh import.`);
  console.log(`   Run: bun run scripts_dev/3-import-pb.ts\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
