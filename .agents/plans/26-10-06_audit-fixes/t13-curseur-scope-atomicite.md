# T13 — Curseur scopé + atomicité (port Étapes 2+3) — cœur du portage

**Sources** : port-hardening §3.A (divergence curseur), Étapes 2 et 3, pièges §5 ; synthèse Lot 4 items 2-3
**Prérequis** : t12 (harness — les scénarios multi-événements se valident par tests)

## Objectif

Éliminer la perte de données silencieuse : `pb-collection.ts` ne persiste aucun curseur — `since = max(updated)` de TOUTE la table Dexie, donc la 1re ouverture d'un event ancien après synchro d'un récent ne fetch jamais ses records. Port du curseur `syncMeta` scopé + transaction atomique.

## Étape 2 — ProductsStore robustesse

- `forceReload()` : `clearLocal()` products/purchases avant `initialize()`.
- `clearCache()` : `db.productNeeds.where("eventId").equals(...)` au lieu de `.clear()` — **vérifier le nom d'index réel** (le rapport dit que `productNeeds` garde `mainId` malgré le rename v7 : mesurer, pas croire).
- `syncFromRemote` en `Promise.allSettled` (ne mettre à jour `#lastSync` que si tout réussit).

## Étape 3 — Curseur scopé (le cœur)

- `pb-collection.ts` `initialFetch()` : lit/écrit `db.syncMeta` (clé `${collectionName}:${scopeKey}`) ; **transaction unique** `db.transaction('rw', [table, db.syncMeta], …)` englobant upsert + curseur ; filtre delta `updated >= {:since}` ; **conserver** le fallback « delta 0 + table vide → full fetch ».
- `pb-types.ts` : `scopeKey?: string` dans `PbFetchOptions`.
- `aw-db.ts` : bump **v10** (`stores({})`) pour purger les caches incomplets hérités du curseur dérivé (vérifier si `syncMeta` est déjà déclarée — audit dit « table existante, inutilisée » ; le bump vise surtout la purge des caches clients existants).
- `clearLocal()` : supprime `syncMeta` **par préfixe** (clés scopées).
- Stores : passer `scopeKey` là où un filtre est utilisé (`ProductsStore` eventId, `EventMaterielStore` eventId, grep les autres `initialFetch` filtrés).

## À conserver (ne pas écraser)

Batch natif, list/view, stripSystemFields, souscriptions SSE filtrées server-side, sécurité M4, fallback table vide.

## Validation (via t12)

Scénarios tests : event1 (ancien) sync → event2 (récent) sync → **retour event1 → records de event1 bien fetchés** (le bug actuel) ; offline ; idempotence (2e sync = 0 upserts). Le hors-ligne et le multi-scope sont LES cas à couvrir.

## Critères

- [ ] `syncMeta` écrit/lu en transaction atomique avec les upserts (test le prouve)
- [ ] Scénario multi-événements vert (test) ; idempotence delta verte (test)
- [ ] Dexie v10 bumpé (ou justification mesurée d'un non-bump) ; fallback conservé (test)
- [ ] Étape 2 appliquée (index `productNeeds` vérifié par mesure)
- [ ] scopeKey passé dans les stores filtrés (grep) ; canons verts (check/test/check-legacy delta 0) ; run.md amendé (journal T13)
