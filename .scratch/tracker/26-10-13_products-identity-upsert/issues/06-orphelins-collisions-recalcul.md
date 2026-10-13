# 06: Achats orphelins, collisions d'ids, recalcul des besoins

**What to build:** aucun achat ni besoin ne disparaît silencieusement : les achats dont le produit n'a plus de besoin actif sont visibles dans une section dédiée ; deux besoins de même nom issu d'ingrédients différents ne s'écrasent plus ; modifier un ingrédient de recette recalcule les besoins.

**Blocked by:** 04 (identité stable).

**Status:** ready-for-agent

- [ ] Section des achats orphelins affichée avec leur montant d'information (plus d'achat invisible)
- [ ] Collision d'ids enrichis traitée (deux références distinctes au même nom ne se perdent plus en écriture)
- [ ] Recalcul des besoins au changement d'ingrédient de recette (au-delà du seul changement de repas), avec correctif des exemptions héritées bloquantes
- [ ] Normalisation d'unités manquante comblée partout où une quantité est saisie
