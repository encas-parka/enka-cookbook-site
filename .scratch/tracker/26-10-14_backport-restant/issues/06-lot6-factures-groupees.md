# Lot 6 — K : factures groupées (`GroupedInvoicesBar` + `InvoiceDetailModal`)

## Contexte

La création d'achats groupés existe déjà ([GroupPurchaseModal](svelte-app/src/lib/components/eventProducts/GroupPurchaseModal.svelte)).
Manque (commits sœur `dac68ad6`, `6888845a`) : **l'après-création** — barre des factures groupées + modale de détail
(~26 Ko, `InvoiceDetailModal` 23 Ko : total, détail, gestion).

## Travail

1. Porter les 2 composants (adaptations : `id` pas `$id`, montants/dates PB, `store` json natif — cf. `?` backlog T04 :
   deux formes `store` coexistent, tolérées par `safeJsonParse`, préférer l'objet natif dans le neuf).
2. Brancher dans `routes/EventProductsPage.svelte` (imports + `<GroupedInvoicesBar onInvoiceClick=…>` +
   `<InvoiceDetailModal invoiceId=…>`, cf. sœur).
3. Lancer **après le lot 5** (même fichier page — séquentiel).

## Périmètre

2 fichiers neufs + branchement page + tests ciblés si harness adapté. **Ne pas commiter.**
