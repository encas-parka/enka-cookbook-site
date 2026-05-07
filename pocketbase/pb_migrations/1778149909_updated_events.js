/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1687431684")

  // update field
  collection.fields.addAt(15, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation2900207531",
    "maxSelect": 100,
    "minSelect": 0,
    "name": "guestUsers",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1687431684")

  // update field
  collection.fields.addAt(15, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation2900207531",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "guestUsers",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
