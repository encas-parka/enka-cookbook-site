// Phase A4 — Fixup "products" collection (add missing fields)
// Existing: eventId, productHugoUuid, productName, productType, pF, pS, store, specs, status, deleted
// Adding: stockReel (json), who, previousNames, isMerged, mergedFrom, mergeDate, mergeReason, isSynced, mergedInto (relation→products), totalNeededOverride (json), updatedBy (relation→users)
migrate(
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("products");
    var productsId = collection.id;

    // stockReel: JSON structuré {quantity, unit, notes, dateTime} — pas du texte libre
    collection.fields.add(new JSONField({ name: "stockReel" }));
    collection.fields.add(new JSONField({ name: "who" }));
    collection.fields.add(new JSONField({ name: "previousNames" }));
    collection.fields.add(new BoolField({ name: "isMerged" }));
    collection.fields.add(new JSONField({ name: "mergedFrom" }));
    collection.fields.add(new DateField({ name: "mergeDate" }));
    collection.fields.add(new TextField({ name: "mergeReason" }));
    collection.fields.add(new BoolField({ name: "isSynced" }));
    // mergedInto: relation vers products (ID du produit cible de fusion)
    collection.fields.add(
      new RelationField({
        name: "mergedInto",
        collectionId: productsId,
        maxSelect: 1,
      }),
    );
    // totalNeededOverride: JSON complexe {totalOverride, comment, totalComputedWhenOverride, ...}
    collection.fields.add(new JSONField({ name: "totalNeededOverride" }));
    // updatedBy: relation vers users
    collection.fields.add(
      new RelationField({
        name: "updatedBy",
        collectionId: "_pb_users_auth_",
        maxSelect: 1,
      }),
    );

    txApp.save(collection);
  },
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("products");

    var fieldsToRemove = [
      "stockReel",
      "who",
      "previousNames",
      "isMerged",
      "mergedFrom",
      "mergeDate",
      "mergeReason",
      "isSynced",
      "mergedInto",
      "totalNeededOverride",
      "updatedBy",
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
