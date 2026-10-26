> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: bug · Urgence: soon · Source: tests composants eventProducts (lot 4a, découvert en testant, comportement épinglé) · Ancre: `svelte-app/src/lib/components/eventProducts/GroupPurchaseModal.svelte:102` (filtre des manques) ; `svelte-app/src/lib/utils/productsUtils.ts:155` (`calculateAndFormatMissing`)

# Achat groupé : « Valider » ne crée aucun achat (filtre des manques mort)

**Constat** — `GroupPurchaseModal` filtre ses manques avec
`missingQuantities.filter((qty) => qty.q < 0)` (l.102-104), alors que
`productModel.stats.missingQuantities` ne contient que des valeurs
**positives** : `calculateAndFormatMissing` ne pousse que `missing > 0` et
`missingStockQuantities` est documenté « positif seulement ». Le filtre
n'attrape donc jamais rien.

**Impact** — mesuré (test « BUG épinglé » de `GroupPurchaseModal.test`) :
valider un achat groupé ferme la modale, toast le succès, crée la dépense
éventuelle… et **zéro achat**. L'utilisateur croit avoir réapprovisionné.

**Reco** — corriger le prédicat (`qty.q > 0`, ou retirer le filtre si la
liste est déjà positive par construction), puis retourner le test épinglé au
contrat nominal (patron du lot 4a : validation → achats créés pour les
produits cochés). Vérifier au passage l'affichage du lot résumé, qui compte
sur la même liste filtrée.
