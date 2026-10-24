# 06: Contract — suppression du statut persisté et validation pipeline complète

**What to build:** le champ statut quitte le schéma `materiel` maintenant
que plus personne ne le lit (tickets 01–05) : migration de suppression,
purge des derniers usages dans l'app, retrait côté transform d'import,
régénération des types, re-run complet du pipeline de migration avec ses
verdicts. Clôture mécanique du lot — c'est ici que le rejeu cutoff devient
propre : le schéma cible ne connaît plus le statut.

Références : spec (§ Implementation Decisions, migration) · ADR 0003 (décision de suppression).
Zone : `pocketbase/pb_migrations/` (delta de suppression), `scripts_dev/2-transform-data.ts`, purge des usages résiduels (ancien champ enrichi, options, types), regen types, docs `docs/pocketbase_collections.md`.

**Blocked by:** 01, 02, 03, 04, 05.

**Status:** done

- [x] Migration delta : champ `status` supprimé de `materiel`, re-run sans erreur sur base dev — `pocketbase/pb_migrations/1792900000_materiel_drop_status.js` (garde d'idempotence, down recrée le select à l'id identique, valeurs non reconstituées par design) ; appliquée à la base locale (`migrate up` → Applied) et à la base pipeline neuve (pb-start)
- [x] Aucune référence résiduelle au statut de matériel dans l'app (l'enum, le champ enrichi historique, les options de formulaire — hors statuts d'emprunt, distincts) — grep de preuve `/tmp/orchestrate/grep-preuve-t06.log` : zéro lecteur hors `EventMaterielStatus*` (distinct) ; `pb.d.ts` (5 sites), `EnrichedMaterielStatus`, `getMaterielStatusLabel`, interface `MaterielFilters` morte, signatures `createMateriel`/`updateMateriel`, `QuickAddCatalogModal`, enum `appwrite.d.ts` purgés ; `MaterielLoanStatusOptions` / `setTri`/`onQty` "lost" intacts
- [x] Transform d'import : plus d'écriture de `status` — ligne `status: awMat.status || "ok"` retirée (`/tmp/orchestrate/t06-transform-diff.txt`, bloc materiel seul) ; backfill conservateur `repairQuantity`/`quantity` conservé (sonde base pipeline : 110 records, 2 en réparation, 9 à quantité 0)
- [x] Types régénérés ; `bun run check:app` vert ; suite de tests complète verte (un run, log sous `/tmp/opencode`) — `/tmp/opencode/tests-t06-full-suite.log` : 53 fichiers / 380 tests (−2 vs 382 : describe de coexistence statut/displayState supprimé, couverture déjà portée par le bloc disponibilité) ; `check:app` 198 fichiers 0 erreur (`/tmp/orchestrate/check-t06-checkapp.log` + post-regen `check-t06-checkapp-post-regen.log`)
- [x] Re-run pipeline de migration complet : verdicts verts, aucune divergence d'import — managed, `scripts_dev/runs/2026-10-24-050642.md` : 12/12 steps exit 0, validate 86/86, 0 non-verdicted, **VERT** ; log `/tmp/orchestrate/pipeline-t06.log` ; sonde sqlite : pas de colonne `status` dans la base importée
- [x] `docs/pocketbase_collections.md` mis à jour : champ `status` retiré, `repairQuantity` documenté (maintenance doc maison) — section « Le modèle de stock materiel » (quantity/repairQuantity/dispo, ADR 0003) ajoutée en même session que la migration

## Comments
