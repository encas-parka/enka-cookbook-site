#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// Chemins de base
const PUBLIC_RECETTES_DIR = '/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-site/public/recettes';
const CONTENT_RECETTES_DIR = '/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-site/content/recettes';

// Fonction pour lire les fichiers recipe.json et mettre à jour les index.md
async function updateIngredientsFrontmatter() {
  try {
    // Lire tous les dossiers de recettes dans public/recettes
    const recipeDirs = fs.readdirSync(PUBLIC_RECETTES_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    console.log(`Trouvé ${recipeDirs.length} dossiers de recettes`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const recipeDir of recipeDirs) {
      try {
        const recipeJsonPath = path.join(PUBLIC_RECETTES_DIR, recipeDir, 'recipe.json');
        const contentMdPath = path.join(CONTENT_RECETTES_DIR, recipeDir, 'index.md');

        // Vérifier que les deux fichiers existent
        if (!fs.existsSync(recipeJsonPath)) {
          console.warn(`⚠️  Fichier recipe.json introuvable: ${recipeJsonPath}`);
          continue;
        }

        if (!fs.existsSync(contentMdPath)) {
          console.warn(`⚠️  Fichier index.md introuvable: ${contentMdPath}`);
          continue;
        }

        // Lire le recipe.json
        const recipeData = JSON.parse(fs.readFileSync(recipeJsonPath, 'utf8'));

        // Lire le contenu actuel du index.md
        const contentMd = fs.readFileSync(contentMdPath, 'utf8');

        // Extraire le frontmatter YAML
        const frontmatterMatch = contentMd.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
          console.warn(`⚠️  Impossible de trouver le frontmatter dans: ${contentMdPath}`);
          continue;
        }

        const frontmatterContent = frontmatterMatch[1];
        const doc = yaml.load(frontmatterContent);

        // Vérifier que les ingrédients existent dans le recipe.json
        if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
          console.warn(`⚠️  Aucun ingrédient trouvé dans recipe.json: ${recipeJsonPath}`);
          continue;
        }

        // Transformer les ingrédients au nouveau format
        const newIngredients = recipeData.ingredients.map(ingredient => ({
          uuid: ingredient.uuid,
          name: ingredient.name,
          originalQuantity: ingredient.originalQuantity,
          originalUnit: ingredient.originalUnit,
          normalizedQuantity: ingredient.normalizedQuantity,
          normalizedUnit: ingredient.normalizedUnit,
          comment: ingredient.comment,
          allergens: ingredient.allergens,
          type: ingredient.type
        }));

        // Mettre à jour les ingrédients dans le frontmatter
        doc.ingredients = newIngredients;

        // Convertir le frontmatter mis à jour en YAML
        const updatedFrontmatter = yaml.dump(doc, {
          lineWidth: -1, // Désactiver le wrapping des lignes
          noCompatMode: true
        });

        // Remplacer le frontmatter dans le contenu
        const updatedContent = contentMd.replace(/^---\n([\s\S]*?)\n---/, `---\n${updatedFrontmatter}---`);

        // Écrire le fichier mis à jour
        fs.writeFileSync(contentMdPath, updatedContent, 'utf8');

        console.log(`✅ Mis à jour: ${recipeDir}`);
        updatedCount++;

      } catch (error) {
        console.error(`❌ Erreur lors du traitement de ${recipeDir}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Résumé:`);
    console.log(`- Recettes mises à jour: ${updatedCount}`);
    console.log(`- Erreurs rencontrées: ${errorCount}`);
    console.log(`- Total traité: ${updatedCount + errorCount}`);

  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
    process.exit(1);
  }
}

// Exécuter la fonction principale
updateIngredientsFrontmatter();