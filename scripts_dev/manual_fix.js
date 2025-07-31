#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Fonction pour générer un UUID court (8 caractères alphanumériques)
function generateShortUuid() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(x => chars[x % chars.length])
    .join('');
}

// Fonction pour slugifier un titre
function slugify(str) {
  return str
    .toLowerCase()
    .replace(
      /[^a-z0-9-]/g,
      (m) =>
        "éèêëàäâùüûîïôöç".includes(m)
          ? m.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          : m === "'"
            ? ""
            : "-"
    )
    .replace(/[- ]+/g, "-")
    .replace(/-$/, "");
}

// Liste des 17 recettes problématiques (basée sur le diagnostic)
const problematicRecipes = [
  // UUID longs classiques
  "houmous-de-betterave-aux-cranberries-et-balsamique_edc9f445-939e-453b-a3d0-0624e2c07e34",
  "salade-concombre-pommes-et-nigelle-a-l-aneth_eb424ca2-bea3-4cd3-ada3-a207c2cb53dc",
  "aubergines-grillees-cacao-ail-noir-et-piment_7b2688ac-6360-43b8-8083-635b1cc56257",
  "boulettes-fumees-de-haricots-rouges-et-champignons_5be3b6de-9a22-4635-a147-d4295c86c452",

  // UUID avec caractères spéciaux
  "fromage-blanc-et-fruits-rouges-et-son-alernative-vegan_2dqzo779osib3ssqpgzbg8-v2dx0pzps_eul",
  "gateau-a-la-creme-de-marron-nappage-chocolat_6y4opx4lcujv7-h-reqknfr_vd6a77flg9gd",
  "perles-du-japon-vanille-citron-gingembre-cranberries_kkipwm-j4qtfae825sqxhxbek0mapfzewici",
  "yahourt-de-brebis-a-la-creme-de-chataigne-et-son-alternative-vegan_v74tcl7im1xqy2zl7_gi6uwub7o1qsryek3v",
  "bouillon-soto-version-vegane-du-bouillon-de-poulet-a-la-javanaise_evzmM_dHOO_gopjEw2Ikn",
  "champignons-frits-et-sauce-cremeuse-ciboulette_fxvrocevdcjcxtqw_giiyacrzclqtsvk-foa",
  "creme-de-soja-a-la-noisette-et-graines-caramelisees_vew3lsv3wekhpggumf3wgaiyddgdjfm1mzym",
  "crepes-de-sarrasin-ricotta-epinards-et-champignons_vss2rla-uqbj_hyqh-ei_-u-jnin4ozyknlc",
  "salade-de-betteraves-roties-au-yaourt-et-au-citron-confit_swwnxwrqtoo55hxs5njhndd_c6-2zq5b9gco",
  "blanquette-de-soja-texture-et-riz-basmati_n91isqrvb0r4_qghwtzwcll8vv2lu09ugxl8",
  "risotto-sarrasin-torrefie-champignons-parmesan-vegan-et-oignon-brule_rscs2yqdy0n9funh_uz9x4hnnk2bb13ge9p7",

  // Autres formats
  "gateau-a-la-creme-de-marron-nappage-chocolat-vegan_aalonmycmmzyuupmnrn3xapjnyauxocsykp9",
  "tarte-tatin-aux-poivrons-vegane-et-sans-gluten_6zbcgostwl1urdg8ib9rzo6odnbaavesbni5"
];

console.log('🔧 Correction manuelle des 17 recettes problématiques...\n');

const slugMapping = new Map();
const existingSlugs = new Set();

// Fonction pour trouver le fichier d'une recette
function findRecipeFile(folderName) {
  const possiblePaths = [
    `content/recettes/entree/${folderName}/index.md`,
    `content/recettes/plat/${folderName}/index.md`,
    `content/recettes/dessert/${folderName}/index.md`
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return {
        filePath,
        folderPath: path.dirname(filePath),
        category: filePath.split('/')[2]
      };
    }
  }
  return null;
}

// Fonction pour remplacer brutalement dans le contenu
function bruteForcereplace(content, oldValue, newValue) {
  return content.split(oldValue).join(newValue);
}

// Étape 1: Collecter les slugs existants pour éviter les doublons
console.log('🔍 Collecte des slugs existants...');
const allRecipeDirs = [
  ...fs.readdirSync('content/recettes/entree').map(d => `content/recettes/entree/${d}`),
  ...fs.readdirSync('content/recettes/plat').map(d => `content/recettes/plat/${d}`),
  ...fs.readdirSync('content/recettes/dessert').map(d => `content/recettes/dessert/${d}`)
];

for (const dir of allRecipeDirs) {
  const folderName = path.basename(dir);
  if (folderName.match(/^[a-z0-9-]+_[a-z0-9]{8}$/)) {
    existingSlugs.add(folderName);
  }
}

console.log(`Trouvé ${existingSlugs.size} slugs existants\n`);

// Étape 2: Traiter chaque recette problématique
console.log('🔄 Traitement des recettes problématiques...');
let processedCount = 0;
let errorCount = 0;

