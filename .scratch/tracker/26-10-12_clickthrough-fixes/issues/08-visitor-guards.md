# 08: Visiteur — guards propres (redirect + feedback, crash éradiqué)

**What to build:** un visiteur qui ouvre une URL protégée est redirigé avec un
feedback clair — plus aucune page vide, plus de loading infini, plus de crash.
Toutes les routes auth-requises suivent le même pattern.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §2 : URL d'event en
visiteur → page vide (headerbar only), sans toast ni redirect ; `recipe/<id>/edit`
→ page vide puis toast tardif, loading infini, erreurs console multiples et crash
`Uncaught Svelte error: effect_update_depth_exceeded` ; materiel/loan redirigés
sans feedback. Consigne : vérifier les autres pages auth-requises.

**Blocked by:** None (can start immediately).

**Status:** done (13-10, run clickthrough-fixes — commit `9d63132d` + `bff12986`)

- [x] URL d'un event en visiteur → redirect avec feedback (toast ou équivalent),
      plus de page vide. *(eventGuard : `requireAuth` — toast + `throw navigate` —
      AVANT `loadCache` ; l'ancien comportement laissait le `throw` « Utilisateur
      non connecté » de loadCache tuer `beforeLoad` : sv-router quittait sans
      changer l'arbre → page vide. Test : `guards.test.ts` « eventGuard, visiteur ».)*
- [x] `recipe/<id>/edit` en visiteur → redirect propre ; plus de loading infini ni
      de crash `effect_update_depth_exceeded`. *(Cause racine mesurée : le guard
      était attaché à la fonction composant — forme que `matchRoute` sv-router ne
      lit jamais → route montée sans guard, checks auth en page (toast+navigate
      dans `$effect`) en boucle jusqu'au crash. Forme objet `{ hooks, "/" }` +
      suppression des 6 checks auth en page.)*
- [x] Les autres routes auth-requises sont auditées et suivent le même pattern
      (redirect + feedback systématique). *(Audit complet dans run.md § T08 :
      4 routes étaient saines, 5 portaient des hooks morts, eventGuard sans check auth —
      toutes couvertes désormais ; test « ensemble exact » épingle l'arbre.)*
- [x] Aucun fetch de données protégées avant résolution du guard (le crash est
      traité à la racine, pas masqué). *(`requireAuth` en tête des deux guards ;
      sv-router attend `beforeLoad` avant `resolveRouteComponents` → aucun mount
      ni fetch page avant résolution ; test épingle `loadCache` non appelé pour
      un visiteur.)*
- [x] Test vitest de la logique de guards au seam store/router, vert.
      *(`src/lib/router/__tests__/guards.test.ts` — 6 tests ; suite 165/165,
      check 0 erreur / 6 warnings.)*
