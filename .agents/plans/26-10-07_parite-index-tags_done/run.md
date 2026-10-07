# Run — parité : indexes PB + restauration « documents liés par tag »

**Mode** : mini-run persistant (2 tickets, SÉQUENTIELS — même domaine PB : chaîne de migrations + boots de vérification).
**Autorisation** : utilisateur, 07-10 — (1) « l'index PB updated me semble devoir être ajouté (comme tout index pertinent étant donnée la façon dont sont requêté les données) » ; (2) « la suppression "documents liés par tag" est une regression feature […] Les modifications du schema nécessaires sont à effectué le cas écheant ».

## Faits établis (investigation orchestrateur, 07-10)

- **Index** : le snapshot PB ne porte AUCUN index métier (seuls idx_email/idx_ingredients + système). Les delta-sync filtrent `updated >= since` (full-scan aujourd'hui) ; les syncs scopés filtrent `eventId + updated` ; join-event cherche share_links ; locks cherche recordId+collection. Les index Appwrite prod (`idx_updatedAt` sur materiel/materiel_loan/products, `idx_main-update`) n'ont jamais eu d'équivalent PB.
- **Tags teamdocs** : la fonctionnalité « documents liés par tag » est une **coquille vide partout** — l'app prod (référence site) rend `EventDocumentsBloc` sur 4 pages événement (tags fixes : `produit` confirmé sur EventProductsPage:653 ; vérifier materiel/recettes/todos), le store filtre `tags?.includes(tag)`, MAIS l'attribut `tags` n'existe pas dans la collection Appwrite prod (export frais : 22 rows sans une seule clé `tags`). Le drop PB 1700000029 + le nettoyage triage (`8d4541a9`, −558 lignes) ont retiré cette coquille morte.
- **Code client de référence** : la version mig pré-suppression est dans git (`git show 8d4541a9^:<path>`) — déjà adaptée pb-sync. La version site (`enka-cookbook-site/svelte-app/src/lib/components/documents/EventDocumentsBloc.svelte` + `TeamdocsStore.svelte.ts` L56-76) est l'implémentation fonctionnelle de référence pour le comportement attendu.
- **Pipeline** : `2-transform-data.ts` §9 teamdocs (L809-838) ne mappe pas `tags` — à ajouter (`awDoc.tags || null`, tolérance standard ; prod n'a pas de valeurs, les futures docs créeront leurs tags via l'UI).

## Header — état du monde (07-10)

- **Base** : `f03b3295`. Arbre propre. Canons : `check` 0 err/6 warn · `test` **104/104** · `check-legacy` **0** (sortie 0 — NE PAS régresser) · build propre committé.
- Chaîne de migrations : **100 lignes** `_migrations` appliquées à la dev DB (T01 a posé `1791333000_query_indexes.js`) ; tout delta = nouveau timestamp **> 1791333000**. Bootcheck sur copie AVANT application dev ; backup pb_data avant tout boot écrivant (`/tmp/orchestrate/pb_data-backup-<ticket>/` + sha256).
- Ports 8090/8091 : revérifier avant boot ; un seul process PB par répertoire.
- **Ticket suivant séquentiel** : T02 ne démarre qu'après l'attestation de T01 (migrations + boots partagés).

## Critères de fin de run

- [x] T01 : indexes posés + preuves EXPLAIN QUERY PLAN avant/après
- [x] T02 : fonctionnalité restaurée bout-en-bout (schéma + client + pipeline) + tests
- [ ] Canons verts aux deux portails ; run.md amendés ; backlog mis à jour (orchestrateur)

## Journal par ticket (rempli par les implémenteurs à l'amend)

### T01 — Indexes PocketBase pertinents : delta-sync, scopes, lookups (07-10)

**Verdict global : VERT — 11 index posés, tous prouvés EXPLAIN (SCAN → SEARCH USING INDEX, 0 temp b-tree), sondes 200, down() sélectif testé, canons inchangés. Deux candidats du ticket rejetés par la preuve (documentés ci-dessous) — l'hypothèse prime pas, la mesure oui.** Aucun fichier client touché.

**Inventaire vérifié par grep (corrections au candidat du ticket)** :
- Delta simple `updated >= since` ORDER BY updated : **7 collections** non scopées (events, materiel, materiel_loan, recipes, teamdocs, ingredients, categories). `pb-collection.initialFetch` L254-268 : filter composé `(userFilter) && updated >= {:since}` + `sort: 'updated'`.
- Delta scopé `eventId = X AND updated >= since` : **3 collections** (products, purchases, event_materiel). Grep exhaustif des `initialFetch` (re-confirme T13) : ProductsStore initialize ×2 + syncRevalidate ×2 + EventMaterielStore initializeForEvent ×1, tous avec `eventId`. **Ces 3 collections n'ont AUCUN fetch non scopé → pas d'index `updated` simple pour elles, composite seul** (ajustement au ticket qui les listait sous les 2 patterns).
- share_links : `getEventShareLinks` (pb-invitations.ts L61) `target_id = ? && isActive = true` ; cascades delete events/teams (hooks) `link_type = ? && target_id = ?` ; join-event + send-emails : `findRecordById` (PK).
- locks : **client 100 % PK** (`getOne(resourceId)`, `update(resourceId)`, `create({id: resourceId})`, `subscribe(resourceId)` — le lock id EST le resourceId) ; aucun hook ne requête locks. Les champs `recordId`/`collection` sont des vestiges Appwrite jamais remplis ni requêtés → **candidat composite (recordId, collection) rejeté par grep** ; `userId` inutile aussi (règles update/delete évaluées sur fetch par PK).
- events.createdBy : listRule/viewRule = OR `teams.members ~ || guestUsers ~ || createdBy =` — les `~` multi-relation sont des LIKE sur JSON (colonnes `teams`/`guestUsers` = JSON, vérifié `.schema events`), non-indexables → l'optimiseur multi-OR ignore l'index. **Mesuré sur copie jetable (t01-explain-createdby-probe.log) : OR-shape = SCAN avec index posé ; égal pur = SEARCH mais aucune vraie requête n'utilise l'égal pur** (deleteRule = delete par PK). **Candidat rejeté par mesure.** Idem share_links.createdBy (règles égal pur mais toute liste passe par target_id ; pas de requête createdBy-seule dans client/hooks).

**Migration `1791333000_query_indexes.js`** (timestamp > 1791304200) : up() = `addIndex()` par collection (reassignation d'array JS neuf — jamais de mutation du wrapper goja, piège JSONField T8 appliqué aux JSONArray ; idempotent ; préserve les index existants) ; down() = `removeIndex()` sélectif par nom (ne retire que les siens — `idx_ingredients_uuid` préservé, testé). 11 index : `idx_{events,materiel,materiel_loan,recipes,teamdocs,ingredients,categories}_updated` · `idx_{products,purchases,event_materiel}_eventId_updated` · `idx_share_links_target (target_id, link_type)`.

**Preuves** (requêtes mimant les vraies requêtes PB filter+sort) :

| Requête représentative | Avant (dev) | Après (dev) |
|---|---|---|
| delta simple ×7 | SCAN + USE TEMP B-TREE | SEARCH USING INDEX idx_<coll>_updated (updated>?) |
| delta scopé ×3 | SCAN + USE TEMP B-TREE | SEARCH USING INDEX idx_<coll>_eventId_updated (eventId=? AND updated>?) |
| share_links client (target_id+isActive) | SCAN | SEARCH idx_share_links_target (target_id=?) |
| share_links cascade (link_type+target_id, DELETE) | SCAN | SEARCH idx_share_links_target (target_id=? AND link_type=?) |
| events rules OR-shape | SCAN | SCAN (attendu, index refusé) |
| locks PK | SEARCH sqlite_autoindex (déjà optimal) | inchangé |

Le composite couvre filtre ET tri (plus de temp b-tree). Logs : `/tmp/orchestrate/t01-explain-{before,after,after-dev,createdby-probe}.log` ; sqlite_master vérifié sur copie puis dev (11 index + système).

**Chaîne d'exécution** : backup pré-boot `/tmp/orchestrate/pb_data-backup-t01p2/` (sha avant `2b07b353…`, après `49a197ad…`, logs `t01-pbdata-sha-{before,after}.txt`) ; bootcheck sur copie `pb-bootcheck-t01` (`migrate up --dir/--migrationsDir/--hooksDir` absolus → « Applied 1791333000 » ; EXPLAIN + sqlite_master sur copie ; `echo y | migrate down` → « Reverted », 0 index résiduel, `idx_ingredients_uuid` intact) ; application dev (`_migrations` 99 → 100) ; EXPLAIN après dev identique ; boot dev 8090 (`nohup serve`, health 200, hooks OK, stoppé en fin de ticket, ports libres).

**Sondes** (`bun` non requis ; python pattern T4, `.scratch/probes/t01-indexes-probe.py`, log `/tmp/orchestrate/t01-probe.log`) : superuser de sonde créé puis supprimé (teardown vérifié en DB) ; delta products `filter=(updated >= '2000-01-01 00:00:00.000Z')&sort=updated` → **200, 982 items, tri ASC vérifié** ; sync scopé products (event `yf714apw1097neu`, filter eventId+updated, sort=-updated) → **200, 11 items, tri desc + eventId vérifiés** ; purchases 200 (24) ; event_materiel 200 (0) ; share_links filter target_id+isActive → 200 (1).

**Canon** : `bun run check` = 177 fichiers, **0 erreur, 6 warnings** (baseline exacte). Log `/tmp/orchestrate/t01-check-mig-26-10-07.log`. Test/test-legacy non tournés (aucun code client — périmètre ticket étape 7).

**Pièges T01** :
- LIKE SQL : `_` est un joker — `NOT LIKE 'idx__%'` exclut TOUS les idx_ (vécu) ; utiliser `LIKE 'idx\_%' ESCAPE '\'`.
- `migrate up` = silencieux ; `migrate down` = interactif → `echo y |` (confirmé).
- DELETE superuser → **204 corps vide** : `json.loads` lève sur l'absence de corps — pas une erreur (teardown vérifié en DB plutôt que sur le code HTTP).
- JSVM `collection.indexes` (`types.JSONArray<string>`) : lire via boucle + réassigner un array neuf ; ne jamais push/muter le wrapper.

**Note WIP fence** : aucune édition étrangère rencontrée (checkpoint propre, `??` = uniquement mes 2 fichiers) ; commit filet : migration + sonde (convention repo : sondes versionnées) + ticket + run.md.

### T02 — Restaurer « documents liés par tag » : schéma + client + pipeline (07-10)

**Verdict global : VERT — fonctionnalité rendue réellement fonctionnelle bout-en-bout : champ `tags` json posé (bootcheck up/down/up sur copie puis dev), sondes curl 200 + persistance SQL vérifiée, client restauré depuis `8d4541a9^` (hunks seuls, fixes du triage préservés), blocs rendus sur les 4 pages événement avec les tags parité site, mapping pipeline ajouté. Canons : check 0 err/6 warn (178 fichiers), test 107/107 (104 + 3 nouveaux), check-legacy 0 err/2 warn (baseline exacte).** Deux commits en tiers : `2f3440f8` (données) + `efa6f33e` (client).

**Contradiction flaguée (artefact prime sur le dispatch)** : le fait établi n°9 (« export frais : 22 rows sans une seule clé tags ») est **contredit par l'export local** `scripts_dev/appwrite-export/teamdocs.json` (07-10 01:01, re-import audit-fixes T17) : les 22 rows portent TOUS la clé `tags`, avec des **valeurs réelles** sur 10 d'entre elles (`["materiel"]`, `["produit","tache","recette"]`, etc.) et `[]` sur les 12 autres. L'attribut `tags` existe donc dans la collection Appwrite de cet export — la restauration est encore plus utile qu'anticipé : le mapping `tags: awDoc.tags || null` **préserve** ces valeurs au prochain re-import. Nota : `[]` est truthy en JS → 12 rows importeront `[]` (pas null) — comportement du pattern repo standard demandé par le ticket, sans impact client (`doc.tags?.includes(tag)` et `doc.tags.length > 0` sont faux sur `[]`). Dry-run : 22 rows transformées, zéro crash, verdict réel = 10 tags préservés + 12 `[]` (log `/tmp/orchestrate/t02-transform-dryrun.log`). Les warnings teamId orphelin préexistaient (test doc sans team).

**Décisions de design** :
- **`EnrichedTeamdoc` non ressuscité** : pré-suppression c'était `Omit<Teamdocs, "lockedBy"> & { lockedBy: string | null }` — un shim legacy (lockedBy n'existe plus au schéma PB) et `doc.tags` n'y était même pas typé (d'où le « fix EnrichedTeamdoc » du triage = sa suppression). `tags` étant maintenant un vrai champ, il vit sur `Teamdocs` (`pb.d.ts` : `tags: string[] | null` ; `pb-generated.ts` régénéré par `bun run generate-types` → `tags?: null | Ttags`, pattern générique json du repo). Le store retourne `Teamdocs[]` — `doc.tags?.includes(tag)` type proprement, check-legacy 0 tenu dès l'écriture.
- **`isPublic`/`teamName` non restaurés** : même sous-système mort mais features distinctes (visibilité/nommage) sans champ au schéma — hors objectif ticket « documents liés par tag ». Les hunks restaurés les excluent ; les fieldsets « Visibilité » (déjà commentés pré-suppression) et l'import `ActiveFiltersDisplay` (usage mort commenté) restent hors.
- **Champ json, nommage `tags`** : conforme à l'intention 1700000009 (vérifiée via `git show 165062d4:pocketbase/pb_migrations/1700000009_teamdocs.js`) ET à la référence site. Id de champ `json4321650987` (sans collision, 24 ids json existants vérifiés).
- **Tag strings parité site** (grep confirmé sur les 4 pages site + hunks `8d4541a9^`) : `materiel` (EventMaterielPage), `produit` (EventProductsPage), `recette` (EventRecipesPage), `tache` (EventTodosPage) — labels Produits/Recettes/Tâches/Matériel ; `PREDEFINED_TAGS` identiques sur les pages create/edit.
- **`TeamdocsStore.softReset()` ajouté** (miroir `ProductsStore.softReset()`) : le harness a besoin d'un reset non destructif — voir piège ci-dessous.

