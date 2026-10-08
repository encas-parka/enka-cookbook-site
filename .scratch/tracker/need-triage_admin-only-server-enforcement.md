# Ticket — need-triage : durcissement serveur des droits admin (rôles d'équipe)

> Créé le 08-10, suite de la décision produit « plan A » (backfill roles +
> deleteRules team-scopées + createLoan createdBy). Tag backlog : `need-triage`.

## Contexte

Le SPA distingue owner / member dans les équipes (`teams.roles` = map JSON
`{userId: role}`, consommée par `enrichTeamFromPB`) et gated toutes les
actions d'admin par l'UI. Côté serveur PocketBase, en revanche, **aucune
règle d'API ne distingue l'admin** :

- `teams.updateRule` = `members ~ auth` → tout membre peut modifier la
  configuration d'équipe (nom, prefs, `members[]`, `roles{}`) — le gating
  admin n'existe que dans l'UI ;
- materiel / materiel_loan deleteRule (08-10) = `createdBy = auth ||
  teamId.members ~ auth` → tout membre peut supprimer, là aussi avec
  attente produit « l'admin peut supprimer » seulement garanti côté UI.

Le produit vise à terme : les utilisateurs au rôle « admin » (owner) ont des
droits de modification que les autres n'ont pas — notamment le delete de
materiel devrait être réservé aux admins côté serveur, pas seulement caché
par l'UI.

## Contrainte technique centrale

Les règles d'API PocketBase **ne peuvent pas traverser un champ JSON** :
impossible d'écrire `roles.<userId> = "owner"` dans une rule. Trois options
pour un enforcement serveur réel :

1. **Champ relation dérivé `teams.admins`** (multi-relation users, écrit en
   même temps que `roles` par le store + hooks) → traversable :
   `teamId.admins ~ @request.auth.id`. Coût : schema change + double source
   de vérité à maintenir synchronisée.
2. **Hooks JSVM** (beforeCreate/Update/Delete sur materiel, materiel_loan,
   teams) lisant la map `roles` (pattern `getString` + `JSON.parse`) et
   rejetant les non-admins. Coût : logique serveur en ES5, dispersion de la
   politique d'autorisation entre rules et hooks.
3. **Statu quo assumé** : rules members-based + gating admin UI-only
   (modèle actuel, cohérent avec `teams.updateRule` existant).

## Décision attendue

- Choisir l'option (1), (2) ou (3) — et si durcissement : quelles actions
  sont admin-only (update team ? delete materiel ? gestion des membres ?).
- Noter le risque spécifique de l'option 1 : `admins` peut diverger de
  `roles` si un chemin d'écriture oublie la double écriture.

## Liens

- Migration de référence : `pocketbase/pb_migrations/1791500000_teams_roles_and_materiel_delete_rules.js`
- Découverte source (analyse 08-10) : Appwrite prod ne portait ni
  `materiel.ownerUser` ni `createdBy` (owner.userId = "" sur 110/110) ; les
  permissions document-level Appwrite (`delete("team:…")` sur 80/110) ont
  servi de référence de parité.
