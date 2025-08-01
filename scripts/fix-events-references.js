#!/usr/bin/env node
// Corrige toutes les références de recettes dans les fichiers d'événements pour garantir que les slugs utilisés sont à jour et cohérents avec les recettes migrées.

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// Fonction de slugification identique à celle de admin/index.html (version corrigée)
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, (m) =>
      "éèêëàäâùüûîïôöç".includes(m)
        ? m.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        : m === "'"
          ? ""
          : "-",
    )
    .replace(/[- ]+/g, "-")
    .replace(/-$/, ""); // Remove trailing dash
}

// Fonction pour parcourir récursivement un dossier
function findFiles(dir, filename = "index.md") {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findFiles(fullPath, filename));
    } else if (item === filename) {
      files.push(fullPath);
    }
  }

  return files;
}

// Créer le mapping des recettes par UUID
function createRecipeMapping() {
  const recipesDir = path.join(__dirname, "..", "content", "recettes");
  const recipeFiles = findFiles(recipesDir);
  const uuidToCorrectSlug = new Map();
  const titleSlugToCorrectSlug = new Map();

  console.log("📖 Création du mapping des recettes...");

  for (const filePath of recipeFiles) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const parsed = matter(fileContent);
      const { data: frontmatter } = parsed;

      if (!frontmatter.title || !frontmatter.uuid) {
        continue;
      }

      // Utiliser le titleslug actuel de la recette (déjà corrigé)
      const correctTitleSlug =
        frontmatter.titleslug ||
        `${slugify(frontmatter.title)}_${frontmatter.uuid}`;

      // Mapping par UUID (pour retrouver les slugs tronqués)
      uuidToCorrectSlug.set(frontmatter.uuid, correctTitleSlug);

      // Mapping par titre slugifié (pour retrouver les références avec ancien UUID)
      const titleSlug = slugify(frontmatter.title);
      titleSlugToCorrectSlug.set(titleSlug, correctTitleSlug);

      console.log(
        `  Recette indexée: ${frontmatter.title} → ${correctTitleSlug}`,
      );
    } catch (error) {
      console.warn(`Erreur lors de la lecture de ${filePath}:`, error.message);
    }
  }

  console.log(`📋 ${uuidToCorrectSlug.size} recettes indexées par UUID\n`);
  return { uuidToCorrectSlug, titleSlugToCorrectSlug };
}

// Fonction pour trouver le titleslug correct pour une référence
function findCorrectTitleSlug(
  reference,
  uuidToCorrectSlug,
  titleSlugToCorrectSlug,
) {
  // 1. Extraire l'UUID de la référence (chercher le pattern après le dernier _ du titre)
  // Format attendu: titre-slug_uuid où uuid peut contenir des _
  const parts = reference.split("_");
  if (parts.length < 2) {
    return null; // Pas d'UUID trouvé
  }

  // L'UUID est tout ce qui suit le premier underscore après le titre
  const firstUnderscoreIndex = reference.indexOf("_");
  const uuid = reference.substring(firstUnderscoreIndex + 1);

  // 2. Chercher par UUID exact
  if (uuidToCorrectSlug.has(uuid)) {
    const correctSlug = uuidToCorrectSlug.get(uuid);

    // Retourner le slug correct seulement s'il est différent de la référence
    if (correctSlug !== reference) {
      return correctSlug;
    }
  }

  // 3. Si pas trouvé par UUID exact, chercher par titre slugifié
  // (pour les cas où l'UUID dans la référence est obsolète)
  const titleSlug = reference.substring(0, firstUnderscoreIndex);
  if (titleSlugToCorrectSlug.has(titleSlug)) {
    const correctSlug = titleSlugToCorrectSlug.get(titleSlug);

    // Retourner le slug correct seulement s'il est différent de la référence
    if (correctSlug !== reference) {
      return correctSlug;
    }
  }

  return null; // Aucune correction nécessaire
}

