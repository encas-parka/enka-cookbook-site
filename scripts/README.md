# Scripts Utilitaires - Enka Cookbook

Ce dossier contient des scripts utilitaires pour la maintenance et la migration des données du site Enka Cookbook.

## Scripts disponibles

### `sort-ingredients.js`

Script de migration pour trier automatiquement tous les ingrédients par ordre alphabétique dans les fichiers JSON du dossier `data/ingredients/`.

#### Fonctionnalités

- ✅ Tri alphabétique insensible à la casse
- ✅ Traitement de tous les fichiers JSON du dossier ingredients
- ✅ Vérification avant modification (évite les réécritures inutiles)
- ✅ Préservation de la structure JSON
- ✅ Rapport détaillé des modifications
- ✅ Gestion d'erreurs robuste

#### Utilisation

```bash
# Avec Node.js
node scripts/sort-ingredients.js

# Avec Bun
bun scripts/sort-ingredients.js

# Ou via npm script (depuis le dossier scripts/)
cd scripts
npm run sort-ingredients
```

#### Exemple de sortie

```
🚀 Début de la migration - Tri des ingrédients

📂 8 fichier(s) JSON trouvé(s):
   - animaux.json
   - autres.json
   - epices.json
   - frais.json
   - legumes.json
   - lof.json
   - sec.json
   - sucres.json

📄 Traitement de animaux.json...
✅ animaux.json - 15 ingrédients triés
📄 Traitement de autres.json...
✅ autres.json - Déjà trié
📄 Traitement de epices.json...
✅ epices.json - 42 ingrédients triés

🎉 Migration terminée !
📊 Résumé:
   - Fichiers traités: 8
   - Fichiers modifiés: 6
   - Fichiers déjà triés: 2
```

#### Sécurité

- Le script vérifie la structure des fichiers avant modification
- Les fichiers malformés sont ignorés avec un message d'avertissement
- Une sauvegarde est recommandée avant exécution (via Git par exemple)

## Prérequis

- Node.js >= 14.0.0 ou Bun
- Accès en lecture/écriture au dossier `data/ingredients/`

## Installation

Aucune installation requise, les scripts utilisent uniquement les modules natifs de Node.js.

## Contribution

Pour ajouter de nouveaux scripts :

1. Créer le fichier `.js` dans ce dossier
2. Ajouter la documentation dans ce README
3. Optionnellement, ajouter un script npm dans `package.json`

## Notes importantes

- Ces scripts modifient directement les fichiers de données
- Il est recommandé de faire une sauvegarde (commit Git) avant exécution
- Les scripts sont conçus pour être idempotents (sûrs à exécuter plusieurs fois)