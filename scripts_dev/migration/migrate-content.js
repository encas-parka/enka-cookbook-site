#!/usr/bin/env node

/**
 * Script de migration pour le projet ENKA Cookbook
 *
 * Objectifs:
 * 1. Ajouter des UUID simples aux ingrédients existants (sans les fichiers de test)
 * 2. Mettre à jour les slugs des ingrédients pour inclure l'UUID
 * 3. Ajouter des UUID aux recettes existantes (sans les fichiers de test)
 * 4. Mettre à jour les slugs des recettes pour inclure l'UUID
 * 5. Transformer les références d'ingrédients dans les recettes du format groupé par type vers le format plat avec slugs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

// Plus de filtres de test - tous les fichiers seront traités

// Fonction pour générer un UUID court (8 caractères)
function generateShortUUID() {
  return crypto.randomBytes(4).toString('hex').substring(0, 8);
}

// Fonction pour générer un UUID complet
function generateUUID() {
  return crypto.randomUUID();
}

// Fonction pour normaliser un titre pour le slug
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

// Fonction pour migrer un ingrédient
function migrateIngredient(ingredientDir) {
  const indexPath = path.join(ingredientDir, 'index.md');

  if (!fs.existsSync(indexPath)) {
    console.log(`  ⚠️  Pas de index.md dans ${ingredientDir}`);
    return null;
  }

  try {
    const { frontmatter, bodyContent } = readFrontmatter(indexPath);

    // Ignorer si déjà un UUID présent
    if (frontmatter.uuid) {
      console.log(`  ⏭️  UUID déjà présent, ignoré`);
      return null;
    }

    // Générer un UUID court
    const uuid = generateShortUUID();
    const title = frontmatter.title;

    // Mettre à jour le frontmatter
    frontmatter.uuid = uuid;

    // Écrire le fichier mis à jour
    writeFrontmatter(indexPath, frontmatter, bodyContent);

    // Calculer le nouveau slug
    const normalizedTitle = normalizeTitleForSlug(title);
    const newSlug = `${normalizedTitle}_${uuid}`;

    console.log(`  ✅ Ingrédient migré: ${title} -> ${newSlug}`);

    return {
      oldTitle: title,
      newSlug: newSlug,
      uuid: uuid,
      type: frontmatter.type,
      oldPath: ingredientDir,
      newPath: path.join(path.dirname(ingredientDir), newSlug)
    };

  } catch (error) {
    console.error(`  ❌ Erreur lors de la migration de ${ingredientDir}: ${error.message}`);
    return null;
  }
}

// Fonction pour migrer une recette
function migrateRecette(recetteDir) {
  const indexPath = path.join(recetteDir, 'index.md');

  if (!fs.existsSync(indexPath)) {
    console.log(`  ⚠️  Pas de index.md dans ${recetteDir}`);
    return null;
  }

  try {
    const { frontmatter, bodyContent } = readFrontmatter(indexPath);

    // Ignorer si déjà un UUID présent
    if (frontmatter.uuid) {
      console.log(`  ⏭️  UUID déjà présent, ignoré`);
      return null;
    }

    // Générer un UUID complet
    const uuid = generateShortUUID();
    const title = frontmatter.title;

    // Mettre à jour le frontmatter
    frontmatter.uuid = uuid;

    // Transformer les ingrédients si nécessaire
    if (frontmatter.ingredients && typeof frontmatter.ingredients === 'object' && !Array.isArray(frontmatter.ingredients)) {
      const newIngredients = [];

      // Parcourir chaque type d'ingrédient
      Object.keys(frontmatter.ingredients).forEach(type => {
        const ingredientsOfType = frontmatter.ingredients[type];

        if (Array.isArray(ingredientsOfType)) {
          ingredientsOfType.forEach(ing => {
            if (ing.title) {
              // Pour l'instant, on garde le titre comme référence
              // Cela sera mis à jour dans une deuxième passe quand tous les ingrédients auront leur slug
              newIngredients.push({
                ingredient: ing.title, // Sera remplacé par le slug plus tard
                quantite: ing.quantite,
                unit: ing.unit,
                commentaire: ing.commentaire || ''
              });
            }
          });
        }
      });

      // Remplacer l'ancienne structure par la nouvelle
      frontmatter.ingredients = newIngredients;
      console.log(`  🔄 Structure des ingrédients transformée: ${newIngredients.length} ingrédients`);
    }

    // Écrire le fichier mis à jour
    writeFrontmatter(indexPath, frontmatter, bodyContent);

    // Calculer le nouveau slug
    const normalizedTitle = normalizeTitleForSlug(title);
    const newSlug = `${normalizedTitle}_${uuid}`;

    console.log(`  ✅ Recette migrée: ${title} -> ${newSlug}`);

    return {
      oldTitle: title,
      newSlug: newSlug,
      uuid: uuid,
      type: frontmatter.type,
      oldPath: recetteDir,
      newPath: path.join(path.dirname(recetteDir), newSlug)
    };

  } catch (error) {
    console.error(`  ❌ Erreur lors de la migration de ${recetteDir}: ${error.message}`);
    return null;
  }
}

// Fonction pour migrer un événement
function migrateEvenement(evenementDir) {
  const indexPath = path.join(evenementDir, 'index.md');

  if (!fs.existsSync(indexPath)) {
    console.log(`  ⚠️  Pas de index.md dans ${evenementDir}`);
    return null;
  }

  try {
    const { frontmatter, bodyContent } = readFrontmatter(indexPath);

    // Ignorer si déjà un UUID présent
    if (frontmatter.uuid) {
      console.log(`  ⏭️  UUID déjà présent, ignoré`);
      return null;
    }

    // Générer un UUID simple de 8 caractères
    const uuid = generateShortUUID();
    const title = frontmatter.title;

    // Mettre à jour le frontmatter
    frontmatter.uuid = uuid;

    // Les références aux recettes dans les événements sont déjà au bon format (slug)
    // donc pas besoin de les transformer ici

    // Écrire le fichier mis à jour
    writeFrontmatter(indexPath, frontmatter, bodyContent);

    // Calculer le nouveau slug
    const normalizedTitle = normalizeTitleForSlug(title);
    const newSlug = `${normalizedTitle}_${uuid}`;

    console.log(`  ✅ Événement migré: ${title} -> ${newSlug}`);

    return {
      oldTitle: title,
      newSlug: newSlug,
      uuid: uuid,
      type: 'evenement',
      oldPath: evenementDir,
      newPath: path.join(path.dirname(evenementDir), newSlug)
    };

  } catch (error) {
    console.error(`  ❌ Erreur lors de la migration de ${evenementDir}: ${error.message}`);
    return null;
  }
}

// Fonction principale de migration
async function main() {
  console.log('🚀 Démarrage de la migration du contenu ENKA Cookbook...\n');

  const migratedIngredients = [];
  const migratedRecettes = [];

  // Migration des ingrédients
  console.log('📦 Migration des ingrédients...');
  const ingredientDirs = fs.readdirSync(INGREDIENTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const dirName of ingredientDirs) {
    console.log(`\n📂 Traitement de l'ingrédient: ${dirName}`);
    const ingredientDir = path.join(INGREDIENTS_DIR, dirName);
    const result = migrateIngredient(ingredientDir);

    if (result) {
      migratedIngredients.push(result);
    }
  }

  console.log(`\n✅ Migration des ingrédients terminée: ${migratedIngredients.length} ingrédients migrés`);

  // Migration des recettes
  console.log('\n🍳 Migration des recettes...');
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
      console.log(`\n📂 Traitement de la recette: ${type}/${dirName}`);
      const recetteDir = path.join(typeDir, dirName);
      const result = migrateRecette(recetteDir);

      if (result) {
        migratedRecettes.push(result);
      }
    }
  }

  console.log(`\n✅ Migration des recettes terminée: ${migratedRecettes.length} recettes migrées`);

  // Migration des événements
  console.log('\n📅 Migration des événements...');
  const migratedEvenements = [];

  if (fs.existsSync(EVENEMENTS_DIR)) {
    const evenementDirs = fs.readdirSync(EVENEMENTS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dirName of evenementDirs) {
      console.log(`\n📂 Traitement de l'événement: ${dirName}`);
      const evenementDir = path.join(EVENEMENTS_DIR, dirName);
      const result = migrateEvenement(evenementDir);

      if (result) {
        migratedEvenements.push(result);
      }
    }
  } else {
    console.log('  ⚠️  Répertoire evenements/ non trouvé, ignoré');
  }

  console.log(`\n✅ Migration des événements terminée: ${migratedEvenements.length} événements migrés`);

  // Générer un rapport
  console.log('\n📊 Rapport de migration:');
  console.log(`   Ingrédients migrés: ${migratedIngredients.length}`);
  console.log(`   Recettes migrées: ${migratedRecettes.length}`);
  console.log(`   Événements migrés: ${migratedEvenements.length}`);

  // Sauvegarder le rapport pour la deuxième passe
  const report = {
    migratedIngredients,
    migratedRecettes,
    migratedEvenements,
    timestamp: new Date().toISOString()
  };

  const reportPath = path.join(__dirname, 'migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n💾 Rapport sauvegardé dans: ${reportPath}`);
  console.log('\n🎯 Prochaine étape: Exécuter la deuxième passe pour mettre à jour les références d\'ingrédients');
}

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erreur non gérée:', reason);
  process.exit(1);
});

// Lancer la migration
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { migrateIngredient, migrateRecette, migrateEvenement, generateShortUUID, generateUUID };