# Run — Granularité des dommages (tickets 03→06)

## Header — état du monde

- **Base du run (review `base…HEAD`)** : `263324c0` — inclut le ticket 02 (landé en
  direct avant l'invocation orchestrate : `8fe65365` `6a0694fc` `ac2c0583`
  `bbc8af6d`), jamais revu : la review de fin de run couvre le lot entier.
- **HEAD au démarrage** : `bbc8af6d` (arbre propre, aucun WIP étranger,
  `.scratch/wip/` vide — vérifié 24-10).
- **Contrats en force** : `~/.agents/docs/RUN-CONTRACT.md` (consignes debout) ·
  `~/.agents/docs/COORDINATION.md` (claims). Profil **délégué**.
- **Chaîne** : 03 → 04 → 05 → 06 (blocked-by linéaire, arbre unique ⇒ séquentiel).
- **Test canon au démarrage** (attesté ticket 02, logs `/tmp/opencode/`) :
  suite complète 52 fichiers / 372 tests verts
  (`tests-materiel-damage-lot1.log`) · `check:app` 198 fichiers, 0 erreur
  (`check-materiel-displaystate.log`).
- **Test canon après ticket 03** (attesté, `/tmp/orchestrate/tests-t03-full-suite.log`)
  : suite complète 53 fichiers / 382 tests verts · `check:app` 198 fichiers,
  0 erreur (`/tmp/orchestrate/check-t03-checkapp.log`).
- **Test canon après ticket 04** (attesté, `/tmp/orchestrate/tests-t04-full-suite.log`)
  : suite complète 53 fichiers / 382 tests verts · `check:app` 198 fichiers,
  0 erreur (`/tmp/orchestrate/check-t04-checkapp.log`).
- **Test canon après ticket 05** (attesté, `/tmp/orchestrate/tests-t05-full-suite.log`)
  : suite complète 53 fichiers / 382 tests verts · `check:app` 198 fichiers,
  0 erreur (`/tmp/orchestrate/check-t05-checkapp.log`).
- **Test canon après ticket 06** (attesté, `/tmp/opencode/tests-t06-full-suite.log`)
  : suite complète 53 fichiers / 380 tests verts (−2 : describe de coexistence
  statut/displayState supprimé avec le champ, couverture déjà portée par le
  bloc disponibilité) · `check:app` 198 fichiers, 0 erreur
  (`/tmp/orchestrate/check-t06-checkapp.log`, post-regen
  `check-t06-checkapp-post-regen.log`) · pipeline managed **VERT**
  `scripts_dev/runs/2026-10-24-050642.md` (12/12 steps exit 0, validate 86/86,
  0 non-verdicted, log `/tmp/orchestrate/pipeline-t06.log`).
- **Outils déjà trouvés** : `bun` partout ; check complet = `bun run check:app`
  (racine) ; tests = `cd svelte-app && bun run test` (vitest, setup
  `stores/__tests__/harness/setup.ts`, transport factice `stub-pb.ts`,
  fake-indexeddb) ; types = `cd svelte-app && bun run generate-types` →
  `src/lib/types/pb-generated.ts` ; pipeline migration local =
  `scripts_dev/migrate.ts` (verdicts, cf. ticket 01) ; formatter = `bun fmt`
  (jamais prettier) ; PB local port 8090 (`bun run dev:pb`), comptes dev dans
  AGENTS.md.
- **Sandbox** : pas de substitutions shell (`$var`, `$(…)`) ni redirections
  douteuses — littéraux + `tee` ; logs de tests : `/tmp/orchestrate/tests-*.log`
  ; commits `GIT_EDITOR=true git commit` ; pas de push.
- **Click-through (tickets 04, 05)** : aucun navigateur piloté dans les sessions
  agents ⇒ critères click-through marqués `[!]` « passe humaine requise » ;
  passe à mener par le mainteneur en clôture (skill `browser-clickthrough`,
  checklist `.scratch/tracker/clickthrough-checklist.md`).

## Faits localisés

Ancrage ADR/conventions du lot : [ADR 0003](../../../docs/adr/0003-materiel-stock-model.md)
(décision, alternatives rejetées) · glossaire `CONTEXT.md` § Matériel & emprunts
(**manquant** — avoid « perdu » ; **remise en service** ; **réforme** ;
**disponibilité sur période** = stock en état de servir − emprunts chevauchants)
· `docs/svelte-app.md` § Typage (pb.d.ts aligné à la main) · `docs/ui-conventions.md`
§ Formulaires (dirty `$derived`, save `!valid || busy || !dirty`).

### Ticket 03 — store (`svelte-app/src/lib/stores/MaterielStore.svelte.ts`)

**`completeLoanWithReturn`** (certitude mesuré, lecture directe) :

- Écritures actuelles : boucle sur `data.materiels` avec 3 branches écrivant le
  **statut persisté** sur `#materielCollection.update(item.materielId, …)` —
  `status: "lost"` si `lost + broken >= item.quantity`, `status: "torepair"` si
  `broken > 0`, sinon `status: "ok"`. **Un item intact reçoit donc une écriture
  (`status: "ok"`) aujourd'hui** — c'est bien « zéro écriture de statut » +
  « zéro écriture sur item intact » qu'il faut obtenir.
- Quantités source : `item.lostQuantity || 0` / `item.brokenQuantity || 0`
  lus du payload `MaterielLoanItem` (champs optionnels, type dans
  `svelte-app/src/lib/types/materiel.types.ts`). Rien à recalculer : le
  formulaire de retour les a déjà bornés.
