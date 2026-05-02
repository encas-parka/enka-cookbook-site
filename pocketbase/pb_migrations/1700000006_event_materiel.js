migrate(
  function (txApp) {
    var eventsId = txApp.findCollectionByNameOrId("events").id;
    var collection = new Collection({
      name: "event_materiel",
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
        { name: "type", type: "text" },
        { name: "status", type: "text" },
        { name: "groupId", type: "text" },
        { name: "specs", type: "json" },
        { name: "deleted", type: "bool" },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("event_materiel");
    txApp.delete(col);
  },
);
