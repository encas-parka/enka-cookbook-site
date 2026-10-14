# Lot 2 — Finitions parité : badge origine merge (M) + CSV (H)

## M résiduel — badge « origine d'un merge »

**Contexte.** La fusion de produits est livrée (run 13-10). Le champ `sourceProductName` est typé
([types/store.types.ts](svelte-app/src/lib/types/store.types.ts) `:360`) et rempli
([utils/productEnrichment.ts](svelte-app/src/lib/utils/productEnrichment.ts) `:225`), mais **jamais rendu**.

**À porter :** rendu sœur `components/eventProducts/RecipesManager.svelte:126-130` (badge origine).
Fichier mig : [svelte-app/src/lib/components/eventProducts/RecipesManager.svelte](svelte-app/src/lib/components/eventProducts/RecipesManager.svelte)
(template `:55-143`, aucune référence actuelle à `sourceProductName` — vérifié).

## H — Export CSV : colonne « Besoin calculé » + en-têtes sœur

**Contexte.** La colonne « Fusionné » (`mergedProductNames`) est déjà portée.
Manque (commit sœur `98c41735`) : la colonne **« Besoin calculé »** (`displayTotalOverride` — champ déjà typé
[store.types.ts](svelte-app/src/lib/types/store.types.ts) `:187` et rempli [productEnrichment.ts](svelte-app/src/lib/utils/productEnrichment.ts) `:167`)
+ alignement des en-têtes sur la sœur.

**À porter :** sœur `utils/product-csv-export.ts:36` (en-tête) et usage `displayTotalOverride`.
Fichier mig : [svelte-app/src/lib/utils/product-csv-export.ts](svelte-app/src/lib/utils/product-csv-export.ts).
Étendre [product-csv-export.test.ts](svelte-app/src/lib/utils/__tests__/product-csv-export.test.ts).
Vérifier aussi l'appelant (mapping `displayTotalOverride` → colonne) dans la page/livreur d'export.

## Périmètre (ne toucher que ces fichiers + leurs tests)

`components/eventProducts/RecipesManager.svelte`, `utils/product-csv-export.ts`, appelant de l'export si mapping manquant,
tests associés. **Ne pas commiter.**
