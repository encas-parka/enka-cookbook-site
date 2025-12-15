#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Fonction pour traiter une recette et renommer le dossier
function processRecipe(filePath, slugMap) {
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
    
    // Générer UUID avec nanoid (12 caractères)
    const uuid = nanoid(12);
    
    // Créer le slug à partir du titre
    const originalTitle = data.title || '';
    const titleSlug = slugify(originalTitle).substring(0, 22);
    const newSlug = `${titleSlug}_${uuid}`;
    
    // Normaliser le titre
    const normalizedTitle = normalizeTitle(originalTitle);
    
    // Mettre à jour les données
    data.uuid = uuid;
    data.slug = newSlug;
    data.title = normalizedTitle;
    
    // Reconstruire le front-matter avec js-yaml
    const newFrontMatter = `---\n${yaml.dump(data)}---`;
    
    // Écrire le nouveau contenu
    const newContent = newFrontMatter + restContent;
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    // Renommer le dossier parent avec le nouveau slug
    const oldFolderPath = path.dirname(filePath);
    const parentDir = path.dirname(oldFolderPath);
    const newFolderPath = path.join(parentDir, newSlug);
    
    const oldSlug = path.basename(oldFolderPath);
    
    if (oldFolderPath !== newFolderPath) {
      if (fs.existsSync(newFolderPath)) {
        console.log(`ERROR: Target folder ${newSlug} already exists!`);
        return null;
      }
      fs.renameSync(oldFolderPath, newFolderPath);
      console.log(`Renamed folder: ${oldSlug} -> ${newSlug}`);
    } else {
      console.log(`Folder name unchanged: ${newSlug}`);
    }
    
    console.log(`Processed recipe: ${normalizedTitle}`);
    console.log(`  - UUID: ${uuid}`);
    console.log(`  - Old Slug: ${oldSlug}`);
    console.log(`  - New Slug: ${newSlug}`);
    
    // Ajouter à la carte de mapping
    slugMap[oldSlug] = newSlug;
    
    return { oldSlug, newSlug, filePath: path.join(newFolderPath, 'index.md') };
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return null;
  }
}

// Fonction pour mettre à jour les références dans les événements
function updateEventReferences(eventFilePath, slugMap) {
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
            if (recetteRef.recette && slugMap[recetteRef.recette]) {
              recetteRef.recette = slugMap[recetteRef.recette];
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
  
  // Carte de mapping entre anciens et nouveaux slugs
  const slugMap = {};
  
  console.log('=== Processing Recipes ===');
  
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
    processRecipe(filePath, slugMap);
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
      updateEventReferences(indexPath, slugMap);
    }
  });
  
  console.log('\n=== Migration Complete ===');
  console.log(`Total recipes processed: ${Object.keys(slugMap).length}`);
  console.log(`Slug mapping created: ${Object.keys(slugMap).length} entries`);
  
  // Sauvegarder la carte de mapping pour référence
  const mapFilePath = path.join(__dirname, 'recipe-slug-map.json');
  fs.writeFileSync(mapFilePath, JSON.stringify(slugMap, null, 2), 'utf8');
  console.log(`Slug map saved to: ${mapFilePath}`);
}

main();