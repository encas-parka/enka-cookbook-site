# 02: Upsert produit — édition sans « not found in Dexie »

**What to build:** modifier le store ou les specs d'un produit existant persiste et
se re-rend correctement. Le chemin update de la sync collection retrouve le contrat
offline-first d'avant migration : si le record n'est pas encore en cache local, il
est rattaché (ou créé localement) au lieu d'échouer.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §4, item `[!]`
modification produit (« `[pb-sync] Record ... not found in Dexie (products)` » —
sémantique d'upsert absente).

**Blocked by:** 01 (même zone d'écriture store produits + sync collection — écrivain
unique ; les conventions posées par le diagnostic 01 s'appliquent).

**Status:** done (vérifié aux seams HTTP + store ; re-click navigateur = porte T12)

## Diagnostique (12-10 — hérité de T01, affiné par l'interface T02)

Le throw vient de `pb-collection.update` : lecture Dexie obligatoire, aucun
attach/upsert (« `[pb-sync] Record ${id} not found in Dexie` »). L'ancien contrat
ère-Appwrite vivait dans `updateProductBatch` (`appwrite-products.ts`) :
`!isSynced` → `upsertProduct` (create avec l'**id client** — légal en Appwrite,
interdit en PB hors `[a-z0-9]{15}`), isSynced + 404 → fallback upsert. Le portage PB
de l'upsert passe donc par création à id serveur généré + re-key needs (posé par T01
dans `#ensureSyncedProduct`). **Régression découverte au passage** : la conversion
ère `storeInfo` → `store` (champ json) avait été perdue — `updateProductBatch`
mig forwardait `storeInfo` brut (champ inconnu de PB, magasin jamais persisté).

## Fix livré (12-10)

- **Sync collection** (`pb-collection.ts`) : `update` gagne l'**attach** — record
  absent du cache mais présent serveur → miroir Dexie (`getOne`) puis update
  optimiste ; absent des deux → nouvelle erreur typée `RecordNotFoundError` (le
  404-règle PB, lui, continue de prendre le chemin `RecordDeletedError` existant).
  Générique : toutes les collections en bénéficient.
- **Client** (`ProductsStore`) : `#updateWithUpsert` — sur `RecordNotFoundError`,
  matérialise le produit virtuel via `#ensureSyncedProduct` (réutilisation DRY du
  terrain T01 : create id serveur + re-key needs) puis update sur le nouvel id ;
  id inconnu (ni cache, ni serveur, ni besoin) reste une erreur légitime.
  `updateProduct`/`updateProductBatch` retournent l'id résolu ;
  `#toSchemaUpdates` restaure la conversion `storeInfo` → `store` en **json natif**
  (objet direct — PB json field, `safeJsonParse` du rendu accepte les deux formes).
- **Modal** (`ProductModalState`) : `productId` passe en `$state` et suit le re-key
  (`#trackProductId` sur les 8 actions d'écriture) — sans quoi `product` (dérivé de
  `getProductModelById(productId)`) passe à null après matérialisation : modal mort
  (spinner) pour le reste de la session. `createPurchase` retourne aussi l'id résolu.
- **Serveur** : **aucune migration** — la migration T01 `1791700000` couvre déjà
  l'`updateRule` (clause créateur sur les 5 règles des 2 collections). Sonde
  `scripts_dev/probe-t02-products.ts` : PATCH produit du créateur (0 team, non
  guest) → **200** ; PATCH `store` json natif → **200**, round-trip objet ; contrôle
  produit non couvert → **404** (sémantique de règle). Logs :
  `/tmp/orchestrate/probe-t02-after-26-10-12.log`.
- **Tests** : `products-store-update-upsert.test.ts` (5) — upsert virtuel pur
  (id `cannelle_*`), conversion storeInfo, attach sans doublon, id inconnu, garde
  du chemin optimiste. Rouge avant fix (3 échecs attendus :
  `/tmp/orchestrate/tests-products-upsert-red-26-10-12.log`), suite complète
  141/141, check 0 erreur (canon inchangé côté warnings).

> Re-click navigateur du flux d'édition (modal store/stock/who sur produit virtuel
> et synchronisé) : porte d'intégration T12.

- [x] Éditer store/specs d'un produit existant persiste et se re-rend correctement
      (json natif).
      *(Vérifié aux seams : sonde HTTP PATCH `store` json natif → 200 round-trip
      objet ; vitest conversion `storeInfo` → `store` + re-rendu enrichi parsé.
      Régression de conversion era storeInfo→store réparée au passage.)*
- [x] Plus d'erreur « Record not found in Dexie » sur update, y compris si le cache
      local ne contient pas encore le record.
      *(Attach générique dans `pb-collection.update` (cache en retard) + create-
      avant-update pour le produit virtuel pur (`cannelle_*`, jamais poussé) —
      vitest attach et upsert verts.)*
- [x] Test vitest de la sémantique upsert/attach au seam store, vert.
      *(`products-store-update-upsert.test.ts`, 5 tests ; suite complète 141/141,
      19 fichiers.)*
