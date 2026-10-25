> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: bug · Urgence: soon · Source: tests composants recipeEdit (lot 5, commit 559ca954 → 047b089d) · Ancre: `svelte-app/src/lib/stores/RecipeDataStore.svelte.ts:518` (`addMateriel`), modale `CreateMaterielModal.svelte:119` ouverte depuis `RecipeHeaderForm.svelte:458`

# Ajout de matériel au catalogue : la persistance échoue toujours (DataCloneError)

**Constat** — `RecipeDataStore.addMateriel` (l.518-537) réassigne `#customMateriel`
(`$state<string[]>`, l.102) puis écrit `data: this.#customMateriel` dans
`db.catalog.put` (l.528-531). Relire une variable `$state` rend le Proxy de
réactivité : la sérialisation structurée d'IndexedDB refuse les Proxy et lève
`DataCloneError`. Le `catch` rejette l'erreur ; la modale affiche un toast
d'échec, reste ouverte, et **rien n'est persisté** (mesuré : `db.catalog`
sans ligne `custom-materiel`). Le chemin est atteignable depuis l'en-tête
d'édition de recette (« Ajouter du matériel ») et depuis la modale de création,
dont les tests pinent ce comportement actuel (`CreateMaterielModal.test.ts`,
bug épinglé). `addRegime` (l.549+) porte exactement la même forme, sans
appelant aujourd'hui.

**Impact** — toute création de matériel est perdue côté utilisateur (le
catalogue n'apprend jamais rien) : la fonctionnalité est morte tant que le
store n'est pas corrigé. `addRegime` est un piège en attente.

**Reco** — cloner avant écriture : `$state.snapshot(this.#customMateriel)` (ou
un spread) dans `addMateriel` **et** `addRegime`. Puis repasser le test épinglé
au contrat nominal (submit valide → succès toasté, ligne `custom-materiel`
persistée, modale fermée, parent notifié) — patron `GroupPurchaseModal` du lot
4a pour la forme du correctif et du test.
