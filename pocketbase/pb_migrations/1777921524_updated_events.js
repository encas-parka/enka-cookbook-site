/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1687431684")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (teams.members ~ @request.auth.id || guestEmails ~ @request.auth.email)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1687431684")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (guestEmails ?= @request.auth.email || joinToken = @request.query.joinToken)"
  }, collection)

  return app.save(collection)
})
