> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: run 26-10-13 (T06) · Ancre: svelte-app/src/lib/stores/purchases reconciler

- (T06 26-10-13) Achat avec products: [] (ou null) : n'atterrit dans aucune map du reconciler, jamais visible en orphelin (parite soeur) — perte potentielle d'information si le cas existe en donnees ; non mesure.

## Mise à jour 21-10 (audit backlog)
Cas désormais mesuré en base live : `select status,count(*) from purchases where products is null or products='[]'` →
`delivered 229, ordered 5, none 2` = **236 achats visibles nulle part** (hors expense/deleted/__probe_invalid__).
Le « non mesuré » du ticket est levé : le cas existe massivement. À requalifier « incertain → confirmé ».
