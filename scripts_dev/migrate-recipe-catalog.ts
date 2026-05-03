/**
 * migrate-recipe-catalog.ts — Import recipe-info.json → PB collection "categories"
 *
 * Usage:
 *   bun run scripts_dev/migrate-recipe-catalog.ts [--dry-run]
 *
 * Reads .env.local for PB_ADMIN_PASSWORD
 * Requires PB running on http://127.0.0.1:8090
 */
import PocketBase from "pocketbase";
import { readFileSync } from "fs";

// --- Config ---
const PB_URL = "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = "qaldek@gmx.com";
const DRY_RUN = process.argv.includes("--dry-run");

// Load password from .env.local
const envLocal = readFileSync(".env.local", "utf-8");
const pwMatch = envLocal.match(/PB_ADMIN_PASSWORD=(.+)/);
if (!pwMatch) {
  console.error("❌ PB_ADMIN_PASSWORD not found in .env.local");
  process.exit(1);
}
const PB_ADMIN_PASSWORD = pwMatch[1].trim();

// --- Types ---
interface RecipeInfo {
  materiel: string[];
  categories: string[];
  regimes: string[];
}

// --- Main ---
async function main() {
  const pb = new PocketBase(PB_URL);

  // Auth as superuser
  await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  console.log("✅ Authenticated as superuser");

  // Parse recipe-info.json
  const info: RecipeInfo = JSON.parse(readFileSync("static/data/recipe-info.json", "utf-8"));
  console.log(`📊 Materiel tags: ${info.materiel.length}`);
  console.log(`📊 Categories: ${info.categories.length}`);
  console.log(`📊 Regimes: ${info.regimes.length} (static, not migrated)`);

  let created = 0;
  let errors = 0;

  // --- Equipment tags ---
  console.log(`\n--- Equipment tags ---`);
  for (const name of info.materiel) {
    const record = { name, type: "equipment_tag" };

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would create:`, JSON.stringify(record));
    } else {
      try {
        await pb.collection("categories").create(record);
        created++;
      } catch (err: any) {
        errors++;
        console.error(`❌ Failed: "${name}": ${err?.message || err}`);
      }
    }
  }

  // --- Categories ---
  console.log(`\n--- Recipe categories ---`);
  for (const name of info.categories) {
    const record = { name, type: "category" };

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would create:`, JSON.stringify(record));
    } else {
      try {
        await pb.collection("categories").create(record);
        created++;
      } catch (err: any) {
        errors++;
        console.error(`❌ Failed: "${name}": ${err?.message || err}`);
      }
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would import ${info.materiel.length + info.categories.length} categories`);
  } else {
    console.log(`✅ Created: ${created}`);
    if (errors > 0) console.log(`❌ Errors: ${errors}`);
    console.log(`📊 Total: ${info.materiel.length} equipment_tags + ${info.categories.length} categories = ${created + errors}`);
  }

  pb.authStore.clear();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
