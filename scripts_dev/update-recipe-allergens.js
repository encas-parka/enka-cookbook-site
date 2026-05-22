#!/usr/bin/env node

/**
 * Script de mise à jour des allergènes et régimes des recettes
 *
 * Ce script parcourt toutes les recettes dans content/recipe/ et met à jour :
 * - Les allergènes de chaque ingrédient (depuis ingredients.json)
 * - Les régimes de la recette (recalculés depuis les nouveaux allergènes)
 *
 * Usage:
 *   node scripts_dev/update-recipe-allergens.js [--dry-run] [--yes]
 *
 * Options:
 *   --dry-run  : Affiche les modifications sans les écrire
 *   --yes      : Confirme automatiquement toutes les questions
 *
 * Prérequis:
 *   - Avoir un dépôt git propre (pas de modifications non commitées)
 *   - Le script vérifiera l'état git avant de commencer
 *
 * Installation des dépendances:
 *   cd scripts_dev && npm install
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { execSync } from "child_process";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const ROOT_DIR = path.dirname(__dirname);
const RECIPES_DIR = path.join(ROOT_DIR, "content/recipe");
const INGREDIENTS_JSON = path.join(ROOT_DIR, "static/data/ingredients.json");

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Pose une question à l'utilisateur
 */
function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

/**
 * Exécute une commande shell
 */
function exec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", cwd: ROOT_DIR }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Vérifie si le dépôt git a des modifications
 */
function checkGitStatus() {
  try {
    // Vérifier si on est dans un dépôt git
    execSync("git rev-parse --git-dir", { cwd: ROOT_DIR, stdio: "ignore" });
  } catch {
    console.error("❌ Erreur: Ce n'est pas un dépôt git");
    process.exit(1);
  }

  // Vérifier s'il y a des modifications non commitées
  const status = execSync("git status --porcelain", {
    cwd: ROOT_DIR,
    encoding: "utf-8",
  });

  if (status.trim()) {
    console.error(
      "❌ Erreur: Le dépôt git contient des modifications non commitées:",
    );
    console.error(status);
    console.error(
      "\nVeuillez commiter ou stasher vos modifications avant de lancer ce script.",
    );
    process.exit(1);
  }

  console.log("✅ Dépôt git propre\n");
}

/**
 * Crée un commit git avec les modifications
 */
function commitChanges(stats) {
  console.log("\n📝 Création du commit git...");

  try {
    // Ajouter les fichiers modifiés
    execSync("git add content/recipe", { cwd: ROOT_DIR, stdio: "ignore" });

    // Créer le commit
    const message = `chore: mise à jour des allergènes et régimes (${stats.recipesUpdated} recettes)

- Mis à jour ${stats.ingredientsUpdated} ingrédients avec les nouveaux allergènes
- Recalculé les régimes pour ${stats.recipesUpdated} recettes
- ${stats.allergensAdded} allergènes ajoutés
- ${stats.allergensRemoved} allergènes supprimés

Script: scripts_dev/update-recipe-allergens.js`;

    execSync(`git commit -m "${message}"`, { cwd: ROOT_DIR, stdio: "ignore" });

    console.log("✅ Commit créé avec succès!");
    console.log("\n💡 Pour annuler: git reset HEAD~1");
    console.log("💡 Pour voir les modifications: git diff HEAD~1\n");
  } catch (error) {
    console.error("⚠️  Erreur lors du commit:", error.message);
    console.log(
      "\n💡 Veuillez commiter manuellement: git add content/recipe && git commit",
    );
  }
}

// ============================================================================
// LOGIQUE MÉTIER
// ============================================================================

/**
 * Détermine les régimes alimentaires en fonction des allergènes
 */
