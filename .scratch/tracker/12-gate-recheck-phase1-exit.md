# 12: Gate — critère de sortie Phase 1

**Définition :** le critère de sortie de Phase 1 est un **click-through vert** —
la checklist complète (`.scratch/tracker/clickthrough-checklist.md`, source
opérationnelle unique) cochée ou requalifiée case par case. Le verdict pipeline
86/86 ne couvre que la fidélité d'import, jamais les write paths runtime.

**Fermeture du gate :**

- [ ] Checklist verte : items cochés, ou requalifiés (bug corrigé re-testé,
      faux positif clos, limite driver / feature à arbitrer annotée).
- [ ] Flux multi-users joués à deux navigateurs (locks §11, invitations §10,
      teamdocs §8).
- [ ] `run.md` du dossier rempli (traçabilité : corrections → preuves).

**Status:** gate-manual — passe navigateur de l'humain en cours. Les notes de
passe vivent dans la checklist (annotations par item), pas ici.

---
*Historique de la passe datée du 13-10 (observations §5-§8) : dans l'historique
git de ce fichier et le run report `.scratch/tracker/26-10-20_clickthrough-fixes/run.md` —
purge du 20-10 : observations corrigées depuis, le reste requalifié.*
