/**
 * 3-import-pb.ts — Import PB-ready JSON into local PocketBase
 *
 * Creates records in dependency order, maps refIds → real PB IDs.
 * Uses fetch HTTP (no SDK dependency) for consistency with export.
 *
 * Usage:
 *   bun run scripts_dev/3-import-pb.ts [--upsert]
 *
 * Requires:
 *   - scripts_dev/.env.local with PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
 *   - scripts_dev/pb-import/*.json (from 2-transform-data.ts)
 *   - scripts_dev/migration-map.json
 *   - PocketBase running locally
 *
 * --upsert (dev only): POST each record; on an existence rejection (a unique
 * field conflict, or the deterministic id already taken), PATCH the
 * existing record by its deterministic id (hash15(refId), or the recipe slug).
 * NO purge of records absent from the sources — this does NOT guarantee
 * PB = sources. The target must have been populated by this pipeline
 * (deterministic ids), otherwise PATCHes fail with 404 (visible, never
 * silent). Expected timestamps on patched records (measured on PB 0.37.5):
 * PATCH silently ignores provided created/updated — `created` is preserved,
 * `updated` becomes the upsert time; run 4-fix-timestamps afterwards
 * (PB stopped) to restore source dates.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { emitVerdicts, VERDICT_CATEGORY } from "./verdicts-file.ts";

// --- Config ---
const ENV_FILE = join(import.meta.dir, ".env.local");
const IMPORT_DIR = join(import.meta.dir, "pb-import");
const MAP_FILE = join(import.meta.dir, "migration-map.json");

// Dev-only upsert mode: refresh existing records instead of failing on them
const UPSERT = process.argv.includes("--upsert");

// Import order (dependencies first)
const COLLECTION_ORDER = [
  "users",
  "teams",
  "materiel",
  "events",
  "products",
  "purchases",
  "materiel_loan", // before event_materiel — loanId relation
  "event_materiel", // references materiel_loan via loanId
  "teamdocs",
  "event_todos",
  "share_links",
  "ingredients", // no dependencies
  "categories", // no dependencies
  "recipes", // depends on users (createdBy) and categories
] as const;

// Fields configuration per collection for refId remapping
// 'single' = single relation field, 'multi' = array of relations
const RELATION_FIELDS: Record<string, Record<string, "single" | "multi">> = {
  users: {},
  teams: { members: "multi" },
  materiel: {
    teamId: "single",
    ownerUser: "single",
    storeIn: "single",
    shareableWith: "multi",
  },
  events: { createdBy: "single", teams: "multi", guestUsers: "multi" },
  products: { eventId: "single", updatedBy: "single", mergedInto: "single" },
  purchases: { eventId: "single", createdBy: "single", products: "multi" },
  event_materiel: {
    eventId: "single",
    sourceMaterielId: "single",
    loanId: "single",
    createdBy: "single",
    groupId: "single",
  },
  materiel_loan: {
    eventId: "single",
    createdBy: "single",
    responsibleId: "single",
    ownerId: "single",
    borrowerUser: "single",
  },
  teamdocs: { teamId: "single", eventId: "single" },
  event_todos: { eventId: "single", assignedTo: "single" },
  share_links: { createdBy: "single" }, // target_id is text, handled separately
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
  products: [
    "store",
    "specs",
    "stockReel",
    "who",
    "previousNames",
    "mergedFrom",
    "totalNeededOverride",
  ],
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
  const res = await fetch(
    `${pbBaseUrl}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: email, password }),
    },
  );

  if (!res.ok) {
    throw new Error(`PB auth failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  pbToken = data.token;
  console.log(`   🔑 Authenticated as superuser\n`);
}

async function pbCreate(
  collection: string,
  data: Record<string, any>,
): Promise<any> {
  const res = await fetch(
    `${pbBaseUrl}/api/collections/${collection}/records`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: pbToken,
      },
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(
      `PB create ${collection} failed (${res.status}): ${body.slice(0, 300)}`,
    );
    // Structured rejection codes for the verdict emission — every record the
    // import fails to create is a source→PB count gap that must be verdicted
    try {
      (err as any).pbBody = JSON.parse(body);
    } catch {
      // non-JSON body — no structured codes, the reason will say so
    }
    throw err;
  }

  return res.json();
}

async function pbPatch(
  collection: string,
  id: string,
  data: Record<string, any>,
): Promise<any> {
  const res = await fetch(
    `${pbBaseUrl}/api/collections/${collection}/records/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: pbToken,
      },
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(
      `PB patch ${collection}/${id} failed (${res.status}): ${body.slice(0, 300)}`,
    );
    try {
      (err as any).pbBody = JSON.parse(body);
    } catch {
      // non-JSON body — no structured codes, the reason will say so
    }
    throw err;
  }

  return res.json();
}

// True when PB refused a create because the record already exists: a unique
// field conflict (users.email) comes back as validation_not_unique, an
// existing deterministic id as validation_pk_invalid ("The record primary key
// is invalid or already exists" — measured on PB 0.37.5)
function isNotUnique(err: any): boolean {
  const fieldErrors = err?.pbBody?.data ?? err?.pbBody?.response?.data;
  if (!fieldErrors || typeof fieldErrors !== "object") return false;
  return Object.values<any>(fieldErrors).some(
    (f) =>
      f?.code === "validation_not_unique" ||
      f?.code === "validation_pk_invalid",
  );
}

async function pbDelete(collection: string, id: string): Promise<boolean> {
  const res = await fetch(
    `${pbBaseUrl}/api/collections/${collection}/records/${id}`,
    {
      method: "DELETE",
      headers: { Authorization: pbToken },
    },
  );
  return res.ok;
}

async function pbList(
  collection: string,
  page = 1,
  perPage = 500,
): Promise<{ items: any[]; total: number }> {
  const res = await fetch(
    `${pbBaseUrl}/api/collections/${collection}/records?page=${page}&perPage=${perPage}`,
    { headers: { Authorization: pbToken } },
  );
  if (!res.ok)
    throw new Error(`PB list ${collection} failed: ${await res.text()}`);
  const data = await res.json();
  // PB liste : le total est `totalItems` (pas `total`)
  return { items: data.items || [], total: data.totalItems || 0 };
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

/**
 * Id PB déterministe : SHA-256 → 15 premiers chars hex ([a-z0-9]).
 * Même refId → même id PB, quel que soit le run ou la machine : un ré-import
 * ne peut plus dupliquer (not_unique = skip). Charset compatible avec toutes
 * les configs d'id PB (`^[a-z0-9]+$` 15–15). Collision ~7e-12 pour 4k
 * records (60 bits) — check d'unicité par collection en filet.
 */
