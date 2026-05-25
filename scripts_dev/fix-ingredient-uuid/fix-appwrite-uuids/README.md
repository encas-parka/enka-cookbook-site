# Correction des UUIDs ingrédients dans Appwrite

## Contexte

Quand une recette est créée via l'interface utilisateur Appwrite (pas importée depuis Hugo), la Cloud Function `add_ingredient` génère des UUIDs au format Appwrite (21 caractères). Ces UUIDs ne correspondent pas au catalogue Hugo (`static/data/ingredients.json`) qui utilise des UUIDs courts (6 caractères).

Cela provoque des **collisions de `$id`** dans le système de produits : deux ingrédients de même nom mais d'UUID différent produisent le même `$id` slugifié, et l'écrasement en Dexie fait perdre des contributions.

## Scripts

| Script | Rôle | Modifie la DB ? |
|--------|------|-----------------|
| `audit.ts` | Scan toutes les recettes Appwrite et rapporte les UUIDs non-Hugo | ❌ Non |
| `generate-plan.ts` | Génère un plan de correction (dry run) + vérification d'intégrité | ❌ Non |
| `apply.ts` | Applique les corrections du plan sur Appwrite | ✅ Oui |

## Workflow complet

```bash
# 0. Prérequis: être login dans le CLI Appwrite
cd appwrite && appwrite login && cd ..

# 1. Audit: identifier les UUIDs divergents
bun run scripts_dev/fix-appwrite-uuids/audit.ts

# 2. Générer le plan de correction (dry run)
bun run scripts_dev/fix-appwrite-uuids/generate-plan.ts

# 3. Relire et valider le plan
cat /tmp/appwrite-uuid-audit/fix-plan.json

# 4. Appliquer les corrections (après validation manuelle)
bun run scripts_dev/fix-appwrite-uuids/apply.ts
```

## Fichiers générés (dans `/tmp/appwrite-uuid-audit/`)

| Fichier | Description |
|---------|-------------|
| `recipes-full.jsonl` | Dump complet de toutes les recettes Appwrite |
| `backup-before-fix.json` | Sauvegarde pré-modification (pour rollback) |
| `fix-plan.json` | Plan de correction (mapping UUID ancien → nouveau) |

## Rollback

Si une correction pose problème, les données originales sont dans `backup-before-fix.json`. Il suffit de lire le document concerné dans le backup et de faire un `update-document` avec les `ingredients` d'origine.

## Ce qui est modifié

Pour chaque ingrédient concerné, **uniquement le champ `uuid`** est remplacé. Tous les autres champs sont préservés :

- `name` ✅ inchangé
- `originalQuantity` / `originalUnit` ✅ inchangés
- `normalizedQuantity` / `normalizedUnit` ✅ inchangés
- `comment`, `allergens`, `type` ✅ inchangés

Le `$updatedAt` est **automatiquement bumpé** par Appwrite lors de l'update, ce qui déclenche le delta sync côté client.

## Déterminisme

Le mapping UUID Appwrite → UUID Hugo est fait par **nom d'ingrédient exact** (case-insensitive, trimmed). Une vérification d'intégrité est intégrée dans `generate-plan.ts` pour confirmer que seuls les UUIDs changent.

## Prérequis

- **Bun** runtime
- **Appwrite CLI** configuré (`appwrite login` dans le dossier `appwrite/`)
- **Appwrite config** : `appwrite/appwrite.config.json` présent
- Accès au projet Appwrite `696b7acb0037bde79e3f`

## Voir aussi

- `fix-ingredient-uuids.js` : équivalent pour les fichiers Markdown Hugo (`content/recipe/`)
- Compte-rendu d'investigation : `.agents/CR/2026-05-22_jus-de-citron-missing-product.md`
