#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

// Configuration des chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MATERIEL_PATH = path.join(__dirname, '../content/materiel');
const CATEGORIES_PATH = path.join(__dirname, '../../hugo-cookbook-theme/exampleSite/content/categories');
const OUTPUT_PATH = path.join(__dirname, '../static/data');
const OUTPUT_FILE = path.join(OUTPUT_PATH, 'materiel-categories.json');

/**
 * Extrait le frontmatter YAML d'un fichier markdown
 * @param {string} filePath - Chemin du fichier
 * @returns {object|null} - Frontmatter parsé ou null si erreur
 */
function extractFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Vérifier si le contenu commence par ---
    if (!content.startsWith('---')) {
      return null;
    }
    
    // Trouver la fin du frontmatter
    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) {
      return null;
    }
    
    const frontmatterStr = content.substring(3, endIndex).trim();
    const frontmatter = yaml.load(frontmatterStr);
    
    return frontmatter;
  } catch (error) {
    console.error(`Erreur en lisant ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Récupère tous les fichiers markdown dans un dossier et ses sous-dossiers
 * @param {string} dirPath - Chemin du dossier
 * @returns {string[]} - Liste des fichiers markdown
 */
function getAllMarkdownFiles(dirPath) {
  const files = [];
  
  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        traverse(itemPath);
      } else if (item.endsWith('.md')) {
        files.push(itemPath);
      }
    }
  }
  
  traverse(dirPath);
  return files;
}

/**
 * Extrait les titres des fichiers markdown dans un dossier
 * @param {string} dirPath - Chemin du dossier
 * @returns {string[]} - Liste des titres
 */
function extractTitles(dirPath) {
  const titles = [];
  const markdownFiles = getAllMarkdownFiles(dirPath);
  
  for (const filePath of markdownFiles) {
    const frontmatter = extractFrontmatter(filePath);
    
    if (frontmatter && frontmatter.title) {
      titles.push(frontmatter.title);
    }
  }
  
  return titles.sort();
}

/**
 * Fonction principale
 */
function main() {
  try {
    console.log('Extraction des titres...');
    
    // Vérifier que les dossiers existent
    if (!fs.existsSync(MATERIEL_PATH)) {
      console.error(`Le dossier materiel n'existe pas: ${MATERIEL_PATH}`);
      process.exit(1);
    }
    
    if (!fs.existsSync(CATEGORIES_PATH)) {
      console.error(`Le dossier categories n'existe pas: ${CATEGORIES_PATH}`);
      process.exit(1);
    }
    
    // Créer le dossier de sortie s'il n'existe pas
    if (!fs.existsSync(OUTPUT_PATH)) {
      fs.mkdirSync(OUTPUT_PATH, { recursive: true });
    }
    
    // Extraire les titres
    const materielTitles = extractTitles(MATERIEL_PATH);
    const categoriesTitles = extractTitles(CATEGORIES_PATH);
    
    // Créer l'objet JSON
    const data = {
      materiel: materielTitles,
      categories: categoriesTitles
    };
    
    // Écrire le fichier JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
    
    console.log(`✅ Fichier JSON généré avec succès: ${OUTPUT_FILE}`);
    console.log(`   - ${materielTitles.length} titres de matériel`);
    console.log(`   - ${categoriesTitles.length} titres de catégories`);
    
  } catch (error) {
    console.error('Erreur lors de l\'exécution:', error);
    process.exit(1);
  }
}

// Exécuter le script
main();

export { extractTitles, extractFrontmatter, getAllMarkdownFiles };