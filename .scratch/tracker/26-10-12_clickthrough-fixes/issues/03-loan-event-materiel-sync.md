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

**Status:** done

- [x] Création d'un loan lié à un event : event_materiel créé sans 400, reflété
      sans refresh manuel. *(migration `1791800000` — sonde après : create header
      + allocation 200 ; test store `materiel-store-loan-sync` pin du chemin sans
      refresh)*
- [x] Modification d'un loan lié à un event : idem. *(règles update/delete
      également couvertes par la migration — PATCH 200 / DELETE 204 mesurés ; le
      piège 404→soft-delete locale est levé)*
- [x] Loan sans event : plus de warn de disponibilité faux. *(racine : prêts
      fantômes — créés malgré l'échec affiché — comptés par le calcul de
      conflits ; createLoan est désormais tout-ou-rien et les prêts marqués
      `deleted` localement sont exclus du calcul)*
- [x] Les conflits de disponibilité sont calculés sur des données fraîchement
      synchronisées. *(delta sync silencieux à l'ouverture du modal, avant tout
      calcul de conflits — `syncRevalidate`, garde anti-concurrence existante)*
- [x] Un échec reste scopé au modal : aucune pollution des pages `loan/<id>` /
      `materiel/<id>`, y compris d'une autre team. *(createLoan/updateLoan
      n'écrivent plus l'`#error` global — tous leurs appelants catchent et
      toastent déjà ; échec partiel d'update signalé par erreur typée
      `EventMaterielSyncError`)*
- [x] Probe HTTP sur PB dev : create event_materiel → 200 ; cause racine documentée.
      *(sondes `scripts_dev/probe-t03-loan-eventmateriel.ts` avant/après, logs
      `/tmp/orchestrate/probe-t03-{before,after}-26-10-12.log`)*
