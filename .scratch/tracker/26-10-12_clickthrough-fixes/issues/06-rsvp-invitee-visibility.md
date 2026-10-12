# 06: RSVP — l'event accepté apparaît pour l'invité

**What to build:** après acceptation d'une invitation RSVP, l'event apparaît
immédiatement sur le dashboard de l'invité — sans Ctrl-R ni reload forcé. Le modèle
de données « events visibles par moi » a une source unique de vérité.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §3, item `[!]` RSVP :
l'invité (`ghald`) apparaît dans `events.contributors` mais pas dans
`events.guestUsers` ; l'event n'apparaît jamais sur son dashboard, même après
Ctrl-R / Ctrl-Maj-R. (L'échec d'envoi email 0/1 sans SMTP est un non-bug attendu.)

**Blocked by:** None (can start immediately).

**Status:** done (12-10 — cause racine mesurée par sonde, fix client, sonde verte
deux-comptes ; cf. run report, amendes T06)

- [x] Inviter un participant connu → acceptation → l'event apparaît sur son
      dashboard immédiatement, y compris après reload (test à deux comptes).
      → Sonde `scripts_dev/probe-t06-rsvp-visibility.ts --fixed` : invitation
      PATCH 200, SSE `events/*` délivré à l'invité (viewRule évaluée sur l'état
      post-update), list 1/1, GET 200, accept PATCH 200, list post-accept 1/1.
      Logs : `/tmp/orchestrate/probe-t06-{before,after}-26-10-12.log`.
- [x] Cohérence contributors/guestUsers résolue : le champ filtré par le dashboard
      est celui qu'écrit l'invitation (source unique de vérité documentée).
      → Source de vérité : **`guestUsers` (relation) = visibilité serveur**
      (les 3 règles events list/view/update filtrent `guestUsers ~ auth`, jamais
      `contributors`, json non traversable) ; **`contributors` (json) = état RSVP
      pour l'UI**. `inviteParticipants` écrit les deux dans la même mise à jour
      atomique (`guestUsers` pour les emails résolus seulement — les ids nanoid
      des emails inconnus restent hors relation, le hook `join-event.pb.js` les y
      rattache au premier join). Deux sites d'écriture de la relation, tous deux
      couverts : `inviteParticipants` + hook join-event. Aucune migration : les
      règles étaient déjà à la cible, c'est l'écriture qui manquait.
- [x] Probe HTTP : après invitation, l'invité lit l'event (règle list vérifiée).
      → Mode `--fixed` : `list-to-invitee` DELIVERED (exact-filter 1/1) ;
      mode legacy (payload SPA d'avant fix) : ABSENT — cause racine confirmée
      (listRule filtre, 200 sans le record) et accept PATCH 404 (updateRule
      rejetait aussi l'invité — le RSVP lui-même était impossible).
- [x] Le toast d'échec d'envoi email (sans SMTP) reste non bloquant pour le flux.
      → Inchangé par le fix : l'envoi est fire-and-forget dans
      `inviteParticipants` (section 6, `.then/.catch` + warn console), le
      `toastService.track` de `PermissionsManager.validateInvitations` suit la
      promesse d'invitation (résolue avant l'envoi email). Test unitaire :
      le step share-link levant, l'invitation (guestUsers inclus) reste appliquée.
