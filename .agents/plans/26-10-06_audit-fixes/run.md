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
- **HEAD après T9** : `deb9ba57` (send-emails ownership + réconciliation serveur ; client lookup migré ; 18/18 sondes). **Frontier : T10.**
- **Fait T9** : sans host SMTP configuré, PB fallback sendmail (absent) → échec par destinataire capturé (`ok:false`), 200 propre — les 2 branches documentées dans le hook. `EventShareLinks.svelte` déjà conforme (note T5 obsolète). Note déploiement : `ENKA_BASE_URL` obligatoire en prod (différé S2 loggé).
- **Piège JSVM majeur (T8)** : `record.get()` sur champ JSON = export goja du `[]byte` brut — muter corrompt la donnée ; utiliser `getString()` + `JSON.parse`. Bug latent restant : `invite-to-team.pb.js` (`roles`) → intégré à T10.
- **Différé `!` ajouté (T8)** : invite-to-team roles JSON (cf. ci-dessus) — T10.
- **Canon check-legacy mis à jour : baseline 192 erreurs** (T6 a corrigé RecipesStore:633:48 au passage ; exigence inchangée : 0 nouvelle erreur). Canon test : 61/61.
- **Différé `!` ajouté (T6)** : teamdoc team-scopé bloqué par createRule (exige eventId) → à traiter en T11 (rule `teamId.members ~ auth || eventId.…`).
- **Canon tests mis à jour : `bun run test` = 61/61** (3 fichiers utils + 1 fichier events). **Canon check affiné (découverte T5)** : `bun run check` (svelte-check-native) ne fait PAS de TS — ne capte que svelte compiler/a11y (0 err/6 warn) ; l'audit de types réel = `bun run check-legacy` = 193 erreurs préexistantes → **surveiller le delta** (aucune nouvelle erreur dans les hunks de ticket).
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
- PB renvoie les dates `YYYY-MM-DD HH:mm:ss.SSSZ` (espace, pas de `T`) — ne jamais `split("T")` sur une date PB ; lecture = `toInputDate()` (`date-helpers.ts`, extraction lexicale null-safe, T7).
- Relations PB : valider **ids** (pas noms) ; champs inconnus du body = rejet ou perte silencieuse.
- `pb-collection.ts` : pas de curseur persisté — `since = max(updated)` de toute la table (bug scopé, port Étape 3).
- JSVM : ES5 limité ; `console.log` incertain → `$app.logger()` ; `$os.getenv` pour l'env.
- Nouvelle colonne PB = `DEFAULT '' NOT NULL` (rows existantes = `''`, pas NULL) : backfill → `WHERE col = '' OR col IS NULL` (détails journal T2).
- **`bun run check` (svelte-check-native 0.7.2) ne fait PAS de diagnostics TypeScript** (mesuré T5 : erreur de type délibérée dans un `.svelte` ET un `.svelte.ts` = 0 erreur rapportée ; il ne voit que a11y/runes/compil). Le vrai audit type = `bun run check-legacy` (svelte-check) — **193 erreurs préexistantes** sur 50 fichiers (dette invisible au canon natif) : raisonner par diff par fichier, pas par « 0 erreur ». Durable : `svelte-app/CLAUDE.md` § Development Commands.
- Champ PB inconnu dans un **PATCH** events = ignoré **en silence** (200, champ absent de la réponse) — la classe B5 (allDates/teamsId) ne rejetait jamais : elle perdait les données sans erreur. Un POST avec relation invalide (noms de teams) rejette lui en 400 (A1). Confirmé T6 côté POST : les champs inconnus **non-relation** (`manuallyAddedVariants`…) sont ignorés en silence à la création aussi.
- **Schéma `materiel_loan` (correction audit §2, mesuré T6)** : `ownerId` est une relation → **teams** (pas users) — `responsibleId`/`borrowerUser`/`createdBy` → users. Le payload createLoan passe `ownerId = id d'équipe` (celle du matériel emprunté) ; un id user dans `ownerId` = 400 `validation_missing_rel_records`.
- **JSVM : `record.get()` sur un champ JSON renvoie l'export goja du `[]byte` brut** (T8, mesuré) — `[]byte("[]")` devient `[91, 93]` (codes ASCII de `[`/`]`), et muter CE wrapper (`concat`/`push` + `set`) corrompt la donnée stockée (`[91,93,"email"]`) ou rejette en `validation_invalid_json` (array mixte). Lire via `getString()` (texte JSON) + `JSON.parse` → objets JS purs, muter, `set()`. Les champs **relation** (ex. `guestUsers`) sont sains (`[]any` de strings). Piège actif dans `invite-to-team.pb.js` (`team.get("roles")` + mutation + `set`) — non corrigé, hors périmètre T8 (voir journal T8).
- **JSVM : PB hot-reloade `pb_hooks` au changement de fichier** (« File … changed, restarting… » dans le log serveur) — itérer sur un hook sans restart, port 8090 reste servi.
- **Logs PB 0.37** : `$app.logger()` n'imprime pas en console au niveau info/warn par défaut — les lignes vont dans la table `_logs` de **`auxiliary.db`** (pas `data.db`) ; vérification par `sqlite3 -readonly pocketbase/pb_data/auxiliary.db "SELECT … FROM _logs …"`.
- **Tokens JWT dans les sondes curl** : un copier-coller manuel d'un token de 150+ chars = 401 fantôme quasi indétectable (T8, 1er run P1) — passer par la sonde python (pattern T4) qui garde les tokens en variables, jamais à la main.
- **PB 0.37.5 purge nativement les références de relation pendantes au delete du parent** (single → `''`, multi → id retiré ; T10, mesuré) : les cascades `onRecordAfterDeleteSuccess` basées sur filtres relation sont des no-ops (relations déjà nettoyées), les enfants à relation **required** rendent le parent in-suppimable (400 « required reference ») avant tout hook — les cascades doivent être des hooks BEFORE (`onRecordDelete`) si elles veulent voir/matchter les enfants. Les hooks T10 (events/teams) sont des before-hooks fail-closed. L'affirmation audit « events.teams garde des ids pendants » est fausse sur 0.37.5 (purge native) ; le bloc explicite reste pour le bump `updated` (delta sync).
- `_logs.created` (auxiliary.db) = **UTC avec `Z`** (`strftime('%Y-%m-%d %H:%M:%fZ')`) — un filtre `created >= '<heure locale>'` sans Z renvoie 0 ligne silencieusement (T10) ; filtrer en UTC ou par `rowid`.
- PB sans host SMTP : `settings.meta.senderAddress` a un défaut non vide en dev (le guard « SMTP non configure » du mailer ne throw pas) et `newMailClient().send()` bascule sur le binaire **sendmail** (absent en conteneur) → erreur par email, capturée (`ok:false`, « failed to locate a sendmail executable path ») — T9, mesuré. En prod : host SMTP configuré ; définir aussi `ENKA_BASE_URL` (fallback bruyant, cf. T9/différés).

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

