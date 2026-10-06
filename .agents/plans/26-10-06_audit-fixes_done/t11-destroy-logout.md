# T11 — `eventMaterielStore.destroy()` au logout (fuite inter-utilisateurs)

**Sources** : port-hardening Étape 1 (`76948df7`) · synthèse Lot 3/Lot 4 item 1
**Prérequis** : aucun backend

## Objectif

Fermer la fuite : au logout, la table Dexie `eventMateriel` n'est jamais vidée → les données d'un event restent lisibles par l'utilisateur suivant sur la machine partagée.

## Constats → fixes

- `stores/GlobalState.svelte.ts` `logout()` : appelle les `destroy()` des autres stores privés mais pas `eventMaterielStore.destroy()` → ajouter l'appel (pattern : même ordre que les autres).
- Vérifier `EventMaterielStore.svelte.ts` : `destroy()` conforme au contrat (unsubscribe bridge, unsubscribeAll collection, `clearLocal()`, `#isInitialized = false` — cf. AGENTS.md mig §Store Cleanup). Si un maillon manque, le compléter (c'est le fix réel).

## Méthode suggérée

1. Grep `logout()` dans GlobalState : inventorier les destroy() existants, ajouter celui manquant.
2. `bun run check` + `check-legacy` (delta 0) + `bun run test` (69/69). Vérification runtime complète = QA T15 (pas de harness avant T12).

## Critères

- [x] `destroy()` appelé au logout (grep vert, pattern identique aux autres stores)
- [x] `EventMaterielStore.destroy()` conforme au contrat 4 étapes (ou complété)
- [x] Canon respecté ; run.md amendé (journal T11)
