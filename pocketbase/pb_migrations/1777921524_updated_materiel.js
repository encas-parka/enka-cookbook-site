/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1486678152")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (ownerUser = @request.auth.id || teamId.members ~ @request.auth.id)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1486678152")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)"
  }, collection)

  return app.save(collection)
})
