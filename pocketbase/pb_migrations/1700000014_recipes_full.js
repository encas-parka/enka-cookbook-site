// Phase A1 — Drop & recreate "recipes" with full schema
// Replaces 1700000005_recipes.js (incomplete: missing 18 fields, had 3 wrong fields)
migrate(
  function (txApp) {
    // 1. Drop old collection if exists (from migration 1700000005)
    var old = txApp.findCollectionByNameOrId("recipes");
    if (old) {
      txApp.delete(old);
    }

    // 2. Create with full schema (without self-referencing rootRecipeId)
    var collection = new Collection({
      name: "recipes",
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: '@request.auth.id != ""',
      updateRule:
        '@request.auth.id != "" && (@request.auth.id = createdBy || permissionWrite ?= @request.auth.id)',
      deleteRule:
        '@request.auth.id != "" && @request.auth.id = createdBy',
      fields: [
        // --- Core ---
        { name: "title", type: "text", required: true },
        { name: "description", type: "text" },
        { name: "ingredients", type: "json" },
        { name: "preparation", type: "text" },
        { name: "typeR", type: "select", maxSelect: 1, values: ["entree", "plat", "dessert", "autre"] },
        { name: "categories", type: "json" },
        // --- Relations ---
        {
          name: "createdBy",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        { name: "auteur", type: "text" },
        { name: "lockedBy", type: "text" },
        // --- Metadata ---
        { name: "plate", type: "number" },
        { name: "draft", type: "bool" },
        { name: "regime", type: "json" },
        { name: "publishedAt", type: "date" },
        { name: "teams", type: "json" },
        { name: "materiel", type: "json" },
        { name: "prepAlt", type: "json" },
        { name: "region", type: "text" },
        { name: "cuisson", type: "bool" },
        { name: "quantite_desc", type: "text" },
        { name: "check", type: "bool" },
        { name: "preparation24h", type: "text" },
        // --- Permissions & sharing ---
        { name: "permissionWrite", type: "json" },
        { name: "serveHot", type: "bool" },
        { name: "saison", type: "json" },
        { name: "astuces", type: "json" },
        // --- Status & versioning ---
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["public", "private", "deleted"],
        },
        { name: "versionLabel", type: "text" },
      ],
    });
    txApp.save(collection);

    // 3. Add self-referencing rootRecipeId (fork source) — needs collection to exist first
    var saved = txApp.findCollectionByNameOrId("recipes");
    saved.fields.add(
      new RelationField({
        name: "rootRecipeId",
        collectionId: saved.id,
        maxSelect: 1,
      }),
    );
    txApp.save(saved);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("recipes");
    if (col) {
      txApp.delete(col);
    }
  },
);
