/**
 * 2d-transform-catalog.ts — static/data/recipe-info.json → pb-import/categories.json
 *
 * Usage:
 *   bun run scripts_dev/2d-transform-catalog.ts [--dry-run]
 *
 * No PocketBase dependency. Pure file transform.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SOURCE_FILE = join(PROJECT_ROOT, "static", "data", "recipe-info.json");
const IMPORT_DIR = join(import.meta.dir, "pb-import");

const DRY_RUN = process.argv.includes("--dry-run");

interface RecipeInfo {
  materiel: string[];
  categories: string[];
  regimes: string[];
}

function main(): void {
  console.log("🔄 2d-transform-catalog → pb-import/categories.json\n");

  const info: RecipeInfo = JSON.parse(readFileSync(SOURCE_FILE, "utf-8"));
  console.log(`📊 Materiel tags: ${info.materiel.length}`);
  console.log(`📊 Categories: ${info.categories.length}`);
  console.log(`📊 Regimes: ${info.regimes.length} (static, not migrated)\n`);

  const records: Record<string, any>[] = [];

  // Equipment tags first
  for (const name of info.materiel) {
    records.push({ name, type: "equipment_tag" });
  }

  // Then categories
  for (const name of info.categories) {
    records.push({ name, type: "category" });
  }

  console.log(`📊 Total: ${info.materiel.length} equipment_tags + ${info.categories.length} categories = ${records.length}`);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would write ${records.length} records to pb-import/categories.json`);
    console.log("\nFirst 3:");
    records.slice(0, 3).forEach((r) => console.log(JSON.stringify(r)));
    return;
  }

  mkdirSync(IMPORT_DIR, { recursive: true });
  const outPath = join(IMPORT_DIR, "categories.json");
  writeFileSync(outPath, JSON.stringify(records, null, 2));
  console.log(`\n✅ Written ${records.length} records → ${outPath}`);
}

main();
