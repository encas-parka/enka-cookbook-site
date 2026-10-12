# 03: Loan ↔ event_materiel — sync 400, faux conflits, pollution cross-page

**What to build:** créer ou modifier un prêt de materiel lié à un event fonctionne
de bout en bout : la ligne event_materiel est créée sans 400 et apparaît sans
refresh ; plus de faux conflits de disponibilité ; un échec éventuel reste confiné
au modal et ne dégrade pas l'affichage des autres pages.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §6, item `[!]` loan
(400 sur `event_materiel/records` via `syncFromLoan`, faux conflits, pages
`loan/<id>`/`materiel/<id>` vides jusqu'au refresh — alors que la réservation est
en réalité créée ; loan sans event : warn de disponibilité suspect a priori faux).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Création d'un loan lié à un event : event_materiel créé sans 400, reflété
      sans refresh manuel.
- [ ] Modification d'un loan lié à un event : idem.
- [ ] Loan sans event : plus de warn de disponibilité faux.
- [ ] Les conflits de disponibilité sont calculés sur des données fraîchement
      synchronisées.
- [ ] Un échec reste scopé au modal : aucune pollution des pages `loan/<id>` /
      `materiel/<id>`, y compris d'une autre team.
- [ ] Probe HTTP sur PB dev : create event_materiel → 200 ; cause racine documentée.
