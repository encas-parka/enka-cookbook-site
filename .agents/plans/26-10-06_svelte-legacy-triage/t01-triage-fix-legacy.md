# T01 — Triage et fix des 189 erreurs `check-legacy`

**Sources** : `/tmp/orchestrate/legacy-breakdown-06-10.log` (répartition par type) · run.md du run
**Zone** : `svelte-app/src/**` exclusivement

## Constats → objectifs

| Classe | ~Count | Décision par défaut |
|---|---|---|
| Type-only export utilisé comme valeur (ex. `EventTodoPriority`, `events.d.ts:13` → UI eventTodo) | 10 | **Crash-risque** : définir des const/enum valeurs côté client (le shape JSON des todos est écrit par le client — cf. audit schema §5/§9) — fix mécanique |
| « This expression is not callable » | 7 | **Crash-risque** : investiguer au cas par cas |
| Cluster `{}` (length/includes/iterable/index) — teamdocs `tags`/`EnrichedTeamdoc` | ~27 | **Trou de type cohérent** : le schéma teamdocs a volontairement perdu `tags` (drop 1700000029) — nettoyer le code mort client et réparer `EnrichedTeamdoc` (une correction unique) |
| `string \| null` / `number \| null` / `boolean \| undefined` non assignables | ~31 | **Risques null-safety** : trier — garde réelle quand la valeur peut être null à runtime, cast assumé sinon (documenter) |
| Overloads / excess properties / reste | ~114 | Dette de strictitude : fix par lots de module si mécanique, sinon différé documenté |

## Contraintes

- Aucun changement de comportement non couvert par le triage (pas de refactor opportuniste).
- Canons : check 0/6 (ne pas dégrader), test 94/94 (verts — ajouter des tests si un fix s'y prête).
- Les décisions « cast assumé » doivent citer la raison (invariant, guard existant).
- Si un fix exigerait un changement de schéma PB ou de `scripts_dev/` (zone du run parallèle) → différer dans run.md, PAS de fix.

## Critères

- [x] Table de triage complète (189 lignes regroupées, verdicts) dans run.md
- [x] Crash-risque fixé (cluster C1+C2+C5+RecipeHeaderForm) ; tests (10 nouveaux, preuve rouge→vert) ou preuves de non-vacuité
- [x] Null-safety triée (gardes réelles vs casts documentés — cf. table run.md)
- [x] Nouveau baseline check-legacy : **0** (objectif ≤60 largement tenu), tous classés
- [x] Canons verts (check 0/6, test 104/104) ; run.md amendé ; commits en tiers (9)
