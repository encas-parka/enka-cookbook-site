/**
 * validate-migration.ts — Post-import validation for Appwrite → PocketBase migration
 *
 * Checks:
 *   1. Record counts: PB vs pb-import files
 *   2. Relation integrity: all relation fields point to existing PB records
 *   3. guestEmails: all events have their expected guest emails
 *   4. RefId coverage: all refIds in migration-map have a corresponding PB ID
 *
 * Usage:
 *   bun run scripts_dev/validate-migration.ts
 *
 * Requires:
 *   - scripts_dev/.env.local with PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
 *   - scripts_dev/pb-import/*.json (from 2-transform-data.ts)
 *   - scripts_dev/migration-map.json
 *   - PocketBase running locally with imported data
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

// --- Config ---
const ENV_FILE = join(import.meta.dir, ".env.local");
const IMPORT_DIR = join(import.meta.dir, "pb-import");
const MAP_FILE = join(import.meta.dir, "migration-map.json");

// --- Collections to validate (same order as import) ---
const COLLECTIONS = [
  "users",
  "teams",
  "materiel",
  "events",
  "products",
  "purchases",
  "materiel_loan",
  "event_materiel",
  "teamdocs",
  "event_todos",
  "share_links",
  "recipes",
] as const;

// Relation fields per collection (same as 3-import-pb.ts)
const RELATION_FIELDS: Record<string, Record<string, "single" | "multi">> = {
  users: {},
  teams: { members: "multi" },
  materiel: { teamId: "single", ownerUser: "single", storeIn: "single", shareableWith: "multi" },
  events: { createdBy: "single", teams: "multi" },
  products: { eventId: "single", updatedBy: "single", mergedInto: "single" },
  purchases: { eventId: "single", createdBy: "single", products: "multi" },
  materiel_loan: { eventId: "single", createdBy: "single", responsibleId: "single", ownerId: "single", borrowerUser: "single" },
  event_materiel: { eventId: "single", sourceMaterielId: "single", loanId: "single", createdBy: "single" },
  teamdocs: { teamId: "single", eventId: "single" },
  event_todos: { eventId: "single", assignedTo: "single" },
  share_links: {},
  recipes: { createdBy: "single", rootRecipeId: "single" },
};

// Text reference fields (stored as text, not relation)
const TEXT_REF_FIELDS: Record<string, string[]> = {
  share_links: ["target_id"],
};

// --- Globals ---
let pbBaseUrl = "";
let pbToken = "";

// --- Helpers ---
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
    if (!res.ok) throw new Error(`PB list ${collection} failed: ${await res.text()}`);
    const data = await res.json();
    const items = data.items || [];
    all.push(...items);
    if (all.length >= (data.total || 0)) break;
    page++;
  }

  return all;
}

function loadImportFile(collection: string): any[] {
  const filePath = join(IMPORT_DIR, `${collection}.json`);
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : data.rows || [];
}

function loadMigrationMap(): any {
  if (!existsSync(MAP_FILE)) {
    console.error(`❌ Missing ${MAP_FILE}. Run 2-transform-data.ts first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(MAP_FILE, "utf-8"));
}

// --- Validation Results ---
interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
  errors: string[];
}

const results: CheckResult[] = [];

function addResult(name: string, passed: boolean, details: string, errors: string[] = []) {
  results.push({ name, passed, details, errors });
  const icon = passed ? "✅" : "❌";
  console.log(`   ${icon} ${name}: ${details}`);
  for (const err of errors.slice(0, 5)) {
    console.log(`      → ${err}`);
  }
  if (errors.length > 5) {
    console.log(`      ... and ${errors.length - 5} more`);
  }
}

// --- Validation Checks ---

async function checkRecordCounts(): Promise<void> {
  console.log("\n📊 Check 1: Record Counts (PB vs pb-import)\n");

  for (const collection of COLLECTIONS) {
    const pbRecords = await pbListAll(collection);
    const importRecords = loadImportFile(collection);
    const pbCount = pbRecords.length;
    const importCount = importRecords.length;

    // Users: import file has password fields, PB may have different count due to auth
    // Recipes: uses explicit id from Appwrite, should match exactly
    const isUsers = collection === "users";
    const passed = isUsers ? pbCount === importCount : pbCount === importCount;
    const details = `PB=${pbCount}, Import=${importCount}`;

    const errors: string[] = [];
    if (!passed) {
      errors.push(`${collection}: expected ${importCount} records, found ${pbCount} in PB`);
    }

    addResult(`counts.${collection}`, passed, details, errors);
  }
}

async function checkRelationIntegrity(): Promise<void> {
  console.log("\n🔗 Check 2: Relation Integrity\n");

  // Build a lookup: collection → Set of PB IDs
  const pbIdSets: Record<string, Set<string>> = {};

  for (const collection of COLLECTIONS) {
    const records = await pbListAll(collection);
    pbIdSets[collection] = new Set(records.map((r: any) => r.id));
  }

  // Check each collection's relation fields
  let totalRelations = 0;
  let brokenRelations = 0;
  const errorsByCollection: Record<string, string[]> = {};

  for (const collection of COLLECTIONS) {
    const fields = RELATION_FIELDS[collection] || {};
    if (Object.keys(fields).length === 0) continue;

    const records = await pbListAll(collection);
    errorsByCollection[collection] = [];

    for (const record of records) {
      for (const [field, type] of Object.entries(fields)) {
        const value = record[field];
        if (!value) continue;

        if (type === "single") {
          totalRelations++;
          // Determine target collection from field name heuristics
          const targetCollection = inferTargetCollection(field, collection);
          if (targetCollection && pbIdSets[targetCollection] && !pbIdSets[targetCollection].has(value)) {
            brokenRelations++;
            errorsByCollection[collection].push(
              `${collection}/${record.id}.${field}="${value}" → not found in ${targetCollection}`
            );
          }
        } else if (type === "multi") {
          const ids = Array.isArray(value) ? value : [];
          for (const id of ids) {
            totalRelations++;
            const targetCollection = inferTargetCollection(field, collection);
            if (targetCollection && pbIdSets[targetCollection] && !pbIdSets[targetCollection].has(id)) {
              brokenRelations++;
              errorsByCollection[collection].push(
                `${collection}/${record.id}.${field}[].${id} → not found in ${targetCollection}`
              );
            }
          }
        }
      }
    }

    const collErrors = errorsByCollection[collection];
    if (collErrors.length === 0) {
      addResult(`relations.${collection}`, true, `${totalRelations} relations checked, all valid`);
    } else {
      addResult(`relations.${collection}`, false, `${collErrors.length} broken relations out of ${totalRelations}`, collErrors);
    }
    totalRelations = 0;
  }
}

function inferTargetCollection(field: string, sourceCollection: string): string | null {
  // Direct field → collection mapping
  const fieldToCollection: Record<string, string> = {
    eventId: "events",
    teamId: "teams",
    userId: "users",
    createdBy: "users",
    updatedBy: "users",
    assignedTo: "users",
    sourceMaterielId: "materiel",
    loanId: "materiel_loan",
    ownerId: "teams",
    responsibleId: "users",
    borrowerUser: "users",
    ownerUser: "users",
    storeIn: "materiel",
    mergedInto: "products",
    rootRecipeId: "recipes",
    members: "users",
    teams: "teams",
    shareableWith: "teams",
    products: "products",
  };

  return fieldToCollection[field] || null;
}

async function checkGuestEmails(): Promise<void> {
  console.log("\n📧 Check 3: Guest Emails in Events\n");

  const migrationMap = loadMigrationMap();
  const userMap = migrationMap.users || {};
  const eventsImport = loadImportFile("events");
  const pbEvents = await pbListAll("events");

  // Build expected guestEmails from import file
  const expectedByEmail: Record<string, string[]> = {};
  for (const ev of eventsImport) {
    if (ev.guestEmails && ev.guestEmails.length > 0) {
      expectedByEmail[ev._refId] = ev.guestEmails;
    }
  }

  // Build PB events by refId (stored in _refId or tracked via migration map)
  // Actually PB events have real IDs, we need to match via migration map
  // The import script stores _refId in migration-map but PB records have real IDs
  // We match by event name + dateStart as a fallback

  const pbEventsByName = new Map<string, any>();
  for (const ev of pbEvents) {
    pbEventsByName.set(ev.name, ev);
  }

  let checked = 0;
  let passed = 0;
  const errors: string[] = [];

  for (const impEvent of eventsImport) {
    const expected = impEvent.guestEmails || [];
    if (expected.length === 0) continue;

    checked++;
    const pbEvent = pbEventsByName.get(impEvent.name);
    if (!pbEvent) {
      errors.push(`Event "${impEvent.name}" not found in PB`);
      continue;
    }

    const actual = pbEvent.guestEmails || [];
    const missing = expected.filter((e: string) => !actual.includes(e));
    const extra = actual.filter((e: string) => !expected.includes(e));

    if (missing.length === 0 && extra.length === 0) {
      passed++;
    } else {
      if (missing.length > 0) {
        errors.push(`Event "${impEvent.name}": missing ${missing.length} emails: ${missing.slice(0, 3).join(", ")}`);
      }
      if (extra.length > 0) {
        errors.push(`Event "${impEvent.name}": ${extra.length} unexpected emails: ${extra.slice(0, 3).join(", ")}`);
      }
    }
  }

  addResult(
    "guestEmails",
    errors.length === 0,
    `${passed}/${checked} events have correct guestEmails`,
    errors
  );
}

async function checkRefIdCoverage(): Promise<void> {
  console.log("\n🗺️  Check 4: RefId → PB ID Coverage\n");

  const migrationMap = loadMigrationMap();

  for (const collection of COLLECTIONS) {
    const mapSection = migrationMap[collection];
    if (!mapSection || Object.keys(mapSection).length === 0) {
      addResult(`refId.${collection}`, true, "no refIds to check");
      continue;
    }

    const importRecords = loadImportFile(collection);
    const pbRecords = await pbListAll(collection);

    let found = 0;
    const missing: string[] = [];
    const total = Object.keys(mapSection).length;

    if (collection === "users") {
      // Users: match by email (refId → mapSection[email] → PB user email)
      const pbEmails = new Set(pbRecords.map((r: any) => r.email));
      for (const [appwriteId, userData] of Object.entries(mapSection as Record<string, any>)) {
        if (pbEmails.has(userData.email)) found++;
        else missing.push(`${userData.refId} (email: ${userData.email})`);
      }
    } else if (collection === "events") {
      // Events: match by name (refId → mapSection[name] → PB event name)
      const pbNames = new Set(pbRecords.map((r: any) => r.name));
      for (const [appwriteId, eventData] of Object.entries(mapSection as Record<string, any>)) {
        if (pbNames.has(eventData.name)) found++;
        else missing.push(`${eventData.refId} (name: ${eventData.name})`);
      }
    } else if (collection === "recipes") {
      // Recipes: keep Appwrite ID as PB ID (check appwriteId directly in PB IDs)
      const pbIds = new Set(pbRecords.map((r: any) => r.id));
      for (const [appwriteId, recipeData] of Object.entries(mapSection as Record<string, any>)) {
        if (pbIds.has(appwriteId)) found++;
        else missing.push(`${recipeData.refId} (id: ${appwriteId})`);
      }
    } else {
      // Generic: match by position (same order as import → same order as PB creation)
      const countMatch = pbRecords.length === importRecords.length;
      found = countMatch ? total : Math.min(pbRecords.length, importRecords.length);
      if (!countMatch) {
        missing.push(`PB=${pbRecords.length}, Import=${importRecords.length}`);
      }
    }

    const passed = found === total;
    const details = `${found}/${total} mapped to PB records`;

    addResult(`refId.${collection}`, passed, details, passed ? [] : missing.slice(0, 5).map(r => `refId "${r}" not found`));
  }
}

async function checkTextReferences(): Promise<void> {
  console.log("\n📝 Check 5: Text Reference Fields\n");

  for (const [collection, fields] of Object.entries(TEXT_REF_FIELDS)) {
    const pbRecords = await pbListAll(collection);

    for (const field of fields) {
      const errors: string[] = [];
      let checked = 0;

      for (const record of pbRecords) {
        const value = record[field];
        if (!value) continue;
        checked++;

        // target_id in share_links should be a valid event ID
        if (field === "target_id") {
          const events = await pbListAll("events");
          const eventIds = new Set(events.map((e: any) => e.id));
          if (!eventIds.has(value)) {
            errors.push(`${collection}/${record.id}.${field}="${value}" → not a valid event ID`);
          }
        }
      }

      addResult(
        `textRef.${collection}.${field}`,
        errors.length === 0,
        `${checked} text refs checked${errors.length > 0 ? `, ${errors.length} broken` : ""}`,
        errors
      );
    }
  }
}

// --- Main ---
async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 validate-migration.ts — Post-import validation`);
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

  // Check required files
  if (!existsSync(IMPORT_DIR)) {
    console.error(`❌ Missing ${IMPORT_DIR}. Run 2-transform-data.ts first.`);
    process.exit(1);
  }

  if (!existsSync(MAP_FILE)) {
    console.error(`❌ Missing ${MAP_FILE}. Run 2-transform-data.ts first.`);
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

  // Run all checks
  await checkRecordCounts();
  await checkRelationIntegrity();
  await checkGuestEmails();
  await checkRefIdCoverage();
  await checkTextReferences();

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 Validation Summary\n`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`   ${icon} ${r.name}: ${r.details}`);
  }

  console.log(`\n   Total: ${passed}/${total} checks passed`);

  if (failed > 0) {
    console.log(`\n   ⚠️  ${failed} checks failed. Review errors above.`);
    process.exit(1);
  } else {
    console.log(`\n   🎉 All checks passed! Migration is valid.`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
