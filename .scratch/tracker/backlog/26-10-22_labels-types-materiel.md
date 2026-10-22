> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

# Trois jeux de libellés de types de matériel coexistent

Tag: debt · Urgence: conditional · Source: run 26-10-22 dossier emprunt, itération 2 · Ancre: svelte-app/src/lib/components/teamMatos/MaterielFilters.svelte:51

Trois sources décrivent les mêmes types avec des intitulés divergents :

- `MaterielFilters.svelte` (filtres inventaire + matos événement) : `manual` →
  « Manuel », `cooking` → « Cuisine » ;
- `loanTypeLabel` (`utils/materiel-list.utils.ts`, flux emprunt) : `manual` →
  « Ustensiles », `cooking` → « Matériel de cuisine » ;
- `getMaterielTypeConfig` (`utils/materiel.utils.ts`) : `manual` → « Manuel »,
  `cooking` → « Cuisine » (labels + couleurs, utilisés par la fiche retour).

Impact : mêmes données, deux vocabulaires selon l'écran (l'inventaire dit
« Manuel », la réservation dit « Ustensiles ») — gêne de cohérence, pas de
bug. La consolidation exige une décision de vocabulaire (quel intitulé
canonique pour `manual` et `cooking` ?), d'où `conditional` : trancher puis
unifier sur `getMaterielTypeConfig` (ou un helper dédié) et migrer les trois
sites.

Reco : décider des deux intitulés, faire de `getMaterielTypeConfig` la source
unique (labels + couleurs), déléguer `loanTypeLabel` et `MaterielFilters`
dessus.