**Chaîne d'exécution** : sha pb_data avant `eb12d00e…` / après `2e5ea6fb…` (`/tmp/orchestrate/t02-pbdata-sha-{before,after}.txt`) ; backup pré-boot `/tmp/orchestrate/pb_data-backup-t02p/` ; bootcheck sur copie `pb-bootcheck-t02` (« Applied 1791340000 » ; `pragma table_info(teamdocs)` = colonne `tags` JSON nullable ; `_collections.fields` = `tags/json/required:false` ; `echo y | migrate down` → « Reverted », colonne retirée, `_migrations` 100, les 11 index T01 + `idx_ingredients_uuid` intacts ; re-up OK) ; application dev (`_migrations` 100 → 101) ; boot dev 8090 (health 200, hooks OK, log sans erreur, stoppé en fin de ticket, ports libres).

**Sondes** (`.scratch/probes/t02-teamdocs-tags-probe.py`, log `/tmp/orchestrate/t02-probe.log`, superuser de sonde créé puis supprimé, teardown vérifié en SQL) : create avec `tags: ["produit","recette"]` → **200 + SQL `'["produit","recette"]'`** ; create sans tags → 200 + SQL NULL ; PATCH tags → 200 + SQL `'["tache"]'` ; liste API → **tags arrive en array natif** (pas une string — la consommation directe `doc.tags?.includes()` est correcte, pas de safeJsonParse nécessaire : les helpers existants parsent des strings legacy Hugo/Appwrite, pas du json PB natif).

