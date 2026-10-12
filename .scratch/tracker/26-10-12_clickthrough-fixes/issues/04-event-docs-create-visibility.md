# 04: Docs event — création 400 + visibilité des tag-docs pour les participants

**What to build:** le créateur d'un event peut créer un document lié à son event
sans 400, et les documents liés par tag créés par un participant sont visibles par
les autres participants sur les pages event — y compris après reload.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §7, item `[!]` bloc
documents liés par tag : 400 sur create teamdocs par le créateur de l'event lui-même
(`createEventDocument`) ; doc « products » créé par userA invisible par userB,
même après Ctrl-R (règle de lecture ou sync filtrée ?).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Le créateur de l'event crée un document event sans 400 (UI + probe HTTP).
- [ ] Un participant voit les tag-docs créés par les autres sur les 4 pages event,
      y compris après Ctrl-R.
- [ ] Cause racine documentée (règle create/list teamdocs event-scoped vs sync
      filtrée côté client).
- [ ] Test vitest ou probe de visibilité entre deux users, vert.
