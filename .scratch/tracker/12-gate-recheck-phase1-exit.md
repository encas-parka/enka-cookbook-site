# 12: Gate — re-click-through ciblé + critère de sortie Phase 1

**What to build:** reprise ciblée de la checklist click-through sur les sections
touchées, verte ; le critère de sortie de Phase 1 (« click-through vert », pas
seulement pipeline 86/86) est gravé dans la documentation du projet.

**Evidence:** critère convenu en session du 12-10 : le verdict pipeline 86/86 ne
couvre que la fidélité d'import, jamais les write paths runtime — la porte de
sortie de Phase 1 est le click-through.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09 (10 et 11 inclus s'ils sont
livrés à ce point).

**Status:** gate-manual — passe navigateur de l'humain attendue ; partie docs
faite par l'orchestrateur (AC 3, voir plus bas)

## Passe navigateur ciblée (l'humain, deux navigateurs pour les flux multi-users)

Compilée depuis les notes gate des tickets + review spec — dans l'ordre :

1. **§1** — login sur session IndexedDB sale (reproduire un résidu : T07) → events
   chargés sans Ctrl-R.
2. **§2** — visiteur : URL d'event → redirect + toast (plus de page vide) ;
   `recipe/<id>/edit` → redirect propre, ni loading infini ni crash (T08).
3. **§3** — RSVP complet 2 navigateurs : invite → accept → event au dashboard de
   l'invité, immédiat et après reload (T06). Carte « invitations externes » pour
   l'invité en attente = comportement documenté, pas un bug.
4. **§3 bis (T10)** — retry réseau : PB dev arrêté → créer un event (erreur toast
   attendue) → relancer PB → re-soumettre le MÊME formulaire → **un seul event**
   (warning console « Création réconciliée » si la 1re tentative était passée).
5. **§4** — création produit via modal ; validation rapide d'achat sur produit
   inexistant (produit implicite) ; édition store/specs, y compris sur produit
   non synchronisé — plus de « Record not found in Dexie » (T01/T02).
  - creation d'un produit via modal: le produit est créer, mais la quantité indiqué est ajouté comme purchases plutot que besoins. Je ne crois pas que ce soit le comportement initial de l'app appwrite.
  - Les modifications produit batch echoue : `[StoreEditModal] Mise à jour groupée: échec, 1 produits modifiés StoreBatchEditModal.svelte:138:14
  [StoreEditModal] Erreur mise à jour: Error: Batch transaction failed.
      updateResult http://localhost:5173/src/lib/components/eventProducts/StoreBatchEditModal.svelte:142`
  - l'ajout d'achat rapide ok, ainsi que la modification des produits individuel (who, where), mais il y a une apparition / disparition d'une nouvelle card product lors de ces modification dans la page event/id/product si le product n'existait pas initialement.
  - pour les ajour d'achat depuis le modal PurchaseManager: si le product n'existait pas en base initialement, lors de l'ajout de l'achat, le modal devient vide: "chargement".
  → La façon dont a été géré l'implementation d'upsert a des side-effect problématique en terme d'ui....
6. **§6** — loan lié à un event : création/modification sans 400 ni faux conflit,
   event_materiel reflété sans refresh, échec éventuel confiné au modal (T03).
 - net progres, mais toujours un toast warn indiquant des indiposnibilité factice lors de la creation du loan...
7. **§7** — création doc event par le créateur ; tag-doc visible par le
   participant (Ctrl-R inclus) ; 2 navigateurs sur `editdocument/<id>` : les
   saves de userA apparaissent chez userB (si userB est dirty, ils arrivent après
   son save/reload — trade-off documenté au ticket 05) (T04/T05).
  - net progres: mais si userA et userB sont tous les deux sur le document, que userA rentre en mode edition, modifie, puis save, userB ne vois pas les modifications en realtime du document, peut rentré en mode edition avec sa version stale, et ecrasé les modification de userA.
8. **§9** — PB dev coupé ~3 s → alerte visible distincte du badge « Hors-ligne »
   internet (reload-avec-session d'abord, chemin dominant) ; relance → connected
   + resync silencieux ; cacher/rouvrir l'onglet → resync sans flash (T09).
- semble ok, mais plus de log lors du retour de visibilité, donc difficile de dire si le resync est effectué.
9. **§5** — visiteur sur `/recipe` : brouillons absents ; user logué : inchangé ;
   accès direct URL d'un draft : toujours ok (T11).

- [ ] Checklist §1 (auth & cache), §2 (visiteur), §3 (events), §4 (products),
      §6 (materiel/loans), §7 (teamdocs), §9 (locks/temps réel) : items concernés
      cochés verts, annotations `[!]`/`[~]` résolues ou requalifiées.
- [ ] Flux multi-users vérifiés à deux navigateurs (RSVP, teamdocs, tag-docs).
- [x] Critère de sortie « click-through vert » gravé dans `backlog.md` et
      `AGENTS.md` (section Restant Phase 1). *(orchestrateur 13-10 — voir
      backlog § Run 26-10-12 + AGENTS.md Restant Phase 1)*
- [ ] `run.md` du dossier rempli (traçabilité : tickets → preuves → verdict).
