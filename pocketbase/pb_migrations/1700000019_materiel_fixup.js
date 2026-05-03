// Phase A6 — Fixup "materiel" collection (add missing fields)
// Existing: name, type, description, ownerUser, teamId, status, deleted, createdBy
// Adding: quantity, location, shareableWith (relation→teams), storeIn (relation→materiel self-ref), isStorage
migrate(
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("materiel");
    var teamsId = txApp.findCollectionByNameOrId("teams").id;

    collection.fields.add(new NumberField({ name: "quantity" }));
    collection.fields.add(new TextField({ name: "location" }));
    // shareableWith: teams avec qui le matériel est partagé
    collection.fields.add(
      new RelationField({
        name: "shareableWith",
        collectionId: teamsId,
        maxSelect: 999,
      }),
    );
    // isStorage: flag pour distinguer les conteneurs (caisse, boîte) des items
    collection.fields.add(new BoolField({ name: "isStorage" }));

    txApp.save(collection);

    // storeIn: self-referencing relation (item → conteneur) — needs collection ID after save
    var saved = txApp.findCollectionByNameOrId("materiel");
    saved.fields.add(
      new RelationField({
        name: "storeIn",
        collectionId: saved.id,
        maxSelect: 1,
      }),
    );
    txApp.save(saved);
  },
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("materiel");

    var fieldsToRemove = [
      "quantity",
      "location",
      "shareableWith",
      "storeIn",
      "isStorage",
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
