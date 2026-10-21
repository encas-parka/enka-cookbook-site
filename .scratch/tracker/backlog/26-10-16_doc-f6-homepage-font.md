> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `doc` · Urgence: `light` · Source: review 16-10 hugo-removal · Ancre: svelte-app/src/routes/HomePage.svelte:167

- F6 (run 16-10 hugo-removal, mineur) : HomePage.svelte:167 charge fonts/cherry-bomb-one.css (utilise section 188/450) — fichier absent de svelte-app/public/fonts/ (seuls fredoka + sora existent) ; 404 preexistant. Restaurer l'asset webfont ou retirer la classe/ref.
