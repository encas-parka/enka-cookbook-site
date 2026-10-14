/// <reference path="../pb_data/types.d.ts" />

// Index d'unicité (eventId, productName) sur products — un seul produit actif
// de ce nom par événement. Le client traduit le 400 `validation_not_unique`
// en message métier (« un produit de ce nom existe déjà dans cet événement »)
// au point de lancement des creates (ProductsStore.createProduct +
// #ensureSyncedProduct) ; la fusion n'écrit jamais de doublon de nom
// (mergedInto sur la source, cible intacte) et un renommage libère son ancien
// nom — coordination prouvée par les suites merge sous contrainte (harnais
// defineUniqueIndexes, même sémantique SQLite).
//
// PRÉREQUIS DONNÉES : la pose échoue tant que des doublons (event, nom)
// existent (mesuré 13-10 sur le dev : 7 paires actives issues de doubles
// créations manuelles successives — aucune fusionnée). Assainir AVANT
// d'appliquer (fusion manuelle + remappage des achats), sinon `migrate up`
// rejette la migration.

migrate((app) => {
  addIndex(app, "products", "idx_products_event_name_unique", "CREATE UNIQUE INDEX `idx_products_event_name_unique` ON `products` (`eventId`, `productName`)");
}, (app) => {
  removeIndex(app, "products", "idx_products_event_name_unique");
})

// Reassigne un tableau JS neuf (jamais de mutation du wrapper goja) ;
// idempotent : skip si le nom est déjà présent. Préserve les index existants.
function addIndex(app, collectionName, indexName, ddl) {
  const collection = app.findCollectionByNameOrId(collectionName);
  const current = collection.indexes || [];
  for (var i = 0; i < current.length; i++) {
    if (current[i].indexOf(indexName) !== -1) {
      return;
    }
  }
  const next = [];
  for (var j = 0; j < current.length; j++) {
    next.push(current[j]);
  }
  next.push(ddl);
  collection.indexes = next;
  app.save(collection);
}

// Ne retire que les index nommés — préserve les index étrangers posés
// par ailleurs (down() sélectif, sûr si un autre index a été ajouté entre-temps).
function removeIndex(app, collectionName, indexName) {
  const collection = app.findCollectionByNameOrId(collectionName);
  const current = collection.indexes || [];
  const kept = [];
  var removed = false;
  for (var i = 0; i < current.length; i++) {
    if (current[i].indexOf(indexName) !== -1) {
      removed = true;
      continue;
    }
    kept.push(current[i]);
  }
  if (!removed) {
    return;
  }
  collection.indexes = kept;
  app.save(collection);
}
