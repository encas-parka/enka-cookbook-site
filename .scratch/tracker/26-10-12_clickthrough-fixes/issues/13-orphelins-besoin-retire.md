# 13: Orphelins cas 2 — « besoin retiré des recettes »

**What to build:** un achat effectué sur un produit dont les recettes ne déclarent plus le besoin reste visible et tracé dans la section orphelins, avec un libellé distinct du cas garde-fou. Détection dérivée à chaque passe du reconciler (pas de marquage, pas de schéma) : ré-ajouter la recette efface l'orphelin.

**Blocked by:** None (finding de gate, port T06 en place).

**Status:** done (11/11 `products-store-orphans`, zone produits 6 fichiers / 43 tests, check 0 erreur / 6 warnings ; autofixer 0/0 ; re-click navigateur = porte T12)

- [x] Cas 2 implémenté dans la dérivation des orphelins : modèle produit existant + `ingredientRef` non null + id absent des lignes need actives + au moins un achat non supprimé — l'override (`totalNeededOverride`) NE change pas le statut (décision maintainer) — discriminant `kind: "product-removed" | "need-removed"` sur `#orphanedPurchasesInfo` ; tests « flagge need-removed… » et « ne rescuent pas un produit portant un totalNeededOverride… »
- [x] Produits manuels (`ingredientRef` null) jamais éligibles au cas 2 ; cas 1 (achat sans modèle produit) inchangé — tests « n'orphanise jamais un produit manuel… » et kind `product-removed` épinglé sur le test cas 1 existant
- [x] La section affiche les deux cas avec un libellé chacun (ex. « produit supprimé » / « besoin retiré des recettes ») — `OrphanedPurchasesSection` lit `orphan.kind` ; autofixer 0 issue / 0 suggestion ; verdict visuel = porte T12
- [x] Tests à la coutume : apparition à la suppression du besoin, disparition au retour de la recette, override non-rescuant, manuel exclu, garde fusion inchangée — 6 nouveaux tests dont source mergée sans besoin (remappage 1b, cible seule en cas 2) et source à cible introuvable (reste visible, jamais orpheline — guard `raw.mergedInto` ajouté à la dérivation)
