/**
 * 4-fix-timestamps.ts — Fix PocketBase autodate timestamps via direct SQL
 *
 * After 3-import-pb.ts imports data, PocketBase's AutodateField ignores
 * the created/updated values sent via API. This script reads the original
 * timestamps from pb-import/*.json and applies them via direct SQL on
 * pocketbase/pb_data/data.db.
 *
 * Usage:
 *   bun run scripts_dev/4-fix-timestamps.ts [--dry-run]
 *
 * Requires:
 *   - PocketBase STOPPED (WAL mode, cache consistency)
 *   - scripts_dev/pb-import/*.json (from 2-transform-data.ts or migrate-*.ts)
 *   - scripts_dev/pb-import/id-map.json (saved by 3-import-pb.ts)
 *   - pocketbase/pb_data/data.db writable
 */
import { readFileSync, existsSync, copyFileSync } from "fs";
import { join } from "path";
import { Database } from "bun:sqlite";

// --- Config ---
const IMPORT_DIR = join(import.meta.dir, "pb-import");
const ID_MAP_FILE = join(IMPORT_DIR, "id-map.json");
const DB_PATH = join(import.meta.dir, "..", "pocketbase", "pb_data", "data.db");
const DRY_RUN = process.argv.includes("--dry-run");

const COLLECTIONS_TO_FIX = [
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
];

// --- Helpers ---

function loadIdMap(): Map<string, string> {
  if (!existsSync(ID_MAP_FILE)) {
    console.warn(`   ⚠️  No id-map.json found — recipes with forced IDs will still work, Appwrite collections may fail.`);
    return new Map();
  }
  const obj: Record<string, string> = JSON.parse(readFileSync(ID_MAP_FILE, "utf-8"));
  return new Map(Object.entries(obj));
}

interface ImportRecord {
  created?: string;
  updated?: string;
  _refId?: string;
  _appwriteId?: string;
  id?: string;
}

function loadImportRecords(collection: string): ImportRecord[] {
  const filePath = join(IMPORT_DIR, `${collection}.json`);
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function resolvePbId(record: ImportRecord, idMap: Map<string, string>, collection: string): string | null {
  if (collection === "recipes" && record.id) {
    return record.id;
  }

  if (record._refId && idMap.has(record._refId)) {
    return idMap.get(record._refId)!;
  }

  if (record._appwriteId) {
    const refId = `aw_${record._appwriteId}`;
    if (idMap.has(refId)) {
      return idMap.get(refId)!;
    }
  }

  return null;
}

async function isPocketBaseRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:8090/api/health", {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Main ---

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔧 4-fix-timestamps.ts — Fix PB autodate timestamps via SQL`);
  console.log(`${"=".repeat(60)}\n`);

  // Safety: check PB is stopped
  if (await isPocketBaseRunning()) {
    console.error(`❌ PocketBase is running! Stop it first to avoid data corruption.`);
    console.error(`   Run: kill $(pgrep pocketbase) or pkill -f pocketbase`);
    process.exit(1);
  }

  // Check DB exists
  if (!existsSync(DB_PATH)) {
    console.error(`❌ Database not found: ${DB_PATH}`);
    console.error(`   Make sure PocketBase has been initialized.`);
    process.exit(1);
  }

  // Backup
  const backupPath = DB_PATH + `.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  if (!DRY_RUN) {
    copyFileSync(DB_PATH, backupPath);
    console.log(`📦 Backup saved: ${backupPath}\n`);
  } else {
    console.log(`📦 [DRY RUN] Would backup to: ${backupPath}\n`);
  }

  // Load ID mapping
  const idMap = loadIdMap();
  console.log(`📊 ID mapping: ${idMap.size} entries\n`);

  // Open DB
  const db = new Database(DB_PATH, { readonly: DRY_RUN });
  db.exec("PRAGMA journal_mode = WAL;");

  if (!DRY_RUN) {
    db.exec("BEGIN TRANSACTION;");
  }

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalMissing = 0;

  for (const collection of COLLECTIONS_TO_FIX) {
    const records = loadImportRecords(collection);
    if (records.length === 0) {
      console.log(`   ⏭️  No ${collection}.json — skipping`);
      continue;
    }

    console.log(`🔧 Fixing ${collection} (${records.length} records)...`);

    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const record of records) {
      const pbId = resolvePbId(record, idMap, collection);

      if (!pbId) {
        missing++;
        continue;
      }

      const created = record.created;
      const updated_ts = record.updated;

      if (!created && !updated_ts) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        if (updated < 3) {
          console.log(`   [DRY RUN] UPDATE ${collection} SET created='${created}', updated='${updated_ts}' WHERE id='${pbId}'`);
        }
        updated++;
      } else {
        try {
          const stmt = db.query(
            `UPDATE ${collection} SET created = ?, updated = ? WHERE id = ?`
          );
          stmt.run(created || "", updated_ts || created || "", pbId);
          updated++;
        } catch (err: any) {
          console.error(`   ❌ Failed ${collection} [${pbId}]: ${err.message}`);
          missing++;
        }
      }
    }

    totalUpdated += updated;
    totalSkipped += skipped;
    totalMissing += missing;

    console.log(`   ✅ ${collection}: ${updated} updated, ${skipped} no timestamps, ${missing} no PB ID`);
  }

  if (!DRY_RUN) {
    db.exec("COMMIT;");
  }

  db.close();

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 Timestamp Fix Summary\n`);
  console.log(`   Records updated:  ${totalUpdated}`);
  console.log(`   Skipped (no ts):  ${totalSkipped}`);
  console.log(`   Missing (no ID):  ${totalMissing}`);

  if (DRY_RUN) {
    console.log(`\n   [DRY RUN] No changes were made. Run without --dry-run to apply.`);
  } else {
    console.log(`\n   ✅ Timestamps fixed! You can now start PocketBase.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
