# Run 26-10-14 — Backport prod → mig (parité complète)

> Décision utilisateur 14-10 : porter **toutes** les features/composants de la sœur (`enka-cookbook-site`, branche `enka-next`),
> y compris J, K et cosmétiques, en adaptant les dates au format PocketBase. Implémenter d'abord, investiguer au besoin.
> Source d'inventaire : `.scratch/handoff/26-10-13_invest_backport.md` (§5 tableau A→O).
> Pointeur : `.scratch/handoff/26-10-14_backport-prod-restant.md`.

## Lots

| Lot | Ticket | Contenu | État |
|---|---|---|---|
| 1 | [01](issues/01-lot1-override-legacy.md) | E (paire écriture+lecture override) + micro-fix `GroupPurchaseModal` L112 | ✅ implémenté, non commité (39 tests ciblés verts, check 0 erreur) |
| 2 | [02](issues/02-lot2-finitions-parite.md) | M (badge `sourceProductName`) + H (colonne CSV « Besoin calculé ») | ✅ implémenté, non commité (57 tests ciblés verts, check 0 erreur) |
| 3 | [03](issues/03-lot3-recherche-url.md) | C (`setSearchInRecipes`) + G (sync filtres ↔ URL) — mitigation anti-boucle + seuil 0.6 | ✅ implémenté, non commité (21 tests store/OU + 69 voisins verts, check 0 erreur ; test de non-boucle sur vrai chemin) |
| 4 | [04](issues/04-lot4-purchasemanager.md) | I (résiduel livraison `ordered`) + alignement cosmétique sœur, dates PB gardées | ✅ implémenté, non commité (check 0 erreur ; carte compacte DATA/CONTEXTE/ACTIONS, table desktop conservée) |
| 5 | [05](issues/05-lot5-recette-details.md) | J (`ProductRecipeDetails` + `RecipeDetailDrawer` + branchement) | ⏳ après lot 4 (page partagée avec 6) |
| 6 | [06](issues/06-lot6-factures-groupees.md) | K (`GroupedInvoicesBar` + `InvoiceDetailModal` + branchement) | ⏳ après lot 5 (même page) |

## Conventions (rappelées à chaque agent)

- Sœur en lecture seule : `/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig` est le WD ; sœur = `/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-site`.
- Sémantique : `$id`→`id`, json natifs, dates PB `YYYY-MM-DD HH:mm:ss.SSSZ` (**jamais** de `split("T")` — garder `toInputDate`).
- Avant de toucher au code : lire `docs/svelte-app.md`. Svelte 5 (`$props()`), lucide via `@lucide/svelte`.
- **Ne pas commiter** : laisser le travail dans le working tree, fichiers du périmètre uniquement. Les commits (un/lot, conventionnels) sont centralisés en fin de vague. Jamais de référence ticket dans le code.
- Tests : cibler le fichier de test concerné, **une seule fois**, log vers `${TMPDIR:-/tmp}/orchestrate/tests-<sujet>-<slug>.log`, timeout explicite. Pas de `bun run check` global pendant les vagues parallèles (faux positifs croisés) — check centralisé avant commit.
