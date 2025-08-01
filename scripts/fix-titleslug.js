#!/usr/bin/env node
// Synchronise le champ titleslug et uuid du frontmatter des recettes avec le nom du dossier, en recalculant si besoin, pour garantir la cohérence des slugs.

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// Fonction de slugification identique à celle de admin/index.html
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

// Fonction pour préserver le format des dates
function preserveDateFormat(frontmatter) {
  if (frontmatter.publishDate) {
    const date = frontmatter.publishDate;

    // Si c'est un objet Date JavaScript, le convertir en ISO string
    if (date instanceof Date) {
      frontmatter.publishDate = date.toISOString();
    }
    // Si c'est une string qui ressemble à une date JS, la parser et convertir
    else if (typeof date === "string" && date.includes("GMT")) {
      try {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          frontmatter.publishDate = parsedDate.toISOString();
        }
      } catch (error) {
        // Garder la date originale si parsing échoue
      }
    }
  }

  return frontmatter;
}

// Fonction pour parcourir récursivement un dossier
function findRecipeFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findRecipeFiles(fullPath));
    } else if (item === "index.md") {
      files.push(fullPath);
    }
  }

  return files;
}

// Fonction pour extraire l'UUID du nom du dossier
function extractUuidFromFolderName(folderName) {
  // Le format attendu est: titre-slug_UUID
  // L'UUID peut contenir des underscores et se terminer par un underscore
  const firstUnderscoreIndex = folderName.indexOf("_");
  if (firstUnderscoreIndex === -1) {
    return null;
  }

  let uuid = folderName.substring(firstUnderscoreIndex + 1);

  // Enlever l'underscore final s'il existe
  if (uuid.endsWith("_")) {
    uuid = uuid.slice(0, -1);
  }

  return uuid || null;
}

// Fonction principale
function fixTitleSlugs() {
  const recipesDir = path.join(__dirname, "..", "content", "recettes");

  if (!fs.existsSync(recipesDir)) {
    console.error("Dossier recettes non trouvé:", recipesDir);
    return;
  }

  const recipeFiles = findRecipeFiles(recipesDir);
  console.log(`Trouvé ${recipeFiles.length} recettes à vérifier...`);

  let fixedCount = 0;
  let errorCount = 0;

  for (const filePath of recipeFiles) {
    try {
      // Lire le fichier
      const fileContent = fs.readFileSync(filePath, "utf8");
      const parsed = matter(fileContent);

      const { data: frontmatter, content } = parsed;

      // Vérifier si la recette a un titre
      if (!frontmatter.title) {
        console.warn(`Titre manquant dans: ${filePath}`);
        continue;
      }

      // Extraire l'UUID du nom du dossier
      const folderName = path.basename(path.dirname(filePath));
      const uuidFromFolder = extractUuidFromFolderName(folderName);

      if (!uuidFromFolder) {
        console.warn(`Impossible d'extraire l'UUID du dossier: ${folderName}`);
        continue;
      }

      // Mettre à jour l'UUID dans le frontmatter s'il ne correspond pas
      if (frontmatter.uuid !== uuidFromFolder) {
        console.log(
          `UUID corrigé de ${frontmatter.uuid} vers ${uuidFromFolder} dans: ${folderName}`,
        );
        frontmatter.uuid = uuidFromFolder;
      }

      // Calculer le nouveau titleslug avec l'UUID du dossier
      const newTitleSlug = `${slugify(frontmatter.title)}_${uuidFromFolder}`;

      // Vérifier si le titleslug actuel est différent
      if (frontmatter.titleslug === newTitleSlug) {
        continue; // Pas besoin de corriger
      }

      console.log(`Correction de: ${path.basename(path.dirname(filePath))}`);
      console.log(
        `  Ancien titleslug: ${frontmatter.titleslug || "undefined"}`,
      );
      console.log(`  Nouveau titleslug: ${newTitleSlug}`);

      // Mettre à jour le frontmatter
      frontmatter.titleslug = newTitleSlug;

      // Préserver le format des dates
      preserveDateFormat(frontmatter);

      // Reconstruire le fichier avec options pour préserver les dates
      const newContent = matter.stringify(content, frontmatter, {
        // Options simples pour gray-matter
        noArrayIndent: false,
        skipInvalid: false,
      });

      // Créer une sauvegarde
      const backupPath = filePath + ".backup";
      fs.copyFileSync(filePath, backupPath);

      // Écrire le nouveau contenu
      fs.writeFileSync(filePath, newContent, "utf8");

      fixedCount++;
    } catch (error) {
      console.error(`Erreur lors du traitement de ${filePath}:`, error.message);
      errorCount++;
    }
  }

  console.log("\n=== RÉSUMÉ ===");
  console.log(`Recettes traitées: ${recipeFiles.length}`);
  console.log(`Recettes corrigées: ${fixedCount}`);
  console.log(`Erreurs: ${errorCount}`);

  if (fixedCount > 0) {
    console.log("\nSauvegardes créées avec l'extension .backup");
    console.log("Pour supprimer les sauvegardes après vérification:");
    console.log('find content/recettes -name "*.backup" -delete');
  }
}

// Exécuter le script
if (require.main === module) {
  console.log("🔧 Correction des titleslug des recettes...\n");
  try {
    require.resolve("gray-matter");
    fixTitleSlugs();
  } catch (error) {
    console.error("❌ Le module gray-matter n'est pas installé");
    console.error("Exécutez d'abord: npm install gray-matter");
    process.exit(1);
  }
}

module.exports = { slugify, fixTitleSlugs };
