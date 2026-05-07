/**
 * 3-import-pb.ts — Import PB-ready JSON into local PocketBase
 *
 * Creates records in dependency order, maps refIds → real PB IDs.
 * Uses fetch HTTP (no SDK dependency) for consistency with export.
 *
 * Usage:
 *   bun run scripts_dev/3-import-pb.ts
 *
 * Requires:
 *   - scripts_dev/.env.local with PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
 *   - scripts_dev/pb-import/*.json (from 2-transform-data.ts)
 *   - scripts_dev/migration-map.json
 *   - PocketBase running locally
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// --- Config ---
const ENV_FILE = join(import.meta.dir, ".env.local");
const IMPORT_DIR = join(import.meta.dir, "pb-import");
const MAP_FILE = join(import.meta.dir, "migration-map.json");

// Import order (dependencies first)
const COLLECTION_ORDER = [
  "users",
  "teams",
  "materiel",
  "events",
  "products",
  "purchases",
  "materiel_loan",   // before event_materiel — loanId relation
  "event_materiel",  // references materiel_loan via loanId
  "teamdocs",
  "event_todos",
  "share_links",
  "ingredients",     // no dependencies
  "categories",      // no dependencies
  "recipes",         // depends on users (createdBy) and categories
] as const;

// Fields configuration per collection for refId remapping
// 'single' = single relation field, 'multi' = array of relations
const RELATION_FIELDS: Record<string, Record<string, "single" | "multi">> = {
  users: {},
  teams: { members: "multi" },
  materiel: { teamId: "single", ownerUser: "single", storeIn: "single", shareableWith: "multi" },
  events: { createdBy: "single", teams: "multi", guestUsers: "multi" },
  products: { eventId: "single", updatedBy: "single", mergedInto: "single" },
  purchases: { eventId: "single", createdBy: "single", products: "multi" },
  event_materiel: { eventId: "single", sourceMaterielId: "single", loanId: "single", createdBy: "single", groupId: "single" },
  materiel_loan: { eventId: "single", createdBy: "single", responsibleId: "single", ownerId: "single", borrowerUser: "single" },
  teamdocs: { teamId: "single", eventId: "single" },
  event_todos: { eventId: "single", assignedTo: "single" },
  share_links: {}, // target_id is text, handled separately
  ingredients: {},
  categories: {},
  recipes: {
    createdBy: "single",
    permissionWrite: "multi",
    rootRecipeId: "single",
    teams: "multi",
  },
};

// JSON fields that may contain refIds (need string replacement)
const JSON_FIELDS: Record<string, string[]> = {
  users: [],
  teams: [],
  materiel: [],
  events: ["contributors", "todos", "date", "meals"],
  products: ["store", "specs", "stockReel", "who", "previousNames", "mergedFrom", "totalNeededOverride"],
  purchases: ["store"],
  event_materiel: ["specs"],
  materiel_loan: ["materiels"],
  teamdocs: [],
  event_todos: [],
  share_links: [],
  ingredients: [],
  categories: [],
  recipes: ["ingredients"],
};

// Text fields that contain refIds (not relations but need remapping)
const TEXT_REF_FIELDS: Record<string, string[]> = {
  share_links: ["target_id"],
};

// --- Env loading ---

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
  console.log(`   🔑 Authenticated as superuser\n`);
}

async function pbCreate(collection: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${pbBaseUrl}/api/collections/${collection}/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: pbToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PB create ${collection} failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

async function pbDelete(collection: string, id: string): Promise<boolean> {
  const res = await fetch(`${pbBaseUrl}/api/collections/${collection}/records/${id}`, {
    method: "DELETE",
    headers: { Authorization: pbToken },
  });
  return res.ok;
}

async function pbList(collection: string, page = 1, perPage = 500): Promise<{ items: any[]; total: number }> {
  const res = await fetch(
    `${pbBaseUrl}/api/collections/${collection}/records?page=${page}&perPage=${perPage}`,
    { headers: { Authorization: pbToken } }
  );
  if (!res.ok) throw new Error(`PB list ${collection} failed: ${await res.text()}`);
  const data = await res.json();
  return { items: data.items || [], total: data.total || 0 };
}

// --- RefId remapping ---

const refToPb = new Map<string, string>(); // refId → PB ID

function resolve(refId: string | null | undefined): string | null {
  if (!refId || refId === "") return null;
  return refToPb.get(refId) ?? null;
}

function resolveMulti(refIds: string[] | null | undefined): string[] {
  if (!refIds) return [];
  return refIds.map(resolve).filter((id): id is string => id !== null);
}

/** Replace all known refIds in a string with PB IDs */
function remapString(str: string): string {
  let result = str;
  for (const [refId, pbId] of refToPb) {
    result = result.replaceAll(refId, pbId);
  }
  return result;
}

