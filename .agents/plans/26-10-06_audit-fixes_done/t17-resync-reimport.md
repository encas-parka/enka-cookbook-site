# T17 — Resync contenu (~89 recettes) + export Appwrite frais + re-import complet

**Sources** : import-pipeline §2 (réconciliation 430/372), §6 Lots 3-4 (resync + re-import), §5 (images — hors périmètre) ; synthèse Lot 2
**Prérequis** : T16 (pipeline corrigé et prouvé en dry-run) ; creds Appwrite présentes (`scripts_dev/.env.local` — verdict T16)

## Objectif

Réparer les données : contenu Hugo à jour (~89 recettes site-only), export Appwrite frais (l'actuel date du 04-05), re-import complet propre (le pipeline est idempotent — recommandation du rapport).

## Phase 1 — Merge contenu (source = enka-next, destination = mig)

- Lire le contenu depuis le worktree site : `/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-site/content/recipe/` (LECTURE SEULE — ne jamais écrire dans le worktree site).
- Copier les dossiers recette manquants/divergents vers `content/recipe/` du mig (~89 attendus — compter avant/après).
- **3 renommages divergents** (`ktipiti`, `salade-aubergine`, `tom-kha`) : analyser le frontmatter des deux côtés, retenir le nommage site (enka-next) comme canonique, retirer les vieux dossiers mig correspondants, documenter le mapping.
- `z-test` : le nettoyage est côté SITE (hors périmètre — noter dans run.md pour l'utilisateur) ; côté mig, si un dossier z-test existe, ne PAS l'importer (exclusion légitime, documenter).
- Commit dédié (contenu seul), puis `hugo` sanity check si rapide (ou laisser Hugo au QA).

## Phase 2 — Export Appwrite frais

1. **Backup `pb_data`** → `/tmp/orchestrate/pb_data-backup-t17/` + sha256 (le re-import détruit les données importées actuelles).
2. `bun run scripts_dev/1-export-appwrite.ts` (creds `.env.local`) — vérifier la fraîcheur de la sortie (recettes ≈ 113+ attendues dans le dump CR selon l'audit §2).
3. Échec réseau/creds → **STOP & report** avec l'erreur exacte.

## Phase 3 — Re-import complet (ordre du rapport §6 Lot 4)

```
cleanup-pb.ts --target=all   (préserve ingredients + categories ; PB STOPPÉ après)
→ 2-transform / 2b / 2c / 2d (corrigés T16)
→ boot PB → 3-import-pb.ts → stop PB
→ 4-fix-timestamps.ts (PB arrêté)
→ boot PB → validate-migration.ts (37/37 + checks par champ T16)
```

- Respecter l'ordre PB arrêté/marche (4-fix-timestamps = sqlite direct).
- Sondes post-import : comptages (recipes attendues ≈ contenu mig post-merge − drafts exclus, à calculer depuis la sortie 2b ; users 33 — le 33e `public` doit passer ou échouer BRUYAMMENT maintenant que validate nomme les manquants) ; `share_links.createdBy` peuplé (les 3 liens dev sont détruits par le cleanup — les ré-importés depuis l'export Appwrite doivent porter createdBy via refId `aw_*`, à vérifier : c'est le prérequis des rules REC-1) ; recipes list anonyme 200.

## Vigilances

- Les migrations T2-T4 sont DANS la chaîne : le cleanup/import ne touche que les RECORDS, le schéma reste. Ne pas re-appliquer de migrations.
- Tout écart inattendu (comptages absurdes, refs non résolues massives) → STOP & report, ne pas forcer.
- Les tests unitaires du client (93/93) ne dépendent pas des données — canon inchangé attendu.

## Critères

- [x] Contenu mergé (comptage avant/après + mapping des 3 renommages documentés) ; commit contenu séparé — **fait `3c81ea96`** (372 → 456 : 87 nouvelles, 33 màj, 3 renommages côté site, 2 z-tests exclus), Hugo sanity vert
- [x] Export Appwrite frais — **fait (session 2)** : clé renouvelée par l'utilisateur après STOP 401 ; export OK (`t17-export2.log`, prod, 2026-10-06T23:01Z) ; comptages dans run.md § journal T17
- [x] Re-import complet : validate-migration **36/38** — tout vert sauf 2 checks du MÊME défaut réel et documenté : 1 teamdocs prod `content` > 5000 chars rejeté par le schéma PB (échec bruyant, différé). Les 4 B1 réparés : created 456/456, createdBy 262, permissionWrite 267, rootRecipeId 54
- [x] Sondes post-import — share_links.createdBy 6/6 (fix pipeline `84698500`, prérequis REC-1 tenu) ; recipes anonyme 200 ; comptages 456/262/267/54 = attendus 2b ; users 59/59 (le 33e `public` a disparu de la source — verdict, pas un échec) ; détail run.md § journal T17
- [x] run.md amendé — journal T17 (chiffres avant/après, mapping renommages, 2 fixes pipeline, verdicts) + 2 lignes différées (teamdocs >5000, warns materiel prod)
