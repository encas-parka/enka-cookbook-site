#!/usr/bin/env node

// Corrige le format des dates publishDate dans les recettes pour garantir un format ISO 8601 valide et homogène dans tous les fichiers.

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

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

// Fonction pour corriger une date mal formatée
function fixDateFormat(dateString) {
  if (!dateString || typeof dateString !== "string") {
    return null;
  }

  // Si c'est déjà au bon format, ne pas modifier
  if (dateString.includes("T") && dateString.includes("Z")) {
    return dateString;
  }

  // Pattern pour détecter les dates mal formatées
  // Format détecté: "17-05-2024T15:21" ou "2024-05-17T15:21"
  const patterns = [
    // DD-MM-YYYYTHH:MM
    /^(\d{2})-(\d{2})-(\d{4})T(\d{2}):(\d{2})$/,
    // YYYY-MM-DDTHH:MM
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
    // DD-MM-YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = dateString.match(pattern);
    if (match) {
      let year, month, day, hour = "00", minute = "00";

      if (pattern.source.includes("(\\d{4})-(\\d{2})-(\\d{2})")) {
        // Format YYYY-MM-DD...
        [, year, month, day, hour = "00", minute = "00"] = match;
      } else {
        // Format DD-MM-YYYY...
        [, day, month, year, hour = "00", minute = "00"] = match;
      }

      // Créer une date ISO valide
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00.000Z`;
    }
  }

  console.warn(`⚠️  Format de date non reconnu: ${dateString}`);
  return dateString; // Retourner tel quel si non reconnu
}

// Fonction principale
function fixPublishDates() {
  const recipesDir = path.join(__dirname, "..", "content", "recettes");

  if (!fs.existsSync(recipesDir)) {
    console.error("Dossier recettes non trouvé:", recipesDir);
    return;
  }

  const recipeFiles = findFiles(recipesDir);
  console.log(`📅 Correction des dates publishDate...`);
  console.log(`🔍 Trouvé ${recipeFiles.length} recettes à vérifier...`);

  let fixedCount = 0;
  let errorCount = 0;

  for (const filePath of recipeFiles) {
    try {
      // Lire le fichier
      const fileContent = fs.readFileSync(filePath, "utf8");
      const parsed = matter(fileContent);

      const { data: frontmatter, content } = parsed;

      // Vérifier et corriger la date publishDate
      if (frontmatter.publishDate) {
        const originalDate = frontmatter.publishDate;
        const fixedDate = fixDateFormat(originalDate.toString());

        if (fixedDate && fixedDate !== originalDate.toString()) {
          console.log(`📝 ${path.basename(path.dirname(filePath))}`);
          console.log(`   Avant: ${originalDate}`);
          console.log(`   Après: ${fixedDate}`);

          // Mettre à jour le frontmatter
          frontmatter.publishDate = fixedDate;

          // Créer une sauvegarde
          const backupPath = filePath + ".backup";
          fs.copyFileSync(filePath, backupPath);

          // Reconstruire le fichier
          const newContent = matter.stringify(content, frontmatter);

          // Écrire le nouveau contenu
          fs.writeFileSync(filePath, newContent, "utf8");

          fixedCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Erreur lors du traitement de ${filePath}:`, error.message);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 RÉSUMÉ DES CORRECTIONS");
  console.log("=".repeat(50));
  console.log(`Recettes traitées: ${recipeFiles.length}`);
  console.log(`Dates corrigées: ${fixedCount}`);
  console.log(`Erreurs: ${errorCount}`);

  if (fixedCount > 0) {
    console.log("\n💾 Sauvegardes créées avec l'extension .backup");
    console.log("Pour supprimer les sauvegardes après vérification:");
    console.log('find content/recettes -name "*.backup" -delete');
  }
}

// Exécuter le script
if (require.main === module) {
  console.log("🔧 Correction des dates publishDate mal formatées...\n");
  try {
    require.resolve("gray-matter");
    fixPublishDates();
  } catch (error) {
    console.error("❌ Le module gray-matter n'est pas installé");
    console.error("Exécutez d'abord: npm install gray-matter");
    process.exit(1);
  }
}

module.exports = { fixPublishDates, fixDateFormat };
