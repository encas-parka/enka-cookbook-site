/**
 * migrate-ingredients.ts — Import ingredients.json → PB collection "ingredients"
 *
 * Usage:
 *   bun run scripts_dev/migrate-ingredients.ts [--dry-run]
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

// --- Main ---
async function main() {
  const pb = new PocketBase(PB_URL);

  // Auth as superuser
  await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  console.log("✅ Authenticated as superuser");

  // Parse ingredients.json
  const raw = JSON.parse(readFileSync("static/data/ingredients.json", "utf-8"));
  console.log(`📊 Loaded ${raw.length} ingredients from ingredients.json`);

  // Check uuid uniqueness
  const uuids = new Map<string, number>();
  for (const item of raw) {
    const count = (uuids.get(item.u) || 0) + 1;
    uuids.set(item.u, count);
  }
  const duplicates = [...uuids.entries()].filter(([, c]) => c > 1);
  if (duplicates.length > 0) {
    console.warn(`⚠️  ${duplicates.length} duplicate UUIDs found:`);
    for (const [uuid, count] of duplicates) {
      console.warn(`   "${uuid}" appears ${count} times`);
    }
    console.warn("   → Keeping first occurrence only");
  }

  // Deduplicate by uuid (keep first)
  const seen = new Set<string>();
  const deduped = raw.filter((item: any) => {
    if (seen.has(item.u)) return false;
    seen.add(item.u);
    return true;
  });
  console.log(`📊 After dedup: ${deduped.length} unique ingredients`);

  // Map & insert
  let created = 0;
  let errors = 0;

  for (let i = 0; i < deduped.length; i++) {
    const item = deduped[i] as Record<string, any>;

    const record = {
      uuid: item.u,
      name: item.n,
      type: item.t,
      allergens: item.a ?? [],
      pF: item.pF ?? false,
      pS: item.pS ?? false,
      saisons: item.saisons ?? null,
    };

    if (DRY_RUN) {
      if (i < 3) console.log(`[DRY RUN] Would create:`, JSON.stringify(record));
    } else {
      try {
        await pb.collection("ingredients").create(record);
        created++;
      } catch (err: any) {
        errors++;
        console.error(`❌ [${i + 1}/${deduped.length}] Failed: "${item.n}" (uuid=${item.u}): ${err?.message || err}`);
      }
    }

    // Progress
    if ((i + 1) % 100 === 0) {
      console.log(`⏳ Progress: ${i + 1}/${deduped.length}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would import ${deduped.length} ingredients`);
  } else {
    console.log(`✅ Created: ${created}`);
    if (errors > 0) console.log(`❌ Errors: ${errors}`);
    console.log(`📊 Total: ${deduped.length}`);
  }

  pb.authStore.clear();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
