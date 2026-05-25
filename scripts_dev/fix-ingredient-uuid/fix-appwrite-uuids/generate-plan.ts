/**
 * Génère un plan de correction des UUIDs Appwrite → Hugo (dry run)
 * Lit le dump produit par audit.ts et génère un plan JSON + vérification d'intégrité
 *
 * Usage:
 *   bun run scripts_dev/fix-appwrite-uuids/audit.ts          # d'abord: générer le dump
 *   bun run scripts_dev/fix-appwrite-uuids/generate-plan.ts  # ensuite: générer le plan
 *
 * Prérequis:
 *   - audit.ts a été exécuté (dump dans /tmp/appwrite-uuid-audit/)
 *
 * Sortie:
 *   - Rapport console détaillé (chaque UUID à corriger)
 *   - Fichier /tmp/appwrite-uuid-audit/fix-plan.json (plan exécutable)
 *   - Fichier /tmp/appwrite-uuid-audit/backup-before-fix.json (sauvegarde)
 */

const INGREDIENTS_PATH = import.meta.dir + "/../../../static/data/ingredients.json";
const DUMP_PATH = "/tmp/appwrite-uuid-audit/recipes-full.jsonl";
const PLAN_PATH = "/tmp/appwrite-uuid-audit/fix-plan.json";
const BACKUP_PATH = "/tmp/appwrite-uuid-audit/backup-before-fix.json";

// ─── Types ───────────────────────────────────────────────────────────────────

interface HugoIngredient { n: string; u: string; }
interface AppwriteRecipe {
  $id: string; title: string; status?: string; ingredients?: string[];
}
interface IngFix { oldUuid: string; newUuid: string; name: string; }
interface RecipeFix {
  docId: string; title: string; status: string;
  fixes: IngFix[]; newIngredients: string[];
}

// ─── 1. Catalogue Hugo ───────────────────────────────────────────────────────

const hugoIngredients: HugoIngredient[] = await Bun.file(INGREDIENTS_PATH).json();
const hugoNameToUuid = new Map<string, string>();
for (const ing of hugoIngredients) {
  hugoNameToUuid.set(ing.n.toLowerCase().trim(), ing.u);
}

// ─── 2. Charger le dump ──────────────────────────────────────────────────────

const dumpLines = (await Bun.file(DUMP_PATH).text()).split("\n").filter(l => l.trim());
const recipes: AppwriteRecipe[] = dumpLines.map(l => JSON.parse(l));

// Sauvegarder le backup
await Bun.write(BACKUP_PATH, JSON.stringify(recipes, null, 2));

// ─── 3. Construire le plan (uniquement recettes actives) ─────────────────────

const plan: RecipeFix[] = [];

for (const recipe of recipes) {
  if (!recipe.ingredients?.length) continue;
  if (recipe.status === "deleted") continue; // Ignorer les deleted

  const fixes: IngFix[] = [];
  const newIngredients: string[] = [];

  for (const ingStr of recipe.ingredients) {
    const ing = JSON.parse(ingStr);
    const hugoUuid = hugoNameToUuid.get(ing.name.toLowerCase().trim());

    if (hugoUuid && ing.uuid !== hugoUuid) {
      fixes.push({ oldUuid: ing.uuid, newUuid: hugoUuid, name: ing.name });
      ing.uuid = hugoUuid;
    }
    newIngredients.push(JSON.stringify(ing));
  }

  if (fixes.length > 0) {
    plan.push({ docId: recipe.$id, title: recipe.title, status: recipe.status ?? "unknown", fixes, newIngredients });
  }
}

// ─── 4. Vérification d'intégrité ─────────────────────────────────────────────

const recipesMap = new Map(recipes.map(r => [r.$id, r]));
let allIntegrityOk = true;

for (const p of plan) {
  const original = recipesMap.get(p.docId);
  if (!original) continue;

  for (let i = 0; i < original.ingredients!.length; i++) {
    const origIng = JSON.parse(original.ingredients![i]);
    const newIng = JSON.parse(p.newIngredients[i]);
    const fix = p.fixes.find(f => f.oldUuid === origIng.uuid);

    const origCopy = { ...origIng }; delete origCopy.uuid;
    const newCopy = { ...newIng }; delete newCopy.uuid;

    if (JSON.stringify(origCopy) !== JSON.stringify(newCopy)) {
      console.log(`❌ INTÉGRITÉ: "${origIng.name}" dans ${p.title} — champs modifiés en plus de l'UUID!`);
      allIntegrityOk = false;
    }
  }
}

// ─── 5. Rapport ──────────────────────────────────────────────────────────────

console.log("═".repeat(80));
console.log("📋 PLAN DE CORRECTION — Dry Run");
console.log("═".repeat(80));
console.log(`\n${plan.length} documents actifs à modifier, ${plan.reduce((s, p) => s + p.fixes.length, 0)} UUIDs à corriger`);
console.log(`🔒 Vérification d'intégrité: ${allIntegrityOk ? "✅ OK (seul l'UUID change)" : "❌ PROBLÈME DÉTECTÉ"}\n`);

for (const p of plan) {
  console.log(`📄 ${p.title}`);
  console.log(`   $id: ${p.docId}`);
  for (const f of p.fixes) {
    console.log(`   ${f.oldUuid} → ${f.newUuid}  ("${f.name}")`);
  }
  console.log();
}

// ─── 6. Sauvegarder le plan ──────────────────────────────────────────────────

await Bun.write(PLAN_PATH, JSON.stringify(plan, null, 2));
console.log(`\n💾 Plan sauvegardé:   ${PLAN_PATH}`);
console.log(`💾 Backup original:   ${BACKUP_PATH}`);
console.log(`\nPour appliquer:      bun run scripts_dev/fix-appwrite-uuids/apply.ts`);
console.log("═".repeat(80) + "\n");
