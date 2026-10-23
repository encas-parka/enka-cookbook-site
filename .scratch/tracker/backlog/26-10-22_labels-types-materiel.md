> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

# Libellés de types de matériel : le vocabulaire du flux emprunt reste à trancher

Tag: debt · Urgence: conditional · Source: run 26-10-22 dossier emprunt, itérations 2 et 4 · Ancre: svelte-app/src/lib/utils/materiel-list.utils.ts (`loanTypeLabel`)

**Réglé le 23-10 (run cohérence UI)** : l'ordre des types (`MATERIEL_TYPE_ORDER`)
et les icônes (`getMaterielTypeConfig().icon`, qui corrigeait `tools` rendu en
Box hors inventaire) sont unifiés ; le regroupement passe par le composant
partagé `MaterielTypeGroup`. Ne reste donc que le vocabulaire des libellés.

Deux vocabulaires coexistent encore :

- `getMaterielTypeConfig` (`utils/materiel.utils.ts`) : `manual` → « Manuel »,
  `cooking` → « Cuisine » (inventaire, filtres, en-têtes d'inventaire) ;
- `loanTypeLabel` (`utils/materiel-list.utils.ts`, flux emprunt) :
  `manual` → « Ustensiles », `cooking` → « Matériel de cuisine » (facettes et
  en-têtes de la réservation et de la fiche figée, via l'override `label` de
  `MaterielTypeGroup`).

Impact : mêmes données, deux intitulés selon l'écran — gêne de cohérence, pas
de bug. La consolidation exige une décision de vocabulaire mainteneur (quel
intitulé canonique pour `manual` et `cooking` ?), d'où `conditional` : trancher
puis déléguer `loanTypeLabel` sur `getMaterielTypeConfig().label` et retirer
l'override `label` des consommateurs.
