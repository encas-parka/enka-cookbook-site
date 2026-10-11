/**
 * validate-migration.ts — Post-import validation for Appwrite → PocketBase migration
 *
 * Checks:
 *   1. Record counts: PB vs RAW sources (appwrite-export + Hugo content +
 *      static data) — every count deviation must be covered by a verdict
 *   2. Relation integrity: all relation fields point to existing PB records
 *   3. Recipe field population: createdBy/permissionWrite/rootRecipeId/created
 *      counts must match pb-import/recipes.json (import nullification regression)
 *   4. guestEmails: all events have their expected guest emails
 *   5. RefId coverage: all refIds in migration-map have a corresponding PB ID
 *   6. Text references (share_links.target_id)
 *   7. Recipe convergence: each Appwrite-native recipe (its $id IS the Hugo
 *      slug) is compared to its PB copy (imported from the Hugo markdown).
 *      Flat content divergence (title, draft, #ingredients, Σ normalizedQuantity,
 *      #astuces, preparation length) is blocking unless verdicted; updatedAt
 *      day drift is informative only (Hugo is the fresher source). Recipes of
 *      the Appwrite export absent from PB are inventoried and verdicted too.
 *   8. Structural invariants: teams.roles populated on every team;
 *      materiel.createdBy/ownerUser empty by design (team-scoped delete rules
 *      protect them — there is no backfill).
 *   9. teamdocs over-limit: docs absent from PB must be explained by the text
 *      field limit (PB applies a 5000-char default when the schema max is 0)
 *      and the absence is verdict-categorized while the product decision is
 *      open; the check is parametric — once the limit is raised and the doc
 *      re-imported, the stale verdict forces the verdict file refresh.
 *
 * Expected verdicts — machine-readable inventory of the deviations accepted
 * for this run, at pb-import/expected-verdicts.json. The transforms are
 * expected to emit it (hand-written is valid); cleanup-pb wipes it with the
 * rest of pb-import/*.json. Schema (version 1):
 *
 * {
 *   "version": 1,
 *   "verdicts": [
 *     { "type": "count-delta", "collection": "teamdocs", "delta": -1,
 *       "category": "teamdocs-content-over-limit", "reason": "…" },
 *     { "type": "absent-recipe", "slug": "a-test_…", "category": "test-recipe",
 *       "reason": "…" },
 *     { "type": "recipe-convergence", "slug": "tarte-tatin",
 *       "fields": ["draft", "sumQty"], "category": "content-drift-since-freeze",
 *       "reason": "…" }
 *   ]
 * }
 *
 * Matching is strict: count-delta matches the exact (collection, delta) pair;
 * absent-recipe the exact slug; recipe-convergence the exact slug with the
 * observed divergent fields ⊆ "fields". Each observed deviation must consume
 * exactly one verdict — leftover (stale) verdicts fail the run, and so does
 * any unverdicted deviation (counter exposed in the summary).
 *
 * Usage:
 *   bun run scripts_dev/validate-migration.ts
 *
 * Target selection (env, same convention as 3-import-pb.ts):
 *   PB_URL_OVERRIDE — base URL of the PB instance to validate; falls back to
 *                     .env.local PB_URL, then http://127.0.0.1:8090
 *
 * Requires:
 *   - scripts_dev/.env.local with PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
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
const EXPORT_DIR = join(import.meta.dir, "appwrite-export");
const VERDICTS_FILE = join(IMPORT_DIR, "expected-verdicts.json");
const HUGO_RECIPE_DIR = join(import.meta.dir, "..", "content", "recipe");
const INGREDIENTS_FILE = join(import.meta.dir, "..", "static", "data", "ingredients.json");
const RECIPE_INFO_FILE = join(import.meta.dir, "..", "static", "data", "recipe-info.json");

// --- Collections to validate (same order as import) ---
// ingredients + categories are Hugo-catalog collections: no relation fields,
// they join the counts check and the relation id-sets only.
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
  "ingredients",
  "categories",
] as const;

// Relation fields per collection (same as 3-import-pb.ts)
const RELATION_FIELDS: Record<string, Record<string, "single" | "multi">> = {
  users: {},
  teams: { members: "multi" },
  materiel: { teamId: "single", ownerUser: "single", storeIn: "single", shareableWith: "multi" },
  events: { createdBy: "single", teams: "multi", guestUsers: "multi" },
  products: { eventId: "single", updatedBy: "single", mergedInto: "single" },
  purchases: { eventId: "single", createdBy: "single", products: "multi" },
  materiel_loan: { eventId: "single", createdBy: "single", responsibleId: "single", ownerId: "single", borrowerUser: "single" },
  event_materiel: { eventId: "single", sourceMaterielId: "single", loanId: "single", createdBy: "single" },
  teamdocs: { teamId: "single", eventId: "single" },
  event_todos: { eventId: "single", assignedTo: "single" },
  share_links: { createdBy: "single" },
  recipes: { createdBy: "single", permissionWrite: "multi", rootRecipeId: "single", teams: "multi" },
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

const pbListCache = new Map<string, Promise<any[]>>();

// Memoized: data is static for the duration of a run and several checks
// consume the same lists.
function pbListAll(collection: string): Promise<any[]> {
  let req = pbListCache.get(collection);
  if (!req) {
    req = pbListAllFetch(collection);
    pbListCache.set(collection, req);
  }
  return req;
}

async function pbListAllFetch(collection: string): Promise<any[]> {
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
    if (all.length >= (data.totalItems || 0) || items.length < perPage) break;
    page++;
  }

  return all;
}

async function pbCount(collection: string): Promise<number> {
  const res = await fetch(
    `${pbBaseUrl}/api/collections/${collection}/records?perPage=1`,
    { headers: { Authorization: pbToken } }
  );
  if (!res.ok) throw new Error(`PB count ${collection} failed: ${await res.text()}`);
  const data = await res.json();
  return data.totalItems || 0;
}

function loadImportFile(collection: string): any[] {
  const filePath = join(IMPORT_DIR, `${collection}.json`);
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : data.rows || [];
}

// refId → PB id, written by 3-import at the end of a successful run. The
// pb-import records carry no id (except recipes): the deterministic id is
// assigned at import time, so id-map is THE way to resolve them.
function loadIdMap(): Record<string, string> {
  const idMapFile = join(IMPORT_DIR, "id-map.json");
  return existsSync(idMapFile) ? JSON.parse(readFileSync(idMapFile, "utf-8")) : {};
}

function loadMigrationMap(): any {
  if (!existsSync(MAP_FILE)) {
    console.error(`❌ Missing ${MAP_FILE}. Run 2-transform-data.ts first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(MAP_FILE, "utf-8"));
}

// --- Expected verdicts (machine-readable accepted deviations) ---
// Schema of pb-import/expected-verdicts.json: see the file header.
type ExpectedVerdict = {
  type: "count-delta" | "absent-recipe" | "recipe-convergence";
  collection?: string;
  delta?: number;
  slug?: string;
  fields?: string[];
  category?: string;
  reason?: string;
};

let verdicts: ExpectedVerdict[] = [];
const consumedVerdicts = new Set<number>();
let unverdictedDeviations = 0;

function loadVerdicts(): void {
  if (!existsSync(VERDICTS_FILE)) {
    console.log("   ℹ️  no expected-verdicts.json — every deviation will be unverdicted");
    return;
  }
  const parsed = JSON.parse(readFileSync(VERDICTS_FILE, "utf-8"));
  verdicts = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
  console.log(`   ℹ️  ${verdicts.length} expected verdict(s) loaded`);
}

function consumeVerdict(match: (v: ExpectedVerdict) => boolean): ExpectedVerdict | null {
  for (let i = 0; i < verdicts.length; i++) {
    if (!consumedVerdicts.has(i) && match(verdicts[i])) {
      consumedVerdicts.add(i);
      return verdicts[i];
    }
  }
  return null;
}

// Same deviation observed by several checks (e.g. a verdicted count delta
// also explains missing refId coverage): the first observer consumes the
// verdict, the others just peek it.
function peekVerdict(match: (v: ExpectedVerdict) => boolean): ExpectedVerdict | null {
  for (const v of verdicts) {
    if (match(v)) return v;
  }
  return null;
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

// A verdict that matches nothing means the verdict file is out of sync with
// reality (fixed data, re-import, raised limit…) — that must be refreshed.
function checkStaleVerdicts(): void {
  const stale: string[] = [];
  verdicts.forEach((v, i) => {
    if (consumedVerdicts.has(i)) return;
    if (v.type === "count-delta") {
      stale.push(`count-delta ${v.collection} ${formatDelta(v.delta ?? 0)} — no such count deviation observed`);
    } else if (v.type === "absent-recipe") {
      stale.push(`absent-recipe ${v.slug} — recipe is present in PB`);
    } else if (v.type === "recipe-convergence") {
      stale.push(`recipe-convergence ${v.slug} [${(v.fields || []).join(", ")}] — no such divergence observed`);
    } else {
      stale.push(`unknown verdict type "${v.type}"`);
    }
  });
  if (verdicts.length === 0) return;
  addResult(
    "verdicts.stale",
    stale.length === 0,
    stale.length === 0
      ? `${verdicts.length} verdict(s), all consumed`
      : `${stale.length} of ${verdicts.length} verdict(s) match nothing`,
    stale,
  );
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

// --- Raw sources → expected counts ---
function exportRows(name: string): any[] {
  const filePath = join(EXPORT_DIR, `${name}.json`);
  if (!existsSync(filePath)) {
    console.error(`❌ Missing ${filePath}. Run 1-export-appwrite.ts first.`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  if (Array.isArray(data)) return data;
  for (const key of ["rows", "users", "teams"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

// Malformed embedded todo strings cannot become records — the transform
// silently skips them, so they are not part of the expected count.
function countParseableTodos(todos: any): number {
  if (!Array.isArray(todos)) return 0;
  let n = 0;
  for (const t of todos) {
    try {
      JSON.parse(t);
      n++;
    } catch {
      // skipped by the transform too
    }
  }
  return n;
}

function computeSourceCounts(): Record<string, number> {
  const events = exportRows("events");
  const recipeInfo = JSON.parse(readFileSync(RECIPE_INFO_FILE, "utf-8"));
  return {
    users: exportRows("users").length,
    teams: exportRows("teams").length,
    materiel: exportRows("materiel").length,
    events: events.length,
    products: exportRows("products").length,
    purchases: exportRows("purchases").length,
    materiel_loan: exportRows("materiel_loan").length,
    event_materiel: exportRows("event_materiel").length,
    teamdocs: exportRows("teamdocs").length,
    // event_todos are extracted from events' embedded todos + standalone rows
    event_todos:
      events.reduce((sum: number, e: any) => sum + countParseableTodos(e.todos), 0) +
      exportRows("event_todos").length,
    share_links: exportRows("share_links").length,
    // recipes come from the Hugo content (2b), not from the Appwrite export
    recipes: readdirSync(HUGO_RECIPE_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).length,
    ingredients: JSON.parse(readFileSync(INGREDIENTS_FILE, "utf-8")).length,
    // regimes are intentionally not migrated (catalog transform)
    categories: (recipeInfo.materiel?.length || 0) + (recipeInfo.categories?.length || 0),
  };
}

async function checkCountsAgainstSources(): Promise<void> {
  console.log("\n📊 Check 1: Record Counts (PB vs raw sources)\n");

  const expected = computeSourceCounts();

  for (const collection of COLLECTIONS) {
    const pbTotal = await pbCount(collection);
    const sourceCount = expected[collection] ?? 0;
    const delta = pbTotal - sourceCount;
    const details = `PB=${pbTotal}, Sources=${sourceCount}`;

    if (delta === 0) {
      addResult(`counts.${collection}`, true, details);
      continue;
    }

    const verdict = consumeVerdict(
      (v) => v.type === "count-delta" && v.collection === collection && v.delta === delta
    );
    if (verdict) {
      addResult(`counts.${collection}`, true, `${details} — verdict: ${verdict.category}`);
      continue;
    }

    unverdictedDeviations++;
    const errors = [
      `${collection}: expected ${sourceCount} records from raw sources, found ${pbTotal} in PB (delta ${formatDelta(delta)})`,
    ];
    if (delta < 0) {
      errors.push(...(await sampleMissingRecords(collection)));
    }
    addResult(`counts.${collection}`, false, details, errors);
  }
}

// Best-effort naming of records the transform emitted but PB is missing
// (import drift — distinct from source-side skips, where pb-import == PB).
async function sampleMissingRecords(collection: string): Promise<string[]> {
  const idMap = loadIdMap();
  const pbIds = new Set((await pbListAll(collection)).map((r: any) => r.id));
  const missing = loadImportFile(collection).filter((r: any) => {
    const id = r.id || idMap[r._refId];
    return !id || !pbIds.has(id);
  });
  return missing
    .slice(0, 5)
    .map((r: any) => `${collection}: missing "${r.name || r.task || r.title || r._refId || r.id}"`);
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
    permissionWrite: "users",
    guestUsers: "users",
  };

  return fieldToCollection[field] || null;
}

// Fields whose population in pb-import/recipes.json must hold in PB too —
// guards against the import-time nullification of relations and empty timestamps
const RECIPE_POPULATION_FIELDS: { field: string; populated: (r: any) => boolean }[] = [
  { field: "created", populated: (r) => typeof r.created === "string" && r.created !== "" },
  { field: "createdBy", populated: (r) => typeof r.createdBy === "string" && r.createdBy !== "" },
  { field: "permissionWrite", populated: (r) => Array.isArray(r.permissionWrite) && r.permissionWrite.length > 0 },
  { field: "rootRecipeId", populated: (r) => typeof r.rootRecipeId === "string" && r.rootRecipeId !== "" },
];

async function checkRecipeFieldPopulation(): Promise<void> {
  console.log("\n🥗 Check 6: Recipe field population (import nullification regression)\n");

  const importRecords = loadImportFile("recipes");
  const pbRecords = await pbListAll("recipes");
  const pbById = new Map<string, any>(pbRecords.map((r: any) => [r.id, r]));

  const errors: string[] = [];
  const details: string[] = [];

  for (const { field, populated } of RECIPE_POPULATION_FIELDS) {
    const expectedIds = importRecords.filter((r) => populated(r)).map((r) => r.id);
    const missing = expectedIds.filter((id) => {
      const pb = pbById.get(id);
      return !pb || !populated(pb);
    });
    details.push(`${field}: ${expectedIds.length - missing.length}/${expectedIds.length}`);
    for (const id of missing.slice(0, 5)) {
      errors.push(`recipes/${id}.${field} populated in pb-import but empty or missing in PB`);
    }
    if (missing.length > 5) {
      errors.push(`... and ${missing.length - 5} more recipes with empty ${field}`);
    }
  }

  addResult("recipes.fieldPopulation", errors.length === 0, details.join(" · "), errors);
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

  // PB events carry generated ids — match via id-map.json (refId → PB id, saved by
  // 3-import). Matching by name is ambiguous: prod data has homonym events.
  const idMap = loadIdMap();
  const pbEventsById = new Map<string, any>();
  for (const ev of pbEvents) {
    pbEventsById.set(ev.id, ev);
  }

  let checked = 0;
  let passed = 0;
  const errors: string[] = [];

  for (const impEvent of eventsImport) {
    const expected = impEvent.guestEmails || [];
    if (expected.length === 0) continue;

    checked++;
    const pbEvent = pbEventsById.get(idMap[impEvent._refId]);
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

    if (!passed) {
      // A verdicted count deviation also covers the map entries that have no
      // PB record — same absence, observed from the counts side.
      const verdict = peekVerdict(
        (v) => v.type === "count-delta" && v.collection === collection && v.delta === found - total
      );
      if (verdict) {
        addResult(`refId.${collection}`, true, `${details} — verdict: ${verdict.category}`);
        continue;
      }
    }

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

// --- Recipe convergence (Appwrite export vs PB copy of the Hugo content) ---
function normDay(value: any): string {
  return value ? String(value).slice(0, 10) : "";
}

// Appwrite stores ingredient items as JSON-encoded strings (double-encoded
// pattern); PB (post 2b) has them native. Normalize both sides.
function ingredientStats(raw: any): { n: number; sum: number } {
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return { n: 0, sum: 0 };
  const objs = list.map((i: any) => (typeof i === "string" ? JSON.parse(i) : i));
  return {
    n: objs.length,
    sum: Math.round(objs.reduce((s: number, i: any) => s + (i.normalizedQuantity || 0), 0)),
  };
}

function jsonLen(raw: any): number {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return 0;
    }
  }
  return Array.isArray(v) ? v.length : 0;
}

async function checkRecipeConvergence(): Promise<void> {
  console.log("\n🥘 Check 7: Recipe convergence (Appwrite export vs PB/Hugo)\n");

  const awRecipes = exportRows("recipes");
  const pbRecipes = await pbListAll("recipes");
  const pbBySlug = new Map<string, any>(pbRecipes.map((r: any) => [r.id, r]));

  const absentSlugs: string[] = [];
  const dateOnlySlugs: string[] = [];
  let dateDriftCount = 0;
  let converged = 0;
  let verdictedDivergences = 0;

  for (const aw of awRecipes) {
    const slug = aw["$id"];
    const pb = pbBySlug.get(slug);
    if (!pb) {
      absentSlugs.push(slug);
      continue;
    }

    const awIng = ingredientStats(aw.ingredients);
    const pbIng = ingredientStats(pb.ingredients);
    const divergentFields: string[] = [];
    if ((aw.title || "") !== (pb.title || "")) divergentFields.push("title");
    if (!!aw.draft !== !!pb.draft) divergentFields.push("draft");
    if (awIng.n !== pbIng.n) divergentFields.push("ingredients");
    if (awIng.sum !== pbIng.sum) divergentFields.push("sumQty");
    if (jsonLen(aw.astuces) !== jsonLen(pb.astuces)) divergentFields.push("astuces");
    if ((aw.preparation || "").length !== (pb.preparation || "").length) divergentFields.push("prepLen");

    const hasDateDrift = normDay(aw["$updatedAt"]) !== normDay(pb.updated);
    if (hasDateDrift) dateDriftCount++;

    if (divergentFields.length === 0) {
      converged++;
      if (hasDateDrift) dateOnlySlugs.push(slug);
      continue;
    }

    const verdict = consumeVerdict(
      (v) =>
        v.type === "recipe-convergence" &&
        v.slug === slug &&
        divergentFields.every((f) => (v.fields || []).includes(f))
    );
    if (verdict) {
      verdictedDivergences++;
      addResult(
        `convergence.${slug}`,
        true,
        `divergent [${divergentFields.join(", ")}] — verdict: ${verdict.category}`,
      );
    } else {
      unverdictedDeviations++;
      addResult(
        `convergence.${slug}`,
        false,
        `content divergence [${divergentFields.join(", ")}]${hasDateDrift ? " + updatedAt (day)" : ""}`,
        [`recipes/${slug}: diverges on ${divergentFields.join(", ")} — no verdict covers it`],
      );
    }
  }

  // Inventory of the Appwrite recipes absent from PB (Hugo is the recipe source).
  for (const slug of absentSlugs) {
    const verdict = consumeVerdict((v) => v.type === "absent-recipe" && v.slug === slug);
    if (verdict) {
      addResult(`absentRecipe.${slug}`, true, `absent from PB — verdict: ${verdict.category}`);
    } else {
      unverdictedDeviations++;
      addResult(
        `absentRecipe.${slug}`,
        false,
        "absent from PB (no Hugo content for this slug)",
        [`recipes/${slug}: absent from Hugo content — no verdict covers it`],
      );
    }
  }

  addResult(
    "recipes.convergenceSummary",
    true,
    `${converged} converged · ${verdictedDivergences} verdicted divergences · ${absentSlugs.length} absent · updatedAt day-drift: ${dateDriftCount} (informative — Hugo is the fresher source)${dateOnlySlugs.length ? ` — e.g. ${dateOnlySlugs.slice(0, 3).join(", ")}` : ""}`,
  );
}

// --- Structural invariants ---
async function checkStructuralInvariants(): Promise<void> {
  console.log("\n🏗️  Check 8: Structural invariants\n");

  const teams = await pbListAll("teams");
  const nullRoles = teams.filter((t: any) => t.roles == null);
  const emptyRoles = teams.filter((t: any) => t.roles != null && Object.keys(t.roles).length === 0);
  addResult(
    "structural.teams.roles",
    nullRoles.length === 0,
    `${teams.length - nullRoles.length}/${teams.length} teams with non-NULL roles (${emptyRoles.length} empty map)`,
    nullRoles.map((t: any) => `teams/${t.id} "${t.name}": roles is NULL`),
  );

  // Empty by design (plan A): the Appwrite source never carried materiel
  // ownership — team-scoped delete rules protect it, there is no backfill.
  const materiel = await pbListAll("materiel");
  const withOwner = materiel.filter((m: any) => m.createdBy || m.ownerUser);
  addResult(
    "structural.materiel.ownershipEmpty",
    withOwner.length === 0,
    `${materiel.length - withOwner.length}/${materiel.length} materiel without owner`,
    withOwner.slice(0, 5).map((m: any) => `materiel/${m.id} "${m.name}": createdBy="${m.createdBy || ""}" ownerUser="${m.ownerUser || ""}"`),
  );
}

// PocketBase text fields apply a default 5000-char limit when the schema max
// is 0 (core/field_text.go: "If zero, a default limit of 5000 is applied") —
// measured: the over-limit teamdocs is rejected with
// validation_max_text_constraint max=5000 despite content.max=0.
const PB_TEXT_DEFAULT_MAX = 5000;

async function fetchTeamdocsContentMax(): Promise<number | null> {
  try {
    const res = await fetch(`${pbBaseUrl}/api/collections/teamdocs`, {
      headers: { Authorization: pbToken },
    });
    if (!res.ok) return null;
    const col = await res.json();
    const field = (col.fields || []).find((f: any) => f.name === "content");
    if (!field || field.type !== "text") return null;
    return field.max > 0 ? field.max : PB_TEXT_DEFAULT_MAX;
  } catch {
    return null;
  }
}

// Parametric: while the product decision is open, a source doc absent from PB
// is acceptable only if the field limit explains it — or the import rejected a
// record the transform did emit — AND the count deviation carries a verdict
// (counts.teamdocs). Once the limit is raised and the doc re-imported, the
// stale verdict forces the verdict file to be refreshed.
async function checkTeamdocsOverLimit(): Promise<void> {
  console.log("\n📄 Check 9: teamdocs over-limit absences (parametric)\n");

  const sourceDocs = exportRows("teamdocs");
  const importDocs = loadImportFile("teamdocs");
  const pbDocs = await pbListAll("teamdocs");
  const pbIds = new Set(pbDocs.map((d: any) => d.id));

  const max = await fetchTeamdocsContentMax();
  const maxLabel = max == null ? "unknown (collection schema unreadable)" : `${max} chars`;

  // id-map only holds successfully imported records — a record the import
  // rejected has no entry there, so "emitted by the transform" is decided on
  // pb-import alone (appwriteId / aw_-prefixed _refId).
  const idMap = loadIdMap();
  const emittedAppwriteIds = new Set<string>();
  for (const d of importDocs) {
    if (d._appwriteId) emittedAppwriteIds.add(d._appwriteId);
    else if (d._refId) emittedAppwriteIds.add(String(d._refId).replace(/^aw_/, ""));
  }

  let present = 0;
  const absentExplained: string[] = [];
  const unexplained: string[] = [];
  for (const doc of sourceDocs) {
    const appwriteId = doc["$id"];
    const pbId = idMap[`aw_${appwriteId}`];
    if (pbId && pbIds.has(pbId)) {
      present++;
      continue;
    }

    const len = (doc.content || "").length;
    if (!emittedAppwriteIds.has(appwriteId)) {
      unexplained.push(`${appwriteId} (${len} chars) — not emitted by the transform`);
    } else if (max != null && len > max) {
      absentExplained.push(`${appwriteId} (${len} chars, over the ${maxLabel} limit)`);
    } else {
      unexplained.push(`${appwriteId} (${len} chars) — emitted but rejected by the import for an unknown reason`);
    }
  }

  addResult(
    "teamdocs.absences",
    unexplained.length === 0,
    `${present}/${sourceDocs.length} present · ${absentExplained.length} absent (limit-explained — verdict required on counts.teamdocs) · ${unexplained.length} unexplained`,
    unexplained.map((u) => `teamdocs/${u}`),
  );
}

// --- Main ---
async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 validate-migration.ts — Post-import validation`);
  console.log(`${"=".repeat(60)}\n`);

  // Load env — PB_URL_OVERRIDE retargets the instance under validation
  // (throwaway harness), same convention as 3-import-pb.ts / 4-fix-timestamps.ts
  const env = loadEnv();
  pbBaseUrl = (process.env.PB_URL_OVERRIDE || env.PB_URL || "http://127.0.0.1:8090").replace(/\/+$/, "");
  console.log(`   🎯 Target: ${pbBaseUrl}`);
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

  // Load expected verdicts before running the checks
  loadVerdicts();

  // Run all checks
  await checkCountsAgainstSources();
  await checkRelationIntegrity();
  await checkRecipeFieldPopulation();
  await checkGuestEmails();
  await checkRefIdCoverage();
  await checkTextReferences();
  await checkRecipeConvergence();
  await checkStructuralInvariants();
  await checkTeamdocsOverLimit();
  checkStaleVerdicts();

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
  console.log(
    `   Non-verdicted deviations: ${unverdictedDeviations}${unverdictedDeviations > 0 ? " (must be 0 — cover them in pb-import/expected-verdicts.json)" : ""}`
  );

  if (failed > 0 || unverdictedDeviations > 0) {
    console.log(`\n   ⚠️  ${failed} checks failed, ${unverdictedDeviations} deviation(s) without verdict. Review errors above.`);
    process.exit(1);
  } else {
    console.log(`\n   🎉 All checks passed (or verdicted). Migration is valid.`);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