// Fonction pour corriger les références dans un objet (récursif)
function fixReferencesInObject(
  obj,
  uuidToCorrectSlug,
  titleSlugToCorrectSlug,
  path = "",
) {
  let changes = 0;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      changes += fixReferencesInObject(
        obj[i],
        uuidToCorrectSlug,
        titleSlugToCorrectSlug,
        `${path}[${i}]`,
      );
    }
  } else if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      if (key === "recette" && typeof value === "string") {
        // C'est une référence de recette
        const correctSlug = findCorrectTitleSlug(
          value,
          uuidToCorrectSlug,
          titleSlugToCorrectSlug,
        );
        if (correctSlug) {
          console.log(`    Correction: ${value} → ${correctSlug}`);
          obj[key] = correctSlug;
          changes++;
        }
      } else {
        changes += fixReferencesInObject(
          value,
          uuidToCorrectSlug,
          titleSlugToCorrectSlug,
          `${path}.${key}`,
        );
      }
    }
  }

  return changes;
}

// Fonction principale pour corriger les événements
function fixEventReferences() {
  const eventsDir = path.join(__dirname, "..", "content", "evenements");

  if (!fs.existsSync(eventsDir)) {
    console.error("Dossier événements non trouvé:", eventsDir);
    return;
  }

  // Créer le mapping des recettes
  const { uuidToCorrectSlug, titleSlugToCorrectSlug } = createRecipeMapping();

  if (uuidToCorrectSlug.size === 0) {
    console.log("❌ Aucune recette trouvée!");
    return;
  }

  const eventFiles = findFiles(eventsDir);
  console.log(`🎪 Trouvé ${eventFiles.length} événements à vérifier...`);

  let fixedEvents = 0;
  let totalChanges = 0;
  let errorCount = 0;

  for (const filePath of eventFiles) {
    try {
      // Lire le fichier
      const fileContent = fs.readFileSync(filePath, "utf8");
      const parsed = matter(fileContent);
      const { data: frontmatter, content } = parsed;

      console.log(
        `\n🔍 Vérification: ${path.basename(path.dirname(filePath))}`,
      );

      // Corriger les références dans le frontmatter
      const changes = fixReferencesInObject(
        frontmatter,
        uuidToCorrectSlug,
        titleSlugToCorrectSlug,
      );

      if (changes > 0) {
        console.log(`  ✅ ${changes} référence(s) corrigée(s)`);

        // Créer une sauvegarde
        const backupPath = filePath + ".backup";
        fs.copyFileSync(filePath, backupPath);

        // Reconstruire le fichier
        const newContent = matter.stringify(content, frontmatter);

        // Écrire le nouveau contenu
        fs.writeFileSync(filePath, newContent, "utf8");

        fixedEvents++;
        totalChanges += changes;
      } else {
        console.log(`  ⏭️  Aucune correction nécessaire`);
      }
    } catch (error) {
      console.error(
        `❌ Erreur lors du traitement de ${filePath}:`,
        error.message,
      );
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 RÉSUMÉ DES CORRECTIONS");
  console.log("=".repeat(50));
  console.log(`Événements traités: ${eventFiles.length}`);
  console.log(`Événements corrigés: ${fixedEvents}`);
  console.log(`Total références corrigées: ${totalChanges}`);
  console.log(`Erreurs: ${errorCount}`);

  if (fixedEvents > 0) {
    console.log("\n💾 Sauvegardes créées avec l'extension .backup");
    console.log("Pour supprimer les sauvegardes après vérification:");
    console.log('find content/evenements -name "*.backup" -delete');
  }
}

// Exécuter le script
if (require.main === module) {
  console.log(
    "🔧 Correction des références de recettes dans les événements...\n",
  );
  try {
    require.resolve("gray-matter");
    fixEventReferences();
  } catch (error) {
    console.error("❌ Le module gray-matter n'est pas installé");
    console.error("Exécutez d'abord: npm install gray-matter");
    process.exit(1);
  }
}

module.exports = {
  fixEventReferences,
  createRecipeMapping,
  findCorrectTitleSlug,
};
