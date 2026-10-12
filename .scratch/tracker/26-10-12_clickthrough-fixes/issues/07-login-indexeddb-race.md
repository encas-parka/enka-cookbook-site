# 07: Race login/IndexedDB — données chargées sans Ctrl-R

**What to build:** se connecter sur une session navigateur au cache IndexedDB
résiduel charge les events immédiatement. La purge du cache pour un visiteur non
authentifié est renforcée, et la course éventuelle entre transition auth et init des
stores est fermée.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §Problèmes constatés
#1 : « à la connexion user sur une session navigateur peut-être pas complètement
propre en IndexedDB : les events n'ont pas été chargés immédiatement, il a fallu un
Ctrl-R. Race condition ou lié à l'IndexedDB ? »

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Scénario de repro (session sale → login) : events chargés sans Ctrl-R,
      vérifié en reproduisant volontairement un cache résiduel.
- [ ] Purge IndexedDB renforcée à l'arrivée d'un visiteur non authentifié.
- [ ] Cause racine documentée (race lifecycle auth/stores vs Dexie, ou cache
      résiduel — investiguer les deux pistes posées par la checklist).
- [ ] Test vitest du lifecycle concerné si le seam s'y prête.
