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

**Status:** ready-for-agent

- [ ] Éditer store/specs d'un produit existant persiste et se re-rend correctement
      (json natif).
- [ ] Plus d'erreur « Record not found in Dexie » sur update, y compris si le cache
      local ne contient pas encore le record.
- [ ] Test vitest de la sémantique upsert/attach au seam store, vert.
