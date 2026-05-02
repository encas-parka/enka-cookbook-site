migrate(
  function (txApp) {
    var collection = new Collection({
      name: "locks",
      type: "base",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: "userId",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        { name: "expiresAt", type: "date" },
        { name: "collection", type: "text" },
        { name: "recordId", type: "text" },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("locks");
    txApp.delete(col);
  },
);
