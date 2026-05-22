migrate(
  function (txApp) {
    // Collections that need system fields (excluding 'users' which already has them)
    var collections = [
      "teams", "events", "teamdocs", "products", "purchases",
      "materiel", "materiel_loan", "event_materiel", "event_todos",
      "notifications", "share_links", "locks", "recipes"
    ];

    for (var i = 0; i < collections.length; i++) {
      var col = txApp.findCollectionByNameOrId(collections[i]);
      if (!col) {
        console.log("  ⚠️ Collection not found: " + collections[i]);
        continue;
      }

      // Add 'created' field (only on creation)
      var createdField = col.fields.getByName("created");
      if (!createdField) {
        col.fields.add(new AutodateField({
          name: "created",
          onCreate: true,
          onUpdate: false
        }));
        console.log("  ✅ Added 'created' to " + collections[i]);
      }

      // Add 'updated' field (on creation and updates)
      var updatedField = col.fields.getByName("updated");
      if (!updatedField) {
        col.fields.add(new AutodateField({
          name: "updated",
          onCreate: true,
          onUpdate: true
        }));
        console.log("  ✅ Added 'updated' to " + collections[i]);
      }

      txApp.save(col);
    }

    console.log("✅ Migration up: System fields added to all collections");
  },
  function (txApp) {
    // Rollback: Remove system fields
    // ⚠️ NOTE: fields.remove() may not work in JSVM (Goja engine limitation)
    // If this fails, you'll need to manually recreate the collections without these fields
    var collections = [
      "teams", "events", "teamdocs", "products", "purchases",
      "materiel", "materiel_loan", "event_materiel", "event_todos",
      "notifications", "share_links", "locks", "recipes"
    ];

    for (var i = 0; i < collections.length; i++) {
      var col = txApp.findCollectionByNameOrId(collections[i]);
      if (!col) continue;

      var createdField = col.fields.getByName("created");
      if (createdField) {
        try {
          col.fields.remove(createdField.id);
          console.log("  ✅ Removed 'created' from " + collections[i]);
        } catch (e) {
          console.log("  ❌ Failed to remove 'created' from " + collections[i] + ": " + e);
        }
      }

      var updatedField = col.fields.getByName("updated");
      if (updatedField) {
        try {
          col.fields.remove(updatedField.id);
          console.log("  ✅ Removed 'updated' from " + collections[i]);
        } catch (e) {
          console.log("  ❌ Failed to remove 'updated' from " + collections[i] + ": " + e);
        }
      }

      try {
        txApp.save(col);
      } catch (e) {
        console.log("  ❌ Failed to save " + collections[i] + ": " + e);
      }
    }

    console.log("⚠️ Migration down: Attempted to remove system fields");
  }
);
