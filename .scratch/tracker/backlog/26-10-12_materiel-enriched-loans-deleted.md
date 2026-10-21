> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: run 26-10-12 (T03) · Ancre: svelte-app/src/lib/stores/MaterielStore.svelte.ts

- MaterielStore.#enrichedLoans ne filtre pas le marqueur local deleted — getLoanById peut retourner un pret soft-delete localement.
