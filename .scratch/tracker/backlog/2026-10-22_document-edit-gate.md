# Gate d'édition manquante sur les sous-pages document d'un événement

> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: bug · Urgence: soon · Source: code-review du ticket 01 participation-rsvp (commit 38c0c336) · Ancre: `svelte-app/src/lib/routes/EventDocumentEditPage.svelte:123`

## Constat

Le modèle RSVP pose un point de passage unique d'édition : créateur ou participant confirmé (`EventsStore.canUserEditEvent`), utilisé par les six pages event. Les sous-pages document y échappent :

- `EventDocumentEditPage.svelte:123` — `canEdit = online && !isLockedByOthers && !isLoading && !isAcquiringLock && !isSaving` : le verrou (`locks`) ne gère que la concurrence, pas l'autorisation. Aucun test de participation.
- `EventDocumentCreatePage.svelte` et `EventDocumentEditRoute.svelte` à vérifier (même famille de routes `/event/:id/document/*`).

## Impact

Un invité virtuel, un décliné — voire tout invité par le lien de partage — peut ouvrir l'édition d'un document par URL directe (`/event/:id/document/:docId/edit`) et écrire. Les règles `teamdocs` côté serveur sont volontairement larges (visibilité = édition pour les documents, cf. `docs/pocketbase_collections.md`), donc rien ne bloque l'écriture. La spec du lot (`spec.md`, Implementation Decisions « Édition sur confirm : … Toutes les pages event utilisent ce point unique ») est contredite pour cette branche de routes.

## Reco

Passer `EventDocumentEditPage` (et pages sœurs) par la gate du store en plus du verrou : la page exige `canUserEditEvent` pour autoriser l'édition, le verrou continuant de porter la concurrence. Item click-through associé : vérifier qu'un invité ne peut pas atteindre l'édition d'un document par URL directe.

Nota : l'ADR du lot (« le RSVP porte l'accès côté client, les règles serveur restent volontairement grossières ») couvre la grossièreté serveur, pas l'absence de gate client — le trou côté client reste à corriger.
