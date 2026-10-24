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

**Status:** ready-for-agent

- [ ] Migration delta : champ `status` supprimé de `materiel`, re-run sans erreur sur base dev
- [ ] Aucune référence résiduelle au statut de matériel dans l'app (l'enum, le champ enrichi historique, les options de formulaire — hors statuts d'emprunt, distincts)
- [ ] Transform d'import : plus d'écriture de `status`
- [ ] Types régénérés ; `bun run check:app` vert ; suite de tests complète verte (un run, log sous `/tmp/opencode`)
- [ ] Re-run pipeline de migration complet : verdicts verts, aucune divergence d'import
- [ ] `docs/pocketbase_collections.md` mis à jour : champ `status` retiré, `repairQuantity` documenté (maintenance doc maison)

## Comments
