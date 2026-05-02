migrate(
  function (txApp) {
    var teamsId = txApp.findCollectionByNameOrId("teams").id;
    var eventsId = txApp.findCollectionByNameOrId("events").id;
    var collection = new Collection({
      name: "teamdocs",
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
          name: "teamId",
          type: "relation",
          collectionId: teamsId,
          maxSelect: 1,
        },
        {
          name: "eventId",
          type: "relation",
          collectionId: eventsId,
          maxSelect: 1,
        },
        { name: "title", type: "text" },
        { name: "content", type: "text" },
        { name: "status", type: "text" },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("teamdocs");
    txApp.delete(col);
  },
);
