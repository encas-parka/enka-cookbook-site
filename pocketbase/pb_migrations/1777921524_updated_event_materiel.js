/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2044013782")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && eventId.guestEmails ~ @request.auth.email"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2044013782")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)"
  }, collection)

  return app.save(collection)
})
