/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_842702175")

  // update field
  collection.fields.addAt(28, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation2957098720",
    "maxSelect": 100,
    "minSelect": 0,
    "name": "permissionWrite",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_842702175")

  // update field
  collection.fields.addAt(28, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation2957098720",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "permissionWrite",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