/** Deep remap all refIds in an object's string values with PB IDs */
function remapObject(obj: any): any {
  if (typeof obj === "string") return remapString(obj);
  if (Array.isArray(obj)) return obj.map(remapObject);
  if (typeof obj === "object" && obj !== null) {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = remapObject(obj[key]);
    }
    return result;
  }
  return obj;
}

/** Process a record: resolve relation fields and remap JSON fields */
function processRecord(collection: string, record: any): { data: Record<string, any>; refId: string; appwriteId: string } {
  const { _refId, _appwriteId, _source, _sourceEvent, _orphan, ...rest } = record;

  const data = { ...rest };
  const rels = RELATION_FIELDS[collection] || {};
  const jsons = JSON_FIELDS[collection] || [];
  const textRefs = TEXT_REF_FIELDS[collection] || [];

  // Resolve simple/multi relation fields
  for (const [field, type] of Object.entries(rels)) {
    if (data[field] === undefined || data[field] === null) continue;
    if (type === "single") {
      data[field] = resolve(data[field]);
    } else {
      const resolved = resolveMulti(data[field]);
      data[field] = resolved.length > 0 ? resolved : null;
    }
  }

  // Remap text fields that contain refIds
  for (const field of textRefs) {
    if (typeof data[field] === "string") {
      data[field] = resolve(data[field]) || remapString(data[field]);
    }
  }

  // Remap JSON fields — handles strings, arrays of strings, arrays of objects, and nested objects
  for (const field of jsons) {
    const val = data[field];
    if (val === null || val === undefined) continue;

    if (typeof val === "string") {
      data[field] = remapString(val);
    } else if (Array.isArray(val)) {
      data[field] = val.map((item: any) => {
        if (typeof item === "string") return remapString(item);
        if (typeof item === "object" && item !== null) return remapObject(item);
        return item;
      });
    } else if (typeof val === "object") {
      data[field] = remapObject(val);
    }
  }

  return { data, refId: _refId || "", appwriteId: _appwriteId || "" };
}

// --- Import functions ---

async function importCollection(collection: string): Promise<{ created: number; failed: number }> {
  const filePath = join(IMPORT_DIR, `${collection}.json`);
  if (!existsSync(filePath)) {
    console.log(`   ⏭️  No ${collection}.json — skipping`);
    return { created: 0, failed: 0 };
  }

  const records: any[] = JSON.parse(readFileSync(filePath, "utf-8"));
  if (records.length === 0) {
    console.log(`   ⏭️  ${collection}.json is empty — skipping`);
    return { created: 0, failed: 0 };
  }

  let created = 0;
  let failed = 0;

  for (const record of records) {
    const { data, refId } = processRecord(collection, record);

    try {
      const result = await pbCreate(collection, data);
      if (refId) {
        refToPb.set(refId, result.id);
      }
      created++;
    } catch (err: any) {
      failed++;
      const errMsg = err.message?.slice(0, 200) || String(err);
      console.log(`   ❌ ${collection} [${refId}]: ${errMsg}`);
    }
  }

  return { created, failed };
}

