migrate(
  function (txApp) {
    var collection = new Collection({
      name: "teams",
      type: "base",
      listRule: '@request.auth.id != "" && members ?= @request.auth.id',
      viewRule: '@request.auth.id != "" && members ?= @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && (createdBy = @request.auth.id || members ?= @request.auth.id)',
      deleteRule: '@request.auth.id != "" && members ?= @request.auth.id',
      fields: [
        { name: "name", type: "text", required: true },
        {
          name: "members",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 999,
        },
        {
          name: "createdBy",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        {
          name: "description",
          type: "text",
        },
        {
          name: "city",
          type: "text",
        },
        {
          name: "isPublic",
          type: "bool",
        },
        {
          name: "roles",
          type: "json",
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
