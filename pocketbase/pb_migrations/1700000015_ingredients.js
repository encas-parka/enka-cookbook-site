// Phase A2 — Create "ingredients" collection
// Replaces static ingredients.json — CRUD + realtime + offline sync
migrate(
  function (txApp) {
    var collection = new Collection({
      name: "ingredients",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: "uuid", type: "text", required: true },
        { name: "name", type: "text", required: true },
        {
          name: "type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            "legumes",
            "sec",
            "epices",
            "lof",
            "autres",
            "sucres",
            "animaux",
            "frais",
          ],
        },
        { name: "allergens", type: "json" },
        { name: "pF", type: "bool" },
        { name: "pS", type: "bool" },
        { name: "saisons", type: "json" },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_ingredients_uuid ON ingredients (uuid)",
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("ingredients");
    if (col) {
      txApp.delete(col);
    }
  },
);
