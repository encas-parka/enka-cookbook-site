// Phase A3 — Create "categories" collection
// Replaces recipe-info.json materiel[] + categories[] — single collection with type discriminator
migrate(
  function (txApp) {
    var collection = new Collection({
      name: "categories",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: '@request.auth.id != ""',
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "name", type: "text", required: true },
        {
          name: "type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["category", "equipment_tag"],
        },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("categories");
    if (col) {
      txApp.delete(col);
    }
  },
);
