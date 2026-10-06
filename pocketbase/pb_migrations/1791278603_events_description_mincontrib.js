/// <reference path="../pb_data/types.d.ts" />

// A1/B5 : EventCreatePage/EventEditPage créent et éditent description et
// minContrib (auto-save inclus) — champs fantômes jusqu'ici (rejet 400 ou
// perte silencieuse). Typage : description text, minContrib number libre.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("events");

  collection.fields.add(new TextField({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text6104938275",
    "max": 0,
    "min": 0,
    "name": "description",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  collection.fields.add(new NumberField({
    "help": "",
    "hidden": false,
    "id": "number4209183756",
    "max": null,
    "min": null,
    "name": "minContrib",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("events");

  collection.fields.removeByName("description");
  collection.fields.removeByName("minContrib");

  return app.save(collection);
})
