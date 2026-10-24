# 01: Schéma — compteur de réparation, backfill conservateur, pipeline d'import

**What to build:** le schéma `materiel` gagne un compteur d'exemplaires en
réparation, rétroalimenté par un backfill conservateur des statuts existants
(« à réparer » → tout l'item en réparation ; « perdu » → stock à 0), et le
pipeline d'import Appwrite→PocketBase écrit ces compteurs pour que le rejeu
au cutoff produise le nouveau modèle. Lot purement additif : l'app ne change
pas, tout reste vert — le champ statut vit encore (sa suppression est le
ticket 06).

Références : spec `.scratch/tracker/26-10-24_materiel-damage-granularity/spec.md` · ADR 0003.
Zone : `pocketbase/pb_migrations/` (delta après `1792600000`), `scripts_dev/2-transform-data.ts`, regen types (`bun run generate-types`).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Migration delta idempotante : `repairQuantity` ajouté sur `materiel` (entier ≥ 0, défaut 0)
- [x] Backfill conservateur des données existantes : items « à réparer » → `repairQuantity = quantity` ; items « perdus » → `quantity = 0` ; le champ `status` n'est pas modifié ni supprimé ici
- [x] Transform d'import : même mapping appliqué aux données source ; `status` toujours écrit (contrat au ticket 06)
- [x] Types régénérés ; `bun run check:app` vert sans aucun autre changement d'app
- [!] Re-run du pipeline de migration local (`scripts_dev/migrate.ts`) : verdicts verts, sans divergence
  - 85/86 checks, 0 déviation sans verdict. L'unique échec (`guestEmails: 0/34`) est
    **antérieur à ce ticket** : le champ a été supprimé du schéma le 22-10 (commit
    3f005fb4) alors que le transform l'écrit encore et que le validateur le contrôle
    toujours. Aucun lien avec `materiel`. Entrée backlog :
    `.scratch/tracker/backlog/26-10-24_validation-guestemails-champ-supprime.md`.
- [x] Vocabulaire et mapping conformes au glossaire (`manquant`, jamais `perdu`, dans tout nouveau texte)

## Comments