function hash15(refId: string): string {
  const hex = new Bun.CryptoHasher("sha256").update(refId).digest("hex");
  return hex.slice(0, 15);
}

const seenIds = new Map<string, Set<string>>(); // collection → ids du run (anti-collision)

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
function processRecord(
  collection: string,
  record: any,
): { data: Record<string, any>; refId: string; appwriteId: string } {
  const { _refId, _appwriteId, _source, _sourceEvent, _orphan, ...rest } =
    record;

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

  // teams.roles : map {refId user: role} — remapObject ne remappe que les
  // valeurs, les clés doivent l'être explicitement (le SPA indexe la map par
  // id PB user : enrichTeamFromPB `roles[user.id]`).
  if (
    collection === "teams" &&
    data.roles &&
    typeof data.roles === "object" &&
    !Array.isArray(data.roles)
  ) {
    const resolvedRoles: Record<string, any> = {};
    for (const [refKey, role] of Object.entries(
      data.roles as Record<string, any>,
    )) {
      resolvedRoles[resolve(refKey) || refKey] = role;
    }
    data.roles = resolvedRoles;
  }

  // Id déterministe : les records sans id explicite (recettes = slugs)
  // reçoivent hash15(_refId). Unicité par collection vérifiée en filet
  // (collision astronomiquement improbable mais silencieuse si elle
  // advenait — mieux vaut abort).
  if (!data.id && _refId) {
    data.id = hash15(_refId);
    let seen = seenIds.get(collection);
    if (!seen) {
      seen = new Set();
      seenIds.set(collection, seen);
    }
    if (seen.has(data.id)) {
      throw new Error(
        `collision hash15 dans ${collection} : ${_refId} → ${data.id}`,
      );
    }
    seen.add(data.id);
  }

  return { data, refId: _refId || "", appwriteId: _appwriteId || "" };
}

