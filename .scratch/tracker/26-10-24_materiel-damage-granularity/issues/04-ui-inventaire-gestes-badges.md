# 04: UI inventaire — gestes dans le formulaire, badge et filtres dérivés

**What to build:** la page d'inventaire parle le nouveau modèle. Le
formulaire d'item perd son sélecteur de statut (la quantité reste éditable à
la main) et gagne les gestes remise en service / réforme, affichés seulement
quand des exemplaires sont en réparation. La carte d'inventaire affiche le
badge d'état dérivé et le stock réel, les filtres sont rebasés sur ces
états, et le vocabulaire « perdu » disparaît de la zone au profit de
« manquant ».

Références : spec (§ User Stories 7-15, § Implementation Decisions UI) · conventions UI : `docs/ui-conventions.md`.
Zone : `svelte-app/src/lib/components/teamMatos/MaterielForm.svelte`, `MaterielCard.svelte`, `MaterielFilters.svelte`, `MaterielModal.svelte` (si elle affiche l'état), route `MaterielPage.svelte`.

**Blocked by:** 02 (états dérivés), 03 (gestes exposés par le store).

**Status:** ready-for-agent

- [ ] Sélecteur de statut supprimé du formulaire ; quantité toujours éditable (correction de stock à la main)
- [ ] Gestes remise en service / réforme visibles seulement si `repairQuantity > 0`, bornés à `repairQuantity`, avec retour visuel de succès
- [ ] Badge d'état dérivé sur la carte : complet / partiel : N à réparer / en réparation / stock épuisé / emprunté / réservé — jamais « perdu »
- [ ] Filtres et page d'inventaire rebasés sur les états dérivés (plus de filtre sur le statut persisté)
- [ ] Aucune occurrence de « perdu » restante dans la zone inventaire (composants + page)
- [ ] Click-through de la zone inventaire à l'écran : création/édition d'item, geste de remise en service, geste de réforme (convention maison : flux touchés vérifiés dans l'UI réelle)
- [ ] `bun run check:app` vert ; `bun fmt` sur les fichiers modifiés

## Comments
