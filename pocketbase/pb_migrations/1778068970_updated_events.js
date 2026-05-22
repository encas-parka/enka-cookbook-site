/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1687431684")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id)",
    "viewRule": "@request.auth.id != \"\" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id)"
  }, collection)

  // remove field
  collection.fields.removeById("text1384887229")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1687431684")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id || (joinToken != \"\" && joinToken = @request.query.joinToken))",
    "viewRule": "@request.auth.id != \"\" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id || (joinToken != \"\" && joinToken = @request.query.joinToken))"
  }, collection)

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1384887229",
    "max": 0,
    "min": 0,
    "name": "joinToken",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
