migrate(
  function (txApp) {
    var collection = new Collection({
      name: "recipes",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        { name: "title", type: "text", required: true },
        { name: "description", type: "text" },
        { name: "ingredients", type: "json" },
        { name: "steps", type: "json" },
        { name: "typeR", type: "text" },
        { name: "categories", type: "json" },
        { name: "published", type: "bool" },
        {
          name: "createdBy",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        { name: "auteur", type: "text" },
        { name: "yield", type: "json" },
        { name: "lockedBy", type: "text" },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("recipes");
    txApp.delete(col);
  },
);
