# 04: Clôture — migration du champ de tracking, ADR, docs

**What to build:** Une fois tous les écrivains partis (tickets 02 et 03), le champ de tracking emails est supprimé du schéma par migration. L'ADR « le RSVP porte l'accès côté client, les règles serveur restent volontairement grossières » (incluant la règle des équipes entières comme grant vivant) est rédigé. La documentation reflète l'as-built : doc de collections, consigne d'ingénierie (svelte-autofixer indisponible → `check` + passe click-through).

**Blocked by:** 02 (fin des écritures client), 03 (fin des écritures hook).

**Status:** done

- [x] Migration de suppression du champ appliquée proprement sur le dev ; aucun lecteur ni écrivain résiduel (grep vide)
- [x] Doc de collections mise à jour (champ disparu, plus de « écrit mais jamais lu »)
- [x] ADR publié et référencé depuis la doc de domaine
- [x] Consigne d'ingénierie mise à jour : svelte-autofixer retiré, remplacé par `check` + passe click-through
