# Run — 26-10-06 fixes audit (branche `mig/pocketbase`)

**Mode** : delegated-run, **chain** (interruptions = exceptions d'enveloppe uniquement).
**Enveloppe** : défauts du skill delegated-run — décider par défaut, escalader par exception. Bans : push, deploy, destructif sur WIP étranger, hors repo.
**Source** (investigation pré-existante — verify-and-refresh, pas de re-investigation) :
- `enka-cookbook-site/.scratch/audit/26-10-06_00_synthese-audit.md` (synthèse + fix-list lots 0-5)
- `…/26-10-06_schema-client-contract.md` (constats A1-A3, B1-B10, C1-C12 ; schéma §2 ; dates §5)
- `…/26-10-06_rules-hooks.md` (ORD-1, DIV-1, REC-*, SEC-*, HOOK-*, LOCK-1, EVENT-1, UI-*, MIG-1, DOC-1)
- `…/26-10-06_import-pipeline.md` (pipeline, plan de fix §6)
- `…/26-10-06_port-hardening.md` (9 étapes de portage, ~34 h)

## Header — état du monde

_(rafraîchi par l'orchestrateur à chaque portail — dernière mise à jour : après T2, 06-10)_

- **Base** : `e9f8c6cd` « build » (HEAD `mig/pocketbase` = origin au démarrage, 06-10)
- **HEAD après T4** : `9ebe9297` (migration rules `1791278800_rules_api_hardening.js`, 9 règles durcies, matrice curl 52/52 copie+dev). **Lot 0 (fondations backend) terminé. Frontier : T5.**
- **Faits T4 portant les tickets client** : REC-4/SEC-1 enfants = no-op (le snapshot avait déjà figé les fix 042/043 dev) ; client envoie bien `events.createdBy` au create ; id locks garde min 15 (ids `doc_`/`event_` ≈ 20-21 chars OK) ; PB évalue les rules AVANT la validation (400 `data:{}` = rule, `data:{champ}` = validation).
- **Piège T2 à porter par les deltas suivants** : toute nouvelle colonne PB = `DEFAULT '' NOT NULL` → backfills doivent cibler `''` ET NULL.
- **Arbre** : propre hormis `.scratch/probes/t1-snapshot-summary.py` (untracked, probe transient T1 — connu, ne pas committer ni nettoyer).
- **Décision portail post-T1** : ne PAS lancer `migrate history-sync` sur la dev DB pendant le run (les 9 lignes `_migrations` orphelines sont inoffensives) ; à noter dans la checklist déploiement.
- **Deviation T1 validée** : snapshot généré depuis la copie de backup (jamais la dev DB en écriture) — équivalent et vérifié par sha256 avant/après identique.
- **Canon de tests** (baseline 06-10, logs `/tmp/orchestrate/baseline-{check,test}-mig-26-10-06.log`) :
  - `bun run check` (svelte-app) : 179 fichiers, **0 erreur**, 6 warnings (5 fichiers, a11y + state_referenced_locally — préexistants)
  - `bun run test` : vitest 4.1.4 — **56 tests / 3 fichiers, tous verts** (utils only)
- **Harness** : aucun test stores/db-sync ; aucun test backend (hooks/migrations PB non testés automatiquement). Validation backend = serveur PB local (binaire `pocketbase/pocketbase`, port 8090) + sondes curl.
- **Concurrency** : aucune au démarrage — arbre propre, `.scratch/wip/` inexistant (checkpoint 06-10). Les implémenteurs : appliquer COORDINATION.md (checkpoint avant 1re édition).
- **Tooling** : binaire PB présent (pas de download) ; `pb_data` = DB dev (dernière écriture 08-05) ; port 8090 **libre** au 06-10 ; `bun run dev:pb` = `scripts_dev/pb-dev.sh`. **Un seul process PB sur pb_data** (lock SQLite) — pour une DB fraîche, copier pb_data ailleurs ou utiliser `--dir`. **Backup `pb_data` obligatoire avant cleanup/re-import.**
- **Ne pas éditer les migrations `17*`/`1777*` existantes** (cause racine B10 : éditées après application). Tout correctif = **nouvelle migration datée** (timestamp > dernier fichier) — sauf T1 qui reconstruit la chaîne.

## Corrections aux sources (faire prévaloir sur les rapports)

1. **REC-2 réfutée** (curl anonyme 05-10, mesuré) : `listRule: ""` = lecture **publique** en PB 0.37 — 372 recettes + 845 ingrédients lisibles sans auth. Les rapports présumaient « locked ». Conséquence : la sync client recipes/ingredients/categories en lecture fonctionne ; restent à finaliser create/update rules (REC-3, REC-8).
2. **IDs custom tolérés par collection** (mesuré) : recipes porte des ids 32 chars avec `_` (`houmous-pois-chiche_dw7yaqdlvjg9`) → la config du champ id est **par collection**. Précédent de relaxation : migration `1777813747_updated_recipes.js`. LOCK-1 = relaxer le pattern id de `locks` uniquement.

## Décisions d'enveloppe prises (arbitrages documentés, réversibles)

- **DIV-1** : la DB dev reste la référence ; T1 produit un snapshot migrations reflétant son état exact. Les champs perdus en dev **dont l'intention est claire** (teams `createdBy/roles/description/city/isPublic` — déclarés en 1700000001, écrits par `NativeTeamsStore` et le hook `invite-to-team` ; `locks.userName` ; `share_links.createdBy` requis par REC-1) sont **ré-ajoutés par deltas** en T3, après le snapshot.
- **teamdocs** : le drop `createdBy/tags/isPublic/teamName` est **explicite** (1700000029 drop&recreate) → PAS de ré-ajout ; le fix B4 est côté client (cesser d'envoyer `createdBy`, ticket T6).
- **events `description`/`minContrib`** : ré-ajoutés par delta (T3) — l'UI les édite (A1/B5) ; `allDates` reste dérivé du JSON `date` (pas de champ).
- **REC-2** : listRule `""` (public read) **conservé** pour recipes/ingredients/categories — référentiel de cuisine partagé, assumé. REC-8 (update/delete ingredients ouverts) : **assumé**, documenté.
- **SEC-1/REC-4/C2** : accès unifié sur `guestUsers` (relation), `guestEmails` reste en tracking data uniquement (pas dans les rules).
- **Secret share_links ≠ id** : **différé** (S2) — REC-1 fermant l'énumération (rules scopées) et les ids PB étant aléatoires, le changement d'URL/token est une refonte d'API mieux placée avec la refonte invitations. Ligne backlog en fin de run.
- **Normalisation dates frontière pb-sync** (§5 schema report) : **différée à l'Étape 3 du portage** (T14, bump Dexie v10 purge les caches) — normaliser `updated` avant le curseur scopé corromprait les comparaisons lexicales mixtes. T7 fixe les sites de lecture (helper partagé), jamais les champs système `created`/`updated`.

## Faits localisés clés (ancres — les rapports font foi)

- Migrations : `pocketbase/pb_migrations/` — **reconstruites en T1** : un seul snapshot `1791277647_collections_snapshot.js` depuis la DB dev (l'ancien chaînage de 74 fichiers vit dans git ; piège ORD-1 éradiqué). Typegen : `svelte-app/src/lib/types/pb-generated.ts` (reflet DB dev, 08-05).
- Hooks : `pocketbase/pb_hooks/{join-event,cascade-delete-event,cascade-delete-teams,teams-resync-events,send-emails,invite-to-team}.pb.js` + `lib/{mailer,email-templates}.js`.
- Client : stores `svelte-app/src/lib/stores/*.svelte.ts` ; services `pb-auth.ts`, `pb-invitations.ts`, `pb-locks.ts` ; sync `svelte-app/src/lib/db-sync/pb-collection.ts` (`initialFetch` L203-248 : orderBy `updated`, delta `updated > since`, fallback table vide).
- Pipeline import : `scripts_dev/{1-export-appwrite,2-transform-data,2b-transform-recipes,2c-transform-ingredients,2d-transform-catalog,3-import-pb,4-fix-timestamps,cleanup-pb,validate-migration}.ts` + `pb-import/{id-map.json,recipes.json}` + `migration-map.json`.

## Pièges (cumul des rapports + run)

- PB trie les migrations par **nom de fichier** — jamais rééditer un fichier déjà appliqué ; deltas = nouveaux timestamps.
- `?=` est cassé en PB 0.37.5 → utiliser `~` pour les relations multi.
- `~` sur JSON/texte = LIKE sous-chaîne (SEC-1 : `alice@` ⊂ `malice@`).
- PB renvoie les dates `YYYY-MM-DD HH:mm:ss.SSSZ` (espace, pas de `T`) — ne jamais `split("T")` sur une date PB.
- Relations PB : valider **ids** (pas noms) ; champs inconnus du body = rejet ou perte silencieuse.
- `pb-collection.ts` : pas de curseur persisté — `since = max(updated)` de toute la table (bug scopé, port Étape 3).
- JSVM : ES5 limité ; `console.log` incertain → `$app.logger()` ; `$os.getenv` pour l'env.
- Nouvelle colonne PB = `DEFAULT '' NOT NULL` (rows existantes = `''`, pas NULL) : backfill → `WHERE col = '' OR col IS NULL` (détails journal T2).
- **`bun run check` (svelte-check-native 0.7.2) ne fait PAS de diagnostics TypeScript** (mesuré T5 : erreur de type délibérée dans un `.svelte` ET un `.svelte.ts` = 0 erreur rapportée ; il ne voit que a11y/runes/compil). Le vrai audit type = `bun run check-legacy` (svelte-check) — **193 erreurs préexistantes** sur 50 fichiers (dette invisible au canon natif) : raisonner par diff par fichier, pas par « 0 erreur ». Durable : `svelte-app/CLAUDE.md` § Development Commands.
- Champ PB inconnu dans un **PATCH** events = ignoré **en silence** (200, champ absent de la réponse) — la classe B5 (allDates/teamsId) ne rejetait jamais : elle perdait les données sans erreur. Un POST avec relation invalide (noms de teams) rejette lui en 400 (A1).

## Journal par ticket (rempli par les implémenteurs à l'amend)

### T1 — Snapshot migrations depuis la DB dev (06-10)

**Fait établi** : `pocketbase/pb_migrations/` = 1 seul fichier `1791277647_collections_snapshot.js` (généré par `./pocketbase migrate collections` depuis une **copie** de la dev DB — la vraie `pb_data` n'a jamais été ouverte en écriture). Snapshot = 21 collections (18 app + `users` + 4 system `_mfas`/`_otps`/`_externalAuths`/`_authOrigins` + `_superusers`) avec **toutes les règles** (inventaire complet : `/tmp/orchestrate/t1-snapshot-summary.txt`). `down()` = `return null` explicite (no-op assumé : baseline du chaînage, rien avant lui à restaurer ; l'état pré-snapshot reste reconstructible via git). Anciens fichiers retirés via `trash` — **74 fichiers, pas 40** (le chiffre « 40 » du ticket/dispatch/run header était une erreur de résumé ; 74 fichiers .js sur disque, 90 lignes `_migrations` en comptant les .go système et 9 lignes orphelines de fichiers déjà supprimés du disque).

**Vérifications empiriques** :
- Fresh DB (`--dir /tmp/orchestrate/pb-fresh-t1`) : `migrate up` → `Applied 1791277647_collections_snapshot.js`, sans erreur (log : `/tmp/orchestrate/t1-fresh-migrate-up.log`).
- Boot sur **copie byte-identique** de la dev DB (`--dir /tmp/orchestrate/pb_data-bootcheck-t1`, port 8091) : serve démarre, health 200, le snapshot s'applique en attente et s'enregistre dans `_migrations` (91 lignes = 90 + snapshot). C'est exactement ce qui se produira au prochain vrai boot dev.
- `pb_data` réelle : **strictement inchangée** (sha256 des 7 fichiers avant/après identiques — logs `/tmp/orchestrate/t1-pbdata-sha-{before,after}.txt`). Seule dérive : mtime de `data.db-shm` (02:06 → 10:44), touché par mes lectures `sqlite3 -readonly`, contenu identique.
- Canon client intact : `bun run check` = 0 erreur / 6 warnings (baseline) ; `bun run test` = 56/56 (logs `/tmp/orchestrate/t1-{check,test}-mig-26-10-06.log`).
- `scripts_dev/pb-dev.sh` non modifié ; sa cible (`serve --dir pb_data --migrationsDir pb_migrations`) pointe toujours sur les bons répertoires.

**Verdicts des 4 sondes curl (fresh DB, état pré-deltas — attendus tels quels, T3/T4 corrigent)** :

| Sonde | Commande | Attendu | Obtenu |
|---|---|---|---|
| ORD-1 mort | `curl -H "Authorization: <token>" /api/collections/products/records` | 200 | **200** |
| REC-2 public read | `curl /api/collections/recipes/records` (anonyme) | 200 | **200** (`{"items":[],"totalItems":0}`) |
| REC-1 ouvert (attendu) | `curl -H "Authorization: <token>" /api/collections/share_links/records` (user non-propriétaire) | 200 | **200** |
| LOCK-1 ouvert (attendu) | `POST /api/collections/locks/records` `{"id":"doc_test123456789","userId":"<uid>","expiresAt":"2026-10-07 00:00:00.000Z","collection":"recipes","recordId":"rec_test12345678"}` | 400 | **400** `validation_max_text_constraint` sur `id` : "Must be no more than 15 character(s)" — l'erreur porte bien sur l'id, pas sur un champ manquant |

User de test créé sur la fresh DB (users `createRule` = public) : `POST /api/collections/users/records` puis `auth-with-password` → 200. Tous les process PB stoppés en fin de ticket.

**Décisions d'implémentation** :
- Snapshot généré depuis la **copie de backup** (`/tmp/orchestrate/pb_data-backup-t1`) plutôt que depuis `pb_data` : PB ouvre SQLite en read-write (risque de WAL/checkpoint) ; la copie est byte-identique, le résultat est identique, et la dev DB reste vierge.
- Boot-check dev fait sur copie (`pb_data-bootcheck-t1`) : `bun run dev:pb` sur la vraie DB aurait **écrit** le snapshot dans `_migrations` (serve applique les migrations en attente au boot) — contradiction avec la contrainte « ne rien écrire dans pb_data ». Script inchangé + chaîne prouvée bootable sur l'état dev exact = vérification équivalente sans écriture.

**Pièges découverts** :
- `./pocketbase migrate collections` demande une confirmation y/N interactive — piper `echo y` en non-interactif, sinon « command has been cancelled ».
- PB 0.37.5 résout `pb_migrations`/`pb_hooks` **relativement au parent du `--dir`** quand ils ne sont pas passés explicitement (avec `--dir /tmp/.../pb_data-backup-t1`, il proposait `/tmp/orchestrate/pb_migrations/`). Toujours passer `--migrationsDir`/`--hooksDir` absolus dès que `--dir` n'est pas le layout par défaut.
- Au prochain boot d'une DB existante (dev ou prod), le snapshot s'applique comme migration en attente (no-op de contenu, +1 ligne `_migrations`) ; les 83 lignes des anciens fichiers (74 présents + 9 orphelines) y restent, inoffensives — `./pocketbase migrate history-sync` les purge si voulu (à considérer en T2+/déploiement).
- La lecture `sqlite3 -readonly` touche le mtime de `data.db-shm` — un contrôle d'intégrité par mtime seul donnerait un faux positif ; utiliser les checksums.

### T2 — Autodates `created`/`updated` sur ingredients + categories (06-10)

**Fait établi** : nouvelle migration `1791278400_autodates_ingredients_categories.js` (> snapshot, trie après `1791277647_`). `up()` : ajout des autodates canoniques aux 2 collections via `collection.fields.add(new AutodateField({...}))` + `app.save()` — `created` (onCreate:true, onUpdate:false, id `autodate2990389176`) et `updated` (onCreate:true, onUpdate:true, id `autodate3332085495`), ids identiques à toutes les autres collections. Puis backfill SQL : `app.db().newQuery("UPDATE <table> SET created = {:d}, updated = {:d} WHERE created = '' OR created IS NULL").bind({d: ...}).execute()` — named params + `.bind()` fonctionnent en JSVM 0.37.5. `down()` fonctionnel : retrait des 2 champs (drop columns) + save.

**Choix de backfill (documenté)** : date fixe `2026-10-06 00:00:00.000Z` (jour de migration, 00:00 UTC). Aucune row n'a de date antérieure (autodates inexistantes avant) ; la valeur est déterministe dev/prod, antérieure à toute écriture future. Le curseur client `max(updated)` repart de la valeur backfillée → toutes les rows franchissent le filtre delta, et les updates ultérieurs (autodate `onUpdate`) sont strictement supérieurs.

**Application** (backup préalable `/tmp/orchestrate/pb_data-backup-t2/`, sha256 `data.db` vérifié identique) :
1. Bootcheck sur copie (`cp -a` du backup → `/tmp/orchestrate/pb_data-bootcheck-t2`) : `./pocketbase/pocketbase migrate up --dir /tmp/orchestrate/pb_data-bootcheck-t2 --migrationsDir <abs>` → « Applied 1791277647_collections_snapshot.js » + « Applied 1791278400_autodates_ingredients_categories.js » (log `/tmp/orchestrate/t2-bootcheck-migrate-up.log`), puis serve port 8091 + sondes vertes. Le copie-test reproduit exactement le premier boot dev (snapshot pending + delta pending).
2. Vraie DB dev : `cd pocketbase && ./pocketbase migrate up` (layout par défaut : `--dir`/`--migrationsDir` par défaut corrects, le piège T1 des chemins absolus ne s'applique pas) → mêmes 2 lignes « Applied » (log `/tmp/orchestrate/t2-dev-migrate-up.log`). `_migrations` : **92 lignes** = 90 historiques (dont 9 orphelines) + snapshot + delta.

**Verdicts des sondes curl** (dev, port 8090, boot `scripts_dev/pb-dev.sh` nohup) :

| Sonde | Commande | Obtenu |
|---|---|---|
| health | `curl -s http://127.0.0.1:8090/api/health` | **200** |
| autodates peuplées | `curl -s 'http://127.0.0.1:8090/api/collections/ingredients/records?perPage=2'` | **200** — `created`/`updated` = `"2026-10-06 00:00:00.000Z"` sur toutes les rows, `totalItems: 845` |
| delta ingredients | `curl -sG 'http://127.0.0.1:8090/api/collections/ingredients/records' --data-urlencode 'perPage=1' --data-urlencode "filter=updated > '2000-01-01'"` | **totalItems 845/845** (toutes les rows franchissent le filtre delta) |
| delta categories | idem sur `categories` | **totalItems 60/60** |

Contrôle SQL direct (`sqlite3 -readonly pocketbase/pb_data/data.db`) : ingredients **845/845** backfilled, categories **60/60**, **0** row vide (`created = '' OR created IS NULL OR updated = '' OR updated IS NULL`). Mêmes chiffres sur la copie bootcheck. Schema : colonnes ajoutées en `"created" TEXT DEFAULT '' NOT NULL` (idem `updated`).

**Typegen** : `cd svelte-app && bun run generate-types` → diff `pb-generated.ts` = **+4 lignes uniquement** : `created: IsoAutoDateString` / `updated: IsoAutoDateString` ajoutés à `CategoriesRecord` et `IngredientsRecord`. Cohérent avec l'attendu.

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = 56/56 verts (logs `/tmp/orchestrate/t2-{check,test}-mig-26-10-06.log`). Tous les process PB stoppés en fin de ticket (ports 8090/8091 libres).

**Note WIP fence** : le commit T2 inclut le header « état du monde post-T1 » de run.md (édition orchestrateur présente non commitée à l'arrivée, anodine) — commit whole-file d'un fichier que le ticket devait de toute façon amender, conformément au RUN-CONTRACT.

**Pièges T2** :
- Une colonne fraîchement ajoutée par PB est `DEFAULT '' NOT NULL` (texte) : les rows existantes portent `''`, pas NULL — un backfill doit cibler les deux (`WHERE col = '' OR col IS NULL`). Utile pour T3 (mêmes deltas backfill).
- Colonne de `_migrations` = `file` (pas `filename`).
- `migrate up` ne demande pas de confirmation (contrairement à `migrate collections`, piège T1).

### T3 — Deltas schéma : locks (id relax + userName), teams (5 champs), share_links.createdBy, events (description, minContrib) (06-10)

**Fait établi** : 4 migrations delta par thème (timestamps 1791278600-03, > delta T2) :
- `1791278600_locks_id_relax_username.js` — id locks `text3208210256` : max 15→40, pattern `^[a-z0-9]+$`→`^[a-z0-9_-]+$` (miroir exact du précédent recipes `1777813747`, même field id) + champ texte `userName` (down : restauration symétrique).
- `1791278601_teams_fields.js` — `createdBy` (relation users maxSelect 1), `roles` (json), `description`/`city` (text), `isPublic` (bool) ; typage miroir de `1700000001` (consulté dans l'historique git).
- `1791278602_share_links_createdby_backfill.js` — `createdBy` (relation users maxSelect 1) + backfill SQL.
- `1791278603_events_description_mincontrib.js` — `description` (text), `minContrib` (number, onlyInt false).

**Décisions de backfill (arbitrage enveloppe)** :
- `share_links.createdBy` ← `events.createdBy` du target (`target_id` + `link_type="event"`) uniquement quand résolvable ; garde `EXISTS (... AND e.createdBy != '')` pour ne jamais écrire une valeur vide. Colonne fraîche = `DEFAULT '' NOT NULL` → `WHERE createdBy = '' OR createdBy IS NULL` (piège T2). Résultat dev : **3/3 liens backfillés**, 0 non résolu (prévisible : les 10 events portaient tous un createdBy non vide ; vérification SQL `sqlite3 -readonly` avant/après, cf. logs `t3-pbdata-sha.txt`, probes json).
- `teams.createdBy` : **pas de backfill** (heuristique invérifiable — le créateur n'est pas dérivable de `members` sur les teams existantes). Les 6 teams dev portent `createdBy = ''` ; les rules T4 devront porter une clause grand-père (`createdBy = "" || ...`).
- `locks.userName` : pas de backfill (0 row locks en dev ; valeur d'affichage, `''` acceptable).

**Application** (backup préalable `/tmp/orchestrate/pb_data-backup-t3/`, sha256 `data.db` backup = dev vérifié identique `b5ebaa40…`) :
1. Bootcheck sur copie fraîche du backup (`pb_data-bootcheck-t3`) : `migrate up --dir <copie> --migrationsDir <abs> --hooksDir <abs>` → 4× « Applied » (log `/tmp/orchestrate/t3-bootcheck-migrate-up.log`) ; bootcheck serve 8091 + sondes vertes pré-validation.
2. Dev DB : `cd pocketbase && ./pocketbase migrate up` → mêmes 4 lignes (log `/tmp/orchestrate/t3-dev-migrate-up.log`). `_migrations` : **96 lignes** = 92 post-T2 + 4.

**Verdicts des sondes curl** (dev, port 8090, `pb-dev.sh` nohup, user de test créé puis auto-supprimé — register users public ; nettoyage vérifié SQL : counts initiaux restaurés) :

| Sonde | Commande | Obtenu |
|---|---|---|
| LOCK-1 | `POST locks` `{"id":"doc_test123456789","userName":"probe-t3",...}` puis DELETE | **200** / **204** |
| HOOK-7 (teams) | `POST teams` (roles/description/city/isPublic) puis `PATCH {"roles":{...},"description":"x"}` puis DELETE | **200** / **200** / **204** |
| B3 (share_links) | `POST share_links` avec `createdBy` | **200** (`createdBy` persisté) |
| A1/B5 (events) | `POST events` avec `description`/`minContrib` | **200** (valeurs persistées) |

Logs probes : `/tmp/orchestrate/t3-dev-probe-*.json`.

**Fast-win (défaut découvert par les sondes, fixé dans son propre commit)** : `pb_hooks/teams-resync-events.pb.js` appelait `team.originalCopy()` — **méthode supprimée des bindings JSVM PB 0.37.5** → TypeError sur CHAQUE update teams, enveloppé par PB en `400 "Failed to update record."` (data vide) alors que le save persiste (hook AfterSuccess : erreur propagée au client, écriture conservée). Symptôme piégeux : PATCH 400 + données modifiées. Fix : `originalCopy()` → `original()` (1 ligne, sémantique identique — « shallow copy populated with its ORIGINAL db data state » selon types.d.ts). Preuve : PATCH teams 400 avant / 200 après, log `--dev` `/tmp/orchestrate/t3-bootcheck-serve4.log` (trace `TypeError: Object has no member 'originalCopy'`). Impact client latent : toute édition d'équipe renvoyait 400 côté API (l'UI devait tolérer/enregistrer l'erreur) — le hook tournait-il en dev ? Oui, pb-dev.sh charge pb_hooks ; bug présent depuis l'introduction du hook (API 0.23-era) si aucune mise à jour d'équipe n'a été faite depuis.

**Typegen** : `bun run generate-types` → `pb-generated.ts` +11/-2 : `EventsRecord` +description/minContrib, `LocksRecord` +userName, `ShareLinksRecord` +createdBy (RecordIdString), `TeamsRecord` devient générique `<Troles = unknown>` + 5 champs, `TeamsResponse` suit. Canon intact malgré le generic (défaut de type param).

**Écarts `pb.d.ts` vs schéma (à traiter en T5/T6, non édités ici)** :
- `Kteams`/`Teams` : `{name, members}` — manque createdBy/roles/description/city/isPublic.
- `Locks` : manque `userName`.
- `Main`/`Events` : manque `description`/`minContrib`/`guestUsers` ; porte toujours `joinToken` (type mort, connu audit).
- `ShareLinks` : déjà à jour (`createdBy` présent — le client était en avance sur la DB).

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = 56/56 verts (logs `/tmp/orchestrate/t3-{check,test}-mig-26-10-06.log`). Tous les process PB stoppés (ports 8090/8091 libres).

**Pièges T3** :
- Le constructeur JSVM est `JSONField`, **pas** `JsonField` (`ReferenceError` à l'apply — types.d.ts L541).
- `query.one()` SANS argument DynamicModel → **panic Go** (`dbx.(*Rows).one` nil dest, SIGSEGV) : pas de `.one()` nu en JSVM ; pour compter, passer par l'API core (`app.countRecords(...)`) ou vérifier hors migration (choix retenu : sqlite3 externe, journal ci-dessus).
- `Record.originalCopy()` n'existe plus en 0.37.5 → `Record.original()` (fast-win ci-dessus).
- Défauts SQL par type de colonne fraîche : TEXT/BOOLEAN = `''`/`FALSE` NOT NULL (piège T2 confirmé), **JSON = NULL nullable** (`roles` : `PRAGMA table_info` → notnull 0, dflt NULL) — un backfill JSON devra cibler NULL et non `''`.
- Pattern diagnostic serveurs PB : le PID affiché par `nohup … &` est celui du shell wrapper, pas de PB ; un 2e boot sur le même port échoue en silence dans le log (bind error) et l'ANCIEN serveur continue de répondre — vérifier `pgrep -af 'pocketbase serve'` et le log de boot avant toute conclusion A/B.

### T4 — Rules API : REC-3, REC-1, EVENT-1, REC-4/SEC-1, REC-5, REC-7, REC-9, SEC-2, REC-6 (06-10)

**Fait établi** : 1 migration rules unique `1791278800_rules_api_hardening.js` (> delta T3) touchant 9 collections :

| Rule | Avant | Après |
|---|---|---|
| recipes updateRule (REC-3) | `permissionWrite ?=` (cassé) | `permissionWrite ~ @request.auth.id` |
| share_links list/view/update/delete (REC-1) | auth seul | `createdBy = @request.auth.id` |
| share_links create (REC-1) | auth seul | `+ @request.body.createdBy = @request.auth.id` |
| events list/view (EVENT-1) | teams/guests | `+ \|\| createdBy = @request.auth.id` |
| teams deleteRule (REC-6) | `members ~` (tout membre) | `createdBy = @request.auth.id \|\| (createdBy = "" && members ~ @request.auth.id)` (grand-père) |
| notifications create (REC-5) | auth seul | `+ @request.body.userId = @request.auth.id` |
| materiel create (REC-7) | auth seul | `+ (teamId.members ~ auth \|\| ownerUser = auth)` |
| materiel_loan create (REC-9) | auth seul | `+ (responsibleId = auth \|\| ownerId.members ~ auth)` (arbitré) |
| locks create (SEC-2) | auth seul | `+ @request.body.userId = @request.auth.id` |

teamss updateRule **inchangé** (collaboration members — le risque réel est le cascade delete, couvert ci-dessus).

**No-op mesurés (pas dans la migration)** : events updateRule et les 5 collections enfants (products, purchases, event_materiel, event_todos, teamdocs) sont **déjà à la cible** REC-4/SEC-1 (`guestUsers ~`, sans `guestEmails ~` ni `joinToken` dans aucune règle) — le snapshot T1 reflétait la dev DB qui avait déjà les fix 042/043 ; le tableau du ticket décrivait l'état « fresh DB pré-T1 » de l'audit, périmé depuis la reconstruction de la chaîne. Sweep confirmé : 0 `joinToken`, 1 seul `guestEmails` (définition du champ, pas une règle), 1 seul `?=` (la ligne REC-3 fixée).

**Arbitrage REC-9 (documenté)** : le client (`CreateLoanModal.doSubmit`) n'envoie **jamais** `borrowerUser` ni `createdBy` ; il pose `responsibleId = globalState.userId`. La garde mire `responsibleId = auth` (flux réel) `\|\| ownerId.members ~ auth` (membre de l'équipe propriétaire, miroir du modèle acteur list/update). La règle littérale du ticket (`borrowerUser/createdBy`) aurait cassé `createLoan` (403 systématique).

**Compatibilité client vérifiée (grep, 0 modif)** : events `createEventWithTeams` envoie `createdBy` (L523-533) ✓ EVENT-1 matcheront ; `createShareLink` envoie `createdBy` ✓ REC-1 ; `acquireLock` envoie `userId = globalState.userId` ✓ SEC-2 ; `createMateriel` envoie toujours `ownerUser = globalState.userId` ✓ REC-7 ; notifications jamais créées côté client (C3) ✓ REC-5 sans impact.

**Application** (backup préalable `/tmp/orchestrate/pb_data-backup-t4/`, sha256 `data.db` = `4144bb03…` ; checkpoint COORDINATION avant 1re édition — aucune claim, arbre conforme) :
1. Bootcheck sur copie (`pb_data-bootcheck-t4`) : `migrate up` → « Applied 1791278800_rules_api_hardening.js » (seule migration en attente — `_migrations` dev porte déjà T1-T3) ; bootcheck serve 8091 + matrice complète verte pré-validation.
2. Dev DB : `cd pocketbase && ./pocketbase migrate up` → même ligne (log `/tmp/orchestrate/t4-dev-migrate-up.log`). `_migrations` : **97 lignes** = 96 post-T3 + 1.

**Matrice curl pos/neg** (52/52 OK sur copie bootcheck PUIS sur dev 8090 — 2 users minimum requis : 3 users de test `t4-alice/bob/carol@test.local`, register public, auto-supprimés en fin de run ; sonde `.scratch/probes/t4-rules-matrix.py`, log complet `/tmp/orchestrate/t4-matrix-8090.log`, chaque sonde = 1 curl littéral journalisé) :

| # | Sonde | Verdict dev |
|---|---|---|
| P1-P5 | REC-1 : bob list → seul son lien ; carol list → vide ; bob view lien d'alice → 404 ; bob create spoof createdBy=alice → 400 ; alice view → 200 | **OK** |
| P6-P8 | EVENT-1 : alice voit son event sans team (filter totalItems=1) ; carol list → 0 ; carol view → 404 | **OK** |
| P9-P11 | REC-3 : bob update via permissionWrite → 200 ; carol → 404 ; alice (owner) → 200 | **OK** |
| P12-P13 | REC-5 : alice notif chez bob → 400 (rejet règle, data `{}`) ; chez alice → 200 | **OK** |
| P14-P16 | REC-7 : carol materiel sur T_A hors team (ownerUser=alice) → 400 ; carol perso (ownerUser=self) → 200 ; alice materiel de T_A (membre, ownerUser vide) → 200 | **OK** |
| P17-P19 | REC-9 : carol loan (responsibleId=self) → 200 ; carol loan responsible=alice hors team → 400 ; bob loan (membre T_G) → 200 | **OK** |
| P20-P21 | SEC-2 : alice lock au nom de bob → 400 ; en son nom → 200 | **OK** |
| P22-P26 | REC-6 : bob delete T_B (membre non créateur) → 404 ; alice delete T_B → 204 ; carol delete T_G → 404 ; bob delete T_G (grand-père) → 204 ; alice delete T_A → 204 | **OK** |

Setup S1-S13 (register/auth ×3, teams T_A/T_B/T_G dont grand-père sans createdBy, event sans team, recette partagée, 2 share_links) et teardown T (11 deletes records + 3 users self-delete) : **tous OK**, comptes SQL post-run = baseline (teams 6, share_links 3, materiel 110, materiel_loan 2, locks 0, notifications 0, recipes 372, events 10, 0 résidu `t4-%`).

**Découvertes sonde (pièges)** :
- Le champ id `locks` garde **min: 15** (T3 avait relaxé max→40 + pattern, pas min) — les ids client `doc_`+15 / `event_`+15 (18/21 chars) passent, mais toute sonde < 15 chars est rejetée en validation AVANT l'évaluation de la règle.
- PB évalue la createRule **avant** la validation des champs : un rejet de règle = 400 `data: {}` (cf. P12/P20) ; une erreur de validation = 400 `data: {champ: …}` (cf. P21 du 1er run). Les deux formes distinguent le verdict.
- PB renvoie **404** (pas 403) sur view/delete bloqués par règle sur records existants (pas de leak d'existence) — l'attendu « 403/404 » du ticket se matérialise en 404.
- Piège sonde (run 1, corrigé) : un neg REC-7 avec `ownerUser = self` satisfaisait la clause 2 → 200 inattendu + record résidu sur la copie bootcheck (jetable, supprimée). Le vrai cas neg : ownerUser ≠ self ET hors team. Résiduel assumé : `ownerUser = self` + `teamId` d'une team dont on n'est pas membre passe la garde REC-7 (prescription littérale du ticket — pollution possible de l'inventaire d'une team par un tiers, mais list/view restent scopés).

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = 56/56 verts (logs `/tmp/orchestrate/t4-{check,test}-mig-26-10-06.log`). Typegen non requis (aucun changement de champs). Aucun fichier client modifié. Tous les process PB stoppés (ports 8090/8091 libres), copie bootcheck trashed.

### T5 — Client events : payloads conformes au schéma (A1, B5, C7, C1) (06-10)

**Fait établi** (11 fichiers modifiés + 1 test, 61/61 tests verts) :
- **A1** : `EventCreatePage.saveEventData` envoie `teams: selectedTeams` (**ids**, relation PB) ; `teamsId` supprimé du payload ; `allDates` supprimé (pas de champ — remplacé par le JSON `date`, ci-dessous) ; bloc `teamNames` (lookup noms pour affichage) retiré, mort.
- **B5** : `#serializeUpdateData` ne sérialise plus `allDates`/`teamsId` (grep vert : seuls restent des variables locales `allDatesValidation`/`allDatesSorted` — calculs meals, et le **prop** `allDates` d'`EventMealCard`, alimenté localement par les appelants — ni l'un ni l'autre champ du record). `EventsStore` : `#enrichEvent` (ligne teamsId), `inviteParticipants` (dédup ids seule, cast `as UpdateEventData` devenu inutile), `removeTeam` — plus aucun `teamsId`. Types `events.d.ts` : `EnrichedEvent`/`CreateEventData`/`UpdateEventData` purgés ; `dateStart`/`dateEnd` nullables.
- **JSON `date` = source de vérité des dates** : le pipeline d'import écrit déjà `date: awEvent.allDates` (2-transform-data.ts L470-474) ; le client l'avait abandonné. Invariant rétabli **à l'écriture** : `#serializeUpdateData` et `createEventWithTeams` dérivent `date` des meals via `getEventDates()` (unique + trié) — tout update portant des meals resynchronise `date`, y compris les mutations granulaires addMeal/updateMeal/removeMeal. **À la lecture** : `getEventDates(event)` (events.utils.ts) lit le JSON `date` avec fallback meals (records antérieurs au fix, `date` vide) ; consommateurs convertis : `EventCard` (affichage plage), `ProductsStore` ×2 (`setAvailableDates`). Testé : 5 tests unitaires `__tests__/events-utils.test.ts` (mock toast.service, pattern productEnrichment.test.ts — la chaîne d'imports events.utils → safe-operation tire le service runes, non compilé par vitest).
- **C7** : `dateStart`/`dateEnd` vides → `null` (EventCreatePage + EventEditPage ; le store passe-through, PB normalise en `''`).
- **C1 (fast-win, commit dédié)** : `Main.joinToken` retiré de `pb.d.ts`. Dans le même type : alignement schéma post-T3 — `description`/`minContrib`/`guestUsers` ajoutés (écarts T3 « à traiter en T5/T6 » ; l'UI lit déjà `event.minContrib` (EventCard) et `event.description` (inviteParticipants) — accès fantômes au typage, invisibles du canon natif).
- **C5** : non traité (différé produit — l'appel 3-arguments à `createEventWithTeams` reste, cf. deferred).

**Lecteurs `teamsId` convertis vers `teams` (ids)** — tous morts aujourd'hui (champ jamais existé en PB), corrects post-fix : `getUpcomingEventsForUser` (EventsStore L213-215), `ExternalEventsCard` ×2, `TeamDashboardCard` ×2 (fallback sur noms supprimé — `event.teams` ne porte plus de noms), `EventEditPage` `selectedTeams` (L190, derived + bloc mort L535-548 supprimés — `selectedTeams` n'alimentait que le bloc mort) + `contributorsToSave` mort retiré. Blocage des commentaires de saveEventData mis à jour (pas de teams/contributors à l'édition : concurrence).

**Verdicts des sondes curl** (dev 8090, `pb-dev.sh`, user `t5-probe@test.local` créé puis auto-supprimé) :

| # | Sonde (payload EXACT post-fix) | Obtenu |
|---|---|---|
| P1 | POST events : teams [id team], description, minContrib, date JSON, meals, createdBy, contributors, todos, status | **200** — tout persisté ; GET expand : `teams: ['n4kk85x0265h39f']` résout `t5-team-probe` ✓ |
| P2 | POST events : `dateStart: null, dateEnd: null, date: []` (C7, sans meals) | **200** — null accepté (PB renvoie `''`, normalisation vide) |
| P3 | PATCH events (payload serializer post-fix : description/minContrib/dateStart/dateEnd/meals→date dérivée, sans teams) | **200** — `teams` intact, tout persisté |
| P4 | PATCH avec `allDates`/`teamsId` (payload PRÉ-fix) | **200 mais champs ignorés en silence** (absents de la réponse) — mesure : B5 ne rejetait jamais, ça perdait silencieusement (cf. pièges) |
| P5 | GET anonyme du record | **404** (EVENT-1 viewRule, pas de leak — cohérent T4 ; 1er run de sonde sans Authorization, corrigé) |
| P6 | PATCH inviteParticipants post-fix (contributors + guestEmails + teams ids en 1 appel) | **200** |

Logs : `/tmp/orchestrate/t5-probe-{user,auth,team,create1,create2,patch,ghost,expand,invite}.json`, serve `/tmp/orchestrate/t5-pb-serve.log`. Teardown : 2 events + team + user supprimés (204×4) ; SQL readonly post-run : events **10**, teams **6**, users **32**, **0 résidu `t5-%`** (events/teams/users). PB stoppé, ports libres.

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = **61/61** (56 + 5 nouveaux, logs `/tmp/orchestrate/t5-{check,test}-mig-26-10-06.log`). Mesure type réelle : `check-legacy` = 193 erreurs **préexistantes**/50 fichiers — vérifiées hunk par hunk : **0 dans mes hunks** (elles portent sur casts `as unknown as`, `parseEventMeals(main.meals)` sur `unknown`, l'appel 3-args C5 — code verbatim antérieur ; logs `/tmp/orchestrate/t5-check-legacy-mig-26-10-06.log`).

**Pièges T5** :
- `svelte-check-native` ne typecheck pas (voir Pièges, ligne dédiée).
- Un test vitest important `events.utils` doit mocker `$lib/services/toast.service.svelte` (chaîne safe-operation → runes) — pattern existant `productEnrichment.test.ts`.
- GET sans auth sur un record scopé = 404 (pas 401) — toujours authentifier les sondes de lecture.

**Observations reportées (hors périmètre T5, pour T6+/produit)** :
- `PermissionsManager.svelte` suppose que `event.teams` porte des **noms** (lookup nom→id L63-75, dédup `includes(team.name)` L179/255, badges affichant la valeur brute L370/590, filtre dispo L611) — mismatch préexistant depuis l'import (ids en DB) ; l'affichage EventCard `event.teams.join(", ")` montre déjà des ids pour les events importés. Résolution ids→noms à l'affichage = polish produit.
- `types/appwrite.d.ts` (Main legacy avec allDates/teamsId) : référencé uniquement pour `Purchases` (GlobalPurchasesModal) — fichier à retirer en Phase 2.
- `types/store.types.ts` `MainEventData` (champ allDates) : type mort, 0 référence.
- `EventShareLinks.svelte` itère `event.shareLinks` — champ inexistant au schéma (T7 ?).

## Constats différés (deferred — tag `!` bientôt / `S2` gating déploiement / `?` conditionnel)

- **S2** : secret share_links ≠ id (token dédié) — refonte URL/invitations. (décision enveloppe, voir ci-dessus)
- **?** : HOOK-6 — invité sans compte jamais rattaché à la team après inscription (refonte flux invitation, décision produit).
- **?** : C3 — collections mortes `event_todos` / `notifications` (trancher migrer vs supprimer — produit).
- **?** : C5 — 3e argument `sendEmailToExistingMembers` de `createEventWithTeams` ignoré (implémenter ou retirer l'option UI — produit).
- `!` côté SITE (pas ici) : régression `isDynamic` perdue par revert `88de525a` — à corriger upstream enka-next, NE PAS porter.
- Images recettes (20 valeurs `img` frontmatter, og:image déjà cassées côté Hugo) — décision produit Phase 2.