// --- Import rejections → verdicts ---
// Every record PB refuses is a source→PB count gap; the counts are collected
// per collection (with the validation codes) and emitted as count-delta
// verdicts at the end of a successful run — same file as the transforms'
// emission (verdicts-file.ts ownership rules).
const rejections: Record<
  string,
  { count: number; codes: Map<string, number>; sample: string }
> = {};

function recordRejection(collection: string, refId: string, err: any): void {
  let rej = rejections[collection];
  if (!rej) {
    rej = { count: 0, codes: new Map(), sample: refId || "(no refId)" };
    rejections[collection] = rej;
  }
  rej.count++;
  // PB 0.37.x error body: { code, message, data: { field: { code, ... } } }
  // (older shapes wrapped the field errors in a `response` object — tolerated)
  const body = err?.pbBody ?? {};
  const fieldErrors = body.data ?? body.response?.data;
  if (fieldErrors && typeof fieldErrors === "object") {
    for (const code of Object.values<any>(fieldErrors)
      .map((f) => f?.code)
      .filter(Boolean)) {
      rej.codes.set(code, (rej.codes.get(code) ?? 0) + 1);
    }
  } else {
    rej.codes.set("unknown", (rej.codes.get("unknown") ?? 0) + 1);
  }
}

function rejectionVerdicts(): Parameters<typeof emitVerdicts>[1] {
  const verdicts: Parameters<typeof emitVerdicts>[1] = [];
  for (const collection of COLLECTION_ORDER) {
    const rej = rejections[collection];
    if (!rej) continue;
    const codes = [...rej.codes.entries()]
      .map(([code, n]) => `${code}×${n}`)
      .join(", ");
    verdicts.push({
      type: "count-delta",
      collection,
      delta: -rej.count,
      category: VERDICT_CATEGORY.importRejected,
      reason: `${rej.count} record(s) rejected by PB validation (${codes}) — e.g. ${rej.sample}`,
    });
  }
  return verdicts;
}

// --- Import functions ---

async function importCollection(
  collection: string,
): Promise<{ created: number; patched: number; failed: number }> {
  const filePath = join(IMPORT_DIR, `${collection}.json`);
  if (!existsSync(filePath)) {
    console.log(`   ⏭️  No ${collection}.json — skipping`);
    return { created: 0, patched: 0, failed: 0 };
  }

  const records: any[] = JSON.parse(readFileSync(filePath, "utf-8"));
  if (records.length === 0) {
    console.log(`   ⏭️  ${collection}.json is empty — skipping`);
    return { created: 0, patched: 0, failed: 0 };
  }

  let created = 0;
  let patched = 0;
  let failed = 0;

  for (const record of records) {
    const { data, refId } = processRecord(collection, record);
    // Recipes use forced IDs and carry no _refId: self-map the plain id so
    // intra-collection refs (rootRecipeId = original dirName) resolve like any refId
    const registerMapping = (pbId: string) => {
      if (refId) {
        refToPb.set(refId, pbId);
      }
      if (collection === "recipes" && record.id) {
        refToPb.set(record.id, pbId);
      }
    };

    try {
      const result = await pbCreate(collection, data);
      registerMapping(result.id);
      created++;
    } catch (err: any) {
      // Upsert: not_unique on a deterministic id means the record already
      // exists — refresh it in place instead of counting a failure
      if (UPSERT && data.id && isNotUnique(err)) {
        try {
          const { id: _omit, ...patchBody } = data;
          const result = await pbPatch(collection, data.id, patchBody);
          registerMapping(result.id);
          patched++;
        } catch (patchErr: any) {
          failed++;
          recordRejection(collection, refId, patchErr);
          const errMsg = patchErr.message?.slice(0, 200) || String(patchErr);
          console.log(`   ❌ ${collection} [${refId}]: ${errMsg}`);
        }
        continue;
      }
      failed++;
      recordRejection(collection, refId, err);
      const errMsg = err.message?.slice(0, 200) || String(err);
      console.log(`   ❌ ${collection} [${refId}]: ${errMsg}`);
    }
  }

  return { created, patched, failed };
}

