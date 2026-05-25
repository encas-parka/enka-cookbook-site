#!/usr/bin/env node

/**
 * Script de migration pour corriger les UUIDs d'ingrédients générés par nanoid
 *
 * Problème : Certains ingrédients dans les recettes ont des UUIDs générés par nanoid()
 * (21 caractères) au lieu d'utiliser les UUIDs de la base de données ingredients.json.
 *
 * Solution : Ce script identifie ces ingrédients et remplace leur UUID par celui
 * de ingredients.json en se basant sur le nom de l'ingrédient.
 *
 * Usage :
 *   node scripts_dev/fix-ingredient-uuids.js --dry-run    # Aperçu des modifications
 *   node scripts_dev/fix-ingredient-uuids.js              # Appliquer les modifications
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const RECIPES_DIR = path.resolve(__dirname, '../content/recipe');
const INGREDIENTS_FILE = path.resolve(__dirname, '../static/data/ingredients.json');

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Vérifie si un UUID est généré par nanoid (21 caractères)
 */
function isNanoidUuid(uuid) {
  return typeof uuid === 'string' && uuid.length === 21;
}

/**
 * Charge le fichier ingredients.json et crée un index par nom
 */
function loadIngredientsIndex() {
  console.log(`📂 Chargement de ${INGREDIENTS_FILE}...`);

  if (!fs.existsSync(INGREDIENTS_FILE)) {
    console.error(`❌ Erreur: Le fichier ${INGREDIENTS_FILE} n'existe pas`);
    process.exit(1);
  }

  const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_FILE, 'utf8'));

  // Créer un index: nom -> UUID
  const index = {};
  for (const ingredient of ingredients) {
    if (ingredient.n && ingredient.u) {
      index[ingredient.n] = ingredient.u;
    }
  }

  console.log(`✅ ${ingredients.length} ingrédients chargés, ${Object.keys(index).length} entrées dans l'index`);
  return index;
}

/**
 * Parcourt récursivement le dossier des recettes
 */
function findRecipeFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findRecipeFiles(fullPath, files);
    } else if (entry.name === 'index.md') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Parse un fichier de recette YAML
 */