- Clôture de l'emprunt : `this.updateLoan(loanId, { status: "completed",
  returnedAt: new Date().toISOString(), returnNotes, materiels })`. Passer par
  `updateLoan` déclenche aussi la projection `eventMaterielStore.syncFromLoan`
  (data.materiels présent ⇒ sync). `completedAt` n'est **pas** écrit ici (reste
  `null` du create) — seul `returnedAt` porte la date. Ce bloc est inchangé au
  ticket 03 ; seules les écritures de statut materiel disparaissent.
- Consommateur unique de `completeLoanWithReturn` :
  [LoanReturnForm.svelte](../../../svelte-app/src/lib/components/teamMatos/loan/LoanReturnForm.svelte)
  `confirmSubmit`. `completeLoan(loanId)` (sans déclaration, consommateur
  `LoansPage`) ne touche pas aux materiels — ne pas y ajouter de projection.

**Sélecteurs** (mesuré) :

- `getAvailableMaterielsByOwner(teamId)` : filtres actuels `teamId === teamId &&
  status !== "lost" && status !== "torepair" && isAvailable`. Post-ticket 02,
  `isAvailable` = `availableQuantity > 0` avec `repairQuantity` **déjà
  soustrait** (voir `enrichMateriel`) ⇒ il suffit de supprimer les deux filtres
  de statut.
- `getAvailableMaterielsForPeriod(teamId, start, end, excludeLoanId?)` : filtres
  `teamId` puis `status !== "lost" && status !== "torepair"` ;
  **`availableForPeriod = (quantity ?? 0) − loanedQuantity` ne soustrait PAS
  `repairQuantity` aujourd'hui** — c'est le trou que le ticket 03 comble (spec
  US 4). Formule cible : `(quantity ?? 0) − loanedPeriod − repairQuantity` —
  ne pas réutiliser `materiel.availableQuantity` tel quel : il soustrait
  `totalLoanedQuantity` (emprunts ACTIFS à now), pas les emprunts chevauchant
  la période demandée. Filtre final `availableForPeriod > 0` conserve.
- Consommateurs (grep `getAvailableMaterielsByOwner|getAvailableMaterielsForPeriod`
  sur `svelte-app/src`) : [LoanForm.svelte](../../../svelte-app/src/lib/components/teamMatos/loan/LoanForm.svelte)
  (les deux, selon dates saisies) + le test harness. Aucun autre consommateur
  applicatif. Le sélecteur d'emprunt ne lit QUE `availableForPeriod` /
  `availableQuantity` / `isAvailable` — aucune lecture de statut (mesuré).

**Gestes** : aucune méthode store analogue n'existe (mesuré) — pattern à calquer :
`updateMateriel` (toggle `#loading`, `#error` en catch, `finally` reset,
`#materielCollection.update(materielId, data)`). Garde `n ≤ repairQuantity` côté
client ; droits inchangés (règles update `materiel` existantes, ADR 0003 ;
côté UI `MaterielCard.canEdit` = ownerUser ou teamId, simplifié). Effet sur la
dispo : pure dérivation, rien d'autre à faire.

**Harness de test** (`svelte-app/src/lib/stores/__tests__/materiel-store-loan-sync.test.ts`) :

- Montage : `vi.mock("pocketbase")` → `FakePocketBase`
  (`harness/stub-pb.ts`), `vi.mock("$lib/stores/GlobalState.svelte")`, vrai
  Dexie sur fake-indexeddb ; `seedAndInitialize()` = `currentFakePb().seed(...)`
  + `materielStore.initialize()` + `waitForTick(5)`.
- Assertions : **sur l'état post-écriture au transport** —
  `await pb.collection("materiel").getOne(id)` / `getFullList()` (copies), ou
  `db.materiels.toArray()` (Dexie). Le stub n'a PAS de journal d'écritures ;
  pour « zéro écriture sur item intact » : soit `vi.spyOn(fakePb, "collection")`
  adapté du pattern existant `rejectEventMaterielWrites` (comptage des `update`
  sur "materiel"), soit `getOne` et comparaison du champ `updated` (opUpdate du
  stub bump `updated` — un record non écrit garde son timestamp).
- Fixtures (`harness/fixtures.ts`) : `makeMaterielRecord` (quantity 5, status
  "ok", teamId TEST_TEAM_ID), `makeLoanRecord` (3 items sur TEST_MATERIEL_ID,
  accepted, 19→20/12) — overrides `Partial<>` pour les scénarios. Dates de prêt
  du test en `LOAN_PERIOD` = 19→21/12.
