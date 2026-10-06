# T7 — Client : lecture des dates PB (helper partagé, B7, B8, C8) + tests

**Sources** : schema-client §5 (types de dates, recommandation) et §1 (B7, B8, C8)
**Prérequis** : aucun (indépendant de T5/T6 — mais chain : passer après)

## Objectif

Éliminer la classe de bugs `split("T")` sur les dates renvoyées par PB (`YYYY-MM-DD HH:mm:ss.SSSZ` — **espace**, pas de `T`).

## Constats → fixes

- **B7** : `components/teamMatos/CreateLoanModal.svelte:262-263` (`loan.startDate.split("T")[0]` → chaîne entière, formulaire corrompu) et L427 (`event.dateEnd` comparé en string invalide).
- **B8** : `components/eventProducts/PurchaseManager.svelte:76-81` + `components/ui/StatusSelect.svelte:29` : `input[type=date]` pré-rempli avec le format PB (espace) → affichage vide, écrasement possible.
- **C8** : `components/eventProducts/ProductCard.svelte:440-445`, `ProductCardCompact.svelte:215-217` : `purchase.deliveryDate` affiché brut — formater (l10n simple, pas de lib).

## Contrainte forte

**Ne jamais normaliser `created`/`updated`** (frontière pb-sync interdite — le curseur delta et les index Dexie s'appuient sur le format brut ; la normalisation générale est différée à T14 avec le bump Dexie v10). Le fix est un helper de lecture côté composants.

## Méthode suggérée

1. Grep un util de dates existant (`svelte-app/src/lib/utils/`) — DRY : étendre l'existant ou créer `dateUtils.ts` avec un helper unique (ex. `toInputDate(value): string` — renvoie `YYYY-MM-DD` quel que soit le séparateur ; `formatDate` pour l'affichage C8).
2. Remplacer les 5-6 sites par le helper.
3. **Tests unitaires** : un fichier `src/lib/utils/__tests__/` suivant le pattern existant (56 tests aujourd'hui) — cas : format PB espace, format ISO `T`, `YYYY-MM-DD` pur, chaîne vide/null.
4. `bun run check` au canon ; `bun run test` (le canon test monte de N — nouveau canon à logguer).

## Critères

- [ ] Helper unique + 5 sites remplacés (grep vert sur `split("T")` hors JSON client écrit côté navigateur — cas OK du §5)
- [ ] Tests unitaires verts (nouveau canon loggué dans run.md)
- [ ] `created`/`updated` jamais touchés (aucune normalisation en db-sync)
- [ ] `bun run check` au canon ; run.md amendé (journal T7)
