> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: run 26-10-12 (T07) · Ancre: svelte-app/src/lib/stores/GlobalState.svelte.ts

- Logout sans desabonnement SSE des stores (purge purgeLocal au lieu de destroy) : EventSource ouvert en periode visiteur — livraisons filtrees par les regles (aucune fuite). A reconsidérer si besoin d'autoclose strict.
