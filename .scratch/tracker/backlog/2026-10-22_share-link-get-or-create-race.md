# Course TOCTOU sur le get-or-create du lien de partage

> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: debt · Urgence: low · Source: code-review du ticket 02 participation-rsvp (commit eecb972e) · Ancre: `svelte-app/src/lib/services/pb-invitations.ts:38`

## Constat

`getOrEnsureShareLinks` lit puis crée sans garde : la création de l'event (fire-and-forget, `EventsStore.#ensureEventShareLink`) et l'ouverture de la section lien par un second éditeur (`PermissionsManager.loadShareLinks`) peuvent s'entrelacer et créer deux liens actifs pour le même événement. L'affichage n'en montre qu'un ; le doublon reste actif et partageable.

## Impact

Faible : requiert deux acteurs quasi simultanés sur un event sans lien ; la régénération désactive de toute façon tous les liens actifs. Surface de partage légèrement élargie tant que le doublon vit.

## Reco

Garde serveur au ticket 04 (clôture) : index unique partiel sur `share_links (target_id, isActive)` impossible tel quel en PB — un hook `share_links` create qui désactive les liens actifs existants du même `target_id` (le serveur est séquentiel) ferait de la régénération un invariant, plus une étape client.
