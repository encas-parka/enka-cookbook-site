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
| teams deleteRule | `members ~` — tout membre peut supprimer (REC-6, cascade !) | `createdBy = @request.auth.id \|\| (createdBy = "" && members ~ @request.auth.id)` — clause grand-père : les teams pré-T3 (createdBy vide) gardent le delete par membres ; updateRule reste `members ~` (collaboration), documenter |

**Assumés et documentés (pas de code)** : REC-2 listRule `""` = public read conservé (recipes/ingredients/categories) ; REC-8 ingredients update/delete ouverts ; categories update/delete superuser-only.

## Méthode suggérée

1. **Backup `pb_data`** → `/tmp/orchestrate/pb_data-backup-t4/`.
2. Migration(s) rules. Attention pièges : `?=` interdit (cassé 0.37.5) ; `~` = LIKE sous-chaîne — sur relations `guestUsers ~ @request.auth.id` est un match de relation, OK.
3. **Matrice de vérification curl** (fresh DB ou dev, au choix — documenter) : par règle modifiée, un cas positif (owner/membre → 200) et un cas négatif (auth tiers → 403/404). Pour REC-3 : 2 users + recette partagée `permissionWrite` → update par le collaborateur 200, par un tiers 403/404. Pour REC-1 : liste share_links d'un tiers → vide/403 ; son propre lien → 200 (les 3 liens dev ont été backfillés createdBy en T3 — 3/3 résolus).
4. `bun run generate-types` n'est pas requis (pas de changement de champs) — `bun run check` au canon quand même (filet).

## Vigilances héritées (T1-T3)

- **`~` sur champ texte/json = LIKE sous-chaîne** — interdit sur guestEmails (SEC-1), requis sur relations (match id exact).
- **Vérifier que le client envoie `createdBy` à la création d'event** (grep `EventsStore.createEventWithTeams` / `#serializeCreateData`) : si absent, la listRule EVENT-1 (`createdBy = …`) ne matcherait pas — ne pas changer le client ici, noter dans run.md pour T5.
- **Fast-win T3 déjà appliqué** : `teams-resync-events.pb.js` `originalCopy()` → `original()` (updates teams refonctionnent) — ne pas retoucher.
- `?=` est cassé partout : si tu en rencontres dans d'autres rules du snapshot, corrige dans la même migration (fast-win rules, une ligne chacun) et logge.
- Pièges JSVM/migrations T3 dans run.md : `JSONField` (pas `JsonField`), `.one()` nu = panic Go, colonnes JSON fraîches = NULL (pas `''`).

## Critères

- [x] Migration(s) rules appliquée(s) (backup fait)
- [x] Matrice curl pos/neg documentée dans run.md (commandes + verdicts par règle)
- [x] Aucun changement de code client nécessaire (sinon : STOP & report — une rule casserait un flux attendu) — grep documenté dans run.md : tous les flux client passent les nouvelles gardes
- [x] run.md amendé (journal T4 + arbitrages REC-8/categories posés noir sur blanc)

## Arbitrages posés (06-10, implémentation T4)

- **REC-8** (ingredients update/delete ouverts à tout auth) : **assumé** — référentiel de cuisine partagé, même logique que REC-2 public read ; à revoir uniquement si un jour l'édition devient multi-tenant.
- **categories update/delete = null (superuser-only)** : **assumé** — asymétrie vs ingredients (create auth) voulue : référentiel de catégories plus structurant, non éditable par les users.
- **REC-9** : règle arbitré (responsibleId/ownerId.members — voir journal T4), la forme littérale borrowerUser/createdBy du ticket cassait `createLoan`.
- **REC-6** : updateRule teams inchangé (collaboration members) ; deleteRule restreint + grand-père `createdBy = ""` pour les 6 teams dev pré-T3.
- **REC-4/SEC-1 enfants** : no-op — déjà à la cible dans le snapshot T1 (voir journal T4).
