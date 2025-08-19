#!/usr/bin/env node

/**
 * Script de migration des recettes (2/2)
 *
 * Objectifs:
 * 1. Lire le mapping des ingrédients généré par `migrate-ingredients.js`.
 * 2. Parcourir tous les fichiers de recettes dans `content/recettes/`.
 * 3. Transformer la structure des ingrédients en un tableau plat si nécessaire.
 * 4. Mettre à jour les références aux ingrédients (de `title` vers `slug_uuid`).
 * 5. Renommer le champ `title` en `ingredient`.
 * 6. S'assurer qu'un champ `commentaire` est présent.
 * 7. Lister les ingrédients non résolus dans un rapport final.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const RECETTES_DIR = path.join(PROJECT_ROOT, 'content', 'recettes');
const MAP_FILE = path.join(__dirname, 'ingredient-slug-map.json');

// --- Helper Functions ---

/**
 * Converts a string into a URL-friendly slug.
 * @param {string} text - The string to slugify.
 * @returns {string} The slugified string.
 */
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Reads the frontmatter and body content from a markdown file.
 * @param {string} filePath - Path to the markdown file.
 * @returns {object} An object containing `frontmatter` (object) and `bodyContent` (string).
 */
function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    // If no frontmatter, treat the whole file as body content
    return { frontmatter: {}, bodyContent: content };
  }

  const frontmatterYaml = frontmatterMatch[1];
  const bodyContent = content.substring(frontmatterMatch[0].length);

  try {
    const frontmatter = yaml.load(frontmatterYaml);
    return { frontmatter, bodyContent };
  } catch (error) {
    console.error(`Erreur de parsing YAML dans ${filePath}: ${error.message}`);
    // Return empty frontmatter on error to avoid crashing the whole process
    return { frontmatter: {}, bodyContent };
  }
}

/**
 * Writes the frontmatter and body content to a markdown file.
 * @param {string} filePath - Path to the markdown file.
 * @param {object} frontmatter - The frontmatter object.
 * @param {string} bodyContent - The body content string.
 */
function writeFrontmatter(filePath, frontmatter, bodyContent) {
  const frontmatterYaml = yaml.dump(frontmatter, {
    defaultFlowStyle: false,
    lineWidth: -1,
  });
  const content = `---\n${frontmatterYaml}---\n${bodyContent}`;
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Recursively finds all recipe files (index.md) within a directory.
 * @param {string} dir - The directory to search.
 * @param {Array} fileArray - An array to accumulate the found file paths.
 * @returns {Array} An array of file paths.
 */
function findRecipeFiles(dir, fileArray = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      // Recurse into subdirectories
      findRecipeFiles(fullPath, fileArray);
    } else if (item.isFile() && item.name === 'index.md') {
      fileArray.push(fullPath);
    }
  }

  return fileArray;
}

// --- Main Execution ---

