# T2 — Autodates `created`/`updated` sur ingredients + categories

**Sources** : schema-client §2 (lignes ingredients/categories) et §3 (mécanique delta-sync + fallback) · synthèse Lot 0.2 · bugs connus #1
**Prérequis** : T1 fusionné (les deltas se posent après le snapshot)

## Objectif

Ajouter les autodates `created`/`updated` aux collections `ingredients` et `categories` et **backfiller les rows existants** — sinon le delta `updated > {:since}` reste vide (audit §3 : le fallback ne joue que si table locale vide ; les 845 ingrédients dev ont `updated` NULL).

## Méthode suggérée

1. **Backup `pb_data`** → `/tmp/orchestrate/pb_data-backup-t2/` (le ticket écrit dans la DB dev).
2. Nouvelle migration (timestamp > snapshot T1) : autodate sur les 2 collections + backfill SQL brut (Dao) `SET created/updated` sur les rows NULL (valeur = `updated` existant si présent, sinon now ou timestamp fixe — documenter le choix).
3. Appliquer sur la DB dev, boot PB, sondes curl : `GET /api/collections/ingredients/records?perPage=2` → `created`/`updated` peuplés sur toutes les rows.
4. `cd svelte-app && bun run generate-types` (le typegen reflète la DB — colonnes autodate ajoutées).
5. Vérif client (serveur dev lancé) : au minimum, requête delta `updated > '2000-01-01'` sur les 2 collections renvoie bien les rows (curl avec filter). La vérif bout-en-bout RecipeDataStore passe au QA runtime (T20) — pas de harness db-sync avant T13.

## Critères

- [ ] Migration delta (autodates + backfill) appliquée à la DB dev (backup fait)
- [ ] Sonde curl : ingredients + categories avec autodates peuplées (verdict loggé dans run.md)
- [ ] `pb-generated.ts` régénéré (`bun run generate-types`, diff cohérent)
- [ ] `bun run check` au canon (0 erreur)
- [ ] run.md amendé (journal T2)
