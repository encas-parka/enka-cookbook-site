#!/usr/bin/env node

/**
 * Script de vérification post-migration
 *
 * Objectifs:
 * 1. Vérifier que tous les ingrédients ont un UUID et un slug correct
 * 2. Vérifier que toutes les recettes ont un UUID et un slug correct
 * 3. Vérifier que les références d'ingrédients dans les recettes utilisent bien les slugs
 * 4. Identifier les problèmes potentiels
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// Reconstitution __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONTENT_ROOT = path.join(__dirname, '..', '..', 'content');
const INGREDIENTS_DIR = path.join(CONTENT_ROOT, 'ingredients');
const RECETTES_DIR = path.join(CONTENT_ROOT, 'recettes');
const EVENEMENTS_DIR = path.join(CONTENT_ROOT, 'evenements');
const FINAL_REPORT_PATH = path.join(__dirname, 'migration-final-report.json');

// Plus de filtres de test - tous les fichiers seront traités

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

// Fonction pour vérifier un ingrédient
function verifyIngredient(ingredientDir) {
  const indexPath = path.join(ingredientDir, 'index.md');
  const dirName = path.basename(ingredientDir);

  if (!fs.existsSync(indexPath)) {
    return {
      path: ingredientDir,
      valid: false,
      errors: ['Pas de fichier index.md']
    };
  }

  const errors = [];
  const warnings = [];

  try {
    const { frontmatter } = readFrontmatter(indexPath);

    // Vérifier la présence de l'UUID
    if (!frontmatter.uuid) {
      errors.push('UUID manquant');
    } else if (typeof frontmatter.uuid !== 'string') {
      errors.push(`UUID invalide: doit être une chaîne, trouvé ${typeof frontmatter.uuid}`);
    } else if (frontmatter.uuid.length !== 8) {
      warnings.push(`UUID a une longueur inhabituelle: ${frontmatter.uuid.length} caractères (attendu: 8)`);
    }

    // Vérifier que le slug du répertoire contient l'UUID
    const slugParts = dirName.split('_');
    if (slugParts.length < 2) {
      errors.push('Slug du répertoire ne contient pas d\'UUID (format: titre_uuid)');
    } else {
      const uuidFromSlug = slugParts[slugParts.length - 1];
      if (uuidFromSlug !== frontmatter.uuid) {
        errors.push(`UUID dans le slug (${uuidFromSlug}) ne correspond pas à l'UUID dans le frontmatter (${frontmatter.uuid})`);
      }
    }

    // Vérifier les champs obligatoires
    if (!frontmatter.title) {
      errors.push('Titre manquant');
    }
    if (!frontmatter.type) {
      errors.push('Type manquant');
    }

    return {
      path: ingredientDir,
      title: frontmatter.title,
      uuid: frontmatter.uuid,
      type: frontmatter.type,
      valid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    return {
      path: ingredientDir,
      valid: false,
      errors: [`Erreur de lecture: ${error.message}`]
    };
  }
}

// Fonction pour vérifier une recette
function verifyRecette(recetteDir) {
  const indexPath = path.join(recetteDir, 'index.md');
  const dirName = path.basename(recetteDir);

  if (!fs.existsSync(indexPath)) {
    return {
      path: recetteDir,
      valid: false,
      errors: ['Pas de fichier index.md']
    };
  }

  const errors = [];
  const warnings = [];

  try {
    const { frontmatter } = readFrontmatter(indexPath);

    // Vérifier la présence de l'UUID
    if (!frontmatter.uuid) {
      errors.push('UUID manquant');
    } else if (typeof frontmatter.uuid !== 'string') {
      errors.push(`UUID invalide: doit être une chaîne, trouvé ${typeof frontmatter.uuid}`);
    } else if (frontmatter.uuid.length !== 8) {
      warnings.push(`UUID a une longueur inhabituelle: ${frontmatter.uuid.length} caractères (attendu: 8)`);
    }

    // Vérifier que le slug du répertoire contient l'UUID
    const slugParts = dirName.split('_');
    if (slugParts.length < 2) {
      errors.push('Slug du répertoire ne contient pas d\'UUID (format: titre_uuid)');
    } else {
      const uuidFromSlug = slugParts[slugParts.length - 1];
      if (uuidFromSlug !== frontmatter.uuid) {
        errors.push(`UUID dans le slug (${uuidFromSlug}) ne correspond pas à l'UUID dans le frontmatter (${frontmatter.uuid})`);
      }
    }

    // Vérifier les champs obligatoires
    if (!frontmatter.title) {
      errors.push('Titre manquant');
    }
    if (!frontmatter.type) {
      errors.push('Type manquant');
    }

    // Vérifier la structure des ingrédients
    if (frontmatter.ingredients) {
      if (!Array.isArray(frontmatter.ingredients)) {
        errors.push('Les ingrédients doivent être un tableau');
      } else {
        const ingredientIssues = [];
        frontmatter.ingredients.forEach((ing, index) => {
          if (!ing.ingredient) {
            ingredientIssues.push(`Ingrédient ${index}: champ 'ingredient' manquant`);
          } else if (typeof ing.ingredient !== 'string') {
            ingredientIssues.push(`Ingrédient ${index}: champ 'ingredient' doit être une chaîne`);
          } else if (!ing.ingredient.includes('_')) {
            ingredientIssues.push(`Ingrédient ${index}: référence '${ing.ingredient}' n'est pas un slug (format: titre_uuid)`);
          }

          if (!ing.quantite) {
            ingredientIssues.push(`Ingrédient ${index}: champ 'quantite' manquant`);
          }
        });

        if (ingredientIssues.length > 0) {
          errors.push(...ingredientIssues);
        }
      }
    }

    return {
      path: recetteDir,
      title: frontmatter.title,
      uuid: frontmatter.uuid,
      type: frontmatter.type,
      valid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    return {
      path: recetteDir,
      valid: false,
      errors: [`Erreur de lecture: ${error.message}`]
    };
  }
}

// Fonction pour vérifier un événement
function verifyEvenement(evenementDir) {
  const indexPath = path.join(evenementDir, 'index.md');
  const dirName = path.basename(evenementDir);

  if (!fs.existsSync(indexPath)) {
    return {
      path: evenementDir,
      valid: false,
      errors: ['Pas de fichier index.md']
    };
  }

  const errors = [];
  const warnings = [];

  try {
    const { frontmatter } = readFrontmatter(indexPath);

    // Vérifier la présence de l'UUID
    if (!frontmatter.uuid) {
      errors.push('UUID manquant');
    } else if (typeof frontmatter.uuid !== 'string') {
      errors.push(`UUID invalide: doit être une chaîne, trouvé ${typeof frontmatter.uuid}`);
    } else if (frontmatter.uuid.length !== 8) {
      warnings.push(`UUID a une longueur inhabituelle: ${frontmatter.uuid.length} caractères (attendu: 8)`);
    }

    // Vérifier que le slug du répertoire contient l'UUID
    const slugParts = dirName.split('_');
    if (slugParts.length < 2) {
      errors.push('Slug du répertoire ne contient pas d\'UUID (format: titre_uuid)');
    } else {
      const uuidFromSlug = slugParts[slugParts.length - 1];
      if (uuidFromSlug !== frontmatter.uuid) {
        errors.push(`UUID dans le slug (${uuidFromSlug}) ne correspond pas à l'UUID dans le frontmatter (${frontmatter.uuid})`);
      }
    }

    // Vérifier les champs obligatoires
    if (!frontmatter.title) {
      errors.push('Titre manquant');
    }

    // Vérifier la structure des repas et des références aux recettes
    if (frontmatter.repas) {
      if (!Array.isArray(frontmatter.repas)) {
        errors.push('Les repas doivent être un tableau');
      } else {
        const repasIssues = [];
        frontmatter.repas.forEach((repas, repasIndex) => {
          if (!repas.recettes_du_repas || !Array.isArray(repas.recettes_du_repas)) {
            repasIssues.push(`Repas ${repasIndex}: champ 'recettes_du_repas' manquant ou invalide`);
          } else {
            repas.recettes_du_repas.forEach((recetteRef, recetteIndex) => {
              if (!recetteRef.recette) {
                repasIssues.push(`Repas ${repasIndex}, recette ${recetteIndex}: champ 'recette' manquant`);
              } else if (typeof recetteRef.recette !== 'string') {
                repasIssues.push(`Repas ${repasIndex}, recette ${recetteIndex}: champ 'recette' doit être une chaîne`);
              } else if (!recetteRef.recette.includes('_')) {
                repasIssues.push(`Repas ${repasIndex}, recette ${recetteIndex}: référence '${recetteRef.recette}' n'est pas un slug (format: titre_uuid)`);
              }
            });
          }
        });

        if (repasIssues.length > 0) {
          errors.push(...repasIssues);
        }
      }
    }

    return {
      path: evenementDir,
      title: frontmatter.title,
      uuid: frontmatter.uuid,
      valid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    return {
      path: evenementDir,
      valid: false,
      errors: [`Erreur de lecture: ${error.message}`]
    };
  }
}

// Fonction principale de vérification
async function main() {
  console.log('🔍 Démarrage de la vérification post-migration...\n');

  const ingredientResults = [];
  const recetteResults = [];
  const evenementResults = [];

  // Vérification des ingrédients
  console.log('📦 Vérification des ingrédients...');
  const ingredientDirs = fs.readdirSync(INGREDIENTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const dirName of ingredientDirs) {
    console.log(`\n📂 Vérification de l'ingrédient: ${dirName}`);
    const ingredientDir = path.join(INGREDIENTS_DIR, dirName);
    const result = verifyIngredient(ingredientDir);
    ingredientResults.push(result);

    if (result.valid) {
      console.log(`  ✅ ${result.title} (${result.uuid})`);
    } else {
      console.log(`  ❌ ${result.errors.join(', ')}`);
    }

    if (result.warnings.length > 0) {
      console.log(`  ⚠️  ${result.warnings.join(', ')}`);
    }
  }

  // Vérification des recettes
  console.log('\n🍳 Vérification des recettes...');
  const recetteTypes = ['plat', 'entree', 'dessert'];

  for (const type of recetteTypes) {
    const typeDir = path.join(RECETTES_DIR, type);

    if (!fs.existsSync(typeDir)) {
      console.log(`  ⚠️  Répertoire ${type} non trouvé, ignoré`);
      continue;
    }

    const recetteDirs = fs.readdirSync(typeDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dirName of recetteDirs) {
      console.log(`\n📂 Vérification de la recette: ${type}/${dirName}`);
      const recetteDir = path.join(typeDir, dirName);
      const result = verifyRecette(recetteDir);
      recetteResults.push(result);

      if (result.valid) {
        console.log(`  ✅ ${result.title} (${result.uuid})`);
      } else {
        console.log(`  ❌ ${result.errors.join(', ')}`);
      }

      if (result.warnings.length > 0) {
        console.log(`  ⚠️  ${result.warnings.join(', ')}`);
      }
    }
  }

  // Vérification des événements
  console.log('\n📅 Vérification des événements...');

  if (fs.existsSync(EVENEMENTS_DIR)) {
    const evenementDirs = fs.readdirSync(EVENEMENTS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dirName of evenementDirs) {
      console.log(`\n📂 Vérification de l'événement: ${dirName}`);
      const evenementDir = path.join(EVENEMENTS_DIR, dirName);
      const result = verifyEvenement(evenementDir);
      evenementResults.push(result);

      if (result.valid) {
        console.log(`  ✅ ${result.title} (${result.uuid})`);
      } else {
        console.log(`  ❌ ${result.errors.join(', ')}`);
      }

      if (result.warnings.length > 0) {
        console.log(`  ⚠️  ${result.warnings.join(', ')}`);
      }
    }
  } else {
    console.log('  ⚠️  Répertoire evenements/ non trouvé, ignoré');
  }

  // Générer le rapport de vérification
  console.log('\n📊 Rapport de vérification:');

  const validIngredients = ingredientResults.filter(r => r.valid).length;
  const invalidIngredients = ingredientResults.filter(r => !r.valid).length;
  const validRecettes = recetteResults.filter(r => r.valid).length;
  const invalidRecettes = recetteResults.filter(r => !r.valid).length;

  console.log(`   Ingrédients valides: ${validIngredients}/${ingredientResults.length}`);
  console.log(`   Recettes valides: ${validRecettes}/${recetteResults.length}`);

  const validEvenements = evenementResults.filter(r => r.valid).length;
  const invalidEvenements = evenementResults.filter(r => !r.valid).length;
  console.log(`   Événements valides: ${validEvenements}/${evenementResults.length}`);

  if (invalidIngredients > 0) {
    console.log(`\n❌ Ingrédients invalides (${invalidIngredients}):`);
    ingredientResults.filter(r => !r.valid).forEach(result => {
      console.log(`   - ${path.basename(result.path)}: ${result.errors.join(', ')}`);
    });
  }

  if (invalidRecettes > 0) {
    console.log(`\n❌ Recettes invalides (${invalidRecettes}):`);
    recetteResults.filter(r => !r.valid).forEach(result => {
      console.log(`   - ${path.basename(result.path)}: ${result.errors.join(', ')}`);
    });
  }

  if (invalidEvenements > 0) {
    console.log(`\n❌ Événements invalides (${invalidEvenements}):`);
    evenementResults.filter(r => !r.valid).forEach(result => {
      console.log(`   - ${path.basename(result.path)}: ${result.errors.join(', ')}`);
    });
  }

  // Vérifier si le rapport final existe et comparer
  if (fs.existsSync(FINAL_REPORT_PATH)) {
    const finalReport = JSON.parse(fs.readFileSync(FINAL_REPORT_PATH, 'utf8'));
    console.log(`\n📋 Comparaison avec le rapport de migration:`);
    console.log(`   Ingrédients migrés attendus: ${finalReport.migratedIngredients?.length || 0}`);
    console.log(`   Recettes migrées attendues: ${finalReport.migratedRecettes?.length || 0}`);
    console.log(`   Événements migrés attendus: ${finalReport.migratedEvenements?.length || 0}`);
    console.log(`   Ingrédients trouvés: ${ingredientResults.length}`);
    console.log(`   Recettes trouvées: ${recetteResults.length}`);
    console.log(`   Événements trouvés: ${evenementResults.length}`);
  }

  // Sauvegarder le rapport de vérification
  const verificationReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalIngredients: ingredientResults.length,
      validIngredients,
      invalidIngredients,
      totalRecettes: recetteResults.length,
      validRecettes,
      invalidRecettes,
      totalEvenements: evenementResults.length,
      validEvenements,
      invalidEvenements
    },
    ingredientResults,
    recetteResults,
    evenementResults
  };

  const verificationReportPath = path.join(__dirname, 'verification-report.json');
  fs.writeFileSync(verificationReportPath, JSON.stringify(verificationReport, null, 2));

  console.log(`\n💾 Rapport de vérification sauvegardé dans: ${verificationReportPath}`);

  // Conclusion
  const totalValid = validIngredients + validRecettes;
  const totalInvalid = invalidIngredients + invalidRecettes;

  if (totalInvalid === 0) {
    console.log('\n🎉 Toutes les vérifications ont réussi! La migration est complète et valide.');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${totalInvalid} problèmes détectés. Veuillez corriger les erreurs avant de continuer.`);
    process.exit(1);
  }
}

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erreur non gérée:', reason);
  process.exit(1);
});

// Lancer la vérification
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export {
  verifyIngredient,
  verifyRecette,
  verifyEvenement
};