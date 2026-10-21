> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: run 26-10-12 (T07) · Ancre: svelte-app/src/lib/db-sync/pb-collection.ts

- initialFetch sans epoch/abort : une syncRevalidate de l'ancienne identite en vol au moment d'une transition peut reecrire lignes + curseur APRES la purge — fenetre etroite, se guerit a la transition suivante ; fix candidat : epoch de purge consulte par la transaction d'ecriture de pb-collection.
