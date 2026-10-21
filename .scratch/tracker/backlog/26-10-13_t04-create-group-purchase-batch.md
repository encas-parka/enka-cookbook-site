> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: run 26-10-13 (T04) · Ancre: svelte-app/src/lib/stores/PurchaseStore.svelte.ts

- (T04 26-10-13) createGroupPurchase : les achats du lot passent par le batch PB brut (miroir Dexie dependent du SSE) — passer a #purchasesCollection.createBatch() donnerait miroir optimiste + rollback.
