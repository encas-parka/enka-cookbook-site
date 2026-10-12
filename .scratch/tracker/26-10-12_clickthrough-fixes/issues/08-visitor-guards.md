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

**Status:** ready-for-agent

- [ ] URL d'un event en visiteur → redirect avec feedback (toast ou équivalent),
      plus de page vide.
- [ ] `recipe/<id>/edit` en visiteur → redirect propre ; plus de loading infini ni
      de crash `effect_update_depth_exceeded`.
- [ ] Les autres routes auth-requises sont auditées et suivent le même pattern
      (redirect + feedback systématique).
- [ ] Aucun fetch de données protégées avant résolution du guard (le crash est
      traité à la racine, pas masqué).
- [ ] Test vitest de la logique de guards au seam store/router, vert.
