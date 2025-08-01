#!/usr/bin/env node

// Migre tous les slugs de recettes vers le format court (titre_slug + UUID court), met à jour les références dans les recettes et les événements, et renomme les dossiers.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Fonction pour générer un UUID court (8 caractères alphanumériques)
function generateShortUuid() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(x => chars[x % chars.length])
    .join('');
}

// Fonction pour slugifier un titre
function slugify(str) {
  return str
    .toLowerCase()
    .replace(
      /[^a-z0-9-]/g,
      (m) =>
        "éèêëàäâùüûîïôöç".includes(m)
          ? m.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          : m === "'"
            ? ""
            : "-"
    )
    .replace(/[- ]+/g, "-")
    .replace(/-$/, "");
}

// Fonction pour lire le front matter d'un fichier markdown
function readFrontMatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontMatterMatch) {
    throw new Error(`Pas de front matter trouvé dans ${filePath}`);
  }

  return {
    frontMatter: frontMatterMatch[1],
    content: frontMatterMatch[2],
    fullContent: content
  };
}

// Fonction pour écrire le front matter d'un fichier markdown
function writeFrontMatter(filePath, frontMatter, content) {
  const newContent = `---\n${frontMatter}\n---\n${content}`;
  fs.writeFileSync(filePath, newContent, 'utf8');
}

// Fonction pour extraire les valeurs simples du YAML
function extractYamlValue(yamlContent, key) {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = yamlContent.match(regex);
  return match ? match[1].trim() : null;
}

// Fonction pour mettre à jour une ligne YAML simple
function updateYamlLine(yamlContent, key, newValue) {
  const regex = new RegExp(`^(${key}:\\s*)(.+)$`, 'm');
  return yamlContent.replace(regex, `$1${newValue}`);
}

