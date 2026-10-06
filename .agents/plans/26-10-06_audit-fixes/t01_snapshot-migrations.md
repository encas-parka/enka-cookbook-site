# T1 — Snapshot migrations depuis la DB dev (nouvelle source de vérité)

**Sources** : rules-hooks §0 (ORD-1, DIV-1, MIG-1, REC-4) · schema-client §8 (B10) · synthèse Lot 0.1
**Tickets bloqués par celui-ci** : T2, T3, T4 (tous les deltas schéma/rules viennent après le snapshot)

## Objectif

Reconstruire `pocketbase/pb_migrations/` autour d'un **snapshot généré depuis la DB dev** (`pocketbase/pb_data`), reflétant exactement collections + règles réelles. Absorbe ORD-1 (joinToken 400 fresh), DIV-1 (migrations ≠ DB), MIG-1 (historique test/squash).

## Contraintes

- **Ne rien écrire dans `pb_data`** pendant ce ticket (lecture seule pour générer le snapshot). Les vérifications fresh-DB se font avec un **autre répertoire de données** (`--dir` ou copie vide).
- Un seul process PB à la fois sur un même `--dir` (lock SQLite).
- L'état snapshot = DB dev **d'avant** T2/T3 : teams SANS `roles`/`createdBy`/etc., locks id strict, share_links rules ouvertes — c'est **attendu**, les tickets suivants corrigent par deltas. Documenter les verdicts de sondes dans cet état-là, ne pas "réparer" ici.

## Méthode suggérée

1. Backup : copier `pocketbase/pb_data/` → `/tmp/orchestrate/pb_data-backup-t1/` (par précaution, même en lecture seule).
2. `./pocketbase migrate collections "sync_collections"` (cwd `pocketbase/`) → génère le fichier snapshot.
3. Restructurer la chaîne : **remplacer les 40 fichiers** par le snapshot unique (les anciens restent dans l'historique git). Vérifier que le snapshot embarque bien collections + règles (le lire).
4. Fresh DB : `./pocketbase migrate up` sur un répertoire vide → applique sans erreur.
5. Sondes curl (fresh DB, documenter commandes + verdicts exacts dans run.md) :
   - auth user de test (users create public + auth-with-password) ;
   - `GET /api/collections/products/records` (auth) → **200** (ORD-1 mort) ;
   - `GET /api/collections/recipes/records` (anonyme) → 200 (public read, cf. correction REC-2) ;
   - `GET /api/collections/share_links/records` (auth non-propriétaire) → 200 encore (REC-1 pas encore fixé — attendu) ;
   - `POST /api/collections/locks/records` id `doc_test123456789` → **400** (LOCK-1 pas encore fixé — attendu).
6. Vérifier que la DB dev boot toujours (`bun run dev:pb`, puis stop).

## Critères

- [x] `pb_migrations/` reconstruit : snapshot unique depuis dev DB (+ fichiers down fonctionnels), anciens fichiers retirés
- [x] Fresh DB (répertoire de données séparé) : `migrate up` OK de zéro
- [x] 4 sondes curl documentées dans run.md (commandes exactes + verdicts, état pré-deltas)
- [x] `pb_data` dev inchangée (vérifier mtime/état avant-après)
- [x] run.md amendé (journal T1 + pièges éventuels)
