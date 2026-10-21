> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: review 13-10 · Ancre: svelte-app/src/lib/stores/EventMaterielStore.svelte.ts

- EventMaterielStore.purgeLocal : ne desabonne pas le bridge filtre par event — risque d'ancien bridge vivant apres re-scope d'identite (initializeForEvent a lire pour trancher ; doute non verifie).
