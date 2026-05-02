migrate(
  function (txApp) {
    var collection = new Collection({
      name: "notifications",
      type: "base",
      listRule: '@request.auth.id != "" && userId = @request.auth.id',
      viewRule: '@request.auth.id != "" && userId = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: "userId",
          type: "relation",
          collectionId: "_pb_users_auth_",
          required: true,
          maxSelect: 1,
        },
        { name: "type", type: "text" },
        { name: "title", type: "text" },
        { name: "message", type: "text" },
        { name: "read", type: "bool" },
        { name: "data", type: "json" },
        { name: "link", type: "text" },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("notifications");
    txApp.delete(col);
  },
);
