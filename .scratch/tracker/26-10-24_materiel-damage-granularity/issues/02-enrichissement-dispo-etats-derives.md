# 02: Enrichissement — disponibilité soustrayant la réparation, états dérivés d'affichage

**What to build:** la fonction pure d'enrichissement d'un matériel calcule la
disponibilité réelle (`quantity − enEmprunt − repairQuantity`, quantité
inconnue = 0) et expose un état d'affichage dérivé — complet, partiel : N à
réparer, en réparation, stock épuisé, combiné à l'activité existante
(emprunté, réservé). Le nouvel état coexiste avec l'ancien statut enrichi
jusqu'au ticket 06 : rien ne casse, les consommateurs basculent aux tickets
04/05. Première couverture de tests de cette fonction (aucune aujourd'hui).

Références : spec (§ Implementation Decisions, formule et états) · ADR 0003.
Zone : `svelte-app/src/lib/utils/materiel.utils.ts` (`enrichMateriel` + libellés), types d'affichage dans `materiel.types.ts`, tests dans `utils/__tests__/` (patron : `materiel-list.utils.test.ts`).

**Blocked by:** 01 — le champ `repairQuantity` doit exister dans les types régénérés.

**Status:** done

- [x] `availableQuantity = (quantity ?? 0) − totalLoanedQuantity − repairQuantity`, avec `isAvailable`/`isFullyLoaned` recalés sur cette formule
- [x] Nouveau champ d'état dérivé (nommage libre, p.ex. `displayState`) : complet / partiel : N à réparer / en réparation / stock épuisé, fusionné avec emprunté / réservé selon l'activité — l'ancien champ `status` enrichi reste calculé tel quel
- [x] Libellés FR des états dérivés fournis au même endroit que les libellés existants ; « manquant » dans tout nouveau libellé, jamais « perdu »
- [x] Tests purs verts : nominal, partiel (réparation non nulle, exemplaires sains disponibles), tout le stock en réparation, stock épuisé, `quantity` null, combinaisons avec emprunt actif/planifié
- [x] `bun run check:app` vert ; aucun composant modifié (ce ticket ne touche pas l'UI)

## Comments

- Reliquat ticket 01 corrigé ici : le record type applicatif `Materiel`
  (`pb.d.ts`, aligné à la main) ne portait pas `repairQuantity` malgré la regen
  verte — aligné dans le même lot (pitfall documenté dans `docs/svelte-app.md`
  § Typage).
