# 06: RSVP — l'event accepté apparaît pour l'invité

**What to build:** après acceptation d'une invitation RSVP, l'event apparaît
immédiatement sur le dashboard de l'invité — sans Ctrl-R ni reload forcé. Le modèle
de données « events visibles par moi » a une source unique de vérité.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §3, item `[!]` RSVP :
l'invité (`ghald`) apparaît dans `events.contributors` mais pas dans
`events.guestUsers` ; l'event n'apparaît jamais sur son dashboard, même après
Ctrl-R / Ctrl-Maj-R. (L'échec d'envoi email 0/1 sans SMTP est un non-bug attendu.)

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Inviter un participant connu → acceptation → l'event apparaît sur son
      dashboard immédiatement, y compris après reload (test à deux comptes).
- [ ] Cohérence contributors/guestUsers résolue : le champ filtré par le dashboard
      est celui qu'écrit l'invitation (source unique de vérité documentée).
- [ ] Probe HTTP : après invitation, l'invité lit l'event (règle list vérifiée).
- [ ] Le toast d'échec d'envoi email (sans SMTP) reste non bloquant pour le flux.
