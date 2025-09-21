# Scripts de Migration ENKA Cookbook

Ce dossier contient les scripts nécessaires pour migrer le contenu existant vers la nouvelle structure avec slugs immuables et UUID.

## 🎯 Objectif

La migration vise à transformer la structure de données existante pour:
- Ajouter des UUID uniques à tous les ingrédients, recettes et événements
- Créer des slugs immuables au format `titre_uuid`
- Transformer les références d'ingrédients dans les recettes du format groupé par type vers le format plat avec slugs
- Mettre à jour les références aux recettes dans les événements pour utiliser les nouveaux slugs

## 📋 Prérequis

- Node.js >= 14
- Dépendances npm: `js-yaml`

Installer les dépendances:
```bash
cd scripts_dev
npm install js-yaml
```

## 🚀 Processus de Migration

### Étape 1: Première passe - Ajout des UUID et transformation initiale

```bash
cd scripts_dev/migration
node migrate-content.js
```

Ce script:
1. Parcourt tous les ingrédients
2. Ajoute un UUID court (8 caractères) à chaque ingrédient
3. Parcourt toutes les recettes
4. Ajoute un UUID complet (UUID v4) à chaque recette
5. Parcourt tous les événements
6. Ajoute un UUID complet (UUID v4) à chaque événement
7. Transforme la structure des ingrédients dans les recettes du format groupé par type vers le format plat
8. Génère un rapport `migration-report.json`

**Note:** Tous les fichiers sont maintenant traités, il n'y a plus de filtres pour les fichiers de test.

### Étape 2: Deuxième passe - Mise à jour des références et renommage

```bash
node update-ingredient-references.js
```

Ce script:
1. Lit le rapport généré à l'étape 1
2. Crée un index des ingrédients par titre -> slug
3. Met à jour les références d'ingrédients dans les recettes (titre -> slug)
4. Renomme les répertoires des ingrédients avec les nouveaux slugs
5. Renomme les répertoires des recettes avec les nouveaux slugs
6. Renomme les répertoires des événements avec les nouveaux slugs
7. Génère un rapport final `migration-final-report.json`

### Étape 3: Vérification

```bash
node verify-migration.js
```

Ce script:
1. Vérifie que tous les ingrédients ont un UUID et un slug correct
2. Vérifie que toutes les recettes ont un UUID et un slug correct
3. Vérifie que tous les événements ont un UUID et un slug correct
4. Vérifie que les références d'ingrédients utilisent bien les slugs
5. Vérifie que les références aux recettes dans les événements utilisent bien les slugs
6. Génère un rapport de vérification `verification-report.json`

## 📊 Rapports générés

### `migration-report.json` (après étape 1)
```json
{
  "migratedIngredients": [
    {
      "oldTitle": "Ail",
      "newSlug": "ail_1a2b3c4d",
      "uuid": "1a2b3c4d",
      "type": "legumes",
      "oldPath": ".../content/ingredients/ail",
      "newPath": ".../content/ingredients/ail_1a2b3c4d"
    }
  ],
  "migratedRecettes": [...],
  "migratedEvenements": [...],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### `migration-final-report.json` (après étape 2)
Contient toutes les informations du rapport initial plus les résultats des mises à jour et renommages.

### `verification-report.json` (après étape 3)
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "summary": {
    "totalIngredients": 100,
    "validIngredients": 100,
    "invalidIngredients": 0,
    "totalRecettes": 50,
    "validRecettes": 50,
    "invalidRecettes": 0,
    "totalEvenements": 10,
    "validEvenements": 10,
    "invalidEvenements": 0
  },
  "ingredientResults": [...],
  "recetteResults": [...],
  "evenementResults": [...]
}
```

## ⚠️ Avertissements

1. **Sauvegarde**: Effectuez une sauvegarde complète de votre dossier `content/` avant de lancer la migration.

2. **Test**: Testez d'abord sur une copie du contenu pour vous assurer que tout fonctionne comme prévu.

3. **Interruption**: Si un script est interrompu, vérifiez l'état actuel avant de le relancer.

4. **Conflits**: Si des répertoires de destination existent déjà, ils seront écrasés.

## 🔧 Dépannage

### Problèmes courants

1. **Erreur "Pas de frontmatter trouvé"**
   - Vérifiez que le fichier `index.md` existe et contient bien un frontmatter au format YAML.

2. **Erreur "Erreur de parsing YAML"**
   - Vérifiez la syntaxe YAML dans le frontmatter du fichier indiqué.

3. **Références d'ingrédients non résolues**
   - Certains ingrédients référencés dans les recettes n'ont pas été trouvés. Vérifiez les noms exacts.

4. **Références de recettes non résolues dans les événements**
   - Certaines recettes référencées dans les événements n'ont pas été trouvées. Vérifiez les slugs exacts.

4. **UUID déjà présent**
   - Les fichiers contenant déjà un UUID sont ignorés. Si vous voulez les migrer à nouveau, supprimez d'abord le champ UUID.

### Commandes utiles

```bash
# Vérifier la syntaxe d'un fichier frontmatter
node -e "console.log(require('js-yaml').load(require('fs').readFileSync('chemin/vers/index.md', 'utf8').match(/^---\n([\s\S]*?)\n---/)[1]))"

# Nettoyer les fichiers de rapport
rm -f migration-report.json migration-final-report.json verification-report.json
```

## 📝 Notes techniques

### Format des UUID

- **Ingrédients**: UUID court de 8 caractères (ex: `1a2b3c4d`)
- **Recettes**: UUID court de 8 caractères (ex: `1a2b3c4d`)
- **Événements**: UUID court de 8 caractères (ex: `1a2b3c4d`)

### Format des slugs

- **Ingrédients**: `titre_uuid` (ex: `ail_1a2b3c4d`)
- **Recettes**: `titre_uuid` (ex: `bibimbap_1a2b3c4d`)
- **Événements**: `titre_uuid` (ex: `marche_1a2b3c4d`)

### Structure des ingrédients dans les recettes

**Avant migration:**
```yaml
ingredients:
  legumes:
    - title: Ail
      quantite: 3
      unit: tête·s
  lof:
    - title: Huile d'olive
      quantite: 1
      unit: l.
```

**Après migration:**
```yaml
ingredients:
  - ingredient: ail_1a2b3c4d
    quantite: 3
    unit: tête·s
  - ingredient: huile-d-olive_5e6f7g8h
    quantite: 1
    unit: l.
```

## 🎉 Après la migration

Une fois la migration terminée et vérifiée avec succès:

1. Les layouts Hugo adaptés (`recettes/list.html`, `_default/recettes.html`, etc.) devraient fonctionner correctement
2. Les index globaux (`ingredients-index.html`, `recettes-index.html`) pourront résoudre les ingrédients et recettes par slug+UUID
3. Les événements pourront correctement référencer les recettes avec leurs nouveaux slugs
4. La configuration Sveltia CMS pourra générer correctement les nouveaux slugs
5. Les liens internes seront stables même si les titres changent

## 📞 Support

En cas de problème, vérifiez d'abord les rapports générés pour identifier l'erreur spécifique, puis consultez les logs détaillés dans la console.
