// Phase A7 — Fixup "event_materiel" collection (add missing fields)
// Existing: eventId, type, status, groupId, specs, deleted
// Adding: name, quantity, who (text=name), where, sourceMaterielId (relation→materiel), loanId (relation→materiel_loan), notes, createdBy (relation→users), fromTeamName
migrate(
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("event_materiel");
    var materielId = txApp.findCollectionByNameOrId("materiel").id;
    var materielLoanId = txApp.findCollectionByNameOrId("materiel_loan").id;

    collection.fields.add(new TextField({ name: "name" }));
    collection.fields.add(new NumberField({ name: "quantity" }));
    // who: nom d'utilisateur unique (string)
    collection.fields.add(new TextField({ name: "who" }));
    collection.fields.add(new TextField({ name: "where" }));
    // sourceMaterielId: relation vers materiel
    collection.fields.add(
      new RelationField({
        name: "sourceMaterielId",
        collectionId: materielId,
        maxSelect: 1,
      }),
    );
    // loanId: relation vers materiel_loan
    collection.fields.add(
      new RelationField({
        name: "loanId",
        collectionId: materielLoanId,
        maxSelect: 1,
      }),
    );
    collection.fields.add(new TextField({ name: "notes" }));
    // createdBy: relation vers users
    collection.fields.add(
      new RelationField({
        name: "createdBy",
        collectionId: "_pb_users_auth_",
        maxSelect: 1,
      }),
    );
    collection.fields.add(new TextField({ name: "fromTeamName" }));

    txApp.save(collection);
  },
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("event_materiel");

    var fieldsToRemove = [
      "name",
      "quantity",
      "who",
      "where",
      "sourceMaterielId",
      "loanId",
      "notes",
      "createdBy",
      "fromTeamName",
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
