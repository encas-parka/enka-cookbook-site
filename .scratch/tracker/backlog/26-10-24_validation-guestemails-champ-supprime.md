# Validation du pipeline rouge : `guestEmails` contrôlé alors que le champ n'existe plus

> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: bug · Urgence: S2 · Source: ticket 01 materiel-damage-granularity (re-run pipeline 2026-10-24) · Ancre: `scripts_dev/validate-migration.ts:707` et `scripts_dev/2-transform-data.ts:556`

## Constat

La migration `1792600000_events_drop_guest_emails.js` (commit 3f005fb4, 22-10) a supprimé
`events.guestEmails` du schéma. Deux étages du pipeline sont restés en arrière :

- `2-transform-data.ts` continue d'écrire la clé `guestEmails` dans `pb-import/events.json`
  (34 événements sur 39) ;
- `validate-migration.ts` contrôle toujours « 4. guestEmails : chaque événement a ses
  emails invités attendus », en comparant le fichier d'import aux événements PB — qui ne
  portent plus le champ.

Résultat mesuré sur un re-run complet du 24-10 : `❌ guestEmails: 0/34 events have correct
guestEmails`, soit 85/86 checks et un verdict global ROUGE, **sans aucun rapport avec le
changement testé** (le dernier run vert, 2026-10-20, précède la suppression du champ).

## Impact

Le pipeline de migration ne peut plus rendre un verdict vert : le critère de sortie du
cutoff (« re-run avec verdicts verts ») est inatteignable tant que ce contrôle subsiste.
Le bruit masque aussi toute vraie régression sur les événements.

## Reco

Deux gestes dans le même lot : retirer le contrôle `guestEmails` de
`validate-migration.ts` (et sa ligne dans le récap), et cesser d'écrire la clé dans le
payload d'import — la table `guestEmailsLookup` reste nécessaire en amont pour dériver
`guestUsers` (`2-transform-data.ts:593`). Vérifier ensuite qu'aucun verdict de
`expected-verdicts.json` ne référence ce contrôle (aucun aujourd'hui).
