# T15 — Signaux SSE + statut serveur + orchestrateur de resync (port Étapes 4+6)

**Sources** : port-hardening Étapes 4 (a25f3fe8 P1 + 564cfffd + debounce 4c4f4692) et 6 (a25f3fe8 + c6a781df + 5f7546c7) ; pièges §5.2
**Prérequis** : t14 (`syncRevalidate` disponible pour l'orchestrateur)

## Objectif

Le client détecte les micro-coupures SSE sans clignoter, et resync ses stores aux bons moments (visibilitychange, pageshow/bfcache, online, login) avec debounce et garde anti-double-sync.

## Étape 4 — Signaux SSE + StatusBar

- Nouveau `svelte-app/src/lib/db-sync/pb-realtime.ts` : `initRealtimeSignals()` — `pb.realtime.subscribe('PB_CONNECT', …)` + flag `hasConnectedOnce` → callback `onReconnect` ; `pb.realtime.onDisconnect` → **debounce 3 s obligatoire** (il tire à chaque cycle de backoff 2 s) → `statusBarStore.setServerStatus('disconnected')`.
- `StatusBarStore.svelte.ts` : `serverStatus` + `setServerStatus` (copie 564cfffd).
- `components/ui/StatusBar.svelte` : priorité offline > serveur indispo > locks.
- `pb-sync.ts` : exports. **Vigilance** : la souscription `PB_CONNECT` ne doit pas maintenir l'EventSource ouvert après logout — coupler au cycle de vie auth (init au login / teardown au logout, pattern destroy() des stores).

## Étape 6 — Orchestrateur `main.ts`

- Port des constantes (30 s / 5 min / 10 min bfcache), `handleVisibilityChange`, `handlePageShow`, `handleOnline`, `scheduleResync` (debounce 500 ms + garde `isResyncing`), `performResync` en `Promise.allSettled` sur les 6 stores (via `syncRevalidate` de t14) → `statusBarStore.setServerStatus(...)`.
- `forceReconnect` existant → remplacer par un simple check `pb.realtime.isConnected` (le SDK gère la reconnexion SSE — ne pas reproduire la mécanique Appwrite).
- Double-sync login/resync : les gardes par store + `isResyncing` couvrent — vérifier le flux login initial.

## Validation

- Canons verts (check/test/check-legacy delta 0). Le harness t12 peut simuler reconnect si le mock PB expose les signaux — sinon assertion de code + note.
- Attention interaction SW : le bloc SW actuel (brut pré-juin) reste tel quel — Étape 9 (SW/PWA) hors périmètre, deferred backlog.

## Critères

- [x] `pb-realtime.ts` : PB_CONNECT/onDisconnect avec debounce 3 s + lifecycle auth (pas d'EventSource zombie post-logout)
- [x] StatusBar : priorités respectées ; StatusBarStore étendu
- [x] Orchestrateur main.ts : visibility/pageshow/online/debounce/garde + Promise.allSettled via syncRevalidate
- [x] forceReconnect réduit au check isConnected
- [x] Canons verts ; run.md amendé (journal T15)
