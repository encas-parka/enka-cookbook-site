#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fonction pour renommer les répertoires selon la carte de mapping
function renameDirectories() {
  try {
    // Charger la carte de mapping
    const mapFilePath = path.join(__dirname, 'uuid-mapping.json');
    if (!fs.existsSync(mapFilePath)) {
      console.log('Fichier de mapping non trouvé. Veuillez d\'abord exécuter migrate-uuids-only.js');
      return;
    }
    
    const uuidMap = JSON.parse(fs.readFileSync(mapFilePath, 'utf8'));
    
    const recettesDir = path.join(__dirname, '..', 'content', 'recettes');
    
    console.log('=== Renommage des répertoires ===');
    
    // Lister tous les répertoires de recettes
    const folders = fs.readdirSync(recettesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`Trouvé ${folders.length} répertoires de recettes`);
    
    let renamedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    folders.forEach(oldSlug => {
      // Vérifier si ce slug existe dans le mapping
      if (uuidMap[oldSlug]) {
        const newSlug = uuidMap[oldSlug];
        
        const oldPath = path.join(recettesDir, oldSlug);
        const newPath = path.join(recettesDir, newSlug);
        
        // Vérifier si le nouveau chemin existe déjà
        if (fs.existsSync(newPath)) {
          console.log(`⚠️  Répertoire ${newSlug} existe déjà, sauté`);
          skippedCount++;
          return;
        }
        
        try {
          fs.renameSync(oldPath, newPath);
          console.log(`✓ Renommé: ${oldSlug} -> ${newSlug}`);
          renamedCount++;
        } catch (error) {
          console.log(`✗ Erreur lors du renommage de ${oldSlug}:`, error.message);
          errorCount++;
        }
      }
    });
    
    console.log('\n=== Résumé ===');
    console.log(`Répertoires renommés: ${renamedCount}`);
    console.log(`Répertoires sautés: ${skippedCount}`);
    console.log(`Erreurs: ${errorCount}`);
    
    if (errorCount === 0 && renamedCount > 0) {
      console.log('✓ Renommage terminé avec succès !');
    } else {
      console.log('⚠️ Certains répertoires n\'ont pas pu être renommés');
    }
    
  } catch (error) {
    console.error('Erreur lors du renommage des répertoires:', error.message);
  }
}

renameDirectories();