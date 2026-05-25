# Ingredient Deduplication Workflow

Outils pour détecter et résoudre les ingrédients dupliqués dans le catalogue (`static/data/ingredients.json`).

## Workflow complet

```
1. fetch-recipes.ts        →  Rafraîchir le dump Appwrite
2. skill ingredient-dedup  →  Agent détecte les doublons, génère un MergePlan
3. apply-merge.ts          →  Appliquer le MergePlan (Hugo + Appwrite + catalogue)
4. verify-catalog.ts       →  Vérifier l'intégrité post-correction
```

## Scripts

### `fetch-recipes.ts` — Delta fetch Appwrite

Rafraîchit le dump JSONL des recettes Appwrite via le CLI.

```bash
bun run scripts_dev/dedup-ingredients/fetch-recipes.ts [dump-path]
```

- **Sans dump existant** : fetch complet paginé (100 par page)
- **Avec dump existant** : delta fetch basé sur la date de modification du fichier (`mtime`)
- Dump par défaut : `.agents/CR/all-recipes-full.jsonl`

### `apply-merge.ts` — Application du MergePlan

Applique un plan de fusion sur les 3 sources de données.

```bash
# Vérifier les changements sans les appliquer
bun run scripts_dev/dedup-ingredients/apply-merge.ts --plan merge-plan.json --dry-run

# Appliquer réellement
bun run scripts_dev/dedup-ingredients/apply-merge.ts --plan merge-plan.json --apply
```

**Opérations par fusion (loser → winner)** :
1. **Recettes Hugo** (`content/recipe/*/index.md`) : remplace `uuid` ET `name`
2. **Recettes Appwrite** (dump JSONL + API) : remplace `uuid` ET `name` dans les strings JSON
3. **Catalogue** (`static/data/ingredients.json`) : supprime le loser, met à jour le winner

**Sécurité** :
- Mode `--dry-run` par défaut
- Backup automatique des fichiers modifiés (`<file>.backup.<timestamp>`)

### `verify-catalog.ts` — Vérification

Vérifie l'intégrité du catalogue et des recettes.

```bash
bun run scripts_dev/dedup-ingredients/verify-catalog.ts
```

**Contrôles** :
- **Orphan check** : aucun UUID référencé dans les recettes n'est absent du catalogue
- **Consistency check** : le `name` de chaque ingrédient dans les recettes correspond au nom canonique du catalogue
- **Count check** : rapport du nombre total d'ingrédients

**Exit codes** : 0 = OK, 1 = problèmes détectés.

## MergePlan format

Le MergePlan est un JSON structuré généré par la skill `ingredient-dedup` :

```json
{
  "merges": [
    {
      "winner": {
        "uuid": "eouu0v",
        "name": "Carotte",
        "type": "legumes",
        "pF": true
      },
      "losers": [
        {
          "uuid": "8a5efa",
          "name": "carottes",
          "type": "legumes",
          "a": []
        }
      ],
      "reason": "Singulier/pluriel"
    }
  ],
  "meta": {
    "createdBy": "agent",
    "date": "2026-05-24",
    "totalMerges": 15
  }
}
```

## Skill `ingredient-dedup`

Skill pour agent LLM qui analyse le catalogue et propose des fusions. Voir `.opencode/skills/ingredient-dedup/SKILL.md`.

**Usage** : L'agent charge la skill, analyse `ingredients.json`, identifie les doublons par analyse sémantique, et génère un MergePlan validé par l'utilisateur.

## Librairies partagées (`lib/`)

| Fichier | Rôle |
|---------|------|
| `types.ts` | Types : `CatalogIngredient`, `RecipeIngredient`, `RecipeDocument`, `MergePlan`, `MergeEntry` |
| `appwrite-fetch.ts` | Delta fetch : `loadExistingDump()`, `writeDump()`, `fetchRecipes()`, `getDumpMtime()` |
| `hugo-parser.ts` | Hugo frontmatter : `findRecipeFiles()`, `processHugoContent()`, `extractHugoIngredients()` |

## Appwrite config

- Database ID : `689d15b10003a5a13636`
- Collection : `recettes`
- Project ID : `696b7acb0037bde79e3f`
- CLI configuré dans `appwrite/`
