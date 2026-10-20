# ADR 0001 — Delta sync conservé par défaut ; invalidation du curseur pilotée par les événements d'autorisation

Date : 2026-10-20 · Statut : accepté

## Contexte

La couche pb-sync synchronise PocketBase → Dexie par delta `updated >= since`,
curseur persisté par collection/scope dans `syncMeta`
([pb-collection.ts](../../svelte-app/src/lib/db-sync/pb-collection.ts)). Le
delta économise ~99 % du volume de revalidation mesuré (1,9 MiB / ~690 records
en full contre 0–3 records en delta ; revalidation à chaque retour d'onglet

> 30 s, reconnect SSE et online — `svelte-app/src/main.ts`) et surtout ~690
> écritures IndexedDB par revalidation.

Il introduit une classe de bugs : tout record devenu visible par élargissement
d'autorisation **sans être modifié** (join d'event par share link, join
d'équipe) reste invisible — son `updated` précède le curseur, le SSE ne pousse
que les changements, et le fallback full-fetch ne couvre que la table locale
vide. Constaté en production de dev (P12, click-through 20-10 : teamdocs d'un
event invisibles après join) ; le même mécanisme rendait les events d'une
équipe rejointe invisibles pour les caches établis (curseur récent > `updated`
des events).

Les collections dont le curseur est scopé à la granularité de leur règle
d'autorisation (`products`/`purchases`/`event_materiel`, scope = `eventId`)
sont immunes par construction : avant autorisation, aucun curseur n'existe
pour le scope, le premier accès fetch depuis l'époque.

Une seconde classe, plus rare : un `updated` futur (dérive d'horloge serveur,
puis correction NTP) hisse le curseur au-dessus du présent et fait sauter
tous les records écrits après la correction.

## Décision

1. Le delta sync reste le régime par défaut de toutes les collections.
2. **Invariant : la portée d'un curseur delta doit être identique à la portée
   du grant d'autorisation correspondant.** Tout événement qui élargit un
   grant déclenche `resetCursor()` (+ resync) sur les collections concernées :
   - join d'event (share link) → `teamdocs` (en place, fix P12) ;
   - join d'équipe (message SSE `team_joined`) → `events`, `teamdocs`,
     `materiel`, `materiel_loan`.
     Les collections scopées par event n'en ont pas besoin (auto-réparation par
     curseur absent).
3. **Garde anti-poison** : le curseur écrit dans `syncMeta` est plafonné à
   `min(maxUpdated(records), horloge client − 5 min)`, au format PB
   (`YYYY-MM-DD HH:mm:ss.SSSZ` — un plafond au format ISO trierait
   lexiquement au-dessus de tout timestamp PB du même jour).
4. **Procédure** : tout backfill/migration serveur réécrivant `updated` en
   masse impose un signal client — bump de version Dexie (reset des curseurs,
   précédent v10 dans `aw-db.ts`) ou `resetCursor` diffusé.

## Alternatives rejetées

- **Full-refetch systématique** : corrige les deux classes au prix de
  ~1,8 MiB et ~700 upserts IndexedDB par revalidation (~19 s en 4G), payés à
  chaque retour d'onglet, pour une robustesse obtenue autrement pour ~3 lignes
  par événement de grant. Ne change rien aux suppressions (upsert-only :
  convergence par SSE uniquement). Reste l'option de repli si les grants
  devenaient intrçables côté client (multi-tenant lourd, grants dynamiques).
- **Curseur par grant** (une entrée `syncMeta` par couple utilisateur×grant) :
  invariant strictement respecté, mais suppose de connaître et historiser les
  grants côté client (`guestUsers`, memberships) — complexité et surface
  d'erreur supérieures pour un résultat équivalent dans notre régime (grants
  rares et disruptifs).

## Conséquences

- Chaque NOUVEAU déclencheur d'élargissement de périmètre (nouvelle listRule
  fondée sur une relation dynamique) doit appeler `resetCursor` au point
  client correspondant — règle testée unitairement (pattern
  `pb-sync-reset-cursor.test.ts`, wiring `globalstate-team-join-resync.test.ts`).
- Le plafond introduit l'horloge client comme borne haute du curseur —
  analyse de sûreté : `min()` ne peut qu'abaisser le curseur, or un curseur
  abaissé ne fait que re-fetcher (upserts idempotents), jamais sauter. Une
  horloge client fausse (en avance ou en retard) ne produit donc que du
  re-fetch redondant, borné et auto-corrigé — jamais de trou. La chaîne de
  comparaison reste 100 % lexicale sur des chaînes UTC : aucun fuseau client
  n'y entre, aucune conversion de date n'a lieu dans db-sync.
- La procédure backfill (décision 4) engage les opérations serveur : une
  réécriture de masse de `updated` sans signal client produirait des trous
  silencieux identiques à la classe A.