- Scénarios du ticket → mapping : 2 cassés/12 avec 6 empruntés = materiel
  `{quantity: 12}` + loan item `{quantity: 6, brokenQuantity: 2}` ⇒ serveur :
  quantity 12, repairQuantity 2, puis `getAvailableMaterielsForPeriod` propose
  10 ; 2 manquants/12 = `{quantity: 12}` + `{quantity: 6, lostQuantity: 2}` (ou
  item de 2 sur stock 12) ⇒ quantity 10, repairQuantity 0 ; 3 manquants sur
  prêt de 3/50 = `{quantity: 50}` + `{quantity: 3, lostQuantity: 3}` ⇒ 47 ;
  item intact = second materiel dans le même prêt, aucune update émise pour lui
  ; et l'absence de `status` dans tout update materiel émis pendant le retour
  (spy ou inspection des payloads captés). Gestes : succès (`repairQuantity −=
  n`), garde (n > repairQuantity → throw, rien d'écrit), réforme
  (`repairQuantity −= n` ET `quantity −= n`), effet sur `isAvailable`.
- Seam 2 (enrichissement pur) est **déjà couvert** par
  `svelte-app/src/lib/utils/__tests__/materiel.utils.test.ts` (livré ticket 02 :
  dispo nominale/partielle/tout-en-réparation/épuisée/null, combinaison activité,
  `getMaterielDisplayStateLabel`) — le ticket 03 n'ajoute que du Seam 1.

### Ticket 04 — UI inventaire (`svelte-app/src/lib/components/teamMatos/`)

- [MaterielForm.svelte](../../../svelte-app/src/lib/components/teamMatos/MaterielForm.svelte)
  : sélecteur de statut sous `{#if showStatus}` (`RadioBadgeGroup` sur
  `statusOptions` = OK / **Perdu** / À réparer) ; état `status` initialisé
  `initialValues?.status || "ok"` ; type local `MaterielStatusLiteral` ;
  `handleSubmit` inclut `status` dans le payload. Suppression = retirer
  `statusOptions`, l'état, le bloc `{#if showStatus}`, `MaterielStatusLiteral`
  et le champ `status` de l'interface `onSubmit` (et côté appelant). La quantité
  reste éditable (`min="1"` + `isValid = … && quantity >= 1`) — **friction avec
  le rebut quantity 0** (voir Pièges). Les gestes se branchent dans ce formulaire
  (mode édition) : ils appellent les 2 nouvelles méthodes du store (ticket 03) ;
  la visibilité est `repairQuantity > 0` — **`MaterielInitialValues` ne porte
  pas `repairQuantity` aujourd'hui**, à étendre (MaterielModal a
  `currentMateriel.repairQuantity` sous la main via le spread de
  `enrichMateriel`).
- [MaterielModal.svelte](../../../svelte-app/src/lib/components/teamMatos/MaterielModal.svelte)
  : `formStatus` (loan/reserved → "ok") à supprimer ; `initialValues.status =
  formStatus` ; `handleSubmit` passe `status: data.status` à `updateMateriel` —
  à retirer. Elle n'affiche pas l'état par ailleurs (grep : aucune autre
  lecture de status/displayState — le badge vit sur la carte).
- [MaterielCard.svelte](../../../svelte-app/src/lib/components/teamMatos/MaterielCard.svelte)
  : badge = `StatusConfig` ($derived, `Record<MaterielStatus, …>` construit sur
  `getMaterielStatusLabel(materiel.status)`), rendu si `status !== "ok" &&
  status !== "loan"`. Rebaser sur `getMaterielDisplayStateLabel(materiel.displayState,
  materiel.repairQuantity ?? 0)` (déjà exporté par
  `svelte-app/src/lib/utils/materiel.utils.ts`, avec classes badge à choisir
  par état) — `EnrichedMateriel` porte déjà `displayState`, `availableQuantity`,
  `repairQuantity` (spread du doc). Le stock réel est déjà affiché
  (`availableQuantity/quantity` + badge « N/quantity en prêt(s) ») — rien à
  ajouter côté quantités.
- Filtres : [MaterielFilters.svelte](../../../svelte-app/src/lib/components/teamMatos/MaterielFilters.svelte)
  définit son type local `MaterielFiltersType { types, locations, statuses }` et
  `getStatusLabel` (ok/lost/**Perdu**/loan/reserved/torepair) ;
  [MaterielPage.svelte](../../../svelte-app/src/lib/routes/MaterielPage.svelte)
  fournit `availableStatuses = ["ok", "lost", "loan", "reserved", "torepair"]`
  et filtre `filters.statuses.includes(materiel.status)`. « Rebaser sur les états
  dérivés » = même mécanique, nouvelles valeurs : `availableStatuses` →
  `["complete","partial","repair","depleted","loan","reserved"]` (`MaterielDisplayState`),
  label via `getMaterielDisplayStateLabel`, filtrage client sur
  `materiel.displayState`. C'est du **filtrage client** (les données sont déjà
  enrichies dans `materielStore.materiels`) — aucun store à changer.
- Grep « perdu » zone inventaire (composants + page, pattern `[Pp]erd[u]` sur
  `components/teamMatos` + `routes/MaterielPage.svelte`) : MaterielForm
  `statusOptions` label "Perdu" ; MaterielFilters `getStatusLabel` "Perdu".
  MaterielPage/MaterielCard/MaterielModal : zéro occurrence. (Le "Perdu" de
  `getMaterielStatusLabel` dans materiel.utils.ts disparaît avec la fonction au
  ticket 06.)

### Ticket 05 — UI retour (`svelte-app/src/lib/components/teamMatos/loan/`)

- [LoanReturnForm.svelte](../../../svelte-app/src/lib/components/teamMatos/loan/LoanReturnForm.svelte)
  — occurrences « perdu » (mesuré, grep `[Pp]erd[u]`) : docblock d'en-tête
  (×6, commentaires) ; badge lecture seule « Perdu : {item.lostQuantity} » ;
  trio quantité 1 : bouton « Perdu » + `aria-label="Perdu"` ; label d'input
  « Perdus » (quantité > 1) ; `aria-label="Quantité perdue"` ; aide de pied
  « …saisissez les quantités perdues / à réparer, puis attestez le restant avec
  « Ok » ». Remplacements : Perdu(s)/perdue(s) → Manquant(s)/manquante(s)
  (glossaire). Les identifiants internes `setTri(item, "lost")`,
  `onQty(item, "lost", …)` sont des noms de champ payload (`lostQuantity`) —
  **ne pas renommer**.