function determineRegimes(ingredients) {
  const allAllergens = new Set();
  let hasAnimalProducts = false;

  ingredients.forEach((ingredient) => {
    if (ingredient.allergens && ingredient.allergens.length > 0) {
      ingredient.allergens.forEach((allergen) => allAllergens.add(allergen));
    }
    if (ingredient.type === "animaux") {
      hasAnimalProducts = true;
    }
  });

  const allergenList = Array.from(allAllergens);

  if (
    allergenList.includes("Viande") ||
    allergenList.includes("Poisson") ||
    allergenList.includes("Crustacé") ||
    allergenList.includes("Mollusque") ||
    allergenList.includes("Porc")
  ) {
    hasAnimalProducts = true;
  }

  const regimes = [];

  if (
    !hasAnimalProducts &&
    !allergenList.includes("Produit laitier") &&
    !allergenList.includes("Oeuf")
  ) {
    regimes.push("vegan");
  } else if (!hasAnimalProducts) {
    regimes.push("vegetarien");
  }

  if (!allergenList.includes("Gluten")) {
    regimes.push("sans-gluten");
  }

  if (!allergenList.includes("Produit laitier")) {
    regimes.push("sans-lactose");
  }

  return regimes;
}

/**
 * Met à jour un ingrédient avec les données fraîches d'ingredients.json
 */
function updateIngredient(ingredient, ingredientsMap, recipeDir = "") {
  const freshIngredient = ingredientsMap.get(ingredient.uuid);

  if (!freshIngredient) {
    const prefix = recipeDir ? `[${recipeDir}] ` : "";
    if (!ingredient.uuid || !ingredient.name) {
      console.warn(
        `  ⚠️  ${prefix}Ingrédient invalide: uuid="${ingredient.uuid}", name="${ingredient.name}"`,
      );
    } else {
      console.warn(
        `  ⚠️  ${prefix}Ingrédient ${ingredient.uuid} (${ingredient.name}) non trouvé dans ingredients.json`,
      );
    }
    return { updated: false, ingredient };
  }

  const oldAllergens = new Set(ingredient.allergens || []);
  const newAllergens = new Set(freshIngredient.a || []);

  const allergensAdded = [...newAllergens].filter((a) => !oldAllergens.has(a));
  const allergensRemoved = [...oldAllergens].filter(
    (a) => !newAllergens.has(a),
  );

  if (allergensAdded.length > 0 || allergensRemoved.length > 0) {
    const updated = {
      ...ingredient,
      allergens: freshIngredient.a || [],
      type: freshIngredient.t,
      pF: freshIngredient.pF || false,
      pS: freshIngredient.pS || false,
    };

    return {
      updated: true,
      ingredient: updated,
      changes: { allergensAdded, allergensRemoved },
    };
  }

  return { updated: false, ingredient };
}

/**
 * Met à jour une recette
 */
function updateRecipe(recipePath, ingredientsMap, dryRun, recipeDir = "") {
  const content = fs.readFileSync(recipePath, "utf-8");

  // Parser le frontmatter YAML
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const yamlData = yaml.load(frontmatter);

  if (!yamlData.ingredients || !Array.isArray(yamlData.ingredients)) {
    return null;
  }

  let ingredientsUpdated = 0;
  const changes = [];

  // Mettre à jour chaque ingrédient
  yamlData.ingredients = yamlData.ingredients.map((ing) => {
    const result = updateIngredient(ing, ingredientsMap, recipeDir);

    if (result.updated) {
      ingredientsUpdated++;
      changes.push({
        name: ing.name,
        uuid: ing.uuid,
        changes: result.changes,
      });
    }

    return result.ingredient;
  });

  // Recalculer les régimes
  const oldRegimes = new Set(yamlData.regime || []);
  const newRegimes = determineRegimes(yamlData.ingredients);

  yamlData.regime = newRegimes;

  const regimesAdded = newRegimes.filter((r) => !oldRegimes.has(r));
  const regimesRemoved = [...oldRegimes].filter((r) => !newRegimes.includes(r));

  if (
    ingredientsUpdated === 0 &&
    regimesAdded.length === 0 &&
    regimesRemoved.length === 0
  ) {
    return { updated: false };
  }

  // Reconstruire le contenu
  const newFrontmatter =
    "---\n" +
    yaml
      .dump(yamlData, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false,
      })
      .trim() +
    "\n---\n";

  const newContent = newFrontmatter + content.slice(frontmatterMatch[0].length);

  if (!dryRun) {
    fs.writeFileSync(recipePath, newContent, "utf-8");
  }

  return {
    updated: true,
    ingredientsUpdated,
    regimesAdded,
    regimesRemoved,
    changes,
  };
}

