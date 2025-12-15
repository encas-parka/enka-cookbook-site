#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

/**
 * Script de migration pour transformer les champs de recettes en booléens
 * 
 * Transformations:
 * - cuisson: "Oui"/"Non" → cuisson: true/false
 * - temperature: "Chaud"/"Froid" → serveHot: true/false
 * - check: "Oui"/"Non" → check: true/false
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECIPES_DIR = path.join(__dirname, '../content/recettes');

// Fonction pour parser le frontmatter d'un fichier markdown
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: content };
  }
  
  try {
    const frontmatter = yaml.load(match[1]);
    const body = match[2];
    return { frontmatter, content: body };
  } catch (error) {
    console.error('Erreur parsing YAML:', error);
    return { frontmatter: {}, content: content };
  }
}

// Fonction pour reconstruire le fichier avec le nouveau frontmatter
function rebuildFile(frontmatter, content) {
  const yamlContent = yaml.dump(frontmatter, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
  
  return `---\n${yamlContent}---\n${content}`;
}

// Fonction pour migrer les champs d'une recette
function migrateFields(frontmatter) {
  const migrated = { ...frontmatter };
  
  // Migration du champ cuisson
  if (migrated.cuisson !== undefined) {
    if (migrated.cuisson === "Oui") {
      migrated.cuisson = true;
    } else if (migrated.cuisson === "Non") {
      migrated.cuisson = false;
    }
  }
  
  // Migration du champ temperature vers serveHot
  if (migrated.temperature !== undefined) {
    if (migrated.temperature === "Chaud") {
      migrated.serveHot = true;
    } else if (migrated.temperature === "Froid") {
      migrated.serveHot = false;
    }
    // Supprimer l'ancien champ
    delete migrated.temperature;
  }
  
  // Migration du champ check
  if (migrated.check !== undefined) {
    if (migrated.check === "Oui") {
      migrated.check = true;
    } else if (migrated.check === "Non") {
      migrated.check = false;
    }
  }
  
  return migrated;
}

// Fonction récursive pour trouver tous les fichiers index.md
function findMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findMarkdownFiles(filePath, fileList);
    } else if (file === 'index.md') {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Fonction principale de migration
async function migrate() {
  console.log('🔍 Recherche des fichiers de recettes...');
  const markdownFiles = findMarkdownFiles(RECIPES_DIR);
  
  console.log(`📁 ${markdownFiles.length} fichiers de recettes trouvés`);
  
  let migratedCount = 0;
  let errorCount = 0;
  
  for (const filePath of markdownFiles) {
    try {
      console.log(`⚙️  Traitement: ${path.relative(RECIPES_DIR, filePath)}`);
      
      // Lire le fichier
      const content = fs.readFileSync(filePath, 'utf8');
      const { frontmatter, content: body } = parseFrontmatter(content);
      
      // Vérifier si une migration est nécessaire
      const hasOldFields = (
        frontmatter.cuisson === "Oui" || 
        frontmatter.cuisson === "Non" ||
        frontmatter.temperature === "Chaud" || 
        frontmatter.temperature === "Froid" ||
        frontmatter.check === "Oui" || 
        frontmatter.check === "Non"
      );
      
      if (hasOldFields) {
        // Migrer les champs
        const migratedFrontmatter = migrateFields(frontmatter);
        const newContent = rebuildFile(migratedFrontmatter, body);
        
        // Écrire le fichier migré
        fs.writeFileSync(filePath, newContent, 'utf8');
        migratedCount++;
        console.log(`✅ Migré: ${path.relative(RECIPES_DIR, filePath)}`);
      } else {
        console.log(`⏭️  Pass: ${path.relative(RECIPES_DIR, filePath)} (déjà migré ou pas de changement nécessaire)`);
      }
    } catch (error) {
      console.error(`❌ Erreur avec ${filePath}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n📊 Migration terminée:');
  console.log(`✅ Fichiers migrés: ${migratedCount}`);
  console.log(`❌ Erreurs: ${errorCount}`);
  console.log(`📁 Total traités: ${markdownFiles.length}`);
}

// Vérifier si js-yaml est installé
try {
  yaml.load('test: test');
} catch (error) {
  console.error('❌ js-yaml n\'est pas installé. Installez-le avec:');
  console.error('npm install js-yaml');
  process.exit(1);
}

// Exécuter la migration
migrate().catch(console.error);