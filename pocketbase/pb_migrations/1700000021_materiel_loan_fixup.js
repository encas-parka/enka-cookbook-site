// Phase A8 — Fixup "materiel_loan" collection (add missing fields)
// Existing: materielId, borrowerUser, eventId, startDate, endDate, status, createdBy
// Adding: responsibleId (relation→users), responsibleName, ownerId (relation→users), ownerName, materiels (json), notes, completedAt, returnedAt, returnNotes, eventName
migrate(
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("materiel_loan");

    // responsibleId: relation vers users
    collection.fields.add(
      new RelationField({
        name: "responsibleId",
        collectionId: "_pb_users_auth_",
        maxSelect: 1,
      }),
    );
    collection.fields.add(new TextField({ name: "responsibleName" }));
    // ownerId: relation vers users
    collection.fields.add(
      new RelationField({
        name: "ownerId",
        collectionId: "_pb_users_auth_",
        maxSelect: 1,
      }),
    );
    collection.fields.add(new TextField({ name: "ownerName" }));
    // materiels: tableau de strings JSON-stringifiés (MaterielLoanItem[])
    collection.fields.add(new JSONField({ name: "materiels" }));
    collection.fields.add(new TextField({ name: "notes" }));
    collection.fields.add(new DateField({ name: "completedAt" }));
    collection.fields.add(new DateField({ name: "returnedAt" }));
    collection.fields.add(new TextField({ name: "returnNotes" }));
    collection.fields.add(new TextField({ name: "eventName" }));

    txApp.save(collection);
  },
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("materiel_loan");

    var fieldsToRemove = [
      "responsibleId",
      "responsibleName",
      "ownerId",
      "ownerName",
      "materiels",
      "notes",
      "completedAt",
      "returnedAt",
      "returnNotes",
      "eventName",
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
