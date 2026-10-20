/// <reference path="../pb_data/types.d.ts" />

// LOCK-3 : les verrous de recettes construisent leur resourceId côté client
// (`recipe_<slug>_<uuid>` avec le slug d'import) — 42+ caractères, au-delà de
// la borne id 40 posée par LOCK-1 pour doc_*/event_* : le create renvoyait
// 400 et aucun verrou de recette ne pouvait se poser. Borne portée à 255 ;
// pattern et min inchangés.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("locks");

  collection.fields.addAt(0, new Field({
    "autogeneratePattern": "[a-z0-9]{15}",
    "help": "",
    "hidden": false,
    "id": "text3208210256",
    "max": 255,
    "min": 15,
    "name": "id",
    "pattern": "^[a-z0-9_-]+$",
    "presentable": false,
    "primaryKey": true,
    "required": true,
    "system": true,
    "type": "text"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("locks");

  collection.fields.addAt(0, new Field({
    "autogeneratePattern": "[a-z0-9]{15}",
    "help": "",
    "hidden": false,
    "id": "text3208210256",
    "max": 40,
    "min": 15,
    "name": "id",
    "pattern": "^[a-z0-9_-]+$",
    "presentable": false,
    "primaryKey": true,
    "required": true,
    "system": true,
    "type": "text"
  }));

  return app.save(collection);
})
