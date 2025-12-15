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
function processRecipeAndRenameFolder(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Séparer le front-matter du contenu
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      console.log(`No front-matter found in ${filePath}`);
      return;
    }
    
    const frontMatter = match[1];
    const restContent = content.substring(match[0].length);
    
    // Parser le YAML avec js-yaml
    let data;
    try {
      data = yaml.load(frontMatter);
    } catch (e) {
      console.log(`Error parsing YAML in ${filePath}:`, e.message);
      return;
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
    
    if (oldFolderPath !== newFolderPath) {
      fs.renameSync(oldFolderPath, newFolderPath);
      console.log(`Renamed folder: ${path.basename(oldFolderPath)} -> ${newSlug}`);
    }
    
    console.log(`Processed: ${filePath}`);
    console.log(`  - UUID: ${uuid}`);
    console.log(`  - Slug: ${newSlug}`);
    console.log(`  - Normalized Title: ${normalizedTitle}`);
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Fonction principale
function main() {
  const recettesDir = path.join(__dirname, '..', 'content', 'recettes');
  
  const folders = fs.readdirSync(recettesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`Found ${folders.length} recipe folders`);
  
  // Créer un tableau pour stocker les chemins des fichiers à traiter
  const filesToProcess = [];
  
  // D'abord, collecter tous les chemins des fichiers index.md
  folders.forEach(folder => {
    const indexPath = path.join(recettesDir, folder, 'index.md');
    if (fs.existsSync(indexPath)) {
      filesToProcess.push(indexPath);
    }
  });
  
  // Traiter chaque fichier
  filesToProcess.forEach(filePath => {
    processRecipeAndRenameFolder(filePath);
  });
  
  console.log('Processing complete!');
}

main();