# T3 — Deltas schéma : locks (id relax + userName), teams (5 champs), share_links.createdBy, events (description, minContrib)

**Sources** : LOCK-1 + SEC-2 (locks) · DIV-1 + B1/B2 + HOOK-7 (teams) · B3 (share_links) · A1/B5 + UI-2 (events) · corrections enveloppe dans run.md
**Prérequis** : T1 (snapshot), T2 (les timestamps se succèdent proprement)

## Objectif

Ré-ajouter par **nouvelles migrations** (jamais éditer les fichiers existants) ce que la DB dev a perdu alors que l'intention client/hook est claire :

| Collection | Ajout | Pourquoi |
|---|---|---|
| `locks` | pattern id relaxé `^[a-z0-9_-]+$` max 40 (précédent : `1777813747` recipes) + champ texte `userName` | LOCK-1 (ids `doc_*`/`event_*` rejetés) + bug connu #3 (payloads userName) |
| `teams` | `createdBy` (relation users), `roles` (json), `description` (text), `city` (text), `isPublic` (bool) | B1/B2 + HOOK-7 : écrits par `NativeTeamsStore` et `invite-to-team.pb.js`, déclarés en 1700000001 |
| `share_links` | `createdBy` (relation users) | B3 + prérequis REC-1 (T4) : `pb-invitations.ts:28` l'envoie déjà |
| `events` | `description` (text), `minContrib` (number) | A1/B5 : l'UI crée/édite ces valeurs (`EventCreatePage`, `EventEditPage` L550-567) |

**PAS de ré-ajout `teamdocs`** (drop explicite 1700000029 — décision enveloppe, cf. run.md ; fix B4 sera côté client en T6).

## Méthode suggérée

1. **Backup `pb_data`** → `/tmp/orchestrate/pb_data-backup-t3/`.
2. Une migration par thème (lisibilité) ou une seule — au choix, timestamps croissants.
3. Appliquer dev, boot, sondes curl (auth user de test) :
   - `POST locks` id `doc_test123456789` + `userName` → **200** ; delete ensuite.
   - `PATCH teams/<id>` `{"roles": {...}, "description": "x"}` → **200** (HOOK-7 débloqué).
   - `POST share_links` avec `createdBy` → **200** (B3 débloqué).
   - `POST events` avec `description`/`minContrib` → **200**.
4. `bun run generate-types` + `bun run check` au canon.
5. Client : **aucun changement de code ici** (les payloads existants deviennent valides) — sauf si le typegen révèle un écart de type bloquant (`pb.d.ts` vs `pb-generated.ts`), le noter dans run.md (le nettoyage types = tickets client).

## Critères

- [x] Migrations delta appliquées (backup fait) ; 4 sondes curl vertes loggées dans run.md
- [x] `pb-generated.ts` régénéré ; `pb.d.ts` écartés documentés (fix en T5/T6)
- [x] `bun run check` au canon (0 erreur / 6 warnings connus)
- [x] run.md amendé (journal T3)
