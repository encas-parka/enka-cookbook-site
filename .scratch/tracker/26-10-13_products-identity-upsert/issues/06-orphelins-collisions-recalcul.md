# 06: Achats orphelins, collisions d'ids, recalcul des besoins

**What to build:** aucun achat ni besoin ne disparaît silencieusement : les achats dont le produit n'a plus de besoin actif sont visibles dans une section dédiée ; deux besoins de même nom issu d'ingrédients différents ne s'écrasent plus ; modifier un ingrédient de recette recalcule les besoins.

**Blocked by:** 04 (identité stable).

**Status:** done (14-10, commits 82d55e7a / 738b9e0b / fa2679eb / de252008)

- [x] Section des achats orphelins affichée avec leur montant d'information (plus d'achat invisible) — `OrphanedPurchasesSection.svelte` porté, dérivation `#orphanedPurchasesInfo` en 4b du reconciler (après remappage merge), nom par cache + fallback `extractNameFromProductId` ; visuel + reset/ré-import = gate maintainer
- [x] Collision d'ids enrichis traitée (deux références distinctes au même nom ne se perdent plus en écriture) — dédup + `mergeEnrichedProducts` + warn dans `createEnrichedProductsFromEvent` ; faux positif du slug 20 car. épinglé par test comme écart parité assumé
- [x] Recalcul des besoins au changement d'ingrédient de recette (au-delà du seul changement de repas), avec correctif des exemptions héritées bloquantes — guard étendu aux timestamps de recettes (`getRecipeUpdatedAt` mig) + syncReady attendu avant le hash initial (recalcul parasite du premier effect supprimé)
- [!] Normalisation d'unités manquante comblée partout où une quantité est saisie — branche stock de `saveAllChanges` corrigée (dernier chemin non normalisé des chemins énumérés) ; **résidu assumé** : `OverrideManager.handleSetOverride` écrit via `autoConvertUnit` (pas `UnitConverter.normalize`) — chemin couplé au bug E (lecture override brut, `getNormalizedOverride` absent mig), non ticketé dans ce run → deferred finding, à traiter avec E