for (const oldSlugFolder of problematicRecipes) {
  try {
    const recipeInfo = findRecipeFile(oldSlugFolder);

    if (!recipeInfo) {
      console.log(`❌ Fichier introuvable: ${oldSlugFolder}`);
      errorCount++;
      continue;
    }

    // Lire le fichier brutalement
    const fullContent = fs.readFileSync(recipeInfo.filePath, 'utf8');

    // Extraire le titre (approche simple)
    const titleMatch = fullContent.match(/^title:\s*(.+)$/m);
    if (!titleMatch) {
      console.log(`❌ Titre introuvable: ${oldSlugFolder}`);
      errorCount++;
      continue;
    }

    const title = titleMatch[1].trim().replace(/^['"]|['"]$/g, '');

    // Générer nouveau UUID et slug
    let newUuid, newSlug;
    do {
      newUuid = generateShortUuid();
      newSlug = `${slugify(title)}_${newUuid}`;
    } while (existingSlugs.has(newSlug));

    existingSlugs.add(newSlug);
    slugMapping.set(oldSlugFolder, newSlug);

    // Extraire l'ancien UUID du slug
    const oldUuidMatch = oldSlugFolder.match(/_(.+)$/);
    const oldUuid = oldUuidMatch ? oldUuidMatch[1] : '';

    // Remplacer brutalement dans le contenu
    let updatedContent = fullContent;

    // Remplacer l'UUID
    if (oldUuid) {
      updatedContent = bruteForcereplace(updatedContent, oldUuid, newUuid);
    }

    // Remplacer le titleslug (gérer les cas multilignes)
    updatedContent = bruteForcereplace(updatedContent, oldSlugFolder, newSlug);

    // Écrire le fichier mis à jour
    fs.writeFileSync(recipeInfo.filePath, updatedContent, 'utf8');

    // Renommer le dossier
    const oldFolderPath = recipeInfo.folderPath;
    const newFolderPath = path.join(path.dirname(oldFolderPath), newSlug);

    if (fs.existsSync(oldFolderPath) && !fs.existsSync(newFolderPath)) {
      fs.renameSync(oldFolderPath, newFolderPath);
      console.log(`✅ ${title}`);
      console.log(`   ${oldSlugFolder} → ${newSlug}`);
      processedCount++;
    } else {
      console.log(`⚠️  Problème renommage: ${oldSlugFolder}`);
    }

  } catch (error) {
    console.log(`❌ Erreur ${oldSlugFolder}: ${error.message}`);
    errorCount++;
  }
}

console.log(`\n📊 ${processedCount} recettes traitées, ${errorCount} erreurs\n`);

// Étape 3: Mettre à jour les événements
console.log('📅 Mise à jour des événements...');
const eventFiles = [
  'content/evenements/la-printaniere-chateaulin/index.md',
  'content/evenements/resistance-2024_4eajpityogb0aaxnnewmt/index.md',
  'content/evenements/exemple-1/index.md',
  'content/evenements/resistances-2025_kcypd9hcxogceev6bpfwgwoee_trh4bjvnws/index.md'
];

let eventUpdateCount = 0;

for (const eventFile of eventFiles) {
  try {
    if (!fs.existsSync(eventFile)) continue;

    let eventContent = fs.readFileSync(eventFile, 'utf8');
    let hasChanges = false;

    // Remplacer chaque ancien slug par le nouveau
    for (const [oldSlug, newSlug] of slugMapping.entries()) {
      if (eventContent.includes(oldSlug)) {
        eventContent = bruteForcereplace(eventContent, oldSlug, newSlug);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      fs.writeFileSync(eventFile, eventContent, 'utf8');
      console.log(`✅ ${path.basename(path.dirname(eventFile))}`);
      eventUpdateCount++;
    }

  } catch (error) {
    console.log(`❌ Erreur événement ${eventFile}: ${error.message}`);
  }
}

console.log(`\n📊 ${eventUpdateCount} événements mis à jour\n`);

// Étape 4: Vérification finale
console.log('🔍 Vérification finale...');
let verificationSuccess = 0;
let verificationFailed = 0;

for (const [oldSlug, newSlug] of slugMapping.entries()) {
  const recipeInfo = findRecipeFile(newSlug);
  if (recipeInfo) {
    verificationSuccess++;
  } else {
    console.log(`⚠️  Vérification échouée: ${newSlug}`);
    verificationFailed++;
  }
}

console.log(`\n🎉 Correction manuelle terminée !`);
console.log(`📊 Résultats:`);
console.log(`   - ✅ Recettes traitées : ${processedCount}`);
console.log(`   - ✅ Vérifications OK : ${verificationSuccess}`);
console.log(`   - ❌ Erreurs : ${errorCount + verificationFailed}`);
console.log(`   - 📅 Événements mis à jour : ${eventUpdateCount}`);

if (verificationSuccess === processedCount && errorCount === 0) {
  console.log(`\n🎊 Succès total ! Toutes les recettes problématiques ont été corrigées !`);
  console.log(`\n💡 Relancez le diagnostic pour confirmer que tout est OK.`);
} else {
  console.log(`\n⚠️  Certaines recettes nécessitent encore une attention manuelle.`);
}