- Grammaire du trio : À réparer / Manquant / Ok — exclusive en quantité 1
  (toggles plein/outline), steppers masqués en quantité > 1, bouton « Ok ×N »
  désactivé à restant nul. Bornage inchangé : `onQty` cappe à
  `quantity − other` avec min 0.
- Payload : construit dans `confirmSubmit` — `{ materielId, materielName,
  quantity, lostQuantity, brokenQuantity }[]` + `{ returnNotes }` vers
  `completeLoanWithReturn`. **Strictement intouchable.**
- [LoanCard.svelte](../../../svelte-app/src/lib/components/teamMatos/LoanCard.svelte)
  : **aucun libellé « perdu » visible** (mesuré) — `getBadgeClass` ne retourne
  que des classes (badge-error si tout endommagé, badge-warning si partiel,
  badge-success sinon) ; les seules occurrences sont des commentaires
  (« Tout est perdu ou cassé », « Partiellement endommagé/perdu »). La
  « relabelisation » du badge se réduit donc à ces commentaires, sauf décision
  d'ajouter un texte d'état (voir Décisions).
- Intouchables vérifiés (grep `[Pp]erd[u]` sur `components/teamMatos`) :
  LoanForm.svelte, LoanLegacySelection.svelte, QuickMaterielSelectionModal.svelte,
  LoanMaterielList.svelte, LoanItemReadRow.svelte — zéro occurrence ; ils
  consomment `availableForPeriod` / `availableQuantity` / `isAvailable`
  uniquement. Aucun « perdu » restant dans la zone loan/retour hors
  LoanReturnForm/LoanCard.
- Hors zone mais visibles (décision à prendre) : l'en-tête de colonne
  « Perdus » de la fiche exportée (`svelte-app/src/lib/utils/loan-return-markdown.ts`)
  et « (perdu: N, cassé: N) » dans `MaterielStore.exportLoanToMarkdown` — le
  test `loan-return-markdown.test.ts` n'épingle pas l'en-tête (un relabel ne
  casse rien). C'est le vocabulaire de la fiche de retour au sens du glossaire.

### Ticket 06 — contrat/pipeline

- Conventions `pocketbase/pb_migrations/` : delta = fichier `179<epoch>_<desc>.js`
  avec `migrate((app) => {…}, (app) => {…})` (up/down). Modèle du ticket 01 :
  `1792805000_materiel_add_repair_quantity.js` — garde d'idempotence
  `if (!collection.fields.getByName("repairQuantity"))`, add `NumberField`
  onlyInt/min 0, backfill `torepair → repairQuantity = quantity` et
  `lost → quantity = 0` via `app.findRecordsByFilter`, down = removeByName.
  Le drop du statut suit le même motif (`collection.fields.removeByName("status")`,
  garde inverse si re-run). Pièges JSVM : skill `pocketbase-best-practices`.
- Re-run local prouvé : `bun run scripts_dev/migrate.ts --yes --content-synced
  --pb-bin=./pocketbase/pocketbase --pb-dir=<tmpdir>/pb_data` → rapport daté
  `scripts_dev/runs/<date>.md` + logs par step. Dernier run VERT mesuré :
  `scripts_dev/runs/2026-10-24-034810.md` (managed, cleanup --target=all,
  4014 records deleted, Git HEAD 68fb2179). Verdict VERT ⇔ tous steps exit 0 ET
  validate 0 failed / 0 non-verdicted.
- `scripts_dev/validate-migration.ts` : **aucun check sur materiel.status**
  (checks = counts par collection, intégrité relationnelle, recipe fields,
  guestUsers, refId coverage, text refs, convergence, invariants structurels
  (`materiel.ownershipEmpty`), teamdocs, timestamps sample) ⇒ couper `status`
  du transform ne fait pas diverger le validate (inféré de la liste des checks).
- `scripts_dev/3-import-pb.ts` : import générique du JSON transformé (pas de
  liste de champs pour materiel ; seules les relations et les champs JSON
  `event_materiel.specs` / `materiel_loan.materiels` sont déclarés) ⇒ ne rien
  changer côté import.
- `scripts_dev/2-transform-data.ts` — site d'écriture à retirer : dans le bloc
  materiel, `status: awMat.status || "ok"` (le backfill conservateur
  `repairQuantity`/`quantity` déjà présent reste, lui). Les autres `status:`
  du fichier (events, products, purchases, materiel_loan, event_materiel
  needed→to_find, teamdocs, todos) sont d'autres collections — intouchables.
