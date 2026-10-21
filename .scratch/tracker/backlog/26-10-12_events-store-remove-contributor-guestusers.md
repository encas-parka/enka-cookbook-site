> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: run 26-10-12 (T06) · Ancre: svelte-app/src/lib/stores/EventsStore.svelte.ts

- EventsStore.removeContributor retire contributors mais laisse guestUsers — l'utilisateur conserve l'acces serveur apres retrait UI (symetrique pour les declines, coherent UI). A arbitrer si une revocation d'acces se manifeste.
