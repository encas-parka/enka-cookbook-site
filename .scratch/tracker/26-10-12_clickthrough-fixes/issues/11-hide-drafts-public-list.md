# 11: Brouillons masqués de la liste publique de recettes

**What to build:** un visiteur non authentifié ne voit plus les recettes en brouillon
dans la liste publique. C'est un filtre UX côté liste : l'accès direct par URL reste
possible, aucune sécurisation serveur n'est demandée.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §5, item `[~]` :
« en tant que 'draft', les recettes ne devraient pas être affichées pour les user
non-auth (pas forcément besoin de sécuriser cela côté serveur, c'est surtout
d'un point de vue ux/ui : le site ne doit afficher les brouillons que pour les
auth, du moins dans la page de liste recipes. Si un user non-auth va directement
sur l'url, c'est ok.) »

> Arbitration investigation 12-10 (`mesuré`) : le marqueur porteur de la liste est
> le booléen `draft`, pas `status` (deux marqueurs coexistent ; défaut création
> constaté : `status: "private"`). Filtre à poser sur `draft` ; listRule recipes
> publique (`""`) confirmée.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Liste de recettes en visiteur : les brouillons n'apparaissent pas.
- [ ] Liste de recettes en user authentifié : comportement actuel préservé.
- [ ] Accès direct par URL d'un brouillon en visiteur : inchangé (toujours ok).
- [ ] Test vitest du filtre au seam store, vert.
