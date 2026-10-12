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

**Status:** ready-for-agent

- [ ] Les modifs sauvegardées de userA apparaissent chez userB sur la page d'édition
      sans changement de page.
- [ ] Le realtime des locks reste fonctionnel (aucune régression §9).
- [ ] Approche anti-écrasement minimale documentée (le lock existe déjà ; la
      propagation du contenu ne doit pas le contourner).