function parseRecipe(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parts = content.split('---');

  if (parts.length < 2) {
    return null;
  }

  try {
    return yaml.load(parts[1]);
  } catch (error) {
    console.error(`⚠️  Erreur de parsing YAML pour ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Génère le contenu complet du fichier avec les métadonnées mises à jour
 */
function generateRecipeContent(originalContent, updatedFrontmatter) {
  const parts = originalContent.split('---');

  if (parts.length < 2) {
    return originalContent;
  }

  // Garder le contenu original après le second '---'
  const bodyContent = parts.slice(2).join('---').trim();

  // Recréer le fichier avec les métadonnées mises à jour
  return `---\n${yaml.dump(updatedFrontmatter, {
    lineWidth: -1, // Pas de limite de longueur de ligne
    noRefs: true,  // Pas de références YAML
    quotingType: '"',
    forceQuotes: false
  }).trim()}\n---\n\n${bodyContent}\n`;
}

// ============================================================================
// LOGIQUE PRINCIPALE
// ============================================================================

/**
 * Analyse une recette et identifie les ingrédients avec des UUIDs nanoid
 */
function analyzeRecipe(filePath, ingredientsIndex) {
  const recipe = parseRecipe(filePath);

  if (!recipe || !recipe.ingredients || !Array.isArray(recipe.ingredients)) {
    return { hasIssues: false, issues: [] };
  }

  const issues = [];
  const needsUpdate = false;

  for (let i = 0; i < recipe.ingredients.length; i++) {
    const ingredient = recipe.ingredients[i];

    if (!ingredient.uuid || !ingredient.name) {
      continue;
    }

    // Vérifier si c'est un UUID nanoid
    if (isNanoidUuid(ingredient.uuid)) {
      const correctUuid = ingredientsIndex[ingredient.name];

      if (correctUuid) {
        issues.push({
          index: i,
          name: ingredient.name,
          oldUuid: ingredient.uuid,
          newUuid: correctUuid,
          quantity: ingredient.originalQuantity || 0,
          unit: ingredient.originalUnit || ''
        });
      } else {
        issues.push({
          index: i,
          name: ingredient.name,
          oldUuid: ingredient.uuid,
          newUuid: null, // Non trouvé dans ingredients.json
          quantity: ingredient.originalQuantity || 0,
          unit: ingredient.originalUnit || ''
        });
      }
    }
  }

  return {
    hasIssues: issues.length > 0,
    issues,
    recipe
  };
}

/**
 * Applique les corrections à une recette
 */
function fixRecipe(filePath, analysis, ingredientsIndex) {
  if (!analysis.hasIssues) {
    return { fixed: false, reason: 'Aucun problème détecté' };
  }

  const updatedIngredients = [...analysis.recipe.ingredients];

  for (const issue of analysis.issues) {
    if (issue.newUuid) {
      updatedIngredients[issue.index].uuid = issue.newUuid;
    }
  }

  analysis.recipe.ingredients = updatedIngredients;

  // 🔧 IMPORTANT: Mettre à jour le champ updatedAt pour forcer Hugo à prendre le dessus
  // sur Appwrite lors du Smart Merge (le plus récent gagne)
  analysis.recipe.updatedAt = new Date().toISOString();

  // Lire le contenu original pour préserver le body
  const originalContent = fs.readFileSync(filePath, 'utf8');
  const newContent = generateRecipeContent(originalContent, analysis.recipe);

  return {
    fixed: true,
    content: newContent
  };
}

// ============================================================================
// RAPPORTS
// ============================================================================

/**
 * Affiche un rapport détaillé des modifications
 */
function printReport(recipesWithIssues, dryRun = true) {
  const totalRecipes = recipesWithIssues.length;
  const totalIssues = recipesWithIssues.reduce((sum, r) => sum + r.issues.length, 0);
  const resolvedIssues = recipesWithIssues.reduce(
    (sum, r) => sum + r.issues.filter(i => i.newUuid).length,
    0
  );
  const unresolvedIssues = totalIssues - resolvedIssues;

  console.log('\n' + '='.repeat(80));
  console.log('📊 RAPPORT');
  console.log('='.repeat(80));
  console.log(`📁 Recettes analysées avec problèmes: ${totalRecipes}`);
  console.log(`🔧 Total des problèmes détectés: ${totalIssues}`);
  console.log(`✅ Problèmes résolubles: ${resolvedIssues}`);
  console.log(`❌ Problèmes non résolubles (ingrédient non trouvé): ${unresolvedIssues}`);
  console.log('='.repeat(80));

  if (totalRecipes === 0) {
    console.log('\n✨ Aucune correction nécessaire !');
    return;
  }

  console.log('\n📋 Détail par recette:\n');

  for (const { filePath, relativePath, issues } of recipesWithIssues) {
    console.log(`\n📄 ${relativePath}`);
    console.log(`   ${issues.length} problème(s) détecté(s)`);

    for (const issue of issues) {
      if (issue.newUuid) {
        console.log(`   ✅ "${issue.name}" (${issue.quantity} ${issue.unit})`);
        console.log(`      ${issue.oldUuid} → ${issue.newUuid}`);
      } else {
        console.log(`   ❌ "${issue.name}" (${issue.quantity} ${issue.unit})`);
        console.log(`      ${issue.oldUuid} → NON TROUVÉ dans ingredients.json`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));

  if (dryRun) {
    console.log('⚠️  MODE DRY RUN - Aucune modification appliquée');
    console.log('    Pour appliquer les modifications, relancez sans --dry-run');
  } else {
    console.log('✅ Modifications appliquées avec succès !');
  }

  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Usage: node fix-ingredient-uuids.js [options]

Options:
  --dry-run, -d    Mode aperçu (n'applique pas les modifications)
  --help, -h       Affiche cette aide

Exemples:
  node fix-ingredient-uuids.js --dry-run    # Voir les modifications sans appliquer
  node fix-ingredient-uuids.js              # Appliquer les modifications
    `);
    process.exit(0);
  }

  console.log('🔧 Script de correction des UUIDs d\'ingrédients\n');

  if (dryRun) {
    console.log('⚠️  MODE DRY RUN activé\n');
  }

  // Charger l'index des ingrédients
  const ingredientsIndex = loadIngredientsIndex();

  if (Object.keys(ingredientsIndex).length === 0) {
    console.error('❌ Erreur: L\'index des ingrédients est vide');
    process.exit(1);
  }

  // Trouver toutes les recettes
  console.log(`\n📂 Recherche des recettes dans ${RECIPES_DIR}...`);
  const recipeFiles = findRecipeFiles(RECIPES_DIR);
  console.log(`✅ ${recipeFiles.length} recettes trouvées\n`);

  // Analyser chaque recette
  const recipesWithIssues = [];

  for (const filePath of recipeFiles) {
    const relativePath = path.relative(RECIPES_DIR, filePath);
    const analysis = analyzeRecipe(filePath, ingredientsIndex);

    if (analysis.hasIssues) {
      recipesWithIssues.push({
        filePath,
        relativePath,
        ...analysis
      });
    }
  }

  // Afficher le rapport
  printReport(recipesWithIssues, dryRun);

  // Appliquer les modifications si pas en dry-run
  if (!dryRun && recipesWithIssues.length > 0) {
    console.log('⏳ Application des modifications...\n');

    let successCount = 0;
    let failCount = 0;

    for (const { filePath, relativePath } of recipesWithIssues) {
      try {
        // Re-analyser la recette pour avoir les données à jour
        const analysis = analyzeRecipe(filePath, ingredientsIndex);
        const result = fixRecipe(filePath, analysis, ingredientsIndex);

        if (result.fixed) {
          fs.writeFileSync(filePath, result.content, 'utf8');
          console.log(`✅ ${relativePath}`);
          successCount++;
        } else {
          console.log(`⏭️  ${relativePath}: ${result.reason}`);
        }
      } catch (error) {
        console.error(`❌ ${path.relative(RECIPES_DIR, filePath)}: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n✅ ${successCount} fichier(s) modifié(s)`);
    if (failCount > 0) {
      console.log(`❌ ${failCount} erreur(s)`);
    }
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

main();
