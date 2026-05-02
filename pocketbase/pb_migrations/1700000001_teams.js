migrate(
  function (txApp) {
    var collection = new Collection({
      name: "teams",
      type: "base",
      listRule: '@request.auth.id != "" && members ?= @request.auth.id',
      viewRule: '@request.auth.id != "" && members ?= @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && members ?= @request.auth.id',
      deleteRule: '@request.auth.id != "" && members ?= @request.auth.id',
      fields: [
        { name: "name", type: "text", required: true },
        {
          name: "members",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 999,
        },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("teams");
    txApp.delete(col);
  },
);
