/**
 * Audit des UUIDs ingrédients dans les recettes Appwrite
 * Compare chaque UUID d'ingrédient avec le catalogue Hugo (ingredients.json)
 *
 * Usage:
 *   bun run scripts_dev/fix-appwrite-uuids/audit.ts
 *
 * Prérequis:
 *   - `appwrite login` effectué dans le dossier appwrite/
 *   - bun installé
 *   - Appwrite CLI configuré (appwrite.config.json)
 *
 * Étapes:
 *   1. Dump toutes les recettes Appwrite via CLI (paginé)
 *   2. Compare chaque UUID ingrédient avec ingredients.json
 *   3. Affiche le rapport complet
 *
 * Sortie:
 *   - Rapport console détaillé
 *   - Fichier /tmp/appwrite-uuid-audit/recipes-full.jsonl (données brutes)
 */

import { $ } from "bun";

// ─── Configuration ───────────────────────────────────────────────────────────

const APPWRITE_DB_ID = "689d15b10003a5a13636";
const RECETTES_TABLE = "recettes";
const APPWRITE_DIR = import.meta.dir + "/../../../appwrite";
const INGREDIENTS_PATH = import.meta.dir + "/../../../static/data/ingredients.json";
const OUTPUT_DIR = "/tmp/appwrite-uuid-audit";

// ─── Types ───────────────────────────────────────────────────────────────────

interface HugoIngredient { n: string; u: string; }
interface RecipeIngredient { uuid: string; name: string; }
interface AppwriteRecipe {
  $id: string;
  title: string;
  status?: string;
  ingredients?: string[];
}

// ─── Étape 1: Charger le catalogue Hugo ──────────────────────────────────────

const hugoIngredients: HugoIngredient[] = await Bun.file(INGREDIENTS_PATH).json();
const hugoUuidSet = new Set(hugoIngredients.map(i => i.u));
const hugoNameToUuid = new Map<string, { uuid: string; name: string }[]>();
for (const ing of hugoIngredients) {
  const key = ing.n.toLowerCase().trim();
  if (!hugoNameToUuid.has(key)) hugoNameToUuid.set(key, []);
  hugoNameToUuid.get(key)!.push({ uuid: ing.u, name: ing.n });
}
console.log(`\n📦 Catalogue Hugo: ${hugoUuidSet.size} UUIDs`);

// ─── Étape 2: Récupérer les IDs de toutes les recettes ───────────────────────

await Bun.write(`${OUTPUT_DIR}/.gitkeep`, "");
const idResult = await $`appwrite databases list-documents \
  --database-id ${APPWRITE_DB_ID} \
  --collection-id ${RECETTES_TABLE} \
  --limit 100 \
  --json`
  .cwd(APPWRITE_DIR).quiet();
const page1 = JSON.parse(idResult.stdout.toString());
const ids: string[] = page1.documents.map((d: AppwriteRecipe) => d.$id);

if (page1.total > 100) {
  const idResult2 = await $`appwrite databases list-documents \
    --database-id ${APPWRITE_DB_ID} \
    --collection-id ${RECETTES_TABLE} \
    --offset 100 --limit 100 \
    --json`
    .cwd(APPWRITE_DIR).quiet();
  const page2 = JSON.parse(idResult2.stdout.toString());
  ids.push(...page2.documents.map((d: AppwriteRecipe) => d.$id));
}

console.log(`📋 ${ids.length} recettes Appwrite à auditer`);

// ─── Étape 3: Fetch individuel (le CLI ne retourne pas ingredients en list) ─

console.log(`\n⬇️  Téléchargement des recettes...`);
const recipes: AppwriteRecipe[] = [];
let i = 0;

for (const id of ids) {
  try {
    const result = await $`appwrite databases get-document \
      --database-id ${APPWRITE_DB_ID} \
      --collection-id ${RECETTES_TABLE} \
      --document-id ${id} \
      --json`
      .cwd(APPWRITE_DIR).quiet();
    recipes.push(JSON.parse(result.stdout.toString()));
  } catch {
    console.log(`  ⚠️ Erreur pour ${id}`);
  }
  i++;
  if (i % 25 === 0) console.log(`  ↓ ${i}/${ids.length}`);
}
console.log(`  ✅ ${recipes.length} recettes récupérées\n`);

// Sauvegarder le dump
await Bun.write(`${OUTPUT_DIR}/recipes-full.jsonl`,
  recipes.map(r => JSON.stringify(r)).join("\n"));

// ─── Étape 4: Audit ─────────────────────────────────────────────────────────

interface Mismatch { uuid: string; name: string; uuidLen: number; hugoFix?: string; hugoFixName?: string; }
interface RecipeResult { id: string; title: string; status?: string; mismatches: Mismatch[]; }

const results: RecipeResult[] = [];
let totalIngredients = 0;

for (const recipe of recipes) {
  if (!recipe.ingredients?.length) continue;

  const mismatches: Mismatch[] = [];
  for (const ingStr of recipe.ingredients) {
    try {
      const ing: RecipeIngredient = JSON.parse(ingStr);
      totalIngredients++;

      if (!hugoUuidSet.has(ing.uuid)) {
        const hugoMatch = hugoNameToUuid.get(ing.name.toLowerCase().trim())?.[0];
        mismatches.push({
          uuid: ing.uuid,
          name: ing.name,
          uuidLen: ing.uuid.length,
          hugoFix: hugoMatch?.uuid,
          hugoFixName: hugoMatch?.name,
        });
      }
    } catch { /* skip */ }
  }

  if (mismatches.length > 0) {
    results.push({ id: recipe.$id, title: recipe.title, status: recipe.status, mismatches });
  }
}

// ─── Étape 5: Rapport ───────────────────────────────────────────────────────

console.log("═".repeat(80));
console.log("🔍 AUDIT UUID — Appwrite recettes vs catalogue Hugo");
console.log("═".repeat(80));
console.log(`\n📊 Ingrédients analysés: ${totalIngredients}`);
console.log(`📊 Recettes affectées: ${results.length}\n`);

if (results.length === 0) {
  console.log("✅ Aucun UUID divergent !\n");
} else {
  for (const r of results) {
    const tag = r.status === "deleted" ? " [DELETED]" : r.status === "private" ? " [PRIVATE]" : "";
    console.log(`📄 ${r.title}${tag} ($id: ${r.id})`);
    for (const m of r.mismatches) {
      const fix = m.hugoFix ? `→ "${m.hugoFix}" (${m.hugoFixName})` : `→ PAS DE MATCH HUGO`;
      console.log(`   • "${m.name}" UUID=${m.uuid} (len=${m.uuidLen}) ${fix}`);
    }
    console.log();
  }
}

console.log("═".repeat(80) + "\n");
