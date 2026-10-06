# T4 — Rules API : REC-3, REC-1, EVENT-1, REC-4/SEC-1, REC-5, REC-7, REC-9, SEC-2

**Sources** : rules-hooks tableau §1 + §1 inventaire (chaque ID) + §5 sécurité · corrections enveloppe (REC-2 assumée public read, REC-8 assumé)
**Prérequis** : T3 (share_links.createdBy et events.description existent)

## Objectif

Un lot de migrations rules-only, depuis l'état snapshot + deltas :

| Rule | État snapshot (dev) | Cible |
|---|---|---|
| recipes updateRule | `?=` cassé (REC-3) | `permissionWrite ~ @request.auth.id` |
| share_links (5 rules) | tout auth (`@request.auth.id != ""`) | list/view/update/delete : `createdBy = @request.auth.id` ; create : garde `@request.body.createdBy = @request.auth.id` (REC-1) |
| events list/view | `teams.members ~ \|\| guestUsers ~` | + `createdBy = @request.auth.id` (EVENT-1) |
| events updateRule | `guestEmails ~` (REC-4/SEC-1) | `teams.members ~ \|\| guestUsers ~ \|\| createdBy = @request.auth.id` (unifié sur guestUsers) |
| events enfants (products, purchases, event_materiel, event_todos, teamdocs) create/update/delete | `guestEmails ~` (SEC-1) | `guestUsers ~` (double-hop `eventId.guestUsers ~`), garder `teams.members ~` |
| notifications createRule | auth seul (REC-5) | `@request.body.userId = @request.auth.id` |
| materiel createRule | auth seul (REC-7) | `@request.body.teamId.members ~ @request.auth.id \|\| @request.body.ownerUser = @request.auth.id` |
| materiel_loan createRule | auth seul (REC-9) | garde minimale : `borrowerUser = @request.auth.id \|\| @request.body.createdBy = @request.auth.id` (arbitrer selon usage client — documenter) |
| locks createRule | auth seul (SEC-2) | `@request.body.userId = @request.auth.id` |

**Assumés et documentés (pas de code)** : REC-2 listRule `""` = public read conservé (recipes/ingredients/categories) ; REC-8 ingredients update/delete ouverts ; categories update/delete superuser-only.

## Méthode suggérée

1. **Backup `pb_data`** → `/tmp/orchestrate/pb_data-backup-t4/`.
2. Migration(s) rules. Attention pièges : `?=` interdit (cassé 0.37.5) ; `~` = LIKE sous-chaîne — sur relations `guestUsers ~ @request.auth.id` est un match de relation, OK.
3. **Matrice de vérification curl** (fresh DB ou dev, au choix — documenter) : par règle modifiée, un cas positif (owner/membre → 200) et un cas négatif (auth tiers → 403/404). Pour REC-3 : 2 users + recette partagée `permissionWrite` → update par le collaborateur 200, par un tiers 403/404. Pour REC-1 : liste share_links d'un tiers → vide/403 ; son propre lien → 200.
4. `bun run generate-types` n'est pas requis (pas de changement de champs) — `bun run check` au canon quand même (filet).

## Critères

- [ ] Migration(s) rules appliquée(s) (backup fait)
- [ ] Matrice curl pos/neg documentée dans run.md (commandes + verdicts par règle)
- [ ] Aucun changement de code client nécessaire (sinon : STOP & report — une rule casserait un flux attendu)
- [ ] run.md amendé (journal T4 + arbitrages REC-8/categories posés noir sur blanc)
