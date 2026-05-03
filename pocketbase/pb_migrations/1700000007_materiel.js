migrate(
  function (txApp) {
    var teamsId = txApp.findCollectionByNameOrId("teams").id;
    var collection = new Collection({
      name: "materiel",
      type: "base",
      listRule:
        '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      viewRule:
        '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      createRule: '@request.auth.id != ""',
      updateRule:
        '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        { name: "name", type: "text", required: true },
        { name: "type", type: "select", values: ["electronic", "manual", "other", "tools", "dish", "gaz", "cooking", "hygiene"], maxSelect: 1 },
        { name: "description", type: "text" },
        {
          name: "ownerUser",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        {
          name: "teamId",
          type: "relation",
          collectionId: teamsId,
          maxSelect: 1,
        },
        { name: "status", type: "select", values: ["ok", "lost", "torepair"], maxSelect: 1 },
        { name: "deleted", type: "bool" },
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
    var col = txApp.findCollectionByNameOrId("materiel");
    txApp.delete(col);
  },
);
