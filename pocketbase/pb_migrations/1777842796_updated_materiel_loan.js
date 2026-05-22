/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2361424212")

  // remove field
  collection.fields.removeById("relation3764321573")

  // add field
  collection.fields.addAt(10, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1568971955",
    "help": "",
    "hidden": false,
    "id": "relation1441682881",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "ownerId_copy",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2361424212")

  // add field
  collection.fields.addAt(10, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation3764321573",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "ownerId",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // remove field
  collection.fields.removeById("relation1441682881")

  return app.save(collection)
})
