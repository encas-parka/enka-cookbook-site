> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: bug · Urgence: soon · Source: note manuelle utilisateur, checklist click-through (24-10, commit 87147099) · Ancre: `svelte-app/src/lib/components/recipes/RecipeAlternatives.svelte:16` (« Recette inconnue »), rendu depuis RecipeDetailPage (route `/recipe/:uuid`)

# « Recette inconnue » affiché sur certaines fiches recette

**Constat** — la page recette affiche « recette inconnue » pour certaines
recettes ; repro utilisateur 24-10 : `recipe/banoffee_uw7nq3h3hzob`. Contexte
qualifié le 24-10 (grep, mesuré) : le composant `RecipeAlternatives` — longtemps
non câblé (P1 checklist, état du 20-10) — est désormais importé par
`RecipeDetailPage.svelte` (l.9) et monté (l.347-354) ; son fallback
`recipesIndex.get(uuid)?.n || "Recette inconnue"` (l.16) s'affiche dès qu'un
uuid d'alternative manque à l'index au rendu (cache froid, recette supprimée ou
ref cassée — cause racine à qualifier). La note originale (« Début de
correction, mais maintenant : affiche recette inconnue… ») décrit ce
symptôme apparu après le câblage.

**Impact** — fiche publique en échec de rendu partiel pour au moins une recette
réelle du catalogue ; l'étendue (« certaines ») n'est pas chiffrée.

**Reco** — reproduire en runtime avec l'uuid donné, qualifier pourquoi l'uuid
manque à l'index au rendu, corriger la cause (et non le libellé) ; vérifier le
chemin exact du texte affiché avant toute modification.
