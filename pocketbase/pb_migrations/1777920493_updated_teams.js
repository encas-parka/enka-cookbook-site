/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1568971955")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && members ~ @request.auth.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1568971955")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && members ?= @request.auth.id"
  }, collection)

  return app.save(collection)
})
