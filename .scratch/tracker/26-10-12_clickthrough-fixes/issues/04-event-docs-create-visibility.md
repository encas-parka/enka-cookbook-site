# 04: Docs event — création 400 + visibilité des tag-docs pour les participants

**What to build:** le créateur d'un event peut créer un document lié à son event
sans 400, et les documents liés par tag créés par un participant sont visibles par
les autres participants sur les pages event — y compris après reload.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §7, item `[!]` bloc
documents liés par tag : 400 sur create teamdocs par le créateur de l'event lui-même
(`createEventDocument`) ; doc « products » créé par userA invisible par userB,
même après Ctrl-R (règle de lecture ou sync filtrée ?).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Le créateur de l'event crée un document event sans 400 (UI + probe HTTP).
      *(migration `1791900000` — sonde après : create par le créateur non couvert
      200 avec le payload SPA exact `{title, content, tags, eventId, status:"doc"}` ;
      l'UI consomme le même chemin `createEventDocument` — re-click-through à la
      porte d'intégration T12)*
- [x] Un participant voit les tag-docs créés par les autres sur les 4 pages event,
      y compris après Ctrl-R. *(sonde deux-comptes : le créateur voit le doc du
      guest — list 200 avec le record + GET direct 200 — et le guest voit le doc
      du créateur 200 ; le Ctrl-R = initialFetch livré par la même listRule, la
      sync teamdocs n'a aucun filtre client)*
- [x] Cause racine documentée (règle create/list teamdocs event-scoped vs sync
      filtrée côté client). *(une seule racine aux deux symptômes : les 5 règles
      teamdocs sans clause `eventId.createdBy` — le créateur ni team ni guest est
      rejeté en create (400 data vide) et filtré en list/view (200 sans le
      record, GET 404) ; le record existe côté serveur (lecture admin) et la
      sync est sans filtre → pas de filtre sync en cause ; run.md section T04)*
- [x] Test vitest ou probe de visibilité entre deux users, vert. *(probe
      `scripts_dev/probe-t04-teamdocs.ts` avant/après, logs
      `/tmp/orchestrate/probe-t04-{before,after}-26-10-12.log` — second compte
      transitoire, cleanup auto 204×4, DB inchangée ; surface client inchangée →
      pas de nouveau test vitest)*