**Test store** (`teamdocs-store-tags.test.ts`, 3 tests) : `getEventDocumentsByTag` filtre eventId+tag avec event B sans rapport exclu et docs sans tags exclus ; `getTeamTags` dédoublonne/tri et scope par équipe. Harness fake PB inchangé ; fixture `makeTeamdocsRecord` ajoutée.

**Pièges T02** :
- **`destroy()` sur un singleton store tue son bridge liveQuery définitivement** : `#bridge` est un field créé au chargement du module ; `destroy()` unsubcribe et rien ne le recrée — le store devient aveugle à Dexie (diagnostiqué par sondes jetables : Dexie peuplé, bridge neuf voit la row, bridge du store à 0). Dans l'app c'est sans effet (destroy = logout terminal, re-login = reload), mais dans les tests `destroy()` entre deux tests casse toute propagation ultérieure. Les tests passants « avec destroy » du diagnostic ne passaient que par accident (map pétrie, même record id). → `softReset()` (état mémoire + `clearLocal()`, bridge intact) pour le harness ; finding lifecycle différé (les stores n'ont pas tous un softReset).
- sv-router `route.params` = `Partial<Record<..., string>>` → `eventId` est `string | undefined` selon les pages et `canEdit` peut être `boolean | undefined` : les props requis du bloc exigent `canEdit={!!canEdit}` et `eventId={eventId ?? ""}` aux sites d'appel (check-legacy, plus strict que check, les attrape).
- `searchParams.get()` retourne `string | number | boolean | null` (wrapper sv-router) → narrowing `typeof tagParam === "string"` avant le `includes` du pré-check.

**Canon** : `bun run check` = 178 fichiers, **0 erreur, 6 warnings** (baseline exacte) · `bun run test` = **107/107** (104 + 3) · `bun run check-legacy` = **0 erreur, 2 warnings** (baseline : les 2 warnings a11y tabindex préexistaient — logs triage `f3-check-legacy-full2.log`, lignes 373/418 non touchées par mes hunks). Logs : `/tmp/orchestrate/t02-check-mig-tier1.log`, `t02-check-mig-tier2.log`, `t02-check-mig-tier2b.log`, `t02-check-legacy.log`, `t02-test-teamdocs-tags.log`, `t02-test-full.log`.

**Note WIP fence** : aucune édition étrangère dans la zone (checkpoint propre avant édition) ; les stashes du repo datent de 2025/2026-janvier sur l'ancien arbre (1650 fichiers, aucun fichier svelte-app actuel) — non touchés. Commits : `2f3440f8` (migration + sonde + pipeline + types), `efa6f33e` (client + tests), le présent amend (ticket + run.md).
