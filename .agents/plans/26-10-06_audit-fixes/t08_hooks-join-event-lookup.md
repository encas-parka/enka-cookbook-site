# T8 — Hooks : join-event complet (HOOK-1, HOOK-2, SEC-3) + route lookup-user (prérequis UI-1)

**Sources** : rules-hooks §2 (join-event angles morts), tableau (HOOK-1, HOOK-2, SEC-3, UI-1), §7 étape 4 · schema-client §3 (EventInvitationAlert/EventsStore contributors)
**Prérequis** : T3 (events.description existe), T4 (rules)

## Objectif

Le flux d'invitation/joignement devient fonctionnel et contraint : contributors réels (RSVP vivant), share links vérifiés (expiration/uses/type/statut), logs propres, et un endpoint de lookup email pour le client (remplace le getList bloqué par la listRule users).

## Constats → fixes

- **HOOK-1 (B1)** : `join-event.pb.js` L68-92 ajoute l'utilisateur à `guestUsers[]`/`guestEmails[]` mais pas à `contributors[]` → bandeau RSVP et `updateContributorStatus` inertes. → ajouter `{id: user.id, email, name, status: "accepted"}` à `contributors` (JSON events) ; **dédupliquer par email** : si un contributor avec le même email existe (id nanoid posé par `inviteParticipants`), mettre à jour son `id` vers le vrai userId au lieu d'appendre.
- **HOOK-2 (B2)** : L49-53 ne teste que `isActive` → vérifier aussi `expiresAt` (si posé), `maxUses`/`useCount` (incrémenter useCount au join — race JSVM assumée, le noter), `link_type = "event"` (un lien team ne doit pas joindre un event), et le statut de l'event : joignable si `proposition`/`confirmed`, refusé si `archive`/`locked`/`canceled` (documenter).
- **SEC-3 (B3)** : `console.log` (L104) → `$app.logger()` ; vérifier `link_type` (couvert ci-dessus) ; read-modify-save sans verrou : assumer (note), ne pas construire une transaction JSVM exotique.
- **Nouvelle route `/api/enka/lookup-user`** : auth requise ; query `email` ; match EXACT (pas de search) ; renvoie `{id, name}` ou 404. (Énumération d'emails par un authentifié : acceptable pour une app collaborative — noter.) Client T9 consommera ; le hook n'est PAS utilisé par invite-to-team (il a son propre lookup).

## Client (partie minimum viable ici)

- `stores/EventsStore.svelte.ts` : `inviteParticipants` (L711 : `id: nanoid()`) — si le ticket le permet proprement, résoudre les emails existants via `/api/enka/lookup-user` → contributor avec vrai userId (fallback nanoid sinon) ; sinon laisser nanoid (le dédoublonnage serveur T8 couvre) — **décider et documenter**.
- Vérifier `EventInvitationAlert.svelte` + `getContributorStatus`/`updateContributorStatus` (L585-654) : cohérence avec les contributors réels (pas de modif si déjà cohérents).

## Méthode suggérée

1. Bootcheck sur copie (pattern T1-T6), puis dev.
2. Sondes curl : join via link valide (contributors mis à jour, useCount incrémenté) ; join via lien expiré/épuisé → refus ; lien team sur event → refus ; event annulé → refus ; dédoublonnage nanoid (créer un contributor nanoid même email puis joindre) ; lookup-user (200 pos / 404 neg / 401 sans auth).
3. `bun run check` + `check-legacy` (delta 0) + `bun run test` au canon (69/69).

## Critères

- [x] join-event : contributors + dédoublonnage + toutes les vérifs HOOK-2 (sondes curl loggées)
- [x] `$app.logger()` partout dans les hooks touchés
- [x] Route `/api/enka/lookup-user` : sondes pos/neg/auth
- [x] Client : décision inviteParticipants documentée et appliquée
- [x] Canon check/legacy-delta/test respecté ; run.md amendé (journal T8)
