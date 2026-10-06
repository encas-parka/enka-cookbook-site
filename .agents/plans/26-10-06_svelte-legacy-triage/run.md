# Run — triage & fix des erreurs svelte héritées (`check-legacy`)

**Mode** : mini-run persistant (1 ticket), autorisé par l'utilisateur le 06-10 (extension du run audit-fixes, périmètre nouveau).
**Source** : breakdown des erreurs `/tmp/orchestrate/legacy-breakdown-06-10.log` (baseline 189) + demandes de l'utilisateur.

## Header — état du monde

- **Base** : `9bd8eb28` (clôture audit-fixes). **Branch** : `mig/pocketbase`. Arbre : propre (données non trackées `scripts_dev/pb-import/` hors scope).
- **Canons** : `bun run check` 0 err/6 warn (ne doit pas bouger) · `bun run test` **94/94** (doit rester vert) · `check-legacy` **189** (baseline à ABAISSER — c'est l'objet du run ; nouveau baseline loggé).
- **Concurrency LIVE** : un second agent travaille EN PARALLÈLE dans `scripts_dev/` + `pocketbase/` (re-import de données) — zones disjointes par construction. NE TOUCHE à rien hors `svelte-app/src/**` (+ tests). Si des edits étrangers apparaissent DANS ta zone → STOP & report. Pas de `bun run build` pendant ce run (l'orchestrateur build en portail final).

## Critères de fin

- [ ] Triage exhaustif des 189 → table classée (crash-risque / dette-types / bruit) dans run.md
- [ ] Classe crash-risque fixée (tests quand peu coûteux, non-vacuité prouvée sinon)
- [ ] Nouveau baseline check-legacy loggé + canon vert
- [ ] run.md amendé ; commits conventionnels en tiers
