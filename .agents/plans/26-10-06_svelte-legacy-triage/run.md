# Run — triage & fix des erreurs svelte héritées (`check-legacy`)

**Mode** : mini-run persistant (1 ticket), autorisé par l'utilisateur le 06-10 (extension du run audit-fixes, périmètre nouveau).
**Source** : breakdown des erreurs `/tmp/orchestrate/legacy-breakdown-06-10.log` (baseline 189) + demandes de l'utilisateur.

## Header — état du monde

- **Base** : `9bd8eb28` (clôture audit-fixes). **Branch** : `mig/pocketbase`. Arbre : propre (données non trackées `scripts_dev/pb-import/` hors scope).
- **Canons** : `bun run check` 0 err/6 warn (ne doit pas bouger) · `bun run test` **94/94** (doit rester vert) · `check-legacy` **189** (baseline à ABAISSER — c'est l'objet du run ; nouveau baseline loggé).
- **Concurrency LIVE** : un second agent travaille EN PARALLÈLE dans `scripts_dev/` + `pocketbase/` (re-import de données) — zones disjointes par construction. NE TOUCHE à rien hors `svelte-app/src/**` (+ tests). Si des edits étrangers apparaissent DANS ta zone → STOP & report. Pas de `bun run build` pendant ce run (l'orchestrateur build en portail final).

## Critères de fin

- [x] Triage exhaustif des 189 → table classée (crash-risque / dette-types / bruit) dans run.md
- [x] Classe crash-risque fixée (tests quand peu coûteux, non-vacuité prouvée sinon)
- [x] Nouveau baseline check-legacy loggé + canon vert
- [x] run.md amendé ; commits conventionnels en tiers

---

# AMENDMENT T01 (06-10) — implémentation terminée

## Résultat

| Canon | Avant | Après |
|---|---|---|
| `bun run check` | 0 err / 6 warn | **0 err / 6 warn** (inchangé) |
| `bun run test` | 94/94 | **104/104** (94 + 10 nouveaux) |
| `check-legacy` | 189 | **0** (exit code 0) |

Trajectoire loggée : 189 → 166 → 151 → 126 → 86 → 55 → 0 (`/tmp/orchestrate/tests-legacy-fresh-06-10.log`, `…-after-tier1…tier6d-06-10.log`).

## Table de triage (189 erreurs regroupées par fichier, 49 fichiers)

Classes : **CR** = crash-risque · **NS** = null-safety · **TT** = trou-de-type · **DT** = dette-types · **MORT** = code mort · **BRUIT** = non-actionable.

| Fichier | n | Classe | Verdict / fix |
|---|---|---|---|
| `utils/materiel.utils.ts` | 17 | TT (1 import `Materiel` non exporté) + NS (16 : dates/status/quantity de loans) | Import depuis `$lib/types/pb` ; gardes réelles (un prêt sans dates n'est ni actif ni planifié — corrige le bug latent `new Date(null)`=epoch) ; snapshots narrowés pour callbacks imbriqués |
| `utils/event-todo.utils.ts` | 14 | **CR** — enums PB importés comme valeurs depuis un `.d.ts` (sans runtime) ; `PRIORITY_ORDER` (module-level) explosait au chargement | Import des const générées `EventTodosPriorityOptions/StatusOptions` depuis `pb-generated`. **Non-vacuité prouvée** : test rouge (crash à l'import) → vert. +10 tests |
| `routes/RecipeDetailPage.svelte` | 13 | TT `{}` JSON (6) + NS (7 : plate/typeR/preparation/title) | Réglé par C6 (pb.d.ts) + `?? 1`/`?? ""`/`?? "autre"` aux seams |
| `stores/ProductsStore.svelte.ts` | 11 | TT (2 : `mainId` absent du type) + DT (5 : Omit create) + TT `{}` index store (4) | `mainId` optionnel (champ Appwrite hérité), signature create() (C4), `store`/`productName` typés string\|null + `?? ""` aux 2 call-sites |
| `stores/TeamdocsStore.svelte.ts` | 9 | **MORT** (7 : tags/getTeamTags/getEventDocumentsByTag/EnrichedTeamdoc.lockedBy) + DT (2 : Omit create) | Sous-système tags supprimé ; `EnrichedTeamdoc` → `Teamdocs` (locking via collection `locks`) ; C4 |
| `components/recipes/RecipeCard.svelte` | 8 | TT `{}` JSON | C6 |
| `components/IngredientsTest.svelte` | 8 | **MORT** — 0 référence dans le src ; champs `t/u/n/a` disparus du type `Ingredient` (démo legacy Appwrite) | Supprimé (trash) |
| `stores/EventsStore.svelte.ts` | 7 | TT (3 : meals/contributors/todos unknown ; 2 : cast `Record<string,unknown>` sur guestEmails) + DT (1 : Omit create) + NS (1 : userId null → createShareLink) | C6 (shapes Event* typés) ; cast remplacé par accès direct + `Array.isArray` ; garde `else if (userId)` avec warn |
| `routes/DocumentListPage.svelte` | 6 | MORT/TT (1 : filtre tags) + NS (5 : title null recherche/tri) | Filtre tags purgé (recherche seule) ; `(title ?? "")` aux chains |
| `components/recipeEdit/RecipeIngredientsEditor.svelte` | 6 | **CR** — `$derived(() => …)` au lieu de `$derived.by` (runtime « marche par accident » : la valeur dérivée EST la fonction) | `$derived.by` + déréférencement ; twin-fix `groupedIngredients` (même défaut, silencieux) |
| `components/eventEdit/EventRecipeCard.svelte` | 6 | TT/NS mixtes (typeR, plate, preparation, catégories) | C6 + NS |
| `stores/RecipesStore.svelte.ts` | 5 | TT (4 : teams/ingredients/astuces) + NS (1 : typeR null dans Set) | C6 ; `if (recipe.typeR)` filtre les null |
| `stores/MaterielStore.svelte.ts` | 5 | DT (2 : Omit) + NS (3 : quantity, dates export markdown) | C4 ; `?? 0` (stock inconnu = conservateur) ; `"?"` si date manquante à l'export |
| `stores/EventMaterielStore.svelte.ts` | 5 | DT (1 : Omit) + NS (4 : index par type null, tri header.type) | C4 ; `item.type ?? "autres"` ; `(?? "").localeCompare` |
| `routes/RecipesListPage.svelte` | 4 | TT `{}` | C6 |
| `routes/EventDocumentEditPage.svelte` | 4 | MORT (3 : tags payload/state) + NS (1 : title null navbar) | Nettoyage cluster teamdocs ; `storeDoc?.title \|\| "Document"` |
| `routes/EventDocumentCreatePage.svelte` | 4 | MORT (1 : tags) + DT (3 : `string\|number\|true` du selecteur tags supprimé) | Nettoyage cluster teamdocs (les 3 disparaissent avec le sélecteur) |
| `components/teamMatos/LoanCard.svelte` | 4 | NS (dates : new Date + format) | `?? 0` (comportement epoch conservé) ; helper `formatDateDayMonthShort` élargi (null → "") |
| `components/recipeEdit/RecipeHeaderForm.svelte` | 4 | **CR** — clés UPPERCASE (`RecettesTypeR.ENTREE`) sur const générée lowercase → `undefined` injecté dans le select | Clés lowercase (`entree/plat/dessert/autre`) — corrige un bug silencieux réel |
| `routes/RecipeEditPage.svelte` | 3 | TT (1 : permissionWrite ; 1 : unknown→string[]\|null) + NS (1 : createdBy/updated null) | C6 ; `?? undefined` |
| `routes/LoanReturnPage.svelte` | 3 | NS (format dates null) | Helper élargi |
| `routes/EventProductsPage.svelte` | 2+1w | TT (props boolean/string \| undefined, cascades du nettoyage C5) | Disparues avec le nettoyage ; 1 ligne = warning a11y (hors scope) |
| `routes/EventMaterielPage.svelte` | 2+1w | NS (1 : ownerId null dans `Set.has`) + cascade C5 | Garde `loan.ownerId !== null` ; warning a11y hors scope |
| `routes/EditDocumentPage.svelte` | 3 | MORT (tags/isPublic state, snapshot isDirty, payload, UI, preview badges) | Nettoyage cluster teamdocs |
| `components/recipeEdit/CreateIngredientModal.svelte` | 3 | **CR** — `$derived(() => …)` | `$derived.by` + déréférencement |
| `components/documents/DocCard.svelte` | 3 | MORT (badges tags + prop highlightedTags) | Supprimés ; prop `doc: Teamdocs` |
| `services/pb-locks.ts` | 2 | TT — `RecordModel` vs type littéral (« no properties in common ») | `isLockExpired(lock: Record<string, any>)` aligné sur `normalizeLock` voisin |
| `routes/LoansPage.svelte` | 2 | TT (param isOldCompleted trop étroit) + NS (date) | Param élargi `status: string \| null` |
| `models/RecipeEventModel.svelte.ts` | 2 | NS (plate null) | `|| 1` (cohérent avec le calcul existant) |
| `db-sync/pb-sync.ts` | 2 | DT — doublon `PbCollectionName` (pb-types + aw-types dans le barrel) | Ligne aw-types retirée (pb-types = source active, importée par pb-collection) |
| `components/teamMatos/CreateLoanModal.svelte` | 2 | NS (dates events/loan) | `?? 0` (epoch conservé, commenté) |
| `components/eventProducts/GlobalPurchasesModal.svelte` | 2 | TT `{}` store | C6 |
| `components/eventPoster/RecipeCard.svelte` | 2 | TT `{}` regime | C6 |
| `utils/productEnrichment.ts` | 1 | NS (plate null → division) | Garde `if (!recipeDetails.plate) continue` (facteur incalculable → recette ignorée) |
| `routes/RecipeEditPage.ts` | 1 | TT `{}` permissionWrite | C6 |
| `routes/RecipeCreatePage.svelte` | 1 | TT unknown→string[]\|null | C6 |
| `routes/EventTodosPage.svelte` | 1 | Cascade C5 (boolean \| undefined) | Disparue au nettoyage |
| `routes/EventRecipesPage.svelte` | 1 | Cascade C5 | Disparue au nettoyage |
| `routes/EventDocumentsPage.svelte` | 1 | NS (title null recherche) | `(title ?? "")` |
| `routes/EventCreatePage.svelte` | 1 | DT — 3e argument ignoré par `createEventWithTeams` (2 params) | Argument retiré ; **checkbox `sendEmailToExistingMembers` sans effet = dette produit** (voir différés) |
| `routes/CreateDocumentPage.svelte` | 1 | MORT (tags/isPublic/teamName payload + UI) | Nettoyage cluster teamdocs |
| `db-sync/pb-types.ts` | 1 | DT — `PbDoc` ré-exporté mais non importé localement | `import type { PbDoc }` ajouté |
| `db-sync/pb-collection.ts` | 1 | DT — `CollectionBatch` privée dans le type de retour public | Interfaces `CollectionBatch<T>`/`BatchResult<T>` génériques, module-scope, exportées |
| `components/ui/EmailVerificationAlert.svelte` | 1 | TT — `emailVerification` absent de `PBAuthUser` | Champ ajouté (+ `Boolean(record.emailVerification)` dans normalizeUser) |
| `components/teamMatos/QuickAddCatalogModal.svelte` | 1 | NS (quantity null) | `?? 0` |
| `components/teamMatos/MaterielModal.svelte` | 1 | NS (quantity null → initialValues) | `?? 0` |
| `components/eventProducts/PurchaseManager.svelte` | 1 | TT `{}` store | C6 |
| `components/eventEdit/EventMealCard.svelte` | 1 | NS (typeR null → EventMealRecipe requis) | `?? "autre"` |
| `components/dashboard/LatestRecipesCard.svelte` | 1 | NS (typeR null → getTypeDisplay) | Helper élargi `string \| null` (fallback "autre") — 3 call-sites d'un coup |

**Total : 189** (les 2 lignes `Warning a11y` tabindex d'EventProductsPage/EventMaterielPage ne sont pas des erreurs).

## Tiers committés (9)

| Commit | Contenu | check-legacy après |
|---|---|---|
| `b2e314f5` | fix(types): import PB todo enums as values from generated source (+ 10 tests, preuve rouge→vert) | 166 |
| `124bab09` | fix(svelte): use derived.by for function-body deriveds in ingredient pickers | 166 (−9 avec le précédent) |
| `08fa1e0a` | fix(db-sync): align create() signature with PB id generation and export batch types | 151 |
| `8d4541a9` | refactor(teamdocs): remove dead tags/isPublic subsystem and fix EnrichedTeamdoc (−558 lignes) | 126 |
| `ff862825` | fix(types): use lowercase PB recipe type keys and drop dead lockedBy badge | 86 (avec le suivant) |
| `8e954f77` | fix(materiel): guard nullable loan dates, status and quantity at type level | 86 |
| `637c3a21` | chore(legacy): drop unused IngredientsTest demo, widen PBAuthUser and lock guard types | 55 (avec le suivant) |
| `c91a829c` | fix(types): guard nullable recipe fields and doc titles at runtime seams | 55 |
| `b4c0ea2a` | fix(types): type PB JSON fields with client-side shapes, killing the unknown-narrowing cluster | **0** |

## Preuves / validation

- Tests : `/tmp/orchestrate/tests-event-todo-red-06-10.log` (ROUGE : `Cannot find module '$lib/types/events'` — l'import valeur d'un module sans runtime crashe au chargement) → `tests-event-todo-green-06-10.log` (10/10) → suites complètes 104/104 (`tests-full-tier1-06-10.log` puis re-vérifs par tier).
- check : 0 err / 6 warn à chaque tier (5 fichiers a11y, hors scope).
- check-legacy : logs numérotés par tier (voir trajectoire). Finaux : `tests-legacy-after-tier6d-06-10.log` = 0 erreur, exit 0.
- Concurrency : agent parallèle actif dans `scripts_dev/`+`pocketbase/` (commits `84698500`, `1092b1fd`, `0e100746` — zone disjointe) ; aucun edit étranger détecté dans ma zone ; stages fichier par fichier.

## Découvertes durables

1. **`pb.d.ts` = couche de vérité des champs JSON PB** : les champs JSON générés (typegen) sont `unknown`/génériques ; les shapes clients sont écrits dans `pb.d.ts` (parse fns `parseIngredients`/`parseAstuces` acceptent natif PB + legacy Appwrite `string[]`). Toute nouvelle collection/field JSON doit y être typé — sinon retour du cluster `{}`/`unknown`.
2. **Narrowing TS ne traverse pas les callbacks imbriqués** : après une garde sur `loan.startDate`, capturer une const local avant un `.forEach` imbriqué.
3. **`.d.ts` n'a pas de runtime** : importer une « valeur » depuis `$lib/types/events` (d.ts) crashe au chargement du module ; les valeurs d'options PB vivent dans `pb-generated.ts` (const `as const` + type homonyme).
4. `$derived(fn)` vs `$derived.by(fn)` : la première fait de la fonction la valeur dérivée (silencieusement faux au typage, « marche par accident » au runtime).
5. `createEventWithTeams` (PB) n'accepte que (data, teamIds) — les emails passent par le système d'invitation PB.
6. Produits : `mainId` est un héritage Appwrite ; côté PB la valeur utile vit sur `ParsedNeed.mainId` (Dexie). `EnrichedProduct.mainId` = "" pour un produit brut PB.

## Différés (hors zone / décision produit)

1. **Feature « documents liés par tag » morte** : le champ `tags` (et `isPublic`/`teamName`) a été dropé du schéma teamdocs (migration 1700000029). Le client a été nettoyé (EventDocumentsBloc + 4 pages, filtres, formulaires). Une réimplémentation exigera un changement de schéma PB (champ `category` ou table de liaison) → décision produit + schéma, hors zone de ce run.
2. **Checkbox « Envoyer un email aux membres » (EventCreatePage)** : visuellement présente mais sans effet (l'ancien 3e argument était déjà ignoré par la méthode PB). À connecter au système d'invitation PB ou à retirer.
3. **`event-todo.utils.ts` est un module mort** (aucun import dans le src) : fixé conformément au ticket (import des const générées), mais candidat à la suppression — décision utilisateur.
4. **`DocumentSortControls`** conserve des props tags optionnelles (bloc non rendu si vide) — réutilisable si la feature tags revient.
5. **`aw-types.PbCollectionName`** (liste héritée : main, kteams, user_notifications…) est désormais sans référence hors aw-types — candidat nettoyage.
6. **6 warnings a11y** (tabindex non-interactif ×2, `<h3>` vides ×2, autres) — inchangés, hors scope.
7. Re-import données (run parallèle) : les champs PB JSON sont désormais fortement typés côté client — tout écart de shape détecté au re-import remontera proprement au typecheck `check-legacy`.

## Notes de méthode

- TDD au seam event-todo (rouge → vert) ; ailleurs : assertion de code + check-legacy comme filet (le typecheck legacy EST la suite de tests de ce run).
- Un `edit_file` a corrompu un template (EventTodosPage) et un autre a introduit un artefact (RecipeDetailPage) — tous deux détectés et réparés dans la foulée (vérification systématique des régions éditées ensuite).
- Aucun `bun run build` (portail final = orchestrateur) ; zones parallèles intactes.
