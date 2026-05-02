migrate(
  function (txApp) {
    var eventsId = txApp.findCollectionByNameOrId("events").id;
    var collection = new Collection({
      name: "products",
      type: "base",
      listRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      viewRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      createRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      updateRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      deleteRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      fields: [
        {
          name: "eventId",
          type: "relation",
          collectionId: eventsId,
          required: true,
          maxSelect: 1,
        },
        { name: "productHugoUuid", type: "text" },
        { name: "productName", type: "text" },
        { name: "productType", type: "text" },
        { name: "pF", type: "bool" },
        { name: "pS", type: "bool" },
        { name: "store", type: "json" },
        { name: "specs", type: "json" },
        { name: "status", type: "text" },
        { name: "deleted", type: "bool" },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("products");
    txApp.delete(col);
  },
);
