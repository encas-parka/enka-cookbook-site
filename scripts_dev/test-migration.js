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
    
    console.log(`Old folder: ${oldSlug}`);
    console.log(`New folder: ${newSlug}`);
    console.log(`Old path: ${oldFolderPath}`);
    console.log(`New path: ${newFolderPath}`);
    
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
              console.log(`  Updating reference: ${recetteRef.recette} -> ${slugMap[recetteRef.recette]}`);
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
    } else {
      console.log(`No references to update in event: ${path.basename(path.dirname(eventFilePath))}`);
    }
    
  } catch (error) {
    console.error(`Error updating event ${eventFilePath}:`, error.message);
  }
}

// Fonction principale - Test sur un échantillon limité
function main() {
  const recettesDir = path.join(__dirname, '..', 'content', 'recettes');
  const evenementsDir = path.join(__dirname, '..', 'content', 'evenements');
  
  // Carte de mapping entre anciens et nouveaux slugs
  const slugMap = {};
  
  console.log('=== Testing Recipe Processing (limited sample) ===');
  
  // Traiter seulement les 5 premières recettes pour le test
  const folders = fs.readdirSync(recettesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .slice(0, 5); // Limiter à 5 pour le test
  
  console.log(`Testing on ${folders.length} recipe folders`);
  
  folders.forEach(folder => {
    const indexPath = path.join(recettesDir, folder, 'index.md');
    if (fs.existsSync(indexPath)) {
      processRecipe(indexPath, slugMap);
      console.log('---');
    }
  });
  
  console.log('\n=== Testing Event Reference Updates ===');
  console.log(`Slug map:`, slugMap);
  
  // Trouver un événement qui référence l'une de nos recettes test
  const eventFolders = fs.readdirSync(evenementsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`Checking ${eventFolders.length} event folders for references`);
  
  let eventUpdated = false;
  for (const folder of eventFolders) {
    const indexPath = path.join(evenementsDir, folder, 'index.md');
    if (fs.existsSync(indexPath)) {
      // Vérifier si cet événement référence l'une de nos recettes test
      const content = fs.readFileSync(indexPath, 'utf8');
      const hasTestRecipe = Object.keys(slugMap).some(oldSlug => 
        content.includes(oldSlug)
      );
      
      if (hasTestRecipe) {
        console.log(`Found event with test recipe references: ${folder}`);
        updateEventReferences(indexPath, slugMap);
        eventUpdated = true;
        break; // Ne traiter qu'un seul événement pour le test
      }
    }
  }
  
  if (!eventUpdated) {
    console.log('No events found with test recipe references');
  }
  
  console.log('\n=== Test Complete ===');
  console.log(`Slug map created:`, slugMap);
}

main();