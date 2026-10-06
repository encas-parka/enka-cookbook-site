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

- Migrations : `pocketbase/pb_migrations/` (40 fichiers, ordre lexicographique = piège ORD-1). Typegen : `svelte-app/src/lib/types/pb-generated.ts` (reflet DB dev, 08-05).
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

_(chaque ticket ajoute sa section : fait établi / vérification empirique / décision / déviation)_

## Constats différés (deferred — tag `!` bientôt / `S2` gating déploiement / `?` conditionnel)

- **S2** : secret share_links ≠ id (token dédié) — refonte URL/invitations. (décision enveloppe, voir ci-dessus)
- **?** : HOOK-6 — invité sans compte jamais rattaché à la team après inscription (refonte flux invitation, décision produit).
- **?** : C3 — collections mortes `event_todos` / `notifications` (trancher migrer vs supprimer — produit).
- **?** : C5 — 3e argument `sendEmailToExistingMembers` de `createEventWithTeams` ignoré (implémenter ou retirer l'option UI — produit).
- `!` côté SITE (pas ici) : régression `isDynamic` perdue par revert `88de525a` — à corriger upstream enka-next, NE PAS porter.
- Images recettes (20 valeurs `img` frontmatter, og:image déjà cassées côté Hugo) — décision produit Phase 2.
