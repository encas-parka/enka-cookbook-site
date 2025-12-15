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

// Test sur une seule recette
function testSingleRecipe() {
  const filePath = path.join(__dirname, '..', 'content', 'recettes', 'houmous-pois-chiche_85BRK-R6Xwvd', 'index.md');
  
  if (!fs.existsSync(filePath)) {
    console.log(`Fichier non trouvé: ${filePath}`);
    return;
  }
  
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
    
    console.log('=== Avant migration ===');
    console.log(`UUID actuel: ${data.uuid}`);
    console.log(`Slug actuel: ${data.slug}`);
    console.log(`Titre actuel: ${data.title}`);
    
    // Générer un nouvel UUID en minuscules
    const newUuid = nanoid();
    
    // Créer le slug à partir du titre avec le nouvel UUID
    const originalTitle = data.title || '';
    const titleSlug = slugify(originalTitle).substring(0, 22);
    const newSlug = `${titleSlug}_${newUuid}`;
    
    // Normaliser le titre
    const normalizedTitle = normalizeTitle(originalTitle);
    
    console.log('\n=== Après migration ===');
    console.log(`Nouvel UUID: ${newUuid}`);
    console.log(`Nouveau slug: ${newSlug}`);
    console.log(`Titre normalisé: ${normalizedTitle}`);
    
    // Vérifier que le nouvel UUID est bien en minuscules
    if (newUuid === newUuid.toLowerCase()) {
      console.log('✓ Nouvel UUID est bien en minuscules');
    } else {
      console.log('✗ Nouvel UUID contient des majuscules!');
    }
    
    // Vérifier que le nouveau slug est bien en minuscules
    if (newSlug === newSlug.toLowerCase()) {
      console.log('✓ Nouveau slug est bien en minuscules');
    } else {
      console.log('✗ Nouveau slug contient des majuscules!');
    }
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

testSingleRecipe();