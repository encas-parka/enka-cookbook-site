/**
 * Applique les corrections UUID depuis le plan généré par generate-plan.ts
 * Lit fix-plan.json et exécute les update-document via l'Appwrite CLI
 *
 * Usage:
 *   bun run scripts_dev/fix-appwrite-uuids/apply.ts
 *
 * Prérequis:
 *   - audit.ts a été exécuté (dump dans /tmp/appwrite-uuid-audit/)
 *   - generate-plan.ts a été exécuté (plan dans /tmp/appwrite-uuid-audit/fix-plan.json)
 *   - `appwrite login` effectué dans le dossier appwrite/
 *   - Validation manuelle du plan avant exécution
 *
 * Sécurité:
 *   - Backup automatique dans /tmp/appwrite-uuid-audit/backup-before-fix.json
 *   - Vérification post-écriture que les UUIDs sont bien corrigés
 *   - $updatedAt est automatiquement bumpé par Appwrite (pas besoin de le setter)
 */

import { $ } from "bun";

const APPWRITE_DB_ID = "689d15b10003a5a13636";
const RECETTES_TABLE = "recettes";
const APPWRITE_DIR = import.meta.dir + "/../../../appwrite";
const PLAN_PATH = "/tmp/appwrite-uuid-audit/fix-plan.json";
const BACKUP_PATH = "/tmp/appwrite-uuid-audit/backup-before-fix.json";

interface IngFix { oldUuid: string; newUuid: string; name: string; }
interface RecipeFix {
  docId: string; title: string; status: string;
  fixes: IngFix[]; newIngredients: string[];
}

// ─── Vérifications préalables ────────────────────────────────────────────────

const planFile = Bun.file(PLAN_PATH);
if (!(await planFile.exists())) {
  console.error("❌ Plan introuvable. Exécutez generate-plan.ts d'abord.");
  process.exit(1);
}

const backupFile = Bun.file(BACKUP_PATH);
if (!(await backupFile.exists())) {
  console.error("❌ Backup introuvable. Exécutez generate-plan.ts d'abord.");
  process.exit(1);
}

const plan: RecipeFix[] = await planFile.json();
if (plan.length === 0) {
  console.log("✅ Plan vide — aucune correction à appliquer.");
  process.exit(0);
}

// ─── Application ─────────────────────────────────────────────────────────────

console.log("═".repeat(80));
console.log("🔧 APPLICATION DES CORRECTIONS UUID");
console.log("═".repeat(80));
console.log(`\n${plan.length} documents à corriger`);
console.log(`💾 Backup disponible: ${BACKUP_PATH}\n`);

for (const recipe of plan) {
  console.log(`📄 ${recipe.title} (${recipe.docId})`);
  console.log(`   ${recipe.fixes.length} UUID(s) à corriger...`);

  const data = JSON.stringify({ ingredients: recipe.newIngredients });

  try {
    const result = await $`appwrite databases update-document \
      --database-id ${APPWRITE_DB_ID} \
      --collection-id ${RECETTES_TABLE} \
      --document-id ${recipe.docId} \
      --data ${data} \
      --json`
      .cwd(APPWRITE_DIR).quiet();

    const updated = JSON.parse(result.stdout.toString());

    // Vérification: plus aucun UUID long
    const badUuids = (updated.ingredients || [])
      .map((s: string) => JSON.parse(s).uuid)
      .filter((u: string) => u.length > 10);

    if (badUuids.length > 0) {
      console.log(`   ⚠️  Encore ${badUuids.length} UUIDs longs après correction!`);
    } else {
      console.log(`   ✅ OK — $updatedAt: ${updated.$updatedAt}`);
    }
  } catch (error) {
    console.log(`   ❌ ERREUR: ${error}`);
  }
  console.log();
}

console.log("═".repeat(80));
console.log("🎉 Corrections terminées");
console.log("═".repeat(80) + "\n");
