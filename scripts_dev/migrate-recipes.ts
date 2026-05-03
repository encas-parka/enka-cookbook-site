/**
 * migrate-recipes.ts — Import Hugo markdown recipes → PB collection "recipes"
 *
 * Usage:
 *   bun run scripts_dev/migrate-recipes.ts [--dry-run]
 *
 * Reads .env.local for PB_ADMIN_PASSWORD
 * Requires PB running on http://127.0.0.1:8090
 */
import PocketBase from "pocketbase";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

// --- Config ---
const PB_URL = "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = "qaldek@gmx.com";
const RECIPES_DIR = "content/recipe";
const DRY_RUN = process.argv.includes("--dry-run");

// Load password from .env.local
const envLocal = readFileSync(".env.local", "utf-8");
const pwMatch = envLocal.match(/PB_ADMIN_PASSWORD=(.+)/);
if (!pwMatch) {
  console.error("❌ PB_ADMIN_PASSWORD not found in .env.local");
  process.exit(1);
}
const PB_ADMIN_PASSWORD = pwMatch[1].trim();

// --- Helpers ---

/** Build the PB record from frontmatter + directory name (slug_uuid) */
function buildRecord(dirName: string, fm: Record<string, any>): Record<string, any> {
  const record: Record<string, any> = {
    id: dirName, // Force PB ID = slug_uuid
    title: fm.title || "Sans titre",
    description: fm.description || "",
    ingredients: fm.ingredients || [],
    preparation: fm.preparation || "",
    typeR: fm.typeR || null,
    categories: fm.categories || [],
    auteur: fm.auteur || "",
    lockedBy: "",
    plate: fm.plate ?? 1,
    draft: fm.draft ?? false,
    regime: fm.regime || [],
    publishedAt: fm.publishDate || null,
    teams: fm.teams || [],
    materiel: fm.materiel || [],
    prepAlt: fm.prepAlt || [],
    region: fm.region || "",
    cuisson: fm.cuisson ?? false,
    quantite_desc: fm.quantite_desc || "",
    check: fm.check ?? false,
    preparation24h: fm.preparation24h || "",
    permissionWrite: fm.permissionWrite || [],
    serveHot: fm.serveHot ?? false,
    saison: fm.saison || [],
    astuces: fm.astuces || [],
    status: fm.status || "public",
    rootRecipeId: fm.rootRecipeId || null,
    versionLabel: fm.versionLabel || "",
  };

  // createdBy: Appwrite IDs are useless before Phase 0, set to null
  // (the field is a relation → users, null means no owner)
  record.createdBy = null;

  return record;
}

// --- Main ---
async function main() {
  const pb = new PocketBase(PB_URL);

  // Auth as superuser
  await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  console.log("✅ Authenticated as superuser");

  // List recipe directories
  const dirs = readdirSync(RECIPES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`📊 Found ${dirs.length} recipe directories`);

  let created = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (let i = 0; i < dirs.length; i++) {
    const dirName = dirs[i];
    const mdPath = join(RECIPES_DIR, dirName, "index.md");

    let fm: Record<string, any>;
    try {
      const raw = readFileSync(mdPath, "utf-8");
      const parsed = matter(raw);
      fm = parsed.data;
    } catch (err: any) {
      errors++;
      errorDetails.push(`[${dirName}] Read error: ${err.message}`);
      continue;
    }

    const record = buildRecord(dirName, fm);

    if (DRY_RUN) {
      if (i < 3) {
        console.log(`[DRY RUN] Would create "${fm.title}" (id=${dirName})`);
        console.log(`  fields: ${Object.keys(record).length}`);
      }
    } else {
      try {
        // Use Admin API directly to force the ID
        // pb.collection().create() doesn't support custom IDs
        const response = await fetch(`${PB_URL}/api/collections/recipes/records`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: pb.authStore.token,
          },
          body: JSON.stringify(record),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }

        created++;
      } catch (err: any) {
        errors++;
        errorDetails.push(`[${dirName}] "${fm.title}": ${err.message}`);
      }
    }

    // Progress
    if ((i + 1) % 50 === 0) {
      console.log(`⏳ Progress: ${i + 1}/${dirs.length} (✅ ${created} ❌ ${errors})`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would import ${dirs.length} recipes`);
  } else {
    console.log(`✅ Created: ${created}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📊 Total: ${dirs.length}`);
    if (errorDetails.length > 0 && errorDetails.length <= 20) {
      console.log(`\nError details:`);
      errorDetails.forEach((e) => console.log(`  ${e}`));
    } else if (errorDetails.length > 20) {
      console.log(`\nFirst 20 errors:`);
      errorDetails.slice(0, 20).forEach((e) => console.log(`  ${e}`));
      console.log(`  ... and ${errorDetails.length - 20} more`);
    }
  }

  pb.authStore.clear();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
