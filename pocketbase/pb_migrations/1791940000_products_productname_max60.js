/// <reference path="../pb_data/types.d.ts" />

// products.productName borné à 60 caractères — l'identité métier du produit
// entre dans la dérivation de l'id sémantique (slug complet du nom + eventId
// ≤ 76 = borne products.id) et dans l'index d'unicité (eventId, productName).
// Données migrées sans rattrapage : max réel mesuré 13-10 sur le dev =
// 39/1001 lignes. Même forme que les migrations console de contraintes qui
// précèdent (required 1791920000, ids 1791887561→1791933669).

migrate((app) => {
  const collection = app.findCollectionByNameOrId("products")

  // update field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1398119645",
    "max": 60,
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
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
