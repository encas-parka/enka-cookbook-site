> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: run 26-10-13 (T04) · Ancre: svelte-app/src/lib/stores/PurchaseStore.svelte.ts

- (T04 26-10-13) createGroupPurchase.totalProductsCreated compte la selection (productsData.length), pas les materialisations reelles — compteur approximatif herite.

## Mise à jour 21-10 (audit backlog)
Confirmé toujours présent : `ProductsStore.svelte.ts:2491 et :2501` → `totalProductsCreated: productsData.length`.
`b084680f` n'a corrigé que `totalPurchasesCreated`. Test `products-store-create.test.ts:349` ne couvre que le cas 1-produit.
