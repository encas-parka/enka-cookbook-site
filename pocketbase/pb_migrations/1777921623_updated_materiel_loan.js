/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2361424212")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (borrowerUser = @request.auth.id || ownerId.members ~ @request.auth.id)",
    "updateRule": "@request.auth.id != \"\" && (borrowerUser = @request.auth.id || ownerId.members ~ @request.auth.id)",
    "viewRule": "@request.auth.id != \"\" && (borrowerUser = @request.auth.id || ownerId.members ~ @request.auth.id)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2361424212")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)",
    "updateRule": "@request.auth.id != \"\" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)",
    "viewRule": "@request.auth.id != \"\" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)"
  }, collection)

  return app.save(collection)
})
