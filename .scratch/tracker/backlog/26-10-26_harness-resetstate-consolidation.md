> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: debt · Urgence: conditional · Source: revue code du run tests composants (26-10-26, axe Standards, judgement call Duplicated Code) · Ancre: `svelte-app/src/lib/stores/__tests__/harness/seed-dexie.ts` (modèle de helper) ; `resetState()` défini dans 10 fichiers de test

# Consolider le reset de test en helper harness (resetState dupliqué ×10)

**Constat** — chaque fichier de test composant redéfinit son `resetState()`
avec la même base (`vi.restoreAllMocks()`, `toastStub.reset()`,
`clearDexie()`, parfois `currentFakePb().reset()`, destruction de store,
re-seed) et des variations locales. Compté : 10 définitions indépendantes
(grep `function resetState`, `svelte-app/src/lib/**/__tests__/`). Le risque
n'est pas théorique : le diff du run existe en partie parce que des tables
Dexie manquaient au `clearDexie` (lot 0, 8→14 tables) — une variation qui
oublie une étape produit une fuite inter-tests silencieuse (le lot 3 l'a déjà
subie via le cache Dexie des équipes).

**Reco** — un helper harness (`src/lib/stores/__tests__/harness/reset.ts` ou
extension de `seed-dexie.ts`) : `resetTestState({ fakePb?: boolean, stores?:
[] })` qui enchaîne restoreAllMocks / toastStub.reset / clearDexie (+ options)
et que les suites appellent en `beforeEach`. Migrer les 10 fichiers d'un seul
commit mécanique, suite complète une fois. À coupler avec le dédoublonnage
voisin : extraire `const CLEARED_TABLES` dans `seed-dexie.ts` (les 12 tables
y sont listées deux fois — transaction `rw` + bloc `.clear()`), et un
`#putCatalogList(key, list)` partagé pour les jumelles `addMateriel`/
`addRegime` de `RecipeDataStore`.
