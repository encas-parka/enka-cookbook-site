> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `doc` · Urgence: `light` · Source: run 26-10-19 update-deps · Ancre: svelte-app/tsconfig.app.json

- F8 (run 26-10-19 update-deps, mineur) : typecheck des **tests** exclu du check (tsconfig.app.json exclude, commit 8f5c9c98) — les 14 divergences types<->runtime restent a instruire avant reintegration (fixtures/mocks desalignes des types actuels). Pas d'impact vitest (esbuild, sans typecheck).
