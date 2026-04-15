# Script de correction des UUIDs d'ingrédients

## Problème

Lors de la création/édition de recettes, un bug causait la génération d'UUIDs aléatoires (via `nanoid()`) pour les ingrédients au lieu d'utiliser les UUIDs de la base de données `ingredients.json`. Cela entraînait des duplications : le même ingrédient (ex: "Eau") pouvait avoir plusieurs UUIDs différents dans la même recette.

## Solution

Le script `fix-ingredient-uuids.js` identifie tous les ingrédients avec des UUIDs nanoid (21 caractères) et les remplace par les UUIDs corrects de `ingredients.json`.

## Utilisation

### Mode aperçu (recommandé en premier)

```bash
node scripts_dev/fix-ingredient-uuids.js --dry-run
```

Affiche un rapport détaillé des modifications **sans** appliquer les changements.

### Application des modifications

```bash
node scripts_dev/fix-ingredient-uuids.js
```

Applique les corrections aux fichiers de recettes.

## Ce que fait le script

1. Charge `static/data/ingredients.json` et crée un index nom → UUID
2. Parcourt toutes les recettes dans `content/recipe/`
3. Identifie les ingrédients avec des UUIDs de 21 caractères (nanoid)
4. Pour chaque ingrédient trouvé :
   - Recherche l'UUID correspondant dans `ingredients.json` par nom
   - Remplace l'UUID nanoid par l'UUID de la base de données
5. Génère un rapport des modifications

## Résultat attendu

Après correction :
- ✅ Tous les ingrédients avec le même nom partagent le même UUID
- ✅ Les quantités sont correctement agrégées dans les événements
- ✅ Plus de duplications dans la liste des produits

## Exemple de sortie

```
📊 RAPPORT
📁 Recettes analysées avec problèmes: 4
🔧 Total des problèmes détectés: 17
✅ Problèmes résolubles: 17

📄 kalb-el-louz-gateau-de_hn7u4fndnq39/index.md
   ✅ "Eau" (60 ml)
      Yxw97uzjJ5_sRA_5lt_ew → ljzb7j
   ✅ "Eau" (600 ml)
      zqLXJvFaNkBMeVRPsUO8B → ljzb7j
```

## Notes importantes

- Le script ne modifie que les fichiers YAML (frontmatter des recettes)
- Le contenu markdown (préparation, astuces, etc.) est préservé intact
- Les ingrédients non trouvés dans `ingredients.json` sont signalés mais non modifiés
- Il est recommandé d'exécuter le script en mode `--dry-run` d'abord pour voir l'ampleur des modifications

## Dépendances

- `js-yaml` (déjà installé dans le projet)
- Node.js (ES modules supportés)
