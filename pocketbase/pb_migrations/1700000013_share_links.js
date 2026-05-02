migrate(
  function (txApp) {
    var collection = new Collection({
      name: "share_links",
      type: "base",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: "target_id", type: "text" },
        { name: "link_type", type: "text" },
        { name: "isActive", type: "bool" },
        { name: "token", type: "text" },
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
    var col = txApp.findCollectionByNameOrId("share_links");
    txApp.delete(col);
  },
);