function main() {
  console.log('🔄 Démarrage de la mise à jour des recettes...');

  // 1. Read the ingredient mapping file
  if (!fs.existsSync(MAP_FILE)) {
    console.error(`❌ Fichier de mapping non trouvé: ${MAP_FILE}`);
    console.error('   Veuillez d\'abord exécuter le script `migrate-ingredients.js`.');
    process.exit(1);
  }
  const ingredientMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
  console.log(`🗺️  Mapping des ingrédients chargé: ${Object.keys(ingredientMap).length} ingrédients trouvés.\n`);

  // 2. Find all recipe files
  if (!fs.existsSync(RECETTES_DIR)) {
    console.error(`❌ Répertoire des recettes non trouvé: ${RECETTES_DIR}`);
    process.exit(1);
  }
  const recipeFiles = findRecipeFiles(RECETTES_DIR);
  console.log(`📄 ${recipeFiles.length} fichiers de recettes trouvés.\n`);

  const unresolvedIngredients = new Map(); // Map<recipeTitle, Array<unresolvedIngredientTitle>>

  // 3. Process each recipe file
  for (const recipePath of recipeFiles) {
    const relativePath = path.relative(PROJECT_ROOT, recipePath);
    console.log(`📂 Traitement de la recette: ${relativePath}`);

    try {
      const { frontmatter, bodyContent } = readFrontmatter(recipePath);

      if (!frontmatter.ingredients) {
        console.log('  ⏭️  Pas d\'ingrédients à traiter.');
        continue;
      }

      let updated = false;
      let newIngredients = [];

      // --- Handle ingredient structure transformation ---
      if (typeof frontmatter.ingredients === 'object' && !Array.isArray(frontmatter.ingredients)) {
        // Old format: { type: [ {title, ...} ] }
        console.log('  🔄 Conversion de l\'ancien format des ingrédients...');
        for (const type in frontmatter.ingredients) {
          const ingredientsOfType = frontmatter.ingredients[type];
          if (Array.isArray(ingredientsOfType)) {
            ingredientsOfType.forEach(ing => {
              newIngredients.push(ing);
            });
          }
        }
        updated = true;
      } else if (Array.isArray(frontmatter.ingredients)) {
        // New format: [ {title, ...} ]
        newIngredients = frontmatter.ingredients;
      } else {
        console.log(`  ⚠️  Format des ingrédients non reconnu, ignoré.`);
        continue;
      }

      // --- Update ingredient references ---
      const finalIngredients = [];
      for (const ing of newIngredients) {
        if (!ing.title) {
          console.log(`  ⚠️  Ingrédient sans titre ignoré.`);
          continue;
        }

        const originalTitle = ing.title;
        const mappedSlug = ingredientMap[originalTitle];

        if (mappedSlug) {
          // Found in map, use the new slug_uuid
          finalIngredients.push({
            ingredient: mappedSlug,
            quantite: ing.quantite,
            unit: ing.unit,
            commentaire: ing.commentaire || ''
          });
          console.log(`    ✅ ${originalTitle} -> ${mappedSlug}`);
        } else {
          // Not found in map, use the slugified title and report
          const slugifiedTitle = slugify(originalTitle);
          finalIngredients.push({
            ingredient: slugifiedTitle,
            quantite: ing.quantite,
            unit: ing.unit,
            commentaire: ing.commentaire || ''
          });
          console.log(`    ⚠️  Ingrédient non résolu: ${originalTitle} -> ${slugifiedTitle}`);
          
          // Add to unresolved report
          const recipeTitle = frontmatter.title || relativePath;
          if (!unresolvedIngredients.has(recipeTitle)) {
            unresolvedIngredients.set(recipeTitle, []);
          }
          unresolvedIngredients.get(recipeTitle).push(originalTitle);
        }
      }

      // --- Write back the updated frontmatter ---
      if (updated || finalIngredients.length > 0) {
        frontmatter.ingredients = finalIngredients;
        writeFrontmatter(recipePath, frontmatter, bodyContent);
        console.log(`  ✅ Recette mise à jour: ${relativePath}`);
      }

    } catch (error) {
      console.error(`  ❌ Erreur lors du traitement de ${relativePath}: ${error.message}`);
    }
    console.log(''); // Add a newline for better readability
  }

  // 4. Final report
  console.log('\n🎉 Mise à jour des recettes terminée!');
  console.log(`   - ${recipeFiles.length} fichiers de recettes ont été traités.`);

  if (unresolvedIngredients.size > 0) {
    console.log('\n⚠️  Rapport des ingrédients non résolus:');
    console.log('   Ces ingrédients n\'ont pas été trouvés dans le mapping généré depuis les données JSON.');
    console.log('   Leurs références dans les recettes ont été remplacées par leur titre slugifié.\n');
    for (const [recipeTitle, ingredients] of unresolvedIngredients.entries()) {
      console.log(`   - Recette: "${recipeTitle}"`);
      ingredients.forEach(ingTitle => {
        console.log(`     - ${ingTitle}`);
      });
    }
  } else {
    console.log('\n✅ Toutes les références d\'ingrédients ont été résolues avec succès!');
  }
}

// --- Script Entry Point ---
try {
  main();
} catch (error) {
  console.error('❌ Une erreur fatale est survenue lors de la mise à jour des recettes:', error);
  process.exit(1);
}