// Special import for users (auth collection requires passwordConfirm)
async function importUsers(): Promise<{
  created: number;
  patched: number;
  failed: number;
}> {
  const filePath = join(IMPORT_DIR, "users.json");
  if (!existsSync(filePath)) {
    console.log(`   ⏭️  No users.json — skipping`);
    return { created: 0, patched: 0, failed: 0 };
  }

  const records: any[] = JSON.parse(readFileSync(filePath, "utf-8"));
  let created = 0;
  let patched = 0;
  let failed = 0;

  for (const record of records) {
    const { data, refId, appwriteId } = processRecord("users", record);

    try {
      const result = await pbCreate("users", data);
      if (refId) {
        refToPb.set(refId, result.id);
      }
      // Alias without the aw_ prefix — safety belt for raw Appwrite IDs reaching
      // relation fields (e.g. recipes.json produced before the refId contract)
      if (appwriteId) {
        refToPb.set(appwriteId, result.id);
      }
      created++;
    } catch (err: any) {
      // Upsert: never rotate credentials on a refresh — password/passwordConfirm
      // are stripped from the PATCH (the source passwords are random per transform run)
      if (UPSERT && data.id && isNotUnique(err)) {
        try {
          const {
            id: _omit,
            password: _pw,
            passwordConfirm: _pc,
            ...patchBody
          } = data;
          const result = await pbPatch("users", data.id, patchBody);
          if (refId) {
            refToPb.set(refId, result.id);
          }
          if (appwriteId) {
            refToPb.set(appwriteId, result.id);
          }
          patched++;
        } catch (patchErr: any) {
          failed++;
          recordRejection("users", appwriteId, patchErr);
          const errMsg = patchErr.message?.slice(0, 200) || String(patchErr);
          console.log(`   ❌ user [${appwriteId}]: ${errMsg}`);
        }
        continue;
      }
      failed++;
      recordRejection("users", appwriteId, err);
      const errMsg = err.message?.slice(0, 200) || String(err);
      console.log(`   ❌ user [${appwriteId}]: ${errMsg}`);
    }
  }

  return { created, patched, failed };
}

// --- Main ---

/**
 * Preflight bloquant : la cible doit être VIDE (contrat reset du pipeline).
 * Un import sur PB peuplé crée des doublons silencieux (collections sans id
 * explicite ni index unique) — incident du 08-10. `--force` court-circuite
 * (mode dev explicite). `--upsert` le court-circuite aussi : une cible
 * peuplée EST son cas d'usage (PATCH par id déterministe, sans purge).
 */
async function preflightEmptyTarget(): Promise<void> {
  if (UPSERT) {
    console.log(
      "⚠️  --upsert : preflight cible vide ignoré — une cible peuplée est le cas d'usage (PATCH par id déterministe).\n" +
        "   Rappel : sans purge des absents — ne garantit PAS PB = sources.",
    );
    return;
  }
  if (process.argv.includes("--force")) {
    console.log(
      "⚠️  --force : preflight cible vide ignoré (mode dev explicite)",
    );
    return;
  }
  let nonEmpty: string[] = [];
  for (const collection of COLLECTION_ORDER) {
    try {
      const { total } = await pbList(collection, 1, 1);
      if (total > 0) nonEmpty.push(`${collection}(${total})`);
    } catch (err: any) {
      // collection inexistante sur cette instance : pas un blocage ;
      // tout autre échec API doit rester visible (jamais avalé)
      console.warn(
        `   preflight: ${collection}: ${err.message?.slice(0, 120)}`,
      );
    }
  }
  if (nonEmpty.length > 0) {
    console.error(
      `❌ Cible non vide : ${nonEmpty.join(", ")} — le contrat du pipeline est un reset complet (cleanup-pb) avant import.\n` +
        `   Ré-importer sur des données existantes crée des doublons silencieux.\n` +
        `   Relancez avec --force pour ignorer (mode dev explicite).`,
    );
    process.exit(1);
  }
  console.log("✅ Preflight : cible vide");
}

const HELP = `3-import-pb.ts — Import PB-ready JSON into local PocketBase

Usage:
  bun run scripts_dev/3-import-pb.ts [flags]

Flags:
  --upsert    Dev-only upsert mode: POST each record; on an existence
              rejection (unique field conflict, or deterministic id already
              taken), PATCH the existing record by its deterministic id
              (hash15(refId), or the recipe slug). NO purge of records absent
              from the sources — does NOT guarantee PB = sources. Requires a
              target populated by this pipeline (deterministic ids), otherwise
              PATCHes fail with 404 (visible). Patched records keep their
              'created' and get 'updated' = upsert time (PB autodate by
              design); run 4-fix-timestamps afterwards (PB stopped) to restore
              source dates. Implies the populated-target preflight tolerance
              (--force not needed). No count-delta verdicts are emitted for
              patched records (counts unchanged); rejections, if any, are
              emitted as in normal mode.
  --force     Normal mode only: skip the empty-target preflight.
  -h, --help  Show this help.

Env:
  PB_URL_OVERRIDE  Target instance URL (default: PB_URL from .env.local,
                   else http://127.0.0.1:8090). Superuser credentials come
                   from scripts_dev/.env.local.
`;

