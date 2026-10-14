# Lot 4 — PurchaseManager : résiduel livraison (I) + alignement cosmétique sœur

## Contexte

- [ProductCard.svelte](svelte-app/src/lib/components/eventProducts/ProductCard.svelte) (`:444-452`) affiche **déjà** la livraison
  sur achats `ordered` ; [PurchaseManager.svelte](svelte-app/src/lib/components/eventProducts/PurchaseManager.svelte) (`:81-82`)
  convertit les dates via `toInputDate` (**correct**).
- Sœur (`12e45789` + refonte 3 groupes DATA/CONTEXTE/ACTIONS, badges store/who, livraison `text-warning` + icône calendrier
  `PurchaseManager.svelte:381-388`) : porter le **cosmétique et l'affichage livraison**, **jamais** le `split("T")`
  sœur (`:78-81`) — buggé sur dates PB `YYYY-MM-DD HH:mm:ss.SSSZ` (piège T7 run 26-10-06).

## Travail

1. Comparer visuellement/fonctionnellement le template mig (`:199+`) avec la sœur ; lister les écarts cosmétiques réels.
2. Porter : affichage livraison `ordered` (style sœur) + éléments de la refonte transposables sans régression.
3. Garder `toInputDate` partout ; ne pas introduire de `split("T")` sur des dates PB.

## Périmètre

`components/eventProducts/PurchaseManager.svelte` (+ tests si existants sur ce composant). **Ne pas commiter.**
