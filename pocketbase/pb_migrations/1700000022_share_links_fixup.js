// Phase A9a — Fixup "share_links" collection (add missing fields)
// Existing: target_id, link_type, isActive, token, createdBy
// Adding: access_level, expiresAt, maxUses, useCount
migrate(
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("share_links");

    collection.fields.add(new TextField({ name: "access_level" }));
    collection.fields.add(new DateField({ name: "expiresAt" }));
    collection.fields.add(new NumberField({ name: "maxUses" }));
    collection.fields.add(new NumberField({ name: "useCount" }));

    txApp.save(collection);
  },
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("share_links");

    var fieldsToRemove = [
      "access_level",
      "expiresAt",
      "maxUses",
      "useCount",
    ];
    for (var i = 0; i < fieldsToRemove.length; i++) {
      var field = collection.fields.getByName(fieldsToRemove[i]);
      if (field) {
        collection.fields.remove(field.id);
      }
    }

    txApp.save(collection);
  },
);
