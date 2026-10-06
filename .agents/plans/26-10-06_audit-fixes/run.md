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

- **Base** : `e9f8c6cd` « build » (HEAD `mig/pocketbase` = origin au démarrage, 06-10)
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

## Constats différés (deferred — tag `!` bientôt / `S2` gating déploiement / `?` conditionnel)

- **S2** : secret share_links ≠ id (token dédié) — refonte URL/invitations. (décision enveloppe, voir ci-dessus)
- **?** : HOOK-6 — invité sans compte jamais rattaché à la team après inscription (refonte flux invitation, décision produit).
- **?** : C3 — collections mortes `event_todos` / `notifications` (trancher migrer vs supprimer — produit).
- **?** : C5 — 3e argument `sendEmailToExistingMembers` de `createEventWithTeams` ignoré (implémenter ou retirer l'option UI — produit).
- `!` côté SITE (pas ici) : régression `isDynamic` perdue par revert `88de525a` — à corriger upstream enka-next, NE PAS porter.
- Images recettes (20 valeurs `img` frontmatter, og:image déjà cassées côté Hugo) — décision produit Phase 2.