- Inventaire complet des références au statut de MATÉRIEL (grep
  `MaterielStatusOptions|EnrichedMaterielStatus|getMaterielStatusLabel` sur
  `svelte-app/src` + grep `"lost"|"torepair"`) :
  - `types/pb-generated.ts` : `MaterielStatusOptions` (const + type) et
    `MaterielRecord.status` — **ne vit QUE là** (mesuré) ⇒ la regen le retire
    avec le champ du schéma.
  - `types/pb.d.ts` — aligné **à la main**, à retirer à la main : import de
    `MaterielStatusOptions`, re-export, alias legacy `MaterielStatus` et
    `MaterielStatusType`, champ `status: MaterielStatusOptions | null` du type
    `Materiel`.
  - `types/materiel.types.ts` : `EnrichedMaterielStatus`, le champ
    `EnrichedMateriel.status` (coexistence assumée jusqu'ici), et
    `MaterielFilters.status` dans une interface `MaterielFilters` **morte**
    (grep : aucun import — MaterielFilters.svelte définit son propre
    `MaterielFiltersType`).
  - `utils/materiel.utils.ts` : `getMaterielStatusLabel`, import de l'alias
    `MaterielStatus`, bloc de calcul du statut enrichi dans `enrichMateriel`
    (`doc.status ?? "ok"`, override loan/reserved) — à retirer quand plus aucun
    lecteur (après 04).
  - Composants (purgés par 04) : MaterielCard (`MaterielStatus` +
    `getMaterielStatusLabel` + conditions), MaterielForm (`MaterielStatusLiteral`,
    `statusOptions`, état), MaterielModal (`formStatus`, payload), MaterielPage
    (`availableStatuses`, `statusMatch`), MaterielFilters (`getStatusLabel`).
  - Store : `createMateriel` (param `status?: string` + défaut `status:
    (data.status || "ok")`), `updateMateriel` (param `status?: string`) —
    signatures à élaguer en 06 ; écritures du retour déjà parties en 03.
  - Écriture résiduelle facile à manquer : [QuickAddCatalogModal.svelte](../../../svelte-app/src/lib/components/teamMatos/QuickAddCatalogModal.svelte)
    passe `status: "ok"` à `createMateriel` — à purger.
  - Code mort : `types/appwrite.d.ts` enum `MaterielStatus` — seul `Purchases`
    est encore importé de ce fichier (grep) ; candidat purge, sans effet check.
  - **Distincts, intouchables** : `MaterielLoanStatusOptions` (statuts
    d'emprunt asked/accepted/…), `EventMaterielStatusOptions`
    (to_find/to_check/confirmed), toutes les lectures `.status` de
    LoanCard/LoanForm/LoanReturnForm (statuts de prêt), `setTri/onQty` "lost"
    (nom de champ payload).
- `docs/pocketbase_collections.md` : ne mentionne **ni** `materiel.status`
  **ni** `repairQuantity` (grep ; seule occurrence de « status » = le JSON
  contributors des events). Rien à retirer ; documenter `repairQuantity` (et le
  retrait du statut) dans la même session que la migration — règle de
  maintenance en pied de doc.

## Pièges

- `pb.d.ts` record types alignés **à la main** — le typegen ne les touche pas
  (bits le 24-10 sur le ticket 02, cf. `docs/svelte-app.md` § Typage).
- Pièges PB/JSVM : skill `pocketbase-best-practices` dès qu'on touche migrations
  ou hooks.
- **`availableQuantity` ≠ disponible sur période** : `availableQuantity`
  soustrait les emprunts ACTIFS à now ; `availableForPeriod` doit soustraire
  les emprunts chevauchant la période (+ repairQuantity). Ne pas dériver l'un
  de l'autre tel quel (fait détaillé § Ticket 03).
- Stub `opUpdate` bump `updated` à chaque écriture : un test « zéro écriture »
  s'éprouve par `updated` inchangé (getOne) ou par spy sur `fakePb.collection`
  — le stub n'a pas de journal d'appels.
- « Zéro écriture sur item intact » concerne les records **materiel** : le
  prêt, lui, est réécrit en bloc (`updateLoan` reçoit TOUS les items, y compris
  intacts) — c'est le payload inchangé à préserver, pas à éviter.
- `MaterielForm` force `quantity >= 1` (input `min="1"` + `isValid`) : un item
  au rebut (quantity 0, backfill « perdu ») n'est pas re-sauvable tel quel.
  Friction UX à trancher au ticket 04 (le geste réforme passe par le store et
  n'est pas concerné).
- `MaterielPage` : `Omit<MaterielFiltersType, "loanStatus">` est vestigial (le
  type ne porte plus `loanStatus`) — nettoyer au passage du rebasage filtres.

## Vérifications empiriques

| # | Sonde | Verdict | Certitude | Commande / source |
| - | ----- | ------- | --------- | ----------------- |
| 1 | Écritures de statut du retour | 3 branches écrivent `status` lost/torepair/ok, item intact inclus | mesuré | lecture `completeLoanWithReturn` dans `svelte-app/src/lib/stores/MaterielStore.svelte.ts` |
| 2 | Formule dispo sur période | `(quantity ?? 0) − loanedQuantity`, sans repairQuantity | mesuré | lecture `getAvailableMaterielsForPeriod`, même fichier |
| 3 | repairQuantity déjà soustrait hors période | `availableQuantity = (quantity ?? 0) − totalLoanedQuantity − repairQuantity` ; `displayState` + `getMaterielDisplayStateLabel` livrés | mesuré | lecture `enrichMateriel` / `getMaterielDisplayStateLabel` dans `svelte-app/src/lib/utils/materiel.utils.ts` + `MaterielDisplayState` dans `types/materiel.types.ts` |
| 4 | Consommateurs des sélecteurs | LoanForm + tests harness uniquement | mesuré | grep `getAvailableMaterielsByOwner\|getAvailableMaterielsForPeriod` sur `svelte-app/src` |
| 5 | Consommateurs de disponibilité dans le sélecteur | availableForPeriod/availableQuantity/isAvailable, zéro statut | mesuré | grep `availableForPeriod\|availableQuantity\|isAvailable` sur `components/teamMatos` |
| 6 | Seam 2 déjà testée | enrich dispo + états dérivés + labels couverts | mesuré | grep `describe\(\|it\(` sur `utils/__tests__/materiel.utils.test.ts` |
| 7 | Zone inventaire « perdu » | 2 occurrences UI (MaterielForm statusOptions, MaterielFilters getStatusLabel) | mesuré | grep `[Pp]erd[u]` sur `components/teamMatos` (+ `routes/MaterielPage.svelte`) |
| 8 | Zone retour « perdu » | LoanReturnForm : 1 badge RO, 1 bouton+aria trio, 1 label input, 1 aria quantité, 1 aide, 6 commentaires ; LoanCard : commentaires seulement, aucune classe libellée | mesuré | grep `[Pp]erd[u]` sur `components/teamMatos` + lecture LoanCard `getBadgeClass` |
| 9 | Intouchables loan propres | zéro « perdu » dans LoanForm / LoanLegacySelection / QuickMaterielSelectionModal / LoanMaterielList / LoanItemReadRow | mesuré | même grep |
| 10 | Références statut matériel | inventaire complet § Ticket 06 ; MaterielStatusOptions uniquement dans pb-generated.ts | mesuré | grep `MaterielStatusOptions\|EnrichedMaterielStatus\|getMaterielStatusLabel` et `"lost"\|"torepair"` sur `svelte-app/src` |
| 11 | Interface `MaterielFilters` (materiel.types) morte | aucun import | mesuré | grep `import {[^}]*MaterielFilters[^}]*} from "\$lib/types/materiel.types"` sur `svelte-app/src` |
| 12 | appwrite.d.ts mort pour materiel | seul `Purchases` importé de ce module | mesuré | grep `from ["'].*appwrite\.d` sur `svelte-app/src` |
| 13 | Migration ticket 01 | delta idempotent (garde getByName), backfill torepair/lost, down=removeByName | mesuré | lecture `pocketbase/pb_migrations/1792805000_materiel_add_repair_quantity.js` |
| 14 | Re-run pipeline prouvé | managed mode, verdict VERT daté, logs par step, exit 0 si tout vert | mesuré | lecture `scripts_dev/migrate.ts` + `scripts_dev/runs/2026-10-24-034810.md` |
| 15 | Validate insensible au statut | aucun check materiel.status dans la liste des checks | inféré (liste des checks exhaustive, lecture) | grep `^function \|addResult\|check[A-Z]\w+\(` sur `scripts_dev/validate-migration.ts` |
| 16 | Import générique | 3-import-pb.ts ne déclare pas les champs materiel | mesuré | grep `status\|materiel` sur `scripts_dev/3-import-pb.ts` |
| 17 | Transform : écriture status | ligne `status: awMat.status \|\| "ok"` dans le bloc materiel, backfill à conserver | mesuré | grep + lecture bloc materiel de `scripts_dev/2-transform-data.ts` |
| 18 | Docs schéma | pocketbase_collections.md ne mentionne ni materiel.status ni repairQuantity | mesuré | grep `status\|repairQuantity\|torepair\|lost` sur `docs/pocketbase_collections.md` |
| 19 | Tickets 01–02 vérifiés contre l'arbre | migration + repairQuantity (pb-generated + pb.d.ts manuel) + displayState/labels/tests présents à HEAD `bbc8af6d` | mesuré | lectures citées + `git log --oneline -8` (arbre propre, seul run.md non tracké) |
| 20 | Aucun test composant .svelte | le payload de retour n'est pas épinglé par un test UI | mesuré | glob `svelte-app/src/**/*.test.ts` (stores/db-sync/utils/services/router uniquement) |
| 21 | Spy mid-test = preuve « zéro écriture » | `vi.spyOn(fakePb, "collection")` (pattern `rejectEventMaterielWrites`) capte chaque update materiel émis par le retour — item intact absent, aucun payload ne porte `status` | mesuré | tests ticket 03 (`materiel-store-return-stock.test.ts`), verts 10/10 |
| 22 | Régression sélecteurs sans filtre statut | les suites store qui consomment `getAvailableMaterielsForPeriod` restent vertes (fixtures sans repairQuantity ⇒ formules inchangées pour elles) | mesuré | `/tmp/orchestrate/tests-t03-store-regression.log` (4 fichiers / 19 tests) |
| 23 | Zone inventaire « perdu » après 04 | 0 occurrence (Form/Card/Filters/Modal/Page) ; restantes = zone retour/loan (ticket 05) | mesuré | grep `[Pp]erd[u]` sur `components/teamMatos` + `routes/MaterielPage.svelte` post-04 |
| 24 | Canon après 04 | suite 53 fichiers / 382 tests verte, check:app 198 fichiers / 0 erreur | mesuré | `/tmp/orchestrate/tests-t04-full-suite.log`, `/tmp/orchestrate/check-t04-checkapp.log` |
| 25 | Zone retour « perdu » après 05 | 0 occurrence (LoanReturnForm, LoanCard, loan-return-markdown, MaterielStore, MaterielPage) ; `lostQuantity`/`"lost"` (noms de champ payload) intacts | mesuré | grep `[Pp]erd[u]` sur `components/teamMatos` + `utils/loan-return-markdown.ts` + `stores/MaterielStore.svelte.ts` + `routes/MaterielPage.svelte` post-05 ; en-tête markdown non épinglé par son test (vert, `/tmp/orchestrate/tests-t05-loan-return-markdown.log`) |

## Décisions par ticket

- **Ordre** : chaîne 03 → 04 → 05 → 06 inchangée ; chaque ticket reste
  committable seul (le schéma garde `status` jusqu'à 06, les lecteurs tombent
  un par un : retour en 03, UI en 04, signatures et champ en 06).
- **03 — gestes** : deux nouvelles méthodes de store (noms au glossaire, ex.
  `returnToService(materielId, n)` / `scrapUnits(materielId, n)`), pattern
  `updateMateriel`, garde `1 ≤ n ≤ repairQuantity` côté client, pas de règle
  nouvelle. **03 — période** : `availableForPeriod = (quantity ?? 0) −
  loanedPeriod − repairQuantity` (soustraction directe, PAS via
  `availableQuantity`). **03 — retour** : ne toucher que la boucle d'écritures
  materiel ; clôture via `updateLoan` et la projection event_materiel
  inchangées.
- **03 — livré** (commits `4ebc9eaa` retour, `8b668be1` sélecteurs+gestes) :
  noms retenus `returnToService` / `scrapUnits` (suggérés au dispatch) ;
  garde partagée dans `#adjustRepairQuantity` — violation ⇒ throw, `#error`
  du store posé (pattern `updateMateriel`), zéro écriture ; réforme borne
  `quantity` à 0 (`Math.max`) — un stock négatif n'a pas de sens physique ;
  projection du retour = un patch `{quantity, repairQuantity}` par item
  endommagé, lu depuis `#raw.materiels` (vérité locale, modèle offline-first)
  — **item absent du cache local ⇒ item sauté sans écriture** (une
  projection absolue sur un état inconnu serait une corruption ; la
  déclaration reste tracée dans le json du prêt complété) ; tests : nouveau
  fichier `stores/__tests__/materiel-store-return-stock.test.ts` (10 tests,
  spy transport pour « zéro écriture », clôture du prêt épinglée — base du
  to-verify 05).
- **04 — filtres** : **remplacement**, pas extension — `filters.statuses`
  garde son nom et sa mécanique, les valeurs deviennent `MaterielDisplayState`
  (`availableStatuses` → états dérivés, label via `getMaterielDisplayStateLabel`,
  match sur `materiel.displayState`) ; le filtre sur le statut persisté
  disparaît (spec). Nettoyage au passage de l'omit `loanStatus` vestigial.
- **04 — gestes UI** : branchés dans MaterielForm (édition) via les méthodes du
  store 03, visibles si `repairQuantity > 0`, bornés, retour visuel par
  `toastService.track` ; `MaterielInitialValues` étendu avec `repairQuantity`.
- **04 — badge carte** : `StatusConfig` remplacé par
  `getMaterielDisplayStateLabel(materiel.displayState, repairQuantity)` + map
  badgeClass par état ; stock réel déjà affiché.
- **05 — payload inchangé** : garanti par (a) les tests harness du ticket 03
  qui épinglent la clôture au transport (materiels JSON avec lostQuantity/
  brokenQuantity, status « completed », returnedAt, returnNotes), (b) un diff
  05 limité aux chaînes de libellés — **to verify** en revue 05 (confirmSubmit
  non touché). Aucun test composant à faire tourner (il n'en existe pas).
- **05 — périmètre libellés** : recommandé d'étendre aux 2 chaînes visibles
  hors zone stricte (en-tête « Perdus » de `loan-return-markdown.ts`, ligne
  « (perdu: …, cassé: …) » de `exportLoanToMarkdown`) — glossaire « perdu »
  banni ; le test markdown n'épingle pas l'en-tête. **to verify** (mainteneur).
- **05 — badge LoanCard** : en l'état mesuré il n'y a aucun texte « perdu » à
  relabeliser, seulement des commentaires et des classes de couleur ;
  interpréter la case de ticket comme « commentaires relabelisés, badge couleur
  conservé » sauf volonté d'ajouter un libellé d'état. **to verify**.
- **04 — quantité 0** : trancher si le formulaire autorise `quantity = 0` en
  édition (rebut) — recommandé : oui en édition, min 1 conservé en création.
  **to verify** (mainteneur).
- **06 — purge** : liste exhaustive § Ticket 06 (pb.d.ts à la main, signatures
  store, enrich, interface morte, QuickAddCatalogModal, appwrite.d.ts au
  choix) ; regen types + purge dans le même commit ; re-run managed ; doc
  schéma à jour dans la même session.
- **06 — livré** (commits `52b592ef` purge app, `b5b7c178` migration +
  transform + regen + doc) : les 5 sites `pb.d.ts` à la main, bloc statut de
  `enrichMateriel` (hasActiveLoans/hasFutureLoans conservés — ils alimentent
  `displayState`), `getMaterielStatusLabel`, `EnrichedMaterielStatus`,
  `EnrichedMateriel` rebasé sur `Materiel` (l'`Omit<…, "status">` n'avait plus
  de raison d'être), interface `MaterielFilters` morte (note d'origine
  laissée sur place), signatures store, `QuickAddCatalogModal`, enum
  `appwrite.d.ts` (candidat purge, tranché oui). Migration
  `1792900000_materiel_drop_status.js` sur le modèle ticket 01 (garde
  d'idempotence ; down recrée le select à l'id d'origine
  `select2063623452`, valeurs non reconstituées — dérivation perdue depuis
  la conversion quantitative). Test de coexistence obsolète supprimé plutôt
  que réécrit : ses 3 cas (repair/depleted/null) existaient déjà dans le
  bloc disponibilité du même fichier — 380 tests, zéro perte de couverture.
  Pipeline managed re-run **VERT** (`2026-10-24-050642.md`, base jetable
  `/tmp/opencode/pb-mig-t06` ; un premier essai ROUGE au même endroit —
  superuser non provisioné sur la base neuve, corrigé par
  `pocketbase superuser upsert` avant le re-run) ; sonde sqlite sur la base
  importée : pas de colonne `status`, backfill visible (2 en réparation,
  9 à quantité 0 sur 110). Grep de preuve zéro lecteur restant :
  `/tmp/orchestrate/grep-preuve-t06.log`.
- **Arbitrages tranchés par l'orchestrateur (profil délégué, 24-10)** :
  1. *Périmètre vocabulaire 05* — les 2 chaînes hors zone stricte
     (`loan-return-markdown.ts` en-tête « Perdus », `exportLoanToMarkdown`
     « (perdu: …) ») entrent au ticket 05 : le spec US 14 dit
     « systématiquement » — le ticket étend le geste, il ne le contredit pas.
  2. *Badge LoanCard* — aucun libellé « perdu » visible n'existe : relabel des
     commentaires seuls, badge couleur conservé, pas de nouveau texte d'état
     (le critère du ticket est satisfait sans geste produit nouveau).
  3. *Quantité 0 (04)* — `quantity = 0` autorisé en ÉDITION seulement
     (rebut re-sauvable, spec US 15), min 1 conservé en création.
  4. *Classes badge par état (04)* — arbitrage esthétique laissé à
     l'implémenteur, sous `docs/ui-conventions.md`.
  La review de fin de run valide ces quatre arbitrages.
- **04 — livré** (commits `a0034a1b` formulaire+modal, `55b906bd` badge
  carte, `010d32bd` filtres+page) : arbitrage n° 3 appliqué tel quel —
  `quantity = 0` valide en ÉDITION seulement (`min` et garde conditionnés à
  `isEdit`, aide « 0 = au rebut » sous l'input) ; au passage `quantity`
  s'initialise avec `?? 1` et plus `|| 1` — l'ancien `||` écrasait un rebut
  0 en 1 à l'ouverture du formulaire. `MaterielInitialValues` étendu de
  `repairQuantity` **et de `id`** (requis par les appels store du geste ;
  MaterielModal les fournit tous deux). Gestes branchés dans MaterielForm :
  snapshot local `repairStock` décrémenté seulement après un succès
  constaté — `toastService.track` toast l'erreur puis re-throw, d'où un
  catch muet documenté ; borne UI `[1, repairStock]` (`max` + `$derived`
  de validité) en plus de la garde store ; bloc masqué dès
  `repairStock = 0` ; Enregistrer et les deux gestes se désactivent
  mutuellement (`loading` / `gestureBusy`) — une écriture du record à la
  fois. Badge carte : `complete` masqué (état neutre, remplace l'ancien
  masquage de `ok`) ; `loan`/`reserved` désormais rendus — l'ancien code
  masquait `loan`, le critère du ticket énumère les six états ; classes
  alignées sur le prior art LoanCard (warning si partiel, error si tout le
  stock immobilisé) et sur les badges existants de la carte (info prêt,
  secondary réservé). Filtres : remplacement pur appliqué (même mécanique,
  valeurs `MaterielDisplayState` typées dans `MaterielFiltersType`, match
  sur `materiel.displayState`, legend « Statut » → « État ») — **écart
  assumé à la reco « label via getMaterielDisplayStateLabel »** : un map
  local court documenté dans MaterielFilters (« Partiel (à réparer) »...),
  car la fonction canonique y injecterait « Partiel : 0 à réparer », sans
  sens pour une facette agrégée ; le vocabulaire reste le sien. Omit
  `loanStatus` vestigial de MaterielPage nettoyé au passage.
- **05 — livré** (commit `0645f77f`) : les deux arbitrages de l'orchestrateur
  appliqués tels quels — les 2 chaînes hors zone stricte entrent au ticket
  (en-tête « Manquants » de `loan-return-markdown.ts`, ligne « (manquant: …,
  cassé: …) » de `exportLoanToMarkdown`) et LoanCard ne porte que des
  commentaires relabelisés (badge couleur conservé, pas de nouveau texte
  d'état) ; diff 18⁺/18⁻ strictement lexical — `confirmSubmit` hors diff,
  identifiants `setTri`/`onQty` "lost" et bornage inchangés, formes
  Manquant/Manquants/manquante appliquées à libellés, aria et aide ; test
  markdown ciblé vert 7/7 (`/tmp/orchestrate/tests-t05-loan-return-markdown.log`,
  l'en-tête n'y est pas épinglé, confirmé) ; grep zone retour zéro occurrence
  (sonde 25) ; click-throughs scénarios 1-4 marqués `[!]` « passe humaine
  requise » — passe de clôture mainteneur (checklist
  `.scratch/tracker/clickthrough-checklist.md`).

## Trouvailles différées

(trivial = une ligne, fixé à la clôture ; finding = tag `!`/`S2`/`?` → entrée
backlog écrite par l'orchestrateur à la clôture)

- `MaterielForm.resetForm` jamais appelé — code mort (9 lignes ; les autres
  occurrences du grep `resetForm` sont des fonctions homonymes d'autres
  composants, appelées chez elles). Repéré au ticket 04, non purgé
  (au-delà du trivial) : candidat naturel au nettoyage 06 qui touchera
  déjà la zone.