### T6 — Client créations : payloads conformes (A2 recette-id, C4, B6, A3, C9, B4) (06-10)

**Fait établi** (6 fichiers client édités, 1 fichier util supprimé, zéro migration) :
- **A2** : `RecipeCreatePage.save()` ne pose plus `recipe.id = generateSlugUuid35(...)` (bloc + import retirés) ; `RecipesStore.createRecipe` strippe l'id du payload (`const { id: _formId, ...dataWithoutId }`) — nécessaire car `pb-collection.create()` passe l'id tel quel à PB (`stripSystemFields(data, keepId=true)`) et le placeholder `"new-recipe"` du formulaire aurait été rejeté (pattern 15 alphanum). `slugUtils.ts` supprimé (orphelin après fix ; l'import de `RecipeEditPage.ts` était déjà orphelin préexistant ; pas de fichier de test) ; `nanoid` reste utilisé par 8+ autres fichiers (dépendance conservée). Grep vert : 0 `generateSlugUuid35` / `slugUtils` / `recipe.id =`.
- **C4** : fallback `createRecipe` → `status: data.status || "private"` ("active" ∉ enum public/private/deleted — typegen `RecipesStatusOptions`).
- **B6** : `publishedAt: null` retiré de `normalizeRecipeForSave` (RecipeEditPage.ts) — le payload d'update ne touche plus au champ, la date de publication est préservée. **Le flux publish n'existe pas côté client** : grep `publishedAt`/`publish` = seuls `createDefaultRecipe` (null, correct à la création), le normalize (retiré) et les types. La date n'est posée par personne (import pipeline / futur serveur) ; le fix empêche au moins son effacement à chaque save.
- **A3** : `ProductsStore.createProduct` → `updatedBy: globalState.userId` (relation users ; le nom d'utilisateur = 400 relation invalide).
- **C9** : `MaterielStore.createLoan` → `+ borrowerUser: globalState.userId` (l'emprunteur voit son loan via `listRule: borrowerUser = auth || …`).
- **B4** : `TeamdocsStore.createDocument` → `createdBy` retiré du payload (champ volontairement absent du schéma, drop 1700000029).
- **C12** : PAS de fix (NativeTeamsStore intact, conforme dispatch).

**Verdicts des sondes curl** (dev 8090, `pb-dev.sh` nohup, user `t6-probe@test.local` créé puis auto-supprimé, team + event de setup supprimés ; payloads EXACTS post-fix, champs formulaire fantômes inclus volontairement) :

| # | Sonde | Obtenu |
|---|---|---|
| P1 | POST recipes SANS id, status `"private"`, + `manuallyAddedVariants`/`variantsToRemove` (fuite réelle du formulaire) | **200** — id PB généré `lxbpvprbrbb55o0` (15 alphanum), status private persisté, champs inconnus ignorés en silence |
| P2 | POST products (eventId d'un event lié à ma team) avec `updatedBy = uid` | **200** — `updatedBy` persisté = uid (relation users résolue) |
| P3 | POST materiel_loan avec `borrowerUser = uid`, `responsibleId = uid`, `ownerId = teamId` | **200** — borrowerUser persisté, expand users ✓, lecture OK via listRule `borrowerUser = auth` |
| P3-pré | POST materiel_loan avec `ownerId = uid` (audit §2 disait relation users) | **400** `validation_missing_rel_records` sur ownerId — **`ownerId` est une relation → teams**, pas users (correction de l'audit, voir Pièges) |
| P4 | POST teamdocs event-scopé (`createEventDocument` : eventId + status doc, sans createdBy) | **200** — createdBy absent du schéma ✓ |
| P4b | POST teamdocs team-scopé (`createDocument` : teamId, sans eventId, champs fantômes tags/isPublic/teamName inclus) | **400 `data:{}`** = rejet **règle** : `teamdocs.createRule = eventId.teams.members ~ auth ‖ eventId.guestUsers ~ auth` — impossible sans eventId |
| P5 | GET loan `?expand=borrowerUser,responsibleId` | **200** — relations résolues vers le user de sonde |

Logs : `/tmp/orchestrate/t6-probe-*.json`, serve `/tmp/orchestrate/t6-pb-serve.log`. Teardown : recipe/product/teamdoc/event/team/user supprimés API (**204×6**) ; loan détruit en SQL ciblé après arrêt PB (son `deleteRule = createdBy = auth` est infranchissable sans createdBy — le client n'en envoie pas, cf. constats). SQL readonly post-run : recipes **372**, events **10**, teams **6**, users **32**, materiel_loan **2**, **0 résidu des 7 ids de sonde** (vérif id par id).

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = **61/61** ; `check-legacy` = **192 erreurs vs 193 baseline** — la disparition est `RecipesStore.svelte.ts:633:48` (cast `Omit<…, "id"…>` corrigé par la réécriture de createRecipe) ; les autres entrées de mes fichiers = décalages de ligne purs (diff hunk par hunk vs log T5 ; logs `/tmp/orchestrate/t6-{check,test,check-legacy}-mig-26-10-06.log`).

**Note WIP fence** : le commit docs inclut l'édition orchestrateur du header run.md (portail post-T5, présente non commitée à l'arrivée, anodine) — commit whole-file d'un fichier que le ticket devait de toute façon amender, conformément au RUN-CONTRACT (pattern T2).

**Pièges T6** :
- `materiel_loan.ownerId` est une relation → **teams** (l'audit §2 et le ticket disaient users) — cohérent avec la règle REC-9 `ownerId.members ~ auth` (« équipe propriétaire »). Correction portée en section Pièges globale.
- **teamdocs.createRule exige un eventId** (`eventId.teams.members ~ ‖ eventId.guestUsers ~`) : le flux `createDocument` (doc d'équipe via `CreateDocumentPage`, teamId sans eventId) est **bloqué par la règle, indépendamment de B4** — B4 reste correct (cesser d'envoyer un champ fantôme) mais le flux ne passera qu'après un delta de règle backend (ex. `‖ teamId.members ~ @request.auth.id`).
- `materiel_loan.deleteRule = createdBy = auth` : les loans créés sans createdBy (comportement du client) sont **indestructibles via l'API** par leur créateur — besoin SQL ou d'un fix client futur (setter createdBy).
- `normalizeRecipeForSave` n'est appelé que par `RecipeEditPage.save()` — `RecipeCreatePage` envoie l'état du formulaire **brut** (`as any`) : les champs hors schéma (`manuallyAddedVariants`…) fuient dans le POST mais PB les ignore en silence (mesuré P1).

**Observations reportées (hors périmètre T6)** :
- `CreateDocumentPage` envoie encore `tags`/`isPublic`/`teamName` (3 champs fantômes teamdocs, en plus du createdBy retiré ici) — silencieusement perdus (excess-property error legacy préexistante L151) ; UI à aligner quand le flux doc d'équipe sera débloqué.
- `ProductsStore.createProduct` : `const productId = crypto.randomUUID()` mort (jamais envoyé) — préexistant, laissé tel quel.
- Mode duplication recette : `transformStoreDataToForm` hérite du `publishedAt` de la source → le duplicata hérite de la date de publication (discutable, préexistant).
- `RecipePermissionsManager` fait `users.getList(filter email=…)` (B9 audit, rules restrictives) — inchangé, hors périmètre.

### T7 — Client : lecture des dates PB (helper partagé, B7, B8, C8) (06-10)

**Fait établi** (3 fichiers modifiés, 2 tests nouveaux, commit `0d348592`) :
- **Helper** : `toInputDate(value: string | null | undefined): string` dans `date-helpers.ts` — extraction lexicale `/^\d{4}-\d{2}-\d{2}/` (couvre PB espace et ISO `T` en un motif ; `new Date()` écarté : la conversion UTC décalerait les dates proches de minuit). `extractDate` délègue désormais à `toInputDate` — l'helper préexistant partageait la classe de bug `split("T")` (innocenté en prod : alimenté uniquement par des dates repas JSON client, cas OK §5) ; un seul exemplaire de la logique, appelants inchangés. `extractTime` laissé tel quel (datetime repas, cas OK §5).
- **B7** : `CreateLoanModal` — préremplissage édition `startDate/endDate = toInputDate(loan.startDate/endDate)` (ex L264-265) ; garde de date fin : comparaison sur les deux côtés normalisés `toInputDate(startDate) > toInputDate(event.dateEnd)` (ex L428).
- **B8** : `PurchaseManager.startEdit` — `forms.purchase.orderDate/deliveryDate = toInputDate(...) || null` : la **source** est corrigée, pas le symptôme. `StatusSelect` inchangé (binding dumb `input[type=date]`, aucune donnée à normaliser chez lui ; l'autre consommateur `GroupPurchaseModal` initialise à `null`).
- **C8 : constat déjà conforme — mesuré, aucune modif** : `ProductCard`/`ProductCardCompact` affichent `purchasesBadges` = sortie de `formatPurchasesWithBadges`, qui formate `deliveryDate` via `formatDateShort` (fr-FR) **depuis le 2026-02-04** (blame `6aa86897`) — l'audit n'a pas remonté la chaîne. Preuve par test : `__tests__/products-display.test.ts` (mock `@lucide/svelte`, non compilable par vitest) — `deliveryDate` exposé formaté, jamais au brut PB.

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = **69/69** (61 + 6 `date-helpers` + 2 `products-display`) — **NOUVEAU CANON** (logs `/tmp/orchestrate/t7-{check,test}-mig-26-10-06.log`). `check-legacy` = **190 vs 192 baseline** : les 2 disparues = `CreateLoanModal` « loan.startDate/endDate possibly null » (ex L264-265), corrigées par la signature nullable de `toInputDate` (effet du design, pas un fix séparé) ; les 3 erreurs restantes de mes fichiers = préexistantes, décalées de +1 par l'import (140→141, 254→255, 73→74 — diff hunk par hunk vs log T6 ; log `/tmp/orchestrate/t7-check-legacy-mig-26-10-06.log`).

**Décisions/écarts** :
- Critère « 5 sites remplacés » : 3 sites réellement fautifs remplacés (B7 ×2 blocs, B8 ×1 source) ; C8 ×2 déjà conformes (mesure ci-dessus). Grep vert final : les 9 `split("T")` restants sont tous des cas OK §5 (`toISOString()` générés client, JSON repas/todos écrits côté navigateur, `extractTime` repas).
- Contrainte respectée : 0 ligne touchée dans db-sync ; `created`/`updated` jamais normalisés.
- Aucune sonde curl (aucun changement backend) — validation = typecheck + tests + grep + blame.

**Note WIP fence** : le commit docs inclut l'édition orchestrateur du header run.md (portail post-T6, présente non commitée à l'arrivée, anodine) — commit whole-file d'un fichier que le ticket devait de toute façon amender, conformément au RUN-CONTRACT (pattern T2/T6).

### T8 — Hooks : join-event complet (HOOK-1, HOOK-2, SEC-3) + route lookup-user (prérequis UI-1) (06-10)

**Fait établi** (2 fichiers hooks + 2 fichiers client, 3 commits `5dc4e14b`/`58596e04`/docs) :
- **join-event.pb.js durci** : (1) HOOK-1 — ajout d'une entrée contributor réelle `{id: userId, email, name, status: "accepted"}` ; **dédoublonnage par email** : une entrée existante de même email (id nanoid posé par `inviteParticipants`) est **rattachée au vrai userId**, son `status` n'est PAS écrasé (le RSVP client reste maître d'une invitation en attente : le bandeau `EventInvitationAlert` reste affiché jusqu'à acceptation explicite) ; `name` enrichi si absent. (2) HOOK-2 — vérifs dans l'ordre : `link_type === "event"`, `isActive`, `expiresAt` (si posé ; fail-closed si date illisible ; `replace(" ", "T")` avant `new Date()` — format PB espace, parse ES5), `maxUses`/`useCount` (0 = illimité ; refus si `useCount >= maxUses`), statut de l'event **whitelist fail-closed** : joignable uniquement `proposition`/`confirmed` (refus `archive`/`locked`/`canceled` et toute valeur inconnue). (3) `useCount` **incrémenté uniquement au premier join** — re-join idempotent (`guestUsers` déjà peuplé) ne consomme pas de use ; les refus n'incrémentent pas (P7b). (4) SEC-3 — `console.log` remplacé par `$app.logger()` partout ; chaque refus loggé en warn (`Join refused: <raison>` + linkId/userId) ; read-modify-save sans verrou **assumé et documenté** (commentaire header : deux joins concurrents peuvent déborder maxUses d'une unité) — pas de transaction JSVM exotique.
- **lookup-user.pb.js (nouveau)** : `GET /api/enka/lookup-user` — auth requise (`$apis.requireAuth()` + check `e.auth`), query `email`, **match exact** (`findFirstRecordByFilter("users", "email = {:email}")`, pas de LIKE — leçon SEC-1), normalisation trim+lowercase ; renvoie `{id, name}` ou 404 (inconnu) / 400 (email manquant) / 401 (sans auth). Énumération d'emails par un authentifié : **acceptée et notée** dans le docstring (app collaborative). T9 consommera ; `invite-to-team` garde son lookup interne (non modifié).
- **Client — décision `inviteParticipants` documentée et appliquée** : les emails sont résolus via `/api/enka/lookup-user` (**nouveau service `pb-users.ts`** : `lookupUserByEmail` — null sur 404, throw sur autre erreur — et `lookupUsersByEmails` batch Promise.all → Map) ; un compte connu reçoit son **vrai userId** dans contributors (bandeau RSVP + `getContributorStatus` fonctionnels immédiatement), fallback **nanoid silencieux** pour les inconnus et sur toute erreur unitaire (réseau/5xx) — l'invitation n'est jamais bloquée. Cohérent avec le dédoublonnage serveur : un nanoid sera rattaché au premier join. Coût : N GET parallèles par invitation (lot typique < 10). Le set mort `existingIds` est retiré au passage (dans le hunk).
- **EventInvitationAlert / getContributorStatus / updateContributorStatus : vérifiés cohérents, aucune modif** — tous matchent `c.id === userId` (fonctionnels avec les vrais ids) avec fallback email ; le hook préservant `status: "invited"` au dédoublonnage, le flux RSVP reste complet.

**Découvertes (pièges — détail en section Pièges globale)** :
- **`record.get()` sur champ JSON = export goja du `[]byte` brut** : `[]byte("[]")` → `[91, 93]` (ASCII) — muter ce wrapper corrompt la donnée (`guestEmails` stocké `[91,93,"email"]`, `contributors` `[91,93,0]` — l'objet pushé coerce en byte) ou rejette `validation_invalid_json` (array mixte wrapper+JS). **Fix** : lecture `getString()` + `JSON.parse`. L'ancien hook avait le même bug latent sur `guestEmails` (son comportement « fonctionne » venait de la lecture de code, jamais prouvé en runtime). Données dev réelles vérifiées **propres** (SQL : 10 events, arrays bien formés — l'ancien hook n'a jamais tourné ici).
- PB **hot-reloade pb_hooks** (« File … changed, restarting… ») — itération sans restart.
- `$app.logger()` n'apparaît pas en console (info/warn) : lignes dans `_logs` de **auxiliary.db**.
- 1er run P1 : 401 fantôme = token JWT re-copié à la main fautif — bascule immédiate sur la sonde python (pattern T4).

**Bootcheck + application** : copie byte-identique `pb_data` → `pb_data-bootcheck-t8` (sert aussi de backup, aucune migration ce ticket — hooks = fichiers chauds, zéro écriture schéma) ; serve 8091 (`--hooksDir` absolu, piège T1) : health 200, routes `join-event` et `lookup-user` enregistrées (401 sans auth), 0 erreur de chargement hooks. Puis dev 8090 (`pb-dev.sh` nohup) pour la matrice complète. PB stoppé en fin de ticket (ports 8090/8091 libres), copie bootcheck trashed.

**Verdicts des sondes** (52/52 OK — `.scratch/probes/t8-hooks-matrix.py`, log `/tmp/orchestrate/t8-matrix-8090.log`, 3 users `t8-o/j/x@test.local` créés puis auto-supprimés) :

| # | Sonde | Verdict |
|---|---|---|
| P1-P1c | join valide : 200 `{eventId}` ; `guestUsers=[j]`, `guestEmails=[email]`, `contributors=[{id:j,email,name,status:accepted}]` exacts ; `useCount=1` | **OK** |
| P2-P2c | re-join idempotent : 200 ; `useCount` et contributors inchangés | **OK** |
| P3-P3d | dédoublonnage : contributor nanoid (même email) → id=réel userId, `status:invited` et `invitedAt` préservés, `name` enrichi, pas d'append ; `useCount=1` | **OK** |
| P4 | lien `expiresAt` passé → 400 « expire » | **OK** |
| P5 | `link_type=team` → 400 « ne permet pas de rejoindre un evenement » | **OK** |
| P6-P7b | maxUses=1 : 1er join 200 (`useCount=1`), 2e user → 400 « limite » ; pas d'incrément au refus | **OK** |
| P8 | event `canceled` → 400 « n'accepte pas de nouveaux participants » | **OK** |
| P9 | lien désactivé → 400 « desactive » | **OK** |
| P10-P13 | lookup-user : 200 `{id,name}` exacts / 404 inconnu / **401 sans auth** / 400 sans email | **OK** |
| P14 | join sans auth → 401 | **OK** |

Logs serveur : 5× `Join refused: …` en warn + `User joined event` / `Join reconciled existing participant` en info, vérifiés dans `_logs` (auxiliary.db). Teardown API 204×13 (6 links + 3 events + 3 users + désactivation) ; SQL readonly post-run : events **10**, share_links **3**, users **32**, **0 résidu `t8-%`** ; arrays JSON des 10 events réels vérifiés propres.

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = **69/69** ; `check-legacy` = **190 = baseline** (7 erreurs EventsStore préexistantes décalées +1 (import) puis +6 (hunk), colonnes identiques ; `pb-users.ts` 0 erreur — diff hunk par hunk vs log T7 ; logs `/tmp/orchestrate/t8-{check,test,check-legacy}-mig-26-10-06.log`). Typegen non requis (aucun changement de champs).

**Observations reportées (hors périmètre T8)** :
- `invite-to-team.pb.js` porte le même pattern `team.get("roles")` + mutation + `set` → **corruption `roles` latente au premier invite-to-team sur comptes existants** (même classe JSON que T8) ; non corrigé ici : la preuve réclamerait SMTP configuré (`mailer.getSenderAddress()` throw avant tout save) — candidat fast-win T-next avec le fix `getString()+JSON.parse` (≤ 5 lignes).
- AGENTS.md (mig) : table Services à compléter (`pb-users.ts`) + section « Restant Phase 1 » obsolète (DOC-1 audit) — éditions hors périmètre T8, pour l'orchestrateur.
- HOOK-3 (`send-emails` sans ownership) inchangé — ticket séparé, non planifié dans ce lot.

**Note WIP fence** : le commit docs inclut l'édition orchestrateur du header run.md (portail post-T7, présente non commitée à l'arrivée, 1 ligne, anodine) — commit whole-file d'un fichier que le ticket devait de toute façon amender, conformément au RUN-CONTRACT (pattern T2/T6/T7).

### T9 — send-emails ownership + reconciliation serveur (HOOK-3, HOOK-8) + client lookup-user (UI-1, C6) (06-10)

**Fait établi** (2 fichiers hooks + 4 fichiers client, 5 commits `1857acec`/`f5a4cc2d`/`2c04c442`/`4a0950a1`/`c2200fca` + docs) :
- **HOOK-3 — ownership** : `send-emails.pb.js` exige `shareLink.createdBy === e.auth.id` (refus **per-recipient** `ok:false « Lien de partage non autorise »` + warn log ; **fail-closed** sur `createdBy` vide/orphelin). Décision : chemin simple « createdBy », PAS la variante membership — la listRule REC-1 (`createdBy = auth`) fait que `getEventShareLinks` ne peut de toute façon renvoyer au client que ses propres liens ; le check hook = défense en profondeur (appels directs API, liens pré-REC-1). Bonus miroir join-event : `link_type === "event"` exigé (un lien team ne déclenche pas d'email event).
- **HOOK-3 — reconciliation** : nom/description/dates TOUJOURS relus depuis l'event cible (`target_id` → `findRecordById("events", …)`, event mort → refus per-recipient) ; les champs équivalents du body client (`eventName`/`eventDescription`/`dateStart`/`dateEnd`) sont **ignorés** — doc header hook mise à jour : body = `template` + `recipients` seulement. Chaque email construit est loggé en info (« Invitation email built », to/event/eventId/userId) — preuve de réconciliation indépendante du SMTP. Le SMTP (`getSenderAddress`) n'est vérifié QUE si au moins un email doit partir : un lot entièrement refusé répond 200 sans dépendre de la config SMTP.
- **Comportement SMTP absent en dev (mesuré, documenté)** : `settings.meta.senderAddress` est NON vide en dev (défaut PB) → `getSenderAddress()` ne throw pas ; sans host SMTP, `newMailClient()` bascule sur le binaire **sendmail** (absent du conteneur) → échec capturé **par destinataire** (`ok:false`, « GoError: failed to locate a sendmail executable path »), réponse 200 propre, pas de crash. La branche « senderAddress vide → 500 propre `InternalServerError("SMTP non configure…")` » reste en place mais n'est pas testable en dev sans toucher aux settings.
- **HOOK-8** : helper `getBaseUrl()` dans `email-templates.js` — les 2 sites de fallback centralisés ; fallback = `$app.logger().error()` bruyant (« ENKA_BASE_URL manquante… Definir ENKA_BASE_URL… ») + même URL prod par défaut (pas de fail-fast DX, prescription ticket). Preuve : le log erreur apparaît dans `_logs` exactement une fois par email construit (sonde P9).
- **UI-1** : `RecipePermissionsManager.svelte` — `users.getList` remplacé par `lookupUserByEmail` (`pb-users.ts` T8, DRY — aucun appel dupliqué) ; import `pb` retiré (plus utilisé). Le message « Utilisateur introuvable » redevient **correct** (404 = vraiment aucun compte ; avant, systématiquement faux par la listRule).
- **C6** : `pb-auth.emailExists` → `(await lookupUserByEmail(email)) !== null` (contrat booléen + catch→false conservés). **Limite documentée** : la route exige l'auth — pré-auth (inscription), retourne false ; le flux d'inscription détecte le doublon via le 400 PB `validation_not_unique` mappé dans AuthModal (déjà en place) — pas d'énumération d'emails pré-auth, par design.
- **Fast-win (commit dédié `c2200fca`)** : `AuthModal.svelte` importait `emailExists` sans jamais l'appeler (import mort — le flux d'inscription n'utilise que le mapping 400) → import retiré.
- **EventsStore.inviteParticipants** : les 4 champs d'event retirés du body send-emails (le serveur les reconstruit) — contrat client aligné. Compat : hook et client partent ensemble (même commit de déploiement) ; un vieux hook rejetterait en 400 « eventName requis » (fire-and-forget, console.error, invitations inchangées).

**Fast-win de zone (EventShareLinks / DOC-1)** : déjà conforme — `EventShareLinks.svelte` itère `shareLinkIds` local rempli par `getEventShareLinks` (aucun `event.shareLinks` fantôme ; grep vert sur `shareLinks` dans les .svelte) — la note T5 était obsolète, aucune modif.

**Verdicts des sondes** (18/18 OK — `.scratch/probes/t9-send-emails-matrix.py`, log `/tmp/orchestrate/t9-matrix-8090.log`, dev 8090 `pb-dev.sh` nohup, 2 users `t9-alice/bob@test.local` créés puis auto-supprimés) :

| # | Sonde | Verdict |
|---|---|---|
| P1 | send-emails sans auth | **401** |
| P2-P3 | template inconnu / recipients vide | **400** (whitelist/validation inchangées) |
| P4 | OWNERSHIP : bob avec le lien d'alice (body mensonger) | **200 `ok:false « non autorise »`**, rien envoyé, warn loggé (linkId/userId/owner) |
| P5 | OWNERSHIP inverse : alice avec le lien de bob | idem |
| P6 | lien désactivé | `ok:false` « introuvable ou inactif » + warn |
| P7 | `link_type=team` | `ok:false` « invalide pour une invitation evenement » + warn |
| P8 | shareLinkId inexistant | `ok:false` « introuvable ou inactif » + warn |
| P9 | positif alice/lien propre + body mensonger « HACKED » | 200 propre, échec sendmail capturé par destinataire ; log info « built » avec **le vrai nom** `t9-event-reel` ; log erreur ENKA_BASE_URL (HOOK-8) présent |

(1er run : P9 attendait 500 « SMTP non configure » — attente réécrite après mesure, voir ci-dessus ; les 2 branches documentées. 17/18 au 1er run, 18/18 au 2e — seule l'assertion P9 a changé.)

Teardown API (4 links + event + 2 users, 204) ; SQL readonly post-run : **0 résidu `t9-%`** (events/share_links/users) ; PB stoppé, port 8090 libre ; backup préalable `/tmp/orchestrate/pb_data-backup-t9/`.

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = **69/69** ; `check-legacy` = **190 = baseline** (7 erreurs EventsStore préexistantes aux colonnes IDENTIQUES — le hunk T9 est postérieur à la dernière ; pb-auth/AuthModal/RecipePermissionsManager 0 erreur — diff hunk par hunk vs log T8 ; logs `/tmp/orchestrate/t9-{check,test,check-legacy}-mig-26-10-06.log`). Typegen non requis (aucun changement de champs).

**Note déploiement (HOOK-8)** : définir `ENKA_BASE_URL` (URL publique de l'app, sans slash final) dans l'env du serveur PocketBase — sans elle, les liens des emails pointent vers `https://enka-cookbook.app` et chaque email construit logge une erreur (volontairement bruyant). À ajouter à la checklist Dokploy (Phase 1.8) — cf. ligne différée. Le template reset natif PB utilise les settings méta PB, indépendant de cette variable.

**Pièges T9** :
- `settings.meta.senderAddress` a une **valeur par défaut non vide en dev** → le guard « SMTP non configure » du mailer ne se déclenche jamais ici ; le vrai point d'échec dev = fallback **sendmail** de `newMailClient().send()` (erreur par email, capturée par le mailer → `ok:false`).
- Niveaux `_logs` vus (auxiliary.db) : info=0, warn=4, error=8 — le logger.error du fallback HOOK-8 est bien visible, contrairement à info/warn en console.
- Le dir `.agents/` est gitignore (pattern `*.agents`, L23) : les tickets s'ajoutent avec `git add -f` (précédent t01-t08).

**Note WIP fence** : le commit docs inclut l'édition orchestrateur du header run.md (portail post-T8, présente non commitée à l'arrivée, anodine) — commit whole-file d'un fichier que le ticket devait de toute façon amender, conformément au RUN-CONTRACT (pattern T2/T6/T7/T8).

### T10 — Cascade deletes complètes (HOOK-4, HOOK-5, C10) + règle teamdocs team-scopé + fix invite-to-team roles (06-10)

**Fait établi** (3 fichiers hooks + 1 migration, matrice 44/44 sur copie bootcheck PUIS sur dev 8090) :
- **HOOK-4/C10 — `cascade-delete-event.pb.js` refondu en hook BEFORE (`onRecordDelete`)** : ajout des blocs manquants (materiel_loan eventId, notifications purge `link ~ eventId || data ~ eventId`) ET changement d'architecture — **découverte majeure** (voir Pièges) : en `onRecordAfterDeleteSuccess`, PB 0.37.5 a déjà nullifié les relations pendantes des enfants → les filtres `eventId = ...` trouvent 0 row (hooks historiques = no-ops pour tout sauf les références TEXTE), et un event référencé par une relation **required** (products/purchases/event_materiel/event_todos.eventId) est **in-suppimable** (400 « required reference ») AVANT tout hook. Le hook before supprime les enfants quand leurs relations sont intactes, rend le delete des events chargés possible, et rend le cascade atomique (même transaction). **Fail-closed** : les try/catch log-only historiques sont retirés — tout échec de cascade propage et annule le delete (angle mort audit « delete partiel sans échec visible » corrigé).
- **HOOK-5 — `cascade-delete-teams.pb.js` refondu en `onRecordDelete`** : ajout materiel_loan `ownerId = teamId` → **DELETE** (décision ticket : un loan sans équipe propriétaire n'a pas de sens ; alternative null écartée) ; bloc `events.teams` conservé mais déplacé en before — le save explicite **bumpe `updated`** des events nettoyés (mesuré : bump effectif) → delta sync client, alors que le cleanup natif PB ne bump pas. Fail-closed idem.
- **invite-to-team `roles` (différé T8 clos)** : `team.get("roles")` (wrapper goja `[]byte`) → `getString("roles")` + `JSON.parse` + garde (objet pur, pas array) + `set` objet natif ; parse error → `{}`. **Preuve par sonde structurée** (SMTP absent, pas d'envoi réel — le save a lieu AVANT l'envoi) : team avec roles pré-existants `{"t10preset":"custom"}` + invite d'un user existant → SQL `roles = {"t10preset":"custom","<bobId>":"member"}` — JSON valide, preset préservé, pas de corruption byte (l'ancien code aurait produit un array mixte ou un rejet `validation_invalid_json`). Re-invite → `already_member`, roles inchangés. L'email part quand même (build template + sendBatch) → échec sendmail capturé par destinataire (`ok:false`), 200 propre — cohérent T9.
- **teamdocs team-scopé (différé T6 clos)** : migration `1791280500_teamdocs_team_scoped_rules.js` (> 1791278800) — les 5 règles (identiques eventId-only dans le snapshot) étendues symétriquement : create `+ @request.body.teamId.members ~ auth`, list/view/update/delete `+ teamId.members ~ auth` (miroir REC-7 materiel, pattern T4 prouvé). down() = restauration eventId-only.

**Verdicts des sondes** (44/44 — `.scratch/probes/t10-cascade-matrix.py`, logs `/tmp/orchestrate/t10-matrix-{8091,8090}.log`, 3 users `t10-alice/bob/carol@test.local` créés puis auto-supprimés ; chaque sonde = 1 assert dur, teardown best-effort en finally) :

| # | Sonde | Verdict dev |
|---|---|---|
| P1-P20 | setup : 3 users, 3 teams, 3 events (E1=[A], E2=[A,B], E3=[B]), 6 enfants E1 (product, purchase, event_materiel, event_todo, teamdoc event-scopé, share_link), loan L1 (eventId+ownerId), notif match + notif contrôle, 4 enfants T10B (materiel, teamdoc team-scopé, share_link team, loan L2) | **OK** (tout 200) |
| P21-P28 | teamdocs rules : bob (membre) create team-scopé sans eventId → 200 ; update/view/list → 200/200/visible ; delete → 204 ; carol (non-membre) create → **400 règle data:{}** (matérialisation PB du « 403 » du ticket, pattern T4) ; list → absent ; view → 404 | **OK** |
| P29-P34 | invite-to-team : carol non-membre → 403 ; PATCH roles preset → 200 ; invite bob (existant) → `action=added` ; roles SQL = JSON valide preset+bob ; re-invite → `already_member` ; roles inchangés | **OK** |
| P35-P37 | cascade EVENT : comptes pré-delete = 1 partout ; alice DELETE E1 → **204** (avant fix : 400 required-reference, cf. Pièges) ; post : 0 orphelin sur les 8 zones + notif contrôle vivante + 0 product détaché | **OK** |
| P38-P41 | cascade TEAM : comptes pré = 1 partout ; DELETE T10B → 204 ; E2.teams=[A], E3.teams=[] ; **E2.updated bumpé** (12:40:14.011Z → 12:40:14.209Z) ; 0 orphelin + 0 détaché (materiel/teamdocs/loans supprimés par le hook, counts loggés `deleted:1`) | **OK** |
| P42-P43 | comptes finaux = baseline exacte (events 10, teams 6, users 32, materiel 110, loans 2, notifs 0, share_links 3, teamdocs 10) + **0 résidu `t10-`** | **OK** |

Logs hooks vérifiés dans `_logs` (auxiliary.db) : cascade E1 → `materiel_loan deleted:1`, `notifications deleted:1`, `teamdocs deleted:1` ; cascade T10B → `totalDeleted:4` + `events.teams nettoye events:2`.

**Application** (backup préalable `/tmp/orchestrate/pb_data-backup-t10/`, sha256 `data.db` avant `4287c2c6...`) : bootcheck sur copie fraîche du backup (`migrate up` → « Applied 1791280500... », serve 8091, 0 erreur hooks, matrice 44/44) PUIS dev : `cd pocketbase && ./pocketbase migrate up` → même ligne (log `/tmp/orchestrate/t10-dev-migrate-up.log`). `_migrations` : **98 lignes** = 97 post-T4 + 1. Règles vérifiées SQL (`_collections.listRule` teamdocs). Hooks = fichiers chauds (pas de migration) mais revalidés par la matrice dev complète. PB stoppé en fin de ticket (ports 8090/8091 libres), copie bootcheck trashed.

**Canon** : `bun run check` = 179 fichiers, 0 erreur, 6 warnings (inchangés) ; `bun run test` = **69/69** ; `check-legacy` = **190 = baseline** (aucun fichier client touché — logs `/tmp/orchestrate/t10-{check,test,check-legacy}-mig-26-10-06.log`). Typegen non requis (migration de règles, 0 changement de champs).

**Découvertes (pièges — détail en section Pièges globale)** :
- **PB 0.37.5 nullifie les références de relation pendantes AU delete du parent** (après le hook AfterSuccess) : single → `''`, multi → id retiré du array. Trois conséquences : (1) les cascades AfterSuccess basées sur des filtres relation sont des **no-ops** (les 6 blocs historiques du hook events loggaient `deleted:0` depuis toujours — vérifié dans les logs T5/T6 historiques de la copie) ; (2) les relations **required** des enfants **refusent le delete du parent** (400 « the record cannot be deleted because it is part of a required reference ») — un event avec products/purchases/event_materiel/event_todos était **in-suppimable** via l'API (mesuré : le même delete E1 passe de 400 à 204 avec le hook before) ; (3) l'affirmation HOOK-5 de l'audit « events.teams garde des ids pendants » est **fausse pour PB 0.37.5** (purge native mesurée : E2=[A], E3=[] sans intervention) — le bloc explicite reste pour le bump `updated` (delta sync).
- **Enfants détachés par PB ≠ orphelins référencant un mort** : le constat audit « loans orphelins (eventId) » se matérialise en « loans DETACHÉS (eventId=""  ownerId="") mais toujours en base » — la pollution est réelle, le mécanisme différent ; c'est ce qui rend le hook before nécessaire.
- `_logs.created` = `strftime('%Y-%m-%d %H:%M:%fZ')` **UTC avec Z** — un filtre `created >= '14:26'` (heure locale sans Z) renvoie 0 ligne silencieusement ; filtrer en UTC ou par `rowid`.
- `sqlite3 -readonly` ne voit pas le contenu WAL non checkpointé — mais PB 0.37.5 checkpointe vite (wal 0 octet observé en activité) ; les logs `_logs` restent la méthode fiable.

**Observations reportées (hors périmètre T10)** :
- La purge notifications reste pragmatique (match sous-chaîne link/data) : faux positifs théoriques (id PB 15 chars réapparaissant par hasard — négligeable) et faux négatifs (notification référençant l'event autrement que par son id) — limites documentées dans le header du hook.
- Les events dont les teams sont supprimées gardent `contributor`/`guestUsers` intacts (pas du ressort team-cascade) ; C3 (collection notifications morte côté client) inchangé — les notifications créées pour un event sont désormais au moins purgées à sa suppression.
- `materiel_loan.deleteRule = createdBy = auth` + client sans createdBy (loans UI indestructibles) : différée T6, TOUJOURS VALABLE (T10 n'y touche pas ; la sonde a posé createdBy explicitement).
- Hooks BEFORE + fail-closed : un delete d'event/team déclenchant une erreur cascade est désormais annulé net (avant : partiel possible). Aucun cas connu où un enfant `$app.delete` échouerait (superuser) — comportement théorique, documenté dans les headers.

**Note WIP fence** : le commit docs inclut l'édition orchestrateur du header run.md (portail post-T9, présente non commitée à l'arrivée, anodine) — commit whole-file d'un fichier que le ticket devait de toute façon amender, conformément au RUN-CONTRACT (pattern T2/T6/T7/T8/T9).

## Constats différés (deferred — tag `!` bientôt / `S2` gating déploiement / `?` conditionnel)

- **S2** : secret share_links ≠ id (token dédié) — refonte URL/invitations. (décision enveloppe, voir ci-dessus)
- **?** : HOOK-6 — invité sans compte jamais rattaché à la team après inscription (refonte flux invitation, décision produit).
- **?** : C3 — collections mortes `event_todos` / `notifications` (trancher migrer vs supprimer — produit).
- **?** : C5 — 3e argument `sendEmailToExistingMembers` de `createEventWithTeams` ignoré (implémenter ou retirer l'option UI — produit).
- `!` côté SITE (pas ici) : régression `isDynamic` perdue par revert `88de525a` — à corriger upstream enka-next, NE PAS porter.
- `!` backend delta : ~~`teamdocs.createRule` exige `eventId.*`~~ **Fait T10** (migration `1791280500`, 5 règles étendues symétriquement, matrice pos/neg verte).
- `!` backend : ~~`invite-to-team.pb.js` roles goja~~ **Fait T10** (getString+JSON.parse+set natif ; preuve sonde : preset préservé + roles valides en SQL, sans SMTP).
- `!` backend ou client : `materiel_loan.deleteRule = createdBy = auth` mais le client ne set jamais `createdBy` à la création → loans UI indestructibles via l'API (T6 a contourné en SQL) ; setter `createdBy = userId` dans `createLoan` (pattern C9) ou revoir la règle.
- Images recettes (20 valeurs `img` frontmatter, og:image déjà cassées côté Hugo) — décision produit Phase 2.
- **S2** déploiement : définir `ENKA_BASE_URL` dans l'env du serveur PB (URL publique sans slash final) — sans elle, les liens emails pointent vers la prod et chaque build d'email logge une erreur (fallback volontairement bruyant, T9). À intégrer à la checklist Dokploy (Phase 1.8).
