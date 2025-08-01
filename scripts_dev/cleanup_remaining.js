#!/usr/bin/env node

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
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---(\n([\s\S]*))?$/);

    if (!frontMatterMatch) {
      throw new Error(`Pas de front matter trouvé dans ${filePath}`);
    }

    return {
      frontMatter: frontMatterMatch[1],
      content: frontMatterMatch[3] || '',
      fullContent: content
    };
  } catch (error) {
    throw error;
  }
}

// Fonction pour écrire le front matter d'un fichier markdown
function writeFrontMatter(filePath, frontMatter, content) {
  const newContent = content
    ? `---\n${frontMatter}\n---\n${content}`
    : `---\n${frontMatter}\n---`;
  fs.writeFileSync(filePath, newContent, 'utf8');
}

// Fonction pour extraire les valeurs simples du YAML (avec gestion des > et >-)
function extractYamlValue(yamlContent, key) {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = yamlContent.match(regex);
  if (!match) return null;

  let value = match[1].trim();
  // Gérer les valeurs multilignes avec > ou >-
  if (value.startsWith('>-') || value.startsWith('>')) {
    // Extraire le contenu multiligne
    const lines = yamlContent.split('\n');
    const keyLineIndex = lines.findIndex(line => line.trim().startsWith(`${key}:`));
    if (keyLineIndex !== -1) {
      let result = '';
      for (let i = keyLineIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^\s{2,}/) || line.trim() === '') {
          result += line.replace(/^\s{2}/, '') + (line.trim() === '' ? '' : ' ');
        } else {
          break;
        }
      }
      return result.trim();
    }
  }
  return value.replace(/^>-?\s*/, '');
}

// Fonction pour mettre à jour une ligne YAML (avec gestion multiligne)
function updateYamlLine(yamlContent, key, newValue) {
  const lines = yamlContent.split('\n');
  const keyLineIndex = lines.findIndex(line => line.trim().startsWith(`${key}:`));

  if (keyLineIndex === -1) {
    return yamlContent;
  }

  const currentLine = lines[keyLineIndex];
  const indent = currentLine.match(/^(\s*)/)[1];

  // Si la valeur actuelle est multiligne (avec > ou >-)
  if (currentLine.includes('>')) {
    // Supprimer les lignes multilignes existantes
    let endIndex = keyLineIndex + 1;
    while (endIndex < lines.length && (lines[endIndex].match(/^\s{2,}/) || lines[endIndex].trim() === '')) {
      endIndex++;
    }
    // Remplacer par une ligne simple
    lines.splice(keyLineIndex, endIndex - keyLineIndex, `${indent}${key}: ${newValue}`);
  } else {
    // Remplacer la ligne simple
    lines[keyLineIndex] = `${indent}${key}: ${newValue}`;
  }

  return lines.join('\n');
}

// Fonction pour remplacer toutes les occurrences d'un slug dans le contenu
function replaceSlugInContent(content, oldSlug, newSlug) {
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
      const indexPath = path.join(fullPath, 'index.md');
      if (fs.existsSync(indexPath)) {
        recipeFiles.push({
          folderPath: fullPath,
          filePath: indexPath,
          folderName: item
        });
      } else {
        findRecipeFiles(fullPath, recipeFiles);
      }
    }
  }

  return recipeFiles;
}

// Fonction pour analyser le type d'UUID
function analyzeUuid(uuid) {
  if (!uuid) return 'MISSING';

  // UUID court (8 caractères alphanumériques)
  if (/^[a-z0-9]{8}$/.test(uuid)) {
    return 'SHORT_CLEAN';
  }

  // UUID classique long (format standard)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return 'CLASSIC_LONG';
  }

  // UUID avec caractères spéciaux (tirets, underscores)
  if (uuid.includes('-') || uuid.includes('_')) {
    return 'WITH_SPECIAL_CHARS';
  }

  return 'OTHER';
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

console.log('🧹 Nettoyage des 17 recettes restantes...\n');

