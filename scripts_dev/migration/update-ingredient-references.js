#!/usr/bin/env node

/**
 * Script de deuxième passe pour mettre à jour les références d'ingrédients dans les recettes
 * 
 * Objectifs:
 * 1. Lire le rapport de migration généré par la première passe
 * 2. Créer un index des ingrédients par titre -> slug
 * 3. Mettre à jour les références d'ingrédients dans les recettes (titre -> slug)
 * 4. Renommer les répertoires des ingrédients et recettes avec les nouveaux slugs
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// Reconstitution __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fonction pour normaliser un titre pour le slug (avec gestion des accents)
function normalizeTitleForSlug(title) {
  return title
    .toLowerCase()
    // Gérer les caractères accentués
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/[œ]/g, 'oe')
    .replace(/[æ]/g, 'ae')
    // Supprimer les caractères spéciaux sauf les tirets et espaces
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-') // Remplacer les espaces par des tirets
    .replace(/-+/g, '-') // Éviter les tirets multiples
    .trim('-'); // Supprimer les tirets au début et à la fin
}

// Configuration
const CONTENT_ROOT = path.join(__dirname, '..', '..', 'content');
const INGREDIENTS_DIR = path.join(CONTENT_ROOT, 'ingredients');
const RECETTES_DIR = path.join(CONTENT_ROOT, 'recettes');
const EVENEMENTS_DIR = path.join(CONTENT_ROOT, 'evenements');
const REPORT_PATH = path.join(__dirname, 'migration-report.json');

// Fonction pour lire un fichier frontmatter
function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontmatterMatch) {
    throw new Error(`Pas de frontmatter trouvé dans ${filePath}`);
  }
  
  const frontmatterYaml = frontmatterMatch[1];
  const bodyContent = content.substring(frontmatterMatch[0].length);
  
  try {
    const frontmatter = yaml.load(frontmatterYaml);
    return { frontmatter, bodyContent };
  } catch (error) {
    throw new Error(`Erreur de parsing YAML dans ${filePath}: ${error.message}`);
  }
}

// Fonction pour écrire un fichier frontmatter
function writeFrontmatter(filePath, frontmatter, bodyContent) {
  const frontmatterYaml = yaml.dump(frontmatter, {
    defaultFlowStyle: false,
    lineWidth: -1,
  });
  
  const content = `---\n${frontmatterYaml}---\n${bodyContent}`;
  fs.writeFileSync(filePath, content, 'utf8');
}

// Fonction pour créer un index des ingrédients par titre
function createIngredientIndex(migratedIngredients) {
  const index = {};
  
  migratedIngredients.forEach(ing => {
    // Index par titre original
    index[ing.oldTitle] = {
      slug: ing.newSlug,
      uuid: ing.uuid,
      type: ing.type
    };
    
    // Index par titre normalisé (pour gérer les différences d'accents/espaces)
    const normalizedTitle = normalizeTitleForSlug(ing.oldTitle);
    if (normalizedTitle !== ing.oldTitle.toLowerCase()) {
      index[normalizedTitle] = {
        slug: ing.newSlug,
        uuid: ing.uuid,
        type: ing.type
      };
    }
  });
  
  return index;
}

// Fonction pour mettre à jour les références d'ingrédients dans une recette
function updateIngredientReferences(recettePath, ingredientIndex) {
  try {
    const { frontmatter, bodyContent } = readFrontmatter(recettePath);
    
    if (!frontmatter.ingredients) {
      console.log(`  ⏭️  Pas d'ingrédients à mettre à jour`);
      return false;
    }
    
    // Si les ingrédients sont encore dans l'ancien format (objet groupé par type)
    if (typeof frontmatter.ingredients === 'object' && !Array.isArray(frontmatter.ingredients)) {
      console.log(`  🔄 Conversion de l'ancien format des ingrédients vers le nouveau format...`);
      const newIngredients = [];
      
      // Parcourir chaque type d'ingrédient
      Object.keys(frontmatter.ingredients).forEach(type => {
        const ingredientsOfType = frontmatter.ingredients[type];
        
        if (Array.isArray(ingredientsOfType)) {
          ingredientsOfType.forEach(ing => {
            if (ing.title) {
              // Chercher l'ingrédient dans l'index
              const ingredientData = ingredientIndex[ing.title] || ingredientIndex[normalizeTitleForSlug(ing.title)];
              
              if (ingredientData) {
                newIngredients.push({
                  ingredient: ingredientData.slug,
                  quantite: ing.quantite,
                  unit: ing.unit,
                  commentaire: ing.commentaire || ''
                });
                console.log(`    ✅ ${ing.title} -> ${ingredientData.slug}`);
              } else {
                // Si non trouvé, garder le titre mais marquer comme non résolu
                newIngredients.push({
                  ingredient: ing.title,
                  quantite: ing.quantite,
                  unit: ing.unit,
                  commentaire: ing.commentaire || ''
                });
                console.log(`    ⚠️  Ingrédient non trouvé: ${ing.title}`);
              }
            }
          });
        }
      });
      
      // Remplacer l'ancienne structure par la nouvelle
      frontmatter.ingredients = newIngredients;
      writeFrontmatter(recettePath, frontmatter, bodyContent);
      console.log(`  ✅ Structure des ingrédients convertie: ${newIngredients.length} ingrédients`);
      return true;
    }
    
    // Si les ingrédients sont déjà au nouveau format (tableau)
    if (!Array.isArray(frontmatter.ingredients)) {
      console.log(`  ⚠️  Format des ingrédients non reconnu`);
      return false;
    }
    
    let updated = false;
    const unresolvedIngredients = [];
    
    // Mettre à jour chaque référence d'ingrédient
    frontmatter.ingredients.forEach(ing => {
      if (ing.ingredient && typeof ing.ingredient === 'string') {
        // Essayer de trouver l'ingrédient par titre original ou par titre normalisé
        const ingredientData = ingredientIndex[ing.ingredient] || ingredientIndex[normalizeTitleForSlug(ing.ingredient)];
        
        if (ingredientData) {
          // Remplacer le titre par le slug
          ing.ingredient = ingredientData.slug;
          updated = true;
          console.log(`    ✅ ${ing.ingredient} -> ${ingredientData.slug}`);
        } else {
          // Vérifier si c'est déjà un slug (contient un UUID)
          if (ing.ingredient.includes('_')) {
            console.log(`    ⏭️  Déjà un slug: ${ing.ingredient}`);
          } else {
            unresolvedIngredients.push(ing.ingredient);
            console.log(`    ⚠️  Ingrédient non trouvé: ${ing.ingredient}`);
          }
        }
      }
    });
    
    if (updated) {
      writeFrontmatter(recettePath, frontmatter, bodyContent);
      console.log(`  ✅ Références mises à jour dans ${recettePath}`);
    }
    
    if (unresolvedIngredients.length > 0) {
      console.log(`  ⚠️  Ingrédients non résolus: ${unresolvedIngredients.join(', ')}`);
    }
    
    return updated;
    
  } catch (error) {
    console.error(`  ❌ Erreur lors de la mise à jour des références dans ${recettePath}: ${error.message}`);
    return false;
  }
}

// Fonction pour renommer un répertoire
function renameDirectory(oldPath, newPath) {
  try {
    // Vérifier si le nouveau répertoire existe déjà
    if (fs.existsSync(newPath)) {
      console.log(`  ⚠️  Le répertoire ${newPath} existe déjà, suppression de l'ancien...`);
      fs.rmSync(oldPath, { recursive: true, force: true });
      return false;
    }
    
    fs.renameSync(oldPath, newPath);
    console.log(`  ✅ Répertoire renommé: ${path.basename(oldPath)} -> ${path.basename(newPath)}`);
    return true;
    
  } catch (error) {
    console.error(`  ❌ Erreur lors du renommage de ${oldPath} vers ${newPath}: ${error.message}`);
    return false;
  }
}

// Fonction principale de mise à jour
async function main() {
  console.log('🔄 Démarrage de la deuxième passe: mise à jour des références...\n');
  
  // Vérifier si le rapport de migration existe
  if (!fs.existsSync(REPORT_PATH)) {
    console.error('❌ Rapport de migration non trouvé. Exécutez d\'abord la première passe.');
    process.exit(1);
  }
  
  // Lire le rapport de migration
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const { migratedIngredients, migratedRecettes, migratedEvenements } = report;
  
  console.log(`📊 Rapport chargé: ${migratedIngredients.length} ingrédients, ${migratedRecettes.length} recettes, ${migratedEvenements?.length || 0} événements\n`);
  
  // Créer l'index des ingrédients
  console.log('📋 Création de l\'index des ingrédients...');
  const ingredientIndex = createIngredientIndex(migratedIngredients);
  console.log(`✅ Index créé avec ${Object.keys(ingredientIndex).length} ingrédients\n`);
  
  // Mettre à jour les références dans les recettes
  console.log('🔄 Mise à jour des références d\'ingrédients dans les recettes...');
  let updatedRecettes = 0;
  
  // Si les recettes ont déjà été renommées, chercher dans les nouveaux chemins
  if (migratedRecettes.length === 0) {
    console.log('  🔍 Aucune recette dans le rapport, recherche des recettes déjà renommées...');
    
    // Parcourir tous les sous-répertoires de recettes
    const recetteTypes = ['dessert', 'entree', 'plat'];
    
    for (const type of recetteTypes) {
      const typeDir = path.join(RECETTES_DIR, type);
      
      if (fs.existsSync(typeDir)) {
        const items = fs.readdirSync(typeDir, { withFileTypes: true });
        
        for (const item of items) {
          if (item.isDirectory()) {
            const recettePath = path.join(typeDir, item.name, 'index.md');
            
            if (fs.existsSync(recettePath)) {
              console.log(`\n📂 Traitement de la recette: ${item.name}`);
              const updated = updateIngredientReferences(recettePath, ingredientIndex);
              if (updated) {
                updatedRecettes++;
              }
            }
          }
        }
      }
    }
  } else {
    // Traitement normal si le rapport contient des recettes
    for (const recette of migratedRecettes) {
      console.log(`\n📂 Traitement de la recette: ${recette.oldTitle}`);
      const recettePath = path.join(recette.oldPath, 'index.md');
      
      if (fs.existsSync(recettePath)) {
        const updated = updateIngredientReferences(recettePath, ingredientIndex);
        if (updated) {
          updatedRecettes++;
        }
      } else {
        console.log(`  ⚠️  Fichier non trouvé: ${recettePath}`);
      }
    }
  }
  
  console.log(`\n✅ Mise à jour des références terminée: ${updatedRecettes} recettes mises à jour`);
  
  // Renommer les répertoires des ingrédients
  console.log('\n📁 Renommage des répertoires d\'ingrédients...');
  let renamedIngredients = 0;
  
  for (const ingredient of migratedIngredients) {
    console.log(`\n📂 Renommage de l'ingrédient: ${ingredient.oldTitle}`);
    
    if (fs.existsSync(ingredient.oldPath)) {
      const success = renameDirectory(ingredient.oldPath, ingredient.newPath);
      if (success) {
        renamedIngredients++;
      }
    } else {
      console.log(`  ⚠️  Répertoire non trouvé: ${ingredient.oldPath}`);
    }
  }
  
  console.log(`\n✅ Renommage des ingrédients terminé: ${renamedIngredients} répertoires renommés`);
  
  // Renommer les répertoires des recettes
  console.log('\n📁 Renommage des répertoires de recettes...');
  let renamedRecettes = 0;
  
  if (migratedRecettes.length === 0) {
    console.log('  ⏭️  Les recettes semblent déjà renommées, passage au traitement suivant...');
  } else {
    for (const recette of migratedRecettes) {
      console.log(`\n📂 Renommage de la recette: ${recette.oldTitle}`);
      
      if (fs.existsSync(recette.oldPath)) {
        const success = renameDirectory(recette.oldPath, recette.newPath);
        if (success) {
          renamedRecettes++;
        }
      } else {
        console.log(`  ⚠️  Répertoire non trouvé: ${recette.oldPath}`);
      }
    }
  }
  
  console.log(`\n✅ Renommage des recettes terminé: ${renamedRecettes} répertoires renommés`);
  
  // Renommer les répertoires des événements
  console.log('\n📁 Renommage des répertoires d\'événements...');
  let renamedEvenements = 0;
  
  if (migratedEvenements) {
    for (const evenement of migratedEvenements) {
      console.log(`\n📂 Renommage de l'événement: ${evenement.oldTitle}`);
      
      if (fs.existsSync(evenement.oldPath)) {
        const success = renameDirectory(evenement.oldPath, evenement.newPath);
        if (success) {
          renamedEvenements++;
        }
      } else {
        console.log(`  ⚠️  Répertoire non trouvé: ${evenement.oldPath}`);
      }
    }
  }
  
  console.log(`\n✅ Renommage des événements terminé: ${renamedEvenements} répertoires renommés`);
  
  // Générer le rapport final
  console.log('\n📊 Rapport final de migration:');
  console.log(`   Ingrédients migrés: ${migratedIngredients.length}`);
  console.log(`   Recettes migrées: ${migratedRecettes.length}`);
  console.log(`   Événements migrés: ${migratedEvenements?.length || 0}`);
  console.log(`   Références mises à jour: ${updatedRecettes}`);
  console.log(`   Répertoires d'ingrédients renommés: ${renamedIngredients}`);
  console.log(`   Répertoires de recettes renommés: ${renamedRecettes}`);
  console.log(`   Répertoires d'événements renommés: ${renamedEvenements}`);
  
  // Sauvegarder le rapport final
  const finalReport = {
    ...report,
    updatedRecettes,
    renamedIngredients,
    renamedRecettes,
    renamedEvenements,
    ingredientIndex,
    timestamp: new Date().toISOString()
  };
  
  const finalReportPath = path.join(import.meta.dirname, 'migration-final-report.json');
  fs.writeFileSync(finalReportPath, JSON.stringify(finalReport, null, 2));
  
  console.log(`\n💾 Rapport final sauvegardé dans: ${finalReportPath}`);
  console.log('\n🎉 Migration terminée! Vous pouvez maintenant tester les layouts avec le nouveau contenu.');
}

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erreur non gérée:', reason);
  process.exit(1);
});

// Lancer la mise à jour
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { updateIngredientReferences, createIngredientIndex, renameDirectory };