// Special import for users (auth collection requires passwordConfirm)
async function importUsers(): Promise<{ created: number; failed: number }> {
  const filePath = join(IMPORT_DIR, "users.json");
  if (!existsSync(filePath)) {
    console.log(`   ⏭️  No users.json — skipping`);
    return { created: 0, failed: 0 };
  }

  const records: any[] = JSON.parse(readFileSync(filePath, "utf-8"));
  let created = 0;
  let failed = 0;

  for (const record of records) {
    const { data, refId, appwriteId } = processRecord("users", record);

    try {
      const result = await pbCreate("users", data);
      if (refId) {
        refToPb.set(refId, result.id);
      }
      created++;
    } catch (err: any) {
      failed++;
      const errMsg = err.message?.slice(0, 200) || String(err);
      console.log(`   ❌ user [${appwriteId}]: ${errMsg}`);
    }
  }

  return { created, failed };
}

// --- Main ---

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📥 3-import-pb.ts — Import PB-ready JSON → PocketBase`);
  console.log(`${"=".repeat(60)}\n`);

  // Load env
  const env = loadEnv();
  pbBaseUrl = env.PB_URL || "http://127.0.0.1:8090";
  const adminEmail = env.PB_ADMIN_EMAIL;
  const adminPassword = env.PB_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("❌ Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD in .env.local");
    process.exit(1);
  }

  // Check import files exist
  if (!existsSync(IMPORT_DIR)) {
    console.error(`❌ Missing ${IMPORT_DIR}. Run 2-transform-data.ts first.`);
    process.exit(1);
  }

  // Auth
  console.log("🔗 Connecting to PocketBase...");
  try {
    await pbAuth(adminEmail, adminPassword);
  } catch (err: any) {
    console.error(`❌ Auth failed: ${err.message}`);
    process.exit(1);
  }

  // Import in dependency order
  const results: Record<string, { created: number; failed: number }> = {};

  // Users first (special handling)
  console.log("📥 Importing users...");
  results.users = await importUsers();
  console.log(`   ✅ ${results.users.created} created, ${results.users.failed} failed\n`);

  // Then all other collections
  for (const collection of COLLECTION_ORDER.slice(1)) {
    console.log(`📥 Importing ${collection}...`);
    results[collection] = await importCollection(collection);
    console.log(`   ✅ ${results[collection].created} created, ${results[collection].failed} failed\n`);
  }

  // Summary
  console.log(`${"=".repeat(60)}`);
  console.log(`📊 Import Summary\n`);

  let totalCreated = 0;
  let totalFailed = 0;

  for (const collection of COLLECTION_ORDER) {
    const r = results[collection];
    if (!r) continue;
    totalCreated += r.created;
    totalFailed += r.failed;
    const label = (collection + ":").padEnd(18);
    console.log(`   ${label} ${String(r.created).padStart(5)} created${r.failed ? `, ${r.failed} failed` : ""}`);
  }

  console.log(`\n   Total: ${totalCreated} created, ${totalFailed} failed`);
  console.log(`   RefId mapping: ${refToPb.size} entries`);

  if (totalFailed > 0) {
    console.log(`\n   ⚠️  Some records failed. Check errors above and retry.`);
  } else {
    console.log(`\n   ✅ All records imported successfully!`);
  }

  console.log(`\n   NEXT: Run validate-migration.ts to verify, or test the app.`);

  // Save refId → PB ID mapping for downstream scripts (e.g., 4-fix-timestamps.ts)
  const idMapPath = join(IMPORT_DIR, "id-map.json");
  const idMapObj: Record<string, string> = {};
  for (const [refId, pbId] of refToPb) {
    idMapObj[refId] = pbId;
  }
  writeFileSync(idMapPath, JSON.stringify(idMapObj, null, 2) + "\n");
  console.log(`   💾 Saved ID mapping (${refToPb.size} entries) → ${idMapPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
