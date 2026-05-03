migrate(
  function (txApp) {
    var materielId = txApp.findCollectionByNameOrId("materiel").id;
    var eventsId = txApp.findCollectionByNameOrId("events").id;
    var collection = new Collection({
      name: "materiel_loan",
      type: "base",
      listRule:
        '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      viewRule:
        '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      createRule: '@request.auth.id != ""',
      updateRule:
        '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        {
          name: "materielId",
          type: "relation",
          collectionId: materielId,
          required: true,
          maxSelect: 1,
        },
        {
          name: "borrowerUser",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        {
          name: "eventId",
          type: "relation",
          collectionId: eventsId,
          maxSelect: 1,
        },
        { name: "startDate", type: "date" },
        { name: "endDate", type: "date" },
        { name: "status", type: "select", values: ["asked", "accepted", "refused", "canceled", "returned", "completed", "archived"], maxSelect: 1 },
        {
          name: "createdBy",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("materiel_loan");
    txApp.delete(col);
  },
);
