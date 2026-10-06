# T10 — Cascade deletes complètes (HOOK-4, HOOK-5, C10) + règle teamdocs team-scopé

**Sources** : rules-hooks tableau (HOOK-4, HOOK-5), §2 (cascade-delete-*) · schema-client §1 (C10) · différé `!` T6 (teamdoc team-scopé bloqué par createRule)
**Prérequis** : T3/T4 (schéma + rules en place)

## Objectif

Aucun orphelin après suppression d'event ou de team ; les teamdocs d'équipe créables sans event.

## Constats → fixes

- **HOOK-4/C10** : `cascade-delete-event.pb.js` (couvre products, purchases, event_materiel, event_todos, teamdocs, share_links) manque : `materiel_loan` (relation `eventId`) → à supprimer ; `notifications` référençant l'event (json `data` / texte `link`) → purge pragmatique (matcher la présence de l'id d'event dans `link`/`data`).
- **HOOK-5** : `cascade-delete-teams.pb.js` manque : `materiel_loan.ownerId` (= cette team) → supprimer les loans team-scopés (décision : delete, documenter — alternative null écartée : un loan sans équipe n'a pas de sens) ; `events.teams` garde des ids pendants → retirer l'id de la team des arrays JSON `teams` des events (les traversals PB ignorent les morts, mais l'UI affiche des vides).
- **invite-to-team `roles` (différé `!` T8)** : même bug goja que join-event — le hook mute le wrapper `record.get()` du JSON `roles` → corruption de donnée. Fix : `getString("roles")` + `JSON.parse` + `set` avec un array/object JS natif. (Pré-req SMTP absent : valider la logique par sonde structurée, pas par envoi réel.)
- **Teamdocs team-scopé** (différé T6) : `createRule` teamdocs exige `eventId` (membres/guests) → étendre : `@request.body.teamId.members ~ @request.auth.id || (rules eventId existantes)`. Lire la règle snapshot d'abord ; garder la symétrie update/list (vérifier que le créateur voit son doc : listRule teamdocs couvre-t-elle teamId.members ? sinon étendre pareil — documenter).

## Méthode suggérée

1. Sondes curl/scite : créer event + children + loans + notifications → DELETE event → compter 0 orphelin (sqlite3 -readonly) ; idem team (materiel, teamdocs, share_links team, loans ownerId, events.teams nettoyé).
2. Teamdoc : créer un doc team-scopé sans event via curl (membre de la team) → 200 ; le voir en list → 200.
3. `bun run check` (aucun code client attendu — si un changement client s'avère nécessaire : STOP & report).

## Critères

- [x] Cascade event : 0 orphelins loans/notifications (comptes sqlite avant/après loggés)
- [x] Cascade team : 0 orphelin + events.teams nettoyé
- [x] teamdoc team-scopé : create + list OK (membre) / 403 (non-membre) *(matérialisé PB : create non-membre = 400 règle `data:{}`, list = invisible, view = 404 — pattern T4)*
- [x] run.md amendé (journal T10 : verdicts + commandes)
