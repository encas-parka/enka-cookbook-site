# T18 — QA runtime round 2 (chaîne finale fresh-DB + boot dev + build)

**Sources** : synthèse Lot 5 (QA runtime round 2 — la part agent-doable ; le click-through navigateur reste humain) ; rules-hooks §6 (probes)
**Prérequis** : T17 en STOP partiel (Phase 1 mergée, Phases 2-3 en attente de clé Appwrite) — le QA porte sur l'état COURANT (contenu 456 recettes, données dev inchangées)

## Objectif

Attestation bout-en-bout de l'état final du run : la chaîne de migrations complète boot une fresh DB, les fixes backend tiennent leurs sondes, la dev DB démarre, le client build.

## Contenu

1. **Fresh DB complète** : `./pocketbase migrate up` sur répertoire vierge (chaîne snapshot T1 + tous les deltas T2-T10) → boot sans erreur.
2. **Matrice de sondes finale** (fresh DB, user de test via API) — re-vérifier LES FIXES clés dans leur état final :
   - products list (auth) 200 (ORD-1 mort) ; recipes list anonyme 200 (public read assumé)
   - locks create id `doc_test123456789` 200 (LOCK-1 mort) ; create avec `userId` d'un tiers → 400 (SEC-2)
   - share_links list (tiers) → vide/403 ; create avec `createdBy` tiers → 400 (REC-1)
   - notifications create `userId` tiers → 400 (REC-5)
   - recipes update par collaborateur `permissionWrite` 200 (REC-3)
   - join-event : contributors + expiresAt/maxUses (sonde légère — déjà 52/52 en T8, spot-check suffit)
   - `/api/enka/lookup-user` pos/neg (T8)
   - teamdoc team-scopé create/list membre OK (T10)
3. **Boot dev DB** : `bun run dev:pb` sur la vraie pb_data (elle démarre avec la chaîne complète — les migrations sont déjà appliquées, no-op) → health 200 → stop propre.
4. **Build client** : `cd svelte-app && bun run build` (sortie `../static/app/`) → 0 erreur.
5. Canons : check/test/check-legacy (delta 0).

## Hors périmètre

- Click-through navigateur (créations UI, RSVP, emails) = humain — lister les flux à tester dans run.md pour l'utilisateur.
- T17 Phases 2-3 (clé Appwrite).

## Critères

- [x] Fresh DB : chaîne complète boot (deltas appliqués sans erreur, comptage `_migrations`)
- [x] Matrice de sondes finale verte (verdicts + commandes dans run.md)
- [x] Dev DB boot + health + stop propre
- [x] `bun run build` 0 erreur
- [x] Canons verts ; run.md amendé (journal T18 + liste click-through humain)
