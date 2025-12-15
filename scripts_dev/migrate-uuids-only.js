#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { customAlphabet } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Générateur d'UUID en minuscules alphanumériques (12 caractères)
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

// Fonction pour slugifier une chaîne (avec gestion des accents)
function slugify(str) {
  return str
    .toString()
    .toLowerCase()
    .trim()
    // Remplacer les accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remplacer les espaces par des tirets
    .replace(/\s+/g, '-')
    // Supprimer les caractères spéciaux
    .replace(/[^a-z0-9-]/g, '')
    // Supprimer les tirets multiples
    .replace(/-+/g, '-')
    // Supprimer les tirets en début et fin
    .replace(/^-|-$/g, '');
}

// Fonction pour normaliser le titre
function normalizeTitle(title) {
  if (!title) return '';
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
}

// Fonction pour traiter une recette (mise à jour des UUIDs uniquement)
function updateRecipeUuid(filePath, uuidMap) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Séparer le front-matter du contenu
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      console.log(`No front-matter found in ${filePath}`);
      return null;
    }
    
    const frontMatter = match[1];
    const restContent = content.substring(match[0].length);
    
    // Parser le YAML avec js-yaml
    let data;
    try {
      data = yaml.load(frontMatter);
    } catch (e) {
      console.log(`Error parsing YAML in ${filePath}:`, e.message);
      return null;
    }
    
    const oldUuid = data.uuid;
    const oldSlug = data.slug;
    
    // Générer un nouvel UUID en minuscules
    const newUuid = nanoid();
    
    // Créer le nouveau slug avec le nouvel UUID
    const originalTitle = data.title || '';
    const titleSlug = slugify(originalTitle).substring(0, 22);
    const newSlug = `${titleSlug}_${newUuid}`;
    
    // Normaliser le titre
    const normalizedTitle = normalizeTitle(originalTitle);
    
    // Mettre à jour les données
    data.uuid = newUuid;
    data.slug = newSlug;
    data.title = normalizedTitle;
    
    // Reconstruire le front-matter avec js-yaml
    const newFrontMatter = `---\n${yaml.dump(data)}---`;
    
    // Écrire le nouveau contenu
    const newContent = newFrontMatter + restContent;
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    console.log(`Updated recipe: ${normalizedTitle}`);
    console.log(`  - Old UUID: ${oldUuid}`);
    console.log(`  - New UUID: ${newUuid}`);
    console.log(`  - Old Slug: ${oldSlug}`);
    console.log(`  - New Slug: ${newSlug}`);
    
    // Ajouter à la carte de mapping
    uuidMap[oldUuid] = newUuid;
    uuidMap[oldSlug] = newSlug;
    
    return { oldUuid, newUuid, oldSlug, newSlug };
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return null;
  }
}

// Fonction pour mettre à jour les références dans les événements
function updateEventReferences(eventFilePath, uuidMap) {
  try {
    const content = fs.readFileSync(eventFilePath, 'utf8');
    
    // Séparer le front-matter du contenu
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      console.log(`No front-matter found in event ${eventFilePath}`);
      return;
    }
    
    const frontMatter = match[1];
    const restContent = content.substring(match[0].length);
    
    // Parser le YAML avec js-yaml
    let data;
    try {
      data = yaml.load(frontMatter);
    } catch (e) {
      console.log(`Error parsing YAML in event ${eventFilePath}:`, e.message);
      return;
    }
    
    let updated = false;
    
    // Mettre à jour les références de recettes dans les repas
    if (data.repas && Array.isArray(data.repas)) {
      data.repas.forEach(repas => {
        if (repas.recettes_du_repas && Array.isArray(repas.recettes_du_repas)) {
          repas.recettes_du_repas.forEach(recetteRef => {
            if (recetteRef.recette && uuidMap[recetteRef.recette]) {
              recetteRef.recette = uuidMap[recetteRef.recette];
              updated = true;
            }
          });
        }
      });
    }
    
    if (updated) {
      // Reconstruire le front-matter avec js-yaml
      const newFrontMatter = `---\n${yaml.dump(data)}---`;
      
      // Écrire le nouveau contenu
      const newContent = newFrontMatter + restContent;
      fs.writeFileSync(eventFilePath, newContent, 'utf8');
      
      console.log(`Updated event references: ${path.basename(path.dirname(eventFilePath))}`);
    }
    
  } catch (error) {
    console.error(`Error updating event ${eventFilePath}:`, error.message);
  }
}

// Fonction principale
function main() {
  const recettesDir = path.join(__dirname, '..', 'content', 'recettes');
  const evenementsDir = path.join(__dirname, '..', 'content', 'evenements');
  
  // Carte de mapping entre anciens et nouveaux UUIDs/slugs
  const uuidMap = {};
  
  console.log('=== Updating Recipe UUIDs ===');
  
  // D'abord, collecter tous les chemins des fichiers index.md
  const folders = fs.readdirSync(recettesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`Found ${folders.length} recipe folders`);
  
  const filesToProcess = [];
  folders.forEach(folder => {
    const indexPath = path.join(recettesDir, folder, 'index.md');
    if (fs.existsSync(indexPath)) {
      filesToProcess.push(indexPath);
    }
  });
  
  // Traiter chaque recette
  filesToProcess.forEach(filePath => {
    updateRecipeUuid(filePath, uuidMap);
  });
  
  console.log('\n=== Updating Event References ===');
  
  // Mettre à jour les références dans les événements
  const eventFolders = fs.readdirSync(evenementsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`Found ${eventFolders.length} event folders`);
  
  eventFolders.forEach(folder => {
    const indexPath = path.join(evenementsDir, folder, 'index.md');
    if (fs.existsSync(indexPath)) {
      updateEventReferences(indexPath, uuidMap);
    }
  });
  
  console.log('\n=== Migration Complete ===');
  console.log(`Total recipes processed: ${Object.keys(uuidMap).length / 2}`);
  console.log(`UUID mapping created: ${Object.keys(uuidMap).length} entries`);
  
  // Sauvegarder la carte de mapping pour référence
  const mapFilePath = path.join(__dirname, 'uuid-mapping.json');
  fs.writeFileSync(mapFilePath, JSON.stringify(uuidMap, null, 2), 'utf8');
  console.log(`UUID map saved to: ${mapFilePath}`);
}

main();