/// <reference path="../pb_data/types.d.ts" />

// LOCK-1 : les ids de verrous construits côté client (`doc_*`, `event_*`)
// dépassent la limite id 15/alphanumérique -> 400 au create. Relax au
// précédent recipes (1777813747) : pattern ^[a-z0-9_-]+$ max 40.
// + userName : champ envoyé par tous les payloads de pb-locks.ts (champ
// fantôme jusqu'ici, perte silencieuse d'affichage du détenteur).

migrate((app) => {
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

  collection.fields.add(new TextField({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3847261950",
    "max": 0,
    "min": 0,
    "name": "userName",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
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
    "max": 15,
    "min": 15,
    "name": "id",
    "pattern": "^[a-z0-9]+$",
    "presentable": false,
    "primaryKey": true,
    "required": true,
    "system": true,
    "type": "text"
  }));

  collection.fields.removeByName("userName");

  return app.save(collection);
})
