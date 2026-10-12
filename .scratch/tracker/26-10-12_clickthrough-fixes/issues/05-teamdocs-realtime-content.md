# 05: Realtime teamdocs — propagation du contenu entre users

**What to build:** les modifications sauvegardées par un user sur un document sont
visibles par l'autre user sans quitter la page d'édition — fini le détour par le
dashboard pour rafraîchir, et le risque d'écrasement qui en découle.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §7, item `[~]`
création/édition teamdoc : « les modifications de userA ne sont pas visibles par
userB s'il est aussi sur `editdocument/<id>` (il doit repasser par le dashboard et
revenir). Risque d'écrasement des modifications de userA par userB ».

**Blocked by:** 04 (même zone d'écriture store teamdocs — écrivain unique ; les
règles/abonnements posés en 04 conditionnent la propagation).

**Status:** done

- [x] Les modifs sauvegardées de userA apparaissent chez userB sur la page
      d'édition sans changement de page. *(la livraison SSE cross-user est
      MESURÉE par sonde `scripts_dev/probe-t05-teamdocs-sse.ts` — guest abonné
      collection-wide `teamdocs/*` (la subscription exacte du store), save
      (PATCH) par le créateur → événement `update` délivré avec le nouveau
      contenu et les tags ; log `/tmp/orchestrate/probe-t05-sse-26-10-12.log`,
      cleanup auto 204×3, DB inchangée. Côté page : `EditDocumentPage` propage
      désormais `storeDoc` vers les inputs via l'util pur
      `resolveRemoteDocUpdate` (`utils/doc-remote-sync.ts`, 5 tests vitest
      rouge→vert) — re-click deux-navigateurs à la porte T12)*
- [x] Le realtime des locks reste fonctionnel (aucune régression §9). *(aucun
      code lock touché — le fix est un `$effect` de contenu additionnel ; suite
      canon 151/151 dont `pb-realtime-signals` 6/6, check 0 erreur / 6
      warnings ; logs `/tmp/orchestrate/check-t05.log`,
      `/tmp/orchestrate/vitest-t05-full.log`)*
- [x] Approche anti-écrasement minimale documentée (le lock existe déjà ; la
      propagation du contenu ne doit pas le contourner). *(décision AC3 :
      consommer la subscription collection-wide déjà en place — aucun nouvel
      abonnement par record, la plus simple satisfaisant les ACs ; propagation
      seulement si l'utilisateur local n'a rien modifié (local == snapshot),
      skip `dirty` sinon ; l'écho de sauvegarde est ignoré (`unchanged`) ; le
      snapshot suit la propagation pour que isDirty reste cohérent ; la
      propagation n'écrit JAMAIS côté serveur — le lock reste l'unique
      garde-fou de l'édition concurrente. Trade-off assumé : un userB avec des
      saisies non sauvegardées ne voit pas les saves de userA tant qu'il n'a
      pas sauvegardé (ou rechargé) — c'est l'anti-écrasement voulu, pas un
      contournement du lock)*