// Étape 1: Identifier les recettes à migrer
console.log('🔍 Identification des recettes à migrer...');
const recipeFiles = findRecipeFiles('content/recettes');
const recipesToMigrate = [];
const allSlugs = new Map(); // Pour mapping oldSlug -> newSlug

for (const recipe of recipeFiles) {
  try {
    const { frontMatter } = readFrontMatter(recipe.filePath);
    const uuid = extractYamlValue(frontMatter, 'uuid');
    const titleslug = extractYamlValue(frontMatter, 'titleslug');
    const title = extractYamlValue(frontMatter, 'title');

    const uuidType = analyzeUuid(uuid);

    // Stocker tous les slugs pour le mapping
    if (titleslug) {
      allSlugs.set(titleslug, titleslug); // Par défaut, garde le même
    }

    // Identifier les recettes à migrer
    if (uuidType !== 'SHORT_CLEAN') {
      recipesToMigrate.push({
        recipe,
        uuid,
        titleslug,
        title,
        uuidType,
        frontMatter
      });
    }

  } catch (error) {
    console.log(`❌ Erreur lors de la lecture de ${recipe.filePath}: ${error.message}`);
  }
}

console.log(`Trouvé ${recipesToMigrate.length} recettes à migrer\n`);

// Étape 2: Générer les nouveaux slugs
console.log('🔄 Génération des nouveaux slugs...');
const newSlugs = new Set();

// D'abord, collecter tous les slugs courts existants
for (const recipe of recipeFiles) {
  try {
    const { frontMatter } = readFrontMatter(recipe.filePath);
    const uuid = extractYamlValue(frontMatter, 'uuid');
    const titleslug = extractYamlValue(frontMatter, 'titleslug');

    if (analyzeUuid(uuid) === 'SHORT_CLEAN' && titleslug) {
      newSlugs.add(titleslug);
      allSlugs.set(titleslug, titleslug);
    }
  } catch (error) {
    // Ignorer les erreurs pour cette étape
  }
}

// Générer les nouveaux slugs pour les recettes à migrer
for (const recipeData of recipesToMigrate) {
  let newUuid;
  let newSlug;

  do {
    newUuid = generateShortUuid();
    newSlug = `${slugify(recipeData.title)}_${newUuid}`;
  } while (newSlugs.has(newSlug));

  newSlugs.add(newSlug);
  allSlugs.set(recipeData.titleslug, newSlug); // Mapping ancien -> nouveau

  recipeData.newUuid = newUuid;
  recipeData.newSlug = newSlug;

  console.log(`  📝 ${recipeData.titleslug} → ${newSlug}`);
}

// Étape 3: Mettre à jour les recettes
console.log('\n🔄 Mise à jour des recettes...');
let successCount = 0;
let errorCount = 0;

for (const recipeData of recipesToMigrate) {
  try {
    const { recipe, newUuid, newSlug } = recipeData;
    const { frontMatter, content } = readFrontMatter(recipe.filePath);

    // Mettre à jour le front matter
    let updatedFrontMatter = updateYamlLine(frontMatter, 'uuid', newUuid);
    updatedFrontMatter = updateYamlLine(updatedFrontMatter, 'titleslug', newSlug);

    // Mettre à jour les références prepAlt dans ce fichier
    for (const [oldSlug, newSlugRef] of allSlugs.entries()) {
      if (oldSlug !== newSlugRef && updatedFrontMatter.includes(oldSlug)) {
        updatedFrontMatter = replaceSlugInContent(updatedFrontMatter, oldSlug, newSlugRef);
      }
    }

    // Écrire le fichier mis à jour
    writeFrontMatter(recipe.filePath, updatedFrontMatter, content);

    console.log(`  ✅ ${recipeData.title}`);
    successCount++;

  } catch (error) {
    console.log(`  ❌ Erreur pour ${recipeData.title}: ${error.message}`);
    errorCount++;
  }
}

console.log(`\n📊 ${successCount} recettes mises à jour, ${errorCount} erreurs`);

// Étape 4: Renommer les dossiers
console.log('\n📁 Renommage des dossiers...');
let renameSuccessCount = 0;
let renameErrorCount = 0;

