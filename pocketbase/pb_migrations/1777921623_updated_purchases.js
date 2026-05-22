/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3461338982")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\" && (eventId.teams.members ~ @request.auth.id || eventId.guestEmails ~ @request.auth.email)",
    "deleteRule": "@request.auth.id != \"\" && (eventId.teams.members ~ @request.auth.id || eventId.guestEmails ~ @request.auth.email)",
    "listRule": "@request.auth.id != \"\" && (eventId.teams.members ~ @request.auth.id || eventId.guestEmails ~ @request.auth.email || (eventId.joinToken != \"\" && eventId.joinToken = @request.query.joinToken))",
    "updateRule": "@request.auth.id != \"\" && (eventId.teams.members ~ @request.auth.id || eventId.guestEmails ~ @request.auth.email)",
    "viewRule": "@request.auth.id != \"\" && (eventId.teams.members ~ @request.auth.id || eventId.guestEmails ~ @request.auth.email || (eventId.joinToken != \"\" && eventId.joinToken = @request.query.joinToken))"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3461338982")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\" && @collection.events.guestEmails ?= @request.auth.email",
    "deleteRule": "@request.auth.id != \"\" && @collection.events.guestEmails ?= @request.auth.email",
    "listRule": "@request.auth.id != \"\" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)",
    "updateRule": "@request.auth.id != \"\" && @collection.events.guestEmails ?= @request.auth.email",
    "viewRule": "@request.auth.id != \"\" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)"
  }, collection)

  return app.save(collection)
})
