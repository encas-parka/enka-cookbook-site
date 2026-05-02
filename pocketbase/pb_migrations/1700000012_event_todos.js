migrate(
  function (txApp) {
    var eventsId = txApp.findCollectionByNameOrId("events").id;
    var collection = new Collection({
      name: "event_todos",
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
        { name: "task", type: "text", required: true },
        { name: "taskOn", type: "date" },
        { name: "priority", type: "text" },
        { name: "status", type: "text" },
        {
          name: "assignedTo",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("event_todos");
    txApp.delete(col);
  },
);
