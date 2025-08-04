#!/usr/bin/env node

/**
 * Script principal d'orchestration de la migration complète
 * 
 * Ce script exécute les trois étapes de migration dans l'ordre:
 * 1. migrate-content.js - Ajout des UUID et transformation initiale
 * 2. update-ingredient-references.js - Mise à jour des références et renommage
 * 3. verify-migration.js - Vérification finale
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { main as backupBeforeMigration } from './backup-before-migration.js';
import { fileURLToPath } from 'url';

// Reconstitution __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SCRIPTS_DIR = __dirname;
const REPORTS = [
  'migration-report.json',
  'migration-final-report.json', 
  'verification-report.json'
];

// Fonction pour exécuter une commande
function runCommand(command, description) {
  console.log(`\n🚀 ${description}...`);
  console.log(`📝 Commande: ${command}`);
  
  try {
    const startTime = Date.now();
    execSync(command, { 
      cwd: SCRIPTS_DIR,
      stdio: 'inherit',
      encoding: 'utf8'
    });
    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ ${description} terminée en ${duration.toFixed(1)}s`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de ${description}:`);
    console.error(error.message);
    return false;
  }
}

// Fonction pour nettoyer les anciens rapports
function cleanReports() {
  console.log('\n🧹 Nettoyage des anciens rapports...');
  
  REPORTS.forEach(report => {
    const reportPath = path.join(SCRIPTS_DIR, report);
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
      console.log(`  🗑️  Supprimé: ${report}`);
    }
  });
}

// Fonction pour vérifier si un rapport existe
function reportExists(reportName) {
  return fs.existsSync(path.join(SCRIPTS_DIR, reportName));
}

// Fonction pour afficher un résumé
function showSummary() {
  console.log('\n📊 Résumé de la migration:');
  
  if (reportExists('verification-report.json')) {
    const verification = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'verification-report.json'), 'utf8'));
    const { summary } = verification;
    
    console.log(`   Ingrédients valides: ${summary.validIngredients}/${summary.totalIngredients}`);
    console.log(`   Recettes valides: ${summary.validRecettes}/${summary.totalRecettes}`);
    
    if (summary.invalidIngredients === 0 && summary.invalidRecettes === 0) {
      console.log('\n🎉 Migration réussie! Tous les fichiers sont valides.');
      return true;
    } else {
      console.log('\n⚠️  Migration terminée avec des erreurs.');
      return false;
    }
  } else {
    console.log('\n❌ Rapport de vérification non trouvé.');
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('🎯 Démarrage de la migration complète ENKA Cookbook');
  console.log('===============================================');
  console.log('⚠️  Assurez-vous d\'avoir une sauvegarde de votre dossier content/');
  console.log('⏱️  Cette opération peut prendre plusieurs minutes...\n');
  
  // Demander confirmation
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    rl.question('Continuer la migration? (oui/non): ', resolve);
  });
  
  rl.close();
  
  if (answer.toLowerCase() !== 'oui') {
    console.log('\n❌ Migration annulée.');
    process.exit(0);
  }
  
  console.log('\n✅ Confirmation reçue, démarrage de la migration...\n');
  
  // Étape 0: Sauvegarde
  console.log('📦 Création d\'une sauvegarde avant migration...');
  try {
    const backupPath = backupBeforeMigration();
    console.log(`✅ Sauvegarde créée: ${backupPath}`);
  } catch (error) {
    console.error('❌ Échec de la sauvegarde:', error.message);
    console.error('❌ Migration annulée pour protéger vos données.');
    process.exit(1);
  }
  
  // Étape 1: Nettoyage
  cleanReports();
  
  // Étape 2: Migration initiale
  const step1Success = runCommand(
    'node migrate-content.js', 
    'Étape 2/4: Ajout des UUID et transformation initiale'
  );
  
  if (!step1Success) {
    console.error('\n❌ Échec à l\'étape 1. Arrêt de la migration.');
    process.exit(1);
  }
  
  // Vérifier que le rapport intermédiaire a été créé
  if (!reportExists('migration-report.json')) {
    console.error('\n❌ Rapport de migration non trouvé après l\'étape 1.');
    process.exit(1);
  }
  
  // Étape 3: Mise à jour des références
  const step2Success = runCommand(
    'node update-ingredient-references.js',
    'Étape 3/4: Mise à jour des références et renommage'
  );
  
  if (!step2Success) {
    console.error('\n❌ Échec à l\'étape 2. Arrêt de la migration.');
    process.exit(1);
  }
  
  // Étape 4: Vérification
  const step3Success = runCommand(
    'node verify-migration.js',
    'Étape 4/4: Vérification finale'
  );
  
  if (!step3Success) {
    console.error('\n❌ Échec à l\'étape 3. La migration a rencontré des problèmes.');
    process.exit(1);
  }
  
  // Afficher le résumé final
  const success = showSummary();
  
  if (success) {
    console.log('\n🎯 Prochaines étapes:');
    console.log('   1. Testez le build Hugo: cd ../.. && hugo --minify');
    console.log('   2. Vérifiez que les layouts fonctionnent correctement');
    console.log('   3. Mettez à jour la configuration Sveltia CMS si nécessaire');
    console.log('   4. Lancez le serveur de développement: hugo server -D -F');
    console.log('   5. Une fois validé, vous pouvez supprimer la sauvegarde si tout est bon');
    
    console.log('\n🎉 Migration terminée avec succès!');
    console.log('💾 Une sauvegarde a été créée au cas où vous auriez besoin de restaurer.');
    process.exit(0);
  } else {
    console.log('\n🔧 Veuillez corriger les erreurs avant de continuer.');
    console.log('   Consultez le fichier verification-report.json pour plus de détails.');
    console.log('💾 Vous pouvez restaurer depuis la sauvegarde si nécessaire.');
    process.exit(1);
  }
}

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erreur non gérée:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n❌ Migration interrompue par l\'utilisateur.');
  process.exit(1);
});

// Lancer la migration
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { runCommand, cleanReports, showSummary };