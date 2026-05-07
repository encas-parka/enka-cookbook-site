/**
 * 2b-transform-recipes.ts — Read Hugo markdown recipes → pb-import/recipes.json
 *
 * Usage:
 *   bun run scripts_dev/2b-transform-recipes.ts [--dry-run]
 *
 * No PocketBase dependency. Pure file transform.
 * Stores Appwrite user IDs in createdBy/permissionWrite — 3-import-pb.ts resolves them.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

const PROJECT_ROOT = join(import.meta.dir, "..");
const RECIPES_DIR = join(PROJECT_ROOT, "content", "recipe");
const IMPORT_DIR = join(import.meta.dir, "pb-import");
const USERS_FILE = join(IMPORT_DIR, "users.json");

const DRY_RUN = process.argv.includes("--dry-run");

// --- User resolution maps (Appwrite IDs only — no PB query) ---
const awIdToName = new Map<string, string>();
const nameToAwId = new Map<string, string>();

function loadUserMaps(): void {
  if (!existsSync(USERS_FILE)) {
    console.warn("⚠️  pb-import/users.json not found — createdBy/permissionWrite resolution disabled");
    return;
  }
  const users: any[] = JSON.parse(readFileSync(USERS_FILE, "utf-8"));
  for (const u of users) {
    if (u._appwriteId) {
      if (u.name) {
        awIdToName.set(u._appwriteId, u.name);
        nameToAwId.set(u.name.toLowerCase(), u._appwriteId);
      }
      if (u.email) {
        nameToAwId.set(u.email.toLowerCase(), u._appwriteId);
      }
    }
  }
  console.log(`📊 Loaded ${users.length} user mappings from users.json`);
}

function resolveCreatedBy(value: string | undefined): string | undefined {
  if (!value || value.trim() === "") return undefined;
  const trimmed = value.trim();

  if (/^[0-9a-f]{20}$/.test(trimmed)) {
    return trimmed;
  }

  const awId = nameToAwId.get(trimmed.toLowerCase());
  return awId || undefined;
}

function resolvePermissionWrite(values: string[] | undefined): string[] | undefined {
  if (!values || !Array.isArray(values) || values.length === 0) return undefined;

  const resolved: string[] = [];
  for (const v of values) {
    if (!v || v.trim() === "") continue;
    const trimmed = v.trim();

    if (/^[0-9a-f]{20}$/.test(trimmed)) {
      resolved.push(trimmed);
      continue;
    }

    const awId = nameToAwId.get(trimmed.toLowerCase());
    if (awId) resolved.push(awId);
  }

  return resolved.length > 0 ? resolved : undefined;
}

// --- Record builder ---

function buildRecord(dirName: string, fm: Record<string, any>): Record<string, any> {
  const record: Record<string, any> = {
    id: dirName,
    title: fm.title || "Sans titre",
    description: fm.description || "",
    ingredients: fm.ingredients || [],
    preparation: fm.preparation || "",
    categories: fm.categories || [],
    auteur: fm.auteur || "",
    lockedBy: "",
    plate: fm.plate ?? 1,
    draft: fm.draft ?? false,
    regime: fm.regime || [],
    teams: fm.teams || [],
    materiel: fm.materiel || [],
    prepAlt: fm.prepAlt || [],
    region: fm.region || "",
    cuisson: fm.cuisson ?? false,
    quantite_desc: fm.quantite_desc || "",
    check: fm.check ?? false,
    preparation24h: fm.preparation24h || "",
    serveHot: fm.serveHot ?? false,
    saison: fm.saison || [],
    astuces: fm.astuces || [],
    status: fm.status || "public",
    versionLabel: fm.versionLabel || "",
    created: fm.date || "",
    updated: fm.updatedAt || fm.date || "",
  };

  // Optional text fields — omit if empty/null
  if (fm.typeR) record.typeR = fm.typeR;
  if (fm.publishDate) record.publishedAt = fm.publishDate;

  // rootRecipeId — resolved during topological sort (set later)
  if (fm.rootRecipeId) record.rootRecipeId = fm.rootRecipeId;

  // User references — store Appwrite IDs for 3-import-pb to resolve
  const createdBy = resolveCreatedBy(fm.createdBy);
  if (createdBy) record.createdBy = createdBy;

  const permissionWrite = resolvePermissionWrite(fm.permissionWrite);
  if (permissionWrite) record.permissionWrite = permissionWrite;

  return record;
}

// --- Main ---

function main(): void {
  console.log("🔄 2b-transform-recipes — Hugo markdown → pb-import/recipes.json\n");

  loadUserMaps();

  // List recipe directories
  const dirs = readdirSync(RECIPES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`📊 Found ${dirs.length} recipe directories\n`);

  // Parse all recipes
  const parsed: Record<string, Record<string, any>> = {};
  const parseErrors: string[] = [];

  for (const dirName of dirs) {
    const mdPath = join(RECIPES_DIR, dirName, "index.md");
    try {
      const raw = readFileSync(mdPath, "utf-8");
      const { data: fm } = matter(raw);
      parsed[dirName] = buildRecord(dirName, fm);
    } catch (err: any) {
      parseErrors.push(`[${dirName}] ${err.message}`);
    }
  }

  if (parseErrors.length > 0) {
    console.warn(`⚠️  ${parseErrors.length} parse errors:`);
    parseErrors.slice(0, 10).forEach((e) => console.warn(`   ${e}`));
    if (parseErrors.length > 10) console.warn(`   ... and ${parseErrors.length - 10} more`);
  }

  // Topological sort: originals first, then v2s
  const allIds = new Set(Object.keys(parsed));
  const originals: string[] = [];
  const v2s: string[] = [];
  const orphans: string[] = [];

  for (const [id, record] of Object.entries(parsed)) {
    if (record.rootRecipeId) {
      if (allIds.has(record.rootRecipeId)) {
        v2s.push(id);
      } else {
        orphans.push(id);
        delete record.rootRecipeId;
      }
    } else {
      originals.push(id);
    }
  }

  if (orphans.length > 0) {
    console.warn(`⚠️  ${orphans.length} orphan rootRecipeIds (referencing non-existent recipes):`);
    orphans.slice(0, 10).forEach((id) => console.warn(`   ${id} → "${parsed[id].rootRecipeId || "(removed)"}"`));
  }

  // Build final ordered output
  const records: Record<string, any>[] = [];
  for (const id of originals) records.push(parsed[id]);
  for (const id of v2s) records.push(parsed[id]);

  console.log(`📊 Records: ${originals.length} originals + ${v2s.length} v2s = ${records.length} total\n`);

  // Show sample
  if (records.length > 0) {
    const sample = records[0];
    console.log(`Sample record: "${sample.title}" (id=${sample.id})`);
    console.log(`  fields: ${Object.keys(sample).length}`);
    if (sample.rootRecipeId) console.log(`  rootRecipeId: ${sample.rootRecipeId}`);
    if (sample.createdBy) console.log(`  createdBy: ${sample.createdBy}`);
    if (sample.permissionWrite) console.log(`  permissionWrite: ${JSON.stringify(sample.permissionWrite)}`);
    console.log();
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would write ${records.length} records to pb-import/recipes.json`);
    if (records.length > 0) {
      console.log("\nFirst record preview:");
      console.log(JSON.stringify(records[0], null, 2));
    }
    return;
  }

  mkdirSync(IMPORT_DIR, { recursive: true });
  const outPath = join(IMPORT_DIR, "recipes.json");
  writeFileSync(outPath, JSON.stringify(records, null, 2));
  console.log(`✅ Written ${records.length} records → ${outPath}`);
}

main();
