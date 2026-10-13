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

**Status:** done (12-10)

- [x] Scénario de repro (session sale → login) : events chargés sans Ctrl-R,
      vérifié en reproduisant volontairement un cache résiduel.
      `globalstate-identity-cache.test.ts` — rouge avant fix (delta muette sur
      le curseur résiduel, log `/tmp/orchestrate/vitest-t07-red-26-10-12.log`),
      vert après (`vitest-t07-green2-26-10-12.log`).
- [x] Purge IndexedDB renforcée à l'arrivée d'un visiteur non authentifié.
      `GlobalState.initializeAuth` → `#ensureCacheForIdentity` : boot visiteur
      comme boot authentifié re-scopent le cache (marqueur `enka-cache-owner`).
- [x] Cause racine documentée : **cache résiduel + curseurs, pas une race**.
      Le cache Dexie (tables privées + curseurs `syncMeta`) n'était scopé à
      aucune identité ; `onAuthChange` jamais consommé ; aucune purge au boot
      visiteur ; fallback full-fetch bloqué par `localCount > 0`. La piste
      « race lifecycle auth/stores » n'est pas le mécanisme : les phases
      login s'exécutent dans le bon ordre, c'est leur INPUT (curseur tiers)
      qui est faux. Fix : purge sérialisée au changement d'identité
      (`ensureCacheForIdentity`, consommateur `onAuthChange` + appels
      explicites boot/login/logout, marqueur persisté). Commits `132551e4`
      (repro rouge) + `fcd8ccf7` (fix).
- [x] Test vitest du lifecycle concerné si le seam s'y prête : 4 tests au
      seam store (vrai GlobalState + vrais stores + FakePocketBase +
      fake-indexeddb), `pb-auth`/`pb-realtime`/router mockés.