async function main() {
  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    console.log(HELP);
    return;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📥 3-import-pb.ts — Import PB-ready JSON → PocketBase`);
  console.log(`${"=".repeat(60)}\n`);

  if (UPSERT) {
    console.log(
      `   ♻️  Mode --upsert (dev only) : POST → not_unique → PATCH par id déterministe`,
    );
    console.log(
      `   ⚠️  sans purge des absents — ne garantit PAS PB = sources\n`,
    );
  }

  // Load env
  const env = loadEnv();
  // PB_URL surchargeable par variable d'environnement (tests sur instance
  // jetable) — sinon .env.local (dev)
  pbBaseUrl =
    process.env.PB_URL_OVERRIDE || env.PB_URL || "http://127.0.0.1:8090";
  const adminEmail = env.PB_ADMIN_EMAIL;
  const adminPassword = env.PB_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error(
      "❌ Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD in .env.local",
    );
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

  // Preflight : la cible doit être vide (sauf --force)
  await preflightEmptyTarget();

  // Import in dependency order
  const results: Record<
    string,
    { created: number; patched: number; failed: number }
  > = {};

  // Users first (special handling)
  console.log("📥 Importing users...");
  results.users = await importUsers();
  console.log(
    `   ✅ ${results.users.created} created${results.users.patched ? `, ${results.users.patched} patched` : ""}, ${results.users.failed} failed\n`,
  );

  // Then all other collections
  for (const collection of COLLECTION_ORDER.slice(1)) {
    console.log(`📥 Importing ${collection}...`);
    results[collection] = await importCollection(collection);
    console.log(
      `   ✅ ${results[collection].created} created${results[collection].patched ? `, ${results[collection].patched} patched` : ""}, ${results[collection].failed} failed\n`,
    );
  }

  // Summary
  console.log(`${"=".repeat(60)}`);
  console.log(`📊 Import Summary\n`);

  let totalCreated = 0;
  let totalPatched = 0;
  let totalFailed = 0;

  for (const collection of COLLECTION_ORDER) {
    const r = results[collection];
    if (!r) continue;
    totalCreated += r.created;
    totalPatched += r.patched;
    totalFailed += r.failed;
    const label = (collection + ":").padEnd(18);
    console.log(
      `   ${label} ${String(r.created).padStart(5)} created` +
        (r.patched ? `, ${r.patched} patched` : "") +
        (r.failed ? `, ${r.failed} failed` : ""),
    );
  }

  console.log(`\n   Total: ${totalCreated} created, ${totalFailed} failed`);
  if (UPSERT) console.log(`   Upsert: ${totalPatched} patched`);
  console.log(`   RefId mapping: ${refToPb.size} entries`);

  if (totalFailed > 0) {
    console.log(`\n   ⚠️  Some records failed. Check errors above and retry.`);
  } else {
    console.log(`\n   ✅ All records imported successfully!`);
  }

  console.log(
    `\n   NEXT: Run validate-migration.ts to verify, or test the app.`,
  );

  // Save refId → PB ID mapping for downstream scripts (e.g., 4-fix-timestamps.ts)
  const idMapPath = join(IMPORT_DIR, "id-map.json");
  const idMapObj: Record<string, string> = {};
  for (const [refId, pbId] of refToPb) {
    idMapObj[refId] = pbId;
  }
  writeFileSync(idMapPath, JSON.stringify(idMapObj, null, 2) + "\n");
  console.log(
    `   💾 Saved ID mapping (${refToPb.size} entries) → ${idMapPath}`,
  );

  // Emit the rejection-side verdicts — a rejection is a source→PB count gap
  // validate will observe, folded into the same file as the transforms' verdicts
  emitVerdicts("3-import-pb", rejectionVerdicts());
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
