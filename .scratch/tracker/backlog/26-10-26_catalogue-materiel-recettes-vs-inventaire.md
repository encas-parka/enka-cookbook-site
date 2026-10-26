> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: debt · Urgence: conditional · Source: commentaire dev (26-10-26) au fix `addMateriel` DataCloneError · Ancre: `svelte-app/src/lib/components/recipeEdit/CreateMaterielModal.svelte` (catalogue recettes) vs `svelte-app/src/lib/constants/materiel-catalog.ts` + `svelte-app/src/lib/components/eventMateriel/MaterielNameSuggest.svelte` (catalogue inventaire/event)

# Coupler le matériel des recettes au catalogue inventaire/event ; suggérer depuis les recettes de l'event sur event/id/materiel

**Constat** — deux « catalogues » de matériel cohabitent sans aucun lien :

- **Côté recettes** : `DEFAULT_MATERIEL` (`data/recipe-reference.ts`, strings
  nues, extrait legacy des equipment_tag PB) + ajouts utilisateur purement
  locaux (`db.catalog`, clé `custom-materiel` — jamais synchronisés :
  invisibles des autres pages et des autres appareils).
- **Côté inventaire** : `MATERIEL_CATALOG` (`constants/materiel-catalog.ts`,
  ~150 items typés `CatalogType`) + headers d'inventaire PB
  (`eventMaterielStore.headers`, collection `materiels`, cf. ADR 0003),
  déjà consommés par l'autosuggestion `MaterielNameSuggest` (pages
  event/id/materiel) et `TeamMaterielNameSuggest` (teams).

`CreateMaterielModal` n'écrit que le premier : un matériel créé depuis
l'édition de recette n'existe pas pour l'inventaire des teams ni pour
event/id/materiel — et les recouvrements entre les deux listes de constantes
sont partiels et casse-instables (« bol » vs « Bol », « Gastro 1/1 (5cm) » vs
« Gastro 1/4 (5cm) »…).

**Idée produit (dev)** —

1. Coupler la création de matériel depuis les recettes au catalogue utilisé
   par les inventaires teams et les pages event/id/materiel (une seule source
   de noms, l'ajout se propage partout).
2. Sur event/id/materiel, ajouter aux suggestions les matériels référencés par
   les recettes de l'event (l'autocomplete actuel ne propose que les headers
   existants + `MATERIEL_CATALOG`).

**Questions ouvertes avant spec** —

- Source de vérité : une collection PB partagée (via pb-sync, comme
  `ingredients`) vs fusion à la lecture des deux listes existantes ?
- Que deviennent les ajouts locaux `custom-materiel` déjà persistés
  (migration vers la source commune, ou abandon) ?
- `CatalogType` (8 valeurs) n'a pas d'équivalent côté recettes (strings
  nues) : que devient une création sans type — type par défaut, choix
  obligatoire ?
- « Matériels référencés par les recettes de l'event » : faut-il indexer
  `recipes.materiel` par event, et à quel coût offline-first ?

**Reco** — discussion de conception d'abord (/grill-with-docs ou ADR), pas de
spec tant que la source de vérité n'est pas arbitrée. Points d'ancrage :
`RecipeDataStore.addMateriel`, `materiel-catalog.ts`, `recipe-reference.ts`,
`MaterielNameSuggest.svelte`, `TeamMaterielNameSuggest.svelte`,
`EventMaterielPage.svelte`, `docs/pocketbase_collections.md` § modèle de
stock `materiel`.
