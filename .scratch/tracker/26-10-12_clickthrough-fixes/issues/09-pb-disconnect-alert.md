# 09: Alerte perte serveur PB (StatusBar)

**What to build:** quand le serveur PocketBase devient injoignable, une alerte
visible apparaît (~3 s, débounce existant) — distincte du badge « hors-ligne »
internet. Au retour du serveur : « connected » + resync silencieux, sans flash.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §9, item `[!]`
resync : « pas d'alert/toast en cas de perte du serveur pb. Seul le "hors-ligne",
en cas de coupure internet, s'affiche, avec resync ok ». Le signal de déconnexion
débounce ~3 s existe déjà côté signaux SSE — c'est le raccord au statut visible
qui manque.

> Arbitration investigation 12-10 (`mesuré`) — l'évidence ci-dessus est inexacte :
> le raccord existe déjà (StatusBar affiche « Connexion perdue »/« Serveur
> indisponible » via le chemin resync de `main.ts`). Le gap réel :
> `initRealtimeSignals` n'est pas appelé au boot avec une session existante
> (uniquement via le modal de login) — signaux morts sur le chemin dominant. Le fix
> est un chantier d'init/lifecycle (d'où le blocker 07), pas de câblage.

**Blocked by:** 07 (même zone d'écriture probable — lifecycle/signaux temps réel —
écrivain unique).

**Status:** done (13-10, run clickthrough-fixes — commit `6905255e` + `386a7607`)

> **Arbitrage investigation appliqué (cf. run.md § contradiction #1)** : le
> raccord StatusBar existait (« Connexion perdue »/« Serveur indisponible » via
> `statusBarStore.serverStatus`) ; le gap réel était le lifecycle —
> `initRealtimeSignals` n'était appelé qu'au login modal (`refreshAuthAfterLogin`),
> jamais au boot avec une session existante (chemin dominant : reload avec
> session valide). Fix = branchement dans `initializeAuth` (après la purge
> d'identité T07, miroir du login — signaux AVANT les phases d'`initializeApp`).

- [x] Couper dev:pb → alerte visible distincte du badge hors-ligne internet.
      *(Niveau unitaire : test rouge `globalstate-identity-cache` « boot avec
      session existante » — signaux non branchés avant fix, branchés après ; le
      chemin signal → statut est épinglé par `pb-realtime-signals` — onDisconnect
      avec abonnés → « disconnected » après debounce 3 s. La distinction avec le
      badge hors-ligne est structurelle : `navigator.onLine` est un canal séparé
      de `StatusBar.svelte`, priorité offline > disconnected. La coupure réelle
      du serveur en navigateur = porte T12, convention du run.)*
- [x] Relancer dev:pb → « connected » + resync silencieux (T15 reste vert).
      *(Chemin existant rendu vivant au boot : PB_CONNECT reconnexion →
      `onRealtimeReconnect` → `scheduleResync` → `syncRevalidate` silencieux →
      `setServerStatus("connected")` ; reconnexion dans la fenêtre de debounce
      annule l'affichage — épinglé par `pb-realtime-signals`. Vérification
      navigateur → porte T12.)*
- [x] Cacher/rouvrir l'onglet → resync sans flash de loading (comportement actuel
      préservé). *(Aucune modification du resync orchestrator : `syncRevalidate`
      reste sans toggle `#loading` ; suites `pb-sync-delta-realtime`,
      `pb-realtime-signals` et canon 167/167 verts. Navigateur → porte T12.)*
