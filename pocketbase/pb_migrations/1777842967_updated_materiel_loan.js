/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2361424212")

  // update field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1486678152",
    "help": "",
    "hidden": false,
    "id": "relation2307281911",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "materielId",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2361424212")

  // update field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1486678152",
    "help": "",
    "hidden": false,
    "id": "relation2307281911",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "materielId",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
