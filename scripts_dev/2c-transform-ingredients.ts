/**
 * 2c-transform-ingredients.ts — static/data/ingredients.json → pb-import/ingredients.json
 *
 * Usage:
 *   bun run scripts_dev/2c-transform-ingredients.ts [--dry-run]
 *
 * No PocketBase dependency. Pure file transform.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SOURCE_FILE = join(PROJECT_ROOT, "static", "data", "ingredients.json");
const IMPORT_DIR = join(import.meta.dir, "pb-import");

const DRY_RUN = process.argv.includes("--dry-run");

function main(): void {
  console.log("🔄 2c-transform-ingredients → pb-import/ingredients.json\n");

  const raw: any[] = JSON.parse(readFileSync(SOURCE_FILE, "utf-8"));
  console.log(`📊 Loaded ${raw.length} ingredients from source`);

  // Deduplicate by UUID (keep first occurrence)
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const deduped = raw.filter((item) => {
    if (seen.has(item.u)) {
      duplicates.push(item.u);
      return false;
    }
    seen.add(item.u);
    return true;
  });

  if (duplicates.length > 0) {
    console.warn(`⚠️  ${duplicates.length} duplicate UUIDs — keeping first occurrence only`);
  }
  console.log(`📊 After dedup: ${deduped.length} unique ingredients\n`);

  // Map fields
  const records: Record<string, any>[] = deduped.map((item) => {
    const record: Record<string, any> = {
      ref: item.u,
      name: item.n,
      type: item.t || "",
      allergens: item.a ?? [],
      pF: item.pF ?? false,
      pS: item.pS ?? false,
    };

    // Optional: saisons — omit if not present or empty
    if (item.saisons) record.saisons = item.saisons;

    return record;
  });

  // Show sample
  if (records.length > 0) {
    console.log(`Sample: "${records[0].name}" (ref=${records[0].ref})`);
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would write ${records.length} records to pb-import/ingredients.json`);
    if (records.length > 0) {
      console.log("\nFirst 3 records:");
      records.slice(0, 3).forEach((r) => console.log(JSON.stringify(r)));
    }
    return;
  }

  mkdirSync(IMPORT_DIR, { recursive: true });
  const outPath = join(IMPORT_DIR, "ingredients.json");
  writeFileSync(outPath, JSON.stringify(records, null, 2));
  console.log(`\n✅ Written ${records.length} records → ${outPath}`);
}

main();
