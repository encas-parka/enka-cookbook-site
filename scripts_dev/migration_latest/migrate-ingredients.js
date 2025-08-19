#!/usr/bin/env node

/**
 * Script de migration des ingrédients (1/2)
 *
 * Objectifs:
 * 1. Lire les données des ingrédients depuis `data/ingredients/ingredients.json`.
 * 2. Pour chaque ingrédient, générer un fichier Markdown dans `content/ingredients/`.
 * 3. Le répertoire de chaque ingrédient sera nommé `slug_uuid` (UUID de 6 caractères alphanumériques).
 * 4. Le frontmatter du Markdown ne contiendra que les champs `title`, `allergenes`, `pFrais`, et `type`.
 * 5. `alergenesIng` est renommé en `allergenes`.
 * 6. `itype` est renommé en `type`.
 * 7. Générer un fichier de mapping (`ingredient-slug-map.json`) qui associe le titre original de l'ingrédient à son nouveau `slug_uuid`.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths are relative to the project root for consistency
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATA_FILE = path.join(PROJECT_ROOT, 'data/ingredients/ingredients.json');
const OUT_DIR = path.join(PROJECT_ROOT, 'content/ingredients');
const MAP_FILE = path.join(__dirname, 'ingredient-slug-map.json');


// --- Helper Functions ---

/**
 * Generates a short, URL-safe, alphanumeric UUID.
 * @param {number} length - The desired length of the UUID.
 * @returns {string} The generated UUID.
 */
function generateShortUUID(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  // crypto.randomBytes is more secure than Math.random()
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    // The modulo operator ensures the index is within the bounds of the character set
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Converts a string into a URL-friendly slug.
 * Handles accents, special characters, and spacing.
 * @param {string} text - The string to slugify.
 * @returns {string} The slugified string.
 */
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD') // Decomposes accented characters into base characters and diacritics
    .replace(/[\u0300-\u036f]/g, '') // Removes the diacritics
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Removes all non-word characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replaces spaces with a single hyphen
    .replace(/-+/g, '-'); // Replaces multiple hyphens with a single one
}


// --- Main Execution ---

function main() {
  console.log('🚀 Démarrage de la migration des ingrédients (JSON vers Markdown)...');

  // 1. Read the source JSON file
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ Fichier de données non trouvé: ${DATA_FILE}`);
    console.error('   Veuillez d\'abord exécuter le script `merge_ingredients.py` pour le générer.');
    process.exit(1);
  }
  const sourceData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const ingredients = sourceData.ingredients || [];

  // 2. Prepare the output directory by cleaning it first
  if (fs.existsSync(OUT_DIR)) {
    console.log(`🧹 Nettoyage du répertoire de sortie: ${OUT_DIR}`);
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ingredientMap = {};
  const migratedIngredients = [];
  const uniqueDirectoryNames = new Set();

  // 3. Process each ingredient
  console.log(`\n📄 Traitement de ${ingredients.length} ingrédients...`);
  for (const ing of ingredients) {
    if (!ing.title || ing.title.trim() === '') {
      console.warn('  ⚠️  Ingrédient ignoré (pas de titre):', ing);
      continue;
    }

    // Generate slug and unique directory name
    const baseSlug = slugify(ing.title);
    let uuid, directoryName;
    do {
        uuid = generateShortUUID();
        directoryName = `${baseSlug}_${uuid}`;
    } while (uniqueDirectoryNames.has(directoryName)); // Ensure uniqueness
    uniqueDirectoryNames.add(directoryName);

    // Prepare frontmatter according to the new rules
    const frontmatter = {
      title: ing.title,
      allergenes: ing.alergenesIng || [], // Rename and provide default
      pFrais: ing.pFrais === true,        // Ensure boolean and provide default
      type: ing.itype || 'autre',         // Rename and provide default
    };

    // Create the directory and write the index.md file
    const ingredientDir = path.join(OUT_DIR, directoryName);
    fs.mkdirSync(ingredientDir, { recursive: true });

    const yamlFrontmatter = yaml.dump(frontmatter);
    const markdownContent = `---\n${yamlFrontmatter}---\n`;
    fs.writeFileSync(path.join(ingredientDir, 'index.md'), markdownContent, 'utf-8');

    // Store the mapping for the next script and log progress
    ingredientMap[ing.title] = directoryName;
    migratedIngredients.push({ title: ing.title, newSlug: directoryName });
    console.log(`  ✅ ${ing.title} -> ${directoryName}`);
  }

  // 4. Write the mapping file for the recipe update script
  fs.writeFileSync(MAP_FILE, JSON.stringify(ingredientMap, null, 2), 'utf-8');
  console.log(`\n🗺️  Fichier de mapping créé: ${MAP_FILE}`);


  // 5. Final Report
  console.log('\n🎉 Migration des ingrédients terminée!');
  console.log(`   - ${migratedIngredients.length} ingrédients ont été migrés.`);
  console.log(`   - Les fichiers Markdown sont disponibles dans: ${OUT_DIR}`);
  console.log('   - Le mapping pour la migration des recettes est prêt.');
  console.log('\n🎯 Prochaine étape: Exécuter le script `update-recipes.js` pour mettre à jour les recettes.');
}

// --- Script Entry Point ---
try {
  main();
} catch (error) {
  console.error('❌ Une erreur fatale est survenue lors de la migration des ingrédients:', error);
  process.exit(1);
}