// Fonction pour remplacer toutes les occurrences d'un slug dans le contenu
function replaceSlugInContent(content, oldSlug, newSlug) {
  // Échapper les caractères spéciaux pour la regex
  const escapedOldSlug = oldSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedOldSlug}\\b`, 'g');
  return content.replace(regex, newSlug);
}

// Fonction pour parcourir récursivement les dossiers de recettes
function findRecipeFiles(dir, recipeFiles = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Vérifier si c'est un dossier de recette (contient un index.md)
      const indexPath = path.join(fullPath, 'index.md');
      if (fs.existsSync(indexPath)) {
        recipeFiles.push({
          folderPath: fullPath,
          filePath: indexPath,
          folderName: item
        });
      } else {
        // Récursif pour les sous-dossiers
        findRecipeFiles(fullPath, recipeFiles);
      }
    }
  }

  return recipeFiles;
}

// Fonction pour trouver les fichiers d'événements
function findEventFiles(dir) {
  const eventFiles = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const indexPath = path.join(fullPath, 'index.md');
      if (fs.existsSync(indexPath)) {
        eventFiles.push({
          folderPath: fullPath,
          filePath: indexPath,
          folderName: item
        });
      }
    }
  }

  return eventFiles;
}

console.log('🚀 Début de la migration des slugs...\n');

// Étape 1: Collecter toutes les recettes
console.log('📖 Collecte des recettes...');
const recipeFiles = findRecipeFiles('enka-cookbook-site/content/recettes');
console.log(`Trouvé ${recipeFiles.length} recettes\n`);

// Étape 2: Créer la mapping des anciens vers nouveaux slugs
const slugMapping = new Map();
const newSlugs = new Set(); // Pour éviter les doublons

for (const recipe of recipeFiles) {
  try {
    const { frontMatter } = readFrontMatter(recipe.filePath);

    const oldSlug = extractYamlValue(frontMatter, 'titleslug');
    const title = extractYamlValue(frontMatter, 'title');

    if (!oldSlug || !title) {
      console.log(`⚠️  Recette ignorée (pas de slug/titre): ${recipe.filePath}`);
      continue;
    }

    // Générer nouveau slug
    let newUuid;
    let newSlug;
    do {
      newUuid = generateShortUuid();
      newSlug = `${slugify(title)}_${newUuid}`;
    } while (newSlugs.has(newSlug));

    newSlugs.add(newSlug);
    slugMapping.set(oldSlug, {
      newSlug,
      newUuid,
      title,
      recipe
    });

  } catch (error) {
    console.log(`❌ Erreur lors de la lecture de ${recipe.filePath}: ${error.message}`);
  }
}

console.log(`📝 ${slugMapping.size} mappings de slugs créés\n`);

// Étape 3: Mettre à jour les fichiers de recettes
console.log('🔄 Mise à jour des recettes...');
for (const [oldSlug, data] of slugMapping.entries()) {
  try {
    const { recipe, newSlug, newUuid } = data;
    const { frontMatter, content } = readFrontMatter(recipe.filePath);

    // Mettre à jour le front matter
    let updatedFrontMatter = updateYamlLine(frontMatter, 'titleslug', newSlug);
    updatedFrontMatter = updateYamlLine(updatedFrontMatter, 'uuid', newUuid);

    // Mettre à jour les références prepAlt dans ce fichier
    for (const [oldRefSlug, refData] of slugMapping.entries()) {
      if (updatedFrontMatter.includes(oldRefSlug)) {
        updatedFrontMatter = replaceSlugInContent(updatedFrontMatter, oldRefSlug, refData.newSlug);
      }
    }

    // Écrire le fichier mis à jour
    writeFrontMatter(recipe.filePath, updatedFrontMatter, content);

    console.log(`  ✅ ${oldSlug} → ${newSlug}`);

  } catch (error) {
    console.log(`  ❌ Erreur lors de la mise à jour de ${oldSlug}: ${error.message}`);
  }
}

// Étape 4: Renommer les dossiers de recettes
console.log('\n📁 Renommage des dossiers de recettes...');
for (const [oldSlug, data] of slugMapping.entries()) {
  try {
    const { recipe, newSlug } = data;
    const oldFolderPath = recipe.folderPath;
    const parentDir = path.dirname(oldFolderPath);
    const newFolderPath = path.join(parentDir, newSlug);

    if (oldFolderPath !== newFolderPath && fs.existsSync(oldFolderPath)) {
      fs.renameSync(oldFolderPath, newFolderPath);
      console.log(`  📁 ${path.basename(oldFolderPath)} → ${newSlug}`);
    }

  } catch (error) {
    console.log(`  ❌ Erreur lors du renommage pour ${oldSlug}: ${error.message}`);
  }
}

// Étape 5: Mettre à jour les événements
console.log('\n📅 Mise à jour des événements...');
const eventFiles = findEventFiles('enka-cookbook-site/content/evenements');

for (const event of eventFiles) {
  try {
    const { fullContent } = readFrontMatter(event.filePath);
    let updatedContent = fullContent;
    let hasChanges = false;

    // Remplacer toutes les références aux anciennes recettes
    for (const [oldSlug, data] of slugMapping.entries()) {
      if (updatedContent.includes(oldSlug)) {
        updatedContent = replaceSlugInContent(updatedContent, oldSlug, data.newSlug);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      fs.writeFileSync(event.filePath, updatedContent, 'utf8');
      console.log(`  ✅ Événement mis à jour: ${event.folderName}`);
    }

  } catch (error) {
    console.log(`  ❌ Erreur lors de la mise à jour de l'événement ${event.folderName}: ${error.message}`);
  }
}

// Étape 6: Vérification finale
console.log('\n🔍 Vérification finale...');
let issuesFound = 0;

// Vérifier que tous les dossiers ont été renommés
for (const [oldSlug, data] of slugMapping.entries()) {
  const { recipe, newSlug } = data;
  const parentDir = path.dirname(recipe.folderPath);
  const newFolderPath = path.join(parentDir, newSlug);

  if (!fs.existsSync(newFolderPath)) {
    console.log(`  ⚠️  Dossier non trouvé: ${newFolderPath}`);
    issuesFound++;
  }
}

// Vérifier quelques références dans les événements
for (const event of eventFiles) {
  try {
    const { fullContent } = readFrontMatter(event.filePath);

    for (const [oldSlug] of slugMapping.entries()) {
      if (fullContent.includes(oldSlug)) {
        console.log(`  ⚠️  Référence non mise à jour dans ${event.folderName}: ${oldSlug}`);
        issuesFound++;
      }
    }
  } catch (error) {
    // Ignorer les erreurs de vérification
  }
}

console.log('\n🎉 Migration terminée !');
console.log(`📊 Statistiques:`);
console.log(`   - ${slugMapping.size} recettes migrées`);
console.log(`   - ${eventFiles.length} événements vérifiés`);
if (issuesFound > 0) {
  console.log(`   - ⚠️  ${issuesFound} problèmes détectés (voir ci-dessus)`);
} else {
  console.log(`   - ✅ Aucun problème détecté`);
}

console.log('\n💡 N\'oubliez pas de mettre à jour la fonction nanoid dans static/admin/index.html');
console.log('   pour qu\'elle génère des UUID de 8 caractères pour les nouvelles recettes !');
