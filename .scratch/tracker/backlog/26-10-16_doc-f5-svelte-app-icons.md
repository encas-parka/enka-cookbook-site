> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `doc` · Urgence: `light` · Source: review 16-10 backport · Ancre: docs/svelte-app.md

- F5 (review 16-10 backport, mineur) : docs/svelte-app.md section Conventions prescrit les icones via classes size-3..size-6, mais le code (soeur incluse) dimensionne par prop numerique (size={16}...) — derive preexistante, propagee aux composants neufs du backport. Trancher convention vs realite.