for (const recipeData of recipesToMigrate) {
  if (!recipeData.newSlug) continue; // Skip si pas de nouveau slug généré

  try {
    const { recipe, newSlug } = recipeData;
    const oldFolderPath = recipe.folderPath;
    const parentDir = path.dirname(oldFolderPath);
    const newFolderPath = path.join(parentDir, newSlug);

    if (fs.existsSync(oldFolderPath) && !fs.existsSync(newFolderPath)) {
      fs.renameSync(oldFolderPath, newFolderPath);
      console.log(`  📁 ${path.basename(oldFolderPath)} → ${newSlug}`);
      renameSuccessCount++;
    } else if (fs.existsSync(newFolderPath)) {
      console.log(`  ⚠️  Dossier cible existe déjà: ${newSlug}`);
    } else {
      console.log(`  ⚠️  Dossier source introuvable: ${oldFolderPath}`);
    }

  } catch (error) {
    console.log(`  ❌ Erreur renommage ${recipeData.title}: ${error.message}`);
    renameErrorCount++;
  }
}

console.log(`\n📊 ${renameSuccessCount} dossiers renommés, ${renameErrorCount} erreurs`);

// Étape 5: Mettre à jour les événements
console.log('\n📅 Mise à jour des événements...');
const eventFiles = findEventFiles('content/evenements');
let eventUpdateCount = 0;

for (const event of eventFiles) {
  try {
    const { fullContent } = readFrontMatter(event.filePath);
    let updatedContent = fullContent;
    let hasChanges = false;

    // Remplacer toutes les références aux anciennes recettes
    for (const [oldSlug, newSlugRef] of allSlugs.entries()) {
      if (oldSlug !== newSlugRef && updatedContent.includes(oldSlug)) {
        updatedContent = replaceSlugInContent(updatedContent, oldSlug, newSlugRef);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      fs.writeFileSync(event.filePath, updatedContent, 'utf8');
      console.log(`  ✅ Événement mis à jour: ${event.folderName}`);
      eventUpdateCount++;
    }

  } catch (error) {
    console.log(`  ❌ Erreur événement ${event.folderName}: ${error.message}`);
  }
}

console.log(`\n📊 ${eventUpdateCount} événements mis à jour sur ${eventFiles.length} vérifiés`);

// Étape 6: Vérification finale
console.log('\n🔍 Vérification finale...');
const finalRecipeFiles = findRecipeFiles('content/recettes');
let finalShortCount = 0;
let finalLongCount = 0;
let finalSpecialCount = 0;
let finalOtherCount = 0;

for (const recipe of finalRecipeFiles) {
  try {
    const { frontMatter } = readFrontMatter(recipe.filePath);
    const uuid = extractYamlValue(frontMatter, 'uuid');
    const uuidType = analyzeUuid(uuid);

    switch (uuidType) {
      case 'SHORT_CLEAN':
        finalShortCount++;
        break;
      case 'CLASSIC_LONG':
        finalLongCount++;
        break;
      case 'WITH_SPECIAL_CHARS':
        finalSpecialCount++;
        break;
      default:
        finalOtherCount++;
    }
  } catch (error) {
    // Ignorer les erreurs de vérification
  }
}

console.log(`\n🎉 Nettoyage terminé !`);
console.log(`📊 État final:`);
console.log(`   - ✅ Recettes avec UUID courts : ${finalShortCount}`);
console.log(`   - ❌ UUID longs restants : ${finalLongCount}`);
console.log(`   - ⚠️  UUID avec caractères spéciaux restants : ${finalSpecialCount}`);
console.log(`   - 🤔 Autres formats restants : ${finalOtherCount}`);
console.log(`   - 📊 Total : ${finalRecipeFiles.length}`);

if (finalLongCount + finalSpecialCount + finalOtherCount === 0) {
  console.log(`\n🎊 Félicitations ! Toutes les recettes ont été migrées avec succès !`);
} else {
  console.log(`\n⚠️  Il reste ${finalLongCount + finalSpecialCount + finalOtherCount} recettes à traiter manuellement.`);
}
