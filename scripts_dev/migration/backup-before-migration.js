#!/usr/bin/env node

/**
 * Script de sauvegarde avant migration
 * 
 * Ce script crée une sauvegarde complète du dossier content/
 * avant de lancer la migration pour permettre une restauration facile
 * en cas de problème.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Reconstitution __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONTENT_ROOT = path.join(__dirname, '..', '..', 'content');
const BACKUP_ROOT = path.join(__dirname, '..', '..', 'backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
const BACKUP_NAME = `migration-backup-${TIMESTAMP}`;
const BACKUP_PATH = path.join(BACKUP_ROOT, BACKUP_NAME);

// Fonction pour vérifier si un dossier existe
function directoryExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

// Fonction pour créer un dossier
function createDirectory(dirPath) {
  if (!directoryExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Fonction pour copier un fichier
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

// Fonction pour copier un dossier récursivement
function copyDirectory(src, dest) {
  createDirectory(dest);
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// Fonction pour obtenir la taille d'un dossier
function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      totalSize += getDirectorySize(entryPath);
    } else {
      totalSize += fs.statSync(entryPath).size;
    }
  }
  
  return totalSize;
}

// Fonction pour formater la taille en octets
function formatSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Fonction principale de sauvegarde
function main() {
  console.log('💾 Démarrage de la sauvegarde avant migration...\n');
  
  // Vérifier que le dossier content existe
  if (!directoryExists(CONTENT_ROOT)) {
    console.error('❌ Dossier content/ non trouvé!');
    process.exit(1);
  }
  
  // Créer le dossier de sauvegarde
  createDirectory(BACKUP_ROOT);
  
  console.log(`📁 Dossier de sauvegarde: ${BACKUP_PATH}`);
  
  // Vérifier si la sauvegarde existe déjà
  if (directoryExists(BACKUP_PATH)) {
    console.error('❌ Une sauvegarde avec ce nom existe déjà!');
    process.exit(1);
  }
  
  // Obtenir la taille avant sauvegarde
  console.log('📊 Calcul de la taille du dossier content/...');
  const originalSize = getDirectorySize(CONTENT_ROOT);
  console.log(`   Taille: ${formatSize(originalSize)}`);
  
  // Démarrer la sauvegarde
  console.log('\n🔄 Copie des fichiers...');
  const startTime = Date.now();
  
  try {
    copyDirectory(CONTENT_ROOT, BACKUP_PATH);
    
    const duration = (Date.now() - startTime) / 1000;
    const backupSize = getDirectorySize(BACKUP_PATH);
    
    console.log(`\n✅ Sauvegarde terminée en ${duration.toFixed(1)}s`);
    console.log(`   Taille sauvegardée: ${formatSize(backupSize)}`);
    console.log(`   Emplacement: ${BACKUP_PATH}`);
    
    // Vérifier que la sauvegarde est complète
    if (originalSize !== backupSize) {
      console.warn(`⚠️  Attention: la taille de la sauvegarde (${formatSize(backupSize)}) est différente de l'original (${formatSize(originalSize)})`);
    } else {
      console.log('✅ Taille de la sauvegarde vérifiée avec succès');
    }
    
    // Créer un fichier de métadonnées
    const metadata = {
      timestamp: TIMESTAMP,
      backupPath: BACKUP_PATH,
      originalPath: CONTENT_ROOT,
      originalSize,
      backupSize,
      duration,
      files: []
    };
    
    // Lister les fichiers sauvegardés
    const listFiles = (dirPath, relativePath = '') => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          listFiles(fullPath, relPath);
        } else {
          metadata.files.push({
            path: relPath,
            size: fs.statSync(fullPath).size,
            modified: fs.statSync(fullPath).mtime
          });
        }
      }
    };
    
    listFiles(CONTENT_ROOT);
    
    const metadataPath = path.join(BACKUP_PATH, 'backup-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`📝 Métadonnées sauvegardées dans: ${metadataPath}`);
    
    // Créer un lien symbolique vers la dernière sauvegarde
    const latestLink = path.join(BACKUP_ROOT, 'latest-migration-backup');
    try {
      if (fs.existsSync(latestLink)) {
        fs.unlinkSync(latestLink);
      }
      fs.symlinkSync(BACKUP_PATH, latestLink);
      console.log(`🔗 Lien symbolique créé: ${latestLink} -> ${BACKUP_PATH}`);
    } catch (error) {
      console.warn(`⚠️  Impossible de créer le lien symbolique: ${error.message}`);
    }
    
    console.log('\n🎯 Sauvegarde terminée avec succès!');
    console.log('   Vous pouvez maintenant lancer la migration en toute sécurité.');
    console.log(`   Pour restaurer: cp -r ${BACKUP_PATH}/content/* ${CONTENT_ROOT}/`);
    
    return BACKUP_PATH;
    
  } catch (error) {
    console.error(`❌ Erreur lors de la sauvegarde: ${error.message}`);
    
    // Nettoyer le dossier de sauvegarde incomplet
    if (directoryExists(BACKUP_PATH)) {
      try {
        fs.rmSync(BACKUP_PATH, { recursive: true, force: true });
        console.log('🧹 Dossier de sauvegarde incomplet nettoyé.');
      } catch (cleanupError) {
        console.error(`❌ Impossible de nettoyer le dossier de sauvegarde: ${cleanupError.message}`);
      }
    }
    
    process.exit(1);
  }
}

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erreur non gérée:', reason);
  process.exit(1);
});

// Lancer la sauvegarde
if (import.meta.url === `file://${process.argv[1]}`) {
  const backupPath = main();
  
  // Si le script est appelé directement, retourner le chemin de sauvegarde
  if (process.stdout.isTTY) {
    console.log(`\n💡 Pour utiliser cette sauvegarde dans un script:`);
    console.log(`   export BACKUP_PATH="${backupPath}"`);
  }
}

export { main, createDirectory, copyDirectory, getDirectorySize, formatSize };