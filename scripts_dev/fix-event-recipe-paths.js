/**
 * Corrige les références de recettes dans les événements pour qu'elles pointent vers le nom de dossier actuel de la recette.
 * Ne s'appuie que sur le nom du dossier (plus de uuid/titleslug).
 * Mode simulation disponible (aucune modification, affiche les corrections à faire).
 *
 * Usage :
 *   node scripts/fix-event-recipe-paths.js [--simulate]
 *
 * Par défaut, le script modifie les fichiers. Avec --simulate, il n'écrit rien et affiche les corrections.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from "url";

const SIMULATE = process.argv.includes("--simulate");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Récupère tous les dossiers de recettes (ex: "salami-au-chocolat_o80x9ec6")
function getAllRecipeFolders() {
  const base = path.join(__dirname, "..", "content", "recettes");
  const categories = fs.readdirSync(base);
  const folders = [];
  for (const cat of categories) {
    const catDir = path.join(base, cat);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const folder of fs.readdirSync(catDir)) {
      const indexPath = path.join(catDir, folder, "index.md");
      if (fs.existsSync(indexPath)) {
        folders.push(folder);
      }
    }
  }
  return folders;
}

// Trouve le dossier de recette correspondant à une référence cassée
function findMatchingFolder(ref, allFolders) {
  if (allFolders.includes(ref)) return ref;
  // Chercher le slug avant le 1er '_'
  const firstUnderscore = ref.indexOf("_");
  if (firstUnderscore === -1) return null;
  const slug = ref.substring(0, firstUnderscore + 1); // inclut le '_'
  // Chercher le dossier qui commence par ce slug
  const matches = allFolders.filter(f => f.startsWith(slug));
  if (matches.length === 1) return matches[0];
  // Si plusieurs, prendre le plus court (uuid court)
  if (matches.length > 1) {
    return matches.reduce((a, b) => (a.length < b.length ? a : b));
  }
  return null;
}

function findEventFiles() {
  const base = path.join(__dirname, "..", "content", "evenements");
  return fs
    .readdirSync(base)
    .map((d) => path.join(base, d, "index.md"))
    .filter((f) => fs.existsSync(f));
}

function fixEventFile(filePath, allFolders) {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = matter(content);
  let changed = false;
  let corrections = [];

  function fixObj(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(fixObj);
    } else if (obj && typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        if (key === "recette" && typeof value === "string") {
          const match = findMatchingFolder(value, allFolders);
          if (match && value !== match) {
            corrections.push({ from: value, to: match });
            obj[key] = match;
            changed = true;
          }
        } else {
          fixObj(value);
        }
      }
    }
  }

  fixObj(parsed.data);

  if (changed) {
    if (SIMULATE) {
      console.log(`(Simulation) Corrections à faire dans ${filePath}:`);
      corrections.forEach((c) =>
        console.log(`  - ${c.from} → ${c.to}`)
      );
    } else {
      fs.copyFileSync(filePath, filePath + ".backup");
      const newContent = matter.stringify(parsed.content, parsed.data);
      fs.writeFileSync(filePath, newContent, "utf8");
      console.log(`Corrigé: ${filePath}`);
      corrections.forEach((c) =>
        console.log(`  - ${c.from} → ${c.to}`)
      );
    }
  }
}

function main() {
  const allFolders = getAllRecipeFolders();
  const events = findEventFiles();
  if (SIMULATE) {
    console.log("Mode simulation activé (aucune modification réelle)\n");
  }
  for (const file of events) {
    fixEventFile(file, allFolders);
  }
  console.log("\nTerminé.");
}

main();