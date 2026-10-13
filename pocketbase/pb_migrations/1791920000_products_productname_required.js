/// <reference path="../pb_data/types.d.ts" />

// products.productName requis — le nom est l'identité métier du produit
// (affichage liste de courses, dérivation des ids sémantiques). La sœur
// (enka-cookbook-site) porte déjà ce requis ; les données migrées n'ont
// aucune ligne vide (mesuré 13-10 sur le dev : 0/993 — pas de backfill).
// Seul le flag required change : min/max/pattern inchangés. Vient compléter
// les migrations console de contraintes ids (min abaissé à 11, motif élargi
// au tiret-bas) qui précèdent immédiatement.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("products")

  // update field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1398119645",
    "max": 0,
    "min": 0,
    "name": "productName",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("products")

  // update field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1398119645",
    "max": 0,
    "min": 0,
    "name": "productName",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
