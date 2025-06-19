#!/usr/bin/env node

/**
 * Script de migration pour trier alphabétiquement les ingrédients
 * dans tous les fichiers JSON du dossier data/ingredients/
 * 
 * Usage: node scripts/sort-ingredients.js
 * ou: bun scripts/sort-ingredients.js
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chemin vers le dossier des ingrédients
const INGREDIENTS_DIR = join(__dirname, '..', 'data', 'ingredients');

/**
 * Trie les ingrédients par ordre alphabétique (insensible à la casse)
 * @param {Array} ingredients - Tableau des ingrédients
 * @returns {Array} - Tableau trié
 */
function sortIngredients(ingredients) {
  return ingredients.sort((a, b) => {
    const titleA = (a.title || '').toLowerCase();
    const titleB = (b.title || '').toLowerCase();
    return titleA.localeCompare(titleB, 'fr', { 
      numeric: true, 
      sensitivity: 'base' 
    });
  });
}

/**
 * Traite un fichier JSON d'ingrédients
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<boolean>} - true si le fichier a été modifié
 */
async function processIngredientsFile(filePath) {
  try {
    console.log(`📄 Traitement de ${filePath}...`);
    
    // Lire le fichier
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Vérifier la structure
    if (!data.ingredients || !Array.isArray(data.ingredients)) {
      console.log(`⚠️  Structure invalide dans ${filePath} - ignoré`);
      return false;
    }
    
    // Vérifier si le tri est nécessaire
    const originalIngredients = [...data.ingredients];
    const sortedIngredients = sortIngredients([...data.ingredients]);
    
    // Comparer les tableaux pour voir s'il y a eu des changements
    const hasChanged = JSON.stringify(originalIngredients) !== JSON.stringify(sortedIngredients);
    
    if (!hasChanged) {
      console.log(`✅ ${filePath} - Déjà trié`);
      return false;
    }
    
    // Mettre à jour les données
    data.ingredients = sortedIngredients;
    
    // Réécrire le fichier avec une indentation propre
    const updatedContent = JSON.stringify(data, null, 2);
    await writeFile(filePath, updatedContent, 'utf-8');
    
    console.log(`✅ ${filePath} - ${data.ingredients.length} ingrédients triés`);
    return true;
    
  } catch (error) {
    console.error(`❌ Erreur lors du traitement de ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Début de la migration - Tri des ingrédients\n');
  
  try {
    // Lire tous les fichiers du dossier ingredients
    const files = await readdir(INGREDIENTS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('⚠️  Aucun fichier JSON trouvé dans le dossier ingredients');
      return;
    }
    
    console.log(`📂 ${jsonFiles.length} fichier(s) JSON trouvé(s):`);
    jsonFiles.forEach(file => console.log(`   - ${file}`));
    console.log('');
    
    // Traiter chaque fichier
    let modifiedCount = 0;
    
    for (const file of jsonFiles) {
      const filePath = join(INGREDIENTS_DIR, file);
      const wasModified = await processIngredientsFile(filePath);
      if (wasModified) {
        modifiedCount++;
      }
    }
    
    console.log('\n🎉 Migration terminée !');
    console.log(`📊 Résumé:`);
    console.log(`   - Fichiers traités: ${jsonFiles.length}`);
    console.log(`   - Fichiers modifiés: ${modifiedCount}`);
    console.log(`   - Fichiers déjà triés: ${jsonFiles.length - modifiedCount}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
main().catch(console.error);