// ============================================================================
// SCRIPT PRINCIPAL
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const autoConfirm = args.includes("--yes");

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  Mise à jour des allergènes et régimes des recettes");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  // Vérifier l'état git
  if (!dryRun) {
    checkGitStatus();
  }

  // Charger ingredients.json
  console.log("📖 Chargement d'ingredients.json...");
  const ingredientsData = JSON.parse(
    fs.readFileSync(INGREDIENTS_JSON, "utf-8"),
  );

  // Créer un Map pour accès rapide par UUID
  const ingredientsMap = new Map(ingredientsData.map((ing) => [ing.u, ing]));

  console.log(`✅ ${ingredientsMap.size} ingrédients chargés\n`);

  // Lister toutes les recettes
  console.log("📂 Recherche des recettes...");
  const recipeDirs = fs
    .readdirSync(RECIPES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  console.log(`✅ ${recipeDirs.length} recettes trouvées\n`);

  if (!autoConfirm) {
    const answer = await question(
      `Continuer? (${dryRun ? "MODE DRY-RUN" : "Les fichiers seront modifiés"}) [y/N] `,
    );
    if (answer.toLowerCase() !== "y") {
      console.log("\n❌ Annulé");
      process.exit(0);
    }
  }

  console.log("\n⚙️  Traitement...\n");

  // Statistiques
  const stats = {
    recipesProcessed: 0,
    recipesUpdated: 0,
    ingredientsUpdated: 0,
    allergensAdded: 0,
    allergensRemoved: 0,
  };

  // Traiter chaque recette
  for (const recipeDir of recipeDirs) {
    const recipePath = path.join(RECIPES_DIR, recipeDir, "index.md");

    if (!fs.existsSync(recipePath)) {
      continue;
    }

    stats.recipesProcessed++;

    const result = updateRecipe(recipePath, ingredientsMap, dryRun, recipeDir);

    if (result && result.updated) {
      stats.recipesUpdated++;
      stats.ingredientsUpdated += result.ingredientsUpdated;

      result.changes.forEach((change) => {
        stats.allergensAdded += change.changes.allergensAdded.length;
        stats.allergensRemoved += change.changes.allergensRemoved.length;

        if (
          change.changes.allergensAdded.length > 0 ||
          change.changes.allergensRemoved.length > 0
        ) {
          console.log(`  📝 ${recipeDir}`);
          console.log(`     Ingrédient: ${change.name}`);
          if (change.changes.allergensAdded.length > 0) {
            console.log(
              `     + Ajouté: ${change.changes.allergensAdded.join(", ")}`,
            );
          }
          if (change.changes.allergensRemoved.length > 0) {
            console.log(
              `     - Supprimé: ${change.changes.allergensRemoved.join(", ")}`,
            );
          }
        }
      });

      if (result.regimesAdded.length > 0) {
        console.log(
          `     + Régimes ajoutés: ${result.regimesAdded.join(", ")}`,
        );
      }
      if (result.regimesRemoved.length > 0) {
        console.log(
          `     - Régimes supprimés: ${result.regimesRemoved.join(", ")}`,
        );
      }
    }
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );
  console.log("  RÉSUMÉ");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );
  console.log(`📊 Recettes traitées:     ${stats.recipesProcessed}`);
  console.log(`✅ Recettes mises à jour: ${stats.recipesUpdated}`);
  console.log(`🔧 Ingrédients mis à jour: ${stats.ingredientsUpdated}`);
  console.log(`+   Allergènes ajoutés:    ${stats.allergensAdded}`);
  console.log(`-   Allergènes supprimés:  ${stats.allergensRemoved}\n`);

  if (dryRun) {
    console.log("💡 MODE DRY-RUN: Aucune modification n'a été écrite");
    console.log(
      "   Relancez sans --dry-run pour appliquer les modifications\n",
    );
  } else if (stats.recipesUpdated > 0) {
    const answer = autoConfirm
      ? "y"
      : await question("Créer un commit git? [Y/n] ");
    if (answer.toLowerCase() !== "n") {
      commitChanges(stats);
    }
  } else {
    console.log("✨ Aucune modification nécessaire\n");
  }
}

main().catch((error) => {
  console.error("❌ Erreur:", error);
  process.exit(1